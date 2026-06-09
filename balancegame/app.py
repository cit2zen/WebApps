import os
import uuid
from pathlib import Path
from functools import wraps

from flask import (
    Flask, request, session, redirect, url_for,
    render_template, jsonify, send_from_directory, abort
)
import psycopg2
import psycopg2.extras
from PIL import Image

app = Flask(__name__)
app.secret_key = os.environ["SECRET_KEY"]
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

UPLOAD_FOLDER = Path(os.environ.get("UPLOAD_FOLDER", "/app/uploads"))
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
MAX_IMAGE_SIZE = 800
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
PASSWORD = os.environ["BALANCE_PASSWORD"]


# ── DB ──────────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def init_db():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS bg_items (
                    id         SERIAL PRIMARY KEY,
                    title      TEXT NOT NULL,
                    image_path TEXT,
                    win_count  INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS bg_plays (
                    id        SERIAL PRIMARY KEY,
                    winner_id INT REFERENCES bg_items(id) ON DELETE SET NULL,
                    played_at TIMESTAMP DEFAULT NOW()
                )
            """)


with app.app_context():
    init_db()


# ── Auth ─────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("authenticated"):
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated


def is_settings_host():
    return "settings" in request.host


# ── Pages ─────────────────────────────────────────────────────────────

@app.route("/")
@login_required
def index():
    if is_settings_host():
        return render_template("settings.html")
    return render_template("game.html")


@app.route("/login", methods=["GET", "POST"])
def login_page():
    error = None
    if request.method == "POST":
        answer = request.form.get("answer", "").strip()
        if answer == PASSWORD:
            session["authenticated"] = True
            return redirect(url_for("index"))
        error = "틀렸어요. 다시 생각해봐요 👀"
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))


@app.route("/result")
@login_required
def result_page():
    return render_template("result.html")


# ── API: items ────────────────────────────────────────────────────────

@app.route("/api/items", methods=["GET"])
@login_required
def api_items():
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, title, image_path, win_count FROM bg_items ORDER BY created_at ASC")
            rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/items", methods=["POST"])
@login_required
def api_add_item():
    title = request.form.get("title", "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400

    image_path = None
    file = request.files.get("image")
    if file and file.filename:
        ext = Path(file.filename).suffix.lstrip(".").lower()
        if ext not in ALLOWED_EXTENSIONS:
            return jsonify({"error": "지원하지 않는 파일 형식"}), 400
        filename = uuid.uuid4().hex + "." + ("jpg" if ext in ("jpg", "jpeg") else ext)
        save_path = UPLOAD_FOLDER / filename
        img = Image.open(file.stream).convert("RGB")
        img.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE))
        img.save(save_path, optimize=True, quality=85)
        image_path = filename

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO bg_items (title, image_path) VALUES (%s, %s) RETURNING id",
                (title, image_path)
            )
            new_id = cur.fetchone()[0]

    return jsonify({"id": new_id, "title": title, "image_path": image_path, "win_count": 0}), 201


@app.route("/api/items/<int:item_id>", methods=["DELETE"])
@login_required
def api_delete_item(item_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT image_path FROM bg_items WHERE id = %s", (item_id,))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "not found"}), 404
            image_path = row[0]
            cur.execute("DELETE FROM bg_items WHERE id = %s", (item_id,))

    if image_path:
        target = UPLOAD_FOLDER / image_path
        if target.exists():
            target.unlink()

    return jsonify({"ok": True})


# ── API: win / rankings ───────────────────────────────────────────────

@app.route("/api/win/<int:item_id>", methods=["POST"])
@login_required
def api_win(item_id):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE bg_items SET win_count = win_count + 1 WHERE id = %s", (item_id,))
            cur.execute("INSERT INTO bg_plays (winner_id) VALUES (%s)", (item_id,))
    return jsonify({"ok": True})


@app.route("/api/rankings")
@login_required
def api_rankings():
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, title, image_path, win_count FROM bg_items ORDER BY win_count DESC, title ASC"
            )
            rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])


# ── Static: uploads ───────────────────────────────────────────────────

@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


if __name__ == "__main__":
    app.run(debug=False)

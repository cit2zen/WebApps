import os
import uuid
from pathlib import Path
from functools import wraps

from flask import (
    Flask, request, session, redirect, url_for,
    render_template, jsonify, send_from_directory
)
import psycopg2
import psycopg2.extras
from PIL import Image

app = Flask(__name__)
app.secret_key = os.environ["SECRET_KEY"]
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = False
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
            cur.execute("""
                CREATE TABLE IF NOT EXISTS bg_sets (
                    id         SERIAL PRIMARY KEY,
                    question   TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS bg_set_items (
                    set_id  INT REFERENCES bg_sets(id)  ON DELETE CASCADE,
                    item_id INT REFERENCES bg_items(id) ON DELETE CASCADE,
                    PRIMARY KEY (set_id, item_id)
                )
            """)
            cur.execute("""
                ALTER TABLE bg_plays
                ADD COLUMN IF NOT EXISTS set_id INT REFERENCES bg_sets(id) ON DELETE SET NULL
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
    return render_template("lobby.html")


@app.route("/game")
@login_required
def game_page():
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


# ── API: sets ─────────────────────────────────────────────────────────

@app.route("/api/sets", methods=["GET"])
@login_required
def api_get_sets():
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT s.id, s.question, COUNT(si.item_id) AS item_count
                FROM bg_sets s
                LEFT JOIN bg_set_items si ON s.id = si.set_id
                GROUP BY s.id
                ORDER BY s.created_at DESC
            """)
            rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/sets/<int:set_id>", methods=["GET"])
@login_required
def api_get_set(set_id):
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, question FROM bg_sets WHERE id = %s", (set_id,))
            s = cur.fetchone()
            if not s:
                return jsonify({"error": "not found"}), 404
            cur.execute("""
                SELECT i.id, i.title, i.image_path
                FROM bg_items i
                JOIN bg_set_items si ON i.id = si.item_id
                WHERE si.set_id = %s
                ORDER BY i.title
            """, (set_id,))
            items = cur.fetchall()
    return jsonify({"id": s["id"], "question": s["question"],
                    "items": [dict(i) for i in items]})


@app.route("/api/sets", methods=["POST"])
@login_required
def api_create_set():
    if not is_settings_host():
        return jsonify({"error": "forbidden"}), 403
    data = request.get_json() or {}
    question = data.get("question", "").strip()
    item_ids = data.get("item_ids", [])
    if not question:
        return jsonify({"error": "질문을 입력해주세요."}), 400
    if len(item_ids) < 2:
        return jsonify({"error": "항목을 2개 이상 선택해주세요."}), 400
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO bg_sets (question) VALUES (%s) RETURNING id", (question,))
            new_id = cur.fetchone()[0]
            for iid in item_ids:
                cur.execute("INSERT INTO bg_set_items (set_id, item_id) VALUES (%s, %s)", (new_id, iid))
    return jsonify({"id": new_id, "question": question, "item_count": len(item_ids)}), 201


@app.route("/api/sets/<int:set_id>", methods=["PUT"])
@login_required
def api_update_set(set_id):
    if not is_settings_host():
        return jsonify({"error": "forbidden"}), 403
    data = request.get_json() or {}
    question = data.get("question", "").strip()
    item_ids = data.get("item_ids", [])
    if not question:
        return jsonify({"error": "질문을 입력해주세요."}), 400
    if len(item_ids) < 2:
        return jsonify({"error": "항목을 2개 이상 선택해주세요."}), 400
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE bg_sets SET question = %s WHERE id = %s", (question, set_id))
            cur.execute("DELETE FROM bg_set_items WHERE set_id = %s", (set_id,))
            for iid in item_ids:
                cur.execute("INSERT INTO bg_set_items (set_id, item_id) VALUES (%s, %s)", (set_id, iid))
    return jsonify({"id": set_id, "question": question, "item_count": len(item_ids)})


@app.route("/api/sets/<int:set_id>", methods=["DELETE"])
@login_required
def api_delete_set(set_id):
    if not is_settings_host():
        return jsonify({"error": "forbidden"}), 403
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM bg_sets WHERE id = %s", (set_id,))
    return jsonify({"ok": True})


# ── API: win / rankings ───────────────────────────────────────────────

@app.route("/api/win/<int:item_id>", methods=["POST"])
@login_required
def api_win(item_id):
    data = request.get_json(silent=True) or {}
    set_id = data.get("set_id")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE bg_items SET win_count = win_count + 1 WHERE id = %s", (item_id,))
            cur.execute("INSERT INTO bg_plays (winner_id, set_id) VALUES (%s, %s)", (item_id, set_id))
    return jsonify({"ok": True})


@app.route("/api/rankings")
@login_required
def api_rankings():
    set_id = request.args.get("set_id", type=int)
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if set_id:
                cur.execute("""
                    SELECT i.id, i.title, i.image_path,
                           COUNT(p.id) AS win_count
                    FROM bg_items i
                    JOIN bg_set_items si ON i.id = si.item_id AND si.set_id = %s
                    LEFT JOIN bg_plays p ON i.id = p.winner_id AND p.set_id = %s
                    GROUP BY i.id
                    ORDER BY win_count DESC, i.title ASC
                """, (set_id, set_id))
            else:
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

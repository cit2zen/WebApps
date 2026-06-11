import hmac
import os
import time
import uuid
from pathlib import Path
from functools import wraps

from flask import (
    Flask, request, session, redirect, url_for,
    render_template, jsonify, send_from_directory
)
import psycopg2
import psycopg2.extras
from PIL import Image, ImageOps

app = Flask(__name__)
app.secret_key = os.environ["SECRET_KEY"]
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 업로드 폭주 방지 (10MB)

UPLOAD_FOLDER = Path(os.environ.get("UPLOAD_FOLDER", "/app/uploads"))
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
MAX_IMAGE_SIZE = 800
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
PASSWORD = os.environ["BALANCE_PASSWORD"]
# 크로스 링크용 고정 호스트 (request.host = Host 헤더 신뢰 회피). 기본값=운영 도메인.
GAME_HOST = os.environ.get("GAME_HOST", "balancegame.cityzen.kr")
SETTINGS_HOST = os.environ.get("SETTINGS_HOST", "balancegame-settings.cityzen.kr")


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
    # Host 헤더의 포트는 떼고 호스트명 정확 비교 (부분 문자열 매칭 금지)
    return request.host.partition(":")[0] == SETTINGS_HOST.partition(":")[0]


@app.errorhandler(413)
def request_too_large(e):
    return jsonify({"error": "요청이 너무 커요. 파일은 10MB 이하로 올려주세요."}), 413


@app.context_processor
def inject_cross_url():
    """게임 ↔ 설정 호스트 전환 링크 — request.host(조작 가능) 대신 고정 호스트 사용."""
    if is_settings_host():
        return {"cross_url": f"//{GAME_HOST}/", "cross_label": "게임으로 →"}
    return {"cross_url": f"//{SETTINGS_HOST}/", "cross_label": "설정 →"}


# ── Pages ─────────────────────────────────────────────────────────────

@app.route("/")
@login_required
def index():
    if is_settings_host():
        return render_template("items.html")
    return render_template("lobby.html")


@app.route("/sets-manage")
@login_required
def sets_manage_page():
    if not is_settings_host():
        return redirect(url_for("index"))
    return render_template("items.html")


@app.route("/game")
@login_required
def game_page():
    return render_template("game.html")


LOGIN_MAX_FAILS = 5
LOGIN_LOCK_SECONDS = 60


@app.route("/login", methods=["GET", "POST"])
def login_page():
    error = None
    if request.method == "POST":
        now = time.time()
        locked_until = session.get("login_locked_until", 0)
        if now < locked_until:
            error = f"시도가 너무 많아요. {int(locked_until - now) + 1}초 후 다시 시도해주세요."
        else:
            answer = request.form.get("answer", "").strip()
            if hmac.compare_digest(answer, PASSWORD):
                session.pop("login_fails", None)
                session.pop("login_locked_until", None)
                session["authenticated"] = True
                return redirect(url_for("index"))
            fails = session.get("login_fails", 0) + 1
            if fails >= LOGIN_MAX_FAILS:
                session["login_locked_until"] = now + LOGIN_LOCK_SECONDS
                session["login_fails"] = 0
                error = f"{LOGIN_MAX_FAILS}회 틀렸어요. {LOGIN_LOCK_SECONDS}초 후 다시 시도해주세요."
            else:
                session["login_fails"] = fails
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
    if not is_settings_host():
        return jsonify({"error": "forbidden"}), 403
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
        # exif_transpose: 폰 사진의 EXIF 방향을 픽셀에 반영 (저장 시 EXIF가 제거되므로 필수)
        img = ImageOps.exif_transpose(Image.open(file.stream)).convert("RGB")
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


@app.route("/api/items/<int:item_id>", methods=["PATCH"])
@login_required
def api_update_item(item_id):
    if not is_settings_host():
        return jsonify({"error": "forbidden"}), 403
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "이름을 입력해주세요."}), 400
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE bg_items SET title = %s WHERE id = %s RETURNING id", (title, item_id))
            if not cur.fetchone():
                return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True, "title": title})


@app.route("/api/items/<int:item_id>/rotate", methods=["POST"])
@login_required
def api_rotate_item(item_id):
    if not is_settings_host():
        return jsonify({"error": "forbidden"}), 403
    data = request.get_json(silent=True) or {}
    direction = data.get("dir", "cw")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT image_path FROM bg_items WHERE id = %s", (item_id,))
            row = cur.fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    if not row[0]:
        return jsonify({"error": "사진이 없는 항목이에요."}), 400
    src = UPLOAD_FOLDER / row[0]
    if not src.exists():
        return jsonify({"error": "원본 파일이 없어요."}), 404

    angle = -90 if direction == "cw" else 90  # PIL rotate는 반시계가 양수
    img = Image.open(src).rotate(angle, expand=True)
    # 새 파일명으로 저장 — 게임·브라우저 캐시 무효화를 파일명 교체로 보장
    new_name = uuid.uuid4().hex + src.suffix
    img.save(UPLOAD_FOLDER / new_name, optimize=True, quality=85)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE bg_items SET image_path = %s WHERE id = %s", (new_name, item_id))
    src.unlink()

    return jsonify({"ok": True, "image_path": new_name})


@app.route("/api/items/<int:item_id>", methods=["DELETE"])
@login_required
def api_delete_item(item_id):
    if not is_settings_host():
        return jsonify({"error": "forbidden"}), 403
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
                SELECT s.id, s.question, COUNT(si.item_id) AS item_count,
                       COALESCE(array_agg(i.title ORDER BY i.title)
                                FILTER (WHERE i.title IS NOT NULL), '{}') AS item_titles,
                       (SELECT i2.image_path
                        FROM bg_items i2
                        JOIN bg_set_items si2 ON i2.id = si2.item_id
                        WHERE si2.set_id = s.id AND i2.image_path IS NOT NULL
                        ORDER BY i2.title
                        LIMIT 1) AS cover_image
                FROM bg_sets s
                LEFT JOIN bg_set_items si ON s.id = si.set_id
                LEFT JOIN bg_items i ON i.id = si.item_id
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

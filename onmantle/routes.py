import unicodedata
from datetime import datetime

import pytz
from flask import Blueprint, request, jsonify
from sqlalchemy import text

from models import db, Secret, Nearest, Similarity, Score, LunchPick
from puzzle import get_current_puzzle_number, get_current_slot, get_next_change_time
from hints import get_hint

KST = pytz.timezone("Asia/Seoul")

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.route("/puzzle", methods=["GET"])
def puzzle_info():
    puzzle_number = get_current_puzzle_number()
    slot = get_current_slot()
    next_change = get_next_change_time()

    # 10등, 1000등 유사도 기준값
    rank10 = Nearest.query.filter_by(secret_idx=puzzle_number, rank=10).first()
    rank1000 = Nearest.query.filter_by(secret_idx=puzzle_number, rank=1000).first()

    return jsonify({
        "puzzle_number": puzzle_number,
        "slot": slot,
        "next_change_at": next_change.isoformat(),
        "rank10_similarity": rank10.similarity if rank10 else None,
        "rank10_word": rank10.word if rank10 else None,
        "rank1000_similarity": rank1000.similarity if rank1000 else None,
        "rank1000_word": rank1000.word if rank1000 else None,
    })


@api_bp.route("/guess", methods=["POST"])
def guess():
    data = request.get_json(silent=True) or {}
    word = data.get("word", "").strip()
    if not word:
        return jsonify({"error": "단어를 입력해주세요"}), 400
    word = unicodedata.normalize("NFC", word)

    puzzle_number = get_current_puzzle_number()
    secret = db.session.get(Secret, puzzle_number)
    if secret is None:
        return jsonify({"error": "퍼즐 데이터 없음"}), 500

    # 사전계산 similarities 테이블 직접 조회. 없는 단어면 row 없음 → 404.
    row = db.session.execute(
        text(
            "SELECT similarity, rank FROM similarities "
            "WHERE secret_idx = :n AND word = :w"
        ),
        {"n": puzzle_number, "w": word},
    ).first()
    if row is None:
        return jsonify({"error": "알 수 없는 단어"}), 404

    # similarity는 이미 -100~100 스케일이므로 ×100 하지 않는다.
    similarity = round(float(row.similarity), 2)
    is_correct = (word == secret.word)

    result = {"word": word, "similarity": similarity, "is_correct": is_correct}
    # 상위 1000위 안이면 순위 제공(similarities.rank 인라인)
    if row.rank is not None:
        result["rank"] = int(row.rank)
    return jsonify(result)


@api_bp.route("/hint", methods=["GET"])
def hint():
    try:
        level = int(request.args.get("level", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "유효한 레벨을 입력해주세요"}), 400
    if level < 1 or level > 5:
        return jsonify({"error": "힌트 레벨은 1~5 사이여야 합니다"}), 400
    puzzle_number = get_current_puzzle_number()
    secret = db.session.get(Secret, puzzle_number)
    if secret is None:
        return jsonify({"error": "퍼즐 데이터 없음"}), 500
    nearest_word = None
    if level == 4:
        top = Nearest.query.filter_by(secret_idx=puzzle_number, rank=1).first()
        nearest_word = top.word if top else None
    return jsonify(get_hint(secret.word, secret.pos, level, nearest_word))


@api_bp.route("/nearest/<int:puzzle_number>", methods=["GET"])
def nearest_words(puzzle_number: int):
    if puzzle_number == get_current_puzzle_number():
        return jsonify({"error": "현재 활성 퍼즐은 공개할 수 없습니다"}), 403
    secret = db.session.get(Secret, puzzle_number)
    if secret is None:
        return jsonify({"error": "해당 퍼즐이 존재하지 않습니다"}), 404
    rows = Nearest.query.filter_by(secret_idx=puzzle_number).order_by(Nearest.rank).all()
    return jsonify({
        "puzzle_number": puzzle_number,
        "word": secret.word,
        "nearest": [{"rank": r.rank, "word": r.word, "similarity": r.similarity} for r in rows],
    })


@api_bp.route("/scores/<int:puzzle_number>", methods=["GET"])
def get_scores(puzzle_number: int):
    rows = (
        Score.query
        .filter_by(puzzle_number=puzzle_number)
        .order_by(Score.guess_count, Score.hints_used)
        .all()
    )
    return jsonify({
        "puzzle_number": puzzle_number,
        "scores": [
            {
                "name": r.name,
                "guess_count": r.guess_count,
                "hints_used": r.hints_used,
                "solved_at": r.solved_at,
            }
            for r in rows
        ],
    })


@api_bp.route("/scores", methods=["POST"])
def post_score():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    solved_at = data.get("solved_at", "")
    try:
        puzzle_number = int(data.get("puzzle_number"))
        guess_count = int(data.get("guess_count"))
        hints_used = int(data.get("hints_used", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "퍼즐 번호·추측 횟수가 올바르지 않습니다"}), 400
    if not name:
        return jsonify({"error": "이름이 필요합니다"}), 400
    if len(name) > 20:
        return jsonify({"error": "이름은 20자 이하로 입력해주세요"}), 400
    if guess_count < 0 or hints_used < 0:
        return jsonify({"error": "잘못된 값입니다"}), 400

    score = Score(
        puzzle_number=puzzle_number,
        name=name,
        guess_count=guess_count,
        hints_used=hints_used,
        solved_at=solved_at or datetime.now(KST).isoformat(),
    )
    db.session.add(score)
    db.session.commit()
    return jsonify({"ok": True}), 201


# --- 점메추 (점심 메뉴 추천) ---

@api_bp.route("/lunch", methods=["GET"])
def get_lunch():
    today = datetime.now(KST).strftime("%Y-%m-%d")
    rows = (
        LunchPick.query
        .filter(LunchPick.created_at >= today)
        .order_by(LunchPick.likes.desc(), LunchPick.id.desc())
        .limit(50)
        .all()
    )
    return jsonify({
        "picks": [
            {
                "id": r.id,
                "nickname": r.nickname,
                "menu": r.menu,
                "likes": r.likes,
                "created_at": r.created_at,
            }
            for r in rows
        ],
    })


@api_bp.route("/lunch", methods=["POST"])
def post_lunch():
    data = request.get_json(silent=True) or {}
    nickname = data.get("nickname", "").strip()
    menu = data.get("menu", "").strip()
    if not nickname or not menu:
        return jsonify({"error": "닉네임과 메뉴를 입력해주세요"}), 400
    if len(nickname) > 20 or len(menu) > 30:
        return jsonify({"error": "닉네임 20자, 메뉴 30자 이하"}), 400

    pick = LunchPick(
        nickname=nickname,
        menu=menu,
        likes=0,
        created_at=datetime.now(KST).isoformat(),
    )
    db.session.add(pick)
    db.session.commit()
    return jsonify({"ok": True, "id": pick.id}), 201


@api_bp.route("/lunch/<int:pick_id>/like", methods=["POST"])
def like_lunch(pick_id: int):
    pick = db.session.get(LunchPick, pick_id)
    if pick is None:
        return jsonify({"error": "해당 항목이 없습니다"}), 404
    pick.likes += 1
    db.session.commit()
    return jsonify({"ok": True, "likes": pick.likes})

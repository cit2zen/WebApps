from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Similarity(db.Model):
    """사전계산된 (시크릿, 단어) 유사도·순위. 추측은 이 테이블 조회로 처리."""
    __tablename__ = "similarities"
    secret_idx = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.Text, primary_key=True)
    similarity = db.Column(db.Float, nullable=False)
    rank = db.Column(db.Integer)  # 상위 1000위만 채워짐(그 외 NULL)


class Secret(db.Model):
    """시크릿 단어 (seed가 similarities의 similarity=100 행에서 유도)."""
    __tablename__ = "secrets"
    idx = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.Text, nullable=False)


class Nearest(db.Model):
    """시크릿별 상위 1000개 근접 단어 (순위 기준값·힌트용)."""
    __tablename__ = "nearest"
    secret_idx = db.Column(db.Integer, primary_key=True)
    rank = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.Text, nullable=False)
    similarity = db.Column(db.Float, nullable=False)


class Score(db.Model):
    __tablename__ = "scores"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    puzzle_number = db.Column(db.Integer, nullable=False)
    name = db.Column(db.Text, nullable=False)
    guess_count = db.Column(db.Integer, nullable=False)
    hints_used = db.Column(db.Integer, nullable=False, default=0)
    solved_at = db.Column(db.Text, nullable=False)  # ISO 8601 (KST)


class LunchPick(db.Model):
    __tablename__ = "lunch_picks"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nickname = db.Column(db.Text, nullable=False)
    menu = db.Column(db.Text, nullable=False)
    likes = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.Text, nullable=False)  # ISO 8601 (KST)

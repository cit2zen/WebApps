from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Secret(db.Model):
    """시크릿 단어 (seed가 secrets 테이블을 raw SQL로 적재)."""
    __tablename__ = "secrets"
    idx = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.Text, nullable=False)
    pos = db.Column(db.Text)  # 품사(힌트 레벨 1용)


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

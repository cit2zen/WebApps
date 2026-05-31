from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Word(db.Model):
    """어휘 단어. vec(vector(300)) 컬럼은 seed.py가 생성·관리한다.
    (런타임 numpy/pgvector-python 의존을 없애려고 ORM에 비매핑 — 유사도는 SQL로 계산.)"""
    __tablename__ = "words"
    word = db.Column(db.Text, primary_key=True)


class Secret(db.Model):
    __tablename__ = "secrets"
    idx = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.Text, db.ForeignKey("words.word"), nullable=False)
    pos = db.Column(db.Text)


class Nearest(db.Model):
    """시크릿별 상위 1000개 근접 단어 (순위 표시·힌트용)."""
    __tablename__ = "nearest"
    secret_idx = db.Column(db.Integer, primary_key=True)
    rank = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.Text, nullable=False)
    similarity = db.Column(db.Float, nullable=False)
    __table_args__ = (
        db.Index("ix_nearest_secret_word", "secret_idx", "word"),
    )


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

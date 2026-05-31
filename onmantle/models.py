from flask_sqlalchemy import SQLAlchemy
from pgvector.sqlalchemy import Vector

db = SQLAlchemy()


class Word(db.Model):
    """어휘 단어와 300차원 FastText 벡터 (pgvector)."""
    __tablename__ = "words"
    word = db.Column(db.Text, primary_key=True)
    vec = db.Column(Vector(300), nullable=False)


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

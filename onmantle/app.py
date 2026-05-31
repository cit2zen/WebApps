from flask import Flask, send_from_directory

from config import DATABASE_URL
from models import db


def create_app(test_config: dict | None = None) -> Flask:
    # 정적 프론트(static/)를 같은 오리진에서 서빙 → CORS·외부 IP 불필요
    app = Flask(__name__, static_folder="static", static_url_path="")
    if test_config:
        app.config.update(test_config)
    else:
        app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    from routes import api_bp
    app.register_blueprint(api_bp)

    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    with app.app_context():
        # 게임 데이터(similarities/secrets/nearest)는 seed.py로 적재.
        # scores/lunch_picks는 여기서 보장(없으면 생성).
        db.create_all()

    return app


if __name__ == "__main__":
    create_app().run(debug=True, port=5000)

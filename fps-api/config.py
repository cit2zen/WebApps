"""환경 설정 — 모든 비밀은 환경 변수(Coolify)로만 받는다. 저장소엔 .env.example만."""
import logging
import os
import secrets

from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("fps-api")

# 클라이언트(Unity) 빌드에 컴파일되는 서명 키의 개발 기본값. 운영은 FPS_API_KEY로 덮어쓴다(클라이언트 OnlineConfig와 같은 값)
DEV_API_KEY = "fps-dev-key-change-me"

# CORS 허용 — 정확 일치 오리진
ORIGINS = {
    "https://games.cityzen.kr",
    "http://127.0.0.1:8777",
    "http://localhost:8777",
    "https://app.crazygames.com",        # CrazyGames Android 앱
    "capacitor://app.crazygames.com",    # CrazyGames iOS 앱
}
# CrazyGames 게임 iframe = https://<slug>.game-files.crazygames.com, 포털 = *.crazygames.<지역 TLD> / 1001juegos.com
# (docs.crazygames.com/resources/html5/sitelock). TLD를 나열해 crazygames.evil.com 같은 우회를 막는다
_CG_TLDS = r"com|fr|co\.id|cz|dk|hu|nl|no|pl|com\.br|ro|fi|se|ru|com\.ua|at|jp|pt|vn|com\.vn|co\.kr"
ORIGIN_PATTERNS = (
    rf"^https://([a-z0-9-]+\.)*crazygames\.({_CG_TLDS})$",
    r"^https://([a-z0-9-]+\.)*1001juegos\.com$",
)


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        # 로컬·테스트 폴백: 앱 폴더의 SQLite 파일
        return "sqlite:///" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "fps_api.sqlite3")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def from_env() -> dict:
    cfg = {
        "DATABASE_URL": _database_url(),
        "FPS_API_KEY": os.environ.get("FPS_API_KEY", DEV_API_KEY),
        "FPS_ADMIN_KEY": os.environ.get("FPS_ADMIN_KEY", ""),       # 비면 /api/stats 비활성
        # IP는 저장·집계 모두 솔트 해시로만. 미설정이면 프로세스마다 무작위(재시작 후 연결 불가 = 기본 프라이버시)
        "FPS_IP_SALT": os.environ.get("FPS_IP_SALT", "") or secrets.token_hex(16),
        # Cloudflare 터널 뒤: CF가 덮어쓰는 CF-Connecting-IP를 신뢰. 직접 노출 서버면 빈 값으로(remote_addr 사용)
        "FPS_IP_HEADER": os.environ.get("FPS_IP_HEADER", "CF-Connecting-IP"),
        "FPS_EXTRA_ORIGINS": [o.strip() for o in os.environ.get("FPS_EXTRA_ORIGINS", "").split(",") if o.strip()],
        "FPS_SCORE_SLACK": float(os.environ.get("FPS_SCORE_SLACK", "1.5")),
        # 토큰 버킷(용량, 초당 보충) — 워커별 인메모리
        "RATE_SCORES": (6, 0.1),
        "RATE_RUNS": (10, 0.2),
        "RATE_READ": (60, 2.0),
    }
    if os.environ.get("DATABASE_URL") and cfg["FPS_API_KEY"] == DEV_API_KEY:
        log.warning("FPS_API_KEY 미설정 — 운영 DB에 개발 기본 키로 서명 검증 중")
    return cfg

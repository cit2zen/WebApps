"""입력 검증 — 이름 필터·욕설 차단·필드 형식·그럴듯함(plausibility) 검사.
그럴듯함 상한은 게임 Tuning.cs(점수·시계 규칙)에서 넉넉히 유도한 값 — 규칙이 바뀌면 여기와 FPS_SCORE_SLACK을 같이 본다."""
import re
import unicodedata
from datetime import datetime, timezone

NAME_MIN, NAME_MAX = 2, 12
_NAME_OK = re.compile(r"^[0-9A-Za-z가-힣ㄱ-ㆎ_\- ]+$")   # 영문·숫자·한글(음절·자모)·_ - 공백
BOARD_RE = re.compile(r"^(std-[a-z0-9_-]{1,24}|daily-(\d{8}))$")
RUN_RE = re.compile(r"^[0-9a-f]{16,32}$")
VERSION_RE = re.compile(r"^[0-9A-Za-z._-]{1,24}$")
ARENA_RE = re.compile(r"^[a-z0-9_-]{1,24}$")
DEATH_RE = re.compile(r"^[a-z_]{1,16}$")
MODS_RE = re.compile(r"^([A-Za-z]{1,24}=\d{1,2})(;[A-Za-z]{1,24}=\d{1,2}){0,31}$")

# 기본 욕설 목록(정규화 후 부분 일치). 완벽하지 않다 — 신고·수동 삭제가 최종 수단
_BLOCK = (
    "fuck", "fuk", "shit", "bitch", "cunt", "nigg", "fag", "rape", "nazi", "hitler", "whore", "slut", "retard",
    "cock", "dick", "pussy", "penis", "vagina", "porn", "sex", "kkk",
    "씨발", "시발", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "좆", "존나", "ㅈㄴ", "개새", "새끼", "지랄", "ㅈㄹ", "느금", "니미",
    "엠창", "보지", "자지", "섹스", "창녀", "애미", "애비", "씹", "꺼져", "닥쳐", "틀딱", "한남", "김치녀", "일베",
)
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s"})


def _squash(s: str) -> str:
    return re.sub(r"[\s_\-]", "", s.lower()).translate(_LEET)


def clean_name(raw):
    """(이름, 오류코드) — NFC 정규화·양끝 공백 제거·연속 공백 1칸"""
    if not isinstance(raw, str):
        return None, "invalid_name"
    name = re.sub(r"\s+", " ", unicodedata.normalize("NFC", raw)).strip()
    if not (NAME_MIN <= len(name) <= NAME_MAX) or not _NAME_OK.match(name):
        return None, "invalid_name"
    squashed = _squash(name)
    if any(bad in squashed for bad in _BLOCK):
        return None, "name_rejected"
    return name, None


def name_key(name: str) -> str:
    return re.sub(r"\s+", " ", name.lower())


def as_int(v, lo, hi):
    """정수만(불리언·소수·문자열 거부). 범위 밖이면 None"""
    if isinstance(v, bool) or not isinstance(v, int):
        return None
    return v if lo <= v <= hi else None


def check_board(board, today=None):
    """std-<아레나> | daily-YYYYMMDD(서버 UTC 기준 ±1일 — 자정 걸친 판 허용)"""
    if not isinstance(board, str):
        return None
    m = BOARD_RE.match(board)
    if not m:
        return None
    if m.group(2):
        try:
            d = datetime.strptime(m.group(2), "%Y%m%d").date()
        except ValueError:
            return None
        today = today or datetime.now(timezone.utc).date()
        if abs((d - today).days) > 1:
            return None
    return board


def match(regex, v):
    return v if isinstance(v, str) and regex.match(v) else None


# ── 그럴듯함 ────────────────────────────────────────────────────────
# 처치 1회 상한: 불워크 400 × 콤보 3.0 × 코어 1.5 = 1800 + 상한 환전(초 × 50) ≈ 500 → 2500
# 보스(워든) 추가분: 2000 × 3 × 1.5 + 환전 ≈ 10200 → 12000/보스(5웨이브마다)
# 웨이브 클리어: 500n + 10 × 시계(≤ 80) + 클리어 보너스 환전(≤ 12 × 50) → 500n + 1400
PER_KILL, PER_BOSS, CLEAR_EXTRA = 2500, 12000, 1400
MIN_SECONDS_PER_WAVE = 2          # 클리어한 웨이브마다 전투 시간 최소(스폰 간격만 ≥ 2.6초)
KILLS_PER_WAVE = 45               # 웨이브당 적 수 상한(드론 24 + 랜서 6 + 불워크 3 + 보스 + 소환)
MAX_WAVE, MAX_SECONDS = 999, 4 * 3600
IDLE_SLACK = 600


def score_cap(wave, kills, slack):
    base = PER_KILL * kills + PER_BOSS * (wave // 5 + 1) + 250 * wave * (wave + 1) + CLEAR_EXTRA * wave
    return int(base * slack)


def implausible(score, wave, seconds, kills, revived, slack=1.5):
    """문제가 있으면 이유 문자열, 괜찮으면 None"""
    if kills > KILLS_PER_WAVE * wave + 10:
        return "kills"
    if seconds < MIN_SECONDS_PER_WAVE * (wave - 1):
        return "too_fast"
    if kills > 5 * seconds + 20:
        return "kill_rate"
    # 시계로 벌 수 있는 총 시간: 시작 30 + 처치당 ≤ 25초 + 웨이브 보너스 ≤ 12 + 부활 15
    # + 여유 600초(튜토리얼은 안내 전까지 시계가 멈춰도 RunTime은 흐른다)
    if seconds > 30 + 25 * kills + 12 * wave + 15 * revived + IDLE_SLACK:
        return "too_long"
    if score > score_cap(wave, kills, slack):
        return "score"
    return None


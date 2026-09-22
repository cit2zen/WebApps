"""서명(HMAC-SHA256)·IP 해시·토큰 버킷 레이트 리밋.
서명 키는 클라이언트 빌드에 들어 있어 비밀이 아니다 — 스크립트 조작을 한 단계 어렵게 할 뿐, 그럴듯함 검사가 실제 방어선."""
import hashlib
import hmac
import threading
import time


def canonical(parts) -> bytes:
    """"v1|score|board|name|..." — 필드 값엔 '|'가 올 수 없다(검증 정규식이 막음)"""
    return "|".join(str(p) for p in parts).encode("utf-8")


def sign(key: str, parts) -> str:
    return hmac.new(key.encode("utf-8"), canonical(parts), hashlib.sha256).hexdigest()


def verify(key: str, parts, sig) -> bool:
    if not isinstance(sig, str) or len(sig) != 64:
        return False
    return hmac.compare_digest(sign(key, parts), sig.lower())


def score_parts(p):
    return ("v1", "score", p["board"], p["name"], p["score"], p["wave"], p["seconds"], p["kills"],
            p["revived"], p["version"], p["run"])


def run_parts(p):
    return ("v1", "run", p["run"], p["board"], p["wave"], p["seconds"], p["kills"], p["score"], p["version"])


def client_ip(request, header: str) -> str:
    if header:
        v = request.headers.get(header, "").strip()
        if v:
            return v.split(",")[0].strip()
    return request.remote_addr or "0.0.0.0"


def ip_hash(salt: str, ip: str) -> str:
    return hmac.new(salt.encode("utf-8"), ip.encode("utf-8"), hashlib.sha256).hexdigest()[:24]


class TokenBucket:
    """키(IP 해시)별 토큰 버킷 — 인메모리·워커별. 가득 찬 버킷은 주기적으로 버린다"""

    def __init__(self, capacity: float, refill_per_sec: float, clock=time.monotonic):
        self.capacity = float(capacity)
        self.rate = float(refill_per_sec)
        self.clock = clock
        self.state = {}
        self.lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = self.clock()
        with self.lock:
            tokens, last = self.state.get(key, (self.capacity, now))
            tokens = min(self.capacity, tokens + (now - last) * self.rate)
            ok = tokens >= 1.0
            if ok:
                tokens -= 1.0
            self.state[key] = (tokens, now)
            if len(self.state) > 20000:
                self._prune(now)
            return ok

    def retry_after(self, key: str) -> int:
        tokens, _ = self.state.get(key, (0.0, 0.0))
        return max(1, int((1.0 - tokens) / self.rate) + 1) if self.rate > 0 else 60

    def _prune(self, now):
        full = [k for k, (t, last) in self.state.items() if t + (now - last) * self.rate >= self.capacity]
        for k in full:
            del self.state[k]

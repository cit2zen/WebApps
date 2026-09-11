"""services.json의 status=live 서비스를 핑해 실패 시 Actions 로그로 남긴다.

GitHub Actions(uptime.yml, 10분 주기)에서 실행. 로컬 수동 실행도 가능:
  python .github/scripts/uptime.py
Discord 알림은 2026-09-11 사용자 요청으로 비활성화(제거)됨 — 실패는 Actions 실행 결과(exit 1)로만 확인.
"""
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG = json.load(open(os.path.join(ROOT, "services.json"), encoding="utf-8"))

fails = []
for svc in REG["services"]:
    if svc.get("status") != "live" or not svc.get("url"):
        continue
    try:
        req = urllib.request.Request(svc["url"], headers={"User-Agent": "cityzen-uptime/1.0"})
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status >= 400:
                fails.append((svc["name"], svc["url"], f"HTTP {res.status}"))
    except Exception as e:  # noqa: BLE001 - 어떤 실패든 다운으로 집계
        fails.append((svc["name"], svc["url"], str(e)[:120]))

if not fails:
    print("all live services OK")
    sys.exit(0)

msg = "cityzen 서비스 다운 감지\n" + "\n".join(
    f"- {n} {u} — {err}" for n, u, err in fails)
print(msg)
sys.exit(1)

"""services.json의 status=live 서비스를 핑하고, 실패 시 Discord(ClaudeBot 채널)로 알림.

GitHub Actions(uptime.yml, 10분 주기)에서 실행. 로컬 수동 실행도 가능:
  DISCORD_BOT_TOKEN=... DISCORD_CHANNEL_ID=... python .github/scripts/uptime.py
다운이 지속되는 동안 매 주기 알림이 반복됨(의도 — 복구 전까지 상기).
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

token = os.environ.get("DISCORD_BOT_TOKEN")
channel = os.environ.get("DISCORD_CHANNEL_ID")
msg = "🚨 **cityzen 서비스 다운 감지**\n" + "\n".join(
    f"- **{n}** {u} — {err}" for n, u, err in fails)
print(msg)
if token and channel:
    data = json.dumps({"content": msg}).encode()
    req = urllib.request.Request(
        f"https://discord.com/api/v10/channels/{channel}/messages", data=data,
        headers={"Authorization": f"Bot {token}", "Content-Type": "application/json",
                 "User-Agent": "cityzen-uptime/1.0"})
    urllib.request.urlopen(req, timeout=15)
    print("Discord alert sent")
sys.exit(1)

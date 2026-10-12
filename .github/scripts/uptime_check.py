#!/usr/bin/env python3
"""cityzen 업타임 감시 — services.json의 live 서비스를 점검하고 GitHub 이슈(label: uptime)로 알린다.

- 표준 라이브러리만 사용. 알림/상태 저장은 `gh` CLI (GH_TOKEN 필요).
- 다운이어도 exit 0 (알림은 이슈로). 스크립트 오류일 때만 non-zero.
- --dry-run: 결과와 예정된 이슈 동작만 출력하고 gh는 호출하지 않는다.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

UA = "cityzen-uptime/1.0 (+github actions)"
TIMEOUT = 15
RETRY_DELAY = 10
LABEL = "uptime"
OWNER = "@cit2zen"
KST = timezone(timedelta(hours=9))
STATE_RE = re.compile(r"<!-- uptime-state: (\[.*?\]) -->")
HINT = "530 = 홈서버 VM/터널 다운 → home PC에서 VirtualBox VM 재시작"


def load_urls(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    urls = []
    for s in data.get("services", []):
        url = s.get("url")
        if s.get("status") == "live" and url and url not in urls:
            urls.append(url)
    return urls


def is_cf_challenge(code, headers, body):
    if code not in (403, 429, 503):
        return False
    if (headers.get("cf-mitigated") or "").lower() == "challenge":
        return True
    return ("challenge-platform" in body or "Just a moment..." in body) and "cloudflare" in body.lower()


def probe_once(url):
    """returns dict(state=up|down|blocked, code, error)"""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:  # urllib follows redirects
            r.read(2048)
            return {"state": "up" if r.status < 400 else "down", "code": r.status, "error": ""}
    except urllib.error.HTTPError as e:
        try:
            body = e.read(65536).decode("utf-8", "replace")
        except Exception:
            body = ""
        hdrs = {k.lower(): v for k, v in (e.headers or {}).items()}
        if is_cf_challenge(e.code, hdrs, body):
            return {"state": "blocked", "code": e.code, "error": "Cloudflare challenge"}
        err = "터널/홈서버 다운 (CF 1033)" if e.code == 530 or "error code: 1033" in body else ""
        return {"state": "down", "code": e.code, "error": err or str(e.reason)}
    except Exception as e:  # timeout, DNS, TLS, connection reset
        reason = getattr(e, "reason", None) or e
        return {"state": "down", "code": None, "error": f"{type(e).__name__}: {reason}"[:160]}


def probe(url):
    res = probe_once(url)
    if res["state"] == "down":
        time.sleep(RETRY_DELAY)
        res = probe_once(url)
        res["retried"] = True
    res["url"] = url
    return res


def gh(*args, check=True):
    p = subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8")
    if check and p.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args[:3])} failed: {p.stderr.strip()}")
    return p.stdout


def now_kst():
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def table(down):
    lines = ["| URL | 코드 | 오류 |", "|---|---|---|"]
    for r in down:
        lines.append(f"| {r['url']} | {r['code'] if r['code'] is not None else '-'} | {r['error'] or '-'} |")
    return "\n".join(lines)


def state_marker(urls):
    return f"<!-- uptime-state: {json.dumps(sorted(urls))} -->"


def fmt_duration(sec):
    sec = int(sec)
    h, m = sec // 3600, (sec % 3600) // 60
    return f"{h}시간 {m}분" if h else f"{m}분"


def decide(repo, down, dry_run):
    """returns (action, detail) and performs it unless dry_run."""
    down_urls = sorted(r["url"] for r in down)
    if dry_run and not repo:
        return ("(repo 미지정 — 이슈 조회 생략)", f"down={len(down_urls)}")

    issues = json.loads(gh("issue", "list", "--repo", repo, "--label", LABEL, "--state", "open",
                           "--json", "number,createdAt,body,url", "--limit", "10"))
    issue = min(issues, key=lambda i: i["number"]) if issues else None

    if issue is None:
        if not down_urls:
            return ("none", "전부 정상, 열린 이슈 없음")
        title = f"🔴 서비스 다운 감지 — {len(down_urls)}개"
        body = (f"{OWNER} 서비스 다운 감지 ({now_kst()})\n\n{table(down)}\n\n> {HINT}\n\n"
                f"_자동 감시: `.github/workflows/uptime.yml` (5분 간격). 복구되면 자동으로 닫힙니다._\n\n"
                f"{state_marker(down_urls)}")
        if dry_run:
            return ("open-issue", title)
        gh("label", "create", LABEL, "--repo", repo, "--color", "d73a4a",
           "--description", "업타임 감시 자동 알림", check=False)
        out = gh("issue", "create", "--repo", repo, "--title", title, "--body", body, "--label", LABEL)
        return ("open-issue", out.strip())

    # 이전 상태: 본문 + 댓글 중 마지막 마커
    n = issue["number"]
    texts = [issue.get("body") or ""]
    comments = json.loads(gh("api", f"repos/{repo}/issues/{n}/comments?per_page=100"))
    texts += [c.get("body") or "" for c in comments]
    prev = None
    for t in texts:
        for m in STATE_RE.finditer(t):
            prev = sorted(json.loads(m.group(1)))

    if not down_urls:
        created = datetime.fromisoformat(issue["createdAt"].replace("Z", "+00:00"))
        dur = fmt_duration((datetime.now(timezone.utc) - created).total_seconds())
        body = f"✅ 전부 복구 ({now_kst()}) — 다운 지속 약 {dur}. {OWNER}\n\n{state_marker([])}"
        if dry_run:
            return ("close-issue", f"#{n} ({dur})")
        gh("issue", "comment", str(n), "--repo", repo, "--body", body)
        gh("issue", "close", str(n), "--repo", repo)
        return ("close-issue", f"#{n} ({dur})")

    if prev == down_urls:
        return ("none", f"#{n} 변화 없음 ({len(down_urls)}개 다운)")

    body = (f"{OWNER} 다운 목록 변경 ({now_kst()}) — {len(down_urls)}개\n\n{table(down)}\n\n> {HINT}\n\n"
            f"{state_marker(down_urls)}")
    if dry_run:
        return ("comment", f"#{n} → {len(down_urls)}개")
    gh("issue", "comment", str(n), "--repo", repo, "--body", body)
    return ("comment", f"#{n} → {len(down_urls)}개")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--services", default="services.json")
    ap.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY", ""))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    urls = load_urls(args.services)
    with ThreadPoolExecutor(max_workers=12) as ex:
        results = list(ex.map(probe, urls))

    for r in results:
        mark = {"up": "UP  ", "down": "DOWN", "blocked": "BLK "}[r["state"]]
        print(f"{mark} {r['code'] if r['code'] is not None else '---'} {r['url']} {r['error']}")
    down = [r for r in results if r["state"] == "down"]
    blocked = [r for r in results if r["state"] == "blocked"]
    up = len(results) - len(down) - len(blocked)
    print(f"\nsummary: up={up} down={len(down)} blocked={len(blocked)} total={len(results)}")
    if blocked:
        print("::warning::Cloudflare challenge로 차단된 URL " + ", ".join(r["url"] for r in blocked))

    action, detail = decide(args.repo, down, args.dry_run)
    print(f"action: {action}{' (dry-run)' if args.dry_run else ''} — {detail}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

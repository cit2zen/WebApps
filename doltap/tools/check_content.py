"""돌탑 콘텐츠 검증(§5 물량 표). 사용: python check_content.py <wishes|trails> [JSON 경로]

경로를 생략하면 doltap/data/<kind>.json을 읽는다. 실패마다 `id<TAB>이유`를 출력하고,
마지막 줄에 재요청 프롬프트의 '대상' 형식 실패 배열 JSON을 출력한 뒤 exit 1. 실패 0이면 `OK 60`/`OK 30`, exit 0.
"""
import json
import os
import re
import sys

TONES = ["가족", "건강", "합격", "사랑", "평안"]
WISH_BAN = "로또 주식 코인 대박 부자 죽음 사망 장례 병원 수술 투병 하나님 부처님 예수 대통령 선거".split()
TRAIL_BAN = ("불국사 석굴암 해인사 통도사 송광사 화엄사 법주사 월정사 부석사 낙산사 보리암 향일암 조계사 봉은사 "
             "범어사 수덕사 마곡사 선암사 백양사 내소사 설악 지리산 한라 북한산 속리 오대산 덕유 태백 소백 계룡").split()
T01 = "달빛암 앞 돌길"
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")


def tone_of(wid):
    """w01–12 가족 … w49–60 평안(id 범위로 정해진 tone)."""
    m = re.fullmatch(r"w(\d\d)", wid or "")
    n = int(m.group(1)) if m else 0
    return TONES[(n - 1) // 12] if 1 <= n <= 60 else ""


def check_wishes(items):
    fails, seen, heads = [], {}, {}
    for k, it in enumerate(items[:60]):
        want = "w%02d" % (k + 1)
        wid = it.get("id") if isinstance(it, dict) else None
        text = it.get("text") if isinstance(it, dict) else None
        if wid != want:
            fails.append((want, "id 순서(%s)" % wid))
            continue
        if it.get("tone") != tone_of(want):
            fails.append((want, "tone 불일치(%s)" % it.get("tone")))
        if not isinstance(text, str):
            fails.append((want, "text 없음"))
            continue
        if not 4 <= len(text) <= 20:
            fails.append((want, "%d자" % len(text)))
        if not re.fullmatch(r"[가-힣 ,]+", text):
            fails.append((want, "허용 외 문자"))
        if text[-1:] not in ("를", "길"):
            fails.append((want, "어미(%s)" % text[-1:]))
        for w in WISH_BAN:
            if w in text:
                fails.append((want, "금칙어: %s" % w))
        if text in seen:
            fails.append((want, "중복(%s)" % seen[text]))
        head = text.replace(" ", "")[:6]
        if head in heads:
            fails.append((want, "앞 6자 중복(%s)" % heads[head]))
        seen.setdefault(text, want)
        heads.setdefault(head, want)
    for k in range(len(items), 60):
        fails.append(("w%02d" % (k + 1), "누락"))
    for it in items[60:]:
        fails.append((str(it.get("id") if isinstance(it, dict) else "?"), "초과"))
    return fails


def check_trails(items):
    fails, seen = [], {}
    for k, it in enumerate(items[:30]):
        want = "t%02d" % (k + 1)
        tid = it.get("id") if isinstance(it, dict) else None
        name = it.get("name") if isinstance(it, dict) else None
        if tid != want:
            fails.append((want, "id 순서(%s)" % tid))
            continue
        if not isinstance(name, str):
            fails.append((want, "name 없음"))
            continue
        if want == "t01" and name != T01:
            fails.append((want, "t01 고정값 불일치"))
        if not 5 <= len(name) <= 12:
            fails.append((want, "%d자" % len(name)))
        if not re.fullmatch(r"[가-힣 ]+", name):
            fails.append((want, "허용 외 문자"))
        if not (name.endswith("길") or name.endswith("고개")):
            fails.append((want, "끝말(%s)" % name[-2:]))
        for w in TRAIL_BAN:
            if w in name:
                fails.append((want, "블랙리스트: %s" % w))
        if name in seen:
            fails.append((want, "중복(%s)" % seen[name]))
        seen.setdefault(name, want)
    for k in range(len(items), 30):
        fails.append(("t%02d" % (k + 1), "누락"))
    for it in items[30:]:
        fails.append((str(it.get("id") if isinstance(it, dict) else "?"), "초과"))
    return fails


def target_array(kind, fails):
    """id당 1개, 이유는 ', '로 잇는다(재요청 '대상' 배열 길이 = 다시 만들 항목 수)."""
    order, reasons = [], {}
    for fid, why in fails:
        if fid not in reasons:
            order.append(fid)
            reasons[fid] = []
        reasons[fid].append(why)
    out = []
    for fid in order:
        row = {"id": fid}
        if kind == "wishes":
            row["tone"] = tone_of(fid)
        row["reason"] = ", ".join(reasons[fid])
        out.append(row)
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2 or sys.argv[1] not in ("wishes", "trails"):
        print("usage: check_content.py <wishes|trails> [path]")
        return 2
    kind = sys.argv[1]
    path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(DATA, kind + ".json")
    count = 60 if kind == "wishes" else 30
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        items = doc["items"]
        assert isinstance(items, list)
    except (OSError, ValueError, KeyError, TypeError, AssertionError) as e:
        print("*\t파일/JSON 오류: %s" % e)
        print(json.dumps([{"id": "*", "reason": "파일/JSON 오류"}], ensure_ascii=False))
        return 1
    fails = check_wishes(items) if kind == "wishes" else check_trails(items)
    if not fails:
        print("OK %d" % count)
        return 0
    for fid, why in fails:
        print("%s\t%s" % (fid, why))
    print(json.dumps(target_array(kind, fails), ensure_ascii=False, separators=(",", ":")))
    return 1


if __name__ == "__main__":
    sys.exit(main())

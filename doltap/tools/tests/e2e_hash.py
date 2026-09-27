"""구현 1단계 완료 기준: 브라우저 hashRange('20261001',365) == ref_stones.py, 실례 1 골든, 훅 동결, Matter SRI."""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, TOOLS)
from harness import page_session  # noqa: E402
import ref_stones  # noqa: E402

# (1) Python 참조 해시 생성 → tools/ref.json(.gitignore 대상)
REF = os.path.join(TOOLS, "ref.json")
subprocess.run([sys.executable, os.path.join(TOOLS, "ref_stones.py"), "--from", "20261001",
                "--days", "365", "--out", REF], check=True)
with open(REF, encoding="utf-8") as f:
    ref = json.load(f)
assert len(ref) == 365 and ref[0]["day"] == "20261001" and ref[-1]["day"] == "20270930"

# (2) Python 쪽 실례 1 골든
g = ref_stones.daily("20261001")
s1 = g["stones"][0]
assert g["seed"] == 1568161157 and g["pattern"] == "FAF" and g["wishIdx"] == 24 and g["trailIdx"] == 0
assert "".join({"flat": "F", "angular": "A", "round": "R", "wedge": "W"}[s["type"]] for s in g["stones"]) \
    == "FAFFARRFAAFAAWRAAWWAWAWR"
areas = sorted(s["area"] for s in g["stones"])
assert (areas[11] + areas[12]) / 2 == 2111.95
assert s1["verts"] == [[-37.13, -3.62], [-33.85, -14.43], [-2.84, -24.17], [23.14, -16.01],
                       [35.53, -4.25], [22.22, 19.81], [-2.08, 22.84], [-30.63, 17.11]]
assert (s1["type"], s1["attempts"], s1["tone"], s1["moss"]) == ("flat", 1, "stone-ochre-d", 0)
for k, v in (("r0", 38.56796620134264), ("r", 38.09872508937638), ("s", 0.6031809794064611)):
    assert abs(s1[k] - v) < 1e-9, (k, s1[k])

with page_session(port=8790) as (page, errors):
    # (3) 브라우저 365일 해시·r0·r·s 대조(evaluate 1회)
    rows = page.evaluate("() => window.__doltap.hashRange('20261001', 365)")
    assert len(rows) == 365
    bad = [r["day"] for r, p in zip(rows, ref) if r["day"] != p["day"] or r["hash"] != p["hash"]]
    assert not bad, f"해시 불일치 {len(bad)}일: {bad[:5]}"
    worst = max(abs(a - b) for r, p in zip(rows, ref) for key in ("r0", "r", "s")
                for a, b in zip(r[key], p[key]))
    assert worst < 1e-9, f"r0·r·s 최대 오차 {worst}"

    # (4) 브라우저 쪽 실례 1 슬롯 1 + gen(seed)가 같은 돌을 만든다
    js1 = page.evaluate("() => window.__doltap.daily('20261001').stones[0]")
    assert js1["verts"] == s1["verts"] and js1["tone"] == "stone-ochre-d" and js1["cx"] == -2.2
    same = page.evaluate("""() => JSON.stringify(__doltap.gen(1568161157).stones)
                                  === JSON.stringify(__doltap.daily('20261001').stones)""")
    assert same is True
    assert page.evaluate("() => __doltap.gen(1568161157).n") == 0

    # (5) setToday 덮어쓰기와 해제
    assert page.evaluate("() => __doltap.setToday('20261005')") == "20261005"
    assert page.evaluate("() => __doltap.daily().n") == 5
    real = page.evaluate("() => __doltap.setToday(null)")
    assert len(real) == 8 and real != "20261005"

    # (6) 훅 동결·재할당 불가, Matter 0.20.0(SRI 통과)
    assert page.evaluate("() => Object.isFrozen(window.__doltap)") is True
    assert page.evaluate("() => { try { window.__doltap = 1; } catch (e) {} return typeof window.__doltap; }") == "object"
    assert page.evaluate("() => window.Matter && window.Matter.version") == "0.20.0"
    assert errors == [], errors
print("PASS hash")

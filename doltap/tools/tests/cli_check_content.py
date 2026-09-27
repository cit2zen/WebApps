"""구현 2단계 완료 기준 3·4: check_content.py가 fixture로 OK 60/OK 30, 21자 항목이면 exit 1 + 실패 배열."""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(os.path.dirname(HERE), "check_content.py")
FIX = os.path.join(HERE, "fixtures")


def run(*args):
    p = subprocess.run([sys.executable, TOOL, *args], capture_output=True)
    return p.returncode, p.stdout.decode("utf-8").strip().splitlines()


def mutated(name, idx, key, value):
    with open(os.path.join(FIX, name), encoding="utf-8") as f:
        doc = json.load(f)
    doc["items"][idx][key] = value
    fd, path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False)
    return path


code, out = run("wishes", os.path.join(FIX, "wishes.json"))
assert (code, out) == (0, ["OK 60"]), (code, out)
code, out = run("trails", os.path.join(FIX, "trails.json"))
assert (code, out) == (0, ["OK 30"]), (code, out)

long17 = "매일 아침 밥맛이 좋고 몸이 개운하기를"
assert len(long17) == 21
path = mutated("wishes.json", 16, "text", long17)
try:
    code, out = run("wishes", path)
finally:
    os.remove(path)
assert code == 1, code
assert "w17\t21자" in out, out
assert out[-1] == '[{"id":"w17","tone":"건강","reason":"21자"}]', out[-1]

path = mutated("trails.json", 4, "name", "지리산 새벽 돌길")
try:
    code, out = run("trails", path)
finally:
    os.remove(path)
assert code == 1 and out[-1] == '[{"id":"t05","reason":"블랙리스트: 지리산"}]', (code, out)

path = mutated("wishes.json", 30, "text", "부자 되기를")   # 금칙어 + 앞 6자는 고유
try:
    code, out = run("wishes", path)
finally:
    os.remove(path)
assert code == 1 and json.loads(out[-1]) == [{"id": "w31", "tone": "합격", "reason": "금칙어: 부자"}], out

code, out = run("wishes", os.path.join(FIX, "없는파일.json"))
assert code == 1 and json.loads(out[-1])[0]["id"] == "*", out
print("PASS check_content")

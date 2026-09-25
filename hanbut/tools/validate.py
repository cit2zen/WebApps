"""validate.py — 로더 규칙 0~9의 Python 판(§5 표, js/levels.js와 동일) · --selftest 3건.
사용: python tools/validate.py [levels.json]   /   python tools/validate.py --selftest"""
import json, math, os, sys  # noqa: E401

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hamilton  # noqa: E402

FORMAT = 'hanbut-levels/1'


_int = lambda x: isinstance(x, int) and not isinstance(x, bool)  # noqa: E731
_ints = lambda a: isinstance(a, list) and all(_int(x) for x in a)  # noqa: E731


def validate_level(lv, i, kind):
    """규칙 2~9 → None(통과) | 사유 문자열."""
    g = lv.get if isinstance(lv, dict) else (lambda _k: None)
    w, h, holes, start = g('w'), g('h'), g('holes'), g('start')
    if not (_int(w) and _int(h) and 3 <= w <= 7 and 3 <= h <= 7 and _ints(holes) and _int(start)):  # 2
        return 'holes'
    size = w * h
    if not 0 <= start < size or start in holes or any(x < 0 or x >= size for x in holes) \
            or any(holes[j] >= holes[j + 1] for j in range(len(holes) - 1)):
        return 'holes'
    hs = set(holes)
    sol, walls, end, wps = g('sol'), g('walls'), g('end'), g('waypoints')
    if not _ints(sol) or len(sol) != size - len(holes):  # 3
        return 'len'
    if sol[0] != start:
        return 'start'
    if len(set(sol)) != len(sol):  # 4
        return 'dup'
    if any(c in hs or c < 0 or c >= size for c in sol):
        return 'hole'
    if not isinstance(walls, list) or not all(_ints(p) and len(p) == 2 for p in walls):
        return 'walls'
    adj = lambda a, b: abs(a // w - b // w) + abs(a % w - b % w) == 1  # noqa: E731
    wset, used = {(p[0], p[1]) for p in walls}, set()
    for a, b in zip(sol, sol[1:]):  # 5
        if not adj(a, b):
            return f'adj {a}-{b}'
        if (min(a, b), max(a, b)) in wset:
            return f'wall {a}-{b}'
        used.add((min(a, b), max(a, b)))
    if len(wset) != len(walls) or any(not (0 <= a < b < size) or a in hs or b in hs or not adj(a, b)
                                      or (a, b) in used for a, b in walls):  # 6
        return 'walls'
    if end is not None and (not _int(end) or end != sol[-1]):  # 7
        return 'end'
    pos = {c: j for j, c in enumerate(sol)}
    if not _ints(wps) or len(set(wps)) != len(wps) or any(c in (start, end) or c not in pos for c in wps) \
            or any(pos[wps[j]] >= pos[wps[j + 1]] for j in range(len(wps) - 1)):  # 8
        return 'wp'
    cnt = [0, 0]  # 9 패리티
    for c in sol:
        cnt[(c // w + c % w) % 2] += 1
    if abs(cnt[0] - cnt[1]) > 1:
        return 'parity'
    if cnt[0] != cnt[1]:
        major = 0 if cnt[0] > cnt[1] else 1
        if any(c is not None and (c // w + c % w) % 2 != major for c in (start, end)):
            return 'parity'
    return None


def validate_levels(obj, kind):
    """규칙 0·1 + 레벨별 2~9 → 오류 목록('L3 len' 형식, 빈 목록 = 통과). 규칙 0 실패 = ['format']."""
    if not isinstance(obj, dict) or obj.get('format') != FORMAT or obj.get('kind') != kind \
            or not isinstance(obj.get('levels'), list):
        return ['format']
    errs = []
    for i, lv in enumerate(obj['levels']):
        d = lv if isinstance(lv, dict) else {}
        if kind == 'levels':
            ok1 = d.get('L') == i + 1 and d.get('pack') == math.ceil((i + 1) / 10)
        else:
            ok1 = d.get('i') == i and 'pack' in d and d['pack'] is None
        why = validate_level(lv, i, kind) if ok1 else 'order'
        if why:
            errs.append(f"{'D' + str(i) if kind == 'daily' else 'L' + str(i + 1)} {why}")
    return errs


L1 = {'w': 3, 'h': 3, 'holes': [], 'start': 6, 'sol': [6, 7, 8, 5, 4, 3, 0, 1, 2]}
L2 = {'w': 4, 'h': 4, 'holes': [10], 'start': 12, 'sol': [12, 8, 9, 13, 14, 15, 11, 7, 3, 2, 6, 5, 4, 0, 1]}
FIXTURE = {'w': 5, 'h': 5, 'holes': [8, 10], 'walls': [[11, 12]], 'start': 21, 'end': 7, 'waypoints': [4],
           'sol': [21, 20, 15, 16, 11, 6, 5, 0, 1, 2, 3, 4, 9, 14, 19, 24, 23, 22, 17, 18, 13, 12, 7]}


def selftest():
    """(a) L1·L2 sol 모든 접두에서 가지치기 미발동 (b) L1·L2 P == 0 (c) 픽스처 P == 1(16·22 해 없음, 20 해 있음)."""
    fails = []
    for name, lv in (('L1', L1), ('L2', L2)):
        b, vis = hamilton.Board(lv['w'], lv['h'], lv['holes']), [False] * (lv['w'] * lv['h'])
        for j, c in enumerate(lv['sol']):
            vis[c] = True
            if hamilton.pruned(b, vis, c, b.n - j - 1):
                fails.append(f'(a) {name} prefix {j + 1} pruned')
        if hamilton.p_judge(b, lv['start'])[0] != 0:
            fails.append(f'(b) {name} P != 0')
    fx = FIXTURE
    b = hamilton.Board(fx['w'], fx['h'], fx['holes'], fx['walls'], fx['end'], fx['waypoints'])
    dirs = {s2: hamilton.dir_status(b, 21, s2, 300000) for s2 in b.adj[21]}
    if hamilton.p_judge(b, 21)[0] != 1 or dirs != {16: 'none', 20: 'found', 22: 'none'}:
        fails.append(f'(c) dirs={dirs}')
    print('\n'.join([f'[selftest] FAIL {f}' for f in fails] + [f'[selftest] {"3/3 pass" if not fails else "failed"}']))
    return not fails


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--selftest' in sys.argv:
        sys.exit(0 if selftest() else 1)
    path = sys.argv[1] if len(sys.argv) > 1 else 'levels.json'
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    errors = validate_levels(data, data.get('kind') if isinstance(data, dict) else None)
    print('\n'.join([f'[validate] {e}' for e in errors] + [f'[validate] {path} errors={len(errors)}']))
    sys.exit(1 if errors else 0)

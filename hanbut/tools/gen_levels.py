"""gen_levels.py — 레벨 생성기(§5 절차 ①~⑨). Python 3.11+ 표준 라이브러리만.
  python tools/gen_levels.py --spec tools/levels_spec.csv --range 1-10 --out levels.json [--resume]
  python tools/gen_levels.py --daily 366 --range 0-9 --out levels_daily.json --resume
  python tools/gen_levels.py --verify levels.json"""
import argparse, json, math, os, random, sys, time  # noqa: E401

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hamilton  # noqa: E402
import spec  # noqa: E402
import validate  # noqa: E402

RELAX = {'inner': 'edge', 'edge': 'corner'}
DFS_BUDGET = 300000
MAX_TRIES = 1000
# L1·L2 스크립트 상수(생성 생략)
CONST = {1: {'holes': [], 'start': 6, 'sol': [6, 7, 8, 5, 4, 3, 0, 1, 2]},
         2: {'holes': [10], 'start': 12, 'sol': [12, 8, 9, 13, 14, 15, 11, 7, 3, 2, 6, 5, 4, 0, 1]}}


def spos_cells(w, h, cls):
    """S 위치 클래스: 모서리 = 4 꼭짓점, 변 = 테두리 − 꼭짓점, 내부 = 나머지."""
    n_edge = lambda i: (i // w in (0, h - 1)) + (i % w in (0, w - 1))  # noqa: E731
    return [i for i in range(w * h) if ('inner', 'edge', 'corner')[n_edge(i)] == cls]


def parity_ok(b, start):
    cnt = [0, 0]
    for i in (i for i in range(len(b.open)) if b.open[i]):
        cnt[(i // b.w + i % b.w) % 2] += 1
    d = cnt[0] - cnt[1]
    return d == 0 or (abs(d) == 1 and (start // b.w + start % b.w) % 2 == (0 if d > 0 else 1))


def build(row, key, holes, walls, start, sol, E, Y, sPos, P, relaxed):
    n = len(sol)
    wps = [sol[int(j * (n - 1) / (Y + 1) + 0.5)] for j in range(1, Y + 1)]
    d, t = spec.calc_row(row, nHoles=len(holes), sPos=sPos, P=P)
    lv = {'w': row['cols'], 'h': row['rows'], 'holes': sorted(holes), 'walls': walls, 'start': start,
          'end': sol[-1] if E else None, 'waypoints': wps, 'sol': sol, 'seed': row['seed'], 'k': row['k'],
          'sPos': sPos, 'P': P, 'D': d, 'T': t, 'relaxed': relaxed or None}
    lv.update(key)
    return lv


def generate(row, key, prior, args):
    """→ (level | None, tries, pBudgetFail). prior = 중복 검사용 기존 레벨 목록."""
    w, h, E, W, Y, k = row['cols'], row['rows'], row['E'], row['nWalls'], row['nWps'], row['k']
    rng, t0, sPos, nh, relaxed = random.Random(row['seed']), time.time(), row['sPos'], row['nHoles'], {}
    tries = fail_sp = fail_wall = pbf = 0
    start = rng.choice(spos_cells(w, h, sPos))  # ② S는 레벨 시작·sPos 완화 시에만 추첨
    while tries < MAX_TRIES and time.time() - t0 < args.max_sec:
        if fail_sp >= 200 or fail_wall >= 200:
            if fail_sp >= 200 and sPos in RELAX:
                relaxed.setdefault('sPos', row['sPos'])
                sPos = RELAX[sPos]
                start = rng.choice(spos_cells(w, h, sPos))
            elif nh > 0:
                relaxed.setdefault('h', row['nHoles'])
                nh -= 1
            fail_sp = fail_wall = 0
        holes = rng.sample([i for i in range(w * h) if i != start], nh)
        b = hamilton.Board(w, h, holes)
        if any(b.open[i] and not b.adj[i] for i in range(w * h)) or not parity_ok(b, start) \
                or any(p['w'] == w and p['h'] == h and len(p['holes']) == nh and p['sPos'] == sPos
                       and set(p['holes']) == set(holes) for p in prior):
            continue  # 고립·패리티·중복 거부 = 무비용(카운터 미포함)
        tries += 1
        st, sol = hamilton.dfs(b, [start], rng, k, DFS_BUDGET)  # ④
        if st != 'found':
            fail_sp += 1
            continue
        used = {(min(a, c), max(a, c)) for a, c in zip(sol, sol[1:])}
        free = sorted({(min(i, j), max(i, j)) for i in range(w * h) for j in b.adj[i]} - used)
        if W and len(free) < W + 4:  # ⑤ C < W+4
            fail_wall += 1
            continue
        walls = sorted([list(e) for e in rng.sample(free, W)])
        lv = build(row, key, holes, walls, start, sol, E, Y, sPos, row['P'], relaxed)  # ⑥
        P, bf = hamilton.p_judge(hamilton.Board(w, h, holes, walls, lv['end'], lv['waypoints']),
                                 start, sol[1], args.p_budget)  # ⑦
        pbf += bf
        if P != row['P']:  # 불일치·판정 불가(None)
            fail_sp += 1
            continue
        if validate.validate_level(lv, 0, 'levels') is None:  # ⑨
            return lv, tries, pbf
    return None, tries, pbf


def save(path, kind, levels):
    obj = {'format': validate.FORMAT, 'kind': kind, 'version': 1, 'generator': 'tools/gen_levels.py',
           'levels': sorted(levels, key=lambda x: x['i' if kind == 'daily' else 'L'])}
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=True, sort_keys=True, separators=(',', ':'))
        f.write('\n')


def verify(path):
    """kind로 분기해 로더 규칙 0~9 재검사 → exit 1 = 실패."""
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    kind = data.get('kind') if isinstance(data, dict) else None
    errs = validate.validate_levels(data, kind)
    print('\n'.join([f'[verify] {e}' for e in errs] + [f'[verify] {path} kind={kind} errors={len(errs)}']))
    return 1 if errs else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    for a, kw in (('--spec', {}), ('--range', {}), ('--out', {}), ('--verify', {}), ('--daily', {'type': int}),
                  ('--resume', {'action': 'store_true'}), ('--max-sec', {'type': float, 'default': 120}),
                  ('--p-budget', {'type': int, 'default': 300000})):
        ap.add_argument(a, **kw)
    args = ap.parse_args()
    if args.verify:
        return verify(args.verify)
    daily = args.daily is not None
    kind, idk = ('daily', 'i') if daily else ('levels', 'L')
    lo, hi = (int(x) for x in args.range.split('-'))
    existing = json.load(open(args.out, encoding='utf-8'))['levels'] if args.resume and os.path.exists(args.out) else []
    have = {x[idk] for x in existing}
    miss = [m for m in range(0 if daily else 1, lo) if m not in have]
    if miss:
        print(f'[resume] {idk}{miss[0]} missing — 낮은 범위부터 생성')
        return 1
    specs = {i: dict(spec.DAILY, seed=spec.DAILY_SEED0 + i) for i in range(lo, hi + 1)} if daily else spec.load(args.spec)
    if not daily and not spec.check({L: specs[L] for L in range(lo, hi + 1)}):
        return 1
    out = list(existing)
    for m in (m for m in range(lo, hi + 1) if m not in have):
        row, t0, tag = specs[m], time.time(), f'{idk}{m}'
        key = {'i': m, 'pack': None} if daily else {'L': m, 'pack': math.ceil(m / 10)}
        c = None if daily else CONST.get(m)
        lv, tries, pbf = (build(row, key, c['holes'], [], c['start'], c['sol'], 0, 0, row['sPos'], row['P'], {}), 0, 0)             if c else generate(row, key, out, args)
        sec = round(time.time() - t0, 1)
        if lv is None:
            print(f'{tag} FAILED tries={tries} sec={sec}')
            save(args.out, kind, out)
            return 2
        if lv['relaxed']:
            print(f"[spec] {tag} relaxed {lv['relaxed']} → sPos={lv['sPos']} h={len(lv['holes'])} D={lv['D']} T={lv['T']}")
        print(f'{tag} tries={tries} sec={sec} pBudgetFail={pbf}')
        out.append(lv)
    save(args.out, kind, out)
    return 0


if __name__ == '__main__':
    sys.exit(main())

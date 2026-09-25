"""spec.py — levels_spec.csv 로드 · D/T 산식(§3) · CSV D/T 대조 · 데일리 스펙 상수(§5)."""
import csv
import sys

# (sPos, P) → (s_D, s_T) — §3 6조합 표
S_TABLE = {
    ('corner', 0): (0.0, 0.0), ('edge', 0): (1.0, 1.2), ('inner', 0): (2.0, 2.4),
    ('corner', 1): (2.0, 2.6), ('edge', 1): (3.0, 3.8), ('inner', 1): (5.0, 6.2),
}
S_POS = ('corner', 'edge', 'inner')
COLS = ['L', 'cols', 'rows', 'nHoles', 'sPos', 'P', 'k', 'nWalls', 'E', 'nWps', 'seed', 'D', 'T']
INT_COLS = ['L', 'cols', 'rows', 'nHoles', 'P', 'k', 'nWalls', 'E', 'nWps', 'seed']

# 데일리 스펙(CSV 없음) — 7×7 · h6 · inner · P1 · k10 · W4 · E0 · Y0 · seed 20000+i
DAILY = {'cols': 7, 'rows': 7, 'nHoles': 6, 'sPos': 'inner', 'P': 1, 'k': 10,
         'nWalls': 4, 'E': 0, 'nWps': 0}
DAILY_SEED0 = 20000


def calc_dt(cols, rows, nHoles, sPos, P, k, nWalls, E, nWps):
    """§3 산식: D = n/3 + h + W + Y + 8E + 0.1k + s_D, T = 0.7n + 1.2(h+W+Y) + 9.6E + 0.1k + s_T."""
    n = cols * rows - nHoles
    sd, st = S_TABLE[(sPos, P)]
    d = n / 3 + nHoles + nWalls + nWps + 8 * E + 0.1 * k + sd
    t = 0.7 * n + 1.2 * (nHoles + nWalls + nWps) + 9.6 * E + 0.1 * k + st
    return round(d, 2), round(t, 1)


def calc_row(row, **over):
    p = {c: row[c] for c in ('cols', 'rows', 'nHoles', 'sPos', 'P', 'k', 'nWalls', 'E', 'nWps')}
    p.update(over)
    return calc_dt(**p)


def load(path):
    """CSV → {L: row dict}. 열 형식 오류는 ValueError."""
    specs = {}
    with open(path, encoding='utf-8', newline='') as f:
        rd = csv.DictReader(f)
        if rd.fieldnames != COLS:
            raise ValueError(f'[spec] columns {rd.fieldnames} != {COLS}')
        for raw in rd:
            row = {c: int(raw[c]) for c in INT_COLS}
            row['sPos'] = raw['sPos']
            row['D'] = float(raw['D'])
            row['T'] = float(raw['T'])
            if row['sPos'] not in S_POS or row['P'] not in (0, 1) or row['E'] not in (0, 1):
                raise ValueError(f"[spec] L{row['L']} enum invalid")
            specs[row['L']] = row
    return specs


def check(specs, relaxed=()):
    """각 행의 재계산 D·T와 CSV D·T 절대차 < 0.01 확인. 불일치 줄 출력, 불일치 0이면 True.
    relaxed = 완화된 L 집합(표 A/B 갱신 신호로 relaxed 표기만 덧붙임)."""
    ok = True
    for L in sorted(specs):
        row = specs[L]
        d, t = calc_row(row)
        tag = ' (relaxed)' if L in relaxed else ''
        if abs(d - row['D']) >= 0.01:
            print(f"[spec] L{L} D {row['D']}≠{d}{tag}")
            ok = False
        if abs(t - row['T']) >= 0.01:
            print(f"[spec] L{L} T {row['T']}≠{t}{tag}")
            ok = False
    return ok


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    rows = load(sys.argv[1] if len(sys.argv) > 1 else 'tools/levels_spec.csv')
    good = check(rows)
    print(f'[spec] rows={len(rows)} ok={good}')
    sys.exit(0 if good else 1)

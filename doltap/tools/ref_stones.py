"""돌탑 §5 결정성 규약 Python 참조 구현 + 날짜별 해시 출력.

사용: python ref_stones.py --from 20261001 --days 365 --out ref.json
출력: [{day, hash, r0:[24], r:[24], s:[24]}] — __doltap.hashRange와 같은 모양.
"""
import argparse, datetime, hashlib, json, sys
import math
PI = math.pi; TAU = 2*math.pi
M = 0xFFFFFFFF
def red(t):
    while t > PI: t -= TAU
    while t < -PI: t += TAU
    return t
def dsin(t):
    x = red(t); x2 = x*x
    return x - x*x2/6 + x*x2*x2/120 - x*x2*x2*x2/5040
def dcos(t):
    x = red(t); x2 = x*x
    return 1 - x2/2 + x2*x2/24 - x2*x2*x2/720 + x2*x2*x2*x2/40320
def r2(v): return math.floor(v*100 + 0.5)/100
def r1(v): return math.floor(v*10 + 0.5)/10
def imul(a, b): return (a*b) & M
def fnv(s):
    h = 0x811c9dc5
    for b in s.encode("utf-8"):
        h ^= b; h = imul(h, 0x01000193)
    return h
def mulberry32(a):
    a &= M
    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & M
        t = a
        t = imul(t ^ (t >> 15), t | 1)
        t = (t ^ (t + imul(t ^ (t >> 7), t | 61))) & M
        return ((t ^ (t >> 14)) & M) / 4294967296
    return nxt
COS = [1,0.965926,0.866025,0.707107,0.5,0.258819,0,-0.258819,-0.5,-0.707107,-0.866025,-0.965926,
       -1,-0.965926,-0.866025,-0.707107,-0.5,-0.258819,0,0.258819,0.5,0.707107,0.866025,0.965926]
SIN = [COS[(k+18) % 24] for k in range(24)]
def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
def hull(P):
    p = sorted(P)
    if len(p) < 3: return p
    lo, up = [], []
    for q in p:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    for q in reversed(p):
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0: up.pop()
        up.append(q)
    return lo[:-1] + up[:-1]
def width_ratio(V):
    mn, mx = math.inf, -math.inf
    for k in range(12):
        lo, hi = math.inf, -math.inf
        for x, y in V:
            X = x*COS[k] - y*SIN[k]
            if X < lo: lo = X
            if X > hi: hi = X
        w = hi - lo
        if w < mn: mn = w
        if w > mx: mx = w
    return mn/mx
def area2(V):
    A = 0
    for i in range(len(V)):
        a, b = V[i]; c, d = V[(i+1) % len(V)]
        A += a*d - c*b
    return A/2
def centroid(V):
    A = area2(V); cx = 0; cy = 0
    for i in range(len(V)):
        a, b = V[i]; c, d = V[(i+1) % len(V)]
        w = a*d - c*b
        cx += (a+c)*w; cy += (b+d)*w
    return cx/(6*A), cy/(6*A)

# ---- 생성(§5 추첨 순서 1~6) — stones.js generate와 같은 순서 ----
BANDS = [("A", 3, 40, 0.62, None), ("B", 8, 36, 0.65, (45, 35, 12, 8)),
         ("C", 14, 34, 0.72, (35, 30, 20, 15)), ("D", 19, 32, 0.78, (25, 29, 25, 21)),
         ("E", 24, 30, 0.85, (20, 20, 35, 25))]
TYPES = ["flat", "angular", "round", "wedge"]
# 유형: (n_min, n_max, 각도지터, 반지름지터, s 보정)
PARAM = {"flat": (6, 8, 0.20, 0.12, -0.10), "angular": (5, 6, 0.35, 0.25, 0),
         "round": (9, 9, 0.10, 0.08, 0.10), "wedge": (6, 7, 0.25, 0.15, 0)}
FAMILY = {"flat": ("gray", "ochre"), "angular": ("gray", "slate"),
          "round": ("slate", "ochre"), "wedge": ("ochre", "gray")}
FALLBACK = [[-36, 0], [-18, -17.15], [18, -17.15], [36, 0], [18, 17.15], [-18, 17.15]]
RW = ("round", "wedge")

def band_of(i):
    for b in BANDS:
        if i <= b[1]: return b
def clamp(v, lo, hi): return lo if v < lo else hi if v > hi else v
def violates(types, t):
    if len(types) >= 2 and types[-1] == t and types[-2] == t: return True
    return len(types) >= 2 and t in RW and types[-1] in RW and types[-2] in RW

def draw_stone(rng, i, types, pattern):
    name, _, rc, sc, w = band_of(i)
    for att in range(1, 21):
        if w is None:
            t = "flat" if pattern[i-1] == "F" else "angular"
        else:
            u = rng(); acc = 0; t = TYPES[-1]
            for k in range(4):
                acc += w[k]
                if u*100 < acc: t = TYPES[k]; break
            if violates(types, t): continue
        nmin, nmax, aj, rj, sk = PARAM[t]
        r0 = rc + (2*rng() - 1)*6
        s = sc + (2*rng() - 1)*0.10
        if w is not None: s = s + sk
        s = clamp(s, 0.45, 1.0)
        n = nmin + math.floor(rng()*(nmax - nmin + 1))
        pts = []
        for k in range(n):
            th = TAU*k/n + (2*rng() - 1)*aj
            rho = 1 + (2*rng() - 1)*rj
            x = rho*dcos(th); y = rho*dsin(th)
            if t == "wedge" and x < 0: x *= 0.55; y *= 0.55
            pts.append([r2(x*r0), r2(y*r0*s)])
        v0 = hull(pts)
        if math.floor(width_ratio(v0)*1000) < 300: continue
        return {"i": i, "type": t, "band": name, "r0": r0, "s": s, "n": n, "v0": v0, "attempts": att}
    return {"i": i, "type": "flat", "band": name, "r0": 36, "s": 0.55, "n": 6,
            "v0": [p[:] for p in FALLBACK], "attempts": 21}

def generate(seed, day, n):
    seed &= M
    rng = mulberry32(seed)
    pattern = "FFA" if rng() < 0.5 else "FAF"
    stones, types = [], []
    for i in range(1, 25):
        st = draw_stone(rng, i, types, pattern)
        stones.append(st); types.append(st["type"])
    mean = 0
    for st in stones: mean += st["r0"]
    mean = mean/24
    f = clamp(34/mean, 0.9, 1.1)
    for st in stones:
        st["r"] = clamp(st["r0"]*f, 22, 46)
        q = st["r"]/st["r0"]
        st["verts"] = [[r2(x*q), r2(y*q)] for x, y in st.pop("v0")]
        st["area"] = r1(area2(st["verts"]))
        cx, cy = centroid(st["verts"]); st["cx"] = r2(cx); st["cy"] = r2(cy)
    areas = sorted(st["area"] for st in stones)
    med = (areas[11] + areas[12])/2
    tr = mulberry32((seed ^ 0x27D4EB2F) & M)
    for st in stones:
        u1 = tr(); u2 = tr()
        fam = FAMILY[st["type"]][0 if u1 < 0.5 else 1]
        st["tone"] = "stone-%s-%s" % (fam, "d" if st["area"] >= med else "l")
        st["moss"] = math.floor(u2*4)
    wish = math.floor(mulberry32((seed ^ 0x9E3779B9) & M)()*60)
    trail = ((n - 1) % 30 + 30) % 30 if n != 0 else math.floor(mulberry32((seed ^ 0x85EBCA6B) & M)()*30)
    return {"day": day, "n": n, "seed": seed, "pattern": pattern, "rScale": f,
            "wishIdx": wish, "trailIdx": trail, "stones": stones}

# ---- 해시(§5 물량 표 해시 규칙) ----
def js_num(v):
    v = float(v)
    return str(int(v)) if v.is_integer() else repr(v)
def stone_line(st):
    vs = ",".join("[%s,%s]" % (js_num(x), js_num(y)) for x, y in st["verts"])
    return "%s,%d,%s,%d,[%s]" % (st["type"], st["attempts"], st["tone"], st["moss"], vs)
def hash_set(ds):
    text = "\n".join(stone_line(st) for st in ds["stones"])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
LAUNCH = datetime.date(2026, 10, 1)
def to_date(day): return datetime.date(int(day[:4]), int(day[4:6]), int(day[6:8]))
def n_of(day): return (to_date(day) - LAUNCH).days + 1
def daily(day): return generate(fnv(day), day, n_of(day))
def hash_range(start, days):
    d0 = to_date(start); out = []
    for k in range(days):
        day = (d0 + datetime.timedelta(days=k)).strftime("%Y%m%d")
        ds = daily(day); st = ds["stones"]
        out.append({"day": day, "hash": hash_set(ds), "r0": [x["r0"] for x in st],
                    "r": [x["r"] for x in st], "s": [x["s"] for x in st]})
    return out

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="돌탑 DailySet 참조 해시")
    ap.add_argument("--from", dest="start", default="20261001")
    ap.add_argument("--days", type=int, default=365)
    ap.add_argument("--out", default="ref.json")
    a = ap.parse_args()
    rows = hash_range(a.start, a.days)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(rows, f)
    print("OK %d %s %s" % (len(rows), rows[0]["day"], rows[0]["hash"]))

if __name__ == "__main__":
    main()

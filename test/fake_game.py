"""Runs the real tf3map.script.lua in Lua 5.4 (lupa) against a mocked TF3 API.

    python3 fake_game.py <userdata_dir> [--edges N] [--seconds S]

Writes the same files the game would (towns_industries/tf3map_*.lua, in app.saveUserdata's
format), moves the camera on jump commands and mutates the network every 15 s
(removes a block of edges, adds a new curved rail line) to exercise incremental export.
"""
import argparse
import math
import os
import random
import sys
import time

from lupa import lua54

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(HERE), "mod", "tf3_minimap", "content", "tf3map", "tf3map.script.lua")
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "companion"))
import tf3map_probe as probe  # noqa: E402  (Lua data parser for reading the cmd file)

ap = argparse.ArgumentParser()
ap.add_argument("userdata")
ap.add_argument("--edges", type=int, default=40000)
ap.add_argument("--seconds", type=float, default=1e9)
ap.add_argument("--fps", type=float, default=60)
ap.add_argument("--no-entities", action="store_true", help="BASE_EDGE listing returns nothing (as seen in TF3)")
args = ap.parse_args()

UD = args.userdata
os.makedirs(os.path.join(UD, "towns_industries"), exist_ok=True)
random.seed(7)

# ------------------------------------------------------------------ world

TOWNS = [("Harbin", -4600, 30400, 900), ("Manila", 2100, -30400, 1200), ("Tokyo", 12000, 8000, 2500),
         ("Kolkata", 6000, 11800, 700), ("Omsk", -9000, 2000, 500), ("Xi'an", -4400, 13600, 800),
         ("Lucknow", 500, 24300, 400), ("Pyongyang", -3800, -8500, 1000), ("Osaka", 9000, -6000, 1500),
         ("Busan", -12000, -18000, 600)]
INDUSTRIES = [("Lucknow Logging Camp", "forest", 484, 24292), ("Xi'an Saw Mill", "saw_mill", -4440, 13600 - 900),
              ("Kolkata Farm", "farm", 5900, 12900), ("Omsk Oil Well", "oil_well", -9800, 3100),
              ("Osaka Refinery", "oil_refinery", 9900, -7000),
              ("Busan Logging Camp", "forest", -11500, -17000), ("Tokyo Saw Mill", "saw_mill", 12600, 8900)]

ROAD_T, TRACK_T = 0, 1
NORMAL, BRIDGE, TUNNEL = 0, 1, 2
edges = {}      # id -> dict
RAIL_ROUTES = {}  # (town index a, town index b) -> edge ids of the first track, a -> b
next_id = [500000]


def add_edge(p0, p1, t0, t1, road, tpl, etype=NORMAL):
    eid = next_id[0]
    next_id[0] += 1
    edges[eid] = dict(p0=p0, p1=p1, t0=t0, t1=t1, road=road, tpl=tpl, etype=etype)
    return eid


def street_grid(cx, cy, size, step):
    n = int(size / step)
    for i in range(-n, n + 1):
        for j in range(-n, n):
            x, y0, y1 = cx + i * step, cy + j * step, cy + (j + 1) * step
            add_edge((x, y0), (x, y1), (0, step), (0, step), ROAD_T, "::/streets/town_medium.lua")
            add_edge((y0 - cy + cx, i * step + cy), (y1 - cy + cx, i * step + cy), (step, 0), (step, 0), ROAD_T,
                     "::/streets/town_small.lua")


def curve_line(a, b, seg_len, road, tpl, wiggle=0.25, tunnel_frac=(0.45, 0.5)):
    """A gently curving line from a to b, split into Hermite segments."""
    ax, ay = a
    bx, by = b
    L = math.hypot(bx - ax, by - ay)
    n = max(2, int(L / seg_len))
    nx, ny = -(by - ay) / L, (bx - ax) / L
    amp = L * wiggle * random.choice([-1, 1])

    def P(t):
        s = math.sin(math.pi * t) * amp
        return ax + (bx - ax) * t + nx * s, ay + (by - ay) * t + ny * s

    def T(t):
        h = 1e-4
        p, q = P(max(0, t - h)), P(min(1, t + h))
        k = (1 / n) / (min(1, t + h) - max(0, t - h))
        return (q[0] - p[0]) * k, (q[1] - p[1]) * k

    ids = []
    for k in range(n):
        t0, t1 = k / n, (k + 1) / n
        etype = TUNNEL if tunnel_frac[0] <= t0 < tunnel_frac[1] else NORMAL
        ids.append(add_edge(P(t0), P(t1), T(t0), T(t1), road, tpl, etype))
    return ids


def build_network(target):
    for name, x, y, size in TOWNS:
        street_grid(x, y, 400 + size * 0.6, 80)
    rail_pairs = [(0, 5), (5, 3), (3, 2), (2, 8), (8, 1), (5, 4), (4, 7), (7, 9), (6, 0), (6, 5)]
    for a, b in rail_pairs:
        A, B = TOWNS[a], TOWNS[b]
        RAIL_ROUTES[(a, b)] = curve_line((A[1], A[2]), (B[1], B[2]), 60, TRACK_T, "::/tracks/standard.lua")
        curve_line((A[1] + 25, A[2] + 25), (B[1] + 25, B[2] + 25), 60, TRACK_T, "::/tracks/standard.lua")
    road_pairs = [(0, 6), (6, 5), (5, 4), (3, 2), (2, 8), (7, 9), (8, 1), (4, 7)]
    for a, b in road_pairs:
        A, B = TOWNS[a], TOWNS[b]
        curve_line((A[1], A[2]), (B[1], B[2]), 120, ROAD_T, "::/streets/country_large.lua", wiggle=0.12)
    # a ring line around Tokyo made of long, strongly curved edges (exercises Bezier export)
    cx, cy, R, n = TOWNS[2][1], TOWNS[2][2], 1800, 10
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        tl = R * (a1 - a0)
        add_edge((cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1)),
                 (-math.sin(a0) * tl, math.cos(a0) * tl), (-math.sin(a1) * tl, math.cos(a1) * tl), TRACK_T,
                 "::/tracks/standard.lua", BRIDGE if k == 3 else NORMAL)
    # pad with extra suburb grids until the target size is reached
    while len(edges) < target:
        x, y = random.uniform(-15000, 15000), random.uniform(-28000, 28000)
        street_grid(x, y, 300, 70)


build_network(args.edges)
print(f"fake network: {len(edges)} edges", flush=True)

# ------------------------------------------------------------------ Lua runtime + mocked API

lua = lua54.LuaRuntime(unpack_returned_tuples=True)
G = lua.globals()


def lua_to_py(v):
    if lua54.lua_type(v) == "table":
        items = list(v.items())
        keys = [k for k, _ in items]
        if keys and all(isinstance(k, int) for k in keys) and sorted(keys) == list(range(1, len(keys) + 1)):
            d = dict(items)
            return [lua_to_py(d[i]) for i in range(1, len(keys) + 1)]
        return {k: lua_to_py(x) for k, x in items}
    return v


def ser(v, ind):
    """Mimic app.saveUserdata's output format."""
    pad = "\t" * ind
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() and abs(v) < 1e15 else repr(v)
    if isinstance(v, str):
        return '"' + v.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'
    if isinstance(v, list):
        v = {i: x for i, x in enumerate(v, 1)}
    if isinstance(v, dict):
        lines = []
        is_list = list(v.keys()) == list(range(1, len(v) + 1))
        for k in sorted(v, key=lambda k: (not isinstance(k, str), str(k))):
            if is_list:
                lines.append(f"{pad}\t{ser(v[k], ind + 1)},")
            elif isinstance(k, str) and k.isidentifier():
                lines.append(f"{pad}\t{k} = {ser(v[k], ind + 1)},")
            else:
                lines.append(f"{pad}\t[{ser(k, ind + 1)}] = {ser(v[k], ind + 1)},")
        return "{ \n" + "\n".join(lines) + f"\n{pad}}}"
    return "nil"


save_stats = {"n": 0, "bytes": 0}


def save_userdata(folder, name, tbl):
    data = lua_to_py(tbl)
    text = "function data()\nreturn " + ser(data, 1) + "\nend\n"
    path = os.path.join(UD, folder, name + ".lua")
    with open(path, "w", encoding="utf-8") as f:   # non-atomic on purpose, like the game may be
        f.write(text)
    save_stats["n"] += 1
    save_stats["bytes"] += len(text)
    return True


def load_userdata(folder, name):
    path = os.path.join(UD, folder, name + ".lua")
    try:
        with open(path, encoding="utf-8") as f:
            d = probe.parse_userdata(f.read())
    except (FileNotFoundError, ValueError, StopIteration):
        return None
    return lua.table_from(d, recursive=True)


camera = {"x": -1048.0, "y": 292.0, "z": 4.0, "dist": 1500.0}


def vec(x, y, z=0.0):
    return lua.table_from({"x": float(x), "y": float(y), "z": float(z)})


def get_center():
    return vec(camera["x"], camera["y"], camera["z"])


def get_eye():
    return vec(camera["x"] - camera["dist"] * 0.3, camera["y"] - camera["dist"] * 0.7, camera["z"] + camera["dist"] * 0.6)


def focus_position(v, dist):
    camera.update(x=v.x, y=v.y, z=v.z, dist=dist)


CT = {"BASE_EDGE": 1, "TOWN": 2, "INDUSTRY": 3, "NAME": 4, "TERRAIN": 5, "CONSTRUCTION": 6,
      "LINE": 7, "COLOR": 8, "STATION_GROUP": 9, "STATION": 10, "TRANSPORT_VEHICLE": 11, "TRANSPORT_NETWORK": 12}
TERRAIN_DATAMAPS = [None]
towns = {100 + i: t for i, t in enumerate(TOWNS)}
inds = {200 + i: t for i, t in enumerate(INDUSTRIES)}
cons = {300 + i: t for i, t in enumerate(INDUSTRIES)}
calls = {"getComponent": 0}


EXTRA_ENTITIES = {}   # ct -> function() -> list


def get_entities(ct, filters=None):
    if ct in EXTRA_ENTITIES:
        return lua.table_from(EXTRA_ENTITIES[ct]())
    if ct == CT["BASE_EDGE"]:
        return lua.table_from([] if args.no_entities else list(edges.keys()))
    if ct == CT["TOWN"]:
        return lua.table_from(list(towns))
    if ct == CT["INDUSTRY"]:
        return lua.table_from(list(inds))
    if ct == CT["TERRAIN"]:
        return lua.table_from([1])
    return lua.table_from([])


EXTRA_COMPONENTS = []   # functions (e, ct) -> component or None, installed by fake_world


def get_component(e, ct):
    calls["getComponent"] += 1
    for f in EXTRA_COMPONENTS:
        r = f(e, ct)
        if r is not None:
            return r
    if ct == CT["BASE_EDGE"]:
        d = edges.get(e)
        if not d:
            return None
        return lua.table_from({
            "position0": vec(*d["p0"]), "position1": vec(*d["p1"]),
            "tangent0": vec(*d["t0"]), "tangent1": vec(*d["t1"]),
            "roadType": d["road"], "roadTemplate": d["tpl"], "type": d["etype"], "typeIndex": 0,
        })
    if ct == CT["NAME"]:
        if e in towns:
            return lua.table_from({"name": towns[e][0]})
        if e in inds:
            return lua.table_from({"name": inds[e][0]})
        return None
    if ct == CT["INDUSTRY"] and e in inds:
        return lua.table_from({"level": 2, "construction": e + 100})
    if ct == CT["CONSTRUCTION"] and e in cons:
        n, kind, x, y = cons[e]
        transf = lua.table_from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, float(x), float(y), 0, 1])
        return lua.table_from({"fileName": f"::/industries/{kind}/{kind}.con", "transf": transf})
    if ct == CT["TERRAIN"]:
        return lua.table_from({"size": vec(32768, 65536), "baseResolution": vec(4, 4, 1), "waterLevel": 0, "offsetZ": 0,
                               "dataMaps": TERRAIN_DATAMAPS[0]})
    return None


def node2segment():
    nodes = {}
    for eid, d in edges.items():
        for p in (d["p0"], d["p1"]):
            nodes.setdefault((round(p[0]), round(p[1])), []).append(eid)
    return lua.table_from({i: lua.table_from(v) for i, v in enumerate(nodes.values(), 1)})


town_util = lua.table_from({
    "getTownsToPositions": lambda: lua.table_from({k: vec(t[1], t[2]) for k, t in towns.items()}),
    "getTownSize": lambda e: towns[e][3],
})


def ug_require(path):
    if "town_util" in path:
        return town_util
    raise lua.eval("error")("module not found: " + path)


def debug_print(v):
    print("debugPrint:", lua_to_py(v), flush=True)


G.app = lua.table_from({"saveUserdata": save_userdata, "loadUserdata": load_userdata})
G.api = lua.table_from({
    "type": lua.table_from({
        "ComponentType": lua.table_from(CT),
        "enum": lua.table_from({
            "RoadType": lua.table_from({"STREET": ROAD_T, "TRACK": TRACK_T}),
            "BaseEdgeType": lua.table_from({"NORMAL": NORMAL, "BRIDGE": BRIDGE, "TUNNEL": TUNNEL}),
        }),
        "Vec3f": lua.table_from({"new": lambda x, y, z: vec(x, y, z)}),
    }),
    "engine": lua.table_from({"getEntitiesWithComponent": get_entities, "getComponent": get_component,
                              "system": lua.table_from({"streetSystem": lua.table_from({"getNode2SegmentMap": node2segment})})}),
    "gui": lua.table_from({"camera": lua.table_from({
        "getCenter": get_center, "getEye": get_eye, "getHeightAboveTerrain": lambda: camera["dist"] * 0.6,
        "focusPosition": focus_position, "focusEntity": lambda e: None})}),
})
G.debugPrint = debug_print
G.ug_require = ug_require

import fake_world  # noqa: E402
fake_world.install(sys.modules[__name__])

with open(SCRIPT, encoding="utf-8") as f:
    lua.execute(f.read())
gui_update = lua.eval("data()").guiUpdate

# ------------------------------------------------------------------ main loop

frame = 1.0 / args.fps
t_start = time.time()
t_mut = t_start + 15
worst = 0.0
frames = 0
while time.time() - t_start < args.seconds:
    t0 = time.perf_counter()
    gui_update(None, None, None)
    dt = time.perf_counter() - t0
    worst = max(worst, dt)
    frames += 1
    if time.time() >= t_mut:
        t_mut += 15
        # remove ~300 edges of one town grid, add a new curved rail line
        victims = random.sample(list(edges), 300)
        for v in victims:
            del edges[v]
        A, B = random.sample(TOWNS, 2)
        new = curve_line((A[1] - 60, A[2] - 60), (B[1] - 60, B[2] - 60), 60, TRACK_T, "::/tracks/high_speed.lua")
        print(f"mutation: -300 +{len(new)} edges -> {len(edges)}; worst frame so far {worst * 1000:.1f} ms, "
              f"saves {save_stats['n']}", flush=True)
    time.sleep(max(0.0, frame - dt))
print(f"done: frames={frames} worst={worst * 1000:.1f} ms saves={save_stats['n']} bytes={save_stats['bytes']}")


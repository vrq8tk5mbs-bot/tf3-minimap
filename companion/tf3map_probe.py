#!/usr/bin/env python3
"""TF3 Minimap Companion — probe for the mod's file channel.

Reads the files the tf3_minimap mod writes into the game's userdata folder and
sends camera commands back. No dependencies beyond Python 3.

    python3 tf3map_probe.py status            # what the mod reported at startup
    python3 tf3map_probe.py watch             # live camera, refreshed
    python3 tf3map_probe.py world             # towns and industries
    python3 tf3map_probe.py net               # street/track network: counts, timings, templates
    python3 tf3map_probe.py jump X Y [DIST]   # move camera to world coordinates
    python3 tf3map_probe.py town NAME         # jump to a town by (partial) name
    python3 tf3map_probe.py roundtrip         # measure command -> ack latency

Set TF3_USERDATA to override the userdata path (default: auto-detect under Steam).
"""

import glob
import os
import re
import sys
import time

APP_ID = "3493540"
SUBDIR = "towns_industries"
PREFIX = "tf3map_"


# ---------------------------------------------------------------- paths

_userdata_cache = None


def find_userdata():
    global _userdata_cache
    if _userdata_cache is None:
        _userdata_cache = _find_userdata()
    return _userdata_cache


def steam_roots():
    """Steam install folders on this computer (Windows registry, usual places on Mac/Linux/Steam Deck)."""
    roots = []
    if os.environ.get("STEAM_DIR"):
        roots.append(os.environ["STEAM_DIR"])
    if sys.platform == "win32":
        try:
            import winreg
            for hive, key, value in ((winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam", "SteamPath"),
                                     (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath"),
                                     (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Valve\Steam", "InstallPath")):
                try:
                    with winreg.OpenKey(hive, key) as k:
                        roots.append(winreg.QueryValueEx(k, value)[0])
                except OSError:
                    pass
        except ImportError:
            pass
        for env in ("ProgramFiles(x86)", "ProgramFiles"):
            if os.environ.get(env):
                roots.append(os.path.join(os.environ[env], "Steam"))
    elif sys.platform == "darwin":
        roots.append(os.path.expanduser("~/Library/Application Support/Steam"))
    else:
        for p in ("~/.local/share/Steam", "~/.steam/steam", "~/.steam/root",
                  "~/.var/app/com.valvesoftware.Steam/.local/share/Steam",   # Flatpak
                  "~/snap/steam/common/.local/share/Steam"):                   # Snap
            roots.append(os.path.expanduser(p))
    out, seen = [], set()
    for r in roots:
        if not r or not os.path.isdir(r):
            continue
        key = os.path.normcase(os.path.realpath(r))
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out


def steam_libraries():
    """Every Steam library folder (games can live on other drives), from libraryfolders.vdf."""
    libs, seen = [], set()
    for root in steam_roots():
        cands = [root]
        try:
            with open(os.path.join(root, "steamapps", "libraryfolders.vdf"), encoding="utf-8", errors="replace") as f:
                cands += [m.group(1).replace("\\\\", "\\") for m in re.finditer(r'"path"\s+"([^"]+)"', f.read())]
        except OSError:
            pass
        for c in cands:
            key = os.path.normcase(os.path.realpath(c))
            if key not in seen and os.path.isdir(c):
                seen.add(key)
                libs.append(c)
    return libs


def find_game_dir():
    """The game's install folder (for cargo icons). TF3_GAME overrides."""
    if os.environ.get("TF3_GAME"):
        return os.environ["TF3_GAME"]
    for lib in steam_libraries():
        steamapps = os.path.join(lib, "steamapps")
        name = "Transport Fever 3"
        try:   # the app manifest names the real folder
            with open(os.path.join(steamapps, f"appmanifest_{APP_ID}.acf"), encoding="utf-8", errors="replace") as f:
                m = re.search(r'"installdir"\s+"([^"]+)"', f.read())
                if m:
                    name = m.group(1)
        except OSError:
            pass
        p = os.path.join(steamapps, "common", name)
        if os.path.isdir(p):
            return p
    return None


class UserdataNotFound(Exception):
    pass


def _find_userdata():
    env = os.environ.get("TF3_USERDATA")
    if env:
        return env
    hits = []
    for root in steam_roots():
        hits += glob.glob(os.path.join(root, "userdata", "*", APP_ID, "local"))
    if not hits:
        raise UserdataNotFound(
            "The Transport Fever 3 save folder was not found.\n"
            "Start the game once (with the TF3 Minimap mod enabled), then run this again.\n"
            "If Steam is in an unusual place, pass it: --userdata \"<Steam>/userdata/<id>/" + APP_ID + "/local\"")
    # several Steam accounts: prefer one where the mod already wrote its files, then the latest used
    return max(hits, key=lambda h: (os.path.isdir(os.path.join(h, SUBDIR)), os.path.getmtime(h)))


def path_of(name):
    return os.path.join(find_userdata(), SUBDIR, PREFIX + name + ".lua")


# ---------------------------------------------------------------- Lua data parser
# Parses the subset of Lua that app.saveUserdata writes:
#   function data() return { key = value, [1] = value, value, ... } end

TOKEN_RE = re.compile(r"""
    (?P<ws>\s+|--\[\[.*?\]\]|--[^\n]*)
  | (?P<str>"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')
  | (?P<num>-?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?))
  | (?P<name>[A-Za-z_][A-Za-z0-9_]*)
  | (?P<sym>[{}\[\]=,;()-])
""", re.VERBOSE | re.DOTALL)

ESCAPES = {"n": "\n", "t": "\t", "r": "\r", "\\": "\\", '"': '"', "'": "'", "a": "\a", "b": "\b", "f": "\f", "v": "\v", "\n": "\n"}


def _unescape(s):
    if "\\" not in s:  # fast path: network edge strings never contain escapes
        return s
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s):
            n = s[i + 1]
            if n.isdigit():
                m = re.match(r"\d{1,3}", s[i + 1:])
                out.append(chr(int(m.group())))
                i += 1 + len(m.group())
                continue
            out.append(ESCAPES.get(n, n))
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def _tokenize(text):
    pos, toks = 0, []
    while pos < len(text):
        m = TOKEN_RE.match(text, pos)
        if not m:
            raise ValueError(f"unexpected character at {pos}: {text[pos:pos + 20]!r}")
        pos = m.end()
        kind = m.lastgroup
        if kind == "ws":
            continue
        toks.append((kind, m.group()))
    return toks


class _Parser:
    def __init__(self, toks):
        self.t, self.i = toks, 0

    def peek(self, k=0):
        return self.t[self.i + k] if self.i + k < len(self.t) else (None, None)

    def take(self, value=None):
        tok = self.peek()
        if value is not None and tok[1] != value:
            raise ValueError(f"expected {value!r}, got {tok[1]!r}")
        self.i += 1
        return tok

    def value(self):
        kind, v = self.peek()
        if kind == "str":
            self.take()
            return _unescape(v[1:-1])
        if kind == "num":
            self.take()
            if v.lower().startswith(("0x", "-0x")):
                return int(v, 16)
            f = float(v)
            return int(f) if re.fullmatch(r"-?\d+", v) else f
        if kind == "sym" and v == "-":  # unary minus before a name like math.huge
            self.take()
            return -self.value()
        if kind == "name":
            self.take()
            return {"true": True, "false": False, "nil": None}.get(v, v)
        if v == "{":
            return self.table()
        raise ValueError(f"unexpected token {v!r}")

    def table(self):
        self.take("{")
        d, arr = {}, []
        while self.peek()[1] != "}":
            if self.peek()[1] is None:
                raise ValueError("unexpected end of file")  # half-written file
            kind, v = self.peek()
            if v == "[":
                self.take("[")
                key = self.value()
                self.take("]")
                self.take("=")
                d[key] = self.value()
            elif kind == "name" and self.peek(1)[1] == "=":
                self.take()
                self.take("=")
                d[v] = self.value()
            else:
                arr.append(self.value())
            if self.peek()[1] in (",", ";"):
                self.take()
        self.take("}")
        if arr and not d:
            return arr
        for idx, v in enumerate(arr, 1):
            d[idx] = v
        # convert {1:..,2:..} into a list
        if d and all(isinstance(k, int) for k in d) and sorted(d) == list(range(1, len(d) + 1)):
            return [d[k] for k in range(1, len(d) + 1)]
        return d


def parse_userdata(text):
    toks = _tokenize(text)
    # skip "function data ( ) return"
    i = next(i for i, t in enumerate(toks) if t[1] == "{")
    p = _Parser(toks[i:])
    return p.table()


def read(name):
    path = path_of(name)
    for attempt in range(5):  # the game may be mid-write
        try:
            with open(path, encoding="utf-8") as f:
                return parse_userdata(f.read())
        except FileNotFoundError:
            return None
        except (ValueError, StopIteration):
            time.sleep(0.05)
    return None


# ---------------------------------------------------------------- Lua data writer

def _lua(v, indent=1):
    pad = "\t" * indent
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return "nil"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, str):
        return '"' + v.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'
    if isinstance(v, (list, tuple)):
        v = {i: x for i, x in enumerate(v, 1)}
    items = []
    for k, x in v.items():
        key = k if isinstance(k, str) and re.fullmatch(r"[A-Za-z_]\w*", k) else f"[{_lua(k)}]"
        items.append(f"{pad}\t{key} = {_lua(x, indent + 1)},")
    return "{\n" + "\n".join(items) + f"\n{pad}}}"


def write(name, table):
    path = path_of(name)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("function data()\nreturn " + _lua(table, 0) + "\nend\n")
    os.replace(tmp, path)  # atomic: the game never sees a half-written command


def send(cmd):
    live = read("live") or {}
    ack = read("ack") or {}
    seq = max(live.get("lastCmdSeq", 0) or 0, ack.get("seq", 0) or 0) + 1
    cmd = dict(cmd, seq=seq)
    write("cmd", cmd)
    return seq


def wait_ack(seq, timeout=3.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        ack = read("ack")
        if ack and ack.get("seq") == seq:
            return ack, time.time() - t0
        time.sleep(0.02)
    return None, timeout


# ---------------------------------------------------------------- network

def read_tile(key, want_seq=None, session=None):
    """Read one network tile; returns None while the file is missing, stale or half-written."""
    t = read("net_" + key)
    if not t:
        return None
    if session is not None and t.get("session") != session:
        return None
    if want_seq is not None and t.get("seq") != want_seq:
        return None
    return t


def count_edges(edge_str):
    out = {"r": 0, "s": 0, "u": 0, "curved": 0, "tunnel": 0, "bridge": 0}
    if not edge_str:
        return out
    for e in edge_str.split(";"):
        f = e.split(",")
        out[f[0]] = out.get(f[0], 0) + 1
        if len(f) > 7:
            out["curved"] += 1
        if f[2] == "2":
            out["tunnel"] += 1
        elif f[2] == "1":
            out["bridge"] += 1
    return out


# ---------------------------------------------------------------- commands

def cmd_status():
    print("userdata:", find_userdata())
    st = read("status")
    print("status:", st if st else "(no status file — is the mod active in this savegame?)")
    live = read("live")
    if live:
        age = time.time() - (live.get("t") or 0)
        print(f"live: seq={live.get('seq')} age={age:.1f}s camera={live.get('camera')}")
    else:
        print("live: (none)")


def cmd_watch():
    last = None
    try:
        while True:
            live = read("live")
            if live and live.get("seq") != last:
                last = live.get("seq")
                c = live.get("camera", {})
                print(f"\rseq {last:>6}  center x={c.get('x')} y={c.get('y')} z={c.get('z')}  h={c.get('h')}      ", end="", flush=True)
            time.sleep(0.1)
    except KeyboardInterrupt:
        print()


def cmd_world():
    w = read("world")
    if not w:
        print("no world file yet (it is written ~10 s after loading)")
        return
    print("terrain:", w.get("terrain"))
    towns = w.get("towns") or []
    inds = w.get("industries") or []
    print(f"\n{len(towns)} towns:")
    for t in sorted(towns, key=lambda t: -(t.get("size") or 0)):
        print(f"  {t.get('id'):>8}  {str(t.get('name')):<28} size={t.get('size')}  x={t.get('x')} y={t.get('y')}")
    print(f"\n{len(inds)} industries:")
    for i in inds[:40]:
        print(f"  {i.get('id'):>8}  {str(i.get('name')):<28} lvl={i.get('level')}  x={i.get('x')} y={i.get('y')}  {i.get('type')}")
    if len(inds) > 40:
        print(f"  ... and {len(inds) - 40} more")


def cmd_net():
    m = read("net")
    if not m:
        print("no net manifest yet (mod v3 not active?)")
        return
    tiles = m.get("tiles") or {}
    if isinstance(tiles, list):
        tiles = {}
    st = m.get("stats") or {}
    print(f"session={m.get('session')} seq={m.get('seq')} tile={m.get('tile')} m  tiles={len(tiles)}")
    print("stats:")
    for k in sorted(st):
        print(f"  {k:<18} {st[k]}")
    totals, size, missing = {}, 0, 0
    t0 = time.time()
    for key, info in tiles.items():
        t = read_tile(key, info.get("seq"), m.get("session"))
        if not t:
            missing += 1
            continue
        size += len(t.get("edges") or "")
        for k, v in count_edges(t.get("edges")).items():
            totals[k] = totals.get(k, 0) + v
    dt = time.time() - t0
    print(f"\nedges: track={totals.get('r', 0)} street={totals.get('s', 0)} unknown={totals.get('u', 0)}  "
          f"curved={totals.get('curved', 0)} tunnel={totals.get('tunnel', 0)} bridge={totals.get('bridge', 0)}")
    print(f"tile files: {len(tiles) - missing} read, {missing} missing/stale; {size / 1024:.0f} KB of edge data; parsed in {dt * 1000:.0f} ms")
    tpls = m.get("templates") or []
    print(f"\n{len(tpls)} templates:")
    for i, name in enumerate(tpls[:30], 1):
        print(f"  {i:>3}  {name}")


def _do(cmd):
    seq = send(cmd)
    ack, dt = wait_ack(seq)
    if ack:
        print(f"seq {seq}: ok={ack.get('ok')} error={ack.get('error')}  ({dt * 1000:.0f} ms)")
    else:
        print(f"seq {seq}: no ack within {dt:.0f}s — is the game running and unpaused in the foreground?")


def cmd_jump(x, y, dist=None):
    c = {"action": "jump", "x": float(x), "y": float(y)}
    if dist:
        c["dist"] = float(dist)
    _do(c)


def cmd_town(name):
    w = read("world") or {}
    hits = [t for t in w.get("towns") or [] if name.lower() in str(t.get("name", "")).lower()]
    if not hits:
        sys.exit(f"no town matching {name!r}")
    t = hits[0]
    print("->", t.get("name"))
    if t.get("x") is not None:
        _do({"action": "jump", "x": t["x"], "y": t["y"], "dist": 2000.0})
    else:
        _do({"action": "focus", "entity": t["id"]})


def cmd_roundtrip(n="5"):
    n = int(n)
    live = read("live") or {}
    c = live.get("camera") or {}
    if c.get("x") is None:
        sys.exit("no camera in live file")
    times = []
    for k in range(n):
        dx = 300 if k % 2 == 0 else -300
        seq = send({"action": "jump", "x": c["x"] + dx, "y": c["y"]})
        ack, dt = wait_ack(seq)
        times.append(dt if ack else None)
        print(f"  #{k + 1}: {'%.0f ms' % (dt * 1000) if ack else 'timeout'}")
        time.sleep(0.5)
    ok = [t for t in times if t is not None]
    if ok:
        print(f"median {sorted(ok)[len(ok) // 2] * 1000:.0f} ms over {len(ok)}/{n}")


def main(argv):
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return
    cmd, args = argv[0], argv[1:]
    {
        "status": cmd_status,
        "watch": cmd_watch,
        "world": cmd_world,
        "net": cmd_net,
        "jump": cmd_jump,
        "town": lambda *a: cmd_town(" ".join(a)),
        "roundtrip": cmd_roundtrip,
    }[cmd](*args)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except UserdataNotFound as e:
        sys.exit(str(e))


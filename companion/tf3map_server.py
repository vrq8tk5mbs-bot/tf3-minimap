#!/usr/bin/env python3
"""TF3 Minimap Companion — local web server.

Watches the files the tf3_minimap mod writes, serves the minimap page to any
browser on the local network and forwards taps back to the game as camera
commands. Python 3 standard library only.

    python3 tf3map_server.py            # port 8765
    python3 tf3map_server.py --port 9000

Then open the printed URL in a browser: on this computer (e.g. a second monitor)
or on a phone/tablet in the same Wi-Fi.
"""

import argparse
import glob
import gzip
import json
import math
import os
import socket
import stat
import struct
import sys
import threading
import time
import zipfile
import zlib
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tf3map_probe as probe  # noqa: E402  (file paths, Lua parser/writer, send/wait_ack)

FROZEN = getattr(sys, "frozen", False)   # packed into a single program (PyInstaller)
# the page files: next to this script, or unpacked from the program
APP_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(APP_DIR, "web")


def data_dir():
    """Where the server keeps its own files (ship courses, icon report)."""
    if not FROZEN:
        return os.path.dirname(os.path.abspath(__file__))
    base = os.environ.get("APPDATA") if sys.platform == "win32" else None
    d = os.path.join(base, "TF3 Minimap") if base else os.path.expanduser("~/.tf3map")
    os.makedirs(d, exist_ok=True)
    return d


POLL_INTERVAL = 0.1
GAME_SILENT_AFTER = 30  # seconds without the live file changing -> tell the player what to check
HEARTBEAT = 15.0
READONLY_CHECK_EVERY = 30.0  # while the game is silent: look for read-only map files this often
# Files the client fetches from /data/<name> when the SSE "versions" event says they changed.
DATA_FILES = ("meta", "stations", "lines", "paths", "veh", "towns", "flows",
              "grid_terrain", "grid_noise", "grid_pollution")


# ---------------------------------------------------------------- cargo icons from the user's game install

find_game_dir = probe.find_game_dir


def tga_to_png(data):
    """Decode an uncompressed or RLE true-colour TGA (24/32 bit) and encode it as PNG (stdlib only)."""
    idlen, cmtype, itype = data[0], data[1], data[2]
    w, h = struct.unpack_from("<HH", data, 12)
    bpp, desc = data[16], data[17]
    if itype not in (2, 10) or bpp not in (24, 32) or cmtype != 0:
        raise ValueError(f"unsupported TGA type={itype} bpp={bpp}")
    px = bpp // 8
    pos = 18 + idlen
    n = w * h
    if itype == 2:
        raw = data[pos:pos + n * px]
    else:
        out = bytearray()
        while len(out) < n * px:
            hdr = data[pos]
            pos += 1
            count = (hdr & 0x7F) + 1
            if hdr & 0x80:
                out += data[pos:pos + px] * count
                pos += px
            else:
                out += data[pos:pos + count * px]
                pos += count * px
        raw = bytes(out)
    rows = []
    for y in range(h):
        row = raw[y * w * px:(y + 1) * w * px]
        rgba = bytearray(w * 4)
        for x in range(w):
            b, g, r = row[x * px], row[x * px + 1], row[x * px + 2]
            a = row[x * px + 3] if px == 4 else 255
            rgba[x * 4:x * 4 + 4] = bytes((r, g, b, a))
        rows.append(bytes(rgba))
    if not desc & 0x20:   # origin bottom-left -> flip
        rows.reverse()
    payload = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, body):
        return struct.pack(">I", len(body)) + tag + body + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(payload, 6)) + chunk(b"IEND", b""))


class Icons:
    """Maps cargo icon paths (from the mod's meta file) to PNGs extracted from the game's zip archives."""

    def __init__(self):
        self.lock = threading.Lock()
        self.index = None     # lower-case entry path -> (zip path, entry name)
        self.cache = {}

    def _build_index(self):
        idx = {}
        game = find_game_dir()
        if game:
            for z in glob.glob(os.path.join(game, "base", "content", "cargos", "*.zip")) + \
                    glob.glob(os.path.join(game, "base", "content", "*.zip")):
                try:
                    with zipfile.ZipFile(z) as zf:
                        for name in zf.namelist():
                            if name.lower().endswith((".tga", ".png")):
                                idx[name.lower()] = (z, name)
                except (zipfile.BadZipFile, OSError):
                    continue
        self.index = idx

    @staticmethod
    def _stem(path):
        b = os.path.basename(path.lower())
        b = os.path.splitext(b)[0]
        return b.replace("@2x", "").replace("_small", "")

    def lookup(self, icon_path):
        with self.lock:
            if self.index is None:
                self._build_index()
            key = icon_path.lower().lstrip("/")
            hits = [k for k in self.index if k.endswith(key)]
            if not hits:   # same file name stem, preferring the @2x variant
                stem = self._stem(key)
                hits = sorted((k for k in self.index if self._stem(k) == stem), key=lambda k: "@2x" not in k)
            return self.index[hits[0]] if hits else None

    def report(self, meta, path):
        """Write which cargo icons were found (for remote diagnosis)."""
        rows = []
        for c in meta.get("cargo") or []:
            hit = self.lookup(c.get("icon") or "") if c.get("icon") else None
            rows.append({"id": c.get("id"), "res": c.get("res"), "icon": c.get("icon"),
                         "found": f"{os.path.basename(hit[0])}:{hit[1]}" if hit else None})
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"game": find_game_dir(), "indexed": len(self.index or {}), "cargo": rows}, f, indent=1)
        except OSError:
            pass

    def png(self, icon_path):
        if icon_path in self.cache:
            return self.cache[icon_path]
        hit = self.lookup(icon_path)
        png = None
        if hit:
            try:
                with zipfile.ZipFile(hit[0]) as zf:
                    data = zf.read(hit[1])
                png = data if hit[1].lower().endswith(".png") else tga_to_png(data)
            except (ValueError, KeyError, struct.error, zipfile.BadZipFile, OSError, IndexError) as e:
                print("icon failed:", icon_path, e, file=sys.stderr)
        self.cache[icon_path] = png
        return png


ICONS = Icons()


class Net:
    """Street/track network assembled from the manifest and its tile files.

    A version is published only when every tile listed in the manifest has been read at the
    seq the manifest names, so clients never see a half-updated network."""

    def __init__(self):
        self.session = None
        self.seq = 0             # published manifest seq
        self.manifest = None     # published manifest
        self.tiles = {}          # key -> {"seq": n, "edges": str}
        self.pending = None      # manifest waiting for its tiles

    def meta(self):
        if not self.manifest:
            return None
        m = self.manifest
        return {"session": self.session, "seq": self.seq, "tiles": len(self.tiles),
                "edges": sum(t["n"] for t in self.tiles.values()), "stats": m.get("stats") or {}}

    def offer(self, manifest):
        """New manifest read from disk."""
        if not isinstance(manifest, dict):
            return False
        self.pending = manifest
        return self.try_complete()

    def try_complete(self):
        m = self.pending
        if m is None:
            return False
        session = m.get("session")
        tiles = m.get("tiles") or {}
        if not isinstance(tiles, dict):
            tiles = {}
        base = self.tiles if session == self.session else {}
        fresh = {}
        for key, info in tiles.items():
            want = info.get("seq") if isinstance(info, dict) else None
            have = base.get(key)
            if have and have["seq"] == want:
                fresh[key] = have
                continue
            t = probe.read_tile(key, want, session)
            if t is None:
                return False   # not written yet or half-written; retry on the next poll
            edges = t.get("edges") or ""
            fresh[key] = {"seq": want, "edges": edges, "n": edges.count(";") + 1 if edges else 0}
        self.session, self.seq, self.tiles, self.manifest = session, m.get("seq") or 0, fresh, m
        self.pending = None
        return True

    def payload(self, session, since):
        """Tiles changed after `since` (all of them if the session differs or since == 0)."""
        if not self.manifest:
            return {"session": None, "seq": 0, "tiles": {}, "keys": [], "templates": [], "full": True}
        full = session != self.session or not since
        tiles = {k: t["edges"] for k, t in self.tiles.items() if full or (t["seq"] or 0) > since}
        tpls = self.manifest.get("templates") or []
        return {
            "session": self.session, "seq": self.seq, "full": full,
            "tile": self.manifest.get("tile"),
            "templates": tpls if isinstance(tpls, list) else [],
            "keys": list(self.tiles), "tiles": tiles,
            "stats": self.manifest.get("stats") or {},
        }


# ---------------------------------------------------------------- courses recorded from vehicles

def _simplify(pts, tol):
    """Douglas-Peucker, iterative."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        ll = dx * dx + dy * dy
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if ll:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / ll))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            else:
                d = (px - ax) ** 2 + (py - ay) ** 2
            if d > best:
                best, bi = d, i
        if bi > 0 and best > tol * tol:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]


class Trails:
    """Where ships (and any other non-air line the game could not route) actually go.

    The game has no road nodes on water, so the mod can only draw ship lines as straight hops.
    Here one vehicle per such line is followed through the live positions until it is back where
    recording started; that loop is the line's course. Courses are kept in trails.json next to this
    script (in the user's app-data folder for the packed program) and re-recorded when the line's
    stops change. Air lines stay straight on purpose.
    """
    STEP = 40          # metres between recorded points
    JUMP = 4000        # a bigger hop between two updates means teleport/depot: start over
    MIN_LOOP = 1500    # a finished loop is at least this long ...
    AWAY = 500         # ... went at least this far from its start ...
    CLOSE = 150        # ... and came back this close to it
    MAX_PTS = 8000

    def __init__(self):
        self.FILE = os.path.join(data_dir(), "trails.json")
        self.lines = {}
        self.saved_at = 0.0
        self.dirty = False
        self.save_warned = False
        try:
            with open(self.FILE, encoding="utf-8") as f:
                self.lines = json.load(f).get("lines", {})
        except (OSError, ValueError):
            pass

    def _save(self, force=False):
        if not self.dirty or (not force and time.time() - self.saved_at < 30):
            return
        self.saved_at = time.time()   # also after a failure: try again in 30 s, not on every update
        tmp = f"{self.FILE}.{os.getpid()}.tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"lines": self.lines}, f)
            for attempt in range(5):
                try:
                    os.replace(tmp, self.FILE)
                    break
                except PermissionError:   # Windows: antivirus or the search indexer holds the file for a moment
                    if attempt == 4:
                        raise
                    time.sleep(0.1 * (attempt + 1))
            self.dirty = False
            self.save_warned = False
        except OSError as e:
            if not self.save_warned:   # one line, not a stream of them
                print(f"note: ship courses not saved yet ({e.strerror or e}); retrying every 30 s. "
                      "The map is not affected.", file=sys.stderr)
                self.save_warned = True
            try:
                os.remove(tmp)
            except OSError:
                pass

    @staticmethod
    def _wanted(lines_data, paths_data):
        paths = (paths_data or {}).get("paths") or {}
        out = {}
        for L in (lines_data or {}).get("lines") or []:
            car = L.get("carriers") or []
            if not isinstance(car, list) or "AIR" in car:
                continue
            P = paths.get(str(L.get("id"))) or paths.get(L.get("id")) or {}
            if "WATER" in car or (P.get("fail") or 0) > 0:
                stops = L.get("stops") or []
                sig = ",".join(str(s[0]) if isinstance(s, list) and s else str(s) for s in stops)
                out[str(L.get("id"))] = sig
        return out

    def update(self, veh, lines_data, paths_data):
        """Feed one vehicle snapshot. Returns True when a course was finished (or dropped)."""
        wanted = self._wanted(lines_data, paths_data)
        if not wanted:
            return False
        by_line = {}
        for part in (veh or {}).get("v", "").split(";"):
            f = part.split(",")
            if len(f) < 4:
                continue
            try:
                vid, lid, x, y = int(f[0]), str(int(float(f[1]))), float(f[2]), float(f[3])
            except ValueError:
                continue
            if lid in wanted:
                by_line.setdefault(lid, []).append((vid, x, y))
        changed = False
        for lid, sig in wanted.items():
            tr = self.lines.get(lid)
            if tr is None or tr.get("sig") != sig:
                changed = changed or bool(tr and tr.get("done"))
                tr = self.lines[lid] = {"sig": sig, "pts": [], "veh": None, "done": False, "far": 0, "len": 0}
            if tr["done"] or lid not in by_line:
                continue
            vs = by_line[lid]
            cur = next((v for v in vs if v[0] == tr["veh"]), None)
            if cur is None:
                cur = vs[0]
                tr.update(veh=cur[0], pts=[], far=0, len=0)
            x, y = round(cur[1]), round(cur[2])
            pts = tr["pts"]
            if pts:
                lx, ly = pts[-1]
                d = math.hypot(x - lx, y - ly)
                if d > self.JUMP:
                    tr.update(pts=[], far=0, len=0)
                    pts = tr["pts"]
                elif d < self.STEP:
                    continue
                else:
                    tr["len"] = tr.get("len", 0) + d
            pts.append([x, y])
            self.dirty = True
            sx, sy = pts[0]
            tr["far"] = max(tr["far"], math.hypot(x - sx, y - sy))
            back = tr["far"] >= self.AWAY and math.hypot(x - sx, y - sy) < self.CLOSE and tr.get("len", 0) >= self.MIN_LOOP
            if back or len(pts) >= self.MAX_PTS:
                tr["pts"] = _simplify(pts + [pts[0]] if back else pts, 12)
                tr["done"] = True
                changed = True
        for lid in [k for k in self.lines if k not in wanted]:
            changed = changed or self.lines[lid].get("done", False)
            del self.lines[lid]
            self.dirty = True
        self._save(force=changed)
        return changed

    def payload(self):
        return {"t": time.time(), "lines": {lid: {"pts": " ".join(f"{p[0]},{p[1]}" for p in tr["pts"]), "done": True}
                                            for lid, tr in self.lines.items() if tr.get("done")}}


TRAILS = Trails()


_readonly_failed = set()   # files we could not fix; reported once each


def make_map_files_writable():
    """Clear the read-only flag on the mod's own tf3map_*.lua files. Returns how many were fixed.

    Seen on Windows 11: the files had become read-only. The game then cannot overwrite them and says
    nothing - not even into tf3map_status.lua, which is read-only too - so the map shows the last session
    forever ("Game is silent"). Only our own files are touched. The mod retries every write, so the map
    comes back within a second, without restarting the game."""
    folder = os.path.join(probe.find_userdata(), probe.SUBDIR)
    ro_attr = getattr(stat, "FILE_ATTRIBUTE_READONLY", 1)
    fixed = 0
    for path in glob.glob(os.path.join(folder, probe.PREFIX + "*.lua")):
        try:
            st = os.stat(path)
            readonly = not (st.st_mode & stat.S_IWUSR) or bool(getattr(st, "st_file_attributes", 0) & ro_attr)
            if not readonly:
                continue
            os.chmod(path, stat.S_IMODE(st.st_mode) | stat.S_IREAD | stat.S_IWUSR)  # on Windows: clears read-only
            fixed += 1
        except OSError as e:
            name = os.path.basename(path)
            if name not in _readonly_failed:
                _readonly_failed.add(name)
                print(f"\nCannot make {name} writable ({e}).\n"
                      f"  Close the game, delete the files starting with {probe.PREFIX} in\n  {folder}\n"
                      "  and start the game again - it creates them anew.", flush=True)
    if fixed:
        print(f"\nFixed {fixed} map file(s) marked read-only - the game could not update them,\n"
              "  so the map kept showing an old state. It should update within seconds.", flush=True)
    return fixed


class State:
    """Latest data read from the mod's files, plus a condition to wake SSE clients."""

    def __init__(self):
        self.cond = threading.Condition()
        self.lock = threading.Lock()   # guards net between the poll thread and HTTP threads
        self.world = None
        self.live = None
        self.status = None
        self.data = {}           # name -> parsed content (DATA_FILES)
        self.versions = {}       # name -> version counter
        self.net = Net()
        self.netmeta = None
        self.version = 0  # bumped on every change
        self._mtimes = {}
        self.cmd_lock = threading.Lock()
        self._silent_noted = False   # "no data from the game" already printed for this silent spell
        self._readonly_checked = 0.0   # last look for read-only map files

    def _changed(self, name):
        try:
            m = os.stat(probe.path_of(name)).st_mtime_ns
        except FileNotFoundError:
            return False
        if self._mtimes.get(name) != m:
            self._mtimes[name] = m
            return True
        return False

    def _check_game_alive(self):
        """Print once when the game stops writing the live file (~10x a second while a save is open),
        and once when it comes back. Uses the file's age, so an old file from last session counts as silent."""
        try:
            age = time.time() - os.stat(probe.path_of("live")).st_mtime
        except OSError:
            age = float("inf")
        if age > GAME_SILENT_AFTER and not self._silent_noted:
            self._silent_noted = True
            print(f"\nNo data from the game for {GAME_SILENT_AFTER} s.\n"
                  "  Load a save and check that Minimap Companion is enabled in that save's mod list.\n"
                  f"  Data folder: {os.path.join(probe.find_userdata(), probe.SUBDIR)}\n"
                  "  (Normal while the game is in the main menu or loading. Keep this window open;\n"
                  "  the map updates as soon as the game sends data.)", flush=True)
        if age > GAME_SILENT_AFTER and time.time() - self._readonly_checked >= READONLY_CHECK_EVERY:
            self._readonly_checked = time.time()
            try:
                make_map_files_writable()
            except Exception as e:  # never let this stop the map
                print("read-only check:", e, file=sys.stderr)
        if age <= GAME_SILENT_AFTER and self._silent_noted:
            self._silent_noted = False
            print("Game connected - data is coming in.", flush=True)

    def poll_forever(self):
        started = time.time()
        while True:
            if time.time() - started > GAME_SILENT_AFTER:
                self._check_game_alive()
            updated = False
            for name in ("live", "world", "status"):
                if self._changed(name):
                    data = probe.read(name)
                    if data is None:
                        self._mtimes.pop(name, None)  # half-written; retry next tick
                        continue
                    setattr(self, name, data)
                    updated = True
            for name in DATA_FILES:
                if self._changed(name):
                    data = probe.read(name)
                    if data is None:
                        self._mtimes.pop(name, None)
                        continue
                    self.data[name] = data
                    self.versions = dict(self.versions, **{name: self.versions.get(name, 0) + 1})
                    updated = True
                    if name == "veh":
                        try:
                            if TRAILS.update(data, self.data.get("lines"), self.data.get("paths")) or "trails" not in self.data:
                                self.data["trails"] = TRAILS.payload()
                                self.versions = dict(self.versions, trails=self.versions.get("trails", 0) + 1)
                        except Exception as e:  # never let course recording stop the map
                            print("trails:", e, file=sys.stderr)
                    if name == "meta":
                        report = os.path.join(data_dir(), "icons_report.json")
                        threading.Thread(target=ICONS.report, args=(data, report), daemon=True).start()
            if self._changed("net"):
                m = probe.read("net")
                if m is None:
                    self._mtimes.pop("net", None)
                else:
                    with self.lock:
                        if self.net.offer(m):
                            self.netmeta = self.net.meta()
                            updated = True
            elif self.net.pending is not None:
                with self.lock:
                    if self.net.try_complete():
                        self.netmeta = self.net.meta()
                        updated = True
            if updated:
                with self.cond:
                    self.version += 1
                    self.cond.notify_all()
            time.sleep(POLL_INTERVAL)

    def snapshot(self):
        return {"world": self.world, "live": self.live, "status": self.status, "net": self.netmeta,
                "serverTime": time.time()}


STATE = State()


def send_command(cmd):
    with STATE.cmd_lock:  # several phones may tap at once; seq numbers must not collide
        seq = probe.send(cmd)
        ack, dt = probe.wait_ack(seq, timeout=2.5)
    if ack is None:
        return {"seq": seq, "ok": False, "error": "no ack from game (paused, minimised or mod not active?)"}
    return {"seq": seq, "ok": bool(ack.get("ok")), "error": ack.get("error"), "ms": round(dt * 1000)}


ALLOWED_ACTIONS = {"jump", "focus", "flows"}


def sanitize(cmd):
    if not isinstance(cmd, dict) or cmd.get("action") not in ALLOWED_ACTIONS:
        raise ValueError("unknown action")
    out = {"action": cmd["action"]}
    for k in ("x", "y", "z", "dist"):
        if k in cmd and cmd[k] is not None:
            out[k] = float(cmd[k])
    if "entity" in cmd and cmd["entity"] is not None:
        out["entity"] = int(cmd["entity"])
    if cmd.get("kind") in ("town", "industry", "station"):
        out["kind"] = cmd["kind"]
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = "tf3map/1"

    def log_message(self, fmt, *args):  # quiet; errors still go to stderr via send_error
        pass

    def _json(self, obj, status=HTTPStatus.OK):
        body = json.dumps(obj, separators=(",", ":")).encode()
        gz = len(body) > 2048 and "gzip" in (self.headers.get("Accept-Encoding") or "")
        if gz:
            body = gzip.compress(body, 5)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        if gz:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlsplit(self.path)
        path = url.path
        if path in ("/", "/index.html"):
            return self._file("index.html", "text/html; charset=utf-8")
        if path in ("/app.js", "/i18n.js"):
            return self._file(path[1:], "text/javascript; charset=utf-8")
        if path == "/state":
            return self._json(STATE.snapshot())
        if path == "/net":
            q = parse_qs(url.query)
            session = (q.get("session") or [None])[0]
            try:
                since = int((q.get("since") or ["0"])[0])
            except ValueError:
                since = 0
            with STATE.lock:
                payload = STATE.net.payload(session, since)
            return self._json(payload)
        if path == "/events":
            return self._events()
        if path.startswith("/data/"):
            name = path[len("/data/"):]
            if name not in DATA_FILES + ("trails",) or name not in STATE.data:
                return self.send_error(HTTPStatus.NOT_FOUND)
            return self._json({"version": STATE.versions.get(name, 0), "data": STATE.data[name]})
        if path.startswith("/icon/"):
            return self._icon(path[len("/icon/"):])
        self.send_error(HTTPStatus.NOT_FOUND)

    def _icon(self, cargo_id):
        meta = STATE.data.get("meta") or {}
        icon = None
        for c in meta.get("cargo") or []:
            if str(c.get("id")) == cargo_id.split(".")[0]:
                icon = c.get("icon")
        png = ICONS.png(icon) if icon else None
        if not png:
            return self.send_error(HTTPStatus.NOT_FOUND)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "image/png")
        self.send_header("Cache-Control", "max-age=3600")
        self.send_header("Content-Length", str(len(png)))
        self.end_headers()
        self.wfile.write(png)

    def do_POST(self):
        if self.path != "/cmd":
            return self.send_error(HTTPStatus.NOT_FOUND)
        try:
            n = int(self.headers.get("Content-Length", "0"))
            cmd = sanitize(json.loads(self.rfile.read(min(n, 10_000)) or b"{}"))
        except (ValueError, TypeError) as e:
            return self._json({"ok": False, "error": str(e)}, HTTPStatus.BAD_REQUEST)
        self._json(send_command(cmd))

    def _file(self, name, ctype):
        try:
            with open(os.path.join(WEB_DIR, name), "rb") as f:
                body = f.read()
        except FileNotFoundError:
            return self.send_error(HTTPStatus.NOT_FOUND)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _events(self):
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        sent = {"world": None, "live": None, "status": None, "net": None, "versions": None}

        def emit(event, data):
            self.wfile.write(f"event: {event}\ndata: {json.dumps(data)}\n\n".encode())

        try:
            seen = -1
            while True:
                with STATE.cond:
                    if STATE.version == seen:
                        STATE.cond.wait(HEARTBEAT)
                    seen = STATE.version
                    world, live, status, net = STATE.world, STATE.live, STATE.status, STATE.netmeta
                    versions = STATE.versions
                changed = False
                # "net" carries only a version notice; the client fetches /net for the tiles
                for name, obj in (("world", world), ("status", status), ("net", net), ("versions", versions or None),
                                  ("live", live)):
                    if obj is not None and obj is not sent[name]:
                        emit(name, obj)
                        sent[name] = obj
                        changed = True
                if not changed:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            return


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        # a phone locking its screen or switching Wi-Fi drops the connection: not worth a traceback
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionResetError, BrokenPipeError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def lan_addresses():
    addrs = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # no packet is sent; picks the outgoing interface
        addrs.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    host = socket.gethostname()
    if host and not host.endswith(".local"):
        host += ".local"
    return addrs, host


VERSION = "1.1.2"


def fail(msg):
    """Print a problem and, for the double-clicked program on Windows, keep the window open."""
    print("\n" + msg, file=sys.stderr)
    if FROZEN or os.environ.get("TF3MAP_PAUSE"):
        try:
            input("\nPress Enter to close...")
        except EOFError:
            pass
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--bind", default="0.0.0.0", help="127.0.0.1 = only this computer")
    ap.add_argument("--userdata", help="the game's save folder <Steam>/userdata/<id>/3493540/local (auto-detected)")
    ap.add_argument("--game", help="the game's install folder, for cargo icons (auto-detected)")
    args = ap.parse_args()
    try:   # show every line at once, also when the output is not a terminal
        sys.stdout.reconfigure(line_buffering=True)
    except (AttributeError, ValueError):
        pass
    if args.userdata:
        os.environ["TF3_USERDATA"] = args.userdata
    if args.game:
        os.environ["TF3_GAME"] = args.game

    print(f"TF3 Minimap companion {VERSION}")
    try:
        print("Game save folder:", probe.find_userdata())
    except probe.UserdataNotFound as e:
        fail(str(e))
    print("Game folder (cargo icons):", find_game_dir() or "not found - the map works, cargo icons are plain dots")
    try:
        make_map_files_writable()
    except Exception as e:  # never let this stop the companion
        print("read-only check:", e, file=sys.stderr)
    threading.Thread(target=STATE.poll_forever, daemon=True).start()

    try:
        srv = Server((args.bind, args.port), Handler)
    except OSError as e:
        fail(f"Cannot open port {args.port} ({e}).\n"
             f"Is the companion already running? Close the other window, or start with --port {args.port + 1}.")
    addrs, host = lan_addresses()
    print("\nOpen the map in a browser:")
    print(f"  on this computer (e.g. a second monitor):  http://localhost:{args.port}")
    print("  on a phone or tablet in the same Wi-Fi:")
    for a in addrs:
        print(f"    http://{a}:{args.port}")
    print(f"    http://{host}:{args.port}\n")
    print("Keep this window open while you play. Ctrl+C or closing the window stops it.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()

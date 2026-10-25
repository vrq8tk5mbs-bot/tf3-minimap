-- TF3 Minimap Companion — bridge between the game and an external app.
--
-- Files in <userdata>/towns_industries/ (one of the folders app.saveUserdata accepts):
--   tf3map_live.lua   game -> app, ~2x per second: camera, sequence number, timestamp
--   tf3map_world.lua  game -> app, every ~10 s: map size, towns, industries
--   tf3map_net.lua    game -> app: manifest of the street/track network (tiles, templates, stats)
--   tf3map_net_<tx>_<ty>.lua  game -> app: edges of one 4x4 km tile (rewritten only when it changes)
--   tf3map_cmd.lua    app -> game: { seq = N, action = "jump", x =, y =, [z =], [dist =] } or { seq = N, action = "focus", entity = E }
--   tf3map_ack.lua    game -> app: result of the last executed command
--   tf3map_status.lua game -> app: which data sources work (written once at startup)
--
-- Everything is wrapped in pcall: a broken data source must never break the game.
-- The network export is time-sliced: it never spends more than NET_BUDGET of wall time per frame.

local DIR = "towns_industries"
local PREFIX = "tf3map_"

local LIVE_INTERVAL = 0.1   -- camera marker on the phone; the file is ~200 bytes
local WORLD_INTERVAL = 10.0
local CMD_INTERVAL = 0.25
local NET_SCAN_INTERVAL = 4.0
local NET_BUDGET = 0.003   -- seconds of wall time per frame for network work
local NET_TILE = 4000      -- metres

local S = {
	initialized = false,
	calls = 0,
	tLive = -1e9,
	tWorld = -1e9,
	tCmd = -1e9,
	liveSeq = 0,
	worldSeq = 0,
	lastCmdSeq = 0,
	warned = {},
	status = {},
}

---------------------------------------------------------------------------
-- helpers

-- Warnings go to the game console and into tf3map_status.lua, so they can be read without the console.
local function warnOnce(key, msg)
	if not S.warned[key] then
		S.warned[key] = true
		debugPrint({ tf3map_warning = key, message = tostring(msg) })
		S.status.warnings = S.status.warnings or {}
		S.status.warnings[key] = string.sub(tostring(msg), 1, 300)
		pcall(app.saveUserdata, "towns_industries", "tf3map_status", S.status)
	end
end

-- Clock.
-- os.clock() is process CPU time: in a busy multi-threaded game it runs several times faster
-- than wall time (measured ~3x on a Mac), in an idle/paused process much slower. So wall time
-- (os.time(), 1 s resolution) is the base; os.clock(), divided by a calibrated ratio, only
-- interpolates inside the second, and the result is clamped to within 1 s of wall time.
local C = {
	ok = nil,          -- os.clock usable?
	ratio = 1.0,       -- cpu seconds per wall second
	calibrated = false,
	lastClk = nil,     -- os.clock at previous now() call
	vt = 0,            -- virtual wall seconds
	sec0 = nil,        -- os.time() at the first call
	secPrev = nil,     -- os.time() at previous call
	bSec = nil, bClk = nil, -- last second boundary used as calibration anchor
}

local function rawClock()
	if C.ok == nil then
		local ok, v = pcall(function() return os.clock() end)
		C.ok = ok and type(v) == "number"
		S.status.clock = C.ok and "os.clock/calibrated" or "call_counter"
	end
	if C.ok then return os.clock() end
	return S.calls / 60.0
end

local function osTime()
	local ok, sec = pcall(function() return os.time() end)
	if ok and type(sec) == "number" then return sec end
	return nil
end

local function calibrate(clk, sec)
	if C.secPrev ~= nil and sec ~= C.secPrev then
		-- we are just past a second boundary
		if C.bSec == nil then
			C.bSec, C.bClk = sec, clk
		elseif sec - C.bSec >= 5 then
			local r = (clk - C.bClk) / (sec - C.bSec)
			if r > 1e-4 and r < 64 then
				C.ratio = C.calibrated and (C.ratio * 0.6 + r * 0.4) or r
				C.calibrated = true
			end
			C.bSec, C.bClk = sec, clk
		end
	end
	C.secPrev = sec
end

-- Seconds of (approximate) wall time since start; monotonic.
local function now()
	local clk = rawClock()
	local sec = C.ok and osTime() or nil
	if sec then calibrate(clk, sec) end
	if C.lastClk ~= nil then
		local d = clk - C.lastClk
		if d > 0 then C.vt = C.vt + d / C.ratio end
	end
	C.lastClk = clk
	if sec then
		if C.sec0 == nil then C.sec0 = sec end
		local wall = sec - C.sec0
		if C.vt < wall - 1 then C.vt = wall - 1 elseif C.vt > wall + 1 then C.vt = wall + 1 end
	end
	return C.vt
end

-- CPU seconds per wall second while our own thread is busy: never below 1, because the
-- thread running this script alone advances os.clock at least at wall speed.
local function busyRatio() return C.ratio > 1 and C.ratio or 1 end

-- Deadline helper for time-sliced work: returns a function that is true while budget remains.
local function budget(seconds)
	if not C.ok then
		local n = 0
		return function() n = n + 1; return n < 400 end
	end
	local limit = os.clock() + seconds * busyRatio()
	return function() return os.clock() < limit end
end

-- Approximate wall milliseconds spent since c0 (an os.clock value); exact upper bound while ratio <= 1.
local function cpuMs(c0)
	if not C.ok then return nil end
	return math.floor((os.clock() - c0) / busyRatio() * 10000 + 0.5) / 10
end

local function wallTime()
	local ok, v = pcall(function() return os.time() end)
	if ok then return v end
	return nil
end

local function save(name, tbl)
	local ok, err = pcall(app.saveUserdata, DIR, PREFIX .. name, tbl)
	if not ok then warnOnce("save_" .. name, err) end
	return ok
end

local function readFile(name)
	local ok, res = pcall(app.loadUserdata, DIR, PREFIX .. name)
	if ok and type(res) == "table" then return res end
	return nil
end

local function round(v, digits)
	if type(v) ~= "number" then return nil end
	local m = 10 ^ (digits or 1)
	return math.floor(v * m + 0.5) / m
end

-- Component type enum. The TF3 docs place it at api.engine.ComponentType, but in the
-- GUI state it lives at api.type.ComponentType (as in TF2). Try both.
local CT = nil
local function resolveComponentTypes()
	if CT then return CT end
	local candidates = {
		{ "api.type.ComponentType", function() return api.type.ComponentType end },
		{ "api.engine.ComponentType", function() return api.engine.ComponentType end },
	}
	for _, c in ipairs(candidates) do
		local ok, v = pcall(c[2])
		if ok and v ~= nil then
			CT = v
			S.status.componentTypes = c[1]
			return CT
		end
	end
	S.status.componentTypes = "missing"
	return nil
end

-- Value of one component type, looked up in every enum table that exists: the GUI-state
-- table may lack some entries (e.g. BASE_EDGE) that the other one has.
local ctCache = {}
local function ctValue(ctName)
	local v = ctCache[ctName]
	if v ~= nil then return v or nil end
	local sources = {
		function() return api.type.ComponentType[ctName] end,
		function() return api.engine.ComponentType[ctName] end,
	}
	for _, f in ipairs(sources) do
		local ok, r = pcall(f)
		if ok and r ~= nil then
			ctCache[ctName] = r
			return r
		end
	end
	ctCache[ctName] = false
	return nil
end

local function getComp(entity, ctName)
	local ct = ctValue(ctName)
	if ct == nil then return nil end
	local ok, c = pcall(api.engine.getComponent, entity, ct)
	if ok then return c end
	return nil
end

local function entityName(entity)
	local n = getComp(entity, "NAME")
	if n and n.name then return n.name end
	return nil
end

local function listEntities(ctName)
	if not resolveComponentTypes() then
		warnOnce("component_types", "neither api.type.ComponentType nor api.engine.ComponentType exists")
		return {}
	end
	local ct = ctValue(ctName)
	if ct == nil then
		warnOnce("ct_" .. ctName, "component type " .. ctName .. " not found in any enum table")
		return {}
	end
	local ok, list = pcall(api.engine.getEntitiesWithComponent, ct)
	if ok and type(list) == "table" then return list end
	warnOnce("list_" .. ctName, ok and ("not a table: " .. type(list)) or list)
	return {}
end

-- Copy of a Lua table or engine vector (userdata with # and [i]) into a plain array.
local function toArray(v, out, seen)
	out = out or {}
	if type(v) == "table" then
		for _, e in ipairs(v) do
			if not (seen and seen[e]) then
				if seen then seen[e] = true end
				out[#out + 1] = e
			end
		end
	elseif type(v) == "userdata" then
		local n = #v
		for i = 1, n do
			local e = v[i]
			if not (seen and seen[e]) then
				if seen then seen[e] = true end
				out[#out + 1] = e
			end
		end
	end
	return out
end

-- Enum lookup (api.type.enum.X in TF2 style; the TF3 defs call the record Enum).
local function resolveEnum(name)
	local candidates = {
		{ "api.type.enum." .. name, function() return api.type.enum[name] end },
		{ "api.type.Enum." .. name, function() return api.type.Enum[name] end },
		{ "api.type." .. name, function() return api.type[name] end },
	}
	for _, c in ipairs(candidates) do
		local ok, v = pcall(c[2])
		if ok and v ~= nil then return v, c[1] end
	end
	return nil, "missing"
end

---------------------------------------------------------------------------
-- town util from the base game (positions, names, sizes)

local townUtil = nil
local function getTownUtil()
	if townUtil == nil then
		townUtil = false
		local paths = { "::/game_mechanics/towns/town_util.tl", "/game_mechanics/towns/town_util.tl" }
		for _, p in ipairs(paths) do
			local ok, m = pcall(ug_require, p)
			if ok and type(m) == "table" then
				townUtil = m
				S.status.townUtil = p
				break
			else
				S.status["townUtilError_" .. p] = tostring(m)
			end
		end
	end
	return townUtil or nil
end

---------------------------------------------------------------------------
-- camera

local function readCamera()
	local cam = api.gui.camera
	local out = {}
	local ok, c = pcall(cam.getCenter)
	if ok and c then
		out.x, out.y, out.z = round(c.x, 1), round(c.y, 1), round(c.z, 1)
	else
		warnOnce("camera_center", c)
	end
	local okE, e = pcall(cam.getEye)
	if okE and e then
		out.ex, out.ey, out.ez = round(e.x, 1), round(e.y, 1), round(e.z, 1)
	end
	local okH, h = pcall(cam.getHeightAboveTerrain)
	if okH and type(h) == "number" then out.h = round(h, 1) end
	return out
end

---------------------------------------------------------------------------
-- world export

local function readTerrain()
	local terrains = listEntities("TERRAIN")
	local e = terrains[1]
	if not e then return nil end
	local t = getComp(e, "TERRAIN")
	if not t then return nil end
	local out = {}
	pcall(function()
		out.sizeX, out.sizeY = t.size.x, t.size.y
	end)
	pcall(function()
		out.resX, out.resY, out.resZ = t.baseResolution.x, t.baseResolution.y, t.baseResolution.z
	end)
	pcall(function() out.waterLevel = t.waterLevel end)
	pcall(function() out.offsetZ = t.offsetZ end)
	return out
end

local function readTowns()
	local towns = {}
	local tu = getTownUtil()
	local positions = nil
	if tu and tu.getTownsToPositions then
		local ok, p = pcall(tu.getTownsToPositions)
		if ok and type(p) == "table" then positions = p else warnOnce("town_positions", p) end
	end
	for _, e in ipairs(listEntities("TOWN")) do
		local town = { id = e, name = entityName(e) }
		if tu and tu.getTownName and not town.name then
			local ok, n = pcall(tu.getTownName, e)
			if ok then town.name = n end
		end
		if tu and tu.getTownSize then
			local ok, s = pcall(tu.getTownSize, e)
			if ok then town.size = s end
		end
		local p = positions and positions[e]
		if p then
			town.x, town.y = round(p.x, 1), round(p.y, 1)
		end
		towns[#towns + 1] = town
	end
	S.status.townsWithPosition = positions ~= nil
	return towns
end

-- What an industry accepts and produces (cargo type ids), from its stock list rules.
-- Rules only change with the level, so the answer is cached per industry and level.
local IOCACHE = {}
local function industryIO(e, comp)
	local c = IOCACHE[e]
	if c and c.level == comp.level then return c end
	c = { level = comp.level, inp = {}, out = {} }
	local ok, err = pcall(function()
		local io = api.engine.util.stock.getInputsOutputsFromRules(comp.stockList)
		c.inp = toArray(io[1])
		c.out = toArray(io[2])
	end)
	if not ok then warnOnce("industry_io", err) end
	IOCACHE[e] = c
	return c
end

local function readIndustries()
	local list = {}
	for _, e in ipairs(listEntities("INDUSTRY")) do
		local ind = { id = e, name = entityName(e) }
		local comp = getComp(e, "INDUSTRY")
		if comp then
			ind.level = comp.level
			local io = industryIO(e, comp)
			ind.inp, ind.out = io.inp, io.out
			local con = comp.construction and getComp(comp.construction, "CONSTRUCTION")
			if con then
				pcall(function() ind.type = con.fileName end)
				local ok = pcall(function()
					local t = con.transf
					ind.x, ind.y = round(t[13], 1), round(t[14], 1)
				end)
				if not ok then warnOnce("industry_transf", "cannot index Mat4f") end
				if not ind.name then ind.name = entityName(comp.construction) end
			end
		end
		list[#list + 1] = ind
	end
	return list
end

local function exportWorld()
	S.worldSeq = S.worldSeq + 1
	local world = {
		seq = S.worldSeq,
		t = wallTime(),
		terrain = readTerrain(),
		towns = readTowns(),
		industries = readIndustries(),
	}
	save("world", world)
end

local function exportLive()
	S.liveSeq = S.liveSeq + 1
	save("live", {
		seq = S.liveSeq,
		t = wallTime(),
		camera = readCamera(),
		lastCmdSeq = S.lastCmdSeq,
	})
end

---------------------------------------------------------------------------
-- network export (streets + tracks)
--
-- Edge string, fields separated by ",", edges by ";":
--   kind, tpl, z, x0, y0, x1, y1 [, ax, ay, bx, by]
--   kind: r = track, s = street, u = unknown;  tpl: index into manifest.templates (1-based)
--   z: 0 normal, 1 bridge, 2 tunnel;  a/b: cubic Bezier control points (omitted when straight)
-- Coordinates are whole metres.
-- A track edge with signals is followed by one entry per signal (5 fields, so companions before 1.3 skip them):
--   g<type>[r], x, y, hx, hy
--   type: the game's Signal.Type value (SIGNAL, ONE_WAY_SIGNAL, WAYPOINT);  r: the signal's edgePr flag was true
--   x, y: position;  hx, hy: direction trains pass the signal in, unit vector x100

local N = {
	phase = "idle",       -- idle -> scan -> sweep -> write -> idle
	interval = NET_SCAN_INTERVAL,
	listSource = nil,
	tScan = -1e9,
	session = nil,
	seq = 0,              -- bumped on every manifest write
	edges = {},           -- id -> { tile = key, s = string } | false (unreadable)
	tiles = {},           -- key -> { ids = {id = true}, n = count, seq = n }
	dirty = {},           -- key -> true
	templates = {},       -- index -> name
	tplIndex = {},        -- name -> index
	list = nil, i = 1, seen = nil, sweepKey = nil,
	dirtyList = nil, di = 1,
	enum = nil,
	stats = { scans = 0 },
	scanC0 = 0, scanCpu = 0, readCount = 0, failed = 0,
}

local function netEnums()
	if N.enum then return N.enum end
	local rt, rtSrc = resolveEnum("RoadType")
	local et, etSrc = resolveEnum("BaseEdgeType")
	local ot, otSrc = resolveEnum("EdgeObjectType")
	N.enum = {
		track = rt and rt.TRACK, street = rt and rt.STREET,
		bridge = et and et.BRIDGE, tunnel = et and et.TUNNEL,
		signalObj = ot and ot.SIGNAL,
	}
	N.stats.edgeObjectTypeEnum = otSrc
	N.stats.signalObjValue = ot and tostring(ot.SIGNAL) or nil
	-- the signal type values (Signal.Type in the docs), to read the "g<type>" entries right
	pcall(function()
		local cands = {
			{ "api.type.Signal.Type", function() return api.type.Signal.Type end },
			{ "api.type.enum.SignalType", function() return api.type.enum.SignalType end },
			{ "api.type.enum.Signal", function() return api.type.enum.Signal end },
		}
		for _, c in ipairs(cands) do
			local ok, v = pcall(c[2])
			if ok and v ~= nil then
				local d = {}
				for _, k in ipairs({ "SIGNAL", "ONE_WAY_SIGNAL", "WAYPOINT", "PATH_SIGNAL", "ONE_WAY_PATH_SIGNAL" }) do
					local okK, x = pcall(function() return v[k] end)
					if okK and x ~= nil then d[k] = tostring(x) end
				end
				N.stats["enum_" .. c[1]:gsub("%.", "_")] = d
			end
		end
	end)
	N.stats.roadTypeEnum = rtSrc
	N.stats.edgeTypeEnum = etSrc
	return N.enum
end

local function tileKey(x, y)
	local tx, ty = math.floor(x / NET_TILE), math.floor(y / NET_TILE)
	local function enc(v) return v < 0 and ("m" .. (-v)) or tostring(v) end
	return enc(tx) .. "_" .. enc(ty)
end

local function tplOf(name)
	local i = N.tplIndex[name]
	if not i then
		i = #N.templates + 1
		N.templates[i] = name
		N.tplIndex[name] = i
	end
	return i
end

local function f0(v) return string.format("%.0f", v) end

-- Point and direction on a base edge (cubic Hermite from its end positions and tangents) at u in 0..1.
local function edgeAt(p0, p1, t0, t1, u)
	if not (t0 and t1) then
		return p0.x + (p1.x - p0.x) * u, p0.y + (p1.y - p0.y) * u, p1.x - p0.x, p1.y - p0.y
	end
	local u2, u3 = u * u, u * u * u
	local h00, h10, h01, h11 = 2 * u3 - 3 * u2 + 1, u3 - 2 * u2 + u, -2 * u3 + 3 * u2, u3 - u2
	local d00, d10, d01, d11 = 6 * u2 - 6 * u, 3 * u2 - 4 * u + 1, -6 * u2 + 6 * u, 3 * u2 - 2 * u
	return h00 * p0.x + h10 * t0.x + h01 * p1.x + h11 * t1.x,
		h00 * p0.y + h10 * t0.y + h01 * p1.y + h11 * t1.y,
		d00 * p0.x + d10 * t0.x + d01 * p1.x + d11 * t1.x,
		d00 * p0.y + d10 * t0.y + d01 * p1.y + d11 * t1.y
end

-- Direction of one lane (transport network edge) of a base edge, from its geometry.
local function laneDir(eid)
	local tn = getComp(eid.entity, "TRANSPORT_NETWORK")
	if not tn then return nil end
	local g = tn.edges[eid.index + 1].geometry
	local calc = api.engine.util.transport.calcPosition
	local a, b = calc(g, 0), calc(g, 1)
	if not (a and b) then return nil end
	return b.x - a.x, b.y - a.y
end

local function pairPart(pr, i)
	if pr == nil then return nil end
	local ok, v = pcall(function() return pr[i] end)
	if ok and v ~= nil then return v end
	ok, v = pcall(function() return i == 1 and pr.first or pr.second end)
	if ok then return v end
	return nil
end

-- Signals on a track edge, as signal entries of the network export (see above). Each signal sits on one
-- lane of the edge; it applies to trains running along that lane, or against it when edgePr's flag is set.
local SIGDIAG = 0
local function readSignals(e, en)
	local objs = toArray(e.objects)
	if #objs == 0 then return nil end
	local out = {}
	for _, o in ipairs(objs) do
		local ent, typ = pairPart(o, 1), pairPart(o, 2)
		if ent ~= nil and (en.signalObj == nil or typ == en.signalObj) then
			local sl = getComp(ent, "SIGNAL_LIST")
			if sl then
				local eo = getComp(ent, "EDGE_OBJECT")
				local u = eo and tonumber(eo.param) or 0.5
				local x, y, tx, ty = edgeAt(e.position0, e.position1, e.tangent0, e.tangent1, u)
				for _, sg in ipairs(toArray(sl.signals)) do
					local pr = sg.edgePr
					local eid, rev = pairPart(pr, 1), pairPart(pr, 2)
					local okL, lx, ly = pcall(laneDir, eid)
					local hx, hy = tx, ty
					if okL and lx then
						if lx * tx + ly * ty < 0 then hx, hy = -tx, -ty end   -- the lane runs node1 -> node0
					end
					if rev == true then hx, hy = -hx, -hy end
					local len = math.sqrt(hx * hx + hy * hy)
					if len > 0 then hx, hy = hx / len, hy / len end
					local tnum = tonumber(sg.type)
					out[#out + 1] = "g" .. (tnum or tostring(sg.type)) .. (rev == true and "r" or "") .. ","
						.. f0(x) .. "," .. f0(y) .. "," .. f0(hx * 100) .. "," .. f0(hy * 100)
					N.stats.signalsRead = (N.stats.signalsRead or 0) + 1
					if SIGDIAG < 3 then
						-- what the first signals look like, for checking the API against the docs
						SIGDIAG = SIGDIAG + 1
						N.stats["signalSample" .. SIGDIAG] = {
							objType = tostring(typ), type = tostring(sg.type), rev = tostring(rev),
							edgePr = type(pr), eid = eid and (tostring(eid.entity) .. ":" .. tostring(eid.index)) or "nil",
							lane = okL and (lx and (f0(lx) .. "," .. f0(ly)) or "nil") or ("error: " .. tostring(lx)),
							tangent = f0(tx) .. "," .. f0(ty), param = tostring(eo and eo.param),
						}
					end
				end
			end
		end
	end
	if #out == 0 then return nil end
	return table.concat(out, ";")
end

local function readEdge(id)
	local e = getComp(id, "BASE_EDGE")
	if not e then return false end
	local en = netEnums()
	local p0, p1, t0, t1 = e.position0, e.position1, e.tangent0, e.tangent1
	-- TF2-style fallback: positions live on the end nodes
	if p0 == nil and e.node0 then
		local n0 = getComp(e.node0, "BASE_NODE")
		p0 = n0 and n0.position
	end
	if p1 == nil and e.node1 then
		local n1 = getComp(e.node1, "BASE_NODE")
		p1 = n1 and n1.position
	end
	if p0 == nil or p1 == nil then return false end
	local x0, y0, x1, y1 = p0.x, p0.y, p1.x, p1.y

	local rt = e.roadType
	local tname = e.roadTemplate
	if type(tname) ~= "string" or tname == "" then
		tname = tostring(rt) .. ":" .. tostring(e.typeIndex)
	end
	local kind = "u"
	if en.track ~= nil and rt == en.track then kind = "r"
	elseif en.street ~= nil and rt == en.street then kind = "s"
	else
		local low = string.lower(tname)
		if low:find("track", 1, true) or low:find("rail", 1, true) then kind = "r"
		elseif low:find("street", 1, true) or low:find("road", 1, true) then kind = "s" end
	end
	if N.stats.sampleRoadType == nil then
		N.stats.sampleRoadType = tostring(rt)
		N.stats.sampleTemplate = tname
	end

	local z = 0
	local et = e.type
	if en.tunnel ~= nil and et == en.tunnel then z = 2
	elseif en.bridge ~= nil and et == en.bridge then z = 1 end

	local s = kind .. "," .. tplOf(tname) .. "," .. z .. "," .. f0(x0) .. "," .. f0(y0) .. "," .. f0(x1) .. "," .. f0(y1)

	-- Hermite -> Bezier; skip control points when the edge is (nearly) straight.
	local dx, dy = x1 - x0, y1 - y0
	local len = math.sqrt(dx * dx + dy * dy)
	if t0 and t1 and len > 1 then
		local ax, ay = x0 + t0.x / 3, y0 + t0.y / 3
		local bx, by = x1 - t1.x / 3, y1 - t1.y / 3
		-- distance of control points from the chord
		local da = math.abs((ax - x0) * dy - (ay - y0) * dx) / len
		local db = math.abs((bx - x0) * dy - (by - y0) * dx) / len
		if da > 1.5 or db > 1.5 then
			s = s .. "," .. f0(ax) .. "," .. f0(ay) .. "," .. f0(bx) .. "," .. f0(by)
		end
	end
	if kind == "r" then
		local okS, sig = pcall(readSignals, e, en)
		if okS then
			if sig then s = s .. ";" .. sig end
		else
			warnOnce("read_signals", sig)
		end
	end
	return { tile = tileKey((x0 + x1) / 2, (y0 + y1) / 2), s = s }
end

-- All base edge entities. Primary: entities with the BASE_EDGE component. Fallback (when that
-- comes back empty, as seen in the TF3 GUI state): every segment of every node from the street system.
local function listEdges()
	if N.listSource ~= "streetSystem" then
		local l = listEntities("BASE_EDGE")
		if #l > 0 then
			N.listSource = "entities"
			return l
		end
	end
	local ok, res = pcall(function()
		local map = api.engine.system.streetSystem.getNode2SegmentMap()
		local out, seen, nodes = {}, {}, 0
		for _, segs in pairs(map) do
			nodes = nodes + 1
			toArray(segs, out, seen)
		end
		N.stats.nodes = nodes
		return out
	end)
	if ok and type(res) == "table" then
		if #res > 0 then N.listSource = "streetSystem" end
		return res
	end
	warnOnce("node2segment", res)
	return {}
end

local function tileAdd(key, id)
	local t = N.tiles[key]
	if not t then
		t = { ids = {}, n = 0, seq = 0 }
		N.tiles[key] = t
	end
	if not t.ids[id] then
		t.ids[id] = true
		t.n = t.n + 1
		N.dirty[key] = true
	end
end

local function tileRemove(key, id)
	local t = N.tiles[key]
	if t and t.ids[id] then
		t.ids[id] = nil
		t.n = t.n - 1
		N.dirty[key] = true
	end
end

local function writeManifest()
	N.seq = N.seq + 1
	local tiles = {}
	local total = 0
	for key, t in pairs(N.tiles) do
		if t.n > 0 then
			tiles[key] = { seq = t.seq, n = t.n }
			total = total + t.n
		end
	end
	N.stats.edges = total
	N.stats.failed = N.failed
	N.stats.ratio = round(C.ratio, 2)
	save("net", {
		session = N.session,
		seq = N.seq,
		tile = NET_TILE,
		tiles = tiles,
		templates = N.templates,
		stats = N.stats,
		t = wallTime(),
	})
end

local function writeTile(key)
	local t = N.tiles[key]
	if not t then return end
	local parts = {}
	for id in pairs(t.ids) do
		local e = N.edges[id]
		if e then parts[#parts + 1] = e.s end
	end
	t.seq = N.seq + 1   -- the manifest written after this batch carries seq + 1
	save("net_" .. key, { session = N.session, seq = t.seq, key = key, n = #parts, edges = table.concat(parts, ";") })
	if t.n <= 0 then N.tiles[key] = nil end
end

-- One slice of network work. Called every frame; returns quickly when idle.
local function netStep(t)
	if N.phase == "idle" then
		if t - N.tScan < N.interval then return end
		N.tScan = t
		local c0 = C.ok and os.clock() or 0
		N.list = listEdges()
		N.stats.listMs = cpuMs(c0)
		N.stats.listed = #N.list
		N.stats.listSource = N.listSource
		-- one listing is a single unsliced call: scan less often when it is expensive
		local ms = N.stats.listMs or 0
		N.interval = math.min(30, math.max(NET_SCAN_INTERVAL, ms * 0.4))
		N.stats.interval = round(N.interval, 1)
		N.i, N.seen = 1, {}
		N.scanC0 = c0
		N.readCount = 0
		N.phase = "scan"
		return
	end

	local more = budget(NET_BUDGET)
	local c0 = C.ok and os.clock() or 0
	local phase = N.phase

	if N.phase == "scan" then
		local list, edges, seen = N.list, N.edges, N.seen
		local i, n = N.i, #list
		local k = 0
		while i <= n do
			local id = list[i]
			seen[id] = true
			if edges[id] == nil then
				local ok, rec = pcall(readEdge, id)
				if not ok then
					warnOnce("read_edge", rec)
					rec = false
				end
				edges[id] = rec
				if rec then tileAdd(rec.tile, id) else N.failed = N.failed + 1 end
				N.readCount = N.readCount + 1
			end
			i = i + 1
			k = k + 1
			if k % 4 == 0 and not more() then break end
		end
		N.i = i
		if i > n then
			N.phase = "sweep"
			N.sweepKey = nil
			N.list = nil
		end
	elseif N.phase == "sweep" then
		local edges, seen = N.edges, N.seen
		local key = N.sweepKey
		local k = 0
		while true do
			local id, rec = next(edges, key)
			if id == nil then key = nil; break end
			if not seen[id] then
				if rec then tileRemove(rec.tile, id) end
				edges[id] = nil   -- clearing the current field is allowed during next()
			end
			key = id
			k = k + 1
			if k % 32 == 0 and not more() then break end
		end
		N.sweepKey = key
		if key == nil then
			N.seen = nil
			N.dirtyList = {}
			for dk in pairs(N.dirty) do N.dirtyList[#N.dirtyList + 1] = dk end
			N.dirty = {}
			N.di = 1
			N.phase = "write"
		end
	elseif N.phase == "write" then
		local dl = N.dirtyList
		while N.di <= #dl do
			writeTile(dl[N.di])
			N.di = N.di + 1
			if not more() then break end
		end
		if N.di > #dl then
			N.stats.scans = N.stats.scans + 1
			N.stats.lastRead = N.readCount
			N.stats.lastTilesWritten = #dl
			-- rewrite the manifest when tiles changed, and every 8th scan so its stats stay fresh
			if #dl > 0 or N.seq == 0 or N.stats.scans % 8 == 0 then writeManifest() end
			N.dirtyList = nil
			N.phase = "idle"
		end
	end

	-- accumulate cost of this slice; report the worst slice so we can see frame impact
	local ms = cpuMs(c0)
	if ms then
		local key = "max_" .. phase .. "_ms"
		if ms > (N.stats[key] or 0) then N.stats[key] = ms end
	end
end

---------------------------------------------------------------------------
-- time-sliced jobs (lines, stations, vehicles, towns, grids, flows)
--
-- Each job is a coroutine. Work items run inside pcall; the coroutine yields only *between*
-- items (never inside pcall), so this also works on Lua 5.1/LuaJIT. Jobs share JOB_BUDGET per
-- frame and run only in frames where the network export is idle.

local JOB_BUDGET = 0.0025
local J = { list = {}, byName = {}, more = function() return true end, rr = 1, stats = {} }

local function Y()
	if not J.more() then coroutine.yield() end
end

local function addJob(name, interval, fn, delay)
	local job = { name = name, interval = interval, fn = fn, tNext = delay or 0, co = nil, runs = 0 }
	J.list[#J.list + 1] = job
	J.byName[name] = job
	return job
end

local function kickJob(name)
	local job = J.byName[name]
	if job and not job.co then job.tNext = 0 end
end

local function runJobs(t)
	J.more = budget(JOB_BUDGET)
	local n = #J.list
	for _ = 1, n do
		if not J.more() then return end
		local job = J.list[J.rr]
		J.rr = J.rr % n + 1
		if job.co or t >= job.tNext then
			if not job.co then
				job.co = coroutine.create(job.fn)
				job.cpu = 0
			end
			local c0 = C.ok and os.clock() or 0
			local ok, err = coroutine.resume(job.co)
			job.cpu = job.cpu + ((C.ok and os.clock() or 0) - c0)
			if not ok then
				warnOnce("job_" .. job.name, err)
				job.co = nil
				job.tNext = t + job.interval * 3
			elseif coroutine.status(job.co) == "dead" then
				job.co = nil
				job.runs = job.runs + 1
				job.tNext = t + job.interval
				J.stats[job.name] = { runs = job.runs, cpuMs = round(job.cpu / busyRatio() * 1000, 1) }
			end
		end
	end
end

-- Protected call that records the first error per key and returns nil on failure.
local function try(key, f, ...)
	local ok, r = pcall(f, ...)
	if ok then return r end
	warnOnce(key, r)
	return nil
end

-- Reverse lookup of an engine enum value -> name, using a list of known names.
local enumCache = {}
local function enumName(enumKey, value, names)
	local rev = enumCache[enumKey]
	if not rev then
		rev = {}
		local tbl = resolveEnum(enumKey)
		if tbl then
			for _, nm in ipairs(names) do
				local ok, v = pcall(function() return tbl[nm] end)
				if ok and v ~= nil then rev[tostring(v)] = nm end
			end
		end
		enumCache[enumKey] = rev
	end
	return rev[tostring(value)] or tostring(value)
end

local MODE_NAMES = { "PERSON", "CARGO", "CAR", "BUS", "TRUCK", "TRAM", "ELECTRIC_TRAM", "TRAIN", "ELECTRIC_TRAIN",
	"AIRCRAFT", "SHIP", "SMALL_AIRCRAFT", "SMALL_SHIP", "HELICOPTER" }
local CARRIER_NAMES = { "ROAD", "RAIL", "TRAM", "OTHER", "AIR", "WATER" }
local NO_PATHFINDING = { AIRCRAFT = true, SMALL_AIRCRAFT = true, HELICOPTER = true, SHIP = true, SMALL_SHIP = true }

-- {TransportMode = true} (table or engine map) -> sorted list of names
local function modeNames(set)
	local out, seen = {}, {}
	if set == nil then return out end
	local ok = pcall(function()
		for k, v in pairs(set) do
			if v then
				local nm = enumName("TransportMode", k, MODE_NAMES)
				if not seen[nm] then seen[nm] = true; out[#out + 1] = nm end
			end
		end
	end)
	if not ok then
		-- engine maps that cannot be iterated: probe each known mode
		local en = resolveEnum("TransportMode")
		for _, nm in ipairs(MODE_NAMES) do
			local okP, has = pcall(function() return set[en[nm]] end)
			if okP and has then out[#out + 1] = nm end
		end
	end
	table.sort(out)
	return out
end

local function vec2(x, y) return api.type.Vec2f.new(x, y) end

local META = { passengerId = nil }

---------------------------------------------------------------------------
-- meta: cargo types (names, icons, colours), climates/biomes, terrain data maps, map bounds

local function jobMeta()
	local cargo = {}
	local rep = api.res.cargoTypeRep
	local all = try("meta_cargo_all", rep.getAll) or {}
	for id, res in pairs(all) do
		local ct = try("meta_cargo_get", rep.get, id)
		local c = { id = id, res = res }
		if ct then
			pcall(function() c.name = ct.name end)
			pcall(function() c.icon = ct.icon end)
			pcall(function() c.color = { round(ct.color.x, 3), round(ct.color.y, 3), round(ct.color.z, 3) } end)
			pcall(function() c.category = ct.category end)
		end
		cargo[#cargo + 1] = c
		if type(id) == "number" and (META.maxCargoId == nil or id > META.maxCargoId) then META.maxCargoId = id end
		Y()
	end
	META.passengerId = try("meta_passenger", rep.getPassengerCargoTypeId)

	local climates = {}
	local crep = api.res.climateRep
	for id, res in pairs(try("meta_climates", crep.getAll) or {}) do
		local cd = try("meta_climate_get", crep.get, id)
		local cl = { id = id, res = res, biomes = {}, layers = {} }
		if cd then
			pcall(function()
				for _, b in ipairs(cd.dataMaps.biomes) do
					cl.biomes[#cl.biomes + 1] = { id = b.id, key = b.key, name = b.displayName,
						color = { round(b.color.x, 3), round(b.color.y, 3), round(b.color.z, 3) } }
				end
			end)
			pcall(function()
				for _, b in ipairs(cd.dataMaps.layers) do
					cl.layers[#cl.layers + 1] = { id = b.id, key = b.key, name = b.displayName }
				end
			end)
		end
		climates[#climates + 1] = cl
		Y()
	end

	local bbox = nil
	pcall(function()
		local b = api.engine.terrain.getBoundingBox()
		bbox = { x0 = round(b.min.x, 0), y0 = round(b.min.y, 0), x1 = round(b.max.x, 0), y1 = round(b.max.y, 0) }
	end)
	local dataMaps = {}
	pcall(function()
		local te = listEntities("TERRAIN")[1]
		local tc = te and getComp(te, "TERRAIN")
		for _, dm in ipairs(tc.dataMaps) do
			local name, map = dm[1], dm[2]
			local size = nil
			pcall(function() local s = map:getSize(); size = { s.x, s.y } end)
			if not size then pcall(function() local s = map.getSize(); size = { s.x, s.y } end) end
			dataMaps[#dataMaps + 1] = { name = tostring(name), size = size }
		end
	end)
	META.bbox = bbox
	save("meta", { t = wallTime(), passengerId = META.passengerId, cargo = cargo, climates = climates,
		bbox = bbox, dataMaps = dataMaps })
end

---------------------------------------------------------------------------
-- stations: groups, stations, positions, catchment radius, cargo/passenger, carriers

local STATIONS = {}   -- station entity -> {x, y}

local function stationPos(st, sc)
	local x, y, n = 0, 0, 0
	pcall(function()
		for _, ca in ipairs(sc.catchmentAreas) do
			x, y, n = x + ca.position.x, y + ca.position.y, n + 1
		end
	end)
	if n > 0 then return x / n, y / n end
	local p = nil
	pcall(function()
		local con = api.engine.system.streetConnectorSystem.getConstructionEntityForStation(st)
		local cc = getComp(con, "CONSTRUCTION")
		p = { cc.transf[13], cc.transf[14] }
	end)
	if p then return p[1], p[2] end
	return nil, nil
end

local function jobStations()
	local groups = {}
	local util = api.engine.util
	for _, sg in ipairs(listEntities("STATION_GROUP")) do
		local g = { id = sg, name = entityName(sg), st = {} }
		local comp = getComp(sg, "STATION_GROUP")
		local stations = comp and toArray(comp.stations) or {}
		for i, st in ipairs(stations) do
			local sc = getComp(st, "STATION")
			local s = { id = st, i = i - 1 }
			if sc then
				local x, y = stationPos(st, sc)
				s.x, s.y = round(x, 0), round(y, 0)
				if x then STATIONS[st] = { x, y } end
				s.ca = {}
				pcall(function()
					for _, ca in ipairs(sc.catchmentAreas) do
						s.ca[#s.ca + 1] = { round(ca.position.x, 0), round(ca.position.y, 0), round(ca.radius, 0) }
					end
				end)
				pcall(function() s.nTerm = #sc.terminals end)
			end
			s.cargo = try("station_type", util.station.isStationOfType, st, true)
			s.pass = try("station_type", util.station.isStationOfType, st, false)
			g.st[#g.st + 1] = s
		end
		pcall(function()
			local r = api.engine.system.stationGroupSystem.getCarriers(sg, -1, -1)
			g.carriers = {}
			for _, c in ipairs(toArray(r[1])) do g.carriers[#g.carriers + 1] = enumName("Carrier", c, CARRIER_NAMES) end
		end)
		groups[#groups + 1] = g
		Y()
	end
	save("stations", { t = wallTime(), groups = groups })
end

---------------------------------------------------------------------------
-- lines: name, colour, modes, stops, vehicles, capacity usage, frequency

local LINES = {}   -- line entity -> { modes = {...}, stops = {...} }

local function jobLines()
	local out = {}
	local util = api.engine.util
	local sys = api.engine.system
	local lines = toArray(try("lines_get", sys.lineSystem.getLines) or {})
	local vmap = try("lines_vmap", sys.transportVehicleSystem.getLine2VehicleMap) or {}
	for _, l in ipairs(lines) do
		local comp = getComp(l, "LINE")
		local L = { id = l, name = entityName(l), stops = {} }
		local col = getComp(l, "COLOR")
		if col then pcall(function() L.color = { round(col.color.x, 3), round(col.color.y, 3), round(col.color.z, 3) } end) end
		L.modes = modeNames(try("line_modes", util.line.getLineTransportModesUnion, l))
		if #L.modes == 0 and comp then pcall(function() L.modes = modeNames(comp.vehicleInfo.transportModes) end) end
		if comp then
			pcall(function()
				for _, s in ipairs(comp.stops) do
					L.stops[#L.stops + 1] = { s.stationGroup, s.station, s.terminal }
				end
			end)
		end
		local veh = {}
		pcall(function() veh = toArray(vmap[l]) end)
		L.nVeh = #veh
		local carriers, seenC = {}, {}
		for k = 1, math.min(#veh, 3) do
			local tv = getComp(veh[k], "TRANSPORT_VEHICLE")
			if tv then
				local nm = enumName("Carrier", tv.carrier, CARRIER_NAMES)
				if not seenC[nm] then seenC[nm] = true; carriers[#carriers + 1] = nm end
			end
		end
		L.carriers = carriers
		local usage = try("line_usage", util.line.getLineCapacityUsages, l, true)
		L.usage = {}
		if usage then
			pcall(function()
				-- The game returns a 1-based list over every cargo type: entry k is cargo id k-1.
				-- Only entries with capacity or load are kept (the rest is every cargo the game knows).
				local entries, minKey = {}, nil
				for k, u in pairs(usage) do
					entries[#entries + 1] = { k, u }
					if type(k) == "number" and (minKey == nil or k < minKey) then minKey = k end
				end
				local shift = (minKey == 1 and META.maxCargoId ~= nil and #entries == META.maxCargoId + 1) and 1 or 0
				for _, e in ipairs(entries) do
					local cargo, u = e[1], e[2]
					if type(cargo) == "number" then cargo = cargo - shift end
					local used, cap = round(u.used or 0, 0), round(u.capacity or 0, 0)
					if cap > 0 or used > 0 then L.usage[#L.usage + 1] = { cargo, used, cap } end
					if META.passengerId ~= nil and cargo == META.passengerId then
						if cap > 0 then L.pass = true end
					elseif cap > 0 then
						L.cargo = true
					end
				end
			end)
			L.usageIds = true
		end
		L.freq = try("line_freq", util.line.getMaxFrequency, l)
		if L.freq then L.freq = round(L.freq, 2) end
		L.thr = try("line_thr", util.line.calcLineStationThroughput, l)
		pcall(function()
			local issues = util.line.getLineIssues(l, false)
			L.issues = #toArray(issues)
		end)
		LINES[l] = { modes = L.modes, stops = L.stops }
		out[#out + 1] = L
		Y()
	end
	save("lines", { t = wallTime(), passengerId = META.passengerId, lines = out })
end

---------------------------------------------------------------------------
-- line paths: real route along the network between consecutive stops (pathfinding), with length

local PATHCACHE = {}   -- key -> { t = time, len = metres, pts = {x, y, x, y, ...} }
local PATH_TTL = 300

local function terminalNode(sg, stIndex, term)
	local g = getComp(sg, "STATION_GROUP")
	local st = toArray(g.stations)[stIndex + 1]
	local sc = getComp(st, "STATION")
	return sc.terminals[term + 1].vehicleNodeId, st
end

local function edgePoints(eid, dir, tnCache, pts)
	local tn = tnCache[eid.entity]
	if tn == nil then
		tn = getComp(eid.entity, "TRANSPORT_NETWORK") or false
		tnCache[eid.entity] = tn
	end
	if not tn then return 0 end
	local e = tn.edges[eid.index + 1]
	local g = e.geometry
	local len = g.length or 0
	local ts = dir and { 0, 0.5, 1 } or { 1, 0.5, 0 }
	local calc = api.engine.util.transport.calcPosition
	for _, t in ipairs(ts) do
		local okP, p = pcall(calc, g, t)
		if okP and p then
			local n = #pts
			local px, py = p.x, p.y
			if n < 2 or (px - pts[n - 1]) ^ 2 + (py - pts[n]) ^ 2 > 400 then
				pts[n + 1], pts[n + 2] = px, py
			end
		end
	end
	return len
end

local function computeSegment(n0, n1, modeVals, tnCache)
	local path = api.engine.util.pathfinding.findPathNodeToNode({ n0 }, { n1 }, modeVals)
	local pts, len = {}, 0
	local edges = toArray(path)
	for k, step in ipairs(edges) do
		local eid, dir = step[1], step[2]
		local okE, l = pcall(edgePoints, eid, dir, tnCache, pts)
		if okE then len = len + l end
	end
	return len, pts, #edges
end

local function jobPaths(t0)
	local out = {}
	local tnCache = {}
	local modeEnum = resolveEnum("TransportMode")
	local now0 = wallTime() or 0
	for l, info in pairs(LINES) do
		local stops = info.stops
		local air = false
		for _, m in ipairs(info.modes) do if NO_PATHFINDING[m] then air = true end end
		local modeVals = {}
		for _, m in ipairs(info.modes) do
			local okV, v = pcall(function() return modeEnum[m] end)
			if okV and v ~= nil and m ~= "PERSON" and m ~= "CARGO" then modeVals[#modeVals + 1] = v end
		end
		local P = { len = 0, segs = {}, ok = 0, fail = 0 }
		local n = #stops
		for k = 1, n do
			local a, b = stops[k], stops[k % n + 1]
			if n < 2 then break end
			local key = table.concat(a, ":") .. ">" .. table.concat(b, ":") .. (air and ":air" or "")
			local c = PATHCACHE[key]
			if not c or now0 - c.t > PATH_TTL then
				c = { t = now0, len = 0, pts = {} }
				local okN, n0, st0 = pcall(terminalNode, a[1], a[2], a[3])
				local okM, n1, st1 = pcall(terminalNode, b[1], b[2], b[3])
				if not air and okN and okM and n0 and n1 then
					local okS, len, pts, ne = pcall(computeSegment, n0, n1, modeVals, tnCache)
					if okS and ne > 0 then
						c.len, c.pts, c.kind = len, pts, "path"
					else
						if not okS then warnOnce("path_segment", len) end
					end
				end
				if c.kind == nil then
					-- straight line between the two stations (aircraft, ships, or pathfinding failed)
					local s0 = okN and STATIONS[st0]
					local s1 = okM and STATIONS[st1]
					if s0 and s1 then
						c.pts = { s0[1], s0[2], s1[1], s1[2] }
						c.len = math.sqrt((s1[1] - s0[1]) ^ 2 + (s1[2] - s0[2]) ^ 2)
						c.kind = "straight"
					end
				end
				PATHCACHE[key] = c
				Y()
			end
			if c.kind == "path" then P.ok = P.ok + 1 else P.fail = P.fail + 1 end
			P.len = P.len + (c.len or 0)
			local parts = {}
			for i = 1, #c.pts, 2 do parts[#parts + 1] = string.format("%.0f,%.0f", c.pts[i], c.pts[i + 1]) end
			P.segs[#P.segs + 1] = table.concat(parts, " ")
		end
		P.len = round(P.len, 0)
		out[tostring(l)] = P
		Y()
	end
	save("paths", { t = wallTime(), paths = out })
end

---------------------------------------------------------------------------
-- vehicles: live positions of every vehicle assigned to a line

local function jobVehicles()
	local sys = api.engine.system
	local getPos = api.engine.util.vehicle.getPosition
	local vmap = try("veh_vmap", sys.transportVehicleSystem.getLine2VehicleMap) or {}
	local parts = {}
	local k = 0
	for l, vs in pairs(vmap) do
		for _, v in ipairs(toArray(vs)) do
			local okP, p = pcall(getPos, v)
			if okP and p then
				parts[#parts + 1] = string.format("%d,%d,%.0f,%.0f", v, l, p.x, p.y)
			end
			k = k + 1
			if k % 16 == 0 then Y() end
		end
	end
	save("veh", { t = wallTime(), v = table.concat(parts, ";") })
end

---------------------------------------------------------------------------
-- towns: population (district capacities), needs, stock

local function jobTowns()
	local util = api.engine.util
	local out = {}
	for _, town in ipairs(listEntities("TOWN")) do
		local T = { id = town }
		pcall(function()
			local caps = util.town.getTownCapacityUsage(town)
			T.cap = {}
			for i, c in ipairs(caps) do T.cap[i] = { c.used, c.capacity } end
		end)
		pcall(function()
			local tc = getComp(town, "TOWN")
			T.needs = {}
			local seen = {}
			for d, list in ipairs(tc.cargoNeeds) do
				for _, need in ipairs(list) do
					local cid = need[1]
					if not seen[cid] then seen[cid] = true; T.needs[#T.needs + 1] = { cid, d } end
				end
			end
		end)
		pcall(function()
			local stock = util.town.getTownStockCargo(town)
			T.stock = {}
			for cid, v in pairs(stock) do T.stock[#T.stock + 1] = { cid, v[1], v[2] } end
		end)
		out[#out + 1] = T
		Y()
	end
	save("towns", { t = wallTime(), towns = out })
end

---------------------------------------------------------------------------
-- grids: terrain (water, height, biome) every 10 min; noise + pollution every minute

local function gridSpec()
	local b = META.bbox
	if not b then
		pcall(function()
			local bb = api.engine.terrain.getBoundingBox()
			b = { x0 = bb.min.x, y0 = bb.min.y, x1 = bb.max.x, y1 = bb.max.y }
		end)
	end
	if not b then return nil end
	local w, h = b.x1 - b.x0, b.y1 - b.y0
	local cell = 64
	while (w / cell) * (h / cell) > 80000 do cell = cell * 2 end
	return { x0 = b.x0, y0 = b.y0, cell = cell, nx = math.floor(w / cell), ny = math.floor(h / cell) }
end

local HEX = {}
for i = 0, 255 do HEX[i] = string.format("%02x", i) end

local function jobTerrain()
	local g = gridSpec()
	if not g then return end
	local ter = api.engine.terrain
	local water, heights = {}, {}
	local hmin, hmax = 1e9, -1e9
	-- biome data map (first data map whose name mentions "biome")
	local biomeMap, biomeName, bsx, bsy = nil, nil, nil, nil
	pcall(function()
		local te = listEntities("TERRAIN")[1]
		local tc = getComp(te, "TERRAIN")
		for _, dm in ipairs(tc.dataMaps) do
			if string.find(string.lower(tostring(dm[1])), "biome", 1, true) then
				biomeMap, biomeName = dm[2], tostring(dm[1])
				local s = biomeMap:getSize()
				bsx, bsy = s.x, s.y
				break
			end
		end
	end)
	local biome = {}
	local k = 0
	for iy = 0, g.ny - 1 do
		for ix = 0, g.nx - 1 do
			local x, y = g.x0 + (ix + 0.5) * g.cell, g.y0 + (iy + 0.5) * g.cell
			local p = vec2(x, y)
			local okW, w = pcall(ter.isOnWater, p)
			water[#water + 1] = (okW and w) and "1" or "0"
			local okH, hv = pcall(ter.getHeightAt, p)
			hv = okH and hv or 0
			heights[#heights + 1] = hv
			if hv < hmin then hmin = hv end
			if hv > hmax then hmax = hv end
			if biomeMap then
				local okB, v = pcall(function()
					return biomeMap:at(math.floor(ix / g.nx * bsx), math.floor(iy / g.ny * bsy))
				end)
				v = okB and math.floor(v or 0) or 0
				biome[#biome + 1] = string.char(48 + math.max(0, math.min(74, v)))
			end
			k = k + 1
			if k % 32 == 0 then Y() end
		end
	end
	local span = math.max(1, hmax - hmin)
	local hs = {}
	for i, hv in ipairs(heights) do
		hs[i] = HEX[math.floor((hv - hmin) / span * 255 + 0.5)]
		if i % 512 == 0 then Y() end
	end
	save("grid_terrain", { t = wallTime(), x0 = g.x0, y0 = g.y0, cell = g.cell, nx = g.nx, ny = g.ny,
		water = table.concat(water), height = table.concat(hs), hmin = round(hmin, 1), hmax = round(hmax, 1),
		biome = biomeMap and table.concat(biome) or nil, biomeMap = biomeName })
end

local function emissionJob(kind, typeValue)
	return function()
		local g = gridSpec()
		if not g then return end
		local sys = api.engine.system.emissionGridSystem
		local vals, vmax = {}, 0
		local k = 0
		for iy = 0, g.ny - 1 do
			for ix = 0, g.nx - 1 do
				local p = vec2(g.x0 + (ix + 0.5) * g.cell, g.y0 + (iy + 0.5) * g.cell)
				local okE, v = pcall(sys.getInterpolatedEmission, p, true, typeValue)
				v = (okE and type(v) == "number") and v or 0
				if not okE and k == 0 then warnOnce("emission_" .. kind, v) end
				vals[#vals + 1] = v
				if v > vmax then vmax = v end
				k = k + 1
				if k % 32 == 0 then Y() end
			end
		end
		local hs = {}
		for i, v in ipairs(vals) do
			hs[i] = vmax > 0 and HEX[math.floor(v / vmax * 255 + 0.5)] or "00"
			if i % 512 == 0 then Y() end
		end
		save("grid_" .. kind, { t = wallTime(), x0 = g.x0, y0 = g.y0, cell = g.cell, nx = g.nx, ny = g.ny,
			data = table.concat(hs), max = vmax })
	end
end

---------------------------------------------------------------------------
-- flows on request: what cargo goes where for a selected town / industry / station group

local FLOW = { req = nil, seq = 0 }
local LOG_TYPES = { "delivered", "shipped", "transported", "DELIVERED", "SHIPPED" }

local function industryStockList(e)
	local ind = getComp(e, "INDUSTRY")
	return ind and ind.stockList
end

local function jobFlows()
	local req = FLOW.req
	if not req then return end
	FLOW.req = nil
	local util = api.engine.util
	local res = { seq = req.seq, entity = req.entity, kind = req.kind, out = {}, inn = {}, lines = {}, catch = {}, diag = {} }
	local e = req.entity
	if req.kind == "town" then
		local intervals = { 365 * 24 * 3600 * 1000, 0 }
		for _, iv in ipairs(intervals) do
			local d = try("flows_town", util.town.getTownDeliveriesStats, e, iv, false, true)
			if d then
				pcall(function()
					for src, byCargo in pairs(d) do
						for cid, v in pairs(byCargo) do
							res.inn[#res.inn + 1] = { src, cid, v[1], v[2] }
						end
					end
				end)
				res.diag.interval = iv
				if #res.inn > 0 then break end
			end
		end
		pcall(function()
			for _, l in ipairs(toArray(util.town and api.engine.system.lineSystem.getLines())) do
				if util.town.isLineStoppingInTown(l, e) then res.lines[#res.lines + 1] = l end
			end
		end)
	elseif req.kind == "industry" then
		local sl = industryStockList(e)
		local io = sl and try("flows_io", util.stock.getInputsOutputsFromRules, sl)
		local inputs, outputs = {}, {}
		pcall(function() inputs = toArray(io[1]); outputs = toArray(io[2]) end)
		res.inputs, res.outputs = inputs, outputs
		pcall(function()
			res.produced, res.consumed = {}, {}
			for _, c in ipairs(outputs) do res.produced[#res.produced + 1] = { c, util.stock.getCargoProducedPerYear(sl, c), util.stock.getCargoShippedPerYear and util.stock.getCargoTypeShippedPerYear(sl, c) } end
			for _, c in ipairs(inputs) do res.consumed[#res.consumed + 1] = { c, util.stock.getCargoConsumedPerYear(sl, c), util.stock.getCargoTypeDeliveredPerYear(sl, c) } end
		end)
		-- candidates: every other industry that uses one of our outputs / produces one of our inputs
		local others = listEntities("INDUSTRY")
		local logType = FLOW.logType
		for _, o in ipairs(others) do
			if o ~= e then
				local osl = industryStockList(o)
				local oio = osl and try("flows_io", util.stock.getInputsOutputsFromRules, osl)
				local oin, oout = {}, {}
				pcall(function() oin = toArray(oio[1]); oout = toArray(oio[2]) end)
				local function has(list, c) for _, x in ipairs(list) do if x == c then return true end end return false end
				for _, c in ipairs(outputs) do
					if has(oin, c) then
						local types = logType and { logType } or LOG_TYPES
						for _, lt in ipairs(types) do
							local okL, n = pcall(util.stock.getCargoLogPerYearForTarget, sl, osl, lt, c)
							if okL and type(n) == "number" then
								FLOW.logType = FLOW.logType or lt
								if n > 0 then res.out[#res.out + 1] = { o, c, n } end
								break
							end
						end
					end
				end
				for _, c in ipairs(inputs) do
					if has(oout, c) then
						local types = logType and { logType } or LOG_TYPES
						for _, lt in ipairs(types) do
							local okL, n = pcall(util.stock.getCargoLogPerYearForTarget, osl, sl, lt, c)
							if okL and type(n) == "number" then
								FLOW.logType = FLOW.logType or lt
								if n > 0 then res.inn[#res.inn + 1] = { o, c, n } end
								break
							end
						end
					end
				end
				Y()
			end
		end
		res.diag.logType = FLOW.logType
	elseif req.kind == "station" then
		local g = getComp(e, "STATION_GROUP")
		local stations = g and toArray(g.stations) or {}
		pcall(function() res.lines = toArray(api.engine.system.lineSystem.getLinesForStationGroup(e)) end)
		local seen = {}
		for _, st in ipairs(stations) do
			for _, cargo in ipairs({ true, false }) do
				local list = try("flows_catch", api.engine.system.catchmentAreaSystem.getStationCatchables, st, cargo)
				for _, c in ipairs(toArray(list)) do
					if not seen[c] then seen[c] = true; res.catch[#res.catch + 1] = c end
				end
			end
			Y()
		end
		-- map catchables (stock lists / person capacities) back to industries for the client
		local byStock = {}
		for _, ind in ipairs(listEntities("INDUSTRY")) do
			local sl = industryStockList(ind)
			if sl then byStock[sl] = ind end
		end
		res.catchIndustries = {}
		for _, c in ipairs(res.catch) do
			if byStock[c] then res.catchIndustries[#res.catchIndustries + 1] = byStock[c] end
		end
	end
	save("flows", res)
end

local function requestFlows(cmd)
	local e = tonumber(cmd.entity)
	if not e then return false, "flows needs entity" end
	FLOW.seq = FLOW.seq + 1
	FLOW.req = { seq = cmd.seq, entity = e, kind = tostring(cmd.kind or "industry") }
	kickJob("flows")
	return true
end

local function registerJobs()
	addJob("meta", 300, jobMeta, 0)
	addJob("stations", 10, jobStations, 1)
	addJob("lines", 5, jobLines, 2)
	addJob("paths", 20, jobPaths, 6)
	addJob("vehicles", 1, jobVehicles, 3)
	addJob("towns", 20, jobTowns, 4)
	addJob("terrain", 600, jobTerrain, 8)
	addJob("noise", 60, emissionJob("noise", 0), 12)
	addJob("pollution", 60, emissionJob("pollution", 1), 14)
	addJob("flows", 1e9, jobFlows, 1e9)   -- runs only when kicked by a request
	addJob("status", 30, function()
		S.status.jobs = J.stats
		save("status", S.status)
	end, 20)
end

---------------------------------------------------------------------------
-- commands

local function execute(cmd)
	local cam = api.gui.camera
	if cmd.action == "jump" then
		local x, y = tonumber(cmd.x), tonumber(cmd.y)
		if not x or not y then return false, "jump needs x and y" end
		local z = tonumber(cmd.z)
		if not z then
			local ok, c = pcall(cam.getCenter)
			z = (ok and c and c.z) or 0
		end
		local dist = tonumber(cmd.dist) or 1500
		local ok, err = pcall(cam.focusPosition, api.type.Vec3f.new(x, y, z), dist)
		return ok, err
	elseif cmd.action == "flows" then
		return requestFlows(cmd)
	elseif cmd.action == "focus" then
		local e = tonumber(cmd.entity)
		if not e then return false, "focus needs entity" end
		local ok, err = pcall(cam.focusEntity, e)
		return ok, err
	end
	return false, "unknown action: " .. tostring(cmd.action)
end

local function pollCommands()
	local cmd = readFile("cmd")
	if not cmd or type(cmd.seq) ~= "number" then return end
	if cmd.seq <= S.lastCmdSeq then return end
	S.lastCmdSeq = cmd.seq
	local ok, err = execute(cmd)
	save("ack", { seq = cmd.seq, ok = ok and true or false, error = (not ok) and tostring(err) or nil, t = wallTime() })
end

---------------------------------------------------------------------------
-- init + main loop

local function init()
	resolveComponentTypes()
	-- Reset the command channel so a stale command from a previous session is not replayed.
	save("cmd", { seq = 0 })
	S.lastCmdSeq = 0
	now()
	getTownUtil()
	-- New network session: an empty manifest hides tiles left over from another savegame.
	N.session = tostring(wallTime() or 0) .. "-" .. tostring(math.random(1000, 9999))
	save("net", { session = N.session, seq = 0, tile = NET_TILE, tiles = {}, templates = {}, stats = { building = true } })
	-- diagnostics for the network export: what each enum table says about BASE_EDGE
	S.status.baseEdgeCT = {
		type = tostring(select(2, pcall(function() return api.type.ComponentType.BASE_EDGE end))),
		engine = tostring(select(2, pcall(function() return api.engine.ComponentType.BASE_EDGE end))),
	}
	registerJobs()
	S.status.version = 8   -- 8: signals in the network export
	S.status.t = wallTime()
	save("status", S.status)
	debugPrint({ tf3map = "started", status = S.status })
end

local function guiUpdate(_userParams, _simState, _guiState)
	S.calls = S.calls + 1
	if not S.initialized then
		S.initialized = true
		local ok, err = pcall(init)
		if not ok then warnOnce("init", err) end
	end

	local t = now()
	if t - S.tCmd >= CMD_INTERVAL then
		S.tCmd = t
		local ok, err = pcall(pollCommands)
		if not ok then warnOnce("pollCommands", err) end
	end
	if t - S.tLive >= LIVE_INTERVAL then
		S.tLive = t
		local ok, err = pcall(exportLive)
		if not ok then warnOnce("exportLive", err) end
	elseif t - S.tWorld >= WORLD_INTERVAL then
		-- never in the same frame as the live export
		S.tWorld = t
		local ok, err = pcall(exportWorld)
		if not ok then warnOnce("exportWorld", err) end
	else
		local ok, err = pcall(netStep, t)
		if not ok then
			warnOnce("netStep", err)
			N.phase = "idle"   -- recover on the next interval
		end
		-- other exports get the frame only while the network export is idle
		if N.phase == "idle" then
			local okJ, errJ = pcall(runJobs, t)
			if not okJ then warnOnce("runJobs", errJ) end
		end
	end
end

function data()
	return {
		guiUpdate = guiUpdate,
	}
end



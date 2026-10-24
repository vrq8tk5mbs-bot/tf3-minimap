"""Extends fake_game's mocked TF3 API with stations, lines, vehicles, cargo, towns, terrain and emission.

Shapes follow api/tealdef (engine.d.tl, system.d.tl, util.d.tl, res.d.tl). Values are synthetic.
"""
import math
import time


def install(g):
    lua, vec, CT, TOWNS, INDUSTRIES, edges = g.lua, g.vec, g.CT, g.TOWNS, g.INDUSTRIES, g.edges
    T = lua.table_from
    TRACK_T = g.TRACK_T

    # ------------------------------------------------------------- enums
    MODES = ["PERSON", "CARGO", "CAR", "BUS", "TRUCK", "TRAM", "ELECTRIC_TRAM", "TRAIN", "ELECTRIC_TRAIN",
             "AIRCRAFT", "SHIP", "SMALL_AIRCRAFT", "SMALL_SHIP", "HELICOPTER"]
    MODE = {m: 1000 + i for i, m in enumerate(MODES)}
    CARRIERS = ["ROAD", "RAIL", "TRAM", "OTHER", "AIR", "WATER"]
    CARRIER = {c: 2000 + i for i, c in enumerate(CARRIERS)}
    enum = g.G.api.type.enum
    enum.TransportMode = T(MODE)
    enum.Carrier = T(CARRIER)

    # ------------------------------------------------------------- cargo + climates
    CARGO = [(0, "passengers", "Passengers"), (1, "coal", "Coal"), (2, "logs", "Logs"), (3, "planks", "Planks"),
             (4, "tinned_food", "Tinned food"), (5, "crude_oil", "Crude oil"), (6, "fuel", "Fuel"), (7, "grain", "Grain")]
    cargo_colors = {0: (0.9, 0.9, 0.9), 1: (0.2, 0.2, 0.2), 2: (0.5, 0.35, 0.2), 3: (0.8, 0.6, 0.3),
                    4: (0.8, 0.3, 0.3), 5: (0.1, 0.1, 0.3), 6: (0.9, 0.7, 0.1), 7: (0.9, 0.8, 0.4)}
    cargo_rep = T({
        "getAll": lambda *a: T({cid: f"{res}.lua" for cid, res, _ in CARGO}),
        "get": lambda cid: T({"name": dict((c, n) for c, _, n in CARGO)[cid],
                              "icon": f"ui/cargo/{dict((c, r) for c, r, _ in CARGO)[cid]}@2x.tga",
                              "color": vec(*cargo_colors[cid]), "category": "x"}),
        "getPassengerCargoTypeId": lambda: 0,
    })
    biomes = T({1: T({"id": 0, "key": "desert", "displayName": "Desert", "color": vec(0.85, 0.75, 0.5)}),
                2: T({"id": 1, "key": "temperate", "displayName": "Temperate", "color": vec(0.35, 0.6, 0.3)}),
                3: T({"id": 2, "key": "tundra", "displayName": "Tundra", "color": vec(0.75, 0.8, 0.8)})})
    climate_rep = T({
        "getAll": lambda *a: T({1: "temperate.clima"}),
        "get": lambda cid: T({"dataMaps": T({"biomes": biomes, "layers": T({})})}),
    })
    g.G.api.res = T({"cargoTypeRep": cargo_rep, "climateRep": climate_rep})

    # ------------------------------------------------------------- terrain
    BX0, BY0, BX1, BY1 = -16384, -32768, 16384, 32768

    def on_water(p):
        return p.x > 14000 or (p.x + 9000) ** 2 + (p.y + 26000) ** 2 < 2500 ** 2

    def height(p):
        return 40 + 300 * (0.5 + 0.5 * math.sin(p.x / 4000.0) * math.cos(p.y / 6000.0)) - (200 if on_water(p) else 0)

    biome_map = lua.eval("""function(sx, sy, f)
        local m = {}
        function m:getSize() return { x = sx, y = sy } end
        function m:at(x, y) return f(x, y) end
        return m
    end""")(64, 128, lambda x, y: 2 if y > 85 else (1 if y > 40 else 0))
    g.TERRAIN_DATAMAPS[0] = T({1: T({1: "biomes", 2: biome_map})})
    box = T({"min": vec(BX0, BY0), "max": vec(BX1, BY1)})
    g.G.api.engine.terrain = T({"getBoundingBox": lambda: box, "isOnWater": on_water, "getHeightAt": height})
    g.G.api.type.Vec2f = T({"new": lambda x, y: vec(x, y)})

    # ------------------------------------------------------------- stations
    town_pos = {i: (t[1], t[2]) for i, t in enumerate(TOWNS)}
    stations = {}       # station entity -> dict
    groups = {}         # group entity -> dict
    next_e = [700000]

    def new_e():
        next_e[0] += 1
        return next_e[0]

    def add_group(name, pos_list, cargo=False, carriers=("RAIL",)):
        sg = new_e()
        sts = []
        for (x, y) in pos_list:
            st = new_e()
            stations[st] = {"pos": (x, y), "r": 400 if not cargo else 600, "cargo": cargo, "group": sg}
            sts.append(st)
        groups[sg] = {"name": name, "stations": sts, "carriers": carriers}
        return sg

    rail_sg = {i: add_group(f"{TOWNS[i][0]} Central", [town_pos[i]]) for i in (0, 5, 3, 2, 4, 7)}
    bus_sg = [add_group(f"Tokyo {n}", [(12000 + dx, 8000 + dy)], carriers=("ROAD",))
              for n, dx, dy in (("North", 0, 500), ("East", 600, 0), ("South", 0, -500))]
    tram_sg = [add_group(f"Osaka {n}", [(9000 + dx, -6000 + dy)], carriers=("TRAM",))
               for n, dx, dy in (("Port", -500, 0), ("Hill", 500, 300))]
    truck_sg = [add_group("Xi'an Mill Yard", [(-4440, 12700)], cargo=True, carriers=("ROAD",)),
                add_group("Kolkata Depot", [(5800, 12800)], cargo=True, carriers=("ROAD",))]
    air_sg = [add_group("Tokyo Airport", [(13000, 9500)], carriers=("AIR",)),
              add_group("Manila Airport", [(3000, -29500)], carriers=("AIR",))]
    ship_sg = [add_group("Osaka Harbour", [(10500, -7500)], cargo=True, carriers=("WATER",)),
               add_group("Busan Harbour", [(-11000, -19500)], cargo=True, carriers=("WATER",))]

    # terminal node ids: NodeId{entity = station, index = 0}
    def node(st):
        return T({"entity": st, "index": 0})

    # ------------------------------------------------------------- lines
    lines = {}   # line entity -> dict

    def add_line(name, color, modes, stop_groups, cargo_types, nveh):
        l = new_e()
        stops = [(sg, 0, 0) for sg in stop_groups]
        lines[l] = {"name": name, "color": color, "modes": modes, "stops": stops, "cargo": cargo_types,
                    "veh": [new_e() for _ in range(nveh)]}
        return l

    add_line("RE1 Harbin – Kolkata", (0.85, 0.2, 0.25), ["TRAIN", "PERSON"], [rail_sg[0], rail_sg[5], rail_sg[3]], [0], 3)
    add_line("Coal Omsk – Pyongyang", (0.3, 0.3, 0.3), ["TRAIN", "CARGO"], [rail_sg[4], rail_sg[7]], [1], 2)
    add_line("Bus 1 Tokyo", (0.2, 0.6, 0.95), ["BUS", "PERSON"], bus_sg, [0], 2)
    add_line("Tram A Osaka", (0.95, 0.6, 0.1), ["TRAM", "PERSON"], tram_sg, [0], 2)
    add_line("Planks truck", (0.6, 0.4, 0.2), ["TRUCK", "CARGO"], truck_sg, [3], 2)
    add_line("Air Tokyo – Manila", (0.6, 0.3, 0.9), ["AIRCRAFT", "PERSON"], air_sg, [0], 1)
    add_line("Ship Osaka – Busan", (0.1, 0.5, 0.5), ["SHIP", "CARGO"], ship_sg, [5], 1)
    veh_line = {v: l for l, d in lines.items() for v in d["veh"]}

    def line_points(l):
        return [stations[groups[sg]["stations"][0]]["pos"] for sg, _, _ in lines[l]["stops"]]

    def veh_pos(v):
        l = veh_line[v]
        pts = line_points(l) + [line_points(l)[0]]
        k = lines[l]["veh"].index(v)
        segs = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
        total = sum(segs) or 1
        s = ((time.time() * 120 + k * total / len(lines[l]["veh"])) % total)
        for i, d in enumerate(segs):
            if s <= d:
                f = s / d if d else 0
                return vec(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, 0)
            s -= d
        return vec(*pts[0], 0)

    # ------------------------------------------------------------- pathfinding over the fake rail routes
    town_of_station = {}
    for i, sg in rail_sg.items():
        town_of_station[groups[sg]["stations"][0]] = i

    def find_path(n0s, n1s, modes):
        a, b = town_of_station.get(n0s[1].entity), town_of_station.get(n1s[1].entity)
        if a is None or b is None:
            return T({})
        if (a, b) in g.RAIL_ROUTES:
            ids, fwd = g.RAIL_ROUTES[(a, b)], True
        elif (b, a) in g.RAIL_ROUTES:
            ids, fwd = list(reversed(g.RAIL_ROUTES[(b, a)])), False
        else:
            # two hops via Xi'an (index 5) when there is no direct track
            if (a, 5) in g.RAIL_ROUTES or (5, a) in g.RAIL_ROUTES:
                p1 = find_path(n0s, T({1: node(groups[rail_sg[5]]["stations"][0])}), modes)
                p2 = find_path(T({1: node(groups[rail_sg[5]]["stations"][0])}), n1s, modes)
                return T({i + 1: x for i, x in enumerate(list(p1.values()) + list(p2.values()))})
            return T({})
        return T({i + 1: T({1: T({"entity": e, "index": 0}), 2: fwd}) for i, e in enumerate(ids) if e in edges})

    def hermite(d, t):
        (x0, y0), (x1, y1), (a0, b0), (a1, b1) = d["p0"], d["p1"], d["t0"], d["t1"]
        h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
        return vec(h00 * x0 + h10 * a0 + h01 * x1 + h11 * a1, h00 * y0 + h10 * b0 + h01 * y1 + h11 * b1, 0)

    def calc_position(geom, t):
        return hermite(edges[geom.edge], t)

    # ------------------------------------------------------------- industries / stocks
    inds = g.inds
    IO = {"forest": ([], [2]), "saw_mill": ([2], [3]), "farm": ([], [7]), "oil_well": ([], [5]), "oil_refinery": ([5], [6])}
    stock_of = {e: e + 5000 for e in inds}
    ind_of_stock = {v: k for k, v in stock_of.items()}

    def io_rules(sl):
        kind = inds[ind_of_stock[sl]][1]
        i, o = IO.get(kind, ([], []))
        return T({1: T({k + 1: x for k, x in enumerate(i)}), 2: T({k + 1: x for k, x in enumerate(o)})})

    def log_for_target(src, tgt, log_type, cargo):
        if log_type != "delivered":
            raise lua.eval("error")("unknown log type " + str(log_type))
        a, b = inds[ind_of_stock[src]], inds[ind_of_stock[tgt]]
        if "Busan" in a[0] or "Tokyo" in b[0]:
            return 0   # the second logging camp / saw mill have no deliveries yet: chain candidates only
        return 420 if (a[1], b[1]) in (("forest", "saw_mill"), ("oil_well", "oil_refinery")) else 0

    # ------------------------------------------------------------- towns
    towns = g.towns

    def town_caps(e):
        s = towns[e][3]
        return T({1: T({"used": int(s * 0.8), "capacity": s}), 2: T({"used": int(s * 0.3), "capacity": int(s * 0.4)}),
                  3: T({"used": int(s * 0.2), "capacity": int(s * 0.3)})})

    def town_comp(e):
        return T({"cargoNeeds": T({1: T({1: T({1: 4, 2: 1.0})}), 2: T({1: T({1: 3, 2: 1.0}), 2: T({1: 6, 2: 0.5})}),
                                   3: T({})})})

    # ------------------------------------------------------------- emission
    def emission(p, avg, typ):
        if typ == 0:
            return sum(max(0.0, 60 - math.dist((p.x, p.y), (t[1], t[2])) / 40) for t in TOWNS)
        return sum(max(0.0, 30 - math.dist((p.x, p.y), (i[2], i[3])) / 60) for i in INDUSTRIES)

    # ------------------------------------------------------------- components
    def comp(e, ct):
        if ct == CT["STATION_GROUP"] and e in groups:
            return T({"stations": T({i + 1: s for i, s in enumerate(groups[e]["stations"])})})
        if ct == CT["NAME"]:
            if e in groups:
                return T({"name": groups[e]["name"]})
            if e in lines:
                return T({"name": lines[e]["name"]})
        if ct == CT["STATION"] and e in stations:
            s = stations[e]
            ca = T({1: T({"position": vec(*s["pos"]), "radius": s["r"]})})
            terms = T({1: T({"vehicleNodeId": node(e)})})
            return T({"catchmentAreas": ca, "terminals": terms})
        if ct == CT["LINE"] and e in lines:
            d = lines[e]
            stops = T({i + 1: T({"stationGroup": sg, "station": st, "terminal": te}) for i, (sg, st, te) in enumerate(d["stops"])})
            vm = T({MODE[m]: True for m in d["modes"]})
            return T({"stops": stops, "vehicleInfo": T({"transportModes": vm})})
        if ct == CT["COLOR"] and e in lines:
            return T({"color": vec(*lines[e]["color"])})
        if ct == CT["TRANSPORT_VEHICLE"] and e in veh_line:
            m = lines[veh_line[e]]["modes"][0]
            carrier = {"TRAIN": "RAIL", "BUS": "ROAD", "TRUCK": "ROAD", "TRAM": "TRAM", "AIRCRAFT": "AIR", "SHIP": "WATER"}[m]
            return T({"carrier": CARRIER[carrier], "line": veh_line[e]})
        if ct == CT["TRANSPORT_NETWORK"] and e in edges:
            d = edges[e]
            length = math.dist(d["p0"], d["p1"])
            return T({"edges": T({1: T({"geometry": T({"length": length, "edge": e})})})})
        if ct == CT["INDUSTRY"] and e in inds:
            return T({"level": 2, "construction": e + 100, "stockList": stock_of[e]})
        if ct == CT["TOWN"] and e in towns:
            return town_comp(e)
        return None

    g.EXTRA_COMPONENTS.append(comp)
    g.EXTRA_ENTITIES[CT["STATION_GROUP"]] = lambda: list(groups)

    # ------------------------------------------------------------- systems + util
    sysm = g.G.api.engine.system
    sysm.lineSystem = T({
        "getLines": lambda: T({i + 1: l for i, l in enumerate(lines)}),
        "getLinesForStationGroup": lambda sg: T({i + 1: l for i, l in enumerate(
            [l for l, d in lines.items() if any(s[0] == sg for s in d["stops"])])}),
    })
    sysm.transportVehicleSystem = T({
        "getLine2VehicleMap": lambda: T({l: T({i + 1: v for i, v in enumerate(d["veh"])}) for l, d in lines.items()}),
    })
    sysm.stationGroupSystem = T({
        "getCarriers": lambda sg, a, b: T({1: T({i + 1: CARRIER[c] for i, c in enumerate(groups[sg]["carriers"])}), 2: T({})}),
    })
    sysm.streetConnectorSystem = T({"getConstructionEntityForStation": lambda st: None})
    sysm.emissionGridSystem = T({"getInterpolatedEmission": emission})

    def catchables(st, cargo):
        s = stations[st]
        near = [stock_of[e] for e, i in inds.items() if math.dist(s["pos"], (i[2], i[3])) < 1500] if cargo else []
        return T({i + 1: x for i, x in enumerate(near)})

    sysm.catchmentAreaSystem = T({"getStationCatchables": catchables})

    def line_usage(l, all_caps):
        # like the real game: a 1-based list over every cargo type (entry k = cargo id k-1),
        # zero for cargo the line never sees
        out = {c: T({"used": 40, "capacity": 120}) for c in lines[l]["cargo"]}
        if "TRUCK" in lines[l]["modes"]:
            # universal trucks: capacity for every cargo they can load, but only one is actually carried
            for c in range(1, 6):
                out.setdefault(c, T({"used": 0, "capacity": 60}))
        n = max(c for c, _, _ in CARGO) + 1
        return T({k + 1: out.get(k, T({"used": 0, "capacity": 0})) for k in range(n)})

    util = T({
        "line": T({
            "getLineTransportModesUnion": lambda l: T({MODE[m]: True for m in lines[l]["modes"]}),
            "getLineCapacityUsages": line_usage,
            "getMaxFrequency": lambda l: 180.0 / max(1, len(lines[l]["veh"])),
            "calcLineStationThroughput": lambda l: 900,
            "getLineIssues": lambda l, a: T({}),
        }),
        "station": T({"isStationOfType": lambda st, cargo: stations[st]["cargo"] == bool(cargo)}),
        "vehicle": T({"getPosition": veh_pos}),
        "town": T({
            "getTownCapacityUsage": town_caps,
            "getTownStockCargo": lambda e: T({4: T({1: 12, 2: 40}), 3: T({1: 3, 2: 20})}),
            "getTownDeliveriesStats": lambda e, iv, per_line, per_cargo: T({200: T({2: T({1: 30, 2: 10})})}),
            "isLineStoppingInTown": lambda l, e: False,
        }),
        "stock": T({
            "getInputsOutputsFromRules": io_rules,
            "getCargoLogPerYearForTarget": log_for_target,
            "getCargoProducedPerYear": lambda sl, c: 800,
            "getCargoTypeShippedPerYear": lambda sl, c: 600,
            "getCargoShippedPerYear": lambda sl: 600,
            "getCargoConsumedPerYear": lambda sl, c: 500,
            "getCargoTypeDeliveredPerYear": lambda sl, c: 450,
        }),
        "pathfinding": T({"findPathNodeToNode": find_path}),
        "transport": T({"calcPosition": calc_position}),
    })
    g.G.api.engine.util = util
    print(f"fake world: {len(groups)} station groups, {len(lines)} lines, {len(veh_line)} vehicles", flush=True)


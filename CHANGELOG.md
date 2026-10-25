# Changelog

Every entry says first **what players need to do**: update the mod, download a new companion, or nothing.
The mod comes from mod.io (the game updates it); the companion comes from [GitHub Releases](https://github.com/vrq8tk5mbs-bot/tf3-minimap/releases/latest).

## 1.3.0 — 2026-10-25

**What you need to do**
- **Mod (mod.io)**: updated. The game downloads the update by itself; **restart the game** afterwards so the new version runs. Your saves are not affected.
- **Windows**: download the new companion (`TF3-Minimap-Windows.zip`), close the old companion window, replace the old folder, start `TF3 Minimap.exe` again.
- **Mac / Linux**: download the new companion zip, close the old companion, replace the old folder, start it again.
- Signals need both: the new mod sends them, the new companion draws them. With only one of the two updated everything else keeps working; the rail focus then says the mod needs updating.

**Changes**
- **Signals and one-way track** in the rail focus (◎ Focus → Rail). In Transport Fever a track has no direction of its own: one-way signals give it one. The map cuts the network into sections between switches and colours every section whose one-way signals all point the same way **orange, with arrows** in the direction trains may run. Sections without one-way signals run both ways and stay plain. A section whose one-way signals face each other is drawn **red**. Zoomed out you see at a glance where single track runs both ways and where passing loops are, and where another loop could go.
- Zoom in to see the signals themselves: a bar across the track and an arrowhead in the direction the signal applies to. Orange = one-way signal, white = normal signal, blue diamond = waypoint.
- New signals show up within seconds of building them.
- A small legend in the rail focus says what the colours mean.

**Что делать (RU)**: мод обновится через mod.io сам — после этого перезапустить игру; скачать новый компаньон (Windows и Mac/Linux) и заменить папку. Сейвы не затронуты.

## 1.2.0 — 2026-10-25

**What you need to do**
- **Windows**: download the new companion (`TF3-Minimap-Windows.zip`), close the old companion window, replace the old folder, start `TF3 Minimap.exe` again.
- **Mac / Linux**: download the new companion zip, close the old companion, replace the old folder, start it again.
- **Mod (mod.io)**: unchanged, nothing to do. No game restart needed. Your saves are not affected.

**Changes**
- **Focus**: show only what you are working on. Tap **◎ Focus** at the bottom and pick **Rail**, **Road**, **Water** or **Air**: only those lines, their stations and vehicles stay on the map. The line card has **Only this line**, the station card **Only this station** (the station plus every line through it).
- Roads, tracks, towns and industries stay as a faint background, so you still see where things are. Town names stay, muted.
- One focus at a time. The chip at the bottom shows it (e.g. **◎ Rail ✕**); ✕ brings back the filters you had before the first focus, even after switching between focuses. The focus survives a page reload.
- *Only this chain* (cargo chains from 1.1.0) is now one kind of focus and works the same way.

**Что делать (RU)**: скачать новый компаньон (Windows и Mac/Linux) и заменить папку. Мод — ничего, игру перезапускать не нужно.

## 1.1.2 — 2026-10-24

**What you need to do**
- **Windows**: download the new companion (`TF3-Minimap-Windows.zip`), close the old companion window, replace the old folder, start `TF3 Minimap.exe` again.
- **Mac / Linux**: download the new companion zip, close the old companion, replace the old folder, start it again.
- **Mod (mod.io)**: unchanged, nothing to do. No game restart needed. Your saves are not affected.

**Changes**
- Fixes "Game is silent" when the mod is enabled. On one Windows 11 PC the mod's data files had become read-only. The game then cannot update them and shows no error, so the map kept showing an old state. The companion now clears the read-only flag on its own `tf3map_` files when it starts and while the game is silent, and says so in its window. The map comes back within seconds, without restarting the game. Other files are never touched.
- When the game is silent, the companion window also shows the folder it reads the data from.

**Что делать (RU)**: скачать новый компаньон (Windows и Mac/Linux) и заменить папку. Мод — ничего, игру перезапускать не нужно.

## 1.1.1 — 2026-10-24

**What you need to do**
- **Windows**: download the new companion (`TF3-Minimap-Windows.zip`), close the old companion window, replace the old folder, start `TF3 Minimap.exe` again.
- **Mac / Linux**: download the new companion zip, close the old companion, replace the old folder, start it again.
- **Mod (mod.io)**: unchanged, nothing to do. No game restart needed. Your saves are not affected.

**Changes**
- "Game is silent" now says what to check. The map shows the last known map even when the game sends nothing, which looked like a broken connection. Usually the save you loaded doesn't have the mod enabled. After 10 seconds of silence the map shows a hint: load a save and check that Minimap Companion is enabled in that save's mod list. Tap the status at the top left to see it again.
- The companion window says the same after 30 seconds without data from the game, and "Game connected" when data comes in again.
- The status said "No connection to **Mac**" on every computer. It now says "No connection to computer", and tapping it explains what to check (companion running, same Wi-Fi).

**Что делать (RU)**: скачать новый компаньон (Windows и Mac/Linux) и заменить папку. Мод — ничего, игру перезапускать не нужно.

## 1.1.0 — 2026-10-24

**What you need to do**
- **Windows**: download the new companion (`TF3-Minimap-Windows.zip`), close the old companion window, replace the old folder, start `TF3 Minimap.exe` again.
- **Mac / Linux**: download the new companion zip, close the old companion, replace the old folder, start it again.
- **Mod (mod.io)**: unchanged, nothing to do. No game restart needed. Your saves are not affected.

**Changes**
- Cargo chains. Tap an industry: its card now lists the **nearest receivers** of each cargo it makes (industries and towns that need it) and the **nearest suppliers** of each cargo it needs, with the straight-line distance; ✓ marks partners that already get deliveries. The map draws dotted lines to the nearest candidates. Tap a name to jump to it.
- **Only this chain** (industry card) and **Chain** (Settings → Industry types): shows only that industry type plus the types that supply it or take its cargo, e.g. logging camps + saw mills, and hides every line that does not carry that cargo (with its stations and vehicles) and stations with no line away from the chain; towns that do not need the chain's cargo shrink to small quiet dots without names. The chain stands out. To undo, tap the **Chain: … ✕** chip at the bottom or **Show all types** on the card: the types you had before come back.
- Settings: *Industry types* moved up, right under the line filter. It already let you show or hide each type.
- Works with modded industries too: what each industry accepts and produces comes from the game's own rules.

**Что делать (RU)**: скачать новый компаньон (Windows и Mac/Linux) и заменить папку. Мод — ничего, игру перезапускать не нужно.

## 1.0.2 — 2026-10-23

**What you need to do**
- **Windows**: download the new companion (`TF3-Minimap-Windows.zip`), close the old companion window, replace the old folder, start `TF3 Minimap.exe` again.
- **Mac / Linux**: nothing required (same fix, but the error only happens on Windows).
- **Mod (mod.io)**: unchanged, nothing to do. Your saves are not affected.

**Changes**
- Companion: on Windows the window filled up with `trails: cannot save [WinError 32]` lines. Windows (most likely Defender or the search indexer) briefly locks the file where ship routes are saved, and the companion retried on every vehicle update. Now it retries a few times, then waits 30 seconds, and shows at most one short note. The map was never affected.

**Что делать (RU)**: Windows — скачать новый компаньон и заменить старую папку. Mac/Linux и мод — ничего.

## 1.0.1 — 2026-10-20

**What you need to do**
- Nothing. Texts only.

**Changes**
- Descriptions and the companion window now say that the map opens in any browser: on a second monitor (`http://localhost:8765`), a phone or a tablet.

## 1.0.0 — 2026-10-20

First release: mod *Minimap Companion* on mod.io, companion for Windows (no Python needed) and Mac / Linux / Steam Deck (Python 3).

# Changelog

Every entry says first **what players need to do**: update the mod, download a new companion, or nothing.
The mod comes from mod.io (the game updates it); the companion comes from [GitHub Releases](https://github.com/vrq8tk5mbs-bot/tf3-minimap/releases/latest).

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

# Changelog

Every entry says first **what players need to do**: update the mod, download a new companion, or nothing.
The mod comes from mod.io (the game updates it); the companion comes from [GitHub Releases](https://github.com/vrq8tk5mbs-bot/tf3-minimap/releases/latest).

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

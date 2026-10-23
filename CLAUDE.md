# TF3 Minimap — notes for working on this repo

Three parts: `mod/tf3_minimap` (Lua, runs in Transport Fever 3, published on mod.io as *Minimap Companion*, mod ID 6468330),
`companion/` (Python stdlib web server + `web/` page), `test/` (runs the real mod Lua against a fake game API, `pip install lupa`).

## Every update: tell players what to do (Markus's rule)

Players must always know whether they need to do anything. For every change:

1. Add a section to `CHANGELOG.md` for the new version, starting with **What you need to do**, split by
   - Windows companion (download new `TF3-Minimap-Windows.zip` or not),
   - Mac / Linux companion,
   - the mod (mod.io updates it automatically; say if a game restart or re-enabling is needed; say if saves are affected).
   Then **Changes**, then a one-line **Что делать (RU)**.
   The release workflow fails if the section for `VERSION` is missing; the section becomes the GitHub release text.
2. Put the same "LATEST UPDATE ... What to do ..." block at the top of the description in
   `mod/tf3_minimap/_metadata/modinfo.json` (replace the previous block), so the mod.io page shows it.
   If the mod itself is not re-uploaded, Markus pastes the description on the mod.io website.

## Releasing

- Companion: bump `VERSION` in `companion/tf3map_server.py`, add the CHANGELOG section, push `main`, then push `main` to the
  `release` branch. GitHub Actions builds the Windows program and the zips and publishes release `v<VERSION>`
  (tags and releases cannot be created from Claude's sessions; the workflow does it).
- Mod: bump `revision` in `mod/tf3_minimap/mod.json`, copy `mod/tf3_minimap` into
  `<Steam>/userdata/<id>/3493540/local/staging_area/` (keep `_metadata/mod.io_fileid.txt` = `6468330`),
  restart the game, Mod Manager -> My Mods; upload only if it says "The existing mod on mod.io will be updated".
  No second copy with the same modId in `local/mods/`.
- Text everywhere: the map works in any browser — second monitor (`http://localhost:8765`), phone or tablet. PC only, not consoles.

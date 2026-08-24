# CLAUDE.md

Session-handoff guide. **README.md is the source of truth** for what this app is and why; this file carries only what a fresh session needs and cannot derive: current status, non-obvious mechanics, and the rules that encode hard-won corrections. Keep the Status section current at the end of every working session; don't record what README, package.json, or the code already say.

## Status (2026-08-24)

The full chain is proven end to end on **scene C** of `output/software-built-for-humans`: metaphor → asset collection (3 Storyset illustrations vendored + cached) → shooting script → composition → clean lint → 45s render (`renders/scene-c.mp4`). Two known nits in that render: the recolor map only remaps Storyset's yellow (green cluster survives in s08), and two illustrations keep white ground shapes that want extra `dropLayers`.

**Next, in priority order:**

1. **Exercise the feedback loop on a real revision** — widen `illustration.recolor` in the reference project's art direction, add the extra `dropLayers`, dispatch through the app's note → batch → re-approve path (not by hand), re-render scene C. This validates the app's core mechanism, which has so far been bypassed by running agents manually.
2. **Run scenes A, B, D, E, F through the same chain**, then a full render with narration audio. Stress-tests consistency, author lock, and the library cache.
3. **Wire the assets-stage approval action** — the pane reviews but nothing yet writes the approved status that unlocks the shooting script; the gate is honor-system.
4. **Auto-proposed recolor maps** — the assets stage should propose per-asset maps from `extractPalette` for approval, instead of hand-written hex pairs.

## Non-obvious mechanics

- `output/` is **gitignored** — project artifacts live on disk only. Reference project: `output/software-built-for-humans`.
- `.env` (gitignored) holds `FREEPIK_API_KEY` for the Storyset/Freepik adapter. Asset CLI: `node packages/pipeline/dist/design/assets/cli.js search|fetch …` — search hits the cross-project cache at `~/.hyperframes/asset-library/` before any network call; fetch deposits every download there pre-recolor.
- After editing a project's design artifacts, rebuild its index: `writeIndex(projectPath)` from `packages/pipeline/dist/index.js`.
- Pipeline build (`npm run build -w packages/pipeline`) also copies `workflows/*.json` and `skills/*.md` into dist — a stale dist means stale skills.
- The Electron app opens the last project (persisted in `~/Library/Application Support/@hyperframes-app/shell/settings.json`). Headless driving for screenshots: playwright-core `_electron`, executable `node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`, args `[<repo>/packages/shell]`.
- Upstream CLI per project dir: `npx hyperframes lint | check | snapshot | render -c compositions/<scene>.html`. Never re-implement what it does.

## Rules that encode corrections (don't relearn these)

- **Availability outranks style** in asset collection: adapt found assets (recolor map, `dropLayers`), never reject on style. Icons are decoration and don't count toward coverage; a scene needs ≥2 secured illustrations.
- **The app never authors content**; agents do, briefed by their stage's skill file, scoped to that stage's output. Composition reads shooting script + art direction, never the metaphor.
- **Narration is the clock** — no stage may change a duration.
- **Never generate SVG on the spot**; illustrations come through the adapters, icons from the vendored sets.
- **Stages are data**: structure changes go in the workflow JSON, quality changes in the skill markdown. Engine code changes only for a genuinely new pane kind.
- Keep README.md in sync with architecture/policy changes — its section numbers are referenced from code comments and skills.

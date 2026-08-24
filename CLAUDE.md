# CLAUDE.md

Operational guide for agents working in this repo. **Read README.md first** — it is the authoritative description of what this app is (a workflow-agnostic, platform-agnostic app for multi-stage creative workflows with human review gates) and why it is shaped this way. This file covers only how to work on it.

## Layout

- `packages/pipeline` — the engine (npm workspace, TS ESM, builds with `tsc` to `dist/`). Workflow definitions in `src/design/workflows/*.workflow.json`, stage skills in `src/design/skills/*.md`, asset-source adapters in `src/design/assets/`.
- `packages/shell` — the Electron review app (electron-vite). Renderer panes in `src/renderer/src/components/stages/`, one per pane type.
- `output/<project>/` — video projects. **Gitignored**: artifacts live on disk, not in git. Reference project: `output/software-built-for-humans`.
- `.env` (gitignored) — `FREEPIK_API_KEY`, used by the Freepik/Storyset adapter.

## Commands

```bash
npm run build --workspace=packages/pipeline   # tsc + copy workflows/skills to dist
cd packages/shell && npx tsc --noEmit         # typecheck shell (node + web tsconfigs)
npm run build --workspace=packages/shell      # electron-vite build → packages/shell/out
npm start                                     # build all + launch the Electron app
```

The app opens the last project (persisted in `~/Library/Application Support/@hyperframes-app/shell/settings.json`). To drive it headlessly for screenshots, use playwright-core `_electron` with executable `node_modules/electron/dist/Electron.app/Contents/MacOS/Electron` and args `[<repo>/packages/shell]`.

Upstream CLI (per project dir): `npx hyperframes lint | check | snapshot | render -c compositions/<scene>.html`. Never re-implement what it does.

Asset resolution (used by the stage-assets skill, works anywhere):

```bash
node packages/pipeline/dist/design/assets/cli.js search "<need>" --project <project>
node packages/pipeline/dist/design/assets/cli.js fetch <ref> --query "<need>" --project <project> --name <slug>
```

Search consults the cross-project library (`~/.hyperframes/asset-library/`) first — hits cost no credits; fetch deposits every download there pre-recolor.

## Rules that are easy to violate

- **The app never authors content.** Agents author artifacts; the app dispatches, renders, records. Don't add generation logic to the shell.
- **Never generate SVG on the spot.** Illustrations come through the asset adapters; icons from the vendored sets. Availability outranks style: adapt found assets (recolor map, `dropLayers`), don't reject them. Icons are decoration — a scene needs ≥2 secured illustrations or it's flagged thin.
- **Narration is the clock.** Durations are derived from the timing manifest; no stage may change them.
- **Stages are data.** New/changed stage order = edit the workflow JSON; stage quality = edit its skill markdown. Engine code changes only for a genuinely new pane kind.
- **After editing design artifacts**, rebuild the project index: `writeIndex(projectPath)` from `packages/pipeline/dist/index.js`.
- Running a stage = dispatching an agent briefed by its skill file plus the project's design artifacts, scoped to its stage's output only. Compositions read the shooting script + art direction, never the metaphor.
- Keep README.md in sync when architecture or policy changes — it is the product's source of truth, and its section numbers are referenced from code comments and skills.

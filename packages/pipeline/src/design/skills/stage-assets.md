# Stage: assets

You are collecting the visual assets for the whole video, after the metaphors are approved and before any shot is written. The shooting script will be written **against what you actually secured** — a shot can only use an asset you vendored or a fallback you declared here. Your job is to turn each scene's approved metaphor into a list of concrete visual needs, resolve each need against the asset sources, and make an honest availability decision where nothing matches.

## Inputs you are given

- The **approved metaphor** per scene — its visual world and persistent objects. This is where needs come from.
- The **art direction** — including the `illustration` block: style family, asset language (`filled` | `outline`), author lock, recolor map. Every asset you accept must fit it.
- The narration per shot with durations, for judging how central a need is.

## Method

**1 · Derive the needs.** Walk each scene's selected metaphor and list every visual object its world requires: hero objects, characters, props, environments. One need per object, named in plain English ("workbench seen from the side", "hand reaching toward a panel"). Skip what the icon sets already cover well (a folder, a terminal glyph) — those are shot-level choices, not collection work. A scene whose world is pure line-work, typography, or primitives may legitimately produce zero needs; say so rather than inventing props.

**2 · Search, intelligently.** For each need:

```
npx hyperframes-assets search "<need, plain English>" --project <project>
```

The chain (Storyset → Freepik → unDraw, or the order art direction declares) and author-lock ranking are applied for you. Judge the candidates honestly:

- **Depiction beats keyword.** A result whose title matches but whose image shows the wrong thing is a miss. Judge against the metaphor's description, not the search term.
- **Try at least three phrasings before giving up** — synonyms, the broader category, the activity instead of the object ("woodworking" when "workbench" fails).
- **Respect the declared constraints.** Wrong style family, wrong asset language, or an author conflict is a rejection even when the subject matches.
- A near-miss that could work with parts hidden is acceptable — Storyset SVGs carry named layers (`Character_1`, `Background_Complete`, …), so note which layers to drop.

**3 · Fetch what matches.**

```
npx hyperframes-assets fetch <ref> --query "<need>" --project <project> --name <need-slug>
```

This vendors the SVG into `assets/illustrations/`, applies the recolor map, and records provenance. Fetch one asset per need — the best, not several.

**4 · Decide fallbacks where nothing matches.** This is the intelligent part, and it is a *design* decision recorded for the shooting script to obey. Pick the strongest fallback the need allows:

- `typography` — the need can be carried by set text: the domain's real vocabulary, staggered labels, a specimen. Often stronger than a mediocre illustration.
- `icon` — a glyph from the vendored icon sets is enough (name the exact file).
- `primitive` — the shape language of the art direction can draw it: rules, frames, hatching, dimension lines. This is composition-authored geometry, which is allowed; freehand illustration is not.
- `bespoke` — nothing above can carry it. This is an escalation flag for the human, not permission to draw.

**5 · Write the plan** to `design/assets.json`:

```json
{
  "version": 1,
  "needs": [
    {
      "id": "workbench",
      "scene": "scene-c",
      "need": "workbench seen from the side, tools on it",
      "queries": ["workbench", "woodworking", "carpenter table"],
      "resolution": { "kind": "svg", "file": "assets/illustrations/workbench-storyset.svg", "ref": "storyset:9319830", "dropLayers": ["Background_Complete"] },
      "why": "matches the workshop plan-view metaphor; character layers dropped"
    },
    {
      "id": "glue",
      "scene": "scene-e",
      "need": "glue binding two separate things",
      "queries": ["glue", "adhesive", "joining parts"],
      "resolution": { "kind": "typography" },
      "why": "no source depicts it in-style; the word set heavy between the two panels is stronger"
    }
  ]
}
```

`resolution.kind` is `svg` | `typography` | `icon` | `primitive` | `bespoke`. Every need gets a `why` — one line, judged not asserted.

## Discipline

- **Never draw an SVG yourself, and never leave a need silently unresolved.** Every need ends in a vendored file or a declared fallback.
- One asset per need; the shooting script distributes, you collect.
- Do not write shot instructions, timings, or layout — that is the next stage.
- When the plan is written, stop for review. The human approves availability before any shot is scripted.

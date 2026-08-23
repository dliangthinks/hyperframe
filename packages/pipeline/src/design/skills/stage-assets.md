# Stage: assets

You are collecting the visual assets for the whole video, after the metaphors are approved and before any shot is written. The shooting script will be written **against what you actually secured** — a shot can only use an asset you vendored or a fallback you declared here.

**Your job is to come back with illustrations.** The project exists to fix visual density, and scenes are driven by substantial vector illustrations — not by icons, not by text, not by empty panels. A scene that ends this stage with zero or one secured SVG is a failed collection for that scene: either search harder or flag it loudly. Icons are decoration — too small to drive a visual — and never count toward a scene's coverage.

## Inputs you are given

- The **approved metaphor** per scene — its visual world and persistent objects. This is where needs come from.
- The **art direction** — including the `illustration` block: source order, recolor map, optional author lock. The recolor map and layer-dropping exist so that found assets can be *made* to fit the look.
- The narration per shot with durations, for judging how central a need is.

## Method

**1 · Derive the needs, generously.** Walk each scene's selected metaphor and list every visual object its world requires or suggests: hero objects, characters, props, environments, and an establishing visual for the scene's world itself. Name each in plain English ("workbench seen from the side", "hand reaching toward a panel"). Aim for **at least 2–3 illustration-sized needs per scene** — if a metaphor reads as pure line-work, its *subjects* still exist (the workshop behind the plan, the craftsperson behind the tool) and an illustration of the subject is how the scene gets its density.

**2 · Search until you find, not until you're satisfied.** For each need:

```
npx hyperframes-assets search "<need, plain English>" --project <project>
```

The chain (Storyset → Freepik → unDraw, or the order art direction declares) and author-lock ranking are applied for you.

- **Availability outranks style.** You do not have the luxury of rejecting candidates when choice is scarce. Take the best available depiction and adapt it: the recolor map pulls its palette onto the project tokens, Storyset's named layers (`Character_1`, `Background_Complete`, …) let you drop what doesn't fit, and the composition stage applies uniform treatment. A style mismatch is an ingest problem, not a rejection reason.
- **Exhaust the phrasings.** Try at least three per need — synonyms, the broader category, the activity instead of the object ("woodworking" when "workbench" fails), the emotional register ("focused work"). Then try the next source. A need is only unresolvable after the whole chain has been tried with multiple phrasings.
- **Depiction still matters.** Among available candidates, prefer the one that actually shows the need. But "imperfect and present" beats "perfect and absent" every time.

**3 · Fetch what you found.**

```
npx hyperframes-assets fetch <ref> --query "<need>" --project <project> --name <need-slug>
```

This vendors the SVG into `assets/illustrations/`, applies the recolor map, and records provenance. Note `dropLayers` for parts to hide.

**4 · Fallbacks are a last resort, and they are flags.** Only after the full chain and multiple phrasings fail may a need resolve as `typography` (set text carries it), `icon` (a named glyph — acceptable only for genuinely small garnish, never for a scene-driving visual), `primitive` (art-direction shape language), or `bespoke` (escalation to the human). Every fallback is a visible admission that collection failed for that need — the review gate exists so the human sees exactly where the video will be thin.

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
      "why": "best available depiction; background dropped, accent recolored to tokens"
    }
  ]
}
```

`resolution.kind` is `svg` | `typography` | `icon` | `primitive` | `bespoke`. An `icon` resolution names its glyph in `file`, or several in `files`. Every need gets a `why` — one line, judged not asserted.

## Discipline

- **Never draw an SVG yourself, and never leave a need silently unresolved.** Every need ends in a vendored file or a declared, flagged fallback.
- **Count your coverage before stopping:** per scene, how many `svg` resolutions? Fewer than 2 → go back to step 2 for that scene, or state plainly why the sources cannot serve it.
- One asset per need; the shooting script distributes, you collect.
- Do not write shot instructions, timings, or layout — that is the next stage.
- When the plan is written, stop for review. The human approves availability before any shot is scripted.

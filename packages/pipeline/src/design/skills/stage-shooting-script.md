# Stage: shooting script

You are writing the shooting script for one scene. This is the **instruction** the composition stage executes verbatim — not a discussion. Someone who has never seen the metaphor deliberation must be able to build the scene from your text plus the art-direction tokens, and nothing else. If a shot's entry is a terse hint, you have failed; compose will produce sparse video.

## Inputs you are given

- The scene's **metaphor** (the approved visual world, its candidates, why one was chosen). This is your source material. You consume it here and convert it into instruction. It is discussion; your output is directive.
- The **asset plan** (`design/assets.json`) and manifest — what was actually secured for this video, need by need: a vendored SVG, or a declared fallback (`typography` | `icon` | `primitive` | `bespoke`). Availability was decided before you; you distribute it across shots.
- The **narration** per shot, verbatim, with durations. This is the clock. Never change a duration.
- The **art direction** — palette tokens, type scale, shape language. Reference tokens by name (`--ink`, `--human`).

## Output: one addressable heading per shot, complete

Each shot is a heading — `### Shot 7 · 15.24s` — never a bold paragraph. Under it, declared fields on their own lines, then complete prose:

```
### Shot 7 · 15.24s
narration: "..."            (verbatim, the clock)
text objects: 2
on-screen words: 8
devices: marker-highlight, vox-annotate, text-stagger
assets: assets/icons/lucide/text-cursor.svg, assets/icons/lucide/terminal.svg

<complete visual instruction — see below>
```

The declared fields are read by the app and enforce the README §8d limits; get them right. Then the prose must specify, for the whole shot duration:

1. **Layout at the hero frame** — where every element sits, in the frame, using art-direction tokens for fill and stroke. Exact enough to place without guessing.
2. **What animates and how** — each element's entrance or transform, which catalog device drives it, the beat timing that fills the duration (e.g. "0–3s: … · 3–8s: …"). Account for the entire runtime; a shot that acts once and holds is a failure.
3. **Every asset named, from the plan** — the exact vendored file path for each glyph and illustration. You may only reference assets the plan resolved (`design/assets.json` + the vendored icon sets), and a need the plan resolved as a fallback must be executed as that fallback: `typography` means the shot's visual is set text, `icon` names its glyph, `primitive` means art-direction shape language. Honor any `dropLayers` the plan records for a vendored SVG. **Do not search, fetch, or invent assets here** — if a shot needs something the plan doesn't cover, that is a stage-assets defect: report it and stop rather than improvising.
4. **The mechanism, performed, never labelled** — if the narration says "syntax highlighting", instruct "grey code recolours token by token", not "show the label SYNTAX HIGHLIGHTING". A shot whose content is a list of terms violates the README §8d rules; rewrite it as something happening.

## Hard limits (the app rejects violations)

- **At most 3 text objects per shot.** A wall of labels is not density.
- **~2–3 words per second** of shot duration, on-screen — narration does not count.
- Timing is derived; never author or change a duration.

## Discipline

- Be complete but not discursive. This is a spec, not an essay: no meta-commentary about what changed, no restating the metaphor's reasoning, no alternatives. State what is on screen and what moves.
- Repeat the scene's own heading (`## Scene C · …`) so shot ownership is unambiguous.
- When done, stop. Do not lint, preview, render, or touch other files.

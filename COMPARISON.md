# Remotion vs. Hyperframes — Decision Support Report

Based on having built both:
- The Remotion app in `/Users/dliang17/Code/dliangthinks/remotion/` (32 themes × 12 layouts, per-scene files, deterministic theme/layout swaps)
- The Hyperframes port in this repo (single-file HTML + GSAP, one project end-to-end with the "Software Built for Humans" script)

---

## TL;DR

| Axis | Remotion | Hyperframes |
|---|---|---|
| **Token cost — first gen** | Higher (multi-file) | **Lower** (one-shot) |
| **Token cost — targeted edit** | **Surgical** | Whole-file rewrite |
| **Type-safety & refactor surface** | Strong (TSX) | None (HTML+JS strings) |
| **Motion graphics ceiling** | High | **Higher via GSAP** |
| **Camera / footage pipeline** | Offthread video | **Frame-extract via FFmpeg** |
| **Theme/layout extensibility** | 32 × 12 matrix, $0 AI swap | No native system; build from scratch |
| **Render infrastructure** | Lambda, mature | Single-machine, actively evolving |
| **License** | Source-available, paid above thresholds | Apache 2.0 |
| **Stability** | Years of production use | v0.4.x, daily churn |

**Recommendation**: stay on Remotion for the current app's shape. Reconsider if (a) you pivot toward footage-heavy or GSAP-style motion, or (b) you want a one-shot generation model and are willing to rebuild the theme/layout system.

---

## 1. Token efficiency

### First-gen — Hyperframes wins as a "one-shot"

**Concrete measurement from our run** (Software Built for Humans, 18 scenes, 132s):

| Framework | Output tokens (est.) | Tool calls | File count |
|---|---|---|---|
| Hyperframes | ~8–10 K (one 35 KB `index.html` + 2 lint-fix edits) | ~6 | **1** |
| Remotion | ~14–18 K (18 scene files + MyVideo + Root, ~2 KB each) | ~20+ | 20 |

Hyperframes' structural cohesion — everything in one file — means Claude writes it in one authoritative pass. No coordination between files, no cross-file imports to validate, no assembly step. This is a real "one-shot generation" pipeline.

For a product pitch of "paste a script → get a video", Hyperframes' ~40% fewer first-gen output tokens and simpler toolchain (no file-graph assembly) is a genuine advantage. You could reasonably build an agentless one-shot tool against Hyperframes; the Remotion equivalent would need multi-step coordination.

### Subsequent edits — Remotion wins decisively

| Change type | Remotion cost | Hyperframes cost |
|---|---|---|
| Theme swap | **$0** (deterministic `patchTheme`) | Full file regen |
| One sentence edited | 1 scene file | Full file regen |
| Layout swap, one scene | 1 scene file | Full file regen |
| Add/remove scene | 1–2 files + composition update | Full file regen |

Iteration cost on Hyperframes is roughly **5–10× higher per edit** than on Remotion for this app's change patterns.

**Net**: Hyperframes is better for generate-once-and-ship. Remotion is better for edit-iteratively workflows.

---

## 2. Ease to change

**For the agent (Claude writing)**:
- Remotion: React components are a strong format for Claude. `tsc` catches errors.
- Hyperframes: HTML+GSAP also a strong format; but the deterministic-timeline rules (no `Math.random`, no `repeat: -1`, no async tween construction, strict entrance/exit patterns) are easy to violate. Our run needed 2 lint-fix edits before passing.

**For the human reading/editing**:
- Remotion: requires understanding React + Remotion's Sequence/interpolate model.
- Hyperframes: a single `index.html`, scrollable and inspectable. Anyone who knows HTML/CSS can follow it — but timing edits require recomputing the whole `data-start`/`data-duration` cascade.

**Verdict**: tie, context-dependent.

---

## 3. Motion graphics — can Remotion duplicate everything Hyperframes does?

**Technically yes** — both render via browser engines. But there are categories where Hyperframes is meaningfully easier, and a few where Remotion has no practical equivalent without large custom work:

### Practically Hyperframes-only (without heavy Remotion custom work)

- **GSAP plugin ecosystem**: `MorphSVG` (path-to-path morphing), `SplitText` (character/word-level animation), `DrawSVG` (stroke-on animation), `MotionPath` (object-along-curve), `Flip` (layout-state tweens). These are battle-tested, dozens-of-lines-to-use solutions. Remotion equivalents are build-from-scratch React hooks, often hundreds of lines with correctness caveats.
- **CSS-native broadcast graphics**: Lower thirds, scoreboards, tickers with CSS `mask-image`, `clip-path`, `filter` chains. Remotion supports all the same CSS but expressing it through React props is friction vs. writing CSS directly.
- **Scrubbable timeline semantics**: GSAP's seek model is more frame-accurate at sub-frame precision than Remotion's integer-frame model.

### Remotion-only (without heavy Hyperframes custom work)

- **Distributed Lambda rendering**: No Hyperframes equivalent today.
- **React ecosystem leverage**: Any React library (Three.js wrappers, Framer Motion, recharts) drops in.

### Bottom line

Remotion *can* duplicate any Hyperframes motion graphics — but building, say, character-level text morphing or scroll-linked reveals costs substantially more engineering effort than reaching for GSAP. If motion graphics is the product (not typography narration), Hyperframes has a tangible head start.

For our current app (typography + narration + entrance animations), **both are overkill**; neither framework is the ceiling.

---

## 4. Camera footage / live video — Hyperframes has better engineering

This is a real differentiator worth calling out.

### Remotion's approach
- `<Video>` / `<OffthreadVideo>` components. Seeking in composition works but is sensitive to browser-ticker sync. Long videos with sub-second overlays can drift. `<OffthreadVideo>` is the recommended path and decodes via FFmpeg out-of-band.

### Hyperframes' approach
- `<video data-start data-duration>` elements with the runtime orchestrating playback.
- **Key engineering**: their producer pipeline extracts video frames via FFmpeg and **injects them as `<img>` overlays** during render. Source comment from their CLI:

  > "Chrome-headless cannot reliably advance `<video>.currentTime` mid-seek (the setter is accepted but the decoder ignores it without user activation), so the render pipeline already extracts each frame via FFmpeg and injects it as an `<img>` sibling over the `<video>`."

  This sidesteps a class of video-sync bugs that Remotion solves differently (offthread decoding).

### Impact

| Use case | Remotion fitness | Hyperframes fitness |
|---|---|---|
| Narration + graphics | Excellent | Excellent |
| Lower thirds over B-roll | Good | **Very good** |
| Interview cuts with overlays | Good, with `<OffthreadVideo>` | **Very good** |
| Gameplay/screencast montages | Good | **Very good** |
| Product demo walkthroughs | Good | **Very good** |

If you plan to pivot toward video-heavy content (podcast clips, interview cuts, product footage), **Hyperframes' footage pipeline is genuinely better engineered** than Remotion's. For pure typography narration like our current app, this doesn't matter.

---

## 5. Extensibility (theme & layout) — Remotion's existing moat

Your Remotion app has 32 theme presets and 12 layout presets, switchable via deterministic string-replace with zero AI cost. This investment doesn't port.

**Hyperframes has no native theme/layout system.** To reach parity:

1. Define a CSS-variable palette schema (colors, fonts, spacing) — ~1 day.
2. Author 32 palette presets as CSS files — ~3–5 days (mostly color design work).
3. Write a deterministic theme-patcher that swaps `<link rel="stylesheet">` — ~½ day.
4. Design a layout-primitive vocabulary (reusable HTML fragments) — ~3–5 days.
5. Rewrite `skill.md` to reference palettes + layout primitives — ~1 day.
6. Rebuild the ThemePanel + layout dropdown UI — ~1–2 days.

**Estimated cost**: 2–3 weeks of focused engineering. The work is straightforward but non-trivial.

---

## 6. Render infrastructure

**Remotion**: `remotion render` locally, Lambda for distributed rendering. Progress parsing is stable. Mature codec handling (H.264, H.265, ProRes, MP4/WebM/MOV).

**Hyperframes**: single-machine only today. Puppeteer + FFmpeg. Parallel workers via `--workers` flag. Progress output is a `\r`-refreshed TTY bar we had to parse empirically. No distributed story yet.

For a desktop app rendering short videos locally, this doesn't matter. For a hosted service rendering many videos concurrently, Remotion is ahead.

---

## 7. License & cost

- **Remotion**: Source-available. Free for individuals and small companies; commercial license required above thresholds.
- **Hyperframes**: Apache 2.0. Fully open. Zero licensing friction for any commercial use.

If license is a blocker or concern, this alone can swing the decision.

---

## 8. Rough edges we hit building the Hyperframes port

Concrete observations from our one-week build:

1. **`hyperframes snapshot` CLI bug**: captures blank PNGs for all but the final timestamp in a flat inline composition. No upstream issue filed. A related fix ([#391](https://github.com/heygen-com/hyperframes/pull/391)) addresses async-scene seek, not ours. We worked around it with an in-app "📸 Thumbnail (P)" button that captures the live webview frame.
2. **`hyperframes preview` opens a full Studio UI + auto-launches a browser tab** with no `--no-open` flag. We replaced it with our own ~150-line Node http server serving `@hyperframes/player`.
3. **Strict `exports` maps in `@hyperframes/core` / `@hyperframes/player`** force a filesystem walk to locate runtime assets (`require.resolve` doesn't work).
4. **Runtime/player API distinction (`seek` vs `renderSeek`, `enableRenderMode`)** is undocumented — you only learn from source.
5. **Very fresh codebase** (v0.4.17, daily releases). ~50 commits landed during our build session. Breaking changes more likely than on Remotion v4.

Remotion had its own gotchas (composition-id parsing, preload `.mjs`/`.js` split, etc.) but they don't shift.

---

## 9. Decision framework

**Stay on Remotion if:**
- Your 32-theme × 12-layout investment is valuable and the existing targeted-regen pipeline matches your iteration pattern.
- Token cost per edit matters (5–10× cheaper on Remotion).
- You want stability — Remotion v4 hasn't materially changed in months.
- React/TypeScript is your comfort zone.

**Switch to Hyperframes if:**
- You want a **one-shot generation pipeline** (script → video in one pass, no targeted regen).
- **Camera footage / B-roll is a first-class input** and you want their FFmpeg-frame-injection pipeline.
- You want to explore **GSAP-rich motion graphics** (text morphing, path animations, scroll-linked reveals).
- Licensing (Apache 2.0) is important for distribution.
- You can absorb 2–3 weeks to rebuild theme/layout system from scratch.
- You can tolerate rough edges and weekly breaking changes through v1.0.

**Hybrid (what I'd consider):**
- Keep Remotion as the main app.
- Keep this Hyperframes port as a scout — revisit in 3–6 months when: (a) v1.0 ships, (b) community publishes theme/layout libraries, and (c) the snapshot-blank bug class is resolved.
- If camera footage becomes a product requirement before then, the switching calculus changes immediately.

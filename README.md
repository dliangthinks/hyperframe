# Hyperframe Studio

**Date:** 2026-08-23

---

## 1. Where this sits

There have traditionally been three ways to make a video: shoot it with a camera, record a screen, or build it as motion graphics in creation software such as Adobe After Effects. AI is now adding a fourth — generative video models that synthesize footage directly from a prompt.

This app lives in the third category, through a practice that has long run alongside the After Effects tradition: **motion graphics written as code.** The results can look identical; the medium is different — a program that deterministically produces every frame, rather than a hand-operated timeline. It is not a new category of video. It is the motion-graphics category with the handwork removed: what traditionally had to be made by hand, keyframe by keyframe, an AI now authors as code.

Within code-based motion graphics, **Remotion** made the first big splash — video composed from React components, with the React ecosystem, mature distributed rendering, and cheap per-file edits behind it. **Hyperframes** is a more recent addition — a video described as plain HTML with GSAP timelines, bringing GSAP's battle-tested motion vocabulary (SVG morphing, stroke-draw, split text, motion paths) and a simpler one-pass generation model, under Apache 2.0. More frameworks will follow. This app builds on Hyperframes, for two reasons: GSAP's motion ceiling is exactly the dense, designed movement this app exists to produce, and Remotion's decisive advantages — surgical targeted edits, a theme system — are rebuilt here at the workflow level anyway (per-scene sub-compositions make edits surgical; art direction is a reviewable artifact, not a framework feature). The full analysis is in [COMPARISON.md](COMPARISON.md); nothing below depends on the choice, per principle 6.

## 2. The point: control

Both AI routes into video — prompting a generative model, and one-shot code generation over a framework like Remotion or Hyperframes — share the same pain: **they don't divide the work into stages.** A script goes in, a video comes out, and everything in between is the model's free interpretation. That is maximum creative freedom and minimum control: you cannot steer any particular part of any particular scene, and feedback means regenerating the whole thing and hoping.

This app is the answer to that, and it is the app's main point. The work is broken into distinct stages, defined as a **workflow**. Each stage produces an intermediate artifact; a human reviews each artifact in the app, item by item, gives feedback, and refines it before the next stage builds on it. Control is recovered exactly where the one-shot approaches surrendered it — at every joint — so the final output closely follows the original intention instead of the model's first guess.

The loop, end to end: a workflow defines an ordered chain of stages; each stage dispatches an AI agent that authors one artifact — a JSON file on disk; the app renders that artifact as an interactive, purpose-built review surface; a human reviews it item by item, approves or gives feedback; feedback dispatches an agent to revise; revisions come back as proposals that need approval in turn; and an approval that changes anything marks every downstream artifact stale, so nothing built on a superseded decision survives unexamined.

The engine is workflow-agnostic — stages, their order, and their dependencies are data, not code (§4) — and platform-agnostic: which AI authors a stage, and which framework renders the result, are configuration behind seams, not architecture (§7). The first and so far only built-in workflow turns a finalized narration script into a faceless explainer video whose graphics are dense, coherent, and designed — described in §8 as an *example* running on the machinery, not the machinery itself.

One terminology rule is enforced in this document: the chain of stages is a **workflow**, never a "pipeline." A pipeline is something data flows through unattended. The entire point of this app is that a human stands at every joint.

## 3. Principles

1. **Artifacts are the contract.** Files on disk are the interface between the engine, the app, and any future entry point. Nothing is held only in a conversation.
2. **Artifacts are user-facing.** Every artifact the workflow produces is presented *inside the app* — rendered, interactive, reviewable item by item. Nobody opens these files in a separate editor to review them. Disk is the transport and the source of truth; the app is the surface (§6).
3. **Top-down, never out of order.** Each stage exists because the next one cannot be decided without it. Asking for downstream detail early means making forty small decisions before the three large ones.
4. **The app never authors.** Agents author artifacts; the app dispatches, renders, and records decisions. It does not write artifact prose, does not generate compositions, does not decide anything the artifacts don't already say (§7).
5. **Revision is proposal, then approval.** An agent revising an artifact appends a proposal; it never overwrites a human-approved decision. Approval is an explicit human action, and it is what propagates change downstream (§6).
6. **Bind to stable surfaces.** Against upstream libraries, bind to the composition file format — data attributes, variables, sub-composition mounts — not to library internals. The churn that hurt in April was entirely internal, and the format has since held clean across four minor upstream versions.
7. **Build only what is user-facing.** The app's own code exists to help a person track, review, and revise artifacts. Everything that is not user interaction — authoring, rendering, checking — belongs to a swappable layer behind a seam, and swapping is configuration (§7).

## 4. Architecture

Four concepts sit above any particular stage. Stages are just entries in a workflow; these are the machinery.

### Workflows — structure as data

A **workflow** is a data file, not code: an ordered list of stages, each declaring the **skill** that authors it, the **artifact** it writes, the **pane** the app reviews it in, and the stages it **depends on**.

```
stage := { id, label, skill, doc?, pane, dependsOn[], input?, fields[] }
```

- **`dependsOn`** is the dependency graph. Context assembly for a re-run reads upstream from it; staleness propagates downstream from it. Neither is hardcoded to any stage count.
- **`input: true`** marks authored input (e.g. a narration script) — locked, never generated.
- **`fields`** declares the structured fields this stage's items must carry (e.g. a candidate's `status`, a shot's `text objects` count), so the app can act on them without parsing prose.

Built-in workflows ship with the engine ([workflows/](packages/pipeline/src/design/workflows/)); a project overrides or forks by dropping its own `<id>.workflow.json` in `design/workflows/`. Adding a "sound design" stage or dropping "art direction" is an edit to a workflow file, not to code. The app validates a workflow before running it — unknown panes, forward or missing dependencies, duplicate ids are refused ([workflow.ts](packages/pipeline/src/design/workflow.ts)).

### Skills — authoring instructions as documents

A **skill** is a markdown document that tells a dispatched agent how to author one stage: its hard contract, its scope, what it receives, what it must refuse to do. Skills live in [skills/](packages/pipeline/src/design/skills/) and are handed to a fresh Claude Code agent as its brief when the stage runs or re-runs.

A skill is where craft accumulates. `stage-composition.md`, for example, carries eleven hard rules learned from broken renders (animate transforms only, inline icons per instance, no `../` asset paths) plus the visual-language rules of §8d — none of which belong in engine code, all of which determine output quality.

Skills and workflows are the two independent knobs: **swapping a skill tweaks quality; swapping a workflow tweaks structure.** A stage names its skill by id, so a workflow can rebind a stage to a stricter or looser skill without touching the sequence.

### Artifacts — JSON, on disk, and the spine

Every artifact a workflow generates is **JSON**, so structure is declared, not parsed out of prose. Prose still exists — as string fields inside the JSON (a candidate's description, a shot's instruction). What lives in structure is everything the app acts on: which items exist, which is selected, what depends on what, the concrete values a pane paints.

One derived file, `design/index.json`, is the machine-readable spine: ids, timings, real token values, stage staleness flags, and every reviewable item — assembled from the stage artifacts so the app reads one file. Generated code (a composition HTML file) is the one non-JSON artifact, because it is code, not a design decision.

Inheritance is **enforced by shape**: a downstream artifact is an overlay keyed by upstream ids that can only *add* fields. It cannot change how many items exist or restructure what it inherited — that is the upstream stage's property. A revised idea therefore cannot silently rewrite the skeleton it hangs on.

### Panes — a fixed review vocabulary

The app renders a fixed vocabulary of pane types: `narration`, `timeline`, `tokens`, `candidates`, `shotlist`, `composition`, `raw`. A workflow may reorder, add, or drop stages freely, and each stage names the pane that fits it. A genuinely new *kind* of view is the only thing that needs new code — that is the boundary between data-driven and code.

## 5. Review happens in the app

This deserves its own section because it is easy to misread "artifacts on disk" as "internal intermediate files." They are not. **The artifacts are the product surface.**

- Every stage's artifact is rendered in the app the moment it exists on disk. There is no separate viewer, no opening JSON in an editor, no markdown preview step. The app watches the project and the review surface *is* the file, painted.
- Review is **per item**, not per file. A scene, a metaphor candidate, a shot, a palette token — each is individually addressable, individually renderable, and individually the target of feedback. The underlying JSON item can be inspected raw when wanted, but the default view is purpose-built.
- Each stage gets a **purpose-built pane**, because the review activity differs per stage and a single prose blob serves none of them. The strongest case: palette tokens as *painted swatches and type specimens*. The first palette in this project was described in prose, approved, and only revealed as drab after 45 seconds of video had rendered. A rendered swatch strip catches that in one second. Likewise a proportional timeline makes "scene C is 34% of the runtime" a visual fact, and a duration-proportional filmstrip is the only view where dead air and overstuffed shots are visible.
- A `raw` pane remains available as fallback and as the window onto the source of truth.

This surface is what the app *is* — raw JSON files are very hard to look at and harder to manipulate by hand, and making them trackable, reviewable, and revisable is the app's value. It is also where the app grows: revision history is already first-class (notes, proposals, approvals — §6), and a planned expansion is **generation versions** — keeping multiple generations of one artifact side by side so the user can compare them and decide which to keep, rather than each re-run overwriting the last (§9).

## 6. Feedback, revision, approval — the loop

Feedback is not a message. A note **names a target** — a specific item in a specific artifact — and applying it re-runs that target. It is a *pending mutation on the artifact dependency graph*, and order comes from the graph, not from when it was typed. The full loop ([feedback.ts](packages/pipeline/src/design/feedback.ts), [runner.ts](packages/pipeline/src/design/runner.ts)):

**1 · A note is written against a hash.** Each note records the content hash of the item it was written about. If the item has changed by the time the note is applied, the note is flagged as *drifted* rather than applied blind to a version it was never about.

**2 · Notes are planned into a batch.** Several notes on one item merge into a single re-run — never a race. Targets are sorted upstream-first by stage, so a downstream re-run always sees the *new* upstream result, not the state the batch began in. The batch runs serially for the same reason.

**3 · Applying dispatches an agent per target.** The app assembles a **context envelope** for the target and dispatches an agent with it (via the configured AI platform — §7). The envelope is derived, never guessed: the target's current content and hash; its ancestor chain with durations and share of the whole; the authored input it must serve, verbatim; **what its siblings already committed to**, so a re-run cannot duplicate what another item is doing — the piece a naive per-item re-run misses; upstream stages only, never its own downstream; the workflow's rules; and the target's full note history, oldest first, with drift marked — "less text" followed by "now too sparse" only makes sense read together.

**4 · The revision comes back as a proposal, not an edit.** For decision-bearing items, the agent *proposes* — a new candidate appended with status `proposed`, history preserved and ordered. The agent never touches the selection. (For leaf items whose content carries no approval state, the agent edits the item's section in place, surgically, under a system prompt that forbids touching anything else.)

**5 · The human approves — and approval propagates.** Approval is an explicit action in the app: it sets the selection, marks the notes applied, and — the consequential part — **marks every downstream stage stale**, per the workflow's dependency graph. Staleness is persisted onto `index.json`, so a dependent stage *refuses to run* until its inputs are re-approved. A revised decision therefore cannot coexist with outputs built on the decision it replaced; the graph forces the downstream re-run, and each re-run arrives back at step 4's gate.

The loop is intentionally conservative: agents propose, humans decide, and the only way change moves downstream is through an approval. This is slower than letting revisions cascade automatically, and that is the point — every artifact in the chain has, at all times, been looked at by a person in its current form or is explicitly flagged stale.

## 7. Division of labor — and the boundaries we hold

One rule decided what this app builds and what it refuses to build: **everything built here is user-facing.** The app's own code exists to help a person track artifacts, review them, and follow their revisions. Everything that is not user interaction sits behind a seam, is somebody else's job, and swaps by configuration. Two consequences follow: maximum independence from any one AI platform or video framework, and an app whose value does not change when either is swapped out.

**Agents — author. The AI platform is configuration.** Each stage and each revision is a dispatched agent run, briefed by its skill and its envelope. The engine talks to an [`AIProvider`](packages/pipeline/src/types.ts) interface, never to a vendor. Today's implementation is the Claude Code CLI, spawned as a process under the user's own authorization token (spawn, parse `stream-json`, resume a session for multi-turn refinement on one target — [claude-code-provider.ts](packages/pipeline/src/ai/claude-code-provider.ts); verified against CLI 2.1.222: `--print`, `--output-format stream-json`, `--verbose`, `--system-prompt`, `--model`, `--resume` all present, parsed event shapes unchanged). A direct API client, Codex, or any other platform is simply another implementation behind the same seam — and multiple mechanisms can coexist, chosen per purpose (a cheap model for a mechanical stage, a strong one for the creative core). Like workflows, the platform is a matter of configuration, not architecture. Any stage is independently re-runnable from the terminal; the artifacts on disk make the terminal and the app equivalent entry points.

**The app — user interaction. Never authors.** It assembles envelopes, dispatches the provider, streams progress back into the review surface, and turns review gestures into recorded decisions. It does not write artifact prose, does not generate compositions, does not render video. This is the one part that cannot be swapped out, because it is the product: managing artifacts a human could not reasonably manage as raw JSON files.

**The video framework — the base layer, whose territory we do not take.** Everything mechanical belongs to the framework and its CLI: scaffolding, catalog search and install, lint, check, preview, render, transcribe, beats — consumed via documented commands with `--json`, and via its SDK for scoped edits against generated compositions. Today that framework is Hyperframes. Tomorrow the app may support others — Remotion compatibility, pieces of Remotion incorporated, frameworks that do not exist yet — and the boundary is what makes that possible: the app never re-implements what a framework does, because the frameworks are the base layers the app helps people make good use of, and duplicating their territory is how independence dies.

## 8. The built-in workflow: faceless explainer

Everything above is the machinery. What follows is the first workflow built on it — the reason the machinery exists, and the richest example of how to design one. **None of it is engine behavior**; it is the content of `faceless-explainer.workflow.json` and its skills.

**Purpose:** turn a finalized narration script into an explainer video whose graphics are dense, coherent, and designed — diagrams, typography, data, abstract metaphor — not captions on a colored background. The working model is film pre-production: a director handed a script does not begin with a shot list; they begin with a breakdown, then the look, then concept work, and only then shots. That order is a dependency graph, not a convention.

**Workflow-specific principles:**

- **Narration is the clock.** The script and its per-shot audio arrive final and immutable. Every duration downstream is *derived*, never authored; no design decision may change timing.
- **Motion budget governs shot length.** Every shot must earn its duration with movement — why shots stay sentence-sized and continuity lives one level up.
- **Compose, don't invent.** Select from the upstream catalog and project assets; author new work only when nothing fits. Generating from scratch every time is what makes every video look the same.

**Vocabulary:** a **shot** is the smallest controllable unit — normally one sentence, one narration beat, one motion budget. A **scene** is a run of consecutive shots advancing one idea — it owns the metaphor and therefore the continuity, and no motion of its own. A **metaphor** is what a scene's abstract concept is *shown as*. An **object** is a named visual element that may persist, transform, or enter across shots.

**Input is structured:** headings in the script define scene boundaries (authored, never inferred); sentences define shots by default (resolved at the shooting-script stage, not before). Narration audio is pre-generated per shot; the timing manifest is authoritative. Because the entire script exists before design begins, every stage sees the whole argument — the structural advantage of narration-first, and what the stage ordering depends on.

### 8a. The stages

| Stage | Film analog | Artifact | Pane |
|---|---|---|---|
| 0 · Narration lock | the script | authored input + timing manifest | narration |
| 1 · Breakdown | script breakdown | `breakdown.json` | timeline |
| 2 · Art direction | look development | `art-direction.json` | tokens |
| 3 · Metaphor | concept art | `metaphors.json` | candidates |
| 4 · Assets | prop & asset breakdown | `assets.json` + `asset-manifest.json` | assets |
| 5 · Shooting script | shot list & storyboard | `shooting-script.json` | shotlist |
| 6 · Composition | principal photography | HTML per scene | composition |
| 7 · Verify | dailies | `check` findings per shot | — |

**1 · Breakdown — how long is this thing, and where is its weight.** Sentence count, runtime from the manifest, the authored section division, per-section share, and section-level function only (sets up / turns / pays off). Orientation before commitment: "section 3 is 40% of the runtime and needs more visual range" becomes visible while it is still cheap to know. Explicitly absent: shot boundaries, visual ideas. This artifact owns shot structure — everything downstream inherits its skeleton.

**2 · Art direction — one global look.** Palette with roles, type system, shape language, surface treatment, motion character. Global rather than per-scene, because coherence is what makes a piece read as designed — and safe to decide early *because* the whole script is known. The look is chosen against the catalog's coverage shape: the hand-drawn annotation family is the catalog's best-served region while representational imagery is absent, so an annotation-led language is both cheaper and better executed. That is art direction legitimately reading a downstream stage's constraints, not a leak.

**3 · Metaphor — the creative core, and the stage most likely to fail.** For each scene: what is the idea *shown as*. Several candidates per scene, argued rather than asserted; honor metaphors the prose already carries before inventing any; describe what is on screen (shape, line, color, position, motion), never the concept behind it; quote the narration verbatim under each scene so no reviewer holds two files open; and give every shot a duration verdict with the arithmetic written out — one action followed by a hold is how a good metaphor produces a sparse video. Each candidate carries a production-cost signal (schematic domains resolve from the catalog; representational domains are bespoke authoring). Divergence lives here rather than at shot level, which is what makes it affordable: three options across five concepts is fifteen proposals, not a hundred and twenty.

The failure mode is **banality** — the first metaphor is the culturally exhausted one. Four mandatory countermeasures: constrain the source domain (cartographic, mechanical, architectural, typographic, biological, textile — rotated across the piece); require the metaphor to be load-bearing (can it carry the next three sentences and survive the turn in the argument?); name the obvious option and reject it on the record; judge against the argument, not the aesthetics.

**4 · Assets — collect before scripting.** The approved metaphors are walked into a list of concrete visual needs — hero objects, characters, props, environments — and each need is resolved against the asset sources (§8f) *before any shot is written*. The stage's mandate is to **come back with illustrations**: scenes are driven by substantial vector art, and a scene that ends collection with fewer than two secured SVGs is flagged as thin. Availability outranks style — with scarce candidates there is no luxury of rejection; the best available depiction is taken and *adapted* (recolored onto the tokens, unwanted layers dropped, uniform treatment downstream). Icons never count toward coverage — too small to drive a visual, they are garnish. Only after the whole chain fails across multiple query phrasings may a need resolve as a **declared fallback** — typography, an icon glyph, art-direction primitives, or a `bespoke` escalation — and every fallback is a visible admission of a thin spot, surfaced at the review gate. The output, `design/assets.json`, maps every need to its resolution with a one-line justification. This stage exists because a shooting script written against assets that turn out not to exist is fiction — availability constrains the script, never surprises it.

**5 · Shooting script — now, and only now, break scenes into shots.** Per shot: its purpose, its manifest duration, what it inherits from the scene's metaphor, what it contributes, and two resolutions — a **motion device** from the upstream catalog, and a **visual** drawn from the asset plan: a vendored file, or the fallback the plan declared for that need, executed as declared. The stage never searches or fetches; a need the plan doesn't cover is a stage-4 defect to report, not improvise around. A technical stage: the creative decisions are made; this distributes them across the timeline.

**6 · Composition — transcription.** One HTML file per scene, mounted as sub-compositions from the root — per-scene surgical editing without leaving the HTML + GSAP model. By this stage generation is transcription: metaphor, look, assets, and timing are all locked.

**7 · Verify.** Upstream `check` as the automated gate — runtime errors, layout overflow/overlap/occlusion, WCAG contrast, motion assertions, the static-timeline catch — findings surfaced **per shot** in the app. Then preview, then render on approval.

### 8b. Discussion up, instruction down

Two artifacts look similar and are not, and confusing them dilutes directive content into sparse video. **Metaphor is discussion** — candidates, rejections, reasoning — read by the shooting-script stage as source material, never by composition. **The shooting script is instruction** — layout at the hero frame in named tokens, what animates and how, beat timing that fills the duration, the exact asset path for every glyph; someone who never saw the metaphor must be able to build the scene from it plus art direction, and a terse hint is a shooting-script defect. **Composition reads exactly two things — the shooting script and art direction** — enforced by its declared `dependsOn`, not left to convention. Otherwise the metaphor doc accretes rich prose while the script stays cryptic, and composition either starves or drowns.

### 8c. Continuity toolkit

A scene's metaphor creates semantic clustering without asking any shot to sustain more duration than its motion budget allows. The shooting script chooses explicitly among: **progressive disclosure of a stable frame** (world established in the scene's first shot; each later shot animates exactly one new part — highest value); **a persistent object that transforms across the cut**; **spatial grammar** (cause enters left, consequence resolves right; abstract up, concrete down — free and invisible); **camera instead of cut** (pan or push to another region of the same implied canvas). None reduce what a shot does; they make consecutive shots agree.

### 8d. Visual language rules

Learned by building one scene badly three times; enforced by the skills, machine-checked where the declared fields allow.

- **Demonstrate the mechanism; do not label it.** "Syntax highlighting lets human eyes parse structure" is not a caption reading `SEMANTIC TOKENS` — it is real code, flat grey, with color washing in until structure pops. If a concept can be shown operating, showing it is always correct and naming it is always weaker.
- **At most three text objects per shot.** Eight labels is not density — nobody reads eleven things in five seconds; it is noise that looks like information. A shot whose content is a list has the wrong visual idea, and the metaphor stage re-runs for it.
- **Text must be readable in its screen time.** Two to three words per second of shot duration, counted — a 5s shot carries about a dozen words including any caption. `textObjects` and `words` are declared fields, so both limits are machine-checkable before anything renders.
- **An icon beside a label is not a visual.** Decorated text is text. Icons earn their place when they *are* the object being manipulated.
- **Real vocabulary as content inside a demonstration, not as an annotation layer.** Show `git status` output, not the word `GIT`. Labels drawn from the subject's real vocabulary remain the cheapest density available — no drawing, no motion authoring, no catalog dependency — and a research pass for real terms is the difference between authored and templated.
- **Source graphics; never generate SVG on the spot.** Icons come from existing high-quality libraries — Lucide, Tabler, Phosphor, Iconoir, Simple Icons — and illustrations through the asset-source adapters (§8f); everything is downloaded into `assets/` and inlined per instance (an SVG `<use>` sprite fails: the runtime captures only the composition root). An agent drawing its own SVG is the quality floor this rule exists to prevent.

### 8e. Surgical control

Not a separate feature — the artifact chain *is* the mechanism: a change re-runs only what genuinely depends on it.

| Change | Cost |
|---|---|
| Color, font, spacing | Nothing — composition variable swap, no AI |
| Tween timing, easing, position | Nothing — scoped edit on the composition |
| One shot's asset or device | Composition, that scene only |
| One shot's intent | Shooting script + composition, that shot only |
| A scene's metaphor | Shooting script + composition, that scene only |
| Art direction | Composition, all scenes — every metaphor survives |
| Narration reworded, same length | Composition, that scene — the metaphor survives |
| Narration length changed | Timing re-derivation, then affected scenes |
| A section added or removed | Breakdown onward |

Metaphor and timing are separate artifacts precisely so the last three rows stay cheap.

### 8f. Asset sources

The §8d rule — never generate SVG on the spot — is implemented as **asset-source adapters**: small clients ([assets/](packages/pipeline/src/design/assets/)) that search an external library per visualization need and vendor the chosen SVG into the project. Collection runs as its own stage (stage 4), after the metaphors are approved and before the shooting script — availability is decided first, and the script is written against it.

**The chain is Storyset → Freepik → unDraw**, quality-ordered; a source that errors or returns nothing falls through to the next, and art direction can reorder it. One Freepik API key (in `.env` as `FREEPIK_API_KEY`) covers both Storyset — which has no API of its own but lives in the Freepik catalog under author `storyset` — and the stock vector catalog, with direct SVG downloads; assets without an SVG format are dropped, never converted. unDraw's public API is the keyless fallback. Storyset earns first place twice over: the most detailed illustrations, and SVGs that arrive **layered with named groups** (`Character_1`, `Background_Complete`, `Floor`, …) so individual objects can be animated separately and backgrounds dropped.

**Selection stays human.** `hyperframes-assets search` returns candidates for review; `fetch` vendors the one the reviewer (or the skill, within declared constraints) picked, and records provenance — source, id, author, query, license page, date — in `design/asset-manifest.json`. No bulk vendoring, no scraping.

**Consistency is achieved by adaptation, never by rejection.** Availability is the priority — the sources are finite, and a collection stage that filters on style reproduces the sparse look this app exists to eliminate. The levers make what was *found* cohere, in descending order of leverage:

1. **Recolor at ingest.** Art direction may declare a hex→hex map; every fetched SVG is remapped onto the project tokens before it touches disk. Flat illustration styles encode color as literal hex fills, so this is a string remap — shared ink is what makes assets from different sources read as one system.
2. **Layer dropping.** Storyset SVGs arrive with named semantic groups; the plan records `dropLayers` so backgrounds and off-metaphor parts are hidden rather than the whole asset rejected.
3. **Author lock.** On the Freepik marketplace, consistency is an author property. Authors already in the manifest (plus any declared `authorLock`) rank first in every subsequent search, so a video that starts with one artist stays with them.
4. **Style-family preference.** Storyset's five styles (Rafiki, Bro, Amico, Pana, Cuate) are internally consistent; art direction may declare one as the preference. It ranks candidates; it does not reject the only available match.
5. **Uniform treatment.** The composition skill applies the same scale, background handling, and entrance devices to every asset.

## 9. Roadmap

Ordered by priority, not by date. One thing is urgent; everything else is a future version.

### Now — make the faceless explainer workflow consistently good

The single current priority is output quality: run the built-in workflow (§8) end to end, repeatedly, until it reliably produces satisfying video. Every mechanism in this document exists to serve that, and nothing further down this list matters until it holds.

Part of this priority is **visuals beyond typography**, and its mechanism is deliberate: **never generate SVG on the spot** — generated-on-demand graphics are inconsistent and low-quality. Icons come from the vendored open sets (Lucide, Tabler, Phosphor, Iconoir, Simple Icons — §8d); illustrations now come through the asset-source adapters (§8f), tested against the reference project's real needs: Storyset matched 13 of 14, Freepik 14 of 14, unDraw 12 of 14. What remains here is exercising the adapters inside a full workflow run and tuning the consistency levers against real output.

### Future versions, roughly in priority order

- **Generation versions.** Multiple generations of one artifact retained side by side, compared in the pane, one kept. The proposal mechanism (§6) is the seed — metaphor candidates already accumulate rather than overwrite — but generalizing it to every artifact kind is not yet designed.
- **A metaphor repertoire.** Metaphors that work should accumulate across projects — the upstream catalog's compounding logic, but for ideas.
- **The catalog's on-device search tier.** The default tier ranks on shared vocabulary and is noisy; the on-device tier ranks by meaning and would materially help the shooting-script stage. One-time ~33 MB download, nothing sent anywhere.
- **Beat-level (word-offset) sync:** wire into the shooting script, if scene-level sync proves insufficient.
- **Deciding who owns re-running a stage** when both the app and the terminal skill could.
- **Finish shedding the old skin.** The engine package is still `packages/pipeline`; feedback targets (`scene`, `candidate`, `shot`, `token`) and the stage-number mapping in [feedback.ts](packages/pipeline/src/design/feedback.ts) are still the explainer workflow's vocabulary rather than derived from the workflow definition. The structure is workflow-agnostic; the item vocabulary is not yet.

### Eventually

- **Other AI platforms** behind the `AIProvider` seam (§7) — direct API, Codex, others, including several at once chosen per stage.

### Further down the road

- **Other frameworks** (§7) — Remotion compatibility, pieces of Remotion incorporated, or frameworks that do not exist yet. The boundary in §7 is what keeps this possible without rework.

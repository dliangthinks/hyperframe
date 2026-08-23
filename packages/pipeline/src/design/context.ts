import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sectionMap } from "./sections.js";
import { hash, parseTarget, readNotes, siblingSelections, type Note } from "./feedback.js";
import type { DesignIndex, DocKey, SceneRef, ShotRef } from "./types.js";

/**
 * Assembles the context envelope for re-running one target.
 *
 * A note on its own is a fragment. What a re-run needs is derivable from the
 * dependency chain: the target as it stands, its ancestors, every upstream stage
 * that constrains it, the rules it must satisfy, its own feedback history, and
 * what its siblings already committed to — that last one is how a re-run avoids
 * repeating a metaphor another scene is already using.
 *
 * Nothing here is guessed. Everything comes from index.json and the documents.
 */

const DOCS: Record<DocKey, string> = {
  breakdown: "01-breakdown.md",
  artDirection: "02-art-direction.md",
  metaphors: "03-metaphors.md",
  shootingScript: "04-shooting-script.md",
};

export interface ContextEnvelope {
  target: string;
  stage: number;
  /** The target's current prose, and the hash the notes were written against. */
  current: { anchor: string; body: string; hash: string };
  /** shot → scene → project, nearest first. */
  ancestors: { kind: string; id: string; label: string; detail: string }[];
  /** Narration this target must serve, verbatim. Always present. */
  narration: { id: string; duration: number; text: string }[];
  /** Approved upstream artifacts that constrain the re-run. */
  upstream: { stage: number; label: string; body: string }[];
  /** What the other scenes already committed to. */
  siblings: { scene: string; title: string; metaphor: string }[];
  /** Hard limits the output must satisfy (README.md §8d). */
  rules: string[];
  /** Every note on this target, oldest first. Drift is flagged per note. */
  history: (Note & { drifted: boolean })[];
}

const RULES = [
  "Demonstrate the mechanism; do not label it. If a concept can be shown operating, show it.",
  "A shot may hold at most 3 text objects. A list of labels is not density.",
  "Text must be readable in the time it is on screen: roughly 2–3 words per second of duration.",
  "An icon beside a label is not a visual.",
  "Source graphics from named libraries; never hand-draw them. Inline them, never via an SVG sprite.",
  "Timing is derived from the manifest and may not be changed.",
];

export async function contextFor(
  projectPath: string,
  target: string,
): Promise<ContextEnvelope | null> {
  const dir = join(projectPath, "design");
  const index = JSON.parse(
    await readFile(join(dir, "index.json"), "utf8"),
  ) as DesignIndex;

  const maps: Partial<Record<DocKey, Record<string, string>>> = {};
  const rawDocs: Partial<Record<DocKey, string>> = {};
  for (const [k, f] of Object.entries(DOCS) as [DocKey, string][]) {
    try {
      const md = await readFile(join(dir, f), "utf8");
      rawDocs[k] = md;
      maps[k] = sectionMap(md);
    } catch {
      /* a missing upstream doc is reported by the index writer, not here */
    }
  }
  const resolve = (anchor: string) => {
    const [doc, slug] = (anchor ?? "").split("#");
    return maps[doc as DocKey]?.[slug] ?? "";
  };

  const { kind, id } = parseTarget(target);

  let anchor = "";
  let stage = 0;
  let scene: SceneRef | undefined;
  let shot: ShotRef | undefined;
  const ancestors: ContextEnvelope["ancestors"] = [];

  if (kind === "candidate") {
    scene = index.scenes.find((s) => s.candidates.some((c) => c.id === id));
    const cand = scene?.candidates.find((c) => c.id === id);
    anchor = cand?.anchor ?? "";
    stage = 3;
  } else if (kind === "scene") {
    scene = index.scenes.find((s) => s.id === id);
    anchor = scene?.anchor ?? "";
    stage = 3;
  } else if (kind === "shot") {
    shot = index.shots.find((s) => s.id === id);
    scene = index.scenes.find((s) => s.id === shot?.scene);
    anchor = shot?.anchor ?? "";
    stage = 4;
  } else if (kind === "token") {
    stage = 2;
  } else if (kind === "stage") {
    stage = Number(id) || 0;
  }

  if (shot) {
    ancestors.push({
      kind: "shot",
      id: shot.id,
      label: `Shot ${shot.id}`,
      detail: `${shot.duration.toFixed(2)}s · devices: ${shot.devices.join(", ") || "none"}`,
    });
  }
  if (scene) {
    const selected = scene.candidates.find((c) => c.status === "selected");
    ancestors.push({
      kind: "scene",
      id: scene.id,
      label: scene.title,
      detail: `${scene.duration.toFixed(1)}s · ${Math.round(
        (scene.duration / index.runtime) * 100,
      )}% of runtime · ${scene.source}${
        selected ? ` · metaphor: ${selected.label}` : ""
      }`,
    });
  }
  ancestors.push({
    kind: "project",
    id: "project",
    label: "Whole piece",
    detail: `${index.scenes.length} scenes · ${index.shots.length} shots · ${index.runtime.toFixed(1)}s`,
  });

  // Narration the target must serve — the clock, quoted verbatim.
  const narration = (
    shot
      ? [shot]
      : scene
        ? scene.shots.map((sid) => index.shots.find((s) => s.id === sid)!).filter(Boolean)
        : index.shots
  ).map((s) => ({ id: s.id, duration: s.duration, text: s.narration }));

  // Upstream stages only. A stage never sees its own downstream.
  const upstream: ContextEnvelope["upstream"] = [];
  if (stage > 1 && rawDocs.breakdown)
    upstream.push({ stage: 1, label: "Breakdown", body: rawDocs.breakdown });
  if (stage > 2 && rawDocs.artDirection)
    upstream.push({ stage: 2, label: "Art direction", body: rawDocs.artDirection });
  if (stage > 3 && scene)
    upstream.push({
      stage: 3,
      label: `Metaphor for ${scene.title}`,
      body: resolve(scene.anchor),
    });

  const body = resolve(anchor);
  const notes = await readNotes(projectPath);
  const h = hash(body);

  return {
    target,
    stage,
    current: { anchor, body, hash: h },
    ancestors,
    narration,
    upstream,
    siblings: scene ? siblingSelections(index, scene.id) : [],
    rules: RULES,
    history: notes
      .filter((n) => n.target === target)
      .sort((a, b) => a.at - b.at)
      .map((n) => ({ ...n, drifted: Boolean(n.against) && n.against !== h })),
  };
}

/** Flatten an envelope into the prompt handed to the authoring stage. */
export function renderEnvelope(e: ContextEnvelope): string {
  const L: string[] = [];
  L.push(`# Re-run ${e.target} (stage ${e.stage})`);
  L.push("");
  L.push("## Where this sits");
  for (const a of e.ancestors) L.push(`- ${a.label} — ${a.detail}`);
  L.push("");
  L.push("## Narration it must serve (verbatim, immutable)");
  for (const n of e.narration) L.push(`- ${n.id} (${n.duration.toFixed(2)}s) — "${n.text}"`);
  if (e.siblings.length) {
    L.push("");
    L.push("## Already committed elsewhere — do not repeat these");
    for (const s of e.siblings) L.push(`- ${s.title}: ${s.metaphor}`);
  }
  if (e.upstream.length) {
    L.push("");
    L.push("## Upstream constraints");
    for (const u of e.upstream) {
      L.push(`### ${u.label}`);
      L.push(u.body);
    }
  }
  L.push("");
  L.push("## Rules");
  for (const r of e.rules) L.push(`- ${r}`);
  L.push("");
  L.push("## Current content");
  L.push(e.current.body || "(none)");
  if (e.history.length) {
    L.push("");
    L.push("## Feedback history on this item, oldest first");
    for (const n of e.history) {
      L.push(`- ${n.body}${n.drifted ? "  [written against an older version]" : ""}`);
    }
  }
  return L.join("\n");
}

import { EventEmitter } from "node:events";
import { contextFor, renderEnvelope } from "./context.js";
import { markApplied, planBatch, readNotes, invalidates, parseTarget, type BatchItem } from "./feedback.js";
import { addProposal, readMetaphors } from "./metaphors.js";
import { hash } from "./feedback.js";
import { sectionMap } from "./sections.js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AIProvider } from "../types.js";
import type { DesignIndex, DocKey } from "./types.js";
import { loadWorkflow } from "./workflow-loader.js";
import { downstreamOf } from "./workflow.js";

/**
 * Dispatches feedback re-runs. It never authors content.
 *
 * The runner's whole job is to hand an already-assembled envelope to Claude Code
 * and report what came back. It decides order (upstream first), it decides what
 * goes stale, and it decides nothing else — the artifact documents say what the
 * design is, and the authoring stage is what changes them.
 */

const DOCS: Record<DocKey, string> = {
  breakdown: "01-breakdown.md",
  artDirection: "02-art-direction.md",
  metaphors: "03-metaphors.md",
  shootingScript: "04-shooting-script.md",
};

const SYSTEM_PROMPT = `You are revising one section of a design artifact for a faceless-explainer video pipeline.

Edit only the section named in the envelope, in place, in its own document. Do not touch other sections, other documents, or any composition file. Do not change timings — narration is the clock and every duration is derived from the manifest.

Keep the section's declared fields intact and correct (status, cost, text objects, on-screen words, devices, assets). Keep every heading exactly as it is: heading text is the item's address, and changing it breaks every reference to it.

Obey the rules in the envelope. In particular: demonstrate a mechanism rather than labelling it, keep a shot to at most three text objects, and stay inside the reading budget.

Stay in your stage's scope. If you are revising a scene's metaphor, describe the scene's visual world and its candidates — do NOT author a per-shot breakdown (how many shots, their durations, or per-shot shot-by-shot detail). Shot breakdown is a downstream stage's job and is derived from the narration, not from the metaphor. Redefining it here corrupts the dependency chain.

Be concise. Edit surgically. Do not restate the whole section, do not add meta-commentary about what you changed or why, do not narrate your process. The reviewer reads this section directly, so verbosity is a cost. Return the minimal edit that satisfies the feedback.

When you are done, stop. Do not run the linter, do not preview, do not render.`;

export interface RunnerEvents {
  "batch:start": { items: number };
  "item:start": { target: string; stage: number; notes: number; drifted: boolean };
  "item:progress": { target: string; type: string; content: string };
  "item:done": { target: string; text: string };
  "item:error": { target: string; message: string };
  "batch:done": { applied: string[]; stale: number[] };
}

export class FeedbackRunner extends EventEmitter {
  constructor(private ai: AIProvider) {
    super();
  }

  async plan(projectPath: string): Promise<BatchItem[]> {
    const notes = await readNotes(projectPath);
    const current = await currentHashes(projectPath);
    return planBatch(notes, (t) => current.get(t) ?? null);
  }

  /**
   * Runs a batch serially, upstream first. Serial is deliberate: a stage 3 re-run
   * must see the stage 2 result from earlier in the same batch, which is only
   * guaranteed if nothing overlaps.
   */
  async apply(projectPath: string, items?: BatchItem[]): Promise<string[]> {
    const batch = items ?? (await this.plan(projectPath));
    this.emit("batch:start", { items: batch.length });

    const applied: string[] = [];
    const stale = new Set<number>();

    for (const item of batch) {
      this.emit("item:start", {
        target: item.target,
        stage: item.stage,
        notes: item.notes.length,
        drifted: item.drifted,
      });

      // Rebuild the envelope per item so a downstream item sees the upstream
      // result produced moments ago rather than the state the batch began in.
      const envelope = await contextFor(projectPath, item.target);
      if (!envelope) {
        this.emit("item:error", { target: item.target, message: "Target not found in index." });
        continue;
      }

      const { kind, id: targetId } = parseTarget(item.target);
      const isMetaphor = kind === "candidate" || kind === "scene";
      if (isMetaphor) {
        // A metaphor revision is a NEW PROPOSAL, not an edit. The model proposes;
        // the human approves. Selection is untouched until an explicit approve.
        await this.proposeMetaphor(projectPath, item, envelope);
        applied.push(...item.notes.map((n) => n.id));
        for (const st of invalidates(item.target)) stale.add(st);
        this.emit("item:done", { target: item.target, text: "" });
        continue;
      }

      const message = [
        renderEnvelope(envelope),
        "",
        "## Apply this feedback",
        ...item.notes.map((n) => `- ${n.body}`),
        ...(item.drifted
          ? ["", "Note: some of the above was written against an older version of this section."]
          : []),
      ].join("\n");

      try {
        await this.ai.generate({
          cwd: projectPath,
          systemPrompt: SYSTEM_PROMPT,
          userMessage: message,
          onProgress: (p) =>
            this.emit("item:progress", {
              target: item.target,
              type: p.type,
              content: p.content,
            }),
        });
        applied.push(...item.notes.map((n) => n.id));
        for (const s of invalidates(item.target)) stale.add(s);
        this.emit("item:done", { target: item.target, text: "" });
      } catch (err) {
        this.emit("item:error", {
          target: item.target,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (applied.length) await markApplied(projectPath, applied);

    // Persist staleness onto the index so a dependent stage (e.g. compose) can
    // refuse until the intermediate is re-run. Workflow-driven, not hardcoded.
    const staleStageIds = await this.staleStagesFor(projectPath, batch.map((b) => b.target));
    if (staleStageIds.length) await this.writeStale(projectPath, staleStageIds);

    this.emit("batch:done", { applied, stale: [...stale].sort() });
    return applied;
  }

  /** Dispatch a proposal and append it to metaphors.json — never an in-place edit. */
  private async proposeMetaphor(
    projectPath: string,
    item: BatchItem,
    envelope: import("./context.js").ContextEnvelope,
  ): Promise<void> {
    const { kind, id: targetId } = parseTarget(item.target);
    const doc = await readMetaphors(projectPath);
    // Resolve which scene this target belongs to.
    let sceneId = "";
    if (kind === "scene") sceneId = targetId;
    else if (doc) {
      for (const [sid, sc] of Object.entries(doc.scenes)) {
        if (sc.candidates.some((c) => c.id === targetId)) sceneId = sid;
      }
    }
    if (!sceneId) throw new Error(`Cannot locate scene for ${item.target}.`);

    const prompt = [
      renderEnvelope(envelope),
      "",
      "## Task",
      "Propose ONE new visual metaphor candidate for this scene that addresses the feedback below.",
      "Output only the candidate: a first line `LABEL: <short label>`, an optional `COST: low|medium|high`,",
      "then a plain-English description of what is on screen and what moves. Do not edit any file, do not",
      "restate the other candidates, do not choose — the human approves.",
      "",
      "## Feedback",
      ...item.notes.map((n) => `- ${n.body}`),
    ].join("\n");

    let text = "";
    await this.ai.generate({
      cwd: projectPath,
      systemPrompt:
        "You propose one visual-metaphor candidate as plain text. You never edit files, never render, never choose the selection.",
      userMessage: prompt,
      onProgress: (p) => {
        if (p.type === "text") text += p.content;
        this.emit("item:progress", { target: item.target, type: p.type, content: p.content });
      },
    });

    const labelMatch = /LABEL:\s*(.+)/i.exec(text);
    const costMatch = /COST:\s*(low|medium|high)/i.exec(text);
    const label = (labelMatch?.[1] ?? "revised metaphor").trim().slice(0, 80);
    const body = text.replace(/^\s*LABEL:.*$/im, "").replace(/^\s*COST:.*$/im, "").trim();
    const at = envelope.history.length ? envelope.history[envelope.history.length - 1].at : 0;
    await addProposal(
      projectPath,
      sceneId,
      {
        id: `${sceneId.replace(/^scene-/, "")}-p${Date.now().toString(36)}`,
        label,
        cost: (costMatch?.[1] as "low" | "medium" | "high") ?? undefined,
        body,
      },
      at + 1,
    );
  }

  /** Map applied targets to their stage, then to the workflow-downstream stages. */
  private async staleStagesFor(projectPath: string, targets: string[]): Promise<string[]> {
    const wf = await loadWorkflow(projectPath).catch(() => null);
    if (!wf) return [];
    const toStage = (t: string): string | null => {
      const kind = t.split(":")[0];
      if (kind === "token") return "artDirection";
      if (kind === "candidate" || kind === "scene") return "metaphor";
      if (kind === "shot") return "shootingScript";
      return null;
    };
    const out = new Set<string>();
    for (const t of targets) {
      const sid = toStage(t);
      if (sid) for (const d of downstreamOf(wf, sid)) out.add(d);
    }
    return [...out];
  }

  private async writeStale(projectPath: string, stageIds: string[]): Promise<void> {
    const file = join(projectPath, "design", "index.json");
    try {
      const index = JSON.parse(await readFile(file, "utf8")) as DesignIndex;
      index.stages = index.stages ?? {};
      for (const id of stageIds) index.stages[id] = "stale";
      await writeFile(file, JSON.stringify(index, null, 2), "utf8");
    } catch {
      /* index not built yet */
    }
  }
}

/** Current content hash per addressable target, for drift detection. */
async function currentHashes(projectPath: string): Promise<Map<string, string>> {
  const dir = join(projectPath, "design");
  const out = new Map<string, string>();

  let index: DesignIndex;
  try {
    index = JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as DesignIndex;
  } catch {
    return out;
  }

  const maps: Partial<Record<DocKey, Record<string, string>>> = {};
  for (const [k, f] of Object.entries(DOCS) as [DocKey, string][]) {
    try {
      maps[k] = sectionMap(await readFile(join(dir, f), "utf8"));
    } catch {
      /* missing docs are the index writer's problem, not the runner's */
    }
  }
  const body = (anchor: string) => {
    const [doc, slug] = (anchor ?? "").split("#");
    return maps[doc as DocKey]?.[slug] ?? "";
  };

  for (const s of index.scenes) {
    out.set(`scene:${s.id}`, hash(body(s.anchor)));
    for (const c of s.candidates) out.set(`candidate:${c.id}`, hash(body(c.anchor)));
  }
  for (const s of index.shots) out.set(`shot:${s.id}`, hash(body(s.anchor)));
  for (const [name, value] of Object.entries(index.tokens ?? {}))
    out.set(`token:${name}`, hash(value));

  return out;
}

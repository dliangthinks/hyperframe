import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { DesignIndex, DocKey } from "./types.js";

/**
 * Feedback is not a message. It is a pending mutation on the artifact dependency
 * graph: it names a target, and applying it re-runs that target and invalidates
 * whatever depends on it. Order comes from the graph, not from when it was typed.
 */

export type TargetKind = "stage" | "scene" | "candidate" | "shot" | "token";

export interface Note {
  id: string;
  target: string;
  body: string;
  at: number;
  /** Hash of the target's content when the note was written. */
  against: string;
  status: "pending" | "applied" | "superseded";
}

export function parseTarget(target: string): { kind: TargetKind; id: string } {
  const [kind, ...rest] = target.split(":");
  return { kind: kind as TargetKind, id: rest.join(":") };
}

/** Which stage owns a target — this is what orders a batch. */
export function stageOf(target: string): number {
  const { kind } = parseTarget(target);
  if (kind === "token") return 2;
  if (kind === "candidate") return 3;
  if (kind === "scene") return 3;
  if (kind === "shot") return 4;
  return Number(parseTarget(target).id) || 0;
}

export const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

// ── Store ──────────────────────────────────────────────────────────────────

const FILE = "feedback.jsonl";

export async function readNotes(projectPath: string): Promise<Note[]> {
  try {
    const raw = await readFile(join(projectPath, "design", FILE), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Note);
  } catch {
    return [];
  }
}

export async function addNote(
  projectPath: string,
  target: string,
  body: string,
  against: string,
  at: number,
): Promise<Note> {
  const dir = join(projectPath, "design");
  await mkdir(dir, { recursive: true });
  const note: Note = {
    id: hash(`${target}:${at}:${body}`),
    target,
    body,
    at,
    against,
    status: "pending",
  };
  const { appendFile } = await import("node:fs/promises");
  await appendFile(join(dir, FILE), JSON.stringify(note) + "\n", "utf8");
  return note;
}

export async function markApplied(projectPath: string, ids: string[]): Promise<void> {
  const notes = await readNotes(projectPath);
  const set = new Set(ids);
  const next = notes.map((n) => (set.has(n.id) ? { ...n, status: "applied" as const } : n));
  await writeFile(
    join(projectPath, "design", FILE),
    next.map((n) => JSON.stringify(n)).join("\n") + "\n",
    "utf8",
  );
}

// ── Batching ───────────────────────────────────────────────────────────────

export interface BatchItem {
  target: string;
  stage: number;
  notes: Note[];
  /** True when the target's content changed after a note was written. */
  drifted: boolean;
}

/**
 * Groups pending notes into one re-run per target, ordered upstream-first so a
 * downstream re-run always sees the new upstream result. Multiple notes on one
 * target merge into a single re-run rather than racing.
 */
export function planBatch(
  notes: Note[],
  currentHash: (target: string) => string | null,
): BatchItem[] {
  const byTarget = new Map<string, Note[]>();
  for (const n of notes) {
    if (n.status !== "pending") continue;
    const list = byTarget.get(n.target) ?? [];
    list.push(n);
    byTarget.set(n.target, list);
  }

  return [...byTarget.entries()]
    .map(([target, list]) => {
      const now = currentHash(target);
      return {
        target,
        stage: stageOf(target),
        notes: list.sort((a, b) => a.at - b.at),
        drifted: Boolean(now) && list.some((n) => n.against && n.against !== now),
      };
    })
    .sort((a, b) => a.stage - b.stage || a.target.localeCompare(b.target));
}

/** Stages invalidated by re-running a target. Downstream goes stale. */
export function invalidates(target: string): number[] {
  const from = stageOf(target);
  return [1, 2, 3, 4, 5].filter((s) => s > from);
}

/** Sibling scenes' committed metaphors — what a re-run must not duplicate. */
export function siblingSelections(
  index: DesignIndex,
  sceneId: string,
): { scene: string; title: string; metaphor: string }[] {
  return index.scenes
    .filter((s) => s.id !== sceneId)
    .map((s) => ({
      scene: s.id,
      title: s.title,
      metaphor: s.candidates.find((c) => c.status === "selected")?.label ?? "—",
    }));
}

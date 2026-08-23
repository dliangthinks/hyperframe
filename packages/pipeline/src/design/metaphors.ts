import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * The metaphor artifact as structured data, not parsed prose.
 *
 * Why JSON here specifically: this is the one artifact where the app performs
 * structural operations — add a proposal, mark one selected. As markdown that
 * meant inferring "which candidate is selected" from surrounding text, which was
 * fragile and wrong. As data, a revision is appending a proposal and selection
 * is an explicit id. Prose still lives inside — each candidate carries its own
 * description string — but the structure the app acts on is declared.
 */

export interface Candidate {
  id: string;
  label: string;
  cost?: "low" | "medium" | "high";
  /** The visual description — prose, but a field, not a heading to parse. */
  body: string;
  /** Monotonic: a revision appends, so history is preserved and ordered. */
  proposedAt: number;
}

export interface SceneMetaphor {
  id: string;
  title: string;
  /** The scene-level visual world — discussion, consumed by the shooting script. */
  world: string;
  candidates: Candidate[];
  /** Explicit. Set by an approve action, never inferred. null = undecided. */
  selectedId: string | null;
  /** When selection last changed — downstream staleness is measured against this. */
  selectedAt: number | null;
}

export interface MetaphorDoc {
  version: 1;
  scenes: Record<string, SceneMetaphor>;
}

const FILE = "metaphors.json";

export async function readMetaphors(projectPath: string): Promise<MetaphorDoc | null> {
  try {
    return JSON.parse(
      await readFile(join(projectPath, "design", FILE), "utf8"),
    ) as MetaphorDoc;
  } catch {
    return null;
  }
}

export async function writeMetaphors(projectPath: string, doc: MetaphorDoc): Promise<void> {
  const dir = join(projectPath, "design");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, FILE), JSON.stringify(doc, null, 2), "utf8");
}

/** Revising a metaphor appends a proposal; it never overwrites and never auto-selects. */
export async function addProposal(
  projectPath: string,
  sceneId: string,
  candidate: Omit<Candidate, "proposedAt">,
  at: number,
): Promise<SceneMetaphor> {
  const doc = (await readMetaphors(projectPath)) ?? { version: 1, scenes: {} };
  const scene = doc.scenes[sceneId];
  if (!scene) throw new Error(`Scene ${sceneId} not in metaphors.json.`);
  scene.candidates.push({ ...candidate, proposedAt: at });
  await writeMetaphors(projectPath, doc);
  return scene;
}

/**
 * Approve a candidate. Explicit user action. Returns whether the choice changed —
 * the caller uses that to decide whether to remind about a stale shooting script.
 */
export async function selectCandidate(
  projectPath: string,
  sceneId: string,
  candidateId: string,
  at: number,
): Promise<{ scene: SceneMetaphor; changed: boolean }> {
  const doc = await readMetaphors(projectPath);
  if (!doc) throw new Error("No metaphors.json.");
  const scene = doc.scenes[sceneId];
  if (!scene) throw new Error(`Scene ${sceneId} not found.`);
  if (!scene.candidates.some((c) => c.id === candidateId))
    throw new Error(`Candidate ${candidateId} not in scene ${sceneId}.`);
  const changed = scene.selectedId !== candidateId;
  scene.selectedId = candidateId;
  scene.selectedAt = at;
  await writeMetaphors(projectPath, doc);
  return { scene, changed };
}

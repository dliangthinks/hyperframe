/**
 * Shape of `<project>/design/index.json` — the machine-readable spine of the
 * design artifacts. Holds ids, timings, real token values and anchors into the
 * markdown documents. Never prose. See README.md §4.
 */

export type StageStatus =
  | "locked"       // stage 0 — authored input, not generated
  | "pending"      // not generated yet
  | "review"       // generated, awaiting approval
  | "approved"     // approved by the author
  | "stale";       // an upstream artifact changed after this one was approved

export type DocKey =
  | "breakdown"
  | "artDirection"
  | "metaphors"
  | "shootingScript";

export interface CandidateRef {
  id: string;
  label: string;
  status: "selected" | "rejected" | "proposed";
  cost?: "low" | "medium" | "high";
  anchor: string;
  body?: string;
}

export interface SceneRef {
  id: string;
  title: string;
  start: number;
  duration: number;
  source: "authored" | "invented" | "titling";
  anchor: string;
  world?: string;
  candidates: CandidateRef[];
  shots: string[];
}

export interface ShotRef {
  id: string;
  scene: string;
  start: number;
  duration: number;
  narration: string;
  anchor: string;
  /** §5c gate: a shot may hold at most three text objects. */
  textObjects: number;
  /** §5c gate: roughly 2–3 words per second of duration. */
  words: number;
  devices: string[];
  assets: string[];
  instruction?: string;
  composition?: string;
  snapshot?: string;
}

export interface TypeSpec {
  role: string;
  family: "serif" | "sans" | "mono";
  px: number;
}

export interface DesignIndex {
  version: number;
  runtime: number;
  docs: Record<DocKey, string>;
  tokens: Record<string, string>;
  type: TypeSpec[];
  scenes: SceneRef[];
  shots: ShotRef[];
  stages?: Partial<Record<string, StageStatus>>;
}

/** A markdown section addressed by `<docKey>#<heading-slug>`. */
export type DocSections = Partial<Record<DocKey, Record<string, string>>>;

/** What a feedback note is attached to. Encoded as `<kind>:<id>`. */
export type TargetKind = "scene" | "candidate" | "shot" | "token" | "stage";

export interface FeedbackNote {
  target: string;
  body: string;
  at: number;
}

export type PaneType =
  | "assets"
  | "narration" | "timeline" | "tokens" | "candidates" | "shotlist" | "composition" | "raw";

// ── Asset plan (stage 4) ─────────────────────────────────────────────────────

export type AssetResolutionKind = "svg" | "typography" | "icon" | "primitive" | "bespoke";

export interface AssetResolution {
  kind: AssetResolutionKind;
  /** Vendored file, project-relative — svg and icon kinds. */
  file?: string;
  /** Multiple vendored files — icon needs that name several glyphs. */
  files?: string[];
  /** Source ref, e.g. "storyset:9319830" — svg kind. */
  ref?: string;
  /** Storyset layer ids to hide when composing. */
  dropLayers?: string[];
}

export interface AssetNeed {
  id: string;
  scene: string;
  need: string;
  queries: string[];
  resolution: AssetResolution;
  why: string;
}

export interface AssetPlan {
  version: number;
  needs: AssetNeed[];
}

export interface AssetManifestEntry {
  ref: string;
  source: string;
  sourceId: string;
  title: string;
  author?: string;
  query: string;
  file: string;
  pageUrl: string;
  downloadedAt: string;
  recolored: boolean;
}

/** A workflow stage, loaded from the pipeline. The rail is built from these. */
export interface StageDef {
  id: string;
  label: string;
  skill: string;
  doc?: string;
  pane: PaneType;
  dependsOn: string[];
  input?: boolean;
  reviewChecklist?: string[];
}

export interface Workflow {
  id: string;
  label: string;
  description: string;
  stages: StageDef[];
}

/** §5c limits, enforced in the UI so a bad shot is visible before it renders. */
export const MAX_TEXT_OBJECTS = 3;
export const WORDS_PER_SECOND = 3;

export function shotBreaches(s: ShotRef): string[] {
  const out: string[] = [];
  if (s.textObjects > MAX_TEXT_OBJECTS)
    out.push(`${s.textObjects} text objects (max ${MAX_TEXT_OBJECTS})`);
  const budget = Math.round(s.duration * WORDS_PER_SECOND);
  if (s.words > budget) out.push(`${s.words} words (budget ${budget})`);
  return out;
}

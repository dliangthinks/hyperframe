export type StageStatus = "locked" | "pending" | "review" | "approved" | "stale";

export type DocKey = "breakdown" | "artDirection" | "metaphors" | "shootingScript";

export interface CandidateRef {
  id: string;
  label: string;
  status: "selected" | "rejected" | "proposed";
  cost?: "low" | "medium" | "high";
  anchor: string;
  /** Prose carried into the index so the app reads one file. */
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
  /** On-screen text objects. Absent until stage 4 has run for this shot. */
  textObjects?: number;
  /** On-screen words — not narration words. Absent until stage 4 has run. */
  words?: number;
  devices: string[];
  assets: string[];
  instruction?: string;
  composition?: string;
  snapshot?: string;
}

export interface DesignIndex {
  version: number;
  runtime: number;
  docs: Record<DocKey, string>;
  tokens: Record<string, string>;
  type: { role: string; family: "serif" | "sans" | "mono"; px: number }[];
  stages: Partial<Record<string, StageStatus>>;
  scenes: SceneRef[];
  shots: ShotRef[];
}

/** A structural problem in the artifacts. The skill fixes these, not a human. */
export interface StructureIssue {
  doc: DocKey | "index";
  code:
    | "missing_document"
    | "missing_scene_heading"
    | "missing_candidate_heading"
    | "missing_shot_heading"
    | "unresolved_anchor"
    | "duration_mismatch";
  message: string;
  hint: string;
}

export interface BuildResult {
  index: DesignIndex | null;
  issues: StructureIssue[];
}

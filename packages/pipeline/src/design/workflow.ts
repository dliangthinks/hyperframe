/**
 * A workflow is the stage sequence, as data. The app loads one and executes it;
 * the engine hardcodes no stage. Adding or removing a stage — a "sound design"
 * pass, a dropped "art direction" — is an edit to a workflow file, not to code.
 *
 * The boundary: the app renders a fixed vocabulary of pane types (below). A
 * workflow may reorder, add, or drop stages freely, and each stage picks the
 * pane that fits it. A genuinely new kind of view is the only thing that needs
 * new code — everything else is a data edit.
 */

export type PaneType =
  | "narration"    // stage 0 — read-only shot list under scene groupings
  | "timeline"     // proportional duration bar (breakdown)
  | "tokens"       // painted palette swatches + type specimens
  | "candidates"   // metaphor candidate cards under pinned narration
  | "assets"       // per-need resolution: vendored SVG thumbnails or fallback verdicts
  | "shotlist"     // shots grouped by scene, with the §5c gate
  | "composition"  // generated files + the door into Edit
  | "raw";         // markdown fallback

/** A field the authoring skill must declare under an item's heading. */
export interface DeclaredField {
  key: string;                       // e.g. "status", "text objects"
  scope: "scene" | "candidate" | "shot" | "token";
  kind: "enum" | "int" | "list" | "string";
  values?: string[];                 // for enum
}

export interface StageDef {
  id: string;                        // stable key, e.g. "metaphor"
  label: string;                     // shown on the rail
  /** Skill that authors this stage. Swapping it tweaks quality, not structure. */
  skill: string;
  /** Document this stage writes, relative to design/. Absent = produces no doc. */
  doc?: string;
  pane: PaneType;
  /** Stage ids this one depends on. Drives context assembly and staleness. */
  dependsOn: string[];
  /** True for authored input (stage 0) — locked, never generated. */
  input?: boolean;
  /** Declared-field contract this stage's headings must satisfy (README §4). */
  fields?: DeclaredField[];
  /** What the human should judge at this stage's gate — rendered above the
   * pane so the review focus is present at the moment of review, not
   * remembered. Workflow data, so each workflow carries its own. */
  reviewChecklist?: string[];
}

export interface Workflow {
  id: string;
  label: string;
  description: string;
  stages: StageDef[];
}

/** Stages downstream of a given stage, in order — what a re-run invalidates. */
export function downstreamOf(wf: Workflow, stageId: string): string[] {
  const idx = wf.stages.findIndex((s) => s.id === stageId);
  if (idx < 0) return [];
  return wf.stages.slice(idx + 1).map((s) => s.id);
}

/** Upstream stages a re-run must see, respecting declared dependencies. */
export function upstreamOf(wf: Workflow, stageId: string): StageDef[] {
  const stage = wf.stages.find((s) => s.id === stageId);
  if (!stage) return [];
  const order = new Map(wf.stages.map((s, i) => [s.id, i]));
  return wf.stages.filter(
    (s) => stage.dependsOn.includes(s.id) && (order.get(s.id) ?? 0) < (order.get(stageId) ?? 0),
  );
}

// ── Validation & persistence contract ───────────────────────────────────────

export const PANE_TYPES: PaneType[] = [
  "narration", "timeline", "tokens", "candidates", "assets", "shotlist", "composition", "raw",
];

export interface WorkflowIssue {
  stageId?: string;
  message: string;
}

/** A workflow the app will run must be internally consistent before it is saved. */
export function validateWorkflow(wf: Workflow): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  if (!wf.id?.trim()) issues.push({ message: "Workflow needs an id." });
  if (!wf.stages?.length) issues.push({ message: "Workflow has no stages." });

  const ids = new Set<string>();
  wf.stages?.forEach((s, i) => {
    if (!s.id?.trim()) issues.push({ message: `Stage ${i} has no id.` });
    if (ids.has(s.id)) issues.push({ stageId: s.id, message: `Duplicate stage id "${s.id}".` });
    ids.add(s.id);
    if (!PANE_TYPES.includes(s.pane))
      issues.push({ stageId: s.id, message: `Stage "${s.id}" uses unknown pane "${s.pane}".` });
    if (!s.input && !s.skill?.trim())
      issues.push({ stageId: s.id, message: `Stage "${s.id}" has no skill.` });
  });

  // Dependencies must reference existing, earlier stages — no forward or cyclic refs.
  wf.stages?.forEach((s, i) => {
    for (const dep of s.dependsOn ?? []) {
      if (!ids.has(dep))
        issues.push({ stageId: s.id, message: `Stage "${s.id}" depends on unknown "${dep}".` });
      const depIdx = wf.stages.findIndex((x) => x.id === dep);
      if (depIdx >= i)
        issues.push({ stageId: s.id, message: `Stage "${s.id}" depends on "${dep}" which is not upstream.` });
    }
  });

  return issues;
}

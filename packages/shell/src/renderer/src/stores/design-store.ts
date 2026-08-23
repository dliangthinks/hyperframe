import { create } from "zustand";
import type {
  DesignIndex,
  DocSections,
  FeedbackNote,
  StageStatus,
  ShotRef,
  SceneRef,
  Workflow,
  StageDef,
} from "../types/design";

export type AppMode = "design" | "edit";

interface DesignStore {
  mode: AppMode;
  workflow: Workflow | null;
  stage: string;

  index: DesignIndex | null;
  sections: DocSections;
  raw: Record<string, string>;
  missing: string[];
  loading: boolean;

  /** `<kind>:<id>` — what feedback and detail views are addressed to. */
  selected: string | null;
  /** Raw-markdown fallback pane, per README.md §5. */
  showRaw: boolean;

  feedback: FeedbackNote[];

  setMode: (mode: AppMode) => void;
  setStage: (stage: string) => void;
  setWorkflow: (workflow: Workflow) => void;
  select: (target: string | null) => void;
  toggleRaw: () => void;
  loadDesign: (payload: {
    index: DesignIndex | null;
    sections: DocSections;
    raw: Record<string, string>;
    missing: string[];
  }) => void;
  setLoading: (loading: boolean) => void;
  addFeedback: (note: FeedbackNote) => void;
  reset: () => void;
}

const initial = {
  mode: "design" as AppMode,
  workflow: null as Workflow | null,
  stage: "breakdown",
  index: null as DesignIndex | null,
  sections: {} as DocSections,
  raw: {} as Record<string, string>,
  missing: [] as string[],
  loading: false,
  selected: null as string | null,
  showRaw: false,
  feedback: [] as FeedbackNote[],
};

export const useDesignStore = create<DesignStore>((set) => ({
  ...initial,
  setMode: (mode) => set({ mode }),
  setStage: (stage) => set({ stage, selected: null }),
  setWorkflow: (workflow) =>
    set({ workflow, stage: workflow.stages[1]?.id ?? workflow.stages[0]?.id ?? "" }),
  select: (selected) => set({ selected }),
  toggleRaw: () => set((s) => ({ showRaw: !s.showRaw })),
  loadDesign: ({ index, sections, raw, missing }) =>
    set({ index, sections, raw, missing, loading: false }),
  setLoading: (loading) => set({ loading }),
  addFeedback: (note) => set((s) => ({ feedback: [...s.feedback, note] })),
  reset: () => set(initial),
}));

// ── Derived selectors ──────────────────────────────────────────────────────

/**
 * Stage status, derived against the loaded workflow. Explicit values in
 * index.json win; input stages are always locked; a stage with no document
 * present is pending; a composition stage is review once any shot has one.
 */
export function stageStatus(
  index: DesignIndex | null,
  missing: string[],
  stage: StageDef,
): StageStatus {
  if (stage.input) return "locked";
  const explicit = index?.stages?.[stage.id];
  if (explicit) return explicit;
  if (!index) return "pending";

  if (stage.pane === "composition") {
    return index.shots?.some((s) => s.composition) ? "review" : "pending";
  }
  if (!stage.doc) return "pending";
  const name = stage.doc.split("/").pop() ?? stage.doc;
  return missing.includes(name) ? "pending" : "review";
}

export function shotsOfScene(index: DesignIndex | null, sceneId: string): ShotRef[] {
  if (!index) return [];
  const scene = index.scenes.find((s) => s.id === sceneId);
  if (!scene) return [];
  return scene.shots
    .map((id) => index.shots.find((sh) => sh.id === id))
    .filter((s): s is ShotRef => Boolean(s));
}

export function sceneOfShot(index: DesignIndex | null, shotId: string): SceneRef | null {
  if (!index) return null;
  const shot = index.shots.find((s) => s.id === shotId);
  if (!shot) return null;
  return index.scenes.find((s) => s.id === shot.scene) ?? null;
}

/** Resolve `<docKey>#<slug>` to its prose body. */
export function sectionFor(sections: DocSections, anchor: string | undefined): string {
  if (!anchor) return "";
  const [doc, slug] = anchor.split("#");
  return (sections as Record<string, Record<string, string>>)[doc]?.[slug] ?? "";
}

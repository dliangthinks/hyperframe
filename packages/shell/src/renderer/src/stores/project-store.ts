import { create } from "zustand";

export interface Scene {
  index: number;
  sentence: string;
  audioPath: string;
  durationMs: number;
}

interface ProjectStore {
  projectName: string | null;
  projectPath: string | null;

  script: string;
  sentences: string[];
  scenes: Scene[];

  selectedSceneIndex: number;

  thumbRevision: number;

  pipelineStage:
    | "idle"
    | "scaffold"
    | "audio"
    | "scene-gen"
    | "preview"
    | "complete"
    | "error";
  pipelineMessage: string;

  audioProgress: { current: number; total: number };

  activityLog: { type: string; content: string; timestamp: number }[];
  currentActivity: string;

  previewPort: number | null;
  previewUrl: string | null;
  previewReady: boolean;

  renderStatus: "idle" | "rendering" | "complete" | "error";
  renderProgress: number;
  renderMessage: string;
  renderOutputPath: string | null;

  lastRenderPath: string | null;

  lastGenerated: { script: string; scenes: Scene[] } | null;

  setProject: (name: string, path: string) => void;
  setScript: (script: string) => void;
  setScenes: (scenes: Scene[]) => void;
  updateSceneText: (index: number, text: string) => void;
  setSelectedSceneIndex: (index: number) => void;
  bumpThumbRevision: () => void;
  setPipelineStatus: (
    stage: ProjectStore["pipelineStage"],
    message: string,
  ) => void;
  setAudioProgress: (current: number, total: number) => void;
  setPreviewReady: (port: number, url: string | null) => void;
  setRenderStatus: (status: ProjectStore["renderStatus"]) => void;
  setRenderProgress: (progress: number, message: string) => void;
  setRenderOutputPath: (path: string) => void;
  setLastRenderPath: (path: string | null) => void;
  setLastGenerated: (snapshot: ProjectStore["lastGenerated"]) => void;
  addActivity: (type: string, content: string) => void;
  clearActivityLog: () => void;
  reset: () => void;
}

const initialState = {
  projectName: null as string | null,
  projectPath: null as string | null,
  script: "",
  sentences: [] as string[],
  scenes: [] as Scene[],
  selectedSceneIndex: 0,
  thumbRevision: 0,
  pipelineStage: "idle" as const,
  pipelineMessage: "",
  audioProgress: { current: 0, total: 0 },
  previewPort: null as number | null,
  previewUrl: null as string | null,
  previewReady: false,
  renderStatus: "idle" as const,
  renderProgress: 0,
  renderMessage: "",
  renderOutputPath: null as string | null,
  lastRenderPath: null as string | null,
  lastGenerated: null as ProjectStore["lastGenerated"],
  activityLog: [] as ProjectStore["activityLog"],
  currentActivity: "",
};

const deriveFromScenes = (scenes: Scene[]) => {
  const sentences = scenes.map((s) => s.sentence);
  return { script: sentences.join("\n"), sentences };
};

export const useProjectStore = create<ProjectStore>((set) => ({
  ...initialState,

  setProject: (name, path) => set({ projectName: name, projectPath: path }),

  setScript: (script) => {
    const sentences = script
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    set({ script, sentences });
  },

  setScenes: (scenes) =>
    set({ scenes, ...deriveFromScenes(scenes) }),

  updateSceneText: (index, text) =>
    set((state) => {
      const next = state.scenes.map((s) =>
        s.index === index ? { ...s, sentence: text } : s,
      );
      return { scenes: next, ...deriveFromScenes(next) };
    }),

  setSelectedSceneIndex: (index) => set({ selectedSceneIndex: index }),

  bumpThumbRevision: () =>
    set((state) => ({ thumbRevision: state.thumbRevision + 1 })),

  setPipelineStatus: (stage, message) =>
    set({ pipelineStage: stage, pipelineMessage: message }),

  setAudioProgress: (current, total) =>
    set({ audioProgress: { current, total } }),

  setPreviewReady: (port, url) =>
    set({ previewPort: port, previewUrl: url, previewReady: true }),

  setRenderStatus: (status) => set({ renderStatus: status }),

  setRenderProgress: (progress, message) =>
    set({ renderProgress: progress, renderMessage: message }),

  setRenderOutputPath: (path) => set({ renderOutputPath: path }),

  setLastRenderPath: (path) => set({ lastRenderPath: path }),

  setLastGenerated: (snapshot) => set({ lastGenerated: snapshot }),

  addActivity: (type, content) =>
    set((state) => ({
      activityLog: [
        ...state.activityLog.slice(-50),
        { type, content, timestamp: Date.now() },
      ],
      currentActivity: content,
    })),

  clearActivityLog: () => set({ activityLog: [], currentActivity: "" }),

  reset: () => set(initialState),
}));

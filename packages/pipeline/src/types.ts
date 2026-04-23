// ── Core types for the pipeline package ─────────────────────────────────────
// No Electron imports. No framework dependencies. Pure data shapes.

export interface ManifestEntry {
  sentence: string;
  audioPath: string;
  durationMs: number;
}

/** A scene in the Hyperframes app is just a sentence with its TTS timing. */
export interface Scene {
  index: number;
  sentence: string;
  audioPath: string;
  durationMs: number;
}

export interface ProjectInfo {
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface RenderEntry {
  path: string;
  createdAt: string;
}

/** Snapshot of the state at last generation, used for diffing. */
export interface GeneratedSnapshot {
  script: string;
  scenes: Scene[];
}

export interface ProjectState {
  version: number;
  name: string;
  script: string;
  audioProviderId: string;
  voiceId: string;
  scenes: Scene[];
  renders: RenderEntry[];
  /** Snapshot of last successful generation — null if never generated. */
  lastGenerated: GeneratedSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateOpts {
  projectPath: string;
  script: string;
  scenes: Scene[];
}

export interface RenderOpts {
  outputPath: string;
  fps?: 24 | 30 | 60;
  quality?: "draft" | "standard" | "high";
  format?: "mp4" | "webm" | "mov";
}

// ── Audio provider interface ────────────────────────────────────────────────

export interface AudioProvider {
  id: string;
  name: string;
  generate(
    sentences: string[],
    outputDir: string,
    onProgress: (current: number, total: number) => void,
  ): Promise<ManifestEntry[]>;
}

// ── AI provider interface ───────────────────────────────────────────────────

export interface AIProgressEvent {
  type: "text" | "tool_use" | "complete";
  content: string;
}

export interface AIGenerateOpts {
  cwd: string;
  systemPrompt: string;
  userMessage: string;
  onProgress: (event: AIProgressEvent) => void;
  sessionId?: string | null;
}

export interface AIGenerateResult {
  sessionId: string | null;
  text: string;
}

export interface AIProvider {
  id: string;
  name: string;
  generate(opts: AIGenerateOpts): Promise<AIGenerateResult>;
}

// ── Pipeline events ─────────────────────────────────────────────────────────

export interface PipelineEvents {
  status: { stage: string; message: string };
  "audio:progress": { current: number; total: number };
  "scene:progress": { type: "text" | "tool_use" | "complete" | "thumbnail"; content: string };
  "preview:ready": { port: number };
  "render:progress": { percent: number; message: string };
  "render:complete": { outputPath: string };
  error: { stage: string; message: string };
}

// ── Pipeline config ─────────────────────────────────────────────────────────

export interface PipelineConfig {
  skillPath: string;
  outputDir: string;
}

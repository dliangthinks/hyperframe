// @hyperframes-app/pipeline — shell-agnostic Hyperframes production pipeline.
// Zero Electron imports. Any shell can consume this.

export { Pipeline } from "./pipeline.js";

// Types
export type {
  AudioProvider,
  AIProvider,
  AIGenerateOpts,
  AIProgressEvent,
  ManifestEntry,
  Scene,
  ProjectInfo,
  ProjectState,
  RenderEntry,
  GeneratedSnapshot,
  GenerateOpts,
  RenderOpts,
  PipelineEvents,
  PipelineConfig,
} from "./types.js";

// Audio providers
export { InworldProvider } from "./audio/inworld-provider.js";
export { FileAudioProvider } from "./audio/file-provider.js";

// AI providers
export { ClaudeCodeProvider } from "./ai/claude-code-provider.js";

// Standalone utilities
export { detectChanges, type ChangeSet } from "./change-detector.js";

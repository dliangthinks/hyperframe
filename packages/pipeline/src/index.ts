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

// ── Design artifacts ────────────────────────────────────────────────────────
export { buildIndex, writeIndex } from "./design/index-writer.js";
export { parseHeadings, sectionMap, slugify } from "./design/sections.js";
export type {
  DesignIndex,
  SceneRef,
  ShotRef,
  CandidateRef,
  StructureIssue,
  BuildResult,
  DocKey,
  StageStatus,
} from "./design/types.js";
export { contextFor, renderEnvelope } from "./design/context.js";
export type { ContextEnvelope } from "./design/context.js";
export {
  addNote,
  readNotes,
  markApplied,
  planBatch,
  invalidates,
  stageOf,
  siblingSelections,
} from "./design/feedback.js";
export type { Note, BatchItem, TargetKind } from "./design/feedback.js";
export { FeedbackRunner } from "./design/runner.js";
export type { RunnerEvents } from "./design/runner.js";
export { loadWorkflow, listBuiltinWorkflows, listAllWorkflows, saveWorkflow } from "./design/workflow-loader.js";
export { downstreamOf, upstreamOf, validateWorkflow, PANE_TYPES } from "./design/workflow.js";
export type { Workflow, StageDef, PaneType, DeclaredField, WorkflowIssue } from "./design/workflow.js";
export { Composer } from "./design/composer.js";
export type { ComposeEvents } from "./design/composer.js";
export {
  readMetaphors, writeMetaphors, addProposal, selectCandidate,
} from "./design/metaphors.js";
export type { MetaphorDoc, SceneMetaphor, Candidate } from "./design/metaphors.js";
export { migrateMetaphors } from "./design/migrate-metaphors.js";
export {
  readBreakdown, writeBreakdown, readArtDirection, writeArtDirection,
  readShootingScript, writeShootingScript,
} from "./design/artifacts.js";
export type {
  BreakdownDoc, ArtDirectionDoc, ShootingScriptDoc, ShotDirective, BreakdownScene,
} from "./design/artifacts.js";
export { migrateAll } from "./design/migrate-all.js";

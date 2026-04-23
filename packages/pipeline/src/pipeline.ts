import { EventEmitter } from "node:events";
import type {
  AIProvider,
  AudioProvider,
  GenerateOpts,
  ManifestEntry,
  PipelineConfig,
  PipelineEvents,
  ProjectInfo,
  ProjectState,
  RenderOpts,
  Scene,
} from "./types.js";
import { writeManifest } from "./audio/manifest.js";
import { detectChanges, type ChangeSet } from "./change-detector.js";
import * as projectManager from "./project-manager.js";
import { scaffoldProject } from "./scaffolder.js";
import { generateScenes } from "./scene-generator.js";
import * as previewServer from "./preview-server.js";
import * as renderer from "./renderer.js";
import { generateThumbnails } from "./thumbnail-generator.js";

/**
 * Hyperframes pipeline orchestrator.
 *
 * Same shell contract as the Remotion-based pipeline — the shell observes
 * typed events and calls async methods. No framework-specific concepts leak
 * through the event shape.
 */
export class Pipeline extends EventEmitter {
  private config: PipelineConfig;
  private audioProvider: AudioProvider | null = null;
  private aiProvider: AIProvider | null = null;

  constructor(config: PipelineConfig) {
    super();
    this.config = config;
  }

  private emitEvent<K extends keyof PipelineEvents>(
    event: K,
    data: PipelineEvents[K],
  ): void {
    this.emit(event, data);
  }

  // ── Providers ──────────────────────────────────────────────────────────

  setAudioProvider(provider: AudioProvider): void {
    this.audioProvider = provider;
  }

  getAudioProvider(): AudioProvider | null {
    return this.audioProvider;
  }

  setAIProvider(provider: AIProvider): void {
    this.aiProvider = provider;
  }

  getAIProvider(): AIProvider | null {
    return this.aiProvider;
  }

  // ── Project management ──────────────────────────────────────────────────

  async createProject(name: string): Promise<ProjectInfo> {
    this.emitEvent("status", { stage: "scaffold", message: "Scaffolding project..." });

    const projectPath = await scaffoldProject({
      name,
      outputDir: this.config.outputDir,
      onStatus: (message) => this.emitEvent("status", { stage: "scaffold", message }),
    });

    const now = new Date().toISOString();
    const state: ProjectState = {
      version: 1,
      name,
      script: "",
      audioProviderId: this.audioProvider?.id ?? "inworld",
      voiceId: "Oliver",
      scenes: [],
      renders: [],
      lastGenerated: null,
      createdAt: now,
      updatedAt: now,
    };

    await projectManager.saveProject(projectPath, state);
    this.emitEvent("status", { stage: "scaffold", message: "Project created" });

    return { name, path: projectPath, createdAt: now, updatedAt: now };
  }

  async openProject(projectPath: string): Promise<ProjectState> {
    return projectManager.openProject(projectPath);
  }

  async saveProject(
    projectPath: string,
    state: Partial<ProjectState>,
  ): Promise<void> {
    await projectManager.saveProject(projectPath, state);
  }

  async listProjects(): Promise<ProjectInfo[]> {
    return projectManager.listProjects(this.config.outputDir);
  }

  // ── Script analysis (Hyperframes: one scene per non-empty line) ─────────

  analyzeScript(script: string): Scene[] {
    const lines = script
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return lines.map((sentence, index) => ({
      index,
      sentence,
      audioPath: "",
      durationMs: 0,
    }));
  }

  // ── Audio generation ────────────────────────────────────────────────────

  async generateAudio(
    projectPath: string,
    sentences: string[],
  ): Promise<ManifestEntry[]> {
    if (!this.audioProvider) {
      throw new Error("No audio provider configured. Call setAudioProvider() first.");
    }

    this.emitEvent("status", { stage: "audio", message: "Generating audio..." });

    const manifest = await this.audioProvider.generate(
      sentences,
      projectPath,
      (current, total) => {
        this.emitEvent("audio:progress", { current, total });
      },
    );

    await writeManifest(projectPath, manifest);
    this.emitEvent("status", { stage: "audio", message: "Audio complete" });

    return manifest;
  }

  // ── Change detection ────────────────────────────────────────────────────

  detectChanges(
    projectPath: string,
    opts: GenerateOpts,
    lastGenerated: ProjectState["lastGenerated"],
  ): ChangeSet {
    return detectChanges(
      { script: opts.script, scenes: opts.scenes },
      lastGenerated,
    );
  }

  // ── Scene generation (whole-file regen via Claude Code) ─────────────────

  async generateScenes(
    projectPath: string,
    opts: GenerateOpts,
    lastGenerated?: ProjectState["lastGenerated"],
  ): Promise<void> {
    const changeSet = detectChanges(
      { script: opts.script, scenes: opts.scenes },
      lastGenerated ?? null,
    );

    if (changeSet.noChanges) {
      this.emitEvent("status", { stage: "scene-gen", message: "No changes detected" });
      return;
    }

    if (!this.aiProvider) {
      throw new Error("No AI provider configured. Call setAIProvider() first.");
    }

    this.emitEvent("status", {
      stage: "scene-gen",
      message: `Generating composition (${opts.scenes.length} scenes)...`,
    });

    await generateScenes({
      projectPath,
      script: opts.script,
      scenes: opts.scenes,
      skillPath: this.config.skillPath,
      aiProvider: this.aiProvider,
      isRegen: lastGenerated != null,
      onProgress: (event) => this.emitEvent("scene:progress", event),
    });

    this.emitEvent("status", { stage: "scene-gen", message: "Composition generated" });
  }

  // ── Preview ─────────────────────────────────────────────────────────────

  async startPreview(projectPath: string): Promise<{ port: number; url: string }> {
    this.emitEvent("status", { stage: "preview", message: "Starting preview server..." });

    const result = await previewServer.startPreview(projectPath, (message) => {
      this.emitEvent("status", { stage: "preview", message });
    });
    this.emitEvent("preview:ready", { port: result.port });

    return result;
  }

  async stopPreview(projectPath: string): Promise<void> {
    await previewServer.stopPreview(projectPath);
  }

  async stopAllPreviews(): Promise<void> {
    await previewServer.stopAllPreviews();
  }

  getPreviewPort(projectPath: string): number | null {
    return previewServer.getPreviewPort(projectPath);
  }

  getPreviewUrl(projectPath: string): string | null {
    return previewServer.getPreviewUrl(projectPath);
  }

  // ── Thumbnails ──────────────────────────────────────────────────────────

  async generateThumbnails(projectPath: string): Promise<string[]> {
    this.emitEvent("status", { stage: "scene-gen", message: "Generating thumbnails..." });
    const paths = await generateThumbnails(projectPath, ({ current, total }) => {
      this.emitEvent("scene:progress", {
        type: "thumbnail",
        content: `Thumbnail ${current}/${total}`,
      });
    });
    this.emitEvent("status", { stage: "scene-gen", message: "Thumbnails ready" });
    return paths;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  startRender(projectPath: string, opts: RenderOpts): void {
    this.emitEvent("status", { stage: "render", message: "Starting render..." });

    renderer.startRender(projectPath, opts, {
      onProgress: (data) => this.emitEvent("render:progress", data),
      onComplete: (outputPath) => this.emitEvent("render:complete", { outputPath }),
      onError: (err) =>
        this.emitEvent("error", { stage: "render", message: err.message }),
    });
  }

  cancelRender(): void {
    renderer.cancelRender();
  }
}

/**
 * IPC Bridge — the ONLY file that imports both Electron and pipeline.
 *
 * Translates renderer IPC requests → pipeline method calls.
 * Forwards pipeline events → renderer IPC events.
 */

import { ipcMain, BrowserWindow, dialog, app } from "electron";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import type { Pipeline, PipelineEvents } from "@hyperframes-app/pipeline";
import { readDesign } from "./design-reader";

function getSettingsPath(): string {
  const dir = app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  return join(dir, "settings.json");
}

function readSettings(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(getSettingsPath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeSettings(data: Record<string, unknown>): void {
  writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2));
}

export function registerIpcHandlers(
  pipeline: Pipeline,
  mainWindow: BrowserWindow,
): void {
  const send = (channel: string, data: unknown) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  // ── Forward pipeline events to renderer ─────────────────────────────────
  const events: (keyof PipelineEvents)[] = [
    "status",
    "audio:progress",
    "scene:progress",
    "preview:ready",
    "render:progress",
    "render:complete",
    "error",
  ];

  for (const event of events) {
    pipeline.on(event, (data: unknown) => send(`pipeline:${event}`, data));
  }

  // ── Window ─────────────────────────────────────────────────────────────

  ipcMain.handle("window:set-title", async (_event, title: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.setTitle(title);
    }
  });

  // ── App persistence ───────────────────────────────────────────────────

  ipcMain.handle("app:get-last-project", async () => {
    const settings = readSettings();
    return (settings.lastProjectPath as string) ?? null;
  });

  ipcMain.handle("app:set-last-project", async (_event, path: string) => {
    const settings = readSettings();
    settings.lastProjectPath = path;
    writeSettings(settings);
  });

  ipcMain.handle("app:get-file-url", async (_event, absolutePath: string) => {
    // Return null for missing files so the renderer can skip the <img> element
    // entirely — otherwise a broken local-file:// URL produces a noisy
    // ERR_FILE_NOT_FOUND in the Electron log for every missing thumbnail.
    if (!existsSync(absolutePath)) return null;
    return `local-file://${absolutePath}`;
  });

  // ── Project management ──────────────────────────────────────────────────

  ipcMain.handle("project:create", async (_event, name: string) => {
    return pipeline.createProject(name);
  });

  // ── Design artifacts ────────────────────────────────────────────────────
  // Reads design/index.json plus the four markdown docs, split into sections
  // by heading slug. The renderer addresses sections; it never parses prose.
  ipcMain.handle("design:workflow", async (_event, projectPath: string, id?: string) => {
    const { loadWorkflow } = await import("@hyperframes-app/pipeline");
    return loadWorkflow(projectPath, id);
  });

  ipcMain.handle("design:workflows", async (_event, projectPath: string) => {
    const { listAllWorkflows } = await import("@hyperframes-app/pipeline");
    return listAllWorkflows(projectPath);
  });

  // Saving a workflow writes a project-local copy — built-ins stay pristine, and
  // this doubles as "fork a built-in to customize it". Invalid graphs are refused.
  ipcMain.handle("design:save-workflow", async (_event, projectPath: string, wf: unknown) => {
    const { saveWorkflow } = await import("@hyperframes-app/pipeline");
    return saveWorkflow(projectPath, wf as never);
  });

  ipcMain.handle("design:validate-workflow", async (_event, wf: unknown) => {
    const { validateWorkflow } = await import("@hyperframes-app/pipeline");
    return validateWorkflow(wf as never);
  });

  // Renders on disk, newest first. The preview plays the most recent MP4 rather
  // than requiring a live preview server for finished work.
  // Compose one scene's HTML from the approved artifacts. Dispatches Claude Code
  // (the app authors nothing), streams progress, then re-derives the index so the
  // new composition file is picked up.
  ipcMain.handle("design:compose", async (event, projectPath: string, sceneId: string) => {
    const { Composer, writeIndex } = await import("@hyperframes-app/pipeline");
    const ai = pipeline.getAIProvider();
    if (!ai) throw new Error("No AI provider configured.");
    const composer = new Composer(ai);
    for (const ch of ["start", "progress", "done", "error"] as const) {
      composer.on(ch, (data: unknown) => event.sender.send(`pipeline:design:compose:${ch}`, data));
    }
    try {
      const res = await composer.compose(projectPath, sceneId);
      const rebuilt = await writeIndex(projectPath);
      return { ...res, issues: rebuilt.issues };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("design:list-renders", async (_event, projectPath: string) => {
    const { readdir, stat } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(projectPath, "renders");
    try {
      const files = (await readdir(dir)).filter((f) => f.endsWith(".mp4"));
      const withTime = await Promise.all(
        files.map(async (f) => {
          const st = await stat(join(dir, f));
          return { name: f, path: join(dir, f), mtime: st.mtimeMs };
        }),
      );
      return withTime.sort((a, b) => b.mtime - a.mtime);
    } catch {
      return [];
    }
  });

  // Approve a metaphor candidate — an explicit user action, not a model edit.
  // If the choice changed, the scene's shooting script is now stale and must be
  // re-run before compose; the app reminds the user.
  ipcMain.handle(
    "design:approve-candidate",
    async (_event, projectPath: string, sceneId: string, candidateId: string) => {
      const { selectCandidate, writeIndex } = await import("@hyperframes-app/pipeline");
      const { changed } = await selectCandidate(projectPath, sceneId, candidateId, Date.now());
      if (changed) {
        // Mark the shooting script (and composition) stale for this change.
        const { readFile, writeFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const file = join(projectPath, "design", "index.json");
        try {
          const idx = JSON.parse(await readFile(file, "utf8"));
          idx.stages = { ...(idx.stages ?? {}), shootingScript: "stale", composition: "stale" };
          await writeFile(file, JSON.stringify(idx, null, 2), "utf8");
        } catch {
          /* index not built */
        }
      }
      await writeIndex(projectPath);
      return { changed };
    },
  );

  ipcMain.handle("design:metaphors", async (_event, projectPath: string) => {
    const { readMetaphors } = await import("@hyperframes-app/pipeline");
    return readMetaphors(projectPath);
  });

  ipcMain.handle("design:read", async (_event, projectPath: string) =>
    readDesign(projectPath),
  );

  // A note records the hash of what it was written against, so a note about an
  // older version is flagged rather than applied blind (README.md §6).
  ipcMain.handle(
    "design:feedback",
    async (_event, projectPath: string, target: string, body: string) => {
      const { addNote, contextFor } = await import("@hyperframes-app/pipeline");
      const envelope = await contextFor(projectPath, target);
      return addNote(projectPath, target, body, envelope?.current.hash ?? "", Date.now());
    },
  );

  ipcMain.handle("design:plan-batch", async (_event, projectPath: string) => {
    const { FeedbackRunner } = await import("@hyperframes-app/pipeline");
    return new FeedbackRunner(pipeline.getAIProvider()!).plan(projectPath);
  });

  // The app dispatches re-runs and streams progress; it authors nothing.
  ipcMain.handle("design:apply-batch", async (event, projectPath: string) => {
    const { FeedbackRunner, writeIndex } = await import("@hyperframes-app/pipeline");
    const ai = pipeline.getAIProvider();
    if (!ai) throw new Error("No AI provider configured.");

    const runner = new FeedbackRunner(ai);
    for (const ch of [
      "batch:start",
      "item:start",
      "item:progress",
      "item:done",
      "item:error",
      "batch:done",
    ] as const) {
      runner.on(ch, (data: unknown) =>
        event.sender.send(`pipeline:design:${ch}`, data),
      );
    }

    const applied = await runner.apply(projectPath);
    // Documents changed, so the index is re-derived — never hand-edited.
    const rebuilt = await writeIndex(projectPath);
    return { applied, issues: rebuilt.issues };
  });

  ipcMain.handle("project:open", async (_event, projectPath: string) => {
    return pipeline.openProject(projectPath);
  });

  ipcMain.handle(
    "project:save",
    async (_event, projectPath: string, state: Record<string, unknown>) => {
      return pipeline.saveProject(projectPath, state);
    },
  );

  ipcMain.handle("project:list", async () => {
    return pipeline.listProjects();
  });

  ipcMain.handle("project:select-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Open Project",
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ── Script analysis ─────────────────────────────────────────────────────

  ipcMain.handle("script:analyze", async (_event, script: string) => {
    return pipeline.analyzeScript(script);
  });

  // ── Pipeline orchestration ──────────────────────────────────────────────

  ipcMain.handle(
    "pipeline:detect-changes",
    async (_event, projectPath: string, opts, lastGenerated) => {
      return pipeline.detectChanges(projectPath, opts, lastGenerated ?? null);
    },
  );

  ipcMain.handle(
    "pipeline:generate-audio",
    async (_event, projectPath: string, sentences: string[]) => {
      return pipeline.generateAudio(projectPath, sentences);
    },
  );

  ipcMain.handle(
    "pipeline:generate-scenes",
    async (_event, projectPath: string, opts) => {
      return pipeline.generateScenes(
        projectPath,
        opts,
        opts.lastGenerated ?? undefined,
      );
    },
  );

  ipcMain.handle("pipeline:generate-thumbnails", async (_event, projectPath: string) => {
    return pipeline.generateThumbnails(projectPath);
  });

  /**
   * Save a PNG buffer captured from the renderer's <webview> as the thumbnail
   * for a specific scene. Lets the user update thumbnails one scene at a time
   * from whatever the player is currently showing — a workaround for the
   * `hyperframes snapshot` CLI bug that captures blank PNGs for all but the
   * final scene of a flat inline composition.
   */
  ipcMain.handle(
    "thumbnail:save",
    async (
      _event,
      projectPath: string,
      sceneIndex: number,
      pngData: Uint8Array,
    ) => {
      const thumbsDir = join(projectPath, "public", "thumbs");
      mkdirSync(thumbsDir, { recursive: true });
      const filename = `scene-${String(sceneIndex).padStart(2, "0")}.png`;
      writeFileSync(join(thumbsDir, filename), Buffer.from(pngData));
      return join(thumbsDir, filename);
    },
  );

  // ── Preview ─────────────────────────────────────────────────────────────

  ipcMain.handle("preview:start", async (_event, projectPath: string) => {
    return pipeline.startPreview(projectPath);
  });

  ipcMain.handle("preview:stop", async (_event, projectPath: string) => {
    return pipeline.stopPreview(projectPath);
  });

  ipcMain.handle("preview:get-port", async (_event, projectPath: string) => {
    return pipeline.getPreviewPort(projectPath);
  });

  ipcMain.handle("preview:get-url", async (_event, projectPath: string) => {
    return pipeline.getPreviewUrl(projectPath);
  });

  // ── Render ──────────────────────────────────────────────────────────────

  ipcMain.handle("render:start", async (_event, projectPath: string, opts) => {
    pipeline.startRender(projectPath, opts);
  });

  ipcMain.handle("render:cancel", async () => {
    pipeline.cancelRender();
  });

  ipcMain.handle("render:save-dialog", async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export Video",
      defaultPath: "video.mp4",
      filters: [{ name: "Video", extensions: ["mp4"] }],
    });
    return result.canceled ? null : result.filePath;
  });
}

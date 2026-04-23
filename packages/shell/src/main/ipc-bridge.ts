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

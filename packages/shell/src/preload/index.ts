import { contextBridge, ipcRenderer } from "electron";

/**
 * Typed API exposed to the renderer via contextBridge.
 * This is the renderer's ONLY way to communicate with the main process.
 */
const api = {
  // ── Project ─────────────────────────────────────────────────────────────
  createProject: (name: string) => ipcRenderer.invoke("project:create", name),
  openProject: (path: string) => ipcRenderer.invoke("project:open", path),
  saveProject: (path: string, state: Record<string, unknown>) =>
    ipcRenderer.invoke("project:save", path, state),
  listProjects: () => ipcRenderer.invoke("project:list"),
  selectDirectory: () => ipcRenderer.invoke("project:select-directory"),

  // ── Script ──────────────────────────────────────────────────────────────
  analyzeScript: (script: string) => ipcRenderer.invoke("script:analyze", script),

  // ── Pipeline ────────────────────────────────────────────────────────────
  detectChanges: (
    projectPath: string,
    opts: Record<string, unknown>,
    lastGenerated: unknown,
  ) => ipcRenderer.invoke("pipeline:detect-changes", projectPath, opts, lastGenerated),
  generateAudio: (projectPath: string, sentences: string[]) =>
    ipcRenderer.invoke("pipeline:generate-audio", projectPath, sentences),
  generateScenes: (projectPath: string, opts: Record<string, unknown>) =>
    ipcRenderer.invoke("pipeline:generate-scenes", projectPath, opts),
  generateThumbnails: (projectPath: string) =>
    ipcRenderer.invoke("pipeline:generate-thumbnails", projectPath),
  saveThumbnail: (projectPath: string, sceneIndex: number, pngData: Uint8Array) =>
    ipcRenderer.invoke("thumbnail:save", projectPath, sceneIndex, pngData),

  // ── Preview ─────────────────────────────────────────────────────────────
  startPreview: (projectPath: string) =>
    ipcRenderer.invoke("preview:start", projectPath),
  stopPreview: (projectPath: string) =>
    ipcRenderer.invoke("preview:stop", projectPath),
  getPreviewPort: (projectPath: string) =>
    ipcRenderer.invoke("preview:get-port", projectPath),
  getPreviewUrl: (projectPath: string) =>
    ipcRenderer.invoke("preview:get-url", projectPath),

  // ── Render ──────────────────────────────────────────────────────────────
  startRender: (projectPath: string, opts: Record<string, unknown>) =>
    ipcRenderer.invoke("render:start", projectPath, opts),
  cancelRender: () => ipcRenderer.invoke("render:cancel"),
  saveDialog: () => ipcRenderer.invoke("render:save-dialog"),

  // ── Pipeline events (main → renderer) ───────────────────────────────────
  onPipelineEvent: (channel: string, callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data);
    ipcRenderer.on(`pipeline:${channel}`, handler);
    return () => ipcRenderer.removeListener(`pipeline:${channel}`, handler);
  },

  // ── Window ──────────────────────────────────────────────────────────────
  setTitle: (title: string) => ipcRenderer.invoke("window:set-title", title),

  // ── Persistence ─────────────────────────────────────────────────────────
  getLastProject: () => ipcRenderer.invoke("app:get-last-project"),
  setLastProject: (path: string) =>
    ipcRenderer.invoke("app:set-last-project", path),

  // ── File access ─────────────────────────────────────────────────────────
  getFileUrl: (absolutePath: string) =>
    ipcRenderer.invoke("app:get-file-url", absolutePath),

  // ── Menu events ─────────────────────────────────────────────────────────
  onMenuEvent: (channel: string, callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(`menu:${channel}`, handler);
    return () => ipcRenderer.removeListener(`menu:${channel}`, handler);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;

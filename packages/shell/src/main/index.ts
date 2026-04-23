import { app, BrowserWindow, Menu, protocol, net } from "electron";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { config as loadEnv } from "dotenv";
import { Pipeline, InworldProvider, ClaudeCodeProvider } from "@hyperframes-app/pipeline";
import { registerIpcHandlers } from "./ipc-bridge";

// ── Load ~/.env for API keys ────────────────────────────────────────────────
loadEnv({ path: join(homedir(), ".env") });

// ── Paths ───────────────────────────────────────────────────────────────────
// Resolve repo root: out/main/ → packages/shell/ → packages/ → repo root
const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");
const SKILL_PATH = join(
  REPO_ROOT,
  "packages",
  "pipeline",
  "src",
  "skill.md",
);
const OUTPUT_DIR = join(REPO_ROOT, "output");

// ── Pipeline ────────────────────────────────────────────────────────────────
const pipeline = new Pipeline({
  skillPath: SKILL_PATH,
  outputDir: OUTPUT_DIR,
});

pipeline.setAIProvider(new ClaudeCodeProvider());

if (process.env.INWORLD_API_KEY) {
  pipeline.setAudioProvider(
    new InworldProvider({
      apiKey: process.env.INWORLD_API_KEY,
      reuseExisting: true,
    }),
  );
}

// ── Window ──────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: (() => {
        const mjs = join(__dirname, "..", "preload", "index.mjs");
        const js = join(__dirname, "..", "preload", "index.js");
        return existsSync(mjs) ? mjs : js;
      })(),
      sandbox: false,
      webviewTag: true,
    },
  });

  registerIpcHandlers(pipeline, mainWindow);

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));
  }

  // Open DevTools only when explicitly requested — `HYPERFRAMES_DEVTOOLS=1 npm run dev`.
  // Default dev runs should not pop an extra window.
  if (process.env.HYPERFRAMES_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App menu ────────────────────────────────────────────────────────────────
function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("menu:new-project"),
        },
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow?.webContents.send("menu:open-project"),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

protocol.registerSchemesAsPrivileged([
  { scheme: "local-file", privileges: { stream: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  protocol.handle("local-file", (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname);
    return net.fetch(pathToFileURL(filePath).href);
  });

  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", async () => {
  await pipeline.stopAllPreviews();
  app.quit();
});

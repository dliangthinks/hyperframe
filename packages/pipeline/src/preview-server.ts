import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createNetServer } from "node:net";
import {
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { resolve, join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

interface PreviewInstance {
  port: number;
  server: Server;
  projectPath: string;
  url: string;
}

const instances = new Map<string, PreviewInstance>();
let nextPort = 3200;

async function findAvailablePort(start: number): Promise<number> {
  return new Promise((resolve) => {
    const server = createNetServer();
    server.listen(start, () => {
      server.close(() => resolve(start));
    });
    server.on("error", () => {
      resolve(findAvailablePort(start + 1));
    });
  });
}

/**
 * Locate a file by walking up from this module through node_modules hops.
 *
 * `@hyperframes/core` and `@hyperframes/player` apply strict `exports` maps so
 * `require.resolve("@hyperframes/core/dist/...")` throws ERR_PACKAGE_PATH_NOT_EXPORTED.
 * We bypass exports by resolving via filesystem walk — fine because we only
 * read these assets, never import them.
 */
function findInNodeModules(relative: string): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "node_modules", relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const RUNTIME_PATH = findInNodeModules(
  "@hyperframes/core/dist/hyperframe.runtime.iife.js",
);
const PLAYER_PATH = findInNodeModules(
  "@hyperframes/player/dist/hyperframes-player.global.js",
);

if (!RUNTIME_PATH || !PLAYER_PATH) {
  // Fail loudly — a missing asset here is a packaging bug, not a user error.
  console.warn(
    "[preview-server] Could not locate hyperframes runtime/player assets.",
    { RUNTIME_PATH, PLAYER_PATH },
  );
}

// Inject our runtime script into the user's index.html so GSAP timelines
// actually drive visibility. Mirrors hyperframes play's injection.
function injectRuntime(html: string): string {
  const tag = `<script src="/runtime.js"></script>`;
  if (html.includes("</body>")) return html.replace("</body>", `${tag}\n</body>`);
  return html + `\n${tag}`;
}

function buildPlayerPage(projectName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        background: #0a0a0a;
        height: 100%;
        overflow: hidden;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .player-wrap {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      hyperframes-player {
        display: block;
        width: 100%;
        height: 100%;
        max-width: 100vw;
        max-height: 100vh;
        aspect-ratio: 16 / 9;
      }
    </style>
  </head>
  <body>
    <div class="player-wrap">
      <hyperframes-player src="/composition/index.html" controls></hyperframes-player>
    </div>
    <script src="/player.js"></script>
    <script>
      // Honor ?t=<seconds> — the shell passes this when the user clicks a
      // scene in the sidebar, so playback jumps straight to that scene's
      // start time once the player reports ready.
      (function () {
        const params = new URLSearchParams(window.location.search);
        const t = parseFloat(params.get("t") || "");
        if (!isFinite(t) || t < 0) return;
        const player = document.querySelector("hyperframes-player");
        if (!player) return;
        let seeked = false;
        const trySeek = () => {
          if (seeked) return;
          try {
            player.seek(t);
            seeked = true;
          } catch {
            // Not ready yet — wait for the "ready" event.
          }
        };
        player.addEventListener("ready", trySeek, { once: true });
        // Fallback: some versions fire no "ready" event but expose seek()
        // as soon as the component upgrades. Poll briefly.
        let attempts = 0;
        const iv = setInterval(() => {
          trySeek();
          if (seeked || ++attempts > 40) clearInterval(iv);
        }, 100);
      })();
    </script>
  </body>
</html>`;
}

const MIME: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function contentType(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Start a minimal preview server for this project.
 *
 * Routes:
 *   GET /                 → bare player page (hyperframes-player web component)
 *   GET /runtime.js       → @hyperframes/core runtime (drives data-* attributes)
 *   GET /player.js        → @hyperframes/player web component
 *   GET /composition/*    → files under the project dir (.html has runtime injected)
 *
 * No Hyperframes Studio UI, no browser auto-open — just the composition.
 */
export async function startPreview(
  projectPath: string,
  onStatus?: (message: string) => void,
): Promise<{ port: number; url: string }> {
  await stopPreview(projectPath);

  if (!RUNTIME_PATH || !PLAYER_PATH) {
    throw new Error(
      "Preview assets missing: @hyperframes/core and @hyperframes/player must be installed.",
    );
  }

  const port = await findAvailablePort(nextPort);
  nextPort = port + 1;

  onStatus?.("Starting preview server...");

  const projectName =
    projectPath.split("/").filter(Boolean).pop() ?? "project";

  const server = createHttpServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const pathname = url.pathname;

      if (pathname === "/" || pathname === "/index.html") {
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Cache-Control": "no-store",
        });
        res.end(buildPlayerPage(projectName));
        return;
      }

      if (pathname === "/runtime.js") {
        res.writeHead(200, {
          "Content-Type": "application/javascript",
          "Cache-Control": "no-store",
        });
        res.end(readFileSync(RUNTIME_PATH));
        return;
      }

      if (pathname === "/player.js") {
        res.writeHead(200, {
          "Content-Type": "application/javascript",
          "Cache-Control": "no-store",
        });
        res.end(readFileSync(PLAYER_PATH));
        return;
      }

      if (pathname.startsWith("/composition/")) {
        const relPath = decodeURIComponent(pathname.slice("/composition/".length));
        const filePath = resolve(projectPath, relPath);
        if (!filePath.startsWith(projectPath)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ct = contentType(filePath);
        if (ct === "text/html") {
          const body = injectRuntime(readFileSync(filePath, "utf-8"));
          res.writeHead(200, { "Content-Type": ct, "Cache-Control": "no-store" });
          res.end(body);
          return;
        }
        res.writeHead(200, { "Content-Type": ct, "Cache-Control": "no-store" });
        res.end(readFileSync(filePath));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    } catch (err) {
      res.writeHead(500);
      res.end(`Preview server error: ${(err as Error).message}`);
    }
  });

  return new Promise((resolveP, rejectP) => {
    server.on("error", (err) => rejectP(err));
    server.listen(port, () => {
      const pageUrl = `http://localhost:${port}/`;
      instances.set(projectPath, {
        port,
        server,
        projectPath,
        url: pageUrl,
      });
      resolveP({ port, url: pageUrl });
    });
  });
}

export async function stopPreview(projectPath: string): Promise<void> {
  const instance = instances.get(projectPath);
  if (instance) {
    await new Promise<void>((r) => instance.server.close(() => r()));
    instances.delete(projectPath);
  }
}

export async function stopAllPreviews(): Promise<void> {
  for (const [path] of instances) {
    await stopPreview(path);
  }
}

export function getPreviewPort(projectPath: string): number | null {
  return instances.get(projectPath)?.port ?? null;
}

export function getPreviewUrl(projectPath: string): string | null {
  return instances.get(projectPath)?.url ?? null;
}

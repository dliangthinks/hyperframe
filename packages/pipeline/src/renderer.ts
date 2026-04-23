import { spawn, type ChildProcess } from "node:child_process";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { RenderOpts } from "./types.js";

interface RenderCallbacks {
  onProgress: (data: { percent: number; message: string }) => void;
  onComplete: (outputPath: string) => void;
  onError: (error: Error) => void;
}

let activeRender: ChildProcess | null = null;

// Hyperframes CLI progress format (packages/cli/src/ui/progress.ts):
//   "  <bar>  <N>%  <stage message>"
// Lines are \r-refreshed. We read chunks and split on both \n and \r, then
// pull out the percent and trailing message from whichever fragment matches.
const PROGRESS_REGEX = /(\d+)%\s+(.+?)(?:\x1b|$)/;

/**
 * Render a Hyperframes composition to MP4.
 *
 *   npx hyperframes render <projectPath> --output <path> --fps <fps> --quality <q>
 */
export async function startRender(
  projectPath: string,
  opts: RenderOpts,
  callbacks: RenderCallbacks,
): Promise<void> {
  const outputPath = opts.outputPath;
  await mkdir(dirname(outputPath), { recursive: true });

  const args = [
    "--yes",
    "hyperframes",
    "render",
    projectPath,
    "--output",
    outputPath,
    "--fps",
    String(opts.fps ?? 30),
    "--quality",
    opts.quality ?? "standard",
    "--format",
    opts.format ?? "mp4",
  ];

  const proc = spawn("npx", args, {
    cwd: projectPath,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  activeRender = proc;

  let stderrTail = "";
  const appendStderr = (chunk: string) => {
    stderrTail = (stderrTail + chunk).slice(-2000);
  };

  // ANSI escape codes for colors/cursor moves clutter the stream; strip them
  // before regex matching so PROGRESS_REGEX doesn't need to handle them.
  const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

  const handleData = (data: Buffer, isStderr: boolean) => {
    const text = data.toString();
    if (isStderr) appendStderr(text);

    const cleaned = text.replace(ANSI, "");
    // Split on both newlines and carriage returns — renderProgress() uses \r.
    const fragments = cleaned.split(/[\r\n]+/);
    for (const frag of fragments) {
      const m = frag.match(PROGRESS_REGEX);
      if (m) {
        const percent = Math.max(0, Math.min(100, parseInt(m[1], 10)));
        const message = m[2].trim();
        callbacks.onProgress({ percent, message });
      }
    }
  };

  proc.stderr.on("data", (d: Buffer) => handleData(d, true));
  proc.stdout.on("data", (d: Buffer) => handleData(d, false));

  proc.on("close", (code) => {
    activeRender = null;
    if (code === 0) {
      callbacks.onComplete(outputPath);
    } else {
      const detail = stderrTail.trim() || "no stderr output";
      callbacks.onError(new Error(`Render failed (exit ${code}).\n${detail}`));
    }
  });

  proc.on("error", (err) => {
    activeRender = null;
    callbacks.onError(new Error(`Failed to start render: ${err.message}`));
  });
}

export function cancelRender(): void {
  if (activeRender) {
    activeRender.kill();
    activeRender = null;
  }
}

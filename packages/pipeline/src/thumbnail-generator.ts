import { spawn } from "node:child_process";
import { readFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ManifestEntry } from "./types.js";

interface ThumbnailProgress {
  current: number;
  total: number;
}

/**
 * Compute the start time (in seconds) of each scene in the video, based on
 * TTS durations laid end-to-end with no gap. This mirrors the timing Claude
 * Code should wire into the composition.
 */
function sceneStartsSeconds(manifest: ManifestEntry[]): number[] {
  const starts: number[] = [];
  let cursor = 0;
  for (const entry of manifest) {
    starts.push(cursor);
    cursor += entry.durationMs / 1000;
  }
  return starts;
}

/**
 * Capture one PNG per scene using Hyperframes' built-in snapshot command:
 *
 *   npx hyperframes snapshot <projectPath> --at "<t0>,<t1>,<t2>,..."
 *
 * The CLI writes PNGs into `<projectPath>/snapshots/`. We move them into
 * `<projectPath>/public/thumbs/scene-NN.png` so the sidebar can reference
 * them with a stable naming scheme.
 */
export async function generateThumbnails(
  projectPath: string,
  onProgress?: (progress: ThumbnailProgress) => void,
): Promise<string[]> {
  const manifestRaw = await readFile(
    join(projectPath, "tts-manifest.json"),
    "utf-8",
  );
  const manifest: ManifestEntry[] = JSON.parse(manifestRaw);
  if (manifest.length === 0) return [];

  // Capture past each scene's entrance animation. The Remotion app uses
  // 30 frames (= 1.0s at 30fps) past scene start, capped at scene end - 5.
  // We mirror that: 1.0s offset, capped at sceneDuration - 0.17s (~5 frames).
  const OFFSET_SECONDS = 1.0;
  const END_MARGIN_SECONDS = 0.17;
  const starts = sceneStartsSeconds(manifest);
  const timestamps = starts.map((start, i) => {
    const duration = manifest[i].durationMs / 1000;
    const maxCapture = start + Math.max(0, duration - END_MARGIN_SECONDS);
    return Math.min(start + OFFSET_SECONDS, maxCapture);
  });
  const at = timestamps.map((t) => t.toFixed(2)).join(",");

  const thumbsDir = join(projectPath, "public", "thumbs");
  await mkdir(thumbsDir, { recursive: true });

  await runSnapshot(projectPath, at);

  // Snapshots are written to <projectPath>/snapshots/*.png — move them into
  // public/thumbs/scene-NN.png in the order they were requested.
  const snapshotsDir = join(projectPath, "snapshots");
  const entries = (await readdir(snapshotsDir).catch(() => [] as string[]))
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();

  const outputPaths: string[] = [];
  for (let i = 0; i < manifest.length && i < entries.length; i++) {
    const src = join(snapshotsDir, entries[i]);
    const destName = `scene-${String(i).padStart(2, "0")}.png`;
    const dest = join(thumbsDir, destName);
    await rename(src, dest).catch(async () => {
      // Cross-device fallback: copy + unlink is not needed here since both
      // paths are under the same project root, but guard anyway.
      const data = await readFile(src);
      await (await import("node:fs/promises")).writeFile(dest, data);
      await rm(src).catch(() => {});
    });
    outputPaths.push(dest);
    onProgress?.({ current: i + 1, total: manifest.length });
  }

  // Clean up any stragglers in snapshots/ — keeps the project directory tidy.
  await rm(snapshotsDir, { recursive: true, force: true }).catch(() => {});

  return outputPaths;
}

function runSnapshot(projectPath: string, at: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ["--yes", "hyperframes", "snapshot", projectPath, "--at", at];
    const proc = spawn("npx", args, {
      cwd: projectPath,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("error", (err) =>
      reject(new Error(`Failed to spawn hyperframes snapshot: ${err.message}`)),
    );
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`hyperframes snapshot exited with code ${code}\n${stderr}`));
    });
  });
}

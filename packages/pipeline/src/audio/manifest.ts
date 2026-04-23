import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ManifestEntry } from "../types.js";

/**
 * Hyperframes has no `src/` directory by default — it's a flat project with
 * `index.html` at the root. We keep the manifest at the project root so the
 * composition can `fetch('./tts-manifest.json')` or the scene generator can
 * read it directly.
 */
const MANIFEST_NAME = "tts-manifest.json";

export async function writeManifest(
  projectPath: string,
  manifest: ManifestEntry[],
): Promise<void> {
  const manifestPath = join(projectPath, MANIFEST_NAME);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

export async function readManifest(projectPath: string): Promise<ManifestEntry[]> {
  const manifestPath = join(projectPath, MANIFEST_NAME);
  const raw = await readFile(manifestPath, "utf-8");
  return JSON.parse(raw) as ManifestEntry[];
}

import { copyFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import type { AudioProvider, ManifestEntry } from "../types.js";

async function getAudioDurationMs(filePath: string): Promise<number> {
  const { parseFile } = await import("music-metadata");
  const meta = await parseFile(filePath);
  return Math.round((meta.format.duration ?? 0) * 1000);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export class FileAudioProvider implements AudioProvider {
  readonly id = "file";
  readonly name = "User Audio Files";

  private filePaths: string[] = [];

  setFiles(paths: string[]): void {
    this.filePaths = paths;
  }

  async generate(
    sentences: string[],
    outputDir: string,
    onProgress: (current: number, total: number) => void,
  ): Promise<ManifestEntry[]> {
    if (this.filePaths.length < sentences.length) {
      throw new Error(
        `Not enough audio files: got ${this.filePaths.length}, need ${sentences.length}`,
      );
    }

    const ttsDir = join(outputDir, "public", "audio", "tts");
    await mkdir(ttsDir, { recursive: true });

    const manifest: ManifestEntry[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sourcePath = this.filePaths[i];
      if (!(await fileExists(sourcePath))) {
        throw new Error(`Audio file not found: ${sourcePath}`);
      }

      const filename = `scene-${String(i).padStart(2, "0")}.mp3`;
      const destPath = join(ttsDir, filename);
      const audioPath = `public/audio/tts/${filename}`;

      await copyFile(sourcePath, destPath);
      const durationMs = await getAudioDurationMs(destPath);

      manifest.push({ sentence: sentences[i], audioPath, durationMs });
      onProgress(i + 1, sentences.length);
    }

    return manifest;
  }
}

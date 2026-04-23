import { writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import type { AudioProvider, ManifestEntry } from "../types.js";

interface InworldConfig {
  apiKey: string;
  modelId?: string;
  voiceId?: string;
  reuseExisting?: boolean;
}

const ENDPOINT = "https://api.inworld.ai/tts/v1/voice";

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function getAudioDurationMs(filePath: string): Promise<number> {
  const { parseFile } = await import("music-metadata");
  const meta = await parseFile(filePath);
  return Math.round((meta.format.duration ?? 0) * 1000);
}

async function synthesize(
  text: string,
  outputPath: string,
  apiKey: string,
  voiceId: string,
  modelId: string,
): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      text,
      voiceId,
      modelId,
      audioConfig: { audioEncoding: "MP3" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Inworld TTS error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) {
    throw new Error(`No audioContent in response: ${JSON.stringify(json)}`);
  }

  await writeFile(outputPath, Buffer.from(json.audioContent, "base64"));
}

export class InworldProvider implements AudioProvider {
  readonly id = "inworld";
  readonly name = "Inworld TTS";

  private config: InworldConfig;

  constructor(config: InworldConfig) {
    this.config = config;
  }

  async generate(
    sentences: string[],
    outputDir: string,
    onProgress: (current: number, total: number) => void,
  ): Promise<ManifestEntry[]> {
    // Hyperframes serves static assets from the project root; we drop TTS
    // files into public/audio/tts/ and reference them from index.html as
    // relative "public/audio/tts/scene-NN.mp3" paths.
    const ttsDir = join(outputDir, "public", "audio", "tts");
    await mkdir(ttsDir, { recursive: true });

    const voiceId = this.config.voiceId ?? "Oliver";
    const modelId = this.config.modelId ?? "inworld-tts-1";
    const manifest: ManifestEntry[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const filename = `scene-${String(i).padStart(2, "0")}.mp3`;
      const outputPath = join(ttsDir, filename);
      const audioPath = `public/audio/tts/${filename}`;

      if (this.config.reuseExisting && (await fileExists(outputPath))) {
        // Reuse existing audio file
      } else {
        await synthesize(sentence, outputPath, this.config.apiKey, voiceId, modelId);
      }

      const durationMs = await getAudioDurationMs(outputPath);
      manifest.push({ sentence, audioPath, durationMs });
      onProgress(i + 1, sentences.length);
    }

    return manifest;
  }
}

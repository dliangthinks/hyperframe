import { readFile } from "node:fs/promises";
import type { AIProvider, AIProgressEvent, Scene } from "./types.js";

interface SceneGenOpts {
  projectPath: string;
  script: string;
  scenes: Scene[];
  skillPath: string;
  aiProvider: AIProvider;
  onProgress: (event: AIProgressEvent) => void;
  /** True when this is a regen on an existing project (different prompt tone). */
  isRegen: boolean;
}

/**
 * Hyperframes compositions live in a single `index.html`. Unlike Remotion —
 * where each scene is its own `Scene<NN>.tsx` — targeted per-scene regen isn't
 * really possible. So we give Claude Code the full scene breakdown every time
 * and let it rewrite the one file.
 */
function buildPrompt(opts: SceneGenOpts): string {
  const sceneBreakdown = opts.scenes
    .map(
      (s) =>
        `Scene ${s.index}: "${s.sentence}" — audio ${s.audioPath} (${s.durationMs} ms)`,
    )
    .join("\n");

  const header = opts.isRegen
    ? `This is an EXISTING Hyperframes project. The narration or scenes have changed — rewrite index.html to reflect the current scene breakdown below. Keep any visual style choices you made previously unless a sentence change demands otherwise.`
    : `Create a Hyperframes composition. The project is scaffolded at the current directory with a blank index.html and TTS audio files already generated.`;

  return `${header}

## Narration Script
${opts.script}

## Scene Breakdown (timing from tts-manifest.json)
${sceneBreakdown}

## Your job
Rewrite \`index.html\` so that:
1. The root element carries \`data-composition-id="main"\`, \`data-start="0"\`, \`data-duration="<totalSeconds>"\`, \`data-width="1920"\`, \`data-height="1080"\`.
2. Each scene is a child element (any tag — \`div\`, \`h1\`, \`img\`) with \`data-start="<seconds>"\` and \`data-duration="<seconds>"\`, a \`data-track-index\` (typically 1 for visuals), and a unique \`id\`.
3. One \`<audio>\` element per scene carries the narration: use the file paths from the scene breakdown above (e.g. \`src="public/audio/tts/scene-00.mp3"\`), \`data-start\` matching the scene's start, \`data-duration\` matching the scene's duration, \`data-track-index="2"\`, and \`data-volume="1"\`.
4. A \`<script>\` block at the end sets \`window.__timelines["main"] = gsap.timeline({ paused: true })\` and adds animations keyed to each scene's start time using GSAP's time-based API (e.g. \`.from("#scene-00", { opacity: 0, duration: 0.5 }, <sceneStartSeconds>)\`).

Use the bundled GSAP CDN already in the template. Do NOT introduce per-scene component files — Hyperframes reads the DOM directly. Keep all styling inline or in a single \`<style>\` block in the head.

Read \`tts-manifest.json\` at the project root for authoritative timing. Place scenes on non-overlapping time ranges covering the full video duration.`;
}

/**
 * Generate the Hyperframes composition via the configured AI provider.
 */
export async function generateScenes(opts: SceneGenOpts): Promise<void> {
  const systemPrompt = await readFile(opts.skillPath, "utf-8");
  const userMessage = buildPrompt(opts);

  await opts.aiProvider.generate({
    cwd: opts.projectPath,
    systemPrompt,
    userMessage,
    onProgress: opts.onProgress,
  });
}

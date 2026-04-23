#!/usr/bin/env node
// Exercise the full regen flow outside of Electron — same sequence the
// SceneDetail "Regenerate" button would fire, but runnable from the CLI.
//
// Usage: node scripts/regen.mjs <project-directory-name>
// e.g.   node scripts/regen.mjs software-built-for-humans

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { config as loadEnv } from "dotenv";
import {
  Pipeline,
  InworldProvider,
  ClaudeCodeProvider,
} from "@hyperframes-app/pipeline";

loadEnv({ path: join(homedir(), ".env") });

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), "..");
const SKILL_PATH = join(REPO_ROOT, "packages", "pipeline", "src", "skill.md");
const OUTPUT_DIR = join(REPO_ROOT, "output");

const projectName = process.argv[2];
if (!projectName) {
  console.error("Usage: node scripts/regen.mjs <project-name>");
  process.exit(1);
}

const projectPath = join(OUTPUT_DIR, projectName);
const projectJsonPath = join(projectPath, "project.json");

const log = (msg) => console.log(`[regen] ${msg}`);

const pipeline = new Pipeline({ skillPath: SKILL_PATH, outputDir: OUTPUT_DIR });
pipeline.setAIProvider(new ClaudeCodeProvider());
if (!process.env.INWORLD_API_KEY) {
  console.error("INWORLD_API_KEY not set in ~/.env — cannot generate audio.");
  process.exit(1);
}
pipeline.setAudioProvider(
  new InworldProvider({
    apiKey: process.env.INWORLD_API_KEY,
    reuseExisting: true,
  }),
);

pipeline.on("status", (d) => log(`[${d.stage}] ${d.message}`));
pipeline.on("audio:progress", (d) => log(`audio ${d.current}/${d.total}`));
pipeline.on("scene:progress", (d) => {
  if (d.type === "tool_use") log(`tool: ${d.content}`);
  else if (d.type === "thumbnail") log(d.content);
});
pipeline.on("error", (d) => log(`ERROR [${d.stage}]: ${d.message}`));

const state = JSON.parse(await readFile(projectJsonPath, "utf-8"));
log(`project has ${state.scenes.length} scenes`);

const sentences = state.scenes.map((s) => s.sentence);

// 1. Audio — fills in audioPath/durationMs per scene.
log("=== generating audio ===");
const manifest = await pipeline.generateAudio(projectPath, sentences);
const hydratedScenes = manifest.map((m, i) => ({
  index: i,
  sentence: m.sentence,
  audioPath: m.audioPath,
  durationMs: m.durationMs,
}));
const totalSec = hydratedScenes.reduce((acc, s) => acc + s.durationMs / 1000, 0);
log(`audio complete — ${hydratedScenes.length} scenes, ~${totalSec.toFixed(1)}s total`);

await pipeline.saveProject(projectPath, {
  scenes: hydratedScenes,
  script: state.script,
});

// 2. Scene generation — spawns Claude Code to rewrite index.html.
log("=== generating composition via Claude Code ===");
await pipeline.generateScenes(
  projectPath,
  { script: state.script, scenes: hydratedScenes, projectPath },
  state.lastGenerated ?? null,
);

const snapshot = { script: state.script, scenes: hydratedScenes };
await pipeline.saveProject(projectPath, { lastGenerated: snapshot });
log("composition generated, project.json updated");

// 3. Thumbnails — one PNG per scene via `hyperframes snapshot`.
log("=== generating thumbnails ===");
try {
  await pipeline.generateThumbnails(projectPath);
  log("thumbnails ready");
} catch (err) {
  log(`thumbnails failed (non-fatal): ${err.message}`);
}

log("done — open the project in the app to preview/render.");
process.exit(0);

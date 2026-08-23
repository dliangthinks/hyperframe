import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadWorkflow } from "./workflow-loader.js";
import { readMetaphors } from "./metaphors.js";
import {
  readBreakdown, readArtDirection, readShootingScript,
} from "./artifacts.js";
import type { BuildResult, CandidateRef, DesignIndex, SceneRef, ShotRef, StructureIssue } from "./types.js";

/**
 * Derives design/index.json from the JSON artifacts and the timing manifest. No
 * markdown is parsed. Structure comes from the breakdown, the look from art
 * direction, candidates/selection from metaphors, per-shot visual from the
 * shooting script. Prose bodies are carried into the index so the app reads one
 * file and never re-parses. Timings always come from the manifest (the clock).
 */

interface ManifestEntry {
  sentence: string;
  audioPath: string;
  durationMs: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export async function buildIndex(projectPath: string): Promise<BuildResult> {
  const dir = join(projectPath, "design");
  const issues: StructureIssue[] = [];

  const manifest = JSON.parse(
    await readFile(join(projectPath, "tts-manifest.json"), "utf8"),
  ) as ManifestEntry[];

  const breakdown = await readBreakdown(projectPath);
  const art = await readArtDirection(projectPath);
  const meta = await readMetaphors(projectPath);
  const script = await readShootingScript(projectPath);

  if (!breakdown) {
    issues.push({
      doc: "breakdown",
      code: "missing_document",
      message: "breakdown.json is not present.",
      hint: "Run stage 1, or migrate the legacy markdown with migrateAll().",
    });
    return { index: null, issues };
  }

  // Composition files present on disk (a scene is "composed" when its file exists).
  let compFiles: string[] = [];
  try {
    compFiles = (await readdir(join(projectPath, "compositions"))).filter((f) => f.endsWith(".html"));
  } catch {
    /* none yet */
  }

  const scenes: SceneRef[] = [];
  const shots: ShotRef[] = [];
  let cursor = 0;

  for (const bScene of breakdown.scenes) {
    const letter = bScene.id.replace(/^scene-/, "");
    const composed = compFiles.includes(`scene-${letter}.html`);
    const sceneStart = cursor;
    const ids: string[] = [];

    for (const idx of bScene.shots) {
      const entry = manifest[idx];
      if (!entry) {
        issues.push({
          doc: "breakdown",
          code: "duration_mismatch",
          message: `Scene ${bScene.id} references shot ${idx}, which is not in the manifest.`,
          hint: "The breakdown's shot indices must match the narration manifest.",
        });
        continue;
      }
      const id = `s${String(idx).padStart(2, "0")}`;
      const dur = round(entry.durationMs / 1000);
      const directive = script?.shots[id];
      shots.push({
        id,
        scene: bScene.id,
        start: round(cursor),
        duration: dur,
        narration: entry.sentence,
        anchor: "",
        textObjects: directive?.textObjects,
        words: directive?.words,
        devices: directive?.devices ?? [],
        assets: directive?.assets ?? [],
        instruction: directive?.instruction,
        ...(composed ? { composition: `compositions/scene-${letter}.html` } : {}),
      } as ShotRef);
      ids.push(id);
      cursor = round(cursor + dur);
    }

    const mScene = meta?.scenes[bScene.id];
    const candidates: CandidateRef[] = (mScene?.candidates ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      status: (mScene!.selectedId === c.id
        ? "selected"
        : mScene!.selectedId
          ? "rejected"
          : "proposed") as CandidateRef["status"],
      cost: c.cost,
      anchor: "",
      body: c.body,
    }));

    scenes.push({
      id: bScene.id,
      title: mScene?.title ?? bScene.title,
      start: round(sceneStart),
      duration: round(cursor - sceneStart),
      source: /payoff|invent/i.test(bScene.function) ? "invented" : "authored",
      anchor: "",
      world: mScene?.world,
      candidates,
      shots: ids,
    } as SceneRef);
  }

  const runtime = round(manifest.reduce((a, e) => a + e.durationMs, 0) / 1000);

  // Staleness is state; carry it across rebuilds.
  let stages: DesignIndex["stages"] = {};
  try {
    const prior = JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as DesignIndex;
    if (prior.stages) stages = prior.stages;
  } catch {
    /* first build */
  }

  const index: DesignIndex = {
    version: 1,
    runtime,
    docs: {
      breakdown: "design/breakdown.json",
      artDirection: "design/art-direction.json",
      metaphors: "design/metaphors.json",
      shootingScript: "design/shooting-script.json",
    },
    tokens: art?.tokens ?? {},
    type: art?.type ?? [],
    stages,
    scenes,
    shots,
  };

  await writeFile(join(dir, "index.json"), JSON.stringify(index, null, 2), "utf8");
  return { index, issues };
}

export async function writeIndex(projectPath: string): Promise<BuildResult> {
  return buildIndex(projectPath);
}

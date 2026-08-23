import { EventEmitter } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { shotSections } from "./sections.js";
import type { AIProvider } from "../types.js";
import type { DesignIndex, DocKey } from "./types.js";
import { loadWorkflow } from "./workflow-loader.js";

/**
 * Composes ONE scene's HTML from the approved artifacts. The app dispatches this;
 * Claude Code authors the file. Stage 5 is transcription — the Composer assembles
 * the brief (tokens, per-shot timing/narration/devices/assets, the scene's design
 * prose, the contract) and dispatches it, exactly as the feedback runner does for
 * a re-run. It writes no HTML itself.
 */

const skillDir = join(dirname(fileURLToPath(import.meta.url)), "skills");

const round = (n: number) => Math.round(n * 1000) / 1000;

export interface ComposeEvents {
  start: { scene: string; shots: number };
  progress: { type: string; content: string };
  done: { scene: string; file: string };
  error: { scene: string; message: string };
}

export class Composer extends EventEmitter {
  constructor(private ai: AIProvider) {
    super();
  }

  async compose(projectPath: string, sceneId: string): Promise<{ file: string }> {
    const dir = join(projectPath, "design");
    const index = JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as DesignIndex;
    const scene = index.scenes.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Scene ${sceneId} not in index.`);

    const letter = sceneId.replace(/^scene-/, "");
    // A composition is transcription of an APPROVED design. If a stage it depends
    // on is stale — e.g. the shooting script after a metaphor change — refuse:
    // composing now would encode a design the intermediate stage hasn't caught up to.
    const wf = await loadWorkflow(projectPath).catch(() => null);
    if (wf) {
      const comp = wf.stages.find((st) => st.pane === "composition");
      const staleDeps = (comp?.dependsOn ?? []).filter(
        (d) => index.stages?.[d] === "stale",
      );
      if (staleDeps.length) {
        const msg = `Cannot compose: ${staleDeps.join(", ")} ${
          staleDeps.length > 1 ? "are" : "is"
        } stale. Re-run ${staleDeps.length > 1 ? "those stages" : "that stage"} first — the design changed upstream.`;
        this.emit("error", { scene: sceneId, message: msg });
        throw new Error(msg);
      }
    }


    const file = `compositions/scene-${letter}.html`;

    const shots = scene.shots
      .map((id) => index.shots.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    // Compose reads only what the composition stage depends on: the shooting
    // script (complete per-shot instruction) and art direction. The metaphor is
    // deliberation, not instruction — feeding it dilutes the directive content.
    const shootBodies = shotSections(
      await readFile(join(dir, "04-shooting-script.md"), "utf8").catch(() => ""),
    );
    let artDirection = "";
    try {
      artDirection = await readFile(join(dir, "02-art-direction.md"), "utf8");
    } catch {
      /* tokens still come through the index */
    }

    // Which icons are actually available, so the skill composes only from these.
    let icons: string[] = [];
    try {
      for (const set of ["lucide", "brand"]) {
        const files = await readdir(join(projectPath, "assets", "icons", set)).catch(() => []);
        icons.push(...files.map((f) => `assets/icons/${set}/${f}`));
      }
    } catch {
      /* none vendored yet */
    }

    const skill = await readFile(join(skillDir, "stage-composition.md"), "utf8");

    const envelope = [
      `# Compose ${scene.title} → ${file}`,
      "",
      `Composition id: **scene-${letter}**.  Total duration: **${round(scene.duration)}s** (sum of shot durations below).`,
      "",
      "## Palette tokens (use as CSS variables)",
      ...Object.entries(index.tokens ?? {}).map(([k, v]) => `- \`--${k}\`: ${v}`),
      "",
      "## Type scale",
      ...(index.type ?? []).map((t) => `- ${t.role}: ${t.family}, ${t.px}px`),
      "",
      "## Shots (local start is relative to this scene; first shot starts at 0)",
      ...shots.map((s) => {
        const localStart = round(s.start - scene.start);
        return [
          `### ${s.id} — local start ${localStart}s, duration ${round(s.duration)}s`,
          `Narration (the clock, verbatim): "${s.narration}"`,
          s.words != null ? `On-screen word budget: ~${s.words}.` : "",
          s.textObjects != null ? `Max text objects: ${s.textObjects}.` : "",
          s.devices?.length ? `Devices: ${s.devices.join(", ")}.` : "",
          s.assets?.length ? `Assets: ${s.assets.join(", ")}.` : "",
          "",
          "Instruction — what to show, how, in detail (this is the shooting script):",
          shootBodies[`shot-${Number(s.id.slice(1))}`] ||
            "(MISSING — this shot has no shooting-script entry. Report it; do not invent one.)",
        ]
          .filter(Boolean)
          .join("\n");
      }),
      "",
      "## Art direction (the look)",
      artDirection || "(see palette tokens above)",
      "",
      "## Available icons (inline these; do not invent paths)",
      icons.length ? icons.map((i) => `- ${i}`).join("\n") : "(none vendored — report if you need one)",
    ].join("\n");

    this.emit("start", { scene: sceneId, shots: shots.length });

    try {
      await this.ai.generate({
        cwd: projectPath,
        systemPrompt: skill,
        userMessage: envelope,
        onProgress: (p) => this.emit("progress", { type: p.type, content: p.content }),
      });
      this.emit("done", { scene: sceneId, file });
      return { file };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit("error", { scene: sceneId, message });
      throw err;
    }
  }
}

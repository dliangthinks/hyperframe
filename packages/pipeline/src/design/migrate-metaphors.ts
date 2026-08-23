import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseHeadings } from "./sections.js";
import { writeMetaphors, type MetaphorDoc, type SceneMetaphor, type Candidate } from "./metaphors.js";

/**
 * One-time migration: 03-metaphors.md → metaphors.json. Preserves the authored
 * scene worlds and candidate descriptions, and reads the existing "Selected: N"
 * lines into an explicit selectedId. After this, the md is no longer the source
 * of truth for structure.
 */

const SCENE = /^([A-Z])\s*·\s*(.+?)(?:\s*—.*)?$/;
const CAND = /^Candidate\s+(\d+)\s*[—-]\s*(.+)$/i;

export async function migrateMetaphors(projectPath: string, at: number): Promise<MetaphorDoc> {
  const md = await readFile(join(projectPath, "design", "03-metaphors.md"), "utf8");
  const heads = parseHeadings(md);
  const doc: MetaphorDoc = { version: 1, scenes: {} };

  const sceneHeads = heads.filter((h) => h.level === 2 && SCENE.test(h.text));
  for (let i = 0; i < sceneHeads.length; i++) {
    const head = sceneHeads[i];
    const m = SCENE.exec(head.text)!;
    const letter = m[1].toLowerCase();
    const id = `scene-${letter}`;

    const start = heads.indexOf(head);
    const end = sceneHeads[i + 1] ? heads.indexOf(sceneHeads[i + 1]) : heads.length;
    const span = heads.slice(start, end);

    const candHeads = span.filter((h) => h.level === 3 && CAND.test(h.text));
    const candidates: Candidate[] = candHeads.map((h, k) => {
      const cm = CAND.exec(h.text)!;
      const label = cm[2].replace(/\*\*/g, "").trim();
      return {
        id: `${letter}-${slug(label).slice(0, 24)}`,
        label,
        cost: /cost:\s*low/i.test(h.body) ? "low" : /cost:\s*medium/i.test(h.body) ? "medium" : /cost:\s*high/i.test(h.body) ? "high" : undefined,
        body: h.body.trim(),
        proposedAt: at + k,
      };
    });

    // selection from a scene-level "Selected: N" line anywhere in the span
    const spanText = span.map((h) => h.body).join("\n");
    const nums = Array.from(spanText.matchAll(/\bselected:\s*\**\s*(\d+)/gi)).map((x) => Number(x[1]));
    const selectedIdx = nums.length ? nums[0] - 1 : -1;
    const selectedId = candidates[selectedIdx]?.id ?? null;

    const scene: SceneMetaphor = {
      id,
      title: m[2].replace(/\*\*/g, "").trim(),
      world: head.body.trim(),
      candidates,
      selectedId,
      selectedAt: selectedId ? at : null,
    };
    doc.scenes[id] = scene;
  }

  await writeMetaphors(projectPath, doc);
  return doc;
}

function slug(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}

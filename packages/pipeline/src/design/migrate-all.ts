import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { shotSections } from "./sections.js";
import { migrateMetaphors } from "./migrate-metaphors.js";
import {
  writeBreakdown, writeArtDirection, writeShootingScript,
  type BreakdownDoc, type ArtDirectionDoc, type ShootingScriptDoc, type ShotDirective,
} from "./artifacts.js";

/**
 * One-time migration of the legacy markdown artifacts into the JSON model.
 * Preserves authored content; after this the JSON files are the source of truth
 * and the .md files are legacy. A converter, not an author — it invents nothing.
 */
export async function migrateAll(projectPath: string, at: number): Promise<void> {
  await migrateMetaphors(projectPath, at);
  await migrateBreakdown(projectPath);
  await migrateArtDirection(projectPath);
  await migrateShootingScript(projectPath);
}

const SCENE = /^([A-Z])\s*·\s*(.+?)(?:\s*—.*)?$/;

async function migrateBreakdown(projectPath: string): Promise<void> {
  // Scene → shot ownership, scanned from raw lines: scenes are "## Scene X · …"
  // headings, shots are "**N · Ds**" markers or "### Shot N" headings. Membership
  // is read, never apportioned.
  const md = await readFile(join(projectPath, "design", "04-shooting-script.md"), "utf8").catch(() => "");
  const doc: BreakdownDoc = { version: 1, scenes: [] };
  let current: { id: string; title: string; function: string; shots: number[] } | null = null;

  const sceneLine = /^##\s+Scene\s+([A-Z])\s*·\s*(.+?)(?:\s*—.*)?$/;
  const shotLine = /^(?:\*\*|###\s*Shot\s+)\s*(\d+)\s*[·.]/i;

  for (const raw of md.split("\n")) {
    const sc = sceneLine.exec(raw);
    if (sc) {
      if (current) doc.scenes.push(current);
      current = {
        id: `scene-${sc[1].toLowerCase()}`,
        title: sc[2].replace(/\*\*/g, "").trim(),
        function: /payoff/i.test(raw) ? "payoff" : /turn/i.test(raw) ? "turn" : "develop",
        shots: [],
      };
      continue;
    }
    const shot = shotLine.exec(raw);
    if (shot && current) current.shots.push(Number(shot[1]));
  }
  if (current) doc.scenes.push(current);
  await writeBreakdown(projectPath, doc);
}

async function migrateArtDirection(projectPath: string): Promise<void> {
  const md = await readFile(join(projectPath, "design", "02-art-direction.md"), "utf8").catch(() => "");
  const tokens: Record<string, string> = {};
  for (const m of md.matchAll(/\|\s*`--([a-z0-9-]+)`\s*\|\s*`(#[0-9A-Fa-f]{3,8})`/g)) tokens[m[1]] = m[2];
  const type: ArtDirectionDoc["type"] = [];
  for (const m of md.matchAll(/^\s*[-*]\s*\*\*([^*]+)\*\*\s*[—-]\s*(serif|sans|mono)\s*,\s*(\d+)px/gim)) {
    type.push({ role: m[1].trim(), family: m[2] as "serif" | "sans" | "mono", px: Number(m[3]) });
  }
  const section = (title: string) => {
    const re = new RegExp(`##+\\s*${title}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`, "i");
    return (re.exec(md)?.[1] ?? "").trim();
  };
  const doc: ArtDirectionDoc = {
    version: 1,
    tokens,
    type,
    shapeLanguage: section("Shape language"),
    motion: section("Motion"),
    notes: section("Surface"),
  };
  await writeArtDirection(projectPath, doc);
}

async function migrateShootingScript(projectPath: string): Promise<void> {
  const md = await readFile(join(projectPath, "design", "04-shooting-script.md"), "utf8").catch(() => "");
  const bodies = shotSections(md);
  const doc: ShootingScriptDoc = { version: 1, shots: {} };
  const list = (body: string, re: RegExp) => {
    const m = re.exec(body);
    if (!m) return [];
    return m[1].split(/·\s*\w+:/)[0].split(/[,+·]/).map((s) => s.replace(/`/g, "").trim())
      .filter((s) => s && !/^(asset|assets|device|devices|duration|intent|inherits|contributes)\b/i.test(s));
  };
  const num = (body: string, re: RegExp) => {
    const m = re.exec(body);
    return m ? Number(m[1]) : 0;
  };
  for (const [slug, body] of Object.entries(bodies)) {
    const n = /shot-(\d+)/.exec(slug);
    if (!n) continue;
    const id = `s${String(Number(n[1])).padStart(2, "0")}`;
    const directive: ShotDirective = {
      textObjects: num(body, /text objects?:\s*(\d+)/i),
      words: num(body, /on-screen words?:\s*(\d+)/i),
      devices: list(body, /devices?:\s*(.+)/i),
      assets: list(body, /assets?:\s*(.+)/i),
      instruction: body,
    };
    doc.shots[id] = directive;
  }
  await writeShootingScript(projectPath, doc);
}

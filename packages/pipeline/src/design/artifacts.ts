import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * The design artifacts as data. Composition (stage 5) is excluded — it is code
 * (HTML), not a design artifact. Narration is excluded — it is the authored
 * script plus the manifest (the clock). Everything else the pipeline generates
 * and the app manipulates is JSON, so structure is declared and never parsed.
 *
 * Inheritance is enforced by shape: the breakdown owns shot structure; the
 * shooting script is an overlay keyed by shot id that can only ADD visual fields.
 * It cannot change how many shots exist, their durations, or their scene — those
 * live in the breakdown, derived from the narration clock.
 */

// ── Stage 1: breakdown — the structure ──────────────────────────────────────
export interface BreakdownScene {
  id: string;                 // scene-a…
  title: string;
  function: string;           // setup / turn / payoff …
  shots: number[];            // manifest indices this scene owns; the source of truth
}
export interface BreakdownDoc {
  version: 1;
  scenes: BreakdownScene[];
}

// ── Stage 2: art direction — the look ────────────────────────────────────────
export interface ArtDirectionDoc {
  version: 1;
  tokens: Record<string, string>;
  type: { role: string; family: "serif" | "sans" | "mono"; px: number }[];
  shapeLanguage: string;      // prose, but a field
  motion: string;
  notes?: string;
}

// ── Stage 4: shooting script — per-shot visual overlay on the breakdown ──────
export interface ShotDirective {
  textObjects: number;        // §5c gate
  words: number;              // on-screen, not narration
  devices: string[];
  assets: string[];
  instruction: string;        // the complete visual directive — prose in a field
}
export interface ShootingScriptDoc {
  version: 1;
  /** Keyed by shot id (s06…). Structure is inherited; only visual fields here. */
  shots: Record<string, ShotDirective>;
}

const read = async <T>(projectPath: string, file: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(join(projectPath, "design", file), "utf8")) as T;
  } catch {
    return null;
  }
};
const write = async (projectPath: string, file: string, doc: unknown): Promise<void> => {
  const dir = join(projectPath, "design");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, file), JSON.stringify(doc, null, 2), "utf8");
};

export const readBreakdown = (p: string) => read<BreakdownDoc>(p, "breakdown.json");
export const writeBreakdown = (p: string, d: BreakdownDoc) => write(p, "breakdown.json", d);
export const readArtDirection = (p: string) => read<ArtDirectionDoc>(p, "art-direction.json");
export const writeArtDirection = (p: string, d: ArtDirectionDoc) => write(p, "art-direction.json", d);
export const readShootingScript = (p: string) => read<ShootingScriptDoc>(p, "shooting-script.json");
export const writeShootingScript = (p: string, d: ShootingScriptDoc) => write(p, "shooting-script.json", d);

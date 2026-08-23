import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Reads design artifacts from disk for the renderer. The markdown is split into
 * sections keyed by heading slug so the app can address a section without ever
 * parsing prose for meaning (README.md §4).
 */

const slugify = (h: string) =>
  h.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

/** Split a document into `slug -> body` at every heading of any level. */
export function splitSections(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = md.split("\n");
  let slug = "";
  let buf: string[] = [];

  const flush = () => {
    if (slug) out[slug] = buf.join("\n").trim();
  };

  for (const line of lines) {
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      flush();
      slug = slugify(h[1]);
      buf = [];
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

/** Index shot bodies by `shot-N`, splitting on `### Shot N` or `**N · Ds**`. */
function shotSections(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = md.split("\n");
  let slug = "";
  let buf: string[] = [];
  const flush = () => {
    if (slug) out[slug] = buf.join("\n").trim();
  };
  const heading = /^#{1,6}\s+Shot\s+(\d+)\b/i;
  const marker = /^\*\*\s*(\d+)\s*[·.]/;
  for (const line of lines) {
    const h = heading.exec(line) ?? marker.exec(line);
    if (h) {
      flush();
      slug = `shot-${h[1]}`;
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export interface DesignPayload {
  index: unknown | null;
  sections: Record<string, Record<string, string>>;
  raw: Record<string, string>;
  missing: string[];
}

export async function readDesign(projectPath: string): Promise<DesignPayload> {
  const dir = join(projectPath, "design");
  const missing: string[] = [];

  let index: unknown | null = null;
  try {
    index = JSON.parse(await readFile(join(dir, "index.json"), "utf8"));
  } catch {
    missing.push("index.json");
  }

  const docs: Record<string, string> = {
    breakdown: "01-breakdown.md",
    artDirection: "02-art-direction.md",
    metaphors: "03-metaphors.md",
    shootingScript: "04-shooting-script.md",
  };

  const sections: Record<string, Record<string, string>> = {};
  const raw: Record<string, string> = {};

  for (const [key, file] of Object.entries(docs)) {
    try {
      const md = await readFile(join(dir, file), "utf8");
      raw[key] = md;
      const base = splitSections(md);
      // The shooting script addresses shots that may be bold markers, not
      // headings — index those too so the app can show a shot's description.
      sections[key] = key === "shootingScript" ? { ...base, ...shotSections(md) } : base;
    } catch {
      missing.push(file);
    }
  }

  return { index, sections, raw, missing };
}


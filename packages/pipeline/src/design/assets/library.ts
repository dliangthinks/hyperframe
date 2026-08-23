import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AssetCandidate } from "./types.js";

/**
 * The local asset library — a cross-project cache of every illustration ever
 * fetched. Searches consult it before any network source: a hit costs no
 * credits and no round-trip. Files are stored as downloaded (pre-recolor),
 * because recolor maps are per-project and applied at ingest.
 */

const dir = () =>
  process.env.HYPERFRAMES_ASSET_LIBRARY ?? join(homedir(), ".hyperframes", "asset-library");

export interface LibraryEntry {
  /** Store key, also the filename stem: `<source>-<sourceId>`. */
  key: string;
  source: string;
  sourceId: string;
  title: string;
  author?: string;
  pageUrl: string;
  /** Every query that ever found or fetched this asset — the search surface. */
  queries: string[];
  addedAt: string;
}

async function readIndex(): Promise<LibraryEntry[]> {
  try {
    return JSON.parse(await readFile(join(dir(), "index.json"), "utf8")) as LibraryEntry[];
  } catch {
    return [];
  }
}

async function writeIndexFile(entries: LibraryEntry[]): Promise<void> {
  await mkdir(dir(), { recursive: true });
  await writeFile(join(dir(), "index.json"), JSON.stringify(entries, null, 2), "utf8");
}

/** Token match against title + accumulated queries. */
export async function searchLibrary(query: string): Promise<AssetCandidate[]> {
  const entries = await readIndex();
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (!tokens.length) return [];
  const scored = entries
    .map((e) => {
      const hay = `${e.title} ${e.queries.join(" ")}`.toLowerCase();
      const score = tokens.filter((t) => hay.includes(t)).length;
      return { e, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map(({ e }) => ({
    ref: `library:${e.key}`,
    source: "library" as const,
    sourceId: e.key,
    title: `${e.title} (cached)`,
    thumbUrl: join(dir(), `${e.key}.svg`),
    pageUrl: e.pageUrl,
    svg: true,
    author: e.author,
  }));
}

export async function libraryEntry(key: string): Promise<LibraryEntry | null> {
  return (await readIndex()).find((e) => e.key === key) ?? null;
}

export async function readLibrarySvg(key: string): Promise<string> {
  return readFile(join(dir(), `${key}.svg`), "utf8");
}

/** Stores a fetched SVG; merges the query into an existing entry's surface. */
export async function deposit(
  svg: string,
  meta: { source: string; sourceId: string; title: string; author?: string; pageUrl: string; query: string },
): Promise<LibraryEntry> {
  const key = `${meta.source}-${meta.sourceId}`;
  const entries = await readIndex();
  let entry = entries.find((e) => e.key === key);
  if (entry) {
    if (meta.query && !entry.queries.includes(meta.query)) entry.queries.push(meta.query);
  } else {
    entry = {
      key,
      source: meta.source,
      sourceId: meta.sourceId,
      title: meta.title,
      author: meta.author,
      pageUrl: meta.pageUrl,
      queries: meta.query ? [meta.query] : [],
      addedAt: new Date().toISOString(),
    };
    entries.push(entry);
    await mkdir(dir(), { recursive: true });
    await writeFile(join(dir(), `${key}.svg`), svg, "utf8");
  }
  await writeIndexFile(entries);
  return entry;
}

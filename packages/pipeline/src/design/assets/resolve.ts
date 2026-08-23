import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { storysetSource, freepikSource } from "./freepik.js";
import { undrawSource } from "./undraw.js";
import { recolorSvg } from "./recolor.js";
import type {
  AssetCandidate,
  AssetManifestEntry,
  AssetSource,
  AssetSourceId,
  IllustrationConstraints,
} from "./types.js";

/**
 * Resolves a visualization need to vendored SVG files, under the project's
 * declared constraints (README §8f). The chain is Storyset → Freepik → unDraw
 * unless art direction says otherwise; a source that errors or returns nothing
 * falls through to the next. Selection stays human: search offers candidates,
 * fetch vendors the one the reviewer picked.
 */

const SOURCES: Record<AssetSourceId, AssetSource> = {
  storyset: storysetSource,
  freepik: freepikSource,
  undraw: undrawSource,
};

const DEFAULT_CHAIN: AssetSourceId[] = ["storyset", "freepik", "undraw"];
const MANIFEST = "asset-manifest.json";

export async function readConstraints(projectPath: string): Promise<IllustrationConstraints> {
  try {
    const raw = await readFile(join(projectPath, "design", "art-direction.json"), "utf8");
    return (JSON.parse(raw).illustration ?? {}) as IllustrationConstraints;
  } catch {
    return {};
  }
}

export async function readManifest(projectPath: string): Promise<AssetManifestEntry[]> {
  try {
    return JSON.parse(
      await readFile(join(projectPath, "design", MANIFEST), "utf8"),
    ) as AssetManifestEntry[];
  } catch {
    return [];
  }
}

/** Authors this project has already committed to — manifest plus declared lock. */
async function preferredAuthors(projectPath: string, c: IllustrationConstraints): Promise<string[]> {
  const manifest = await readManifest(projectPath);
  const used = manifest.map((m) => m.author).filter(Boolean) as string[];
  return [...new Set([...(c.authorLock ?? []), ...used])];
}

export interface ResolveResult {
  source: AssetSourceId;
  candidates: AssetCandidate[];
  /** Sources that were tried before this one and came up empty or errored. */
  fellThrough: { source: AssetSourceId; reason: string }[];
}

/** Walks the priority chain; returns the first source with candidates. */
export async function resolveNeed(
  projectPath: string,
  query: string,
  opts?: { source?: AssetSourceId; limit?: number },
): Promise<ResolveResult> {
  const constraints = await readConstraints(projectPath);
  const prefer = await preferredAuthors(projectPath, constraints);
  const chain = opts?.source ? [opts.source] : constraints.sources ?? DEFAULT_CHAIN;

  const fellThrough: ResolveResult["fellThrough"] = [];
  for (const id of chain) {
    try {
      const candidates = await SOURCES[id].search(query, {
        limit: opts?.limit ?? 6,
        preferAuthors: prefer,
      });
      if (candidates.length) return { source: id, candidates, fellThrough };
      fellThrough.push({ source: id, reason: "no candidates" });
    } catch (err) {
      fellThrough.push({ source: id, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { source: chain[chain.length - 1], candidates: [], fellThrough };
}

/** Downloads one chosen candidate into the project and records provenance. */
export async function fetchAsset(
  projectPath: string,
  candidate: AssetCandidate,
  query: string,
  name?: string,
): Promise<AssetManifestEntry> {
  const constraints = await readConstraints(projectPath);
  let svg = await SOURCES[candidate.source].download(candidate);

  const recolored = Boolean(constraints.recolor && Object.keys(constraints.recolor).length);
  if (recolored) svg = recolorSvg(svg, constraints.recolor!);

  const base = (name ?? query).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = join("assets", "illustrations", `${base}-${candidate.source}.svg`);
  await mkdir(join(projectPath, "assets", "illustrations"), { recursive: true });
  await writeFile(join(projectPath, file), svg, "utf8");

  const entry: AssetManifestEntry = {
    ref: candidate.ref,
    source: candidate.source,
    sourceId: candidate.sourceId,
    title: candidate.title,
    author: candidate.author,
    query,
    file,
    pageUrl: candidate.pageUrl,
    downloadedAt: new Date().toISOString(),
    recolored,
  };
  const manifest = await readManifest(projectPath);
  const next = [...manifest.filter((m) => m.file !== entry.file), entry];
  await mkdir(join(projectPath, "design"), { recursive: true });
  await writeFile(
    join(projectPath, "design", MANIFEST),
    JSON.stringify(next, null, 2),
    "utf8",
  );
  return entry;
}

/** Finds a candidate by its ref across sources (used by the CLI fetch command). */
export async function candidateByRef(
  projectPath: string,
  ref: string,
  query: string,
): Promise<AssetCandidate | null> {
  const [source] = ref.split(":") as [AssetSourceId];
  if (!SOURCES[source]) return null;
  const { candidates } = await resolveNeed(projectPath, query, { source, limit: 24 });
  return candidates.find((c) => c.ref === ref) ?? null;
}

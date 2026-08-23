import type { AssetCandidate, AssetSource, SearchOpts } from "./types.js";

/**
 * Freepik API adapter — one key covers the stock vector catalog and Storyset
 * (Storyset has no API of its own; its assets live in the Freepik catalog under
 * author "storyset" and are surfaced by appending the word to the query).
 *
 * Verified against api.freepik.com 2026-08-23:
 * - GET /v1/resources?term=…&filters[content_type][vector]=1 — search
 * - GET /v1/resources/{id}/download/svg — direct SVG URL (no zip)
 * - meta.available_formats carries per-asset formats; assets without "svg"
 *   are dropped rather than converted.
 */

const API = "https://api.freepik.com/v1";

function apiKey(): string {
  const key = process.env.FREEPIK_API_KEY;
  if (!key) throw new Error("FREEPIK_API_KEY is not set (env or .env).");
  return key;
}

async function fp(path: string): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    headers: { "x-freepik-api-key": apiKey() },
  });
  if (!res.ok) throw new Error(`Freepik API ${res.status} on ${path}`);
  return res.json();
}

function rankByAuthor(cands: AssetCandidate[], prefer?: string[]): AssetCandidate[] {
  if (!prefer?.length) return cands;
  const set = new Set(prefer.map((a) => a.toLowerCase()));
  return [
    ...cands.filter((c) => c.author && set.has(c.author.toLowerCase())),
    ...cands.filter((c) => !c.author || !set.has(c.author.toLowerCase())),
  ];
}

async function searchVectors(
  term: string,
  opts: SearchOpts & { authorOnly?: string; source: "storyset" | "freepik" },
): Promise<AssetCandidate[]> {
  const q = encodeURIComponent(term);
  const j = await fp(`/resources?term=${q}&limit=24&filters%5Bcontent_type%5D%5Bvector%5D=1`);
  const out: AssetCandidate[] = [];
  for (const r of j.data ?? []) {
    const author = r.author?.name as string | undefined;
    if (opts.authorOnly && author !== opts.authorOnly) continue;
    const svg = Boolean(r.meta?.available_formats?.svg);
    if (!svg) continue;
    out.push({
      ref: `${opts.source}:${r.id}`,
      source: opts.source,
      sourceId: String(r.id),
      title: r.title,
      thumbUrl: r.image?.source?.url ?? "",
      pageUrl: r.url,
      svg,
      author,
    });
    if (out.length >= (opts.limit ?? 6)) break;
  }
  return rankByAuthor(out, opts.preferAuthors);
}

async function downloadSvg(sourceId: string): Promise<string> {
  const j = await fp(`/resources/${sourceId}/download/svg`);
  const url = j.data?.[0]?.url;
  if (!url) throw new Error(`No SVG download for freepik resource ${sourceId}.`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SVG download failed (${res.status}).`);
  return res.text();
}

/** Storyset — priority #1. Highest illustration quality; layered, flat-color SVGs. */
export const storysetSource: AssetSource = {
  id: "storyset",
  search: (query, opts) =>
    searchVectors(`${query} storyset`, { ...opts, authorOnly: "storyset", source: "storyset" }),
  download: (c) => downloadSvg(c.sourceId),
};

/** Freepik stock vectors — priority #2. Marketplace: consistency comes from the
 * author lock, so pass art direction's authorLock as preferAuthors. */
export const freepikSource: AssetSource = {
  id: "freepik",
  search: (query, opts) =>
    searchVectors(`${query} flat illustration`, { ...opts, source: "freepik" }),
  download: (c) => downloadSvg(c.sourceId),
};

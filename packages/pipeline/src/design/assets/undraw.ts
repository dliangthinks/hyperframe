import type { AssetCandidate, AssetSource } from "./types.js";

/**
 * unDraw adapter — the fallback source. Single consistent style, free
 * commercial license, no attribution. The public search API returns direct
 * CDN SVG URLs (verified 2026-08-23: GET https://undraw.co/api/search?q=…).
 */

export const undrawSource: AssetSource = {
  id: "undraw",
  async search(query, opts) {
    const res = await fetch(
      `https://undraw.co/api/search?q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "hyperframes-app asset resolver" } },
    );
    if (!res.ok) throw new Error(`unDraw search failed (${res.status}).`);
    const j = (await res.json()) as {
      results?: { title: string; newSlug: string; media: string }[];
    };
    return (j.results ?? []).slice(0, opts?.limit ?? 6).map((r): AssetCandidate => ({
      ref: `undraw:${r.newSlug}`,
      source: "undraw",
      sourceId: r.newSlug,
      title: r.title,
      thumbUrl: r.media,
      pageUrl: `https://undraw.co/search/${encodeURIComponent(query)}`,
      svg: true,
    }));
  },
  async download(c) {
    const res = await fetch(`https://cdn.undraw.co/illustration/${c.sourceId}.svg`);
    if (!res.ok) throw new Error(`unDraw download failed (${res.status}).`);
    return res.text();
  },
};

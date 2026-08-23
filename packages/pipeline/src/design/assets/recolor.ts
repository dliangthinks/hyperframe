/**
 * Palette normalization at ingest — the strongest consistency lever. Sourced
 * SVGs arrive with their own palettes; remapping their colors onto the
 * project's art-direction tokens makes assets from different sources read as
 * one system. Flat illustration styles (Storyset, unDraw) encode color as
 * plain hex fills, so a literal remap is sufficient — no parsing needed.
 */

const HEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function normalize(hex: string): string {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

/** Distinct colors in an SVG with usage counts, most-used first. */
export function extractPalette(svg: string): { color: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of svg.matchAll(HEX)) {
    const c = normalize(m[0]);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([color, count]) => ({ color, count }))
    .sort((a, b) => b.count - a.count);
}

/** Applies a hex→hex map (case/shorthand-insensitive) to every color in the SVG. */
export function recolorSvg(svg: string, map: Record<string, string>): string {
  const norm = new Map(
    Object.entries(map).map(([from, to]) => [normalize(from), to]),
  );
  return svg.replace(HEX, (m) => norm.get(normalize(m)) ?? m);
}

/**
 * Addressing for design artifacts. Every reviewable item in a design document
 * is a heading; its slug is its address. Nothing here interprets prose — it only
 * splits documents at headings so the app can render a section inside its own
 * chrome (README.md §5).
 */

export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export interface Heading {
  level: number;
  text: string;
  slug: string;
  /** Body lines between this heading and the next, trimmed. */
  body: string;
}

export function parseHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  let current: Heading | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (current) {
      current.body = buf.join("\n").trim();
      out.push(current);
    }
  };

  for (const line of md.split("\n")) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      current = { level: m[1].length, text: m[2].trim(), slug: slugify(m[2].trim()), body: "" };
      buf = [];
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export function sectionMap(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of parseHeadings(md)) out[h.slug] = h.body;
  return out;
}

/**
 * The shooting script addresses shots. They may be written as `### Shot N`
 * headings (the contract) or, in older docs, as `**N · 12.5s**` bold markers.
 * This splits on either, keying each shot body by slug `shot-N`, so the app can
 * show a shot's visual description regardless of which form the doc uses.
 */
export function shotSections(md: string): Record<string, string> {
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

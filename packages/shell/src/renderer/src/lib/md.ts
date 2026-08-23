/**
 * Minimal markdown renderer for artifact prose. Deliberately not a dependency:
 * the artifacts use a small, known subset, and the app renders section bodies
 * inside its own chrome rather than whole documents.
 *
 * Supports: headings, paragraphs, unordered lists, blockquotes, tables,
 * `code`, **bold**, *italic*. Everything else falls through as text.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (s: string) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

export function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = Math.min(h[1].length + 2, 6);
      out.push(`<h${lvl} class="md-h">${inline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    if (line.trimStart().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        rows.push(lines[i]);
        i++;
      }
      const cells = (r: string) =>
        r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|[\s|:-]+\|\s*$/.test(r));
      const head = body.shift();
      out.push(
        '<table class="md-table">' +
          (head
            ? `<thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`
            : "") +
          `<tbody>${body
            .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`,
      );
      continue;
    }

    if (/^\s*[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s/, ""));
        i++;
      }
      out.push(`<ul class="md-ul">${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote class="md-quote">${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    out.push(`<p class="md-p">${inline(line)}</p>`);
    i++;
  }

  return out.join("");
}

/** `## The IDE as workshop` → `the-ide-as-workshop` */
export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

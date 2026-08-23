import { useMemo } from "react";
import { renderMarkdown } from "../lib/md";

/**
 * Renders an artifact section's prose inside the app's own chrome. The markdown
 * is display only — the app never reads meaning out of it (README.md §5).
 */
export function Prose({ src, className = "" }: { src: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(src), [src]);
  if (!src.trim()) return null;
  return (
    <div
      className={`prose-artifact text-[13px] leading-relaxed text-zinc-300 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

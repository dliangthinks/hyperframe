import { useDesignStore, sectionFor } from "../../stores/design-store";
import { Prose } from "../Prose";

/**
 * Stage 2 — painted, not printed. Hex values in a table are unjudgeable; the
 * first palette on this project was approved as prose and only revealed as drab
 * after 45s of video had rendered. Swatches catch that in a second.
 */
export function ArtDirectionPane() {
  const index = useDesignStore((s) => s.index);
  const sections = useDesignStore((s) => s.sections);
  const selected = useDesignStore((s) => s.selected);
  const select = useDesignStore((s) => s.select);

  if (!index) return <div className="text-[12px] text-zinc-500">Not generated yet.</div>;

  const tokens = Object.entries(index.tokens ?? {});
  const ground = index.tokens?.ground ?? "#111827";
  const ink = index.tokens?.ink ?? "#f4f4f5";
  const fam = (f: string) =>
    f === "serif"
      ? '"Iowan Old Style", Palatino, Georgia, serif'
      : f === "mono"
        ? '"SF Mono", Menlo, monospace'
        : "-apple-system, Helvetica Neue, Arial, sans-serif";

  return (
    <div>
      <div className="flex gap-1.5">
        {tokens.map(([name, value]) => {
          const on = selected === `token:${name}`;
          return (
            <button
              key={name}
              onClick={() => select(`token:${name}`)}
              className="min-w-0 flex-1 text-left"
              title={value}
            >
              <div
                className={`h-14 rounded border ${on ? "border-sky-400" : "border-zinc-800"}`}
                style={{ background: value }}
              />
              <div className="mt-1 truncate text-[10px] text-zinc-400">{name}</div>
              <div className="truncate font-mono text-[10px] text-zinc-600">{value}</div>
            </button>
          );
        })}
      </div>

      <div
        className="mt-4 rounded border border-zinc-800 p-4"
        style={{ background: ground }}
      >
        {(index.type ?? []).map((t) => (
          <div
            key={t.role}
            className="truncate"
            style={{
              color: t.role === "annotation" ? index.tokens?.brass ?? ink : ink,
              fontFamily: fam(t.family),
              fontSize: Math.min(t.px, 64),
              letterSpacing: t.px < 26 ? "0.12em" : "0.02em",
              textTransform: t.px < 26 ? "uppercase" : "none",
              lineHeight: 1.25,
            }}
          >
            {t.role}
          </div>
        ))}
      </div>

      <div className="mt-1 text-[10px] text-zinc-600">
        Painted from index.json tokens — judged by eye, not by hex. Specimen sizes are
        clamped to 64px for the pane.
      </div>

      <div className="mt-4 border-t border-zinc-800 pt-3">
        <Prose src={sectionFor(sections, "artDirection#palette--blueprint-not-paper")} />
      </div>
    </div>
  );
}

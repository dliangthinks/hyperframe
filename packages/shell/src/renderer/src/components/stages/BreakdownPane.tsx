import { useDesignStore } from "../../stores/design-store";
import { Prose } from "../Prose";

/**
 * Stage 1 — the breakdown as a proportional timeline. "Scene C is 34% of the
 * runtime" reads instantly as width and not at all as a table column.
 */
export function BreakdownPane() {
  const index = useDesignStore((s) => s.index);
  const selected = useDesignStore((s) => s.selected);
  const select = useDesignStore((s) => s.select);

  if (!index) return <div className="text-[12px] text-zinc-500">Not generated yet.</div>;

  const activeScene =
    selected?.startsWith("scene:") &&
    index.scenes.find((s) => s.id === selected.slice(6));

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
        <span>{index.scenes.length} scenes</span>
        <span>·</span>
        <span>{index.shots.length} shots</span>
        <span>·</span>
        <span>{index.runtime.toFixed(1)}s</span>
      </div>

      <div className="flex h-11 overflow-hidden rounded border border-zinc-800">
        {index.scenes.map((scene) => {
          const on = selected === `scene:${scene.id}`;
          return (
            <button
              key={scene.id}
              onClick={() => select(`scene:${scene.id}`)}
              style={{ flex: scene.duration }}
              className={`min-w-0 border-r border-zinc-800 px-1 last:border-r-0 ${
                on ? "bg-sky-500/20 text-sky-300" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
              title={`${scene.title} — ${scene.duration.toFixed(1)}s`}
            >
              <span className="block truncate text-[11px]">{scene.title}</span>
              <span className="block text-[10px] text-zinc-600">
                {Math.round((scene.duration / index.runtime) * 100)}%
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {index.scenes.map((s) => (
          <span
            key={s.id}
            className={`rounded px-1.5 py-0.5 text-[10px] ${
              s.source === "authored"
                ? "bg-emerald-500/15 text-emerald-300"
                : s.source === "invented"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {s.title} · {s.source}
          </span>
        ))}
      </div>

      {activeScene && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <Prose src={activeScene.world ?? ""} />
        </div>
      )}
    </div>
  );
}

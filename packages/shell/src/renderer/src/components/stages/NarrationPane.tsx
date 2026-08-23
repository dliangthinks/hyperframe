import { useDesignStore } from "../../stores/design-store";

/** Stage 0 — authored input. Read only: narration is the clock (README.md §8). */
export function NarrationPane() {
  const index = useDesignStore((s) => s.index);
  const selected = useDesignStore((s) => s.selected);
  const select = useDesignStore((s) => s.select);

  if (!index) return <Empty />;

  return (
    <div className="space-y-1">
      <div className="mb-3 text-[11px] text-zinc-500">
        Authored input, immutable. Every duration downstream is derived from here.
      </div>
      {index.scenes.map((scene) => (
        <div key={scene.id} className="mb-4">
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-xs font-medium text-zinc-300">{scene.title}</span>
            <span className="text-[10px] text-zinc-600">
              {scene.duration.toFixed(1)}s ·{" "}
              {Math.round((scene.duration / index.runtime) * 100)}%
            </span>
          </div>
          {scene.shots.map((id) => {
            const shot = index.shots.find((s) => s.id === id);
            if (!shot) return null;
            const on = selected === `shot:${shot.id}`;
            return (
              <button
                key={shot.id}
                onClick={() => select(`shot:${shot.id}`)}
                className={`mb-1 flex w-full gap-3 rounded border px-2.5 py-2 text-left ${
                  on ? "border-sky-400 bg-zinc-900" : "border-zinc-800 hover:bg-zinc-900/50"
                }`}
              >
                <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                  {shot.duration.toFixed(2)}s
                </span>
                <span className="text-[13px] leading-snug text-zinc-300">
                  {shot.narration}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <div className="text-[12px] text-zinc-500">No design index yet.</div>;
}

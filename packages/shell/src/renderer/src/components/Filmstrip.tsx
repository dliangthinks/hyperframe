import { useDesignStore } from "../stores/design-store";
import { shotBreaches } from "../types/design";

/**
 * Visual confirmation — frames, not labels.
 *
 * This only earns its space once stage 5 has produced snapshots. A row of boxes
 * reading "s05, s06, s07" is a worse copy of the shot list already in the stage 4
 * pane, so the strip stays hidden until there is something to look at. The §5c
 * counts live in the stage 4 pane, where they inform a decision.
 */
export function Filmstrip() {
  const index = useDesignStore((s) => s.index);
  const selected = useDesignStore((s) => s.selected);
  const select = useDesignStore((s) => s.select);

  const withFrames = index?.shots.filter((s) => s.snapshot) ?? [];
  // Nothing to look at yet — the shot list belongs to stage 4, not here.
  if (!index || withFrames.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-3 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">
          Visual confirmation
        </span>
        <span className="text-[10px] text-zinc-500">
          {withFrames.length}/{index.shots.length} frames · {index.runtime.toFixed(1)}s ·
          width ∝ duration
        </span>
      </div>

      <div className="flex gap-1">
        {index.scenes.map((scene) => (
          <div
            key={scene.id}
            className="flex gap-[2px]"
            style={{ flex: scene.duration }}
            title={scene.title}
          >
            {scene.shots.map((shotId) => {
              const shot = index.shots.find((s) => s.id === shotId);
              if (!shot) return null;
              const breaches = shotBreaches(shot);
              const bad = breaches.length > 0;
              const on = selected === `shot:${shot.id}`;
              return (
                <button
                  key={shot.id}
                  onClick={() => select(`shot:${shot.id}`)}
                  style={{ flex: shot.duration }}
                  className="min-w-0 text-left"
                  title={bad ? breaches.join(" · ") : `${shot.duration.toFixed(2)}s`}
                >
                  <div
                    className={`h-12 overflow-hidden rounded-sm border ${
                      on
                        ? "border-sky-400"
                        : bad
                          ? "border-rose-500/70"
                          : "border-zinc-800"
                    } ${shot.snapshot ? "" : "flex items-center justify-center bg-zinc-900/60"}`}
                  >
                    {shot.snapshot ? (
                      <img src={shot.snapshot} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-zinc-700">not rendered</span>
                    )}
                  </div>
                  <div
                    className={`mt-1 truncate text-[10px] ${
                      bad ? "text-rose-400" : "text-zinc-500"
                    }`}
                  >
                    {shot.duration.toFixed(1)}s · {shot.textObjects}t · {shot.words}w
                    {bad ? " ✕" : " ✓"}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

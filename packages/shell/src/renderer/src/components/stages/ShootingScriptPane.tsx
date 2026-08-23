import { useDesignStore } from "../../stores/design-store";
import { shotBreaches } from "../../types/design";
import { Prose } from "../Prose";

/**
 * Stage 4 — the flat all-shots list grouped by scene. This is the only view in
 * which repetition across the whole piece is visible, and where the §5c gate
 * shows up per shot before anything is generated.
 */
export function ShootingScriptPane() {
  const index = useDesignStore((s) => s.index);
  const selected = useDesignStore((s) => s.selected);
  const select = useDesignStore((s) => s.select);

  if (!index) return <div className="text-[12px] text-zinc-500">Not generated yet.</div>;

  const failing = index.shots.filter((s) => shotBreaches(s).length > 0);

  return (
    <div>
      {failing.length > 0 && (
        <div className="mb-3 rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-300">
          {failing.length} of {index.shots.length} shots breach the visual language
          limits. Re-run stage 3 for those shots rather than generating them.
        </div>
      )}

      {index.scenes.map((scene) => (
        <div key={scene.id} className="mb-4">
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-xs font-medium text-zinc-300">{scene.title}</span>
            <span className="text-[10px] text-zinc-600">
              {scene.shots.length} shots · {scene.duration.toFixed(1)}s
            </span>
          </div>

          {scene.shots.map((id) => {
            const shot = index.shots.find((s) => s.id === id);
            if (!shot) return null;
            const breaches = shotBreaches(shot);
            const on = selected === `shot:${shot.id}`;
            return (
              <button
                key={shot.id}
                onClick={() => select(`shot:${shot.id}`)}
                className={`mb-1 block w-full rounded border px-2.5 py-2 text-left ${
                  on
                    ? "border-sky-400 bg-zinc-900"
                    : breaches.length
                      ? "border-rose-500/40 hover:bg-zinc-900/50"
                      : "border-zinc-800 hover:bg-zinc-900/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-zinc-500">{shot.id}</span>
                  <span className="font-mono text-[10px] text-zinc-600">
                    {shot.duration.toFixed(2)}s
                  </span>
                  <span className="flex-1" />
                  <span
                    className={`text-[10px] ${
                      breaches.length ? "text-rose-400" : "text-zinc-600"
                    }`}
                  >
                    {shot.textObjects} text · {shot.words}w
                  </span>
                </div>

                <div className="mt-0.5 truncate text-[12px] text-zinc-400">
                  {shot.narration}
                </div>

                {breaches.length > 0 && (
                  <div className="mt-1 text-[10px] text-rose-400">
                    {breaches.join(" · ")}
                  </div>
                )}

                <div className="mt-1 flex flex-wrap gap-1">
                  {shot.devices.map((d) => (
                    <span
                      key={d}
                      className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {on && <Prose src={shot.instruction ?? "(no instruction — run stage 4)"} className="mt-2" />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

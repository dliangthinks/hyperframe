import { useState } from "react";
import { useDesignStore } from "../../stores/design-store";
import { useProjectStore } from "../../stores/project-store";
import { Prose } from "../Prose";

/**
 * Stage 3 — where judgment happens. Candidates sit under the scene's narration,
 * quoted verbatim, because a metaphor cannot be judged apart from the sentence
 * it has to serve. Rejected options stay visible.
 */
export function MetaphorPane() {
  const index = useDesignStore((s) => s.index);
  const selected = useDesignStore((s) => s.selected);
  const select = useDesignStore((s) => s.select);
  const loadDesign = useDesignStore((s) => s.loadDesign);
  const projectPath = useProjectStore((s) => s.projectPath);
  const [reminder, setReminder] = useState<string | null>(null);

  async function approve(sceneId: string, candidateId: string) {
    if (!projectPath) return;
    const res = (await window.api.approveCandidate(projectPath, sceneId, candidateId)) as {
      changed: boolean;
    };
    const design = await window.api.readDesign(projectPath);
    loadDesign(design as never);
    setReminder(
      res.changed
        ? "Selection changed — this scene's shooting script is now stale. Re-run it before composing."
        : null,
    );
  }

  if (!index) return <div className="text-[12px] text-zinc-500">Not generated yet.</div>;

  const sceneId = selected?.startsWith("scene:")
    ? selected.slice(6)
    : selected?.startsWith("candidate:")
      ? index.scenes.find((s) => s.candidates.some((c) => `candidate:${c.id}` === selected))?.id
      : selected?.startsWith("shot:")
        ? index.shots.find((s) => `shot:${s.id}` === selected)?.scene
        : index.scenes[0]?.id;

  const scene = index.scenes.find((s) => s.id === sceneId) ?? index.scenes[0];
  if (!scene) return null;

  const shots = scene.shots
    .map((id) => index.shots.find((s) => s.id === id))
    .filter(Boolean);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {index.scenes.map((s) => (
          <button
            key={s.id}
            onClick={() => select(`scene:${s.id}`)}
            className={`rounded px-2 py-0.5 text-[11px] ${
              s.id === scene.id
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-900"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="rounded bg-zinc-900 px-3 py-2.5">
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-zinc-600">
          Narration · {shots.length} shots · {scene.duration.toFixed(1)}s
        </div>
        {shots.map((shot) => (
          <p
            key={shot!.id}
            className="mb-1 text-[13px] leading-snug text-zinc-300"
            style={{ fontFamily: '"Iowan Old Style", Palatino, Georgia, serif' }}
          >
            <span className="mr-2 font-mono text-[10px] not-italic text-zinc-600">
              {shot!.duration.toFixed(1)}s
            </span>
            {shot!.narration}
          </p>
        ))}
      </div>

      {reminder && (
        <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-300">
          {reminder}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {scene.candidates.map((c) => {
          const on = selected === `candidate:${c.id}`;
          const sel = c.status === "selected";
          return (
            <button
              key={c.id}
              onClick={() => select(`candidate:${c.id}`)}
              className={`block w-full rounded border px-3 py-2.5 text-left ${
                on
                  ? "border-sky-400 bg-zinc-900"
                  : sel
                    ? "border-emerald-500/50"
                    : "border-zinc-800 hover:bg-zinc-900/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-zinc-200">{c.label}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    sel
                      ? "bg-emerald-500/15 text-emerald-300"
                      : c.status === "rejected"
                        ? "bg-zinc-800 text-zinc-500"
                        : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {c.status}
                </span>
                <span className="flex-1" />
                {c.cost && (
                  <span className="text-[10px] text-zinc-600">cost {c.cost}</span>
                )}
                {!sel && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      approve(scene.id, c.id);
                    }}
                    className="rounded border border-emerald-600/50 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Approve
                  </button>
                )}
              </div>
              <Prose src={c.body ?? ""} className="mt-1.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useDesignStore } from "../../stores/design-store";
import { useProjectStore } from "../../stores/project-store";

interface LogLine {
  kind: "tool" | "text" | "status" | "error";
  text: string;
}

/**
 * Stage 5 — compose scenes from the approved design, and the door into Edit.
 * "Compose" dispatches the composition skill for one scene (the app authors
 * nothing), streams the work, then reloads so the new file is reflected.
 */
export function CompositionPane() {
  const index = useDesignStore((s) => s.index);
  const setMode = useDesignStore((s) => s.setMode);
  const select = useDesignStore((s) => s.select);
  const loadDesign = useDesignStore((s) => s.loadDesign);
  const projectPath = useProjectStore((s) => s.projectPath);
  const workflow = useDesignStore((s) => s.workflow);

  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => logEnd.current?.scrollIntoView({ block: "end" }), [log]);

  useEffect(() => {
    if (!window.api?.onPipelineEvent) return;
    const add = (l: LogLine) => setLog((prev) => [...prev.slice(-200), l]);
    const offs = [
      window.api.onPipelineEvent("design:compose:start", (d: any) =>
        add({ kind: "status", text: `Composing ${d.scene} (${d.shots} shots)…` }),
      ),
      window.api.onPipelineEvent("design:compose:progress", (d: any) => {
        if (d.type === "tool_use") add({ kind: "tool", text: d.content });
        else if (d.type === "text" && d.content.trim()) add({ kind: "text", text: d.content });
      }),
      window.api.onPipelineEvent("design:compose:done", (d: any) =>
        add({ kind: "status", text: `Wrote ${d.file}` }),
      ),
      window.api.onPipelineEvent("design:compose:error", (d: any) =>
        add({ kind: "error", text: d.message }),
      ),
    ];
    return () => offs.forEach((f) => f && f());
  }, []);

  if (!index) return <div className="text-[12px] text-zinc-500">No design index yet.</div>;

  async function compose(sceneId: string) {
    if (!projectPath) return;
    setBusy(sceneId);
    setLog([{ kind: "status", text: `Dispatching composition for ${sceneId}…` }]);
    try {
      const res = (await window.api.compose(projectPath, sceneId)) as {
        file?: string;
        error?: string;
      };
      if (res.error) setLog((l) => [...l, { kind: "error", text: res.error! }]);
      const design = await window.api.readDesign(projectPath);
      loadDesign(design as never);
    } finally {
      setBusy(null);
    }
  }

  const composedShots = index.shots.filter((s) => s.composition);
  const compStage = workflow?.stages.find((st) => st.pane === "composition");
  const staleDeps = (compStage?.dependsOn ?? []).filter(
    (d) => (index.stages as Record<string, string> | undefined)?.[d] === "stale",
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 text-[11px] text-zinc-500">
        Compose a scene from its approved design. Generation is transcription — the composition
        stage refuses a shot that breaks the visual-language limits.
      </div>

      {staleDeps.length > 0 && (
        <div className="mb-3 rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-300">
          {staleDeps.join(", ")} {staleDeps.length > 1 ? "are" : "is"} stale after an upstream
          change. Re-run {staleDeps.length > 1 ? "those stages" : "that stage"} before composing —
          composing now would encode a design the shooting script hasn't caught up to.
        </div>
      )}
      <div className="space-y-1.5">
        {index.scenes.map((scene) => {
          const built = scene.shots
            .map((id) => index.shots.find((s) => s.id === id))
            .some((s) => s?.composition);
          return (
            <div
              key={scene.id}
              className="flex items-center gap-2 rounded border border-zinc-800 px-2.5 py-2"
            >
              <span className="text-[12px] text-zinc-300">{scene.title}</span>
              <span className="text-[10px] text-zinc-600">
                {scene.shots.length} shots · {scene.duration.toFixed(1)}s
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  built
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {built ? "composed" : "not composed"}
              </span>
              <span className="flex-1" />
              <button
                onClick={() => compose(scene.id)}
                disabled={busy !== null || staleDeps.length > 0}
                className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200 hover:bg-zinc-900 disabled:opacity-40"
              >
                {busy === scene.id ? "Composing…" : built ? "Recompose" : "Compose"}
              </button>
            </div>
          );
        })}
      </div>

      {composedShots.length > 0 && (
        <button
          onClick={() => {
            select(`shot:${composedShots[0].id}`);
            setMode("edit");
          }}
          className="mt-3 self-start rounded border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-200 hover:bg-zinc-900"
        >
          Open in Edit →
        </button>
      )}

      {log.length > 0 && (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-3">
          <div className="space-y-1.5">
            {log.map((l, i) =>
              l.kind === "tool" ? (
                <div key={i} className="font-mono text-[10px] text-zinc-500">↳ {l.text}</div>
              ) : l.kind === "error" ? (
                <div key={i} className="text-[11px] text-rose-400">{l.text}</div>
              ) : l.kind === "status" ? (
                <div key={i} className="text-[11px] text-zinc-400">{l.text}</div>
              ) : (
                <div key={i} className="text-[11px] leading-relaxed text-zinc-300">{l.text}</div>
              ),
            )}
            {busy && <div className="text-[11px] text-zinc-500">▍</div>}
            <div ref={logEnd} />
          </div>
        </div>
      )}
    </div>
  );
}

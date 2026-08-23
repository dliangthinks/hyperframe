import { useEffect, useState } from "react";
import { useDesignStore } from "../stores/design-store";
import { useProjectStore } from "../stores/project-store";
import type { StageDef, Workflow, PaneType } from "../types/design";

const PANES: PaneType[] = [
  "narration", "timeline", "tokens", "candidates", "shotlist", "composition", "raw",
];

/**
 * See the active workflow, switch to another, and customize it. Editing forks a
 * project-local copy on save; built-ins stay pristine. Structure lives here —
 * quality lives in the skills each stage names.
 */
export function WorkflowPanel({ onClose }: { onClose: () => void }) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const active = useDesignStore((s) => s.workflow);
  const setWorkflow = useDesignStore((s) => s.setWorkflow);

  const [all, setAll] = useState<Workflow[]>([]);
  const [draft, setDraft] = useState<Workflow | null>(active);
  const [issues, setIssues] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (projectPath && window.api?.listWorkflows) {
      window.api.listWorkflows(projectPath).then((w) => setAll(w as Workflow[]));
    }
  }, [projectPath]);

  useEffect(() => setDraft(active), [active]);

  if (!draft) return null;

  const stages = draft.stages;
  const edit = (next: Workflow) => {
    setDraft(next);
    setDirty(true);
    window.api?.validateWorkflow(next).then((is) =>
      setIssues((is as { message: string }[]).map((i) => i.message)),
    );
  };

  const patchStage = (i: number, patch: Partial<StageDef>) =>
    edit({ ...draft, stages: stages.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    edit({ ...draft, stages: next });
  };

  const remove = (i: number) =>
    edit({ ...draft, stages: stages.filter((_, k) => k !== i) });

  const add = () =>
    edit({
      ...draft,
      stages: [
        ...stages,
        {
          id: `stage-${stages.length}`,
          label: "New stage",
          skill: "",
          pane: "raw",
          dependsOn: stages.length ? [stages[stages.length - 1].id] : [],
        },
      ],
    });

  async function save() {
    if (!projectPath || !draft) return;
    const forkId = draft.id === active?.id && all.some((w) => w.id === draft.id)
      ? draft.id
      : draft.id;
    const res = (await window.api.saveWorkflow(projectPath, draft)) as {
      ok: boolean;
      issues: { message: string }[];
    };
    if (res.ok) {
      setWorkflow(draft as never);
      setDirty(false);
      void forkId;
      onClose();
    } else {
      setIssues(res.issues.map((i) => i.message));
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-zinc-950/98">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-800 px-3">
        <span className="text-[13px] text-zinc-200">Workflow</span>
        <select
          value={draft.id}
          onChange={(e) => {
            const wf = all.find((w) => w.id === e.target.value);
            if (wf) {
              setWorkflow(wf as never);
              setDirty(false);
            }
          }}
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[12px] text-zinc-200"
        >
          {all.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        {dirty && <span className="text-[11px] text-amber-300">unsaved</span>}
        <button
          onClick={save}
          disabled={issues.length > 0}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[12px] text-zinc-200 hover:bg-zinc-900 disabled:opacity-40"
        >
          Save to project
        </button>
        <button
          onClick={onClose}
          className="rounded border border-zinc-800 px-2 py-0.5 text-[12px] text-zinc-400 hover:bg-zinc-900"
        >
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-[12px] text-zinc-500">{draft.description}</p>

        {issues.length > 0 && (
          <div className="mb-3 rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-300">
            {issues.map((m, i) => (
              <div key={i}>{m}</div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {stages.map((s, i) => (
            <div
              key={i}
              className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-zinc-600">{i}</span>
                <input
                  value={s.label}
                  onChange={(e) => patchStage(i, { label: e.target.value })}
                  className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[13px] text-zinc-200"
                />
                {s.input && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    input
                  </span>
                )}
                <span className="flex-1" />
                <button onClick={() => move(i, -1)} className="px-1 text-zinc-500 hover:text-zinc-200">↑</button>
                <button onClick={() => move(i, 1)} className="px-1 text-zinc-500 hover:text-zinc-200">↓</button>
                <button
                  onClick={() => remove(i)}
                  className="px-1 text-zinc-600 hover:text-rose-400"
                  aria-label="Remove stage"
                >
                  ✕
                </button>
              </div>

              <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[11px]">
                <label className="text-zinc-500">skill</label>
                <input
                  value={s.skill}
                  placeholder="skill name that authors this stage"
                  onChange={(e) => patchStage(i, { skill: e.target.value })}
                  className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                />

                <label className="text-zinc-500">pane</label>
                <select
                  value={s.pane}
                  onChange={(e) => patchStage(i, { pane: e.target.value as PaneType })}
                  className="w-fit rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300"
                >
                  {PANES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <label className="text-zinc-500">doc</label>
                <input
                  value={s.doc ?? ""}
                  placeholder="(none — produces no document)"
                  onChange={(e) => patchStage(i, { doc: e.target.value || undefined })}
                  className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                />

                <label className="text-zinc-500">depends on</label>
                <div className="flex flex-wrap gap-1.5">
                  {stages
                    .filter((_, k) => k < i)
                    .map((dep) => {
                      const on = s.dependsOn.includes(dep.id);
                      return (
                        <button
                          key={dep.id}
                          onClick={() =>
                            patchStage(i, {
                              dependsOn: on
                                ? s.dependsOn.filter((d) => d !== dep.id)
                                : [...s.dependsOn, dep.id],
                            })
                          }
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            on
                              ? "bg-sky-500/20 text-sky-300"
                              : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {dep.id}
                        </button>
                      );
                    })}
                  {i === 0 && <span className="text-[10px] text-zinc-600">nothing upstream</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={add}
          className="mt-3 rounded border border-dashed border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-zinc-900"
        >
          + Add stage
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
          Reorder, add, or drop stages here — that is the structure. Each stage names a{" "}
          <span className="font-mono">skill</span> that does the authoring; changing the skill
          changes quality, not structure. Saving writes a copy into this project; built-in
          workflows are never modified.
        </p>
      </div>
    </div>
  );
}

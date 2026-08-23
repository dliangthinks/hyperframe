import { useDesignStore, stageStatus } from "../stores/design-store";
import type { StageStatus } from "../types/design";

const DOT: Record<StageStatus, string> = {
  locked: "bg-zinc-600",
  pending: "bg-zinc-700",
  review: "bg-amber-400",
  approved: "bg-emerald-400",
  stale: "bg-rose-400",
};

const LABEL: Record<StageStatus, string> = {
  locked: "input",
  pending: "not generated",
  review: "needs review",
  approved: "approved",
  stale: "stale",
};

export function StageRail({ onOpenWorkflow }: { onOpenWorkflow: () => void }) {
  const stage = useDesignStore((s) => s.stage);
  const setStage = useDesignStore((s) => s.setStage);
  const workflow = useDesignStore((s) => s.workflow);
  const index = useDesignStore((s) => s.index);
  const missing = useDesignStore((s) => s.missing);
  const stages = workflow?.stages ?? [];

  return (
    <div className="w-44 shrink-0 border-r border-zinc-800 bg-zinc-950 py-2 overflow-y-auto">
      <button
        onClick={onOpenWorkflow}
        className="mb-1 flex w-full items-center gap-1.5 px-3 pb-2 pt-1 text-left"
        title="View, switch, or customize the workflow"
      >
        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
          {workflow?.label ?? "No workflow"}
        </span>
        <span className="text-[11px] text-zinc-600">⚙</span>
      </button>
      <div className="px-3 pb-2 text-[10px] uppercase tracking-widest text-zinc-600">
        Stages
      </div>
      {stages.map((s) => {
        const status = stageStatus(index, missing, s);
        const active = s.id === stage;
        return (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={`w-full text-left px-3 py-2 flex items-start gap-2 border-l-2 ${
              active
                ? "border-l-sky-400 bg-zinc-900"
                : "border-l-transparent hover:bg-zinc-900/50"
            }`}
          >
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[status]}`} />
            <span className="min-w-0">
              <span
                className={`block text-xs truncate ${
                  active ? "text-zinc-100" : "text-zinc-400"
                }`}
              >
                {s.label}
              </span>
              <span className="block text-[10px] text-zinc-600">{LABEL[status]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

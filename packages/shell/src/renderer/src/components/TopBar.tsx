import { useProjectStore } from "../stores/project-store";
import { useDesignStore } from "../stores/design-store";
import { MainMenu } from "./MainMenu";
import { RenderButton } from "./RenderButton";

interface TopBarProps {
  onOpenProject: (path: string) => void;
}

export function TopBar({ onOpenProject }: TopBarProps) {
  const projectName = useProjectStore((s) => s.projectName);
  const mode = useDesignStore((s) => s.mode);
  const setMode = useDesignStore((s) => s.setMode);
  const index = useDesignStore((s) => s.index);

  /* Edit is downstream of stage 5 — unreachable until a composition exists. */
  const canEdit = Boolean(index?.shots.some((s) => s.composition));

  return (
    <div className="h-11 shrink-0 app-drag-region flex items-center px-3 border-b border-zinc-800 bg-zinc-950">
      {/* Left — leave room for macOS traffic lights */}
      <div className="flex items-center gap-2 pl-16">
        <MainMenu onOpenProject={onOpenProject} />
      </div>

      {/* Center — mode switch + project name */}
      <div className="flex flex-1 items-center justify-center gap-3 pointer-events-none">
        <div className="flex rounded border border-zinc-800 p-0.5 pointer-events-auto">
          {(["design", "edit"] as const).map((m) => (
            <button
              key={m}
              onClick={() => canEdit || m === "design" ? setMode(m) : undefined}
              disabled={m === "edit" && !canEdit}
              title={
                m === "edit" && !canEdit
                  ? "Available once stage 5 has generated a composition"
                  : undefined
              }
              className={`px-2 py-0.5 text-[11px] capitalize rounded-sm ${
                mode === m
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 disabled:hover:text-zinc-600 disabled:opacity-40"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500 select-none">
          {projectName ?? "Hyperframes"}
        </span>
      </div>

      {/* Right — Render */}
      <div className="flex items-center gap-2">
        <RenderButton />
      </div>
    </div>
  );
}

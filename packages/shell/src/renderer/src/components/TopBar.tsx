import { useProjectStore } from "../stores/project-store";
import { MainMenu } from "./MainMenu";
import { RenderButton } from "./RenderButton";

interface TopBarProps {
  onOpenProject: (path: string) => void;
}

export function TopBar({ onOpenProject }: TopBarProps) {
  const projectName = useProjectStore((s) => s.projectName);

  return (
    <div className="h-11 shrink-0 app-drag-region flex items-center px-3 border-b border-zinc-800 bg-zinc-950">
      {/* Left — leave room for macOS traffic lights */}
      <div className="flex items-center gap-2 pl-16">
        <MainMenu onOpenProject={onOpenProject} />
      </div>

      {/* Center — project name */}
      <div className="flex-1 text-center">
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

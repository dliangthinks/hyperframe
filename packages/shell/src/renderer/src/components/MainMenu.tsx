import { useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "../stores/project-store";

interface ProjectInfo {
  name: string;
  path: string;
  updatedAt: string;
}

interface MainMenuProps {
  onOpenProject: (path: string) => void;
}

export function MainMenu({ onOpenProject }: MainMenuProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [creating, setCreating] = useState(false);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!window.api) return;
    try {
      const list = await window.api.listProjects();
      setProjects(list);
    } catch (err) {
      console.error("Failed to list projects:", err);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpenDialog = async () => {
    if (!window.api) return;
    const dirPath = await window.api.selectDirectory();
    if (dirPath) {
      onOpenProject(dirPath);
      setOpen(false);
    }
  };

  const handleNewProject = async () => {
    if (!window.api || creating) return;
    const name = window.prompt("Project name:", `video-${Date.now()}`);
    if (!name) return;
    setCreating(true);
    try {
      const info = await window.api.createProject(name);
      onOpenProject(info.path);
      setOpen(false);
    } catch (err) {
      console.error("Failed to create project:", err);
      alert(`Failed to create project: ${err instanceof Error ? err.message : err}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        aria-label="Menu"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
              Projects
            </span>
            <div className="flex gap-3">
              <button
                onClick={handleNewProject}
                disabled={creating}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
              >
                {creating ? "Creating…" : "New"}
              </button>
              <button
                onClick={handleOpenDialog}
                className="text-[11px] text-indigo-400 hover:text-indigo-300"
              >
                Open folder…
              </button>
            </div>
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            {projects.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-zinc-600 italic">
                No projects yet
              </div>
            ) : (
              projects.map((p) => (
                <button
                  key={p.path}
                  onClick={() => {
                    onOpenProject(p.path);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    p.path === projectPath
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-300 hover:bg-zinc-800/60"
                  }`}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback } from "react";
import { useProjectStore } from "../stores/project-store";

export function RenderButton() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const previewReady = useProjectStore((s) => s.previewReady);
  const renderStatus = useProjectStore((s) => s.renderStatus);
  const renderProgress = useProjectStore((s) => s.renderProgress);
  const pipelineMessage = useProjectStore((s) => s.pipelineMessage);
  const setRenderStatus = useProjectStore((s) => s.setRenderStatus);
  const setRenderProgress = useProjectStore((s) => s.setRenderProgress);

  const isRendering = renderStatus === "rendering";
  const isError = renderStatus === "error";
  const canRender = !!projectPath && previewReady && !isRendering;

  const handleRender = useCallback(async () => {
    if (!projectPath) return;
    const outputPath = await window.api.saveDialog();
    if (!outputPath) return;

    setRenderStatus("rendering");
    setRenderProgress(0, "");
    try {
      await window.api.startRender(projectPath, {
        outputPath,
        fps: 30,
        quality: "standard",
        format: "mp4",
      });
    } catch {
      setRenderStatus("error");
    }
  }, [projectPath]);

  const handleCancel = useCallback(() => {
    window.api.cancelRender();
    setRenderStatus("idle");
  }, []);

  if (!projectPath) return null;

  if (isRendering) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800">
        <span className="text-[11px] text-amber-400 font-medium tabular-nums">
          {renderProgress.toFixed(0)}%
        </span>
        <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${renderProgress}%` }}
          />
        </div>
        <button
          onClick={handleCancel}
          className="text-[11px] text-red-400 hover:text-red-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleRender}
      disabled={!canRender}
      title={isError ? pipelineMessage : undefined}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5
        disabled:opacity-30 disabled:cursor-not-allowed
        ${
          isError
            ? "bg-red-600 hover:bg-red-500 text-white active:bg-red-700"
            : "bg-amber-600 hover:bg-amber-500 text-white active:bg-amber-700"
        }`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {isError ? "Retry" : "Render"}
    </button>
  );
}

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useProjectStore } from "./stores/project-store";
import { TopBar } from "./components/TopBar";
import { SceneSidebar } from "./components/SceneSidebar";
import { SceneDetail } from "./components/SceneDetail";
import React from "react";

class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: "#ef4444", fontFamily: "monospace" }}>
          <h2>Render Error</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", color: "#a1a1aa", fontSize: 12 }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const setPipelineStatus = useProjectStore((s) => s.setPipelineStatus);
  const setAudioProgress = useProjectStore((s) => s.setAudioProgress);
  const setPreviewReady = useProjectStore((s) => s.setPreviewReady);
  const setRenderProgress = useProjectStore((s) => s.setRenderProgress);
  const setRenderStatus = useProjectStore((s) => s.setRenderStatus);
  const setRenderOutputPath = useProjectStore((s) => s.setRenderOutputPath);
  const addActivity = useProjectStore((s) => s.addActivity);
  const projectName = useProjectStore((s) => s.projectName);
  const setProject = useProjectStore((s) => s.setProject);
  const setScript = useProjectStore((s) => s.setScript);
  const setScenes = useProjectStore((s) => s.setScenes);
  const setSelectedSceneIndex = useProjectStore((s) => s.setSelectedSceneIndex);
  const setLastRenderPath = useProjectStore((s) => s.setLastRenderPath);
  const setLastGenerated = useProjectStore((s) => s.setLastGenerated);
  const [apiReady, setApiReady] = useState(false);

  const loadProject = useCallback(async (path: string) => {
    if (!window.api) return;
    try {
      const state = await window.api.openProject(path);
      setProject(state.name, path);
      setScript(state.script);
      setScenes(state.scenes ?? []);
      setSelectedSceneIndex(0);
      setLastGenerated(state.lastGenerated ?? null);

      if (state.renders?.length > 0) {
        const latest = state.renders[state.renders.length - 1];
        setLastRenderPath(`${path}/${latest.path}`);
      } else {
        setLastRenderPath(null);
      }

      if (state.lastGenerated) {
        setPipelineStatus("preview", "Starting preview server...");
        try {
          const { port, url } = await window.api.startPreview(path);
          setPreviewReady(port, url ?? null);
          setPipelineStatus("complete", "Ready");
        } catch {
          setPipelineStatus("idle", "");
        }
      }

      await window.api.setLastProject(path);
    } catch (err) {
      console.error("Failed to open project:", err);
    }
  }, []);

  useEffect(() => {
    if (window.api) {
      setApiReady(true);
    } else {
      console.error("window.api is not available — preload script may have failed");
    }
  }, []);

  useEffect(() => {
    if (!apiReady) return;
    window.api.getLastProject().then((path: string | null) => {
      if (path) loadProject(path);
    });
  }, [apiReady, loadProject]);

  useEffect(() => {
    if (!apiReady) return;
    const title = projectName ? `${projectName} — Hyperframes` : "Hyperframes";
    window.api.setTitle(title);
  }, [projectName, apiReady]);

  const handleMenuOpen = useCallback(async () => {
    if (!window.api) return;
    const dirPath = await window.api.selectDirectory();
    if (dirPath) loadProject(dirPath);
  }, [loadProject]);

  useEffect(() => {
    if (!apiReady) return;
    const cleanups = [
      window.api.onMenuEvent("open-project", handleMenuOpen),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, [apiReady, handleMenuOpen]);

  useEffect(() => {
    if (!apiReady) return;
    const cleanups = [
      window.api.onPipelineEvent("status", (data: any) => {
        setPipelineStatus(data.stage, data.message);
        addActivity("status", data.message);
      }),
      window.api.onPipelineEvent("audio:progress", (data: any) => {
        setAudioProgress(data.current, data.total);
        addActivity("audio", `Audio ${data.current}/${data.total}`);
      }),
      window.api.onPipelineEvent("scene:progress", (data: any) => {
        addActivity(data.type, data.content);
      }),
      // Intentionally no `preview:ready` handler — the direct return value
      // from startPreview() sets both port and URL. This event would fire
      // with port only and clobber previewUrl back to null.
      window.api.onPipelineEvent("render:progress", (data: any) => {
        setRenderProgress(data.percent, data.message ?? "");
      }),
      window.api.onPipelineEvent("render:complete", (data: any) => {
        setRenderStatus("complete");
        setRenderOutputPath(data.outputPath);
        addActivity("status", "Render complete");
      }),
      window.api.onPipelineEvent("error", (data: any) => {
        setPipelineStatus("error", data.message);
        addActivity("error", data.message);
        if (data.stage === "render") setRenderStatus("error");
      }),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, [apiReady]);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <TopBar onOpenProject={loadProject} />

      <div className="flex-1 flex min-h-0">
        <aside className="w-[140px] shrink-0 border-r border-zinc-800 overflow-y-auto bg-zinc-950">
          <SceneSidebar />
        </aside>

        <main className="flex-1 min-w-0">
          <SceneDetail />
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "../stores/project-store";
import { ScenePreview } from "./ScenePreview";

export function SceneDetail() {
  const scenes = useProjectStore((s) => s.scenes);
  const selectedSceneIndex = useProjectStore((s) => s.selectedSceneIndex);
  const setSelectedSceneIndex = useProjectStore((s) => s.setSelectedSceneIndex);
  const updateSceneText = useProjectStore((s) => s.updateSceneText);
  const setScenes = useProjectStore((s) => s.setScenes);

  const projectPath = useProjectStore((s) => s.projectPath);
  const script = useProjectStore((s) => s.script);
  const sentences = useProjectStore((s) => s.sentences);
  const pipelineStage = useProjectStore((s) => s.pipelineStage);
  const previewReady = useProjectStore((s) => s.previewReady);
  const lastGenerated = useProjectStore((s) => s.lastGenerated);
  const setPipelineStatus = useProjectStore((s) => s.setPipelineStatus);
  const setPreviewReady = useProjectStore((s) => s.setPreviewReady);
  const setLastGenerated = useProjectStore((s) => s.setLastGenerated);
  const bumpThumbRevision = useProjectStore((s) => s.bumpThumbRevision);
  const clearActivityLog = useProjectStore((s) => s.clearActivityLog);

  const [capturing, setCapturing] = useState(false);

  const isGenerating =
    pipelineStage !== "idle" &&
    pipelineStage !== "complete" &&
    pipelineStage !== "error";

  const scene = scenes[selectedSceneIndex];

  // Grab the <webview>'s current frame and save it as this scene's thumbnail.
  // Works because `<hyperframes-player>` playback/seek is accurate — whatever
  // the user has scrubbed to in the player is exactly what gets captured.
  const handleUpdateThumbnail = useCallback(async () => {
    if (!projectPath || !scene || capturing) return;
    setCapturing(true);
    try {
      const webview = document.querySelector("webview") as
        | (HTMLElement & {
            capturePage: () => Promise<{ toPNG: () => Uint8Array }>;
          })
        | null;
      if (!webview || typeof webview.capturePage !== "function") {
        throw new Error("Preview webview not found");
      }
      const img = await webview.capturePage();
      const png = img.toPNG();
      await window.api.saveThumbnail(projectPath, scene.index, png);
      bumpThumbRevision();
    } catch (err) {
      console.error("Thumbnail capture failed:", err);
    } finally {
      setCapturing(false);
    }
  }, [projectPath, scene, capturing, bumpThumbRevision]);

  // Keyboard shortcuts (gated on focus so typing in the script textarea
  // still works normally):
  //   P          → capture current webview frame as this scene's thumbnail
  //   ArrowUp    → select previous scene
  //   ArrowDown  → select next scene
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        handleUpdateThumbnail();
        return;
      }
      if (e.key === "ArrowUp" && scenes.length > 0) {
        e.preventDefault();
        const next = Math.max(0, selectedSceneIndex - 1);
        if (next !== selectedSceneIndex) setSelectedSceneIndex(next);
        return;
      }
      if (e.key === "ArrowDown" && scenes.length > 0) {
        e.preventDefault();
        const next = Math.min(scenes.length - 1, selectedSceneIndex + 1);
        if (next !== selectedSceneIndex) setSelectedSceneIndex(next);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUpdateThumbnail, scenes.length, selectedSceneIndex]);

  const handleRegenerate = useCallback(async () => {
    if (!projectPath || sentences.length === 0) return;
    clearActivityLog();
    try {
      const changes = await window.api.detectChanges(
        projectPath,
        { script, scenes, projectPath },
        lastGenerated,
      );

      if (changes.noChanges) {
        setPipelineStatus("complete", "No changes detected");
        return;
      }

      const needsAudio =
        !lastGenerated ||
        changes.changedScenes.length > 0 ||
        changes.addedScenes.length > 0;

      let hydratedScenes = scenes;
      if (needsAudio) {
        setPipelineStatus("audio", "Generating audio...");
        const manifest = await window.api.generateAudio(projectPath, sentences);
        // Rehydrate scenes with fresh audio/duration from the manifest.
        hydratedScenes = manifest.map((m: any, i: number) => ({
          index: i,
          sentence: m.sentence,
          audioPath: m.audioPath,
          durationMs: m.durationMs,
        }));
        setScenes(hydratedScenes);
      }

      setPipelineStatus("scene-gen", "Generating composition...");
      await window.api.generateScenes(projectPath, {
        script,
        scenes: hydratedScenes,
        projectPath,
        lastGenerated,
      });

      const snapshot = { script, scenes: hydratedScenes };
      setLastGenerated(snapshot);
      await window.api.saveProject(projectPath, {
        lastGenerated: snapshot,
        scenes: hydratedScenes,
        script,
      });

      setPipelineStatus("preview", "Starting preview...");
      const { port, url } = await window.api.startPreview(projectPath);
      setPreviewReady(port, url ?? null);

      try {
        setPipelineStatus("scene-gen", "Generating thumbnails...");
        await window.api.generateThumbnails(projectPath);
        bumpThumbRevision();
      } catch (err) {
        console.warn("Thumbnail generation failed:", err);
      }

      setPipelineStatus("complete", "Video ready");
    } catch (err) {
      setPipelineStatus("error", err instanceof Error ? err.message : "Unknown error");
    }
  }, [projectPath, sentences, script, scenes, lastGenerated]);

  if (!scene) {
    // No scenes loaded yet — surface a minimal "paste a script" editor so the
    // user can bootstrap a brand-new project without leaving the main pane.
    const handleSeedScript = (text: string) => {
      const lines = text
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const seeded = lines.map((sentence, index) => ({
        index,
        sentence,
        audioPath: "",
        durationMs: 0,
      }));
      setScenes(seeded);
    };
    return (
      <div className="h-full flex flex-col p-4 gap-3 min-h-0">
        <div className="flex-1 min-h-0 flex items-center justify-center text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-lg">
          {projectPath
            ? "Paste a narration script below (one sentence per line), then click Regenerate."
            : "Open or create a project from the menu."}
        </div>
        <div className="h-[160px] shrink-0 flex gap-3">
          <textarea
            defaultValue=""
            onBlur={(e) => handleSeedScript(e.target.value)}
            placeholder="One sentence per line..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm text-zinc-100 resize-none focus:outline-none focus:border-zinc-600 leading-relaxed"
            disabled={!projectPath}
          />
          <div className="w-[200px] shrink-0 flex flex-col gap-2">
            <button
              onClick={handleRegenerate}
              disabled={!projectPath || isGenerating || sentences.length === 0}
              className="w-full px-3 py-2 rounded-md text-xs font-medium transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed
                bg-indigo-600 hover:bg-indigo-500 text-white active:bg-indigo-700"
            >
              {isGenerating ? "Generating..." : "⟳ Generate"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3 min-h-0">
      <div className="flex-1 min-h-0">
        <ScenePreview />
      </div>

      <div className="h-[160px] shrink-0 flex gap-3">
        <textarea
          value={scene.sentence}
          onChange={(e) => updateSceneText(scene.index, e.target.value)}
          placeholder="Scene script..."
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm text-zinc-100 resize-none focus:outline-none focus:border-zinc-600 leading-relaxed"
        />

        <div className="w-[200px] shrink-0 flex flex-col gap-2">
          <button
            onClick={handleRegenerate}
            disabled={!projectPath || isGenerating || sentences.length === 0}
            className="w-full px-3 py-2 rounded-md text-xs font-medium transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed
              bg-indigo-600 hover:bg-indigo-500 text-white active:bg-indigo-700"
          >
            {isGenerating ? "Generating..." : "⟳ Regenerate"}
          </button>
          <button
            onClick={handleUpdateThumbnail}
            disabled={!projectPath || !previewReady || capturing}
            title="Capture the current player frame as this scene's thumbnail (P)"
            className="w-full px-3 py-2 rounded-md text-xs font-medium transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed
              bg-zinc-800 hover:bg-zinc-700 text-zinc-200 active:bg-zinc-900 border border-zinc-700"
          >
            {capturing ? "Capturing..." : "📸 Thumbnail (P)"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useProjectStore } from "../stores/project-store";

interface RenderFile {
  name: string;
  path: string;
  mtime: number;
}

/**
 * Preview surface. A finished render is a file, so we play it directly with a
 * <video> — no preview server needed for work that is already rendered. When no
 * render exists, fall back to the live webview (a running Hyperframes preview),
 * and failing that, an empty state.
 */
export function ScenePreview() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const previewUrl = useProjectStore((s) => s.previewUrl);
  const previewPort = useProjectStore((s) => s.previewPort);
  const previewReady = useProjectStore((s) => s.previewReady);
  const scenes = useProjectStore((s) => s.scenes);
  const selectedSceneIndex = useProjectStore((s) => s.selectedSceneIndex);

  const [renders, setRenders] = useState<RenderFile[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!projectPath || !window.api?.listRenders) return;
    window.api.listRenders(projectPath).then((r) => {
      const list = r as RenderFile[];
      setRenders(list);
      setChosen(list[0]?.path ?? null);
    });
  }, [projectPath]);

  useEffect(() => {
    if (!chosen || !window.api?.getFileUrl) {
      setVideoUrl(null);
      return;
    }
    Promise.resolve(window.api.getFileUrl(chosen)).then((u) => setVideoUrl(u as string));
  }, [chosen]);

  // 1. A rendered MP4 exists — play it.
  if (videoUrl) {
    return (
      <div className="flex h-full flex-col rounded-lg border border-zinc-800 bg-black">
        <video
          key={videoUrl}
          src={videoUrl}
          controls
          className="min-h-0 flex-1 rounded-t-lg bg-black"
          style={{ width: "100%", objectFit: "contain" }}
        />
        {renders.length > 0 && (
          <div className="flex items-center gap-2 border-t border-zinc-800 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600">Render</span>
            <select
              value={chosen ?? ""}
              onChange={(e) => setChosen(e.target.value)}
              className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[12px] text-zinc-200"
            >
              {renders.map((r) => (
                <option key={r.path} value={r.path}>
                  {r.name}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-zinc-600">
              newest first · {renders.length} on disk
            </span>
          </div>
        )}
      </div>
    );
  }

  // 2. A live preview server is running — show the webview.
  const hasLive = previewReady && !!previewPort;
  if (hasLive) {
    let sceneStartSec = 0;
    for (let i = 0; i < selectedSceneIndex && i < scenes.length; i++) {
      sceneStartSec += (scenes[i]?.durationMs ?? 0) / 1000;
    }
    const currentDuration = (scenes[selectedSceneIndex]?.durationMs ?? 0) / 1000;
    const landingSec = Math.min(
      sceneStartSec + 1.0,
      sceneStartSec + Math.max(0, currentDuration - 0.17),
    );
    const base = previewUrl ?? `http://localhost:${previewPort}/`;
    const src = `${base}?t=${landingSec.toFixed(3)}`;
    return (
      <div className="relative h-full overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <webview key={src} src={src} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
      </div>
    );
  }

  // 3. Nothing to show.
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="max-w-md px-6 text-center">
        <div className="text-sm font-medium text-zinc-300">No render yet</div>
        <div className="mt-3 text-xs leading-relaxed text-zinc-500">
          Render a composition, or start a live preview, to see it here.
        </div>
      </div>
    </div>
  );
}

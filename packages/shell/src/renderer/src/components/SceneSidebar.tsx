import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../stores/project-store";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function useThumbnailUrls(
  projectPath: string | null,
  count: number,
  cacheBust: unknown,
) {
  const [urls, setUrls] = useState<(string | null)[]>([]);

  useEffect(() => {
    if (!projectPath || count === 0 || !window.api) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    const stamp = Date.now();
    Promise.all(
      Array.from({ length: count }, (_, i) =>
        window.api
          .getFileUrl(`${projectPath}/public/thumbs/scene-${pad2(i)}.png`)
          .then((url: string | null) => (url ? `${url}?t=${stamp}` : null))
          .catch(() => null),
      ),
    ).then((resolved) => {
      if (!cancelled) setUrls(resolved);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, count, cacheBust]);

  return urls;
}

export function SceneSidebar() {
  const scenes = useProjectStore((s) => s.scenes);
  const selectedSceneIndex = useProjectStore((s) => s.selectedSceneIndex);
  const setSelectedSceneIndex = useProjectStore((s) => s.setSelectedSceneIndex);
  const projectPath = useProjectStore((s) => s.projectPath);
  const thumbRevision = useProjectStore((s) => s.thumbRevision);
  const thumbUrls = useThumbnailUrls(projectPath, scenes.length, thumbRevision);

  // Keep the active tile visible when the user arrows through scenes.
  // `block: "nearest"` avoids jumping the sidebar when the tile is already
  // on screen — it only scrolls when the tile is above/below the viewport.
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const el = buttonRefs.current[selectedSceneIndex];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedSceneIndex]);

  if (scenes.length === 0) {
    return (
      <div className="px-3 pt-4 text-[11px] text-zinc-600 italic">No scenes yet</div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {scenes.map((scene, i) => {
        const isSelected = i === selectedSceneIndex;
        const thumbUrl = thumbUrls[i];
        return (
          <button
            key={scene.index}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            onClick={() => setSelectedSceneIndex(i)}
            className={`group relative aspect-video rounded-md border text-left overflow-hidden transition-colors focus:outline-none ${
              isSelected
                ? "border-indigo-500 bg-zinc-800"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900"
            }`}
          >
            {thumbUrl && (
              <img
                src={thumbUrl}
                alt={`Scene ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="absolute top-1.5 left-1.5">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium tabular-nums ${
                  isSelected
                    ? "bg-indigo-500/80 text-white"
                    : "bg-black/60 text-zinc-300"
                }`}
              >
                {i + 1}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

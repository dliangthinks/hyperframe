import { useProjectStore } from "../stores/project-store";

/**
 * Webview-backed preview. Points at our minimal Hyperframes player page
 * served by preview-server.ts — no Studio UI, just the composition.
 *
 * Scene switching mirrors the Remotion app's pattern: the player page reads
 * `?t=<seconds>` from the URL and seeks on ready, and we force a webview
 * remount via `key={src}` when the user picks a different scene.
 */
export function ScenePreview() {
  const previewUrl = useProjectStore((s) => s.previewUrl);
  const previewPort = useProjectStore((s) => s.previewPort);
  const previewReady = useProjectStore((s) => s.previewReady);
  const scenes = useProjectStore((s) => s.scenes);
  const selectedSceneIndex = useProjectStore((s) => s.selectedSceneIndex);

  const hasLive = previewReady && !!previewPort;
  const selectedScene = scenes[selectedSceneIndex];

  if (!hasLive) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
        <div className="text-center max-w-md px-6">
          <div className="text-zinc-300 text-sm font-medium">
            {selectedScene
              ? `Scene ${selectedSceneIndex + 1} not generated yet`
              : "No scenes yet"}
          </div>
          {selectedScene && (
            <div className="text-zinc-500 text-xs mt-3 leading-relaxed">
              <div className="text-zinc-600">
                Click <span className="text-zinc-400">Regenerate</span> to build
                the composition for this script.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Compute the selected scene's start time by summing preceding durations.
  // Land ~1s past the entrance tween so the initial frame is readable;
  // the user can scrub back via the player's scrubber if they want a
  // different moment for the thumbnail.
  let sceneStartSec = 0;
  for (let i = 0; i < selectedSceneIndex && i < scenes.length; i++) {
    sceneStartSec += (scenes[i]?.durationMs ?? 0) / 1000;
  }
  const currentDuration = (selectedScene?.durationMs ?? 0) / 1000;
  const landingSec = Math.min(
    sceneStartSec + 1.0,
    sceneStartSec + Math.max(0, currentDuration - 0.17),
  );
  const base = previewUrl ?? `http://localhost:${previewPort}/`;
  const src = `${base}?t=${landingSec.toFixed(3)}`;

  return (
    <div className="h-full rounded-lg overflow-hidden border border-zinc-800 bg-black relative">
      <webview
        key={src}
        src={src}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      />
    </div>
  );
}

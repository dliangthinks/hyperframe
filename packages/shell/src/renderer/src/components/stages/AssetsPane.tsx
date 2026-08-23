import { useEffect, useState } from "react";
import { useDesignStore } from "../../stores/design-store";
import { useProjectStore } from "../../stores/project-store";
import type { AssetNeed, AssetResolutionKind } from "../../types/design";

/**
 * Stage 4 — the availability picture. Every visual need the metaphors imply,
 * with what was actually secured for it: a vendored SVG (shown, not named) or
 * a declared fallback. This is the gate where "the shooting script will be
 * written against assets that exist" becomes true.
 */

const KIND_STYLE: Record<AssetResolutionKind, { label: string; cls: string }> = {
  svg:        { label: "svg",        cls: "bg-emerald-950 text-emerald-300 border-emerald-800" },
  typography: { label: "typography", cls: "bg-sky-950 text-sky-300 border-sky-800" },
  icon:       { label: "icon",       cls: "bg-indigo-950 text-indigo-300 border-indigo-800" },
  primitive:  { label: "primitive",  cls: "bg-zinc-900 text-zinc-300 border-zinc-700" },
  bespoke:    { label: "bespoke — needs a human", cls: "bg-amber-950 text-amber-300 border-amber-700" },
};

/** Vendored SVG thumbnail, resolved through the local-file protocol. */
function AssetThumb({ file }: { file: string }) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!projectPath || !window.api?.getFileUrl) return;
    Promise.resolve(window.api.getFileUrl(`${projectPath}/${file}`)).then((u) => {
      if (live) setUrl(u as string | null);
    });
    return () => { live = false; };
  }, [projectPath, file]);

  if (!url) {
    return (
      <div className="flex h-24 w-32 shrink-0 items-center justify-center rounded border border-dashed border-zinc-700 text-[10px] text-zinc-600">
        file missing
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={file}
      className="h-24 w-32 shrink-0 rounded border border-zinc-800 bg-white object-contain"
    />
  );
}

function NeedCard({ need }: { need: AssetNeed }) {
  const kind = KIND_STYLE[need.resolution.kind] ?? KIND_STYLE.primitive;
  return (
    <div className="flex gap-3 rounded border border-zinc-800 p-3">
      {need.resolution.kind === "svg" && need.resolution.file ? (
        <AssetThumb file={need.resolution.file} />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-medium text-zinc-200">{need.id}</span>
          <span className={`rounded border px-1.5 py-0.5 text-[10px] ${kind.cls}`}>{kind.label}</span>
        </div>
        <div className="mt-1 text-[12px] text-zinc-400">{need.need}</div>
        {need.resolution.file ? (
          <div className="mt-1 truncate font-mono text-[10px] text-zinc-600">
            {need.resolution.file}
            {need.resolution.ref ? ` · ${need.resolution.ref}` : ""}
          </div>
        ) : null}
        {need.resolution.dropLayers?.length ? (
          <div className="mt-1 text-[10px] text-zinc-500">
            drop layers: {need.resolution.dropLayers.join(", ")}
          </div>
        ) : null}
        <div className="mt-1 text-[11px] text-zinc-500">{need.why}</div>
        <div className="mt-1 truncate text-[10px] text-zinc-700">
          tried: {need.queries.join(" · ")}
        </div>
      </div>
    </div>
  );
}

export function AssetsPane() {
  const assets = useDesignStore((s) => s.assets);
  const index = useDesignStore((s) => s.index);

  if (!assets) {
    return (
      <div className="text-[12px] text-zinc-500">
        Not collected yet — run the assets stage after the metaphors are approved.
      </div>
    );
  }

  const needs = assets.needs ?? [];
  const counts = new Map<string, number>();
  for (const n of needs) counts.set(n.resolution.kind, (counts.get(n.resolution.kind) ?? 0) + 1);
  const bespoke = needs.filter((n) => n.resolution.kind === "bespoke");

  const sceneTitle = (id: string) =>
    index?.scenes.find((s) => s.id === id)?.title ?? id;
  const sceneOrder = [...new Set(needs.map((n) => n.scene))];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-zinc-400">
        <span>{needs.length} needs</span>
        {[...counts.entries()].map(([k, c]) => (
          <span key={k}>{c} {k}</span>
        ))}
      </div>

      {bespoke.length > 0 && (
        <div className="mt-2 rounded border border-amber-800 bg-amber-950/40 p-2 text-[11px] text-amber-300">
          {bespoke.length} need{bespoke.length > 1 ? "s" : ""} escalated as bespoke — no source
          matched and no fallback carries it. Decide before the shooting script runs.
        </div>
      )}

      {sceneOrder.map((sceneId) => (
        <div key={sceneId} className="mt-4">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
            {sceneTitle(sceneId)}
          </div>
          <div className="flex flex-col gap-2">
            {needs.filter((n) => n.scene === sceneId).map((n) => (
              <NeedCard key={n.id} need={n} />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-3 text-[10px] text-zinc-600">
        From design/assets.json — vendored files render from disk; fallbacks are declared
        decisions the shooting script executes as written.
      </div>
    </div>
  );
}

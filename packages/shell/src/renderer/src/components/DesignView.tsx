import { useDesignStore, stageStatus } from "../stores/design-store";
import type { StageStatus, PaneType } from "../types/design";
import { useState } from "react";
import { StageRail } from "./StageRail";
import { WorkflowPanel } from "./WorkflowPanel";
import { FeedbackPanel } from "./FeedbackPanel";
import { Filmstrip } from "./Filmstrip";
import { Prose } from "./Prose";
import { NarrationPane } from "./stages/NarrationPane";
import { BreakdownPane } from "./stages/BreakdownPane";
import { ArtDirectionPane } from "./stages/ArtDirectionPane";
import { MetaphorPane } from "./stages/MetaphorPane";
import { AssetsPane } from "./stages/AssetsPane";
import { ShootingScriptPane } from "./stages/ShootingScriptPane";
import { CompositionPane } from "./stages/CompositionPane";

const BADGE: Record<StageStatus, string> = {
  locked: "bg-zinc-800 text-zinc-500",
  pending: "bg-zinc-800 text-zinc-500",
  review: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  stale: "bg-rose-500/15 text-rose-300",
};

const BADGE_TEXT: Record<StageStatus, string> = {
  locked: "locked input",
  pending: "not generated",
  review: "needs review",
  approved: "approved",
  stale: "stale",
};

export function DesignView() {
  const stage = useDesignStore((s) => s.stage);
  const workflow = useDesignStore((s) => s.workflow);
  const index = useDesignStore((s) => s.index);
  const missing = useDesignStore((s) => s.missing);
  const raw = useDesignStore((s) => s.raw);
  const showRaw = useDesignStore((s) => s.showRaw);
  const toggleRaw = useDesignStore((s) => s.toggleRaw);
  const loading = useDesignStore((s) => s.loading);
  const [showWorkflow, setShowWorkflow] = useState(false);

  const meta = workflow?.stages.find((s) => s.id === stage);
  if (!meta) return <div className="flex-1 p-4 text-[12px] text-zinc-500">No workflow loaded.</div>;
  const status = stageStatus(index, missing, meta);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <StageRail onOpenWorkflow={() => setShowWorkflow(true)} />

        <div className="relative flex min-w-0 flex-1 flex-col">
          {showWorkflow && <WorkflowPanel onClose={() => setShowWorkflow(false)} />}
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
            <span className="text-[13px] text-zinc-200">{meta.label}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${BADGE[status]}`}>
              {BADGE_TEXT[status]}
            </span>
            <span className="flex-1" />
            {docKey(meta.doc) && raw[docKey(meta.doc)!] && (
              <button
                onClick={toggleRaw}
                className="rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-900"
              >
                {showRaw ? "Structured" : "Markdown"}
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="text-[12px] text-zinc-500">Reading design…</div>
            ) : showRaw && docKey(meta.doc) ? (
              <Prose src={raw[docKey(meta.doc)!] ?? ""} />
            ) : (
              <Pane pane={meta.pane} />
            )}
          </div>
        </div>

        <FeedbackPanel />
      </div>

      <Filmstrip />
    </div>
  );
}

/** Docs are keyed by workflow stage id → doc file; the raw map is keyed by the
 * writer's DocKey. Map a stage's doc filename back to that key. */
function docKey(doc?: string): string | undefined {
  if (!doc) return undefined;
  const name = doc.split("/").pop() ?? doc;
  const map: Record<string, string> = {
    "01-breakdown.md": "breakdown",
    "02-art-direction.md": "artDirection",
    "03-metaphors.md": "metaphors",
    "04-shooting-script.md": "shootingScript",
  };
  return map[name];
}

/** Panes are chosen by the stage's declared pane type, not by position. */
function Pane({ pane }: { pane: PaneType }) {
  switch (pane) {
    case "narration": return <NarrationPane />;
    case "timeline": return <BreakdownPane />;
    case "tokens": return <ArtDirectionPane />;
    case "candidates": return <MetaphorPane />;
    case "assets": return <AssetsPane />;
    case "shotlist": return <ShootingScriptPane />;
    case "composition": return <CompositionPane />;
    default: return <Prose src="" />;
  }
}

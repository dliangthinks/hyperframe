import { useEffect, useRef, useState } from "react";
import { useDesignStore } from "../stores/design-store";
import { useProjectStore } from "../stores/project-store";

interface LogLine {
  kind: "note" | "tool" | "text" | "status" | "error";
  text: string;
}

/**
 * Feedback addressed to one item. Submit dispatches immediately: it writes the
 * note, runs the batch, streams Claude Code's work into a live log, and reloads
 * the design when done so the content panel reflects the edit. The target id is
 * what keeps a re-run scoped to this item (README.md §6, §7).
 */
export function FeedbackPanel() {
  const selected = useDesignStore((s) => s.selected);
  const projectPath = useProjectStore((s) => s.projectPath);
  const loadDesign = useDesignStore((s) => s.loadDesign);

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [log]);

  // Stream dispatch progress from the main process into the log.
  useEffect(() => {
    if (!window.api?.onPipelineEvent) return;
    const add = (line: LogLine) => setLog((l) => [...l.slice(-200), line]);
    const offs = [
      window.api.onPipelineEvent("design:item:start", (d: any) =>
        add({ kind: "status", text: `Dispatching ${d.target} (stage ${d.stage})…` }),
      ),
      window.api.onPipelineEvent("design:item:progress", (d: any) => {
        if (d.type === "tool_use") add({ kind: "tool", text: d.content });
        else if (d.type === "text" && d.content.trim()) add({ kind: "text", text: d.content });
      }),
      window.api.onPipelineEvent("design:item:error", (d: any) =>
        add({ kind: "error", text: d.message }),
      ),
      window.api.onPipelineEvent("design:batch:done", (d: any) =>
        add({ kind: "status", text: `Done — ${d.applied.length} applied, stages ${JSON.stringify(d.stale)} now stale.` }),
      ),
    ];
    return () => offs.forEach((f) => f && f());
  }, []);

  async function submit() {
    if (!selected) return setError("Select an item first");
    if (!body.trim()) return setError("Enter feedback first");
    if (!projectPath) return setError("No project open");
    setError(null);
    setRunning(true);
    setLog([{ kind: "note", text: body.trim() }]);
    try {
      await window.api.sendFeedback(projectPath, selected, body.trim());
      setBody("");
      const res = (await window.api.applyBatch(projectPath)) as {
        applied: string[];
        issues: unknown[];
      };
      // Re-read the design so the content panel shows the edit.
      const design = await window.api.readDesign(projectPath);
      loadDesign(design as never);
      if (res.applied.length === 0) {
        setLog((l) => [...l, { kind: "error", text: "Nothing was applied." }]);
      }
    } catch (e) {
      setLog((l) => [...l, { kind: "error", text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 p-3">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-600">Feedback</div>

        <div className="mb-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5">
          {selected ? (
            <span className="break-all font-mono text-[11px] text-zinc-300">{selected}</span>
          ) : (
            <span className="text-[11px] text-zinc-500">Select an item</span>
          )}
        </div>

        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder="Too text-heavy — show the code recoloring instead.  ⌘↵ to submit"
          disabled={running}
          className="h-24 w-full resize-none rounded border border-zinc-800 bg-zinc-900 p-2 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:opacity-50"
        />

        {error && <div className="mt-1 text-[11px] text-rose-400">{error}</div>}

        <button
          onClick={submit}
          disabled={running}
          className="mt-2 w-full rounded border border-zinc-700 px-2 py-1.5 text-[12px] text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
        >
          {running ? "Working…" : "Submit"}
        </button>
      </div>

      {/* Live response log — the chat window. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {log.length === 0 ? (
          <div className="text-[10px] leading-relaxed text-zinc-600">
            Submit re-runs only the addressed item. The model's work streams here; the panel
            updates when it finishes.
          </div>
        ) : (
          <div className="space-y-1.5">
            {log.map((l, i) => (
              <LogRow key={i} line={l} />
            ))}
            {running && <div className="text-[11px] text-zinc-500">▍</div>}
            <div ref={logEnd} />
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ line }: { line: LogLine }) {
  if (line.kind === "note")
    return (
      <div className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-200">
        {line.text}
      </div>
    );
  if (line.kind === "tool")
    return <div className="font-mono text-[10px] text-zinc-500">↳ {line.text}</div>;
  if (line.kind === "status")
    return <div className="text-[11px] text-zinc-400">{line.text}</div>;
  if (line.kind === "error")
    return <div className="text-[11px] text-rose-400">{line.text}</div>;
  return <div className="text-[11px] leading-relaxed text-zinc-300">{line.text}</div>;
}

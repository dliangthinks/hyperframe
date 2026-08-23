import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Workflow } from "./workflow.js";

/**
 * Loads workflow definitions. Built-ins ship with the pipeline; a project may
 * override by placing its own `<id>.workflow.json` in design/workflows/. The
 * app reads the workflow to know its stages — the engine hardcodes none.
 */

const builtinsDir = join(dirname(fileURLToPath(import.meta.url)), "workflows");

export async function listBuiltinWorkflows(): Promise<Workflow[]> {
  let files: string[] = [];
  try {
    files = (await readdir(builtinsDir)).filter((f) => f.endsWith(".workflow.json"));
  } catch {
    return [];
  }
  const out: Workflow[] = [];
  for (const f of files) {
    out.push(JSON.parse(await readFile(join(builtinsDir, f), "utf8")) as Workflow);
  }
  return out;
}

export async function loadWorkflow(projectPath: string, id?: string): Promise<Workflow> {
  // A project's own workflow wins over the built-in of the same id.
  if (id) {
    const local = join(projectPath, "design", "workflows", `${id}.workflow.json`);
    try {
      return JSON.parse(await readFile(local, "utf8")) as Workflow;
    } catch {
      /* fall through to built-in */
    }
  }
  const builtins = await listBuiltinWorkflows();
  const chosen = id ? builtins.find((w) => w.id === id) : builtins[0];
  if (!chosen) throw new Error(`No workflow found${id ? ` for id "${id}"` : ""}.`);
  return chosen;
}

import { writeFile, mkdir } from "node:fs/promises";
import { validateWorkflow, type WorkflowIssue } from "./workflow.js";

/**
 * Saves a workflow into the project as `design/workflows/<id>.workflow.json`.
 * Project workflows override built-ins of the same id, so this is also how a
 * user forks a built-in to customize it. Refuses to write an invalid workflow —
 * the app should never run a graph that cannot resolve.
 */
export async function saveWorkflow(
  projectPath: string,
  wf: Workflow,
): Promise<{ ok: boolean; issues: WorkflowIssue[] }> {
  const issues = validateWorkflow(wf);
  if (issues.length) return { ok: false, issues };
  const dir = join(projectPath, "design", "workflows");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${wf.id}.workflow.json`), JSON.stringify(wf, null, 2), "utf8");
  return { ok: true, issues: [] };
}

/** Built-ins plus any the project defines, project winning on id collision. */
export async function listAllWorkflows(projectPath: string): Promise<Workflow[]> {
  const builtins = await listBuiltinWorkflows();
  const byId = new Map(builtins.map((w) => [w.id, w]));
  try {
    const dir = join(projectPath, "design", "workflows");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".workflow.json"));
    for (const f of files) {
      const wf = JSON.parse(await readFile(join(dir, f), "utf8")) as Workflow;
      byId.set(wf.id, wf);
    }
  } catch {
    /* no project workflows */
  }
  return [...byId.values()];
}

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectInfo, ProjectState } from "./types.js";

const PROJECT_FILE = "project.json";

function defaultState(name: string): ProjectState {
  const now = new Date().toISOString();
  return {
    version: 1,
    name,
    script: "",
    audioProviderId: "inworld",
    voiceId: "Oliver",
    scenes: [],
    renders: [],
    lastGenerated: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveProject(
  projectPath: string,
  state: Partial<ProjectState>,
): Promise<void> {
  const filePath = join(projectPath, PROJECT_FILE);
  let existing: ProjectState;

  try {
    const raw = await readFile(filePath, "utf-8");
    existing = JSON.parse(raw) as ProjectState;
  } catch {
    existing = defaultState(state.name ?? "untitled");
  }

  const merged: ProjectState = {
    ...existing,
    ...state,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(filePath, JSON.stringify(merged, null, 2));
}

export async function openProject(projectPath: string): Promise<ProjectState> {
  const filePath = join(projectPath, PROJECT_FILE);
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as ProjectState;
}

export async function listProjects(outputDir: string): Promise<ProjectInfo[]> {
  let entries: string[];
  try {
    entries = await readdir(outputDir);
  } catch {
    return [];
  }

  const projects: ProjectInfo[] = [];

  for (const entry of entries) {
    const entryPath = join(outputDir, entry);
    const s = await stat(entryPath).catch(() => null);
    if (!s?.isDirectory()) continue;

    const projectFile = join(entryPath, PROJECT_FILE);
    try {
      const raw = await readFile(projectFile, "utf-8");
      const state = JSON.parse(raw) as ProjectState;
      projects.push({
        name: state.name,
        path: entryPath,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      });
    } catch {
      // Not a managed project — skip
    }
  }

  return projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

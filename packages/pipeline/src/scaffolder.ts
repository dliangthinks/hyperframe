import { execFile } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface ScaffoldOpts {
  name: string;
  outputDir: string;
  onStatus: (message: string) => void;
}

/**
 * Scaffold a new Hyperframes project.
 *
 *   npx hyperframes init <name> --non-interactive --example blank --skip-skills
 *
 * This creates `<outputDir>/<name>/` containing:
 *   - index.html          (composition with a single root data-composition-id)
 *   - meta.json           (Hyperframes metadata: id, name, createdAt)
 *   - hyperframes.json    (project config for `hyperframes add`)
 *   - CLAUDE.md, AGENTS.md
 *
 * We then seed `public/audio/tts/` and an empty `tts-manifest.json` so the
 * TTS provider and scene generator have a known place to write/read timing.
 */
export async function scaffoldProject(opts: ScaffoldOpts): Promise<string> {
  const { name, outputDir, onStatus } = opts;
  const projectPath = join(outputDir, name);

  await mkdir(outputDir, { recursive: true });

  onStatus("Creating Hyperframes project...");
  await execFileAsync(
    "npx",
    [
      "--yes",
      "hyperframes",
      "init",
      name,
      "--non-interactive",
      "--example",
      "blank",
      "--skip-skills",
    ],
    { cwd: outputDir },
  );

  onStatus("Seeding TTS directory...");
  await mkdir(join(projectPath, "public", "audio", "tts"), { recursive: true });
  await writeFile(join(projectPath, "tts-manifest.json"), "[]\n");

  return projectPath;
}

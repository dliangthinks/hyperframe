#!/usr/bin/env node
import "dotenv/config";
import { extractPalette } from "./recolor.js";
import { candidateByRef, fetchAsset, resolveNeed } from "./resolve.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Asset-resolution CLI — the shooting-script skill calls this instead of ever
 * drawing an SVG itself (README §8d/§8f).
 *
 *   assets search  <query> --project <path> [--source id] [--limit n]
 *   assets fetch   <ref>   --project <path> --query <query> [--name base]
 *   assets palette <file>  --project <path>
 *
 * search walks the chain (storyset → freepik → undraw, or art direction's
 * order) and prints JSON candidates. fetch vendors one candidate into
 * assets/illustrations/ (recolored if art direction declares a map) and
 * records provenance in design/asset-manifest.json.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const [, , cmd, positional] = process.argv;

async function main(): Promise<void> {
  const project = arg("project") ?? process.cwd();

  if (cmd === "search") {
    const result = await resolveNeed(project, positional, {
      source: arg("source") as any,
      limit: arg("limit") ? Number(arg("limit")) : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "fetch") {
    const query = arg("query") ?? positional.split(":").slice(1).join(":");
    const candidate = await candidateByRef(project, positional, query);
    if (!candidate) {
      console.error(`Candidate ${positional} not found for query "${query}".`);
      process.exit(1);
    }
    const entry = await fetchAsset(project, candidate, query, arg("name"));
    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  if (cmd === "palette") {
    const svg = await readFile(join(project, positional), "utf8");
    console.log(JSON.stringify(extractPalette(svg).slice(0, 24), null, 2));
    return;
  }

  console.error("Usage: assets search <query> | fetch <ref> --query <q> | palette <file>  (--project <path>)");
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

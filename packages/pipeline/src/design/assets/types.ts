/**
 * Asset sources — where visuals beyond typography come from.
 *
 * The rule (README §8d): never generate SVG on the spot. Every illustration is
 * sourced from an existing high-quality library through one of these adapters,
 * downloaded into the project, and recorded with its provenance. The priority
 * chain and the consistency constraints live in art direction, not here.
 */

export type AssetSourceId = "storyset" | "freepik" | "undraw";

export interface AssetCandidate {
  /** Stable ref usable across CLI calls, e.g. "storyset:29846597". */
  ref: string;
  source: AssetSourceId;
  sourceId: string;
  title: string;
  /** Preview image (jpg/svg) for the review surface. */
  thumbUrl: string;
  /** Human-facing page at the source site. */
  pageUrl: string;
  /** True when a direct SVG download exists. Non-SVG candidates are dropped. */
  svg: boolean;
  author?: string;
}

export interface SearchOpts {
  limit?: number;
  /** Authors to prefer (ranked first) — the consistency lock. */
  preferAuthors?: string[];
}

export interface AssetSource {
  id: AssetSourceId;
  search(query: string, opts?: SearchOpts): Promise<AssetCandidate[]>;
  /** Returns the raw SVG text for a candidate. */
  download(candidate: AssetCandidate): Promise<string>;
}

/** The `illustration` block a project's art-direction.json may declare. */
export interface IllustrationConstraints {
  /** Source priority chain. Default: storyset, freepik, undraw. */
  sources?: AssetSourceId[];
  /** Storyset style family (rafiki|bro|amico|pana|cuate). Enforced at review —
   * the Freepik API does not index style, so this is a declared intent the
   * human checks against thumbnails, not a machine filter. */
  style?: string;
  /** Asset language — mixing filled and outline styles is what reads as
   * incoherent. Declared here; enforced at the review gate. */
  language?: "filled" | "outline";
  /** Freepik author lock — once a video commits to authors, stay with them. */
  authorLock?: string[];
  /** Hex→hex remap applied at ingest, source colors to project tokens. */
  recolor?: Record<string, string>;
}

/** One vendored asset, recorded in design/asset-manifest.json. */
export interface AssetManifestEntry {
  ref: string;
  source: AssetSourceId;
  sourceId: string;
  title: string;
  author?: string;
  query: string;
  /** Path relative to the project root, e.g. assets/illustrations/workbench.svg */
  file: string;
  pageUrl: string;
  downloadedAt: string;
  recolored: boolean;
}

import type { GeneratedSnapshot, Scene } from "./types.js";

export interface ChangeSet {
  /** Nothing changed — skip regeneration entirely. */
  noChanges: boolean;
  /** Indices of scenes whose sentence text changed (need new TTS). */
  changedScenes: number[];
  /** Indices of newly added scenes. */
  addedScenes: number[];
  /** Indices of removed scenes. */
  removedScenes: number[];
  /** True when any of the above is non-empty — drives full HTML regen in Hyperframes. */
  hasChanges: boolean;
}

/**
 * Compare current state against the last generated snapshot.
 *
 * Unlike the Remotion pipeline (which keeps per-scene .tsx files and can
 * surgically regen a single file), a Hyperframes project is a single
 * `index.html`. Any change triggers a whole-file regeneration. This detector
 * therefore only classifies *what* changed so the caller can decide whether
 * TTS needs to rerun.
 */
export function detectChanges(
  current: { script: string; scenes: Scene[] },
  lastGenerated: GeneratedSnapshot | null,
): ChangeSet {
  if (!lastGenerated) {
    return {
      noChanges: false,
      changedScenes: current.scenes.map((s) => s.index),
      addedScenes: current.scenes.map((s) => s.index),
      removedScenes: [],
      hasChanges: true,
    };
  }

  const prev = lastGenerated.scenes;
  const curr = current.scenes;

  const changedScenes: number[] = [];
  const addedScenes: number[] = [];
  const removedScenes: number[] = [];

  const minLen = Math.min(prev.length, curr.length);
  for (let i = 0; i < minLen; i++) {
    if (prev[i]?.sentence !== curr[i]?.sentence) {
      changedScenes.push(i);
    }
  }
  for (let i = minLen; i < curr.length; i++) addedScenes.push(i);
  for (let i = minLen; i < prev.length; i++) removedScenes.push(i);

  const hasChanges =
    changedScenes.length > 0 || addedScenes.length > 0 || removedScenes.length > 0;

  return {
    noChanges: !hasChanges,
    changedScenes,
    addedScenes,
    removedScenes,
    hasChanges,
  };
}

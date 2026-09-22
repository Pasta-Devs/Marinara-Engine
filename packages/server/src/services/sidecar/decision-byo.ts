/**
 * Judging a pasted decision model repository.
 *
 * The user ruled that a second decision model should be usable the day it exists
 * rather than when we curate it, so this exists to answer one question honestly: can
 * this engine run what that repository declares itself to be?
 *
 * Nothing here trusts a name. It reads the checkpoint's own `release-manifest.json`,
 * matches the artifact type against a runtime this engine ships, follows the base
 * model the manifest pins, and adds up what the whole thing will cost before anything
 * is downloaded. A repository it cannot vouch for is refused with the reason.
 */
import {
  DECISION_RUNTIME_DEFAULTS,
  isSafeGitRef,
  isSafeRepoId,
  readDecisionManifest,
  type DecisionManifestRefusal,
  type SidecarDecisionModelInfo,
} from "@marinara-engine/shared";

export type ByoRefusal = DecisionManifestRefusal | "invalid_repo" | "not_found" | "unresolvable_revision";

async function hubJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Resolve a ref to an exact commit, so what is inspected is what gets installed. */
async function resolveRevision(repoId: string, ref: string): Promise<string | null> {
  if (/^[0-9a-f]{40}$/u.test(ref)) return ref;
  const info = await hubJson<{ sha?: unknown }>(`https://huggingface.co/api/models/${repoId}/revision/${ref}`);
  return typeof info?.sha === "string" && /^[0-9a-f]{40}$/u.test(info.sha) ? info.sha : null;
}

async function repoBytes(repoId: string, revision: string, prefix?: string): Promise<number> {
  const entries =
    (await hubJson<Array<{ type: string; path: string; size?: number; lfs?: { size?: number } }>>(
      `https://huggingface.co/api/models/${repoId}/tree/${revision}?recursive=1`,
    )) ?? [];
  return entries
    .filter((entry) => entry.type === "file" && (!prefix || entry.path.startsWith(prefix)))
    .reduce((sum, entry) => sum + (entry.lfs?.size ?? entry.size ?? 0), 0);
}

/**
 * Inspect a repository and, if it is usable, describe the model it would install.
 *
 * The returned entry inherits every hardware floor from the runtime rather than from
 * the repository: a manifest is not allowed to claim a lower driver requirement or a
 * wider GPU range than the wheels actually contain kernels for.
 */
export async function inspectDecisionRepo(
  repoId: string,
  ref = "main",
): Promise<{ model: SidecarDecisionModelInfo } | { refusal: ByoRefusal }> {
  // Both of these are interpolated into hub URLs, so neither is trusted by shape
  // alone: a dot-only segment collapses the path onto a different endpoint.
  if (!isSafeRepoId(repoId) || !isSafeGitRef(ref)) return { refusal: "invalid_repo" };
  const revision = await resolveRevision(repoId, ref);
  if (!revision) return { refusal: "unresolvable_revision" };

  const manifest = await hubJson<Record<string, unknown>>(
    `https://huggingface.co/${repoId}/resolve/${revision}/release-manifest.json`,
  );
  if (!manifest) return { refusal: "not_found" };
  const read = readDecisionManifest(manifest);
  if ("refusal" in read) return { refusal: read.refusal };

  const baseRevision = read.baseRevision;
  const [checkpointBytes, baseBytes] = await Promise.all([
    repoBytes(repoId, revision, "package/"),
    repoBytes(read.baseModel, baseRevision),
  ]);
  // A manifest with no checkpoint beside it describes an install that cannot happen,
  // and a zero total would sail through the preflight as costing nothing.
  if (checkpointBytes === 0) return { refusal: "unreadable_manifest" };
  if (baseBytes === 0) return { refusal: "missing_base_model" };

  const defaults = DECISION_RUNTIME_DEFAULTS[read.runtime];
  const downloadSizeBytes = checkpointBytes + baseBytes;
  return {
    model: {
      id: `byo:${repoId}@${revision.slice(0, 12)}`,
      label: repoId,
      description: `Pasted repository. Declares ${String(manifest.artifact_type)}, loads ${read.baseModel}.`,
      runtime: read.runtime,
      artifacts: [
        { repoId, revision, paths: ["package/"] },
        { repoId: read.baseModel, revision: baseRevision },
      ],
      downloadSizeBytes,
      // The runtime environment is the same several gigabytes whatever the model is,
      // so the disk figure is the weights plus that, not the weights alone.
      diskBytes: downloadSizeBytes + 5_400_000_000,
      // Weights in bf16 plus working memory. An estimate, and the launch-time recheck
      // is the backstop, but it is derived from this model's real size rather than
      // copied from the curated entry.
      vramBytes: Math.round(baseBytes * 1.05),
      licenses: ["Declared by the repository; review them there before installing"],
      thirdParty: true,
      ...defaults,
    },
  };
}

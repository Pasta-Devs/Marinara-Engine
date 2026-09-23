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
  decisionRuntimeDefaults,
  isSafeGitRef,
  isSafeRepoId,
  readDecisionManifest,
  type DecisionManifestRefusal,
  type SidecarDecisionModelInfo,
} from "@marinara-engine/shared";
import { hubRevisionUrl, isLoadableArtifactFile, listHubFiles } from "./decision-hub.js";

export type ByoRefusal =
  | DecisionManifestRefusal
  | "invalid_repo"
  | "not_found"
  | "unresolvable_revision"
  | "unsupported_files"
  | "listing_failed";

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
  const info = await hubJson<{ sha?: unknown }>(hubRevisionUrl(repoId, ref));
  return typeof info?.sha === "string" && /^[0-9a-f]{40}$/u.test(info.sha) ? info.sha : null;
}

/**
 * The licence a repository declares on the Hub, named with the repository.
 *
 * Read from the model card's metadata at the pinned revision, which is the one that
 * gets downloaded: the default branch's card can say something else. A repository
 * that declares nothing says so, rather than the dialog saying nothing.
 */
async function declaredLicense(repoId: string, revision: string): Promise<string> {
  const info = await hubJson<{ cardData?: { license?: unknown }; tags?: unknown }>(hubRevisionUrl(repoId, revision));
  const fromCard = info?.cardData?.license;
  const fromTags = Array.isArray(info?.tags)
    ? info.tags
        .filter((tag): tag is string => typeof tag === "string" && tag.startsWith("license:"))
        .map((tag) => tag.slice(8))
    : [];
  const names = (Array.isArray(fromCard) ? fromCard : [fromCard, ...fromTags])
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .map((name) => name.trim().slice(0, 60));
  const unique = [...new Set(names)];
  return `${unique.length > 0 ? unique.join(" / ") : "not declared"} (${repoId})`;
}

/**
 * What installing this part of a repository would download.
 *
 * The same listing and the same file rule the downloader uses, so the size shown here
 * is the size fetched, and a repository carrying a file the runtime would not load as
 * plain data is refused now rather than after the user agreed to it.
 */
async function repoBytes(
  repoId: string,
  revision: string,
  prefix?: string,
): Promise<{ bytes: number; unsupported: boolean; failed?: true }> {
  let files;
  try {
    files = (await listHubFiles(repoId, revision)).filter((file) => !prefix || file.path.startsWith(prefix));
  } catch {
    // Kept apart from an empty listing. A timeout or rate limit would otherwise read
    // as "bad manifest" or "no base model", a verdict about a repository that is
    // fine, and the user could not tell a network fault from a real refusal.
    return { bytes: 0, unsupported: false, failed: true };
  }
  return {
    bytes: files.reduce((sum, file) => sum + file.size, 0),
    unsupported: files.some((file) => !isLoadableArtifactFile(file.path)),
  };
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
  const [checkpoint, base, checkpointLicense, baseLicense] = await Promise.all([
    repoBytes(repoId, revision, "package/"),
    repoBytes(read.baseModel, baseRevision),
    declaredLicense(repoId, revision),
    declaredLicense(read.baseModel, baseRevision),
  ]);
  if (checkpoint.failed || base.failed) return { refusal: "listing_failed" };
  if (checkpoint.unsupported || base.unsupported) return { refusal: "unsupported_files" };
  const checkpointBytes = checkpoint.bytes;
  const baseBytes = base.bytes;
  // A manifest with no checkpoint beside it describes an install that cannot happen,
  // and a zero total would sail through the preflight as costing nothing.
  if (checkpointBytes === 0) return { refusal: "unreadable_manifest" };
  if (baseBytes === 0) return { refusal: "missing_base_model" };

  const defaults = decisionRuntimeDefaults(read.runtime)!;
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
      // What each repository declares, which is not a review of it. The dialog still
      // points the user at the repository pages before they agree.
      licenses: [checkpointLicense, baseLicense],
      thirdParty: true,
      ...defaults,
    },
  };
}

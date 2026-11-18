/**
 * Judging a pasted decision model repository.
 *
 * The user ruled that a second decision model should be usable the day it exists
 * rather than when we curate it, so this exists to answer one question honestly: can
 * this engine run what that repository declares itself to be?
 *
 * Nothing here trusts a name. Three kinds of repository are recognised, each by what
 * it declares about itself:
 *
 * - An Open-Jev checkpoint: its own `release-manifest.json`, matched against a runtime
 *   this engine ships, with the base model the manifest pins.
 * - A GGUF whose header declares a native decision type (`<arch>.decision.type`) that
 *   the pinned llama.cpp build serves on `/v1/systemone`. Read from the first
 *   megabytes of the file, before anything is downloaded.
 * - A Valen GGUF package: a `MANIFEST.json` naming the exact runtime package Marinara
 *   pins, by name and digest, and a GGUF whose architecture is `valen`.
 *
 * Everything else is refused with the reason, and what would be downloaded is added up
 * before the user agrees to any of it.
 */
import {
  decisionRuntimeDefaults,
  isSafeGitRef,
  isSafeRepoId,
  readDecisionManifest,
  type DecisionManifestRefusal,
  type SidecarDecisionModelInfo,
} from "@marinara-engine/shared";
import { hubRevisionUrl, isLoadableArtifactFile, listHubFiles, type HubFile } from "./decision-hub.js";
import {
  LLAMA_SYSTEMONE_DECISION_TYPES,
  pickGgufFile,
  pickProjectorFile,
  readRemoteGgufHeader,
} from "./decision-gguf.js";
import { DECISION_SERVER_RUNTIMES } from "./decision-server-runtimes.js";

export type ByoRefusal =
  | DecisionManifestRefusal
  | "invalid_repo"
  | "not_found"
  | "unresolvable_revision"
  | "unsupported_files"
  | "listing_failed"
  // A GGUF repository, but no file says it is a decision model this engine can serve.
  | "not_decision_gguf"
  // A GGUF repository with several quantizations and none of the usual ones, or not
  // the one asked for after the colon.
  | "no_gguf_quant"
  // A Valen package built for a runtime other than the one Marinara pins.
  | "valen_runtime_mismatch";

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
  pasted: string,
  ref = "main",
): Promise<{ model: SidecarDecisionModelInfo } | { refusal: ByoRefusal }> {
  // `owner/name:Q8_0` picks one quantization from a GGUF repository, the way llama.cpp
  // and Ollama name them.
  const colon = pasted.indexOf(":");
  const repoId = colon === -1 ? pasted : pasted.slice(0, colon);
  const quant = colon === -1 ? undefined : pasted.slice(colon + 1);
  if (quant !== undefined && !/^[A-Za-z0-9_]{1,24}$/u.test(quant)) return { refusal: "invalid_repo" };
  // Both of these are interpolated into hub URLs, so neither is trusted by shape
  // alone: a dot-only segment collapses the path onto a different endpoint.
  if (!isSafeRepoId(repoId) || !isSafeGitRef(ref)) return { refusal: "invalid_repo" };
  const revision = await resolveRevision(repoId, ref);
  if (!revision) return { refusal: "unresolvable_revision" };

  let files: HubFile[];
  try {
    files = await listHubFiles(repoId, revision);
  } catch {
    return { refusal: "listing_failed" };
  }
  if (files.some((file) => file.path.toLowerCase().endsWith(".gguf")))
    return inspectGgufRepo(repoId, revision, files, quant);
  if (quant !== undefined) return { refusal: "no_gguf_quant" };

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

/** The download URL of one file at a pinned revision, each path segment encoded. */
function resolveUrl(repoId: string, revision: string, path: string): string {
  return `https://huggingface.co/${repoId}/resolve/${revision}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Licence files beside the weights, fetched with them so the install keeps them. */
function licenceFiles(files: HubFile[]): HubFile[] {
  return files.filter((file) => /^(?:LICENSE|NOTICE)[\w.-]*$/u.test(file.path) && file.size < 1_000_000);
}

/**
 * A GGUF repository: a native decision model for the pinned llama.cpp, or a Valen package.
 *
 * Only the one chosen GGUF and the licence files are downloaded. A repository's other
 * quantizations and its projector are left on the Hub.
 */
async function inspectGgufRepo(
  repoId: string,
  revision: string,
  files: HubFile[],
  quant: string | undefined,
): Promise<{ model: SidecarDecisionModelInfo } | { refusal: ByoRefusal }> {
  const chosen = pickGgufFile(files, quant);
  if (!chosen) return { refusal: "no_gguf_quant" };
  const header = await readRemoteGgufHeader(resolveUrl(repoId, revision, chosen.path));
  if (!header) return { refusal: "listing_failed" };

  let runtime: "llama_systemone" | "valen_gguf";
  let declares: string;
  if (header.architecture === "valen") {
    // Valen's GGUFs only load in Valen's runtime, and its manifest names the exact
    // package. One built for another runtime release is refused rather than guessed at.
    const manifest = await hubJson<{ runtime?: { package?: unknown; package_sha256?: unknown; version?: unknown } }>(
      resolveUrl(repoId, revision, "MANIFEST.json"),
    );
    const pinned = DECISION_SERVER_RUNTIMES.valen_gguf.assets[0]!;
    if (manifest?.runtime?.package !== pinned.name || manifest.runtime.package_sha256 !== pinned.sha256)
      return { refusal: "valen_runtime_mismatch" };
    runtime = "valen_gguf";
    declares = `a Valen decision model for runtime ${String(manifest.runtime.version)}`;
  } else if (header.decisionType && LLAMA_SYSTEMONE_DECISION_TYPES.has(header.decisionType)) {
    runtime = "llama_systemone";
    declares = `decision type ${header.decisionType} (${header.architecture ?? "unknown architecture"})`;
  } else {
    return { refusal: "not_decision_gguf" };
  }

  const extras = licenceFiles(files);
  // Its vision projector too, when it publishes one, so it reads the chat's pictures.
  const projector = pickProjectorFile(files);
  if (projector) extras.push(projector);
  const paths = [chosen.path, ...extras.map((file) => file.path)];
  if (paths.some((path) => !isLoadableArtifactFile(path))) return { refusal: "unsupported_files" };
  const downloadSizeBytes = chosen.size + extras.reduce((sum, file) => sum + file.size, 0);
  const defaults = decisionRuntimeDefaults(runtime)!;
  const license = await declaredLicense(repoId, revision);
  const name = chosen.path.slice(chosen.path.lastIndexOf("/") + 1);
  return {
    model: {
      id: `byo:${repoId}@${revision.slice(0, 12)}:${name}`,
      label: `${repoId} (${name.replace(/\.gguf$/iu, "")})`,
      description: projector
        ? `Pasted repository. Declares ${declares}. Installs ${name} and its vision projector.`
        : `Pasted repository. Declares ${declares}. Installs ${name} only.`,
      runtime,
      artifacts: [{ repoId, revision, paths }],
      modelFile: chosen.path,
      downloadSizeBytes,
      // The weights plus the runtime's own server build, which is under 200 MB unpacked.
      diskBytes: downloadSizeBytes + 200_000_000,
      // The weights plus a context's working memory. An estimate; the launch-time
      // recheck is the backstop.
      vramBytes: Math.round(chosen.size * 1.1 + (projector?.size ?? 0) + 600_000_000),
      licenses: [license],
      languages: "Not checked by Marinara",
      thirdParty: true,
      ...defaults,
      ...(projector
        ? { projectorFile: projector.path, inputs: [...new Set([...(defaults.inputs ?? ["text"]), "image" as const])] }
        : {}),
    },
  };
}

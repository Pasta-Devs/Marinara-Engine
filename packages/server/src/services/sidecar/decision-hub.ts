/**
 * Reading a Hugging Face repository for the decision installer.
 *
 * Shared by the pasted-repository inspector and the downloader, so the file set that
 * is sized and shown to the user is exactly the file set that is later fetched.
 */

const HUB_ORIGIN = "https://huggingface.co";

/**
 * A ceiling on tree pages.
 *
 * Both curated repositories fit on one page. The ceiling exists so a pasted repository
 * with an endless or looping `next` link cannot keep an inspection running forever.
 */
const MAX_TREE_PAGES = 50;

export interface HubFile {
  path: string;
  /** The LFS object's size where there is one, which is the bytes actually downloaded. */
  size: number;
}

/**
 * The URL that resolves a ref to a commit.
 *
 * The ref is encoded because it may contain slashes (`refs/pr/1`, `feature/x`) that
 * the Hub would otherwise read as extra path segments. The repo id keeps its literal
 * slash: the Hub expects `owner/name` unencoded.
 */
export function hubRevisionUrl(repoId: string, ref: string): string {
  return `${HUB_ORIGIN}/api/models/${repoId}/revision/${encodeURIComponent(ref)}`;
}

/** The `rel="next"` target of a Link header, only if it stays on the Hub. */
function nextPageUrl(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const match = /<([^>]+)>\s*;\s*rel="?next"?/u.exec(part);
    if (!match) continue;
    try {
      const url = new URL(match[1]!, HUB_ORIGIN);
      // A pasted repository controls nothing in this header, but the check is cheap
      // and keeps the installer from ever being pointed at another host.
      return url.origin === HUB_ORIGIN ? url.toString() : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Every file in a pinned revision, following the tree's pagination.
 *
 * Reading only the first page would size, verify and download part of a large
 * repository, then write a receipt calling that part complete.
 */
export async function listHubFiles(repoId: string, revision: string, signal?: AbortSignal): Promise<HubFile[]> {
  const files: HubFile[] = [];
  let url: string | null = `${HUB_ORIGIN}/api/models/${repoId}/tree/${revision}?recursive=1`;
  for (let page = 0; url; page += 1) {
    if (page >= MAX_TREE_PAGES) throw new Error(`${repoId} lists more files than the installer accepts`);
    const response: Response = await fetch(url, { signal: signal ?? AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Could not list ${repoId} at ${revision}`);
    const entries = (await response.json()) as Array<{
      type: string;
      path: string;
      size?: number;
      lfs?: { size?: number };
    }>;
    for (const entry of entries)
      if (entry.type === "file") files.push({ path: entry.path, size: entry.lfs?.size ?? entry.size ?? 0 });
    url = nextPageUrl(response.headers.get("link"));
  }
  return files;
}

/** Formats the runtime's loaders read as data, never as code. */
const LOADABLE_EXTENSIONS = new Set([".safetensors", ".json", ".txt", ".jinja", ".md", ".model", ".tiktoken"]);
const LOADABLE_NAMES = /^(?:LICENSE[\w.-]*|NOTICE[\w.-]*|\.gitattributes)$/u;

/**
 * Would the runtime load this file as data?
 *
 * An allowlist, because the file set of a pasted repository is chosen by whoever
 * published it, and the loader hands every file it finds to `from_pretrained`. Weights
 * in pickle formats (`.bin`, `.pt`, `.pkl`) and any Python are refused rather than
 * downloaded. The one exception is the scalar decision head, `package/checkpoint/head.pt`,
 * which the pinned loader reads with `torch.load(..., weights_only=True)`: the mode
 * that refuses arbitrary objects.
 */
export function isLoadableArtifactFile(path: string): boolean {
  if (path === "package/checkpoint/head.pt") return true;
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (LOADABLE_NAMES.test(name)) return true;
  const dot = name.lastIndexOf(".");
  return dot > 0 && LOADABLE_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

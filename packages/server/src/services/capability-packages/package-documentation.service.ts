import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  capabilityDocumentationSchema,
  MAX_PACKAGE_DOCUMENTATION_BYTES,
  type PackageDocumentationIndex,
  type PackageDocumentationRead,
  type PackageDocumentationReference,
} from "@marinara-engine/shared";
import { writeFileAtomic } from "../../utils/atomic-write.js";
import { safeFetch } from "../../utils/security.js";
import {
  listMarkdownHeadings,
  readCanonicalDocumentationFile,
  readMarkdownHeading,
} from "../professor-mari/documentation-tools.js";

const FRESH_MS = 5 * 60_000;
const OFFLINE_MS = 7 * 24 * 60 * 60_000;
const CACHE_FILES = 128;
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_CACHE_BYTES = 2 * MAX_PACKAGE_DOCUMENTATION_BYTES;
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

export interface PackageDocumentationContext {
  catalogUrl: string;
  packageId: string;
  version?: string;
  documentationUrl?: string;
}
interface DocumentationDependencies {
  workspaceRoot: string;
  cacheRoot: string;
  fetch?: typeof safeFetch;
  now?: () => number;
}
const cachedReadSchema = z
  .object({
    packageId: z.string().min(1).max(80),
    packageVersion: z.string().min(1).max(80),
    guideId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/u),
    title: z.string().max(200),
    topics: z.array(z.object({ id: z.string().max(64), title: z.string().max(200) }).strict()).max(33),
    status: z.literal("available"),
    content: z.string().max(MAX_PACKAGE_DOCUMENTATION_BYTES),
    sourceUrl: z.string().url().max(2000),
    enginePath: z.string().max(250).optional(),
    retrievedAt: z.string().datetime(),
  })
  .strict();
const cacheSchema = z
  .object({
    key: z.string(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    value: cachedReadSchema,
  })
  .strict();

/** URL references are never local paths. Keep downloaded text in the selected
 * catalog's repository, and in this package's user documentation directory. */
export function resolvePackageDocumentationUrl(sidecarUrl: string, packageId: string, path: string): string {
  const base = new URL(sidecarUrl);
  const target = new URL(path, base);
  const marker = base.pathname.lastIndexOf("/catalog/");
  const root = marker >= 0 ? base.pathname.slice(0, marker + 1) : new URL("../", base).pathname;
  const packageRoot = `${root}packages/${packageId}/`;
  const decoded = decodeURIComponent(target.pathname);
  const relative = decoded.slice(packageRoot.length);
  if (
    base.protocol !== "https:" ||
    target.origin !== base.origin ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    !decoded.startsWith(packageRoot) ||
    (relative !== "README.md" && (!relative.startsWith("docs/") || /^docs\/development(?:\/|$)/iu.test(relative))) ||
    !relative.endsWith(".md") ||
    relative.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Documentation path is outside the package user guides");
  }
  return target.href;
}

function officialChannel(catalogUrl: string): "main" | "staging" | null {
  const match = /^https:\/\/raw\.githubusercontent\.com\/Pasta-Devs\/Marinara-Agents\/(main|staging)\/catalog\//u.exec(
    catalogUrl,
  );
  return (match?.[1] as "main" | "staging" | undefined) ?? null;
}

/** One bounded read path for Organizer and Mari. Disk contains validated reads,
 * not executable package files; source/channel/version changes cannot reuse them. */
export function createPackageDocumentationReader(deps: DocumentationDependencies) {
  const fetchDocument = deps.fetch ?? safeFetch;
  const now = deps.now ?? Date.now;
  const indexes = new Map<string, { at: number; value: z.infer<typeof capabilityDocumentationSchema> }>();
  const pending = new Map<string, Promise<PackageDocumentationRead>>();

  async function readCache(key: string, context: PackageDocumentationContext, guideId: string) {
    try {
      const path = join(deps.cacheRoot, `${digest(key)}.json`);
      if ((await lstat(path)).size > MAX_CACHE_BYTES) return null;
      const cached = cacheSchema.parse(JSON.parse(await readFile(path, "utf8")));
      const age = now() - Date.parse(cached.value.retrievedAt);
      if (
        cached.key !== key ||
        cached.sha256 !== digest(cached.value.content) ||
        age < 0 ||
        age > OFFLINE_MS ||
        cached.value.packageId !== context.packageId ||
        cached.value.guideId !== guideId ||
        (context.version && cached.value.packageVersion !== context.version)
      )
        return null;
      return cached.value;
    } catch {
      return null;
    }
  }

  async function saveCache(key: string, value: PackageDocumentationRead) {
    try {
      const validated = cachedReadSchema.parse(value);
      await mkdir(deps.cacheRoot, { recursive: true });
      await writeFileAtomic(
        join(deps.cacheRoot, `${digest(key)}.json`),
        JSON.stringify({ key, sha256: digest(validated.content), value: validated }),
        { mode: 0o600 },
      );
      const files = (await readdir(deps.cacheRoot)).filter((name) => /^[a-f0-9]{64}\.json$/u.test(name));
      if (files.length > CACHE_FILES) {
        const ages = await Promise.all(
          files.map(async (name) => ({ name, time: (await lstat(join(deps.cacheRoot, name))).mtimeMs })),
        );
        ages.sort((a, b) => b.time - a.time);
        await Promise.all(ages.slice(CACHE_FILES).map(({ name }) => rm(join(deps.cacheRoot, name), { force: true })));
      }
    } catch {
      /* Optional help remains readable when the cache cannot be written. */
    }
  }

  async function fetchBytes(url: string, maximum: number, signal: AbortSignal) {
    const response = await fetchDocument(url, {
      signal,
      policy: { allowedProtocols: ["https:"], allowedOrigins: [new URL(url).origin], maxRedirects: 0 },
      maxResponseBytes: maximum,
      allowedContentTypes: ["text/plain", "text/markdown", "application/json"],
      allowMissingContentType: true,
      decodeCompressedResponse: true,
    });
    if (!response.ok) throw new Error("Documentation source is unavailable");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > maximum) throw new Error("Documentation exceeds its size limit");
    return bytes;
  }

  async function read(context: PackageDocumentationContext, guideId: string): Promise<PackageDocumentationRead> {
    const key = JSON.stringify([context.catalogUrl, context.packageId, guideId]);
    const cached = await readCache(key, context, guideId);
    if (cached && context.version && now() - Date.parse(cached.retrievedAt) < FRESH_MS) return cached;
    const unavailable: PackageDocumentationRead = {
      packageId: context.packageId,
      packageVersion: context.version,
      guideId,
      title: "Overview",
      topics: [],
      status: "unavailable",
      sourceUrl: context.documentationUrl,
    };
    if (!context.version) return cached ? { ...cached, status: "cached" } : unavailable;
    const signal = AbortSignal.timeout(5_000);
    try {
      const channel = officialChannel(context.catalogUrl);
      const sidecarUrl = context.catalogUrl.endsWith("/catalog.json")
        ? context.catalogUrl.replace(/catalog\.json$/u, "docs.json")
        : null;
      let index: PackageDocumentationIndex | undefined;
      if (sidecarUrl) {
        try {
          let document = indexes.get(sidecarUrl);
          if (!document || now() - document.at >= FRESH_MS) {
            const value = capabilityDocumentationSchema.parse(
              JSON.parse((await fetchBytes(sidecarUrl, MAX_INDEX_BYTES, signal)).toString("utf8")),
            );
            document = { at: now(), value };
            if (indexes.size >= 8) indexes.delete(indexes.keys().next().value!);
            indexes.set(sidecarUrl, document);
          }
          index = document.value.packages[context.packageId];
          if (index?.version !== context.version) index = undefined;
        } catch {
          /* Legacy packages and catalogs need not publish a sidecar. */
        }
      }
      const topics = index
        ? [{ id: "overview", title: "Overview" }, ...index.guides.map(({ id, title }) => ({ id, title }))]
        : [];
      const selected =
        index && (guideId === "overview" ? index.overview : index.guides.find((guide) => guide.id === guideId));
      let reference: PackageDocumentationReference | undefined = selected || undefined;
      let sourceUrl: string | undefined;
      let content: string;
      let legacyFragment: string | undefined;
      if (!reference) {
        if (index || guideId !== "overview" || !channel || !context.documentationUrl)
          throw new Error("Guide not registered");
        const legacy = new URL(context.documentationUrl);
        // Only known official file links are adapted. Custom/external links remain external.
        const engine = /^\/Pasta-Devs\/Marinara-Engine\/blob\/(?:main|staging)\/docs\/(.+\.md)$/u.exec(legacy.pathname);
        const agent = /^\/Pasta-Devs\/Marinara-Agents\/blob\/(?:main|staging)\/(packages\/[^/]+\/README\.md)$/u.exec(
          legacy.pathname,
        );
        if (legacy.origin !== "https://github.com" || legacy.search) throw new Error("External documentation");
        if (engine) {
          reference = { source: "engine", path: decodeURIComponent(engine[1]!) };
          legacyFragment = legacy.hash ? decodeURIComponent(legacy.hash.slice(1)) : undefined;
        } else if (agent && agent[1] === `packages/${context.packageId}/README.md` && !legacy.hash) {
          sourceUrl = `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/${channel}/${agent[1]}`;
        } else throw new Error("No package guide at this legacy link");
        topics.push({ id: "overview", title: "Overview" });
      }
      let enginePath: string | undefined;
      if (reference?.source === "engine") {
        enginePath = `docs/${reference.path}`;
        content = (await readCanonicalDocumentationFile(deps.workspaceRoot, enginePath)).content;
        if (/^development(?:\/|$)/iu.test(reference.path)) throw new Error("Not a user guide");
        sourceUrl = `https://github.com/Pasta-Devs/Marinara-Engine/blob/${channel ?? "main"}/${enginePath}`;
      } else {
        if (reference?.source === "catalog")
          sourceUrl = resolvePackageDocumentationUrl(sidecarUrl!, context.packageId, reference.path);
        if (!sourceUrl) throw new Error("No documentation source");
        const bytes = await fetchBytes(sourceUrl, MAX_PACKAGE_DOCUMENTATION_BYTES, signal);
        if (
          reference?.source === "catalog" &&
          (bytes.length !== reference.bytes || digest(bytes) !== reference.sha256)
        ) {
          throw new Error("Documentation checksum differs from the published index");
        }
        content = bytes.toString("utf8");
      }
      if (Buffer.byteLength(content) > MAX_PACKAGE_DOCUMENTATION_BYTES) throw new Error("Guide too large");
      const heading =
        reference?.heading ??
        (legacyFragment
          ? listMarkdownHeadings(content).find(
              (text) =>
                text
                  .toLowerCase()
                  .replace(/[^\p{L}\p{N}_\-\s]/gu, "")
                  .replace(/\s/gu, "-") === legacyFragment,
            )
          : undefined);
      if (legacyFragment && !heading) throw new Error("Legacy heading not found");
      if (heading) {
        const section = readMarkdownHeading(enginePath ?? sourceUrl!, content, heading);
        if (!section) throw new Error("Heading not found");
        content = `## ${section.heading}\n\n${section.content}`;
      }
      const value: PackageDocumentationRead = {
        packageId: context.packageId,
        packageVersion: context.version,
        guideId,
        title: guideId === "overview" ? "Overview" : topics.find((topic) => topic.id === guideId)!.title,
        topics,
        status: "available",
        content,
        sourceUrl,
        enginePath,
        retrievedAt: new Date(now()).toISOString(),
      };
      await saveCache(key, value);
      return value;
    } catch {
      return cached ? { ...cached, status: "cached" } : unavailable;
    }
  }
  return (context: PackageDocumentationContext, guideId = "overview") => {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/u.test(context.packageId) || !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(guideId)) {
      return Promise.reject(new Error("Invalid package or guide id"));
    }
    const key = JSON.stringify([context, guideId]);
    const existing = pending.get(key);
    if (existing) return existing;
    const result = read(context, guideId).finally(() => pending.delete(key));
    pending.set(key, result);
    return result;
  };
}

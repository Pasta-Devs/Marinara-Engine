import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capabilityDocumentationSchema } from "../../../packages/shared/src/schemas/package-documentation.schema.js";
import {
  createPackageDocumentationReader,
  resolvePackageDocumentationUrl,
} from "../../../packages/server/src/services/capability-packages/package-documentation.service.js";
import type { safeFetch } from "../../../packages/server/src/utils/security.js";

const root = await mkdtemp(join(tmpdir(), "marinara-package-docs-"));
try {
  await mkdir(join(root, "docs", "agents"), { recursive: true });
  await writeFile(
    join(root, "docs", "agents", "avatars.md"),
    "# Avatars\n\n## Setup\nChoose your avatar.\n\n## Other\nOther text.",
  );
  await writeFile(
    join(root, "docs", "agents", "summary.md"),
    "# Agents\n\n## Example\nSummary.\n- **Full guide**: [Avatar setup](avatars.md).\n\n## Other\nOther agent.",
  );
  const catalogUrl = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/staging/catalog/v2/catalog.json";
  const sidecarUrl = catalogUrl.replace("catalog.json", "docs.json");
  const markdown = "# Example\n\n## First steps\nOpen Example.\n\n```md\n## Not a heading\n```\n";
  const reference = {
    source: "catalog",
    path: "../../packages/example/docs/creator's guide.md",
    bytes: Buffer.byteLength(markdown),
    sha256: createHash("sha256").update(markdown).digest("hex"),
  };
  const docUrl = resolvePackageDocumentationUrl(sidecarUrl, "example", reference.path);
  assert.match(docUrl, /creator's%20guide\.md$/u);
  for (const path of [
    "https://evil.example/docs/a.md",
    "../../../other/packages/example/README.md",
    "../../packages/other/README.md",
    "../../packages/example/docs/development/a.md",
    "../../packages/example/docs/../server.mjs",
  ]) {
    assert.throws(() => resolvePackageDocumentationUrl(sidecarUrl, "example", path), /outside/u);
  }
  const index = {
    schemaVersion: 1,
    packages: {
      example: {
        version: "1.0.0",
        overview: reference,
        guides: [
          { id: "setup", title: "Set up avatars", source: "engine", path: "agents/avatars.md", heading: "Setup" },
        ],
      },
    },
  };
  assert.equal(capabilityDocumentationSchema.safeParse(index).success, true);
  assert.equal(capabilityDocumentationSchema.safeParse({ ...index, extra: true }).success, false);
  assert.equal(
    capabilityDocumentationSchema.safeParse({
      schemaVersion: 1,
      packages: {
        example: {
          ...index.packages.example,
          overview: { ...reference, path: "../../packages/example/docs/../README.md" },
        },
      },
    }).success,
    false,
  );
  let clock = Date.now();
  let offline = false;
  const requests: string[] = [];
  const fetcher: typeof safeFetch = async (input, options) => {
    const url = String(input);
    requests.push(url);
    assert.equal(options?.policy?.maxRedirects, 0);
    assert.deepEqual(options?.policy?.allowedOrigins, [new URL(url).origin]);
    assert.ok(options?.signal);
    if (offline) throw new Error("Offline");
    if (url === sidecarUrl) return Response.json(index);
    if (url === docUrl) return new Response(markdown);
    return new Response("Missing", { status: 404 });
  };
  const dependencies = { workspaceRoot: root, cacheRoot: join(root, "cache"), fetch: fetcher, now: () => clock };
  const reader = createPackageDocumentationReader(dependencies);
  const context = { catalogUrl, packageId: "example", version: "1.0.0" };
  const result = await reader(context);
  assert.equal(result.status, "available");
  assert.equal(result.content, markdown);
  assert.deepEqual(
    result.topics.map((topic) => topic.id),
    ["overview", "setup"],
  );
  const selected = await reader(context, "setup");
  assert.match(selected.content!, /Choose your avatar/u);
  assert.doesNotMatch(selected.content!, /Other text/u);
  assert.equal(selected.enginePath, "docs/agents/avatars.md");
  assert.equal((await reader(context, "unknown")).status, "unavailable");
  assert.equal(requests.filter((url) => url === sidecarUrl).length, 1);

  offline = true;
  clock += 6 * 60_000;
  const restarted = createPackageDocumentationReader(dependencies);
  assert.equal((await restarted(context)).status, "cached", "validated cache survives a server restart");
  assert.equal((await restarted({ ...context, version: "2.0.0" })).status, "unavailable");
  assert.equal(
    (await restarted({ ...context, catalogUrl: catalogUrl.replace("/staging/", "/main/") })).status,
    "unavailable",
  );
  clock += 8 * 24 * 60 * 60_000;
  assert.equal((await restarted(context)).status, "unavailable", "expired offline reads are not served");

  offline = false;
  const badHashReader = createPackageDocumentationReader({
    ...dependencies,
    cacheRoot: join(root, "bad-cache"),
    fetch: (async (url, options) =>
      String(url) === sidecarUrl
        ? Response.json({
            ...index,
            packages: { example: { ...index.packages.example, overview: { ...reference, sha256: "0".repeat(64) } } },
          })
        : fetcher(url, options)) as typeof safeFetch,
  });
  assert.equal((await badHashReader(context)).status, "unavailable");

  const legacy = await reader({
    ...context,
    packageId: "avatars",
    documentationUrl: "https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/agents/avatars.md#setup",
  });
  assert.equal(legacy.status, "available");
  assert.match(legacy.content!, /Choose your avatar/u);
  assert.match(legacy.sourceUrl!, /\/staging\//u);
  const legacyContext = {
    ...context,
    packageId: "legacy-example",
    documentationUrl: "https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/agents/summary.md#example",
  };
  const summary = await reader(legacyContext);
  assert.deepEqual(
    summary.topics.map((topic) => topic.id),
    ["overview", "full-guide"],
  );
  const full = await reader(legacyContext, "full-guide");
  assert.equal(full.status, "available");
  assert.match(full.content!, /Choose your avatar/u);
  assert.equal(full.enginePath, "docs/agents/avatars.md");
  assert.equal(
    (
      await reader({
        ...context,
        packageId: "missing",
        documentationUrl: "https://github.com/Pasta-Devs/Marinara-Agents#missing",
      })
    ).status,
    "unavailable",
  );
  assert.equal(
    (await reader({ ...context, packageId: "external", documentationUrl: "https://example.org/README.md" })).status,
    "unavailable",
  );
  console.log(
    "Package documentation: published hashes, headings, URL boundaries, channel/version isolation, legacy and offline reads passed.",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

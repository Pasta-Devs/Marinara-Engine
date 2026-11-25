import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runNamedCases } from "../fixtures/named-cases.js";

const root = await mkdtemp(join(tmpdir(), "marinara-image-tag-routes-"));
process.env.DATA_DIR = root;
process.env.MARINARA_ENV_FILE = join(root, ".env");
process.env.NODE_ENV = "test";
process.env.HOST = "0.0.0.0";
for (const key of [
  "ADMIN_SECRET",
  "BASIC_AUTH_USER",
  "BASIC_AUTH_PASS",
  "ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK",
  "BYPASS_AUTH_DOCKER",
  "BYPASS_AUTH_TAILSCALE",
  "IP_ALLOWLIST",
  "IP_ALLOWLIST_ENABLED",
  "MARINARA_DOCKER",
  "REQUIRE_AUTH_FOR_LOOPBACK_PROXY",
  "TRUSTED_HOSTS",
  "TRUSTED_PRIVATE_NETWORKS",
  "MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK",
])
  delete process.env[key];

const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer(
  "fastify",
) as typeof import("../../../packages/server/node_modules/fastify/fastify.js").default;
const multipart = requireServer("@fastify/multipart");
const { imageTagDatasetRoutes } = await import("../../../packages/server/src/routes/image-tag-datasets.routes.js");
const prefix = "/api/image-tag-datasets";
const local = { remoteAddress: "127.0.0.1", headers: { host: "127.0.0.1:6972" } };
const csv = 'name,category,post_count,aliases\r\nblue_hair,0,42,"azure hair,blue locks"\r\n初音ミク,4,8,miku\r\n';

function body(text = csv, fields: Array<[string, string]> = [], filename = "tags.csv", fieldname = "file") {
  const boundary = `marinara-${randomUUID()}`;
  const parts = fields.map(
    ([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldname}"; filename="${filename}"\r\nContent-Type: text/csv\r\n\r\n${text}\r\n--${boundary}--\r\n`,
  );
  return {
    payload: Buffer.from(parts.join(""), "utf8"),
    headers: { ...local.headers, "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

async function fixture(run: (app: ReturnType<typeof Fastify>) => Promise<void>) {
  const app = Fastify({ logger: false });
  try {
    await app.register(multipart);
    await app.register(imageTagDatasetRoutes, { prefix });
    await app.ready();
    await run(app);
  } finally {
    await app.close();
    await rm(join(root, "image-tag-datasets"), { recursive: true, force: true });
  }
}

try {
  await runNamedCases([
    {
      name: "anonymous remote callers cannot list, search, import, update or delete datasets",
      async run() {
        await fixture(async (app) => {
          const imported = await app.inject({ method: "POST", url: `${prefix}/import`, ...local, ...body() });
          assert.equal(imported.statusCode, 201, imported.body);
          const id = imported.json().id as string;
          const path = join(root, "image-tag-datasets", `${id}.json`);
          const original = await readFile(path, "utf8");
          const remote = { remoteAddress: "192.0.2.90", headers: { host: "192.0.2.10:6972" } };
          const requests = [
            { method: "GET" as const, url: `${prefix}/` },
            { method: "POST" as const, url: `${prefix}/search`, payload: { queries: ["blue"] } },
            { method: "PATCH" as const, url: `${prefix}/${id}`, payload: { enabled: false } },
            { method: "DELETE" as const, url: `${prefix}/${id}` },
          ];
          for (const request of requests) {
            const response = await app.inject({ ...request, ...remote });
            assert.equal(response.statusCode, 403, `${request.method} ${request.url}: ${response.body}`);
          }
          const upload = body("changed,0,1,");
          const response = await app.inject({
            method: "POST",
            url: `${prefix}/import`,
            ...remote,
            ...upload,
            headers: { ...upload.headers, ...remote.headers },
          });
          assert.equal(response.statusCode, 403, response.body);
          assert.equal(await readFile(path, "utf8"), original);
          assert.deepEqual(await readdir(join(root, "image-tag-datasets")), [`${id}.json`]);
        });
      },
    },
    {
      name: "loopback owner imports, searches aliases, switches categories, replaces and deletes through HTTP",
      async run() {
        await fixture(async (app) => {
          const imported = await app.inject({ method: "POST", url: `${prefix}/import`, ...local, ...body() });
          assert.equal(imported.statusCode, 201, imported.body);
          const source = imported.json();
          const list = await app.inject({ method: "GET", url: `${prefix}/`, ...local });
          assert.equal(list.statusCode, 200);
          assert.deepEqual(list.json().sources, [source]);

          const search = () =>
            app.inject({
              method: "POST",
              url: `${prefix}/search`,
              ...local,
              payload: { queries: ["azure hair"], mode: "exact" },
            });
          const hit = (await search()).json().results[0].matches[0];
          assert.equal(hit.canonicalName, "blue_hair");
          assert.equal(hit.matchedAlias, "azure hair");

          const disableCategory = await app.inject({
            method: "PATCH",
            url: `${prefix}/${source.id}`,
            ...local,
            payload: { enabledCategories: [4] },
          });
          assert.equal(disableCategory.statusCode, 200, disableCategory.body);
          assert.deepEqual((await search()).json().results[0].matches, []);
          await app.inject({ method: "PATCH", url: `${prefix}/${source.id}`, ...local, payload: { enabled: false } });
          assert.equal((await search()).json().status, "disabled");

          const replacement = await app.inject({
            method: "POST",
            url: `${prefix}/import`,
            ...local,
            ...body("new_tag,0,9,", [["replaceId", source.id]]),
          });
          assert.equal(replacement.statusCode, 201, replacement.body);
          assert.equal(replacement.json().id, source.id);
          assert.equal(replacement.json().recordCount, 1);
          assert.equal(replacement.json().enabled, false);
          assert.deepEqual(replacement.json().enabledCategories, [4]);
          const deleted = await app.inject({ method: "DELETE", url: `${prefix}/${source.id}`, ...local });
          assert.equal(deleted.statusCode, 204);
          assert.equal((await search()).json().status, "no_datasets");
        });
      },
    },
    {
      name: "three-column CSV needs an explicit supported category and unknown import fields are rejected",
      async run() {
        await fixture(async (app) => {
          const upload = (fields: Array<[string, string]>) =>
            app.inject({ method: "POST", url: `${prefix}/import`, ...local, ...body("split_tag,3,alias", fields) });
          assert.equal((await upload([])).statusCode, 400);
          for (const fields of [
            [["category", "2"]],
            [["category", "04"]],
            [
              ["category", "4"],
              ["scheme", "e621"],
            ],
            [
              ["category", "4"],
              ["category", "0"],
            ],
          ] as Array<Array<[string, string]>>) {
            const response = await upload(fields);
            assert.equal(response.statusCode, 400, response.body);
          }
          const accepted = await upload([["category", "4"]]);
          assert.equal(accepted.statusCode, 201, accepted.body);
          assert.deepEqual(accepted.json().categoryCounts, { "4": 1 });
        });
      },
    },
    {
      name: "invalid imports and replacements leave the installed dataset unchanged",
      async run() {
        await fixture(async (app) => {
          const imported = await app.inject({ method: "POST", url: `${prefix}/import`, ...local, ...body() });
          assert.equal(imported.statusCode, 201, imported.body);
          const id = imported.json().id as string;
          const path = join(root, "image-tag-datasets", `${id}.json`);
          const before = await readFile(path, "utf8");
          for (const upload of [
            body('"unterminated,0,9,', [["replaceId", id]]),
            body(csv, [], "tags.json"),
            body(csv, [], "tags.csv", "other"),
            body(csv, [["name", "x".repeat(2050)]]),
          ]) {
            const response = await app.inject({ method: "POST", url: `${prefix}/import`, ...local, ...upload });
            assert.ok(response.statusCode >= 400 && response.statusCode < 500, response.body);
            assert.equal(await readFile(path, "utf8"), before);
          }
          const duplicate = await app.inject({ method: "POST", url: `${prefix}/import`, ...local, ...body() });
          assert.equal(duplicate.statusCode, 409, duplicate.body);
          const invalidSearch = await app.inject({
            method: "POST",
            url: `${prefix}/search`,
            ...local,
            payload: { queries: [] },
          });
          assert.equal(invalidSearch.statusCode, 400, invalidSearch.body);
          assert.equal(await readFile(path, "utf8"), before);
        });
      },
    },
    {
      name: "untrusted Host and loopback requests forwarded from remote callers do not gain owner access",
      async run() {
        await fixture(async (app) => {
          const untrusted = await app.inject({
            method: "GET",
            url: `${prefix}/`,
            ...local,
            headers: { host: "attacker.example" },
          });
          assert.equal(untrusted.statusCode, 421);
          const forwarded = await app.inject({
            method: "GET",
            url: `${prefix}/`,
            ...local,
            headers: { ...local.headers, "x-forwarded-for": "192.0.2.90" },
          });
          assert.equal(forwarded.statusCode, 403, forwarded.body);
        });
      },
    },
  ]);
} finally {
  await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}

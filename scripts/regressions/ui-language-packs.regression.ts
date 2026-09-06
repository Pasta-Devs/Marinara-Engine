import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

const fixture = await mkdtemp(join(tmpdir(), "marinara-ui-language-"));
process.env.DATA_DIR = fixture;
// A public IP avoids DNS dependency; fetch below is fully mocked, no remote requests are made.
process.env.DOCS_I18N_BASE_URL = "https://93.184.216.34/translation-fixture";
const { installUIPack, readUIPack, uiPackManifestFile, uiPackPath } =
  await import("../../packages/server/src/services/docs/ui-pack.service.ts");
const { uiLanguagesRoutes } = await import("../../packages/server/src/routes/ui-languages.routes.ts");
const { normalizeLocaleResource, normalizeUILanguage, UI_LANGUAGE_CODES } =
  await import("../../packages/shared/src/utils/ui-locales.ts");
const originalFetch = globalThis.fetch;
const app = Fastify();
await app.register(uiLanguagesRoutes, { prefix: "/api/ui-languages" });
let requests = 0;
let downloadContent = JSON.stringify({
  _meta: { locale: "pl", direction: "ltr" },
  "common.actions.save": "Zapisz",
  "old.removedKey": "Old translation",
});
let breakHash = false;
let offline = false;
globalThis.fetch = async (input) => {
  requests++;
  if (offline) throw new Error("Offline fixture");
  const content = new URL(String(input)).pathname.endsWith("manifest.json")
    ? JSON.stringify({
        files: [
          {
            path: "pl.json",
            bytes: Buffer.byteLength(downloadContent),
            sha256: breakHash ? "0".repeat(64) : createHash("sha256").update(downloadContent).digest("hex"),
          },
        ],
      })
    : downloadContent;
  return new Response(content, { headers: { "content-type": "application/json" } });
};

try {
  assert.equal(UI_LANGUAGE_CODES.length, 12);
  assert.ok(UI_LANGUAGE_CODES.includes("ar"));
  assert.equal(normalizeUILanguage("PT-br"), "pt-BR");
  assert.equal(normalizeUILanguage("ZH-hans"), "zh-Hans");
  for (const bad of ["../pl", "pl/../../private", "en", "PL", "xx"]) assert.throws(() => uiPackPath(bad));
  assert.equal(await readUIPack("pl"), null);
  assert.deepEqual((await app.inject("/api/ui-languages")).json(), { installed: ["en"] });
  assert.equal((await app.inject("/api/ui-languages/pl")).json(), null);
  assert.equal(requests, 0, "startup/status/local reads must never download a pack");
  assert.equal((await app.inject({ method: "POST", url: "/api/ui-languages/xx" })).statusCode, 400);
  assert.equal(requests, 0);

  const installResponse = await app.inject({ method: "POST", url: "/api/ui-languages/pl" });
  assert.equal(installResponse.statusCode, 200, installResponse.body);
  assert.equal(requests, 2, "one explicit install fetches one manifest and one pack");
  const installedBytes = await readFile(uiPackPath("pl"), "utf8");
  assert.equal(installedBytes, downloadContent, "installation preserves original pack bytes");
  const loaded = normalizeLocaleResource("pl", await readUIPack("pl"));
  assert.equal(loaded.messages["common.actions.save"], "Zapisz");
  assert.equal(loaded.messages["old.removedKey"], "Old translation", "stale keys are harmless at runtime");
  assert.equal(loaded.messages["new.missingKey"], undefined, "absent keys remain absent for English fallback");
  assert.deepEqual((await app.inject("/api/ui-languages")).json(), { installed: ["en", "pl"] });
  assert.equal(requests, 2, "reusing an installed pack remains offline");

  breakHash = true;
  await assert.rejects(installUIPack("pl"), /Hash mismatch/);
  assert.equal(await readFile(uiPackPath("pl"), "utf8"), installedBytes);
  breakHash = false;
  downloadContent = JSON.stringify({
    _meta: { locale: "de", direction: "ltr" },
    "common.actions.save": "Bad metadata",
  });
  await assert.rejects(installUIPack("pl"), /metadata/);
  assert.equal(await readFile(uiPackPath("pl"), "utf8"), installedBytes);
  offline = true;
  await assert.rejects(installUIPack("pl"), /Offline/);
  assert.equal(await readFile(uiPackPath("pl"), "utf8"), installedBytes);
  assert.deepEqual(await readdir(join(fixture, "ui-packs")), ["pl.json"], "failed refreshes leave no partial files");

  const validFile = { path: "pl.json", bytes: 10, sha256: "a".repeat(64) };
  for (const files of [
    [],
    [validFile, validFile],
    [{ ...validFile, path: "../pl.json" }],
    [{ ...validFile, bytes: 6 * 1024 * 1024 }],
    [{ ...validFile, sha256: "wrong" }],
  ]) {
    assert.throws(() => uiPackManifestFile({ files }, "pl"));
  }
  assert.throws(() => normalizeLocaleResource("pl", { _meta: { locale: "pl", direction: "ltr" }, "bad.value": {} }));
  assert.throws(() => normalizeLocaleResource("pl", { _meta: { locale: "pl", direction: "ltr" }, "bad.value": "" }));
  assert.equal(
    normalizeLocaleResource("ko", { _meta: { locale: "ko", direction: "ltr" }, "ui.noodle.stageprofileview.s": "" })
      .messages["ui.noodle.stageprofileview.s"],
    "",
  );
  await writeFile(uiPackPath("pl"), "broken");
  assert.equal(await readUIPack("pl"), null, "corrupt local packs also fall back cleanly");
  console.info(
    "UI language packs: explicit installs, local fallback, preserved bytes, safe refresh and validation passed.",
  );
} finally {
  globalThis.fetch = originalFetch;
  await app.close();
  await rm(fixture, { recursive: true, force: true });
}

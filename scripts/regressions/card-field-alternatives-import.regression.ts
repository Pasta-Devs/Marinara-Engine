import assert from "node:assert/strict";
import { characterDataSchema, unassignCardFieldAlternatives } from "../../packages/shared/src/index.js";

const { buildApp } = await import("../../packages/server/src/app.js");
const { getDB } = await import("../../packages/server/src/db/connection.js");
const { characters } = await import("../../packages/server/src/db/schema/index.js");
const { default: AdmZip } = await import("../../packages/server/node_modules/adm-zip/adm-zip.js");
const app = await buildApp();
await app.ready();
try {
  async function request(method: "POST" | "GET" | "PATCH", url: string, payload?: unknown, expected = 200) {
    const response = await app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
    assert.equal(response.statusCode, expected, `${method} ${url}: ${response.body}`);
    return response.json();
  }
  const valid = {
    id: "keep",
    field: "description" as const,
    value: "  Preserve this authored alternative.\n",
    chatIds: ["foreign-chat"],
  };
  const conflict = { ...valid, id: "conflict", value: "" };
  const alternatives = [valid, conflict];
  const portable = alternatives.map((entry) => ({ ...entry, chatIds: [] }));
  assert.deepEqual(unassignCardFieldAlternatives(undefined), []);
  assert.deepEqual(unassignCardFieldAlternatives(JSON.stringify(alternatives)), portable);

  const character = await request("POST", "/api/characters", {
    data: characterDataSchema.parse({ name: "Valid Author", extensions: { cardFieldAlternatives: [valid] } }),
  });
  const persona = await request("POST", "/api/characters/personas", {
    name: "Valid Persona",
    cardFieldAlternatives: [valid],
  });
  async function assertSourcesUnchanged() {
    const c = await request("GET", `/api/characters/${character.id}`);
    const p = await request("GET", `/api/characters/personas/${persona.id}`);
    assert.deepEqual(JSON.parse(c.data).extensions.cardFieldAlternatives, [valid]);
    assert.deepEqual(p.cardFieldAlternatives, [valid]);
  }
  await request(
    "PATCH",
    `/api/characters/${character.id}`,
    { data: { extensions: { cardFieldAlternatives: alternatives } } },
    400,
  );
  await request("PATCH", `/api/characters/personas/${persona.id}`, { cardFieldAlternatives: alternatives }, 400);
  await assertSourcesUnchanged();
  const characterExport = await request("GET", `/api/characters/${character.id}/export`);
  const personaExport = await request("GET", `/api/characters/personas/${persona.id}/export`);

  for (const kind of ["native character", "native persona", "compatible character"] as const) {
    const isPersona = kind === "native persona";
    const importUrl = kind === "compatible character" ? "/api/import/st-character" : "/api/import/marinara";
    function payload(value: unknown) {
      const envelope = structuredClone(isPersona ? personaExport : characterExport);
      if (isPersona) envelope.data.cardFieldAlternatives = value;
      else envelope.data.data.extensions.cardFieldAlternatives = value;
      return kind === "compatible character" ? envelope.data : envelope;
    }
    for (const value of [alternatives, JSON.stringify(alternatives)]) {
      const imported = await request("POST", importUrl, payload(value));
      assert.equal(imported.success, true, kind);
      const id = imported.id ?? imported.characterId;
      assert.ok(id, kind);
      const url = `/api/characters/${isPersona ? "personas/" : ""}${id}`;
      const saved = await request("GET", url);
      assert.deepEqual(
        isPersona ? saved.cardFieldAlternatives : JSON.parse(saved.data).extensions.cardFieldAlternatives,
        portable,
        `${kind}: conflicting foreign assignments are cleared without dropping prose or empty overrides`,
      );
      const exported = await request("GET", `${url}/export`);
      assert.deepEqual(
        isPersona ? exported.data.cardFieldAlternatives : exported.data.data.extensions.cardFieldAlternatives,
        portable,
        `${kind}: the valid portable shape exports without changing content`,
      );
    }
    const beforeCharacterCount = (await request("GET", "/api/characters")).length;
    const beforePersonaCount = (await request("GET", "/api/characters/personas/list")).length;
    for (const value of [
      [valid, { ...valid, field: "appearance" }],
      [valid, { ...conflict, field: "system_prompt" }],
      [valid, { id: "missing-fields" }],
      { invalid: "outer shape" },
      "{ malformed JSON",
      null,
    ]) {
      const compatible = kind === "compatible character";
      const rejected = await request("POST", importUrl, payload(value), compatible ? 200 : 400);
      if (compatible) {
        assert.equal(rejected.success, false, "the compatible importer retains its explicit failure envelope");
        assert.equal(typeof rejected.error, "string");
        assert.ok(rejected.error.length > 0);
      } else {
        assert.equal(rejected.error, "Validation Error", `${kind}: malformed alternatives fail explicitly`);
        assert.ok(rejected.details.length > 0);
      }
      await assertSourcesUnchanged();
    }
    assert.equal((await request("GET", "/api/characters")).length, beforeCharacterCount);
    assert.equal((await request("GET", "/api/characters/personas/list")).length, beforePersonaCount);
  }
  // Legacy profiles can contain unvalidated extension fields. Exports are reads:
  // one malformed alternatives field must not abort the card or a mixed ZIP.
  const healthyAlternatives = [valid, { ...conflict, field: "appearance" as const }];
  const exportRows = [
    healthyAlternatives,
    alternatives,
    JSON.stringify(alternatives),
    null,
    [valid, { id: "missing-fields" }],
    { legacy: "object" },
    [valid, { ...valid, field: "appearance" }],
    undefined,
    "[]",
  ].map((value, index) => ({
    id: `export-alternatives-${index}`,
    data: JSON.stringify({
      ...characterDataSchema.parse({ name: `Export subject ${index}`, description: `BASE ${index}` }),
      extensions: { cardFieldAlternatives: value },
    }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  await (await getDB()).insert(characters).values(exportRows);
  function assertExported(data: Record<string, any>, index: number) {
    assert.equal(data.description, `BASE ${index}`);
    assert.deepEqual(
      data.extensions.cardFieldAlternatives,
      index === 0
        ? healthyAlternatives.map((entry) => ({ ...entry, chatIds: [] }))
        : index === 1 || index === 2
          ? portable
          : [],
      "stored malformed alternatives fail closed while valid prose and empty overrides export faithfully",
    );
  }
  for (const format of ["native", "compatible"] as const) {
    for (const [index, row] of exportRows.entries()) {
      const exported = await request("GET", `/api/characters/${row.id}/export?format=${format}`);
      assertExported(format === "native" ? exported.data.data : exported.data, index);
    }
    const bulk = await app.inject({
      method: "POST",
      url: "/api/characters/export-bulk",
      payload: { ids: exportRows.map(({ id }) => id), format },
    });
    assert.equal(bulk.statusCode, 200);
    const files = new AdmZip(bulk.rawPayload).getEntries();
    assert.equal(files.length, exportRows.length, "the mixed archive keeps every healthy and malformed card");
    const byName = new Map(
      files.map((file) => {
        const envelope = JSON.parse(file.getData().toString("utf8"));
        const data = format === "native" ? envelope.data.data : envelope.data;
        return [data.name, data];
      }),
    );
    for (const [index, row] of exportRows.entries()) {
      assertExported(byName.get(`Export subject ${index}`)!, index);
      assert.equal((await request("GET", `/api/characters/${row.id}`)).data, row.data, "exports never rewrite storage");
    }
  }
  console.log(
    "Portable alternatives validate imports and fail closed on malformed stored exports without data mutation.",
  );
} finally {
  await app.close();
}

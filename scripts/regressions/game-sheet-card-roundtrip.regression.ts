// A library card's Game Mode sheets survive export and import (owner 2026-11-06): the MRPG picks
// (character extensions.classic, persona personaStats.classic) and the Legacy story sheet (rpgStats),
// through every format a card leaves the library in and comes back from: native JSON, the compatible
// (V2) JSON, the PNG card, the bulk ZIPs, and the plain persona JSON.
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

const { default: AdmZip } = await import("../../packages/server/node_modules/adm-zip/adm-zip.js");
const { buildApp } = await import("../../packages/server/src/app.js");
const { closeDB, getDB } = await import("../../packages/server/src/db/connection.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { marinaraCardClassicByName } =
  await import("../../packages/server/src/services/game/marinara-card-classic.service.js");

type Response = { statusCode: number; headers: Record<string, unknown>; rawPayload: Buffer; body: string };
const app = (await buildApp()) as unknown as {
  ready(): Promise<void>;
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<Response>;
};
await app.ready();

const classic = { tree: "marksman", strong: ["skill", "speed"], weak: "magic" };
const rpgStats = {
  enabled: true,
  attributes: [
    { name: "STR", value: 14 },
    { name: "DEX", value: 17 },
  ],
  hp: { value: 22, max: 30 },
  pools: [{ name: "Focus", value: 3, max: 5, color: "#3366ff" }],
};
const ok = (response: Response, what: string) => {
  assert.equal(response.statusCode, 200, `${what}: ${response.body.slice(0, 400)}`);
  return response;
};
const multipart = (url: string, filename: string, bytes: Buffer, field = "file") => {
  const boundary = "marinara-sheet-roundtrip";
  return app.inject({
    method: "POST",
    url,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
          "Content-Type: application/octet-stream\r\n\r\n",
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
};

try {
  const db = await getDB();
  const storage = createCharactersStorage(db);
  const characterSheets = async (id: string, label: string) => {
    const row = await storage.getById(id);
    assert.ok(row, `${label}: the imported character exists`);
    const data = JSON.parse(row!.data) as { name: string; extensions?: Record<string, unknown> };
    assert.deepEqual(data.extensions?.classic, classic, `${label}: the MRPG picks come back`);
    assert.deepEqual(data.extensions?.rpgStats, rpgStats, `${label}: the Legacy sheet comes back`);
    return data;
  };
  const newestCharacterNamed = async (name: string) => {
    const rows = (await storage.list()) as Array<{ id: string; data: string; createdAt?: string }>;
    const found = rows.filter((row) => (JSON.parse(row.data) as { name?: string }).name === name);
    assert.ok(found.length, `a character named ${name} was imported`);
    return found.at(-1)!.id;
  };

  // ── A character with both sheets ──
  const original = (await storage.create({
    name: "Wren Arrowfall",
    description: "A patient hunter from the marshes.",
    extensions: { classic, rpgStats },
  } as never))!;
  await characterSheets(original.id, "the original");

  // Native JSON → /api/import/marinara.
  const native = ok(await app.inject({ method: "GET", url: `/api/characters/${original.id}/export` }), "native export");
  const nativeImport = JSON.parse(
    ok(
      await app.inject({ method: "POST", url: "/api/import/marinara", payload: JSON.parse(native.body) }),
      "native import",
    ).body,
  ) as { success: boolean; id?: string; error?: string };
  assert.equal(nativeImport.success, true, nativeImport.error);
  await characterSheets(nativeImport.id!, "native JSON");

  // Compatible (V2) JSON → /api/import/st-character.
  const compatible = ok(
    await app.inject({ method: "GET", url: `/api/characters/${original.id}/export?format=compatible` }),
    "compatible export",
  );
  const compatibleCard = JSON.parse(compatible.body) as { data?: { extensions?: Record<string, unknown> } };
  assert.deepEqual(compatibleCard.data?.extensions?.classic, classic, "the V2 card carries the MRPG picks");
  const before = ((await storage.list()) as unknown[]).length;
  ok(await multipart("/api/import/st-character", "wren.json", Buffer.from(compatible.body)), "compatible import");
  assert.equal(((await storage.list()) as unknown[]).length, before + 1, "the compatible card was imported");
  await characterSheets(await newestCharacterNamed("Wren Arrowfall"), "compatible JSON");

  // PNG card → /api/import/st-character.
  const png = ok(await app.inject({ method: "GET", url: `/api/characters/${original.id}/export-png` }), "PNG export");
  const beforePng = ((await storage.list()) as unknown[]).length;
  ok(await multipart("/api/import/st-character", "wren.png", png.rawPayload), "PNG import");
  assert.equal(((await storage.list()) as unknown[]).length, beforePng + 1, "the PNG card was imported");
  await characterSheets(await newestCharacterNamed("Wren Arrowfall"), "PNG card");

  // Bulk ZIP, both formats.
  for (const format of ["native", "compatible"] as const) {
    const zip = ok(
      await app.inject({ method: "POST", url: "/api/characters/export-bulk", payload: { ids: [original.id], format } }),
      `${format} bulk export`,
    );
    const entries = new AdmZip(zip.rawPayload).getEntries();
    const text = entries.map((entry) => entry.getData().toString("utf8")).find((one) => one.includes("Wren"));
    assert.ok(text, `${format} bulk ZIP holds the card`);
    const card = JSON.parse(text!) as Record<string, any>;
    const extensions = card.data?.extensions ?? card.data?.data?.extensions;
    assert.deepEqual(extensions?.classic, classic, `${format} bulk ZIP keeps the MRPG picks`);
    assert.deepEqual(extensions?.rpgStats, rpgStats, `${format} bulk ZIP keeps the Legacy sheet`);
  }

  // ── A persona with both sheets ──
  const persona = (await storage.createPersona("Lio Vance", "A cautious scout.", undefined, {
    personaStats: { enabled: true, bars: [], rpgStats, classic },
  } as never))!;
  const personaSheets = async (id: string, label: string) => {
    const row = (await storage.getPersona(id)) as { personaStats?: unknown } | null;
    assert.ok(row, `${label}: the imported persona exists`);
    const stats = (typeof row!.personaStats === "string" ? JSON.parse(row!.personaStats) : row!.personaStats) as Record<
      string,
      unknown
    >;
    assert.deepEqual(stats?.classic, classic, `${label}: the persona's MRPG picks come back`);
    assert.deepEqual(stats?.rpgStats, rpgStats, `${label}: the persona's Legacy sheet comes back`);
  };
  await personaSheets(persona.id, "the original persona");

  const personaNative = ok(
    await app.inject({ method: "GET", url: `/api/characters/personas/${persona.id}/export` }),
    "persona native export",
  );
  const personaNativeImport = JSON.parse(
    ok(
      await app.inject({ method: "POST", url: "/api/import/marinara", payload: JSON.parse(personaNative.body) }),
      "persona native import",
    ).body,
  ) as { success: boolean; id?: string; error?: string };
  assert.equal(personaNativeImport.success, true, personaNativeImport.error);
  await personaSheets(personaNativeImport.id!, "persona native JSON");

  const personaCompatible = ok(
    await app.inject({ method: "GET", url: `/api/characters/personas/${persona.id}/export?format=compatible` }),
    "persona compatible export",
  );
  const personaPlain = JSON.parse(
    ok(
      await app.inject({
        method: "POST",
        url: "/api/characters/personas",
        payload: JSON.parse(personaCompatible.body),
      }),
      "persona plain JSON import",
    ).body,
  ) as { id: string };
  await personaSheets(personaPlain.id, "persona compatible JSON");

  // ── A game started with imported cards reads their picks ──
  const picks = await marinaraCardClassicByName(db, {
    characterIds: JSON.stringify([nativeImport.id]),
    personaId: personaNativeImport.id,
  });
  assert.equal(picks.get("wren arrowfall")?.tree, "marksman", "an imported character's tree reaches a new game");
  assert.equal(picks.get("lio vance")?.tree, "marksman", "an imported persona's tree reaches a new game");

  console.log("game-sheet-card-roundtrip: ok");
} finally {
  await app.close();
  await closeDB();
}

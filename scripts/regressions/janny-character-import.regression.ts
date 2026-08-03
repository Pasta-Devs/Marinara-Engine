import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { deflateSync, crc32 as zlibCrc32 } from "node:zlib";
import { fileURLToPath } from "node:url";
import { fetchJannyCharacterCard } from "../../packages/server/src/services/bot-browser/janny-character-card.js";
import { parsePngCharacterCard } from "../../packages/client/src/lib/png-parser.js";
import { readCharacterCardDetailFields } from "../../packages/client/src/lib/character-import.js";
import { MAX_FILE_SIZES } from "../../packages/shared/src/constants/defaults.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function pngChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlibCrc32(Buffer.concat([typeBytes, data])) >>> 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

const characterBook = { name: "Janny lore", entries: [{ keys: ["laboratory"], content: "Lore entry" }] };
const characterData = {
  name: "Complete Janny Card",
  description: "Full description",
  personality: "Full personality",
  scenario: "Full scenario",
  first_mes: "Full greeting",
  mes_example: "Full example dialogue",
  alternate_greetings: ["Alternate greeting"],
  creator_notes: "Full creator notes",
  system_prompt: "Full system prompt",
  post_history_instructions: "Full post-history instructions",
  character_version: "2.0",
  character_book: characterBook,
  extensions: { janny: { id: "character-4162" } },
};
const encodedCard = Buffer.from(
  JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: characterData }),
  "utf8",
).toString("base64");
const compressedText = Buffer.concat([
  Buffer.from("chara", "ascii"),
  Buffer.from([0, 0]),
  deflateSync(Buffer.from(encodedCard, "ascii")),
]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(1, 0);
ihdr.writeUInt32BE(1, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const idat = Buffer.from([0x78, 0x01, 0x62, 0x60, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x05, 0x00, 0x01]);
const cardPng = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk("IHDR", ihdr),
  pngChunk("zTXt", compressedText),
  pngChunk("IDAT", idat),
  pngChunk("IEND", Buffer.alloc(0)),
]);

const requests: Array<{ url: string; options: Record<string, unknown> }> = [];
const mockFetch = async (url: string | URL, options: Record<string, unknown> = {}) => {
  requests.push({ url: String(url), options });
  if (requests.length === 1) {
    return new Response(
      JSON.stringify({ status: "ok", downloadUrl: "https://cards.janny.example/complete-card.png" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(cardPng, { headers: { "Content-Type": "image/png" } });
};

const downloaded = await fetchJannyCharacterCard("character-4162", {
  fetchImpl: mockFetch,
});
assert.deepEqual(downloaded.buffer, cardPng);
assert.equal(requests[0]?.url, "https://api.jannyai.com/api/v1/download");
assert.deepEqual(JSON.parse(String(requests[0]?.options.body)), { characterId: "character-4162" });
assert.deepEqual((requests[0]?.options.policy as { allowedHostnames?: string[] }).allowedHostnames, [
  "api.jannyai.com",
]);
assert.equal(requests[1]?.url, "https://cards.janny.example/complete-card.png");
assert.deepEqual((requests[1]?.options.policy as { allowedProtocols?: string[] }).allowedProtocols, ["https:"]);
assert.equal(requests[1]?.options.maxResponseBytes, MAX_FILE_SIZES.CHARACTER_CARD);
assert.ok(MAX_FILE_SIZES.CHARACTER_CARD > MAX_FILE_SIZES.AVATAR);

const parsed = await parsePngCharacterCard(
  new File([new Uint8Array(downloaded.buffer)], "janny-card.png", { type: downloaded.mimeType }),
);
assert.deepEqual(readCharacterCardDetailFields(parsed.json), {
  description: characterData.description,
  personality: characterData.personality,
  scenario: characterData.scenario,
  firstMessage: characterData.first_mes,
  exampleDialogs: characterData.mes_example,
  alternateGreetings: characterData.alternate_greetings,
  creatorNotes: characterData.creator_notes,
  systemPrompt: characterData.system_prompt,
  postHistoryInstructions: characterData.post_history_instructions,
  characterVersion: characterData.character_version,
  hasLorebook: true,
  embeddedLorebook: characterBook,
  extensions: characterData.extensions,
});

await assert.rejects(
  fetchJannyCharacterCard("character-4162", {
    fetchImpl: async () =>
      new Response(JSON.stringify({ status: "ok", downloadUrl: "http://private.example/card.png" }), {
        headers: { "Content-Type": "application/json" },
      }),
  }),
  /insecure character-card download URL/u,
);

const clientSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/bot-browser/BotBrowserView.tsx"),
  "utf8",
);
assert.match(
  clientSource,
  /sourceId === "janny" \? await fetchCompleteJannyCard\(card\.id\)/u,
  "Janny imports must use the complete PNG card instead of rebuilding from search metadata",
);
assert.match(
  clientSource,
  /fetch\(JANNY_DOWNLOAD_API,[\s\S]{0,320}credentials: "include"/u,
  "Janny imports should retry through the user's browser session when Cloudflare rejects the server",
);
assert.match(
  clientSource,
  /return fetch\(`\/api\/bot-browser\/janny\/download\/\$\{encodeURIComponent\(characterId\)\}`\)/u,
  "Janny imports should retain the server download route as a CORS fallback",
);
assert.match(
  clientSource,
  /const cardRes = await fetchCompleteJannyCard\(charId\);/u,
  "Janny detail loading must use the complete PNG card through the browser-first downloader",
);

console.info("Janny character-import regression passed.");

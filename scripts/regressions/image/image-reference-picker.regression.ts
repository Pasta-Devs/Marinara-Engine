/**
 * The References row of the Create with AI window (and the avatar / character sheet windows that share it):
 *   - each image connection says how many reference pictures it sends (0: prompt only), matching what its
 *     generate function sends, and GET /api/connections/:id/reference-pictures answers it;
 *   - the avatar-generation route sends no more pictures than the connection takes, and adds one sentence
 *     naming what each sent picture is for (likeness, outfit…), to the preview as well, so a full prompt opened
 *     for editing names them; pictures past the limit are not sent and get no line;
 *   - the row's order helpers move a picture and keep only the sent ones.
 * The image service is a local fake server, so nothing is paid for.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-image-reference-picker-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

const { imageReferenceRoleNotes } = await import("../../../packages/shared/src/utils/image-reference-roles.js");
const { imageConnectionReferencePictureLimit } =
  await import("../../../packages/server/src/services/image/image-generation.js");
const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { charactersRoutes } = await import("../../../packages/server/src/routes/characters.routes.js");
const { connectionsRoutes } = await import("../../../packages/server/src/routes/connections.routes.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { moveImageReference, sentImageReferences } =
  await import("../../../packages/client/src/lib/image-references.js");

// A 1x1 PNG.
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

try {
  // ── Limits, backend by backend ──
  {
    const limit = (
      serviceHint: string,
      { baseUrl = "https://images.example.test/v1", model = "", comfyWorkflow = "" } = {},
    ) =>
      imageConnectionReferencePictureLimit({
        source: serviceHint || model,
        baseUrl,
        serviceHint,
        model,
        comfyWorkflow,
      });
    assert.equal(limit("openai", { model: "gpt-image-2" }), 16, "GPT Image takes up to 16");
    assert.equal(limit("openai", { model: "dall-e-3" }), 0, "DALL-E draws from the prompt only");
    assert.equal(limit("codex_chatgpt"), 16);
    assert.equal(limit("gemini_image"), 16);
    assert.equal(limit("xai"), 3);
    assert.equal(limit("nanogpt"), 3);
    assert.equal(limit("arli"), 1);
    assert.equal(limit("automatic1111"), 1);
    assert.equal(limit("pollinations"), 0);
    assert.equal(limit("togetherai"), 0);
    assert.equal(limit("openrouter", { model: "google/gemini-2.5-flash-image" }), 16, "chat route: all of them");
    assert.equal(limit("openrouter", { model: "krea/krea-2-medium" }), 1, "images API, not GPT Image: one");
    assert.equal(limit("openrouter", { model: "openai/gpt-image-2" }), 16, "images API, GPT Image: 16");
    const slots = (...names: string[]) =>
      JSON.stringify(Object.fromEntries(names.map((name, i) => [i + 1, { inputs: { image: name } }])));
    assert.equal(limit("comfyui", { comfyWorkflow: slots("%prompt%") }), 0, "no slot: prompt only");
    assert.equal(limit("comfyui", { comfyWorkflow: slots("%reference_image%") }), 1);
    assert.equal(
      limit("comfyui", {
        comfyWorkflow: slots("%reference_image_01%", "%reference_image_name_02%", "%reference_image_03%"),
      }),
      3,
      "numbered slots, either kind, in order",
    );
    assert.equal(
      limit("comfyui", { comfyWorkflow: slots("%reference_image_01%", "%reference_image_03%") }),
      1,
      "a gap ends the run: picture 2 would have nowhere to go",
    );
    assert.equal(limit("swarmui"), 4, "SwarmUI prompt images, no workflow");
  }

  // ── The sentence that names each picture's job ──
  assert.equal(
    imageReferenceRoleNotes(["likeness", "outfit", "other"], "Zion"),
    "Reference pictures: picture 1 shows the face and look of Zion; picture 2 shows the outfit to wear; picture 3 is a general reference.",
  );
  assert.equal(imageReferenceRoleNotes([], "Zion"), "", "no pictures: no sentence");
  assert.equal(imageReferenceRoleNotes(["other", "nonsense"], "Zion"), "", "no picture has a job: no sentence");
  assert.match(imageReferenceRoleNotes(["place"], ""), /picture 1 shows the place where it happens/);

  // ── Client order helpers ──
  assert.deepEqual(moveImageReference(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveImageReference(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.deepEqual(moveImageReference(["a", "b"], 0, 5), ["a", "b"], "out of range: unchanged");
  assert.deepEqual(sentImageReferences(["a", "b", "c", "d", "e"], 3), ["a", "b", "c"]);
  assert.deepEqual(sentImageReferences(["a", "b"], null), ["a", "b"], "limit unknown: all");
  assert.deepEqual(sentImageReferences(["a", "b"], 0), [], "prompt only: none");

  // ── The routes, against a fake xAI (3 pictures) ──
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      requests.push({ url: req.url ?? "", body: JSON.parse(raw || "{}") });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ b64_json: png }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const app = Fastify();
  try {
    const db = await createFileNativeDB(join(dataDir, "db"));
    app.decorate("db", db);
    await app.register(charactersRoutes, { prefix: "/api/characters" });
    await app.register(connectionsRoutes, { prefix: "/api/connections" });
    await app.ready();
    const connections = createConnectionsStorage(db);
    const xai = (await connections.create({
      name: "Grok Imagine",
      provider: "image_generation",
      imageGenerationSource: "xai",
      baseUrl: `http://127.0.0.1:${port}/v1`,
      apiKey: "fixture-key",
      model: "grok-imagine-image",
    }))!.id;
    const pollinations = (await connections.create({
      name: "Pollinations",
      provider: "image_generation",
      imageGenerationSource: "pollinations",
      baseUrl: "https://image.pollinations.ai",
      apiKey: "",
      model: "flux",
    }))!.id;

    let response = await app.inject({ method: "GET", url: `/api/connections/${xai}/reference-pictures` });
    assert.deepEqual(response.json(), { limit: 3 });
    response = await app.inject({ method: "GET", url: `/api/connections/${pollinations}/reference-pictures` });
    assert.deepEqual(response.json(), { limit: 0 });
    response = await app.inject({ method: "GET", url: "/api/connections/missing/reference-pictures" });
    assert.equal(response.statusCode, 404);

    const roles = ["likeness", "likeness", "outfit", "pose", "place"];
    const picture = `data:image/png;base64,${png}`;
    const payload = {
      connectionId: xai,
      name: "Zion Carter",
      appearance: "dark messy hair, leather jacket",
      purpose: "character-sheet",
      width: 1280,
      height: 720,
    };

    // The preview (a full prompt opened for editing) has the roles but not the pictures.
    response = await app.inject({
      method: "POST",
      url: "/api/characters/avatar-generation/preview",
      payload: { ...payload, referenceRoles: roles },
    });
    assert.equal(response.statusCode, 200, response.body);
    const previewPrompt: string = response.json().items[0].prompt;
    assert.match(previewPrompt, /picture 1 shows the face and look of Zion Carter/);
    assert.match(previewPrompt, /picture 3 shows the outfit to wear/);
    assert.doesNotMatch(previewPrompt, /picture 4/, "past the limit: no line");

    response = await app.inject({
      method: "POST",
      url: "/api/characters/avatar-generation",
      payload: { ...payload, referenceImages: roles.map(() => picture), referenceRoles: roles },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(requests.length, 1);
    const sent = requests[0]!;
    assert.match(sent.url, /\/images\/edits$/);
    assert.equal((sent.body.images as unknown[]).length, 3, "xAI is sent its 3, not all 5");
    assert.match(String(sent.body.prompt), /picture 3 shows the outfit to wear/);
    assert.doesNotMatch(String(sent.body.prompt), /picture 4/);

    // A Model that draws from the prompt only gets no pictures and no sentence.
    response = await app.inject({
      method: "POST",
      url: "/api/characters/avatar-generation/preview",
      payload: { ...payload, connectionId: pollinations, referenceRoles: roles },
    });
    assert.doesNotMatch(response.json().items[0].prompt, /Reference pictures/);
  } finally {
    await app.close();
    server.close();
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("image reference picker regression passed");

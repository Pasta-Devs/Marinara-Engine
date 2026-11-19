// #9387: the lightbox in Professor Mari's chat. Her images are preview assets (a manifest entry, no gallery row), so
// the gallery routes read one asset's saved request and regenerate it as a new asset with the prompt sent as written.
// The new picture replaces the old one in the reply it was opened from, and her stored tool results name the new
// asset, so a later "assign that one" means the picture the user sees.
import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "node:test";

const root = mkdtempSync(join(tmpdir(), "marinara-mari-image-lightbox-"));
const originalEnv = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
process.env.LOG_LEVEL = "silent";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// A local AUTOMATIC1111 stand-in that records what Marinara sent it.
const sent: Array<{ url: string; prompt?: string; negative_prompt?: string; width?: number; height?: number }> = [];
const imageServer = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    if (body) sent.push({ url: request.url ?? "", ...(JSON.parse(body) as object) });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ images: [PNG.toString("base64")] }));
  });
});
await new Promise<void>((resolve) => imageServer.listen(0, "127.0.0.1", resolve));
const imageBaseUrl = `http://127.0.0.1:${(imageServer.address() as AddressInfo).port}`;

const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify");
const { getDB } = await import("../../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../../packages/server/src/routes/gallery.routes.js");
const { getMariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
const { mariSourceReference } = await import("../../../packages/server/src/services/mari-db/mari-images.service.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { getSharp } = await import("../../../packages/server/src/services/image/sharp-runtime.js");
const { createConnectionSchema } = await import("../../../packages/shared/dist/index.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });

type Asset = {
  id: string;
  url: string;
  filename: string;
  kind: string;
  operation: string;
  prompt: string;
  width: number | null;
  height: number | null;
  connectionId: string;
  sourceImage?: string | null;
};

try {
  const mari = getMariDbService(db);
  const images = async (...args: string[]) => {
    const result = await mari.executeCli({ argv: ["images", ...args], sessionId: "mari-image-lightbox" });
    assert.equal(result.ok, true, `mari images ${args.join(" ")}\n${JSON.stringify(result)}`);
    return (result.output as { asset: Asset }).asset;
  };
  const connection = (await createConnectionsStorage(db).create(
    createConnectionSchema.parse({
      name: "Local A1111",
      provider: "image_generation",
      baseUrl: imageBaseUrl,
      imageService: "automatic1111",
    }),
  ))!;

  // Her chat, a reply that shows the picture, and the tool results she reads on later turns.
  const chats = createChatsStorage(db);
  const mariChat = (await chats.create({ name: "Professor Mari", mode: "conversation", connectionId: null } as never))!;
  await chats.patchMetadata(mariChat.id, { internalAssistant: "professor-mari" });
  const rpChat = (await chats.create({ name: "Roleplay", mode: "roleplay", connectionId: null } as never))!;

  // 1. The record route returns the manifest entry.
  const original = await images(
    "generate",
    "--kind",
    "background",
    "--width",
    "832",
    "--height",
    "512",
    "--prompt",
    "a quiet library at night",
    "--negative",
    "text",
  );
  const record = await app.inject(`/api/gallery/mari-images/assets/${original.id}`);
  assert.equal(record.statusCode, 200, record.body);
  const recordBody = record.json() as { asset: Asset; regenerable: boolean };
  assert.equal(recordBody.asset.url, original.url);
  assert.equal(recordBody.asset.prompt, "a quiet library at night");
  assert.equal(recordBody.regenerable, true, "a generated image can be regenerated");
  assert.equal(
    (await app.inject("/api/gallery/mari-images/assets/not-an-asset")).statusCode,
    404,
    "an id the manifest doesn't list (pruned or made up) is not found, so the lightbox opens without a prompt",
  );

  const reply = (await chats.createMessage({
    chatId: mariChat.id,
    role: "assistant",
    characterId: null,
    content: `Here's the library:\n\n![background](${original.url})\n\nWant it as the chat background?`,
    extra: {
      mariWorkspaceContinuity: { commandResults: [{ output: { asset: { id: original.id, url: original.url } } }] },
    },
  }))!;
  const rpMessage = (await chats.createMessage({
    chatId: rpChat.id,
    role: "assistant",
    characterId: null,
    content: `![copy](${original.url})`,
  }))!;

  // 2. Regenerate: the edited prompt goes out as written, with the saved kind and size, as a new asset.
  sent.length = 0;
  const regenerated = await app.inject({
    method: "POST",
    url: `/api/gallery/mari-images/assets/${original.id}/regenerate`,
    payload: {
      prompt: "a quiet library at night, candles",
      negativePrompt: "text, blurry",
      chatId: mariChat.id,
      messageId: reply.id,
    },
  });
  assert.equal(regenerated.statusCode, 200, regenerated.body);
  const result = regenerated.json() as {
    asset: Asset;
    regenerable: boolean;
    replacedMessageIds: string[];
    replacedMessages: { id: string; content: string; extra: Record<string, unknown> }[];
  };
  assert.equal(sent.at(-1)?.prompt, "a quiet library at night, candles", "the edited prompt is sent as written");
  assert.equal(sent.at(-1)?.negative_prompt, "text, blurry");
  assert.equal(sent.at(-1)?.width, 832, "the saved width is reused");
  assert.equal(sent.at(-1)?.height, 512, "the saved height is reused");
  assert.notEqual(result.asset.id, original.id, "a new asset");
  assert.equal(result.asset.kind, "background");
  assert.equal(result.asset.connectionId, connection.id);
  assert.deepEqual(result.replacedMessageIds, [reply.id]);
  assert.equal((await app.inject(result.asset.url)).statusCode, 200, "the new image loads");
  assert.equal(
    (await app.inject(`/api/gallery/mari-images/assets/${original.id}`)).statusCode,
    200,
    "the old asset stays in the manifest",
  );

  // 3. Her reply shows the new picture, and her stored tool results name the new asset.
  const swapped = (await chats.getMessage(reply.id))!;
  assert.ok(swapped.content.includes(result.asset.url), swapped.content);
  assert.ok(!swapped.content.includes(original.url), "the old picture is gone from the reply");
  assert.ok(swapped.content.startsWith("Here's the library:"), "the rest of her text stays");
  const extra = JSON.parse(swapped.extra as string) as { mariWorkspaceContinuity: unknown };
  const continuity = JSON.stringify(extra.mariWorkspaceContinuity);
  assert.ok(continuity.includes(result.asset.id) && !continuity.includes(original.id), continuity);
  // Her window applies what the route returns as is, so it must be exactly what was stored, with no trace of the old
  // url, filename or id (#9388: the client-side url-only swap kept the old filename and id).
  const [returned] = result.replacedMessages;
  assert.equal(returned?.id, reply.id);
  assert.equal(returned?.content, swapped.content, "the returned content is the stored content");
  assert.deepEqual(
    returned?.extra.mariWorkspaceContinuity,
    extra.mariWorkspaceContinuity,
    "the returned extra is stored",
  );
  const returnedText = JSON.stringify(returned);
  for (const old of [original.url, original.filename, original.id]) assert.ok(!returnedText.includes(old), old);
  assert.equal(
    (await chats.getMessage(rpMessage.id))!.content,
    `![copy](${original.url})`,
    "a message in another chat is untouched",
  );

  // 4. Refusals: another chat's message, messageId without chatId, an unknown asset.
  const refuse = async (payload: Record<string, unknown>, assetId = result.asset.id) =>
    app.inject({ method: "POST", url: `/api/gallery/mari-images/assets/${assetId}/regenerate`, payload });
  assert.equal((await refuse({ prompt: "x", chatId: rpChat.id, messageId: rpMessage.id })).statusCode, 404);
  assert.equal((await refuse({ prompt: "x", messageId: reply.id })).statusCode, 400);
  assert.equal((await refuse({ prompt: "x" }, "not-an-asset")).statusCode, 404);
  // A Mari chat id with another chat's message swaps nothing.
  const crossChat = await refuse({ prompt: "x", chatId: mariChat.id, messageId: rpMessage.id });
  assert.equal(crossChat.statusCode, 200, crossChat.body);
  assert.deepEqual((crossChat.json() as { replacedMessageIds: string[] }).replacedMessageIds, []);
  assert.equal((await chats.getMessage(rpMessage.id))!.content, `![copy](${original.url})`);
  // Without a message the lightbox still gets the new picture.
  assert.equal((await refuse({ prompt: "a quiet library at dawn" })).statusCode, 200);
  assert.equal(sent.at(-1)?.negative_prompt, "text, blurry", "a request without a negative prompt keeps the saved one");

  // 5. Revise with guidance answers only for her chat and her assets (the model call itself is the RP route's code).
  const revise = (payload: Record<string, unknown>, assetId = original.id) =>
    app.inject({ method: "POST", url: `/api/gallery/mari-images/assets/${assetId}/regenerate/prompt`, payload });
  const draft = { prompt: "a library", negativePrompt: "", characterPrompts: [] };
  assert.equal((await revise({ ...draft, chatId: rpChat.id })).statusCode, 404, "not Mari's chat");
  assert.equal((await revise({ ...draft, chatId: mariChat.id }, "not-an-asset")).statusCode, 404);

  // 6. Edited images: an edit from an asset reruns as an edit; one from a pasted picture can't be regenerated.
  const edited = await images("edit", "--source", original.id, "--prompt", "add rain on the windows");
  assert.equal(edited.sourceImage, `asset:${original.id}`);
  assert.equal(
    (
      (await app.inject(`/api/gallery/mari-images/assets/${edited.id}`)).json() as {
        regenerable: boolean;
      }
    ).regenerable,
    true,
  );
  sent.length = 0;
  const reEdited = await refuse({ prompt: "add snow on the windows" }, edited.id);
  assert.equal(reEdited.statusCode, 200, reEdited.body);
  assert.equal((reEdited.json() as { asset: Asset }).asset.operation, "edit", "an edit reruns as an edit");
  assert.ok(sent.at(-1)?.url?.includes("img2img"), `the edit goes to img2img: ${sent.at(-1)?.url}`);

  const pasted = await images(
    "edit",
    "--source",
    `data:image/png;base64,${PNG.toString("base64")}`,
    "--prompt",
    "make it blue",
  );
  const pastedRecord = (await app.inject(`/api/gallery/mari-images/assets/${pasted.id}`)).json() as {
    regenerable: boolean;
  };
  assert.equal(pastedRecord.regenerable, false, "a pasted source can't be read again");
  assert.equal((await refuse({ prompt: "make it red" }, pasted.id)).statusCode, 502);

  // Source labels only ever map to app URLs or asset ids, never a path on disk.
  assert.equal(mariSourceReference("avatar:a b.png"), "/api/avatars/file/a%20b.png");
  assert.equal(mariSourceReference("gallery:chat-1/x.png"), "/api/gallery/file/chat-1/x.png");
  assert.equal(mariSourceReference("sprite:owner/happy.png"), "/api/sprites/owner/file/happy.png");
  for (const label of ["data-url", "base64", "C:\\Users\\me\\cat.png", "/etc/passwd", "gallery:no-file", "", null])
    assert.equal(mariSourceReference(label), null, `${label} is not re-readable`);

  // 7. Native NovelAI img2img, infill, seed recovery and 400 validations on Mari preview assets.
  const sharp = await getSharp();
  assert.ok(sharp);
  const naiCanvas = await sharp({
    create: { width: 512, height: 512, channels: 3, background: { r: 30, g: 60, b: 90 } },
  })
    .png()
    .toBuffer();
  const naiMask = await sharp({
    create: { width: 512, height: 512, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  const novelAiConn = (await createConnectionsStorage(db).create(
    createConnectionSchema.parse({
      name: "Native NovelAI",
      provider: "image_generation",
      baseUrl: "https://image.novelai.net",
      model: "nai-diffusion-5-full",
      imageService: "novelai",
      apiKey: "fixture",
    }),
  ))!;

  const mariNaiRequests: Array<Record<string, unknown>> = [];
  const realFetch = globalThis.fetch;
  const dnsMock = mock.method(dns, "lookup", async (hostname: string) => {
    assert.equal(hostname, "image.novelai.net");
    return [{ address: "8.8.8.8", family: 4 }];
  });
  const fetchMock = mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://image.novelai.net") {
      mariNaiRequests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(new Uint8Array(naiCanvas), { status: 200, headers: { "content-type": "image/png" } });
    }
    return realFetch(input, init);
  });

  try {
    const naiOriginal = await images(
      "generate",
      "--connection",
      novelAiConn.id,
      "--width",
      "512",
      "--height",
      "512",
      "--prompt",
      "1girl, portrait",
    );
    const naiRecordRes = await app.inject(`/api/gallery/mari-images/assets/${naiOriginal.id}`);
    assert.equal(naiRecordRes.statusCode, 200, naiRecordRes.body);
    const loadedSeed = (naiRecordRes.json() as { asset: Asset & { seed?: number } }).asset.seed;
    assert.equal(typeof loadedSeed, "number", "GET /mari-images/assets/:assetId exposes asset seed");

    // 400 validation errors: non-NovelAI connection, stray mask, non-NovelAI reuseSeed, and missing mask on infill.
    assert.equal(
      (await refuse({ prompt: "edit", editMode: "img2img", connectionId: connection.id }, naiOriginal.id)).statusCode,
      400,
    );
    assert.equal((await refuse({ prompt: "inpaint", editMode: "infill" }, naiOriginal.id)).statusCode, 400);
    assert.equal(
      (
        await refuse(
          {
            prompt: "stray mask",
            editMode: "img2img",
            maskImage: `data:image/png;base64,${naiMask.toString("base64")}`,
          },
          naiOriginal.id,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (await refuse({ prompt: "seed", reuseSeed: true, connectionId: connection.id }, naiOriginal.id)).statusCode,
      400,
    );

    // img2img with reuseSeed reuses original seed and creates iterative asset:<id> source.
    const mariImg2Img = await refuse(
      { prompt: "1girl, blue eyes", editMode: "img2img", strength: 0.7, noise: 0.05, reuseSeed: true },
      naiOriginal.id,
    );
    assert.equal(mariImg2Img.statusCode, 200, mariImg2Img.body);
    assert.equal(mariNaiRequests[1]?.action, "img2img");
    assert.equal((mariNaiRequests[1]?.parameters as Record<string, unknown>).seed, loadedSeed);
    const img2imgAsset = (mariImg2Img.json() as { asset: Asset & { seed?: number }; regenerable: boolean }).asset;
    assert.equal(img2imgAsset.operation, "edit");
    assert.equal(img2imgAsset.sourceImage, `asset:${naiOriginal.id}`);
    assert.equal(img2imgAsset.seed, loadedSeed);

    // infill on edited preview asset works iteratively and switches model to -inpainting.
    const mariInfill = await refuse(
      {
        prompt: "1girl, sunglasses",
        editMode: "infill",
        maskImage: `data:image/png;base64,${naiMask.toString("base64")}`,
        strength: 0.9,
      },
      img2imgAsset.id,
    );
    assert.equal(mariInfill.statusCode, 200, mariInfill.body);
    assert.equal(mariNaiRequests[2]?.action, "infill");
    assert.equal(mariNaiRequests[2]?.model, "nai-diffusion-5-full-inpainting");

    // Plain Regenerate on a native-edited preview asset reruns as clean generation, not legacy reference edit.
    const mariPlainRegen = await refuse({ prompt: "1girl, sunrise" }, img2imgAsset.id);
    assert.equal(mariPlainRegen.statusCode, 200, mariPlainRegen.body);
    const plainAsset = (mariPlainRegen.json() as { asset: Asset }).asset;
    assert.equal(plainAsset.operation, "generate");
    assert.equal(plainAsset.sourceImage, null);
    assert.equal(mariNaiRequests[3]?.action, "generate");
  } finally {
    fetchMock.mock.restore();
    dnsMock.mock.restore();
  }

  console.log("Mari image lightbox regression passed.");
} finally {
  await app.close();
  await db._fileStore?.close?.();
  imageServer.close();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
}

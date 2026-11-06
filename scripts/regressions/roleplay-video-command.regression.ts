// Roleplay /video and the Gallery's clip paths, through the real routes with a fake text model, image service and
// ComfyUI: the motion director reads as many recent messages as Illustrator does (its Agent Budget context size),
// ending at the picture's reply when it animates a picture; /video makes a clip of the latest reply (or of a
// description) under the newest reply, following First frame, and its Avatar first frame starts from whoever the
// description names.
import assert from "node:assert/strict";
import { startRoleplayVideoHarness } from "./fixtures/roleplay-video-harness.js";

const h = await startRoleplayVideoHarness("roleplay-video-command");
const { replies, requests, png } = h;

try {
  const lastDirector = () => requests.director.at(-1) ?? "";

  // ── Animating a picture: the director reads Illustrator's recent messages, ending at the picture ──
  const roleplay = await h.createRoleplay("Roleplay");
  await h.saveChatSettings(roleplay.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    illustratorUseAvatarReferences: false,
    illustratorIncludeCharacterAppearance: false,
    illustratorRunInterval: 1,
    sceneVideoConnectionId: h.video.id,
    automaticSummaryEnabled: false,
  });
  replies.main = "Aster looks back.";
  await h.generate(roleplay.id, "Aster turns around.");
  replies.agent = { shouldGenerate: true, prompt: "1girl, window, rain" };
  replies.main = "Aster smiles.";
  await h.generate(roleplay.id, "Aster rests.");
  replies.agent = { shouldGenerate: false };
  replies.main = "Aster sings.";
  await h.generate(roleplay.id, "Aster hums.");
  const pictured = (await h.attachments(roleplay.id, "image")).map((attachment) => attachment.galleryId);
  assert.equal(pictured.length, 1, "Illustrator drew one picture");
  const animate = async () => {
    const response = await h.app.inject({
      method: "POST",
      url: "/api/gallery/generate-scene-video",
      payload: { chatId: roleplay.id, galleryImageId: pictured[0] },
    });
    assert.equal(response.statusCode, 200, response.body);
  };
  await animate();
  assert.match(lastDirector(), /Aster rests\.[\s\S]*Aster smiles\./u, "the picture's exchange");
  assert.match(
    lastDirector(),
    /supplied reference image is the exact first frame/u,
    "animating keeps the picture director",
  );
  assert.doesNotMatch(lastDirector(), /Aster hums\./u, "nothing after the picture");
  assert.doesNotMatch(lastDirector(), /Aster turns around\./u, "nothing older than the context size (2)");
  await h.setIllustratorContext(4);
  await animate();
  assert.match(lastDirector(), /Aster turns around\./u, "a wider context size reaches further back");
  assert.doesNotMatch(lastDirector(), /Aster hums\./u, "still nothing after the picture");
  assert.equal(h.lastComfyInputs()?.image, png.toString("base64"), "the picked picture is the first frame");
  await h.setIllustratorContext(2);

  // ── Roleplay /video: a clip of the latest reply, or of what the user describes, under the newest reply ──
  const { james, bram, personaPng, bramPng } = await h.addPersonaAndBram();
  const pair = await h.createRoleplay("Pair", { characterIds: [bram.id], personaId: james.id });
  await h.saveChatSettings(pair.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    illustratorRunInterval: 100,
    sceneVideoConnectionId: h.video.id,
    sceneVideoFirstFrame: "prompt_only",
    automaticSummaryEnabled: false,
  });
  replies.main = "Bram ducks.";
  await h.generate(pair.id, "James throws a beaker.");
  replies.main = "Bram laughs.";
  await h.generate(pair.id, "Once more.");
  const roleplayVideo = (chatId: string, description?: string) =>
    h.app.inject({
      method: "POST",
      url: `/api/gallery/${chatId}/roleplay-video`,
      payload: description ? { description } : {},
    });
  const pairReply = (await h.chats.listMessages(pair.id)).filter((message) => message.role === "assistant").at(-1);
  const slashClip = await roleplayVideo(pair.id, "Bottles explode off the shelf");
  assert.equal(slashClip.statusCode, 200, slashClip.body);
  assert.equal((slashClip.json() as { messageId: string }).messageId, pairReply?.id, "under the newest reply");
  assert.match(lastDirector(), /Requested clip: Bottles explode off the shelf/u);
  // Room for a model that thinks first; running out says so instead of "an empty direction".
  assert.ok((requests.directorMaxTokens.at(-1) ?? 0) >= 8_000, "the director has room to think");
  replies.director = { content: "", finishReason: "length" };
  const outOfBudget = await roleplayVideo(pair.id, "Bottles explode off the shelf");
  assert.equal(outOfBudget.statusCode, 502);
  assert.match(outOfBudget.body, /used its whole response budget/u);
  // The clip belongs to the whole chat, so it is listed in the persona's gallery too.
  const slashVideoId = (slashClip.json() as { video: { id: string } }).video.id;
  const personaGallery = await h.app.inject({
    method: "GET",
    url: `/api/characters/personas/${james.id}/gallery/clips`,
  });
  assert.equal(personaGallery.statusCode, 200, personaGallery.body);
  assert.match(personaGallery.body, new RegExp(`"scene:${slashVideoId}"`, "u"), "in the persona's gallery");
  // No picture shows this moment, so the director describes the scene instead of continuing an image.
  // A clip that names only Bram is filed under Bram, not in the persona's gallery.
  replies.director = {
    content: JSON.stringify({ narrationBeat: "Bram ducks behind the bench" }),
    finishReason: "stop",
  };
  const bramOnly = await roleplayVideo(pair.id, "Bram ducks");
  assert.equal(bramOnly.statusCode, 200, bramOnly.body);
  const bramOnlyId = (bramOnly.json() as { video: { id: string } }).video.id;
  const personaClipsAfter = await h.app.inject({
    method: "GET",
    url: `/api/characters/personas/${james.id}/gallery/clips`,
  });
  assert.doesNotMatch(personaClipsAfter.body, new RegExp(`"scene:${bramOnlyId}"`, "u"), "not shown, not filed");
  const bramClips = await h.app.inject({ method: "GET", url: `/api/characters/${bram.id}/gallery/clips` });
  assert.match(bramClips.body, new RegExp(`"scene:${bramOnlyId}"`, "u"), "filed under the one it shows");
  assert.match(lastDirector(), /No picture of this moment exists/u, "the no-picture director writes the clip");
  assert.doesNotMatch(lastDirector(), /reference image|first frame/iu);
  // It reads as many recent messages as Illustrator does (its context size, 2 here), the latest reply last.
  assert.match(lastDirector(), /Once more\.[\s\S]*Bram laughs\./u);
  assert.doesNotMatch(lastDirector(), /James throws a beaker\./u);
  await h.setIllustratorContext(6);
  assert.equal((await roleplayVideo(pair.id, "Bottles explode off the shelf")).statusCode, 200);
  assert.match(lastDirector(), /James throws a beaker\./u, "a wider context size reaches further back");
  assert.match(h.lastComfyInputs()?.text ?? "", /Bottles burst across the lab floor/u);
  assert.notEqual(h.lastComfyInputs()?.image, bramPng.toString("base64"), "Prompt only sends no picture");
  assert.equal((await h.attachments(pair.id, "video")).length, 3, "two clips, plus the one filed under Bram");

  // Avatar first frame: whoever the description names first, the persona included, else the chat's character.
  await h.saveChatSettings(pair.id, { sceneVideoFirstFrame: "avatar" });
  assert.equal((await roleplayVideo(pair.id)).statusCode, 200);
  assert.equal(h.lastComfyInputs()?.image, bramPng.toString("base64"), "no names: the chat's character");
  assert.equal((await roleplayVideo(pair.id, "James slams the door while Bram flinches")).statusCode, 200);
  assert.equal(h.lastComfyInputs()?.image, personaPng.toString("base64"), "the persona, named first");
  assert.equal((await roleplayVideo(pair.id, "Bram hides behind James")).statusCode, 200);
  assert.equal(h.lastComfyInputs()?.image, bramPng.toString("base64"), "the character, named first");
  // Names match whole words only: "brambles" doesn't name Bram, so James is the first one named.
  assert.equal((await roleplayVideo(pair.id, "The brambles part as James steps through")).statusCode, 200);
  assert.equal(h.lastComfyInputs()?.image, personaPng.toString("base64"), "a name inside a word doesn't count");
  // A unique, capitalised part of a longer name counts too, as in Conversation clips: "Bram" for "Captain Bram Holloway".
  await h.characters.update(bram.id, { name: "Captain Bram Holloway" }, undefined, { skipVersionSnapshot: true });
  assert.equal((await roleplayVideo(pair.id, "Bram hides behind James")).statusCode, 200);
  assert.equal(h.lastComfyInputs()?.image, bramPng.toString("base64"), "a short name finds its card's avatar");
  await h.characters.update(bram.id, { name: "Bram" }, undefined, { skipVersionSnapshot: true });

  // Prompt review: a preview returns the written prompt and makes no clip; the reviewed prompt is the one sent.
  const clipsBefore = requests.comfy.length;
  const preview = await h.app.inject({
    method: "POST",
    url: `/api/gallery/${pair.id}/roleplay-video`,
    payload: { description: "Bottles explode off the shelf", previewOnly: true },
  });
  assert.equal(preview.statusCode, 200, preview.body);
  const previewBody = preview.json() as { prompt?: string; durationSeconds?: number; maxPromptLength?: unknown };
  assert.match(previewBody.prompt ?? "", /Bottles burst across the lab floor/u);
  assert.equal(typeof previewBody.durationSeconds, "number");
  assert.equal(requests.comfy.length, clipsBefore, "a preview makes no clip");
  const reviewed = await h.app.inject({
    method: "POST",
    url: `/api/gallery/${pair.id}/roleplay-video`,
    payload: { promptOverride: "A reviewed shot of Bram ducking" },
  });
  assert.equal(reviewed.statusCode, 200, reviewed.body);
  assert.match(h.lastComfyInputs()?.text ?? "", /^A reviewed shot of Bram ducking/u, "the reviewed prompt is sent");

  // Attach Card Appearance for videos: instructions that speak to appearance give the writer the appearance details to
  // build in, and no lines are added after its prompt; other instructions get the named characters' lines after it.
  await h.saveChatSettings(pair.id, {
    sceneVideoFirstFrame: "prompt_only",
    illustratorVideoIncludeCharacterAppearance: true,
  });
  const setInstructions = async (videoPromptInstructions: string) => {
    const response = await h.app.inject({
      method: "PATCH",
      url: `/api/connections/${h.video.id}`,
      payload: { videoPromptInstructions },
    });
    assert.equal(response.statusCode, 200, response.body);
  };
  await setInstructions("Describe every person from their appearance fields.");
  replies.director = { content: "Bram ducks behind the bench.", finishReason: "stop" };
  assert.equal((await roleplayVideo(pair.id, "Bram ducks")).statusCode, 200);
  assert.match(lastDirector(), /Bram wears a red scarf/u, "the writer gets the appearance details");
  assert.doesNotMatch(h.lastComfyInputs()?.text ?? "", /red scarf/u, "and nothing is added after its prompt");
  await setInstructions("");
  replies.director = { content: "Bram ducks behind the bench.", finishReason: "stop" };
  assert.equal((await roleplayVideo(pair.id, "Bram ducks")).statusCode, 200);
  assert.doesNotMatch(lastDirector(), /Bram wears a red scarf/u);
  assert.match(
    h.lastComfyInputs()?.text ?? "",
    /Bram ducks behind the bench\.[\s\S]*Bram wears a red scarf/u,
    "other instructions get the lines after the prompt",
  );
  await h.saveChatSettings(pair.id, { illustratorVideoIncludeCharacterAppearance: false });

  // A new Illustrator picture is drawn by /illustrate first; the route says so instead of drawing it.
  await h.saveChatSettings(pair.id, { sceneVideoFirstFrame: "picture" });
  assert.deepEqual((await roleplayVideo(pair.id)).json(), { needsPicture: true });
  // The client's picture-first sequence (/video, then a still-only Illustrator retry, then the Gallery's animate) pays
  // for exactly one clip whatever Illustrator makes. Gallery Video runs the same sequence without a description.
  const drawFirstFrame = async (description: string | undefined, stillOnly: boolean) => {
    const response = await h.app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: {
        chatId: pair.id,
        agentTypes: ["illustrator"],
        streaming: false,
        illustratorRetryTargets: ["illustration"],
        ...(stillOnly ? { illustratorStillOnly: true } : {}),
        ...(description
          ? {
              illustratorPromptReviewOverride: {
                prompt: description,
                subjectOnly: true,
                resultData: { prompt: description, characters: [] },
              },
            }
          : {}),
      },
    });
    assert.equal(response.statusCode, 200, response.body);
    // The client animates the picture this run drew, by the Gallery id its illustration event names.
    return response.body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as { type?: string; data?: { galleryId?: string } })
      .find((event) => event.type === "illustration")?.data?.galleryId;
  };
  replies.planner = {
    prompt: "Bram by the bench",
    generateVideo: true,
    videoPrompt: "Bram ducks behind the bench",
  };
  for (const mode of ["pictures", "pictures_and_clips", "clips_only"]) {
    await h.saveChatSettings(pair.id, { illustratorVideoMode: mode });
    for (const description of ["Bram ducks", undefined]) {
      const clipsBefore = requests.comfy.length;
      const picturesBefore = requests.images;
      assert.deepEqual((await roleplayVideo(pair.id, description)).json(), { needsPicture: true });
      const firstFrameId = await drawFirstFrame(description, true);
      assert.equal(requests.comfy.length, clipsBefore, `${mode}: the first frame makes no clip of its own`);
      assert.equal(requests.images, picturesBefore + 1, `${mode}: the first frame is drawn`);
      assert.ok(firstFrameId, `${mode}: the retry names the picture it drew`);
      const animated = await h.app.inject({
        method: "POST",
        url: "/api/gallery/generate-scene-video",
        payload: { chatId: pair.id, galleryImageId: firstFrameId },
      });
      assert.equal(animated.statusCode, 200, animated.body);
      assert.equal(requests.comfy.length, clipsBefore + 1, `${mode}: one /video action, one clip`);
    }
  }
  // Control: the same retry without still-only, as an ordinary Illustrate under Clips only, does make a clip.
  const clipsBeforeControl = requests.comfy.length;
  await drawFirstFrame("Bram ducks", false);
  assert.equal(requests.comfy.length, clipsBeforeControl + 1, "an ordinary Clips only re-run animates its picture");
  const badStillOnly = await h.app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: { chatId: pair.id, agentTypes: ["illustrator"], streaming: false, illustratorStillOnly: "yes" },
  });
  assert.equal(badStillOnly.statusCode, 400, "illustratorStillOnly must be a boolean");
  replies.planner = { prompt: "Aster by the rainy window" };
  // Not a Roleplay chat: refused.
  const convo = await h.chats.create({
    name: "Convo",
    mode: "conversation",
    characterIds: [],
    connectionId: h.text.id,
  });
  assert.ok(convo);
  assert.equal((await roleplayVideo(convo.id)).statusCode, 400);

  console.log("roleplay-video-command regression passed");
} finally {
  await h.close();
}

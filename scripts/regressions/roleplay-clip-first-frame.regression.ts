// Roleplay clips follow the chat's First frame, through the real routes with a fake text model, image service and
// ComfyUI: with Clips only, the avatar or no picture draws no picture at all; Send Avatar References for videos
// lets a Prompt only clip start from the avatar; a clip without a picture is written by the Clip Director and describes everyone it names, the
// user's persona included, and the Avatar first frame starts from whoever is named first, by a short name too.
import assert from "node:assert/strict";
import { startRoleplayVideoHarness } from "./fixtures/roleplay-video-harness.js";

const h = await startRoleplayVideoHarness("roleplay-clip-first-frame");
const { replies, requests, png, avatarPng } = h;

try {
  const roleplay = await h.createRoleplay("Roleplay");
  await h.saveChatSettings(roleplay.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    illustratorUseAvatarReferences: false,
    illustratorIncludeCharacterAppearance: false,
    illustratorRunInterval: 1,
    illustratorVideoRunInterval: 1,
    sceneVideoConnectionId: h.video.id,
    illustratorVideoMode: "clips_only",
    sceneVideoFirstFrame: "prompt_only",
    automaticSummaryEnabled: false,
  });
  const latestReplyImages = async () => {
    const reply = (await h.chats.listMessages(roleplay.id)).filter((message) => message.role === "assistant").at(-1);
    const extra = typeof reply?.extra === "string" ? JSON.parse(reply.extra) : (reply?.extra ?? {});
    return ((extra as { attachments?: Array<{ type?: string }> }).attachments ?? []).filter(
      (attachment) => attachment.type === "image",
    ).length;
  };

  // ── Clips only: no picture is drawn unless the clip starts from one ──
  replies.agent = { shouldGenerate: true, prompt: "1girl, porch, dusk", videoPrompt: "Aster waves slowly" };
  replies.main = "Aster smiles.";
  let clips = 0;
  await h.generate(roleplay.id, "Aster waves.");
  assert.equal(requests.images, 0, "Prompt only draws no picture");
  assert.equal((await h.attachments(roleplay.id, "video")).length, ++clips);
  assert.equal(await latestReplyImages(), 0);
  assert.notEqual(h.lastComfyInputs()?.image, avatarPng.toString("base64"), "Prompt only starts from nothing");
  // No picture shows the moment, so the Clip Director writes the clip from Illustrator's scene and motion.
  const clipRequest = requests.director.at(-1) ?? "";
  assert.match(clipRequest, /No picture of this moment exists/u, "the Clip Director writes it");
  assert.doesNotMatch(clipRequest, /decide the output/u, "with no instructions, the director's own format stands");
  assert.match(clipRequest, /Requested clip: 1girl, porch, dusk\\nAster waves slowly/u, "with the scene and motion");
  assert.equal(h.lastComfyInputs()?.text, "Bottles burst across the lab floor", "its prompt is what is sent");

  // The video connection's instructions decide the format: a multi-line answer in their fields reaches the video
  // model as written, line breaks included, even as plain text instead of JSON.
  const threeFields = [
    "integrated_multimodal_description: [Shot 1] Low light on the porch; Aster waves slowly.",
    "overall_soundscape: Crickets and a creaking swing.",
    "non_diegetic_music: N/A",
  ].join("\n");
  replies.director = { content: threeFields, finishReason: "stop" };
  await h.generate(roleplay.id, "Aster waves once more.");
  assert.equal((await h.attachments(roleplay.id, "video")).length, ++clips);
  assert.equal(h.lastComfyInputs()?.text, threeFields, "the instructed format arrives intact");

  await h.saveChatSettings(roleplay.id, { sceneVideoFirstFrame: "avatar" });
  await h.generate(roleplay.id, "Aster smiles again.");
  assert.equal(requests.images, 0, "Avatar or sprite draws no picture");
  assert.equal((await h.attachments(roleplay.id, "video")).length, ++clips);
  assert.equal(h.lastComfyInputs()?.image, avatarPng.toString("base64"), "the clip starts from the avatar");

  // Send Avatar References for videos: a Prompt only clip starts from the avatar.
  await h.saveChatSettings(roleplay.id, {
    sceneVideoFirstFrame: "prompt_only",
    illustratorVideoUseAvatarReferences: true,
  });
  await h.generate(roleplay.id, "Aster nods.");
  assert.equal((await h.attachments(roleplay.id, "video")).length, ++clips);
  assert.equal(h.lastComfyInputs()?.image, avatarPng.toString("base64"));

  // New Illustrator picture: the picture is drawn, used as the first frame, and not shown.
  await h.saveChatSettings(roleplay.id, {
    sceneVideoFirstFrame: "picture",
    illustratorVideoUseAvatarReferences: false,
  });
  await h.generate(roleplay.id, "Show the porch.");
  assert.equal(requests.images, 1, "the first frame is drawn");
  assert.equal((await h.attachments(roleplay.id, "video")).length, ++clips);
  assert.equal(await latestReplyImages(), 0, "the picture is only the clip's first frame");
  assert.equal(h.lastComfyInputs()?.image, png.toString("base64"));

  // Clips only without a working video connection (here one that is not a video service) makes pictures, as the
  // agent was told, instead of failing every turn.
  await h.saveChatSettings(roleplay.id, { sceneVideoConnectionId: h.text.id, sceneVideoFirstFrame: "prompt_only" });
  const imagesBefore = requests.images;
  const noVideoBody = await h.generate(roleplay.id, "Show the porch again.");
  assert.equal(requests.images, imagesBefore + 1, "the picture is drawn");
  assert.equal(await latestReplyImages(), 1, "and shown in the reply");
  assert.equal((await h.attachments(roleplay.id, "video")).length, clips, "no clip");
  assert.doesNotMatch(noVideoBody, /video_error/u, "no video error");
  await h.saveChatSettings(roleplay.id, { sceneVideoConnectionId: h.video.id });

  // Inside the Video Run Interval, Clips only doesn't run Illustrator on its own at all (the interval paces it), and a
  // storyteller's [illustrate] gets its picture instead of a clip.
  const commanded = await h.createRoleplay("Commanded clip");
  await h.saveChatSettings(commanded.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    illustratorRunInterval: 1,
    illustratorVideoRunInterval: 100,
    sceneVideoConnectionId: h.video.id,
    illustratorVideoMode: "clips_only",
    sceneVideoFirstFrame: "prompt_only",
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { illustrate: true },
    automaticSummaryEnabled: false,
  });
  replies.agent = { shouldGenerate: true, prompt: "1girl, porch, dusk", videoPrompt: "Aster waves slowly" };
  replies.main = "Aster smiles.";
  await h.generate(commanded.id, "Hello, Aster.");
  const commandedClips = (await h.attachments(commanded.id, "video")).length;
  assert.equal(commandedClips, 1, "the first automatic clip starts the interval");
  const skippedBody = await h.generate(commanded.id, "Again?");
  assert.equal((await h.attachments(commanded.id, "video")).length, commandedClips, "inside the interval: no clip");
  assert.doesNotMatch(skippedBody, /"type":"video","data"/u);
  const intervalAnchor = async () => {
    const raw = (await h.chats.getById(commanded.id))?.metadata;
    return ((typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>).lastAutomaticVideoMessageId;
  };
  const anchorBefore = await intervalAnchor();
  const imagesBeforeCommand = requests.images;
  replies.main = '[illustrate: subject="Aster waves from the porch" characters="Aster"] Aster waves.';
  await h.generate(commanded.id, "Show me!");
  // The model writes [illustrate] itself, so its clip waits for the Video Run Interval too, and shows its picture.
  assert.equal((await h.attachments(commanded.id, "video")).length, commandedClips, "no clip inside the interval");
  assert.equal(requests.images, imagesBeforeCommand + 1, "the requested picture is drawn instead");
  assert.equal(await intervalAnchor(), anchorBefore, "a refused clip leaves the interval where it was");
  // Once the interval has passed, [illustrate] makes its clip and the interval counts from it.
  await h.saveChatSettings(commanded.id, { illustratorVideoRunInterval: 1 });
  const automaticAgent = replies.agent;
  replies.agent = { shouldGenerate: false };
  await h.generate(commanded.id, "Show me again!");
  replies.agent = automaticAgent;
  assert.equal((await h.attachments(commanded.id, "video")).length, commandedClips + 1, "[illustrate] makes its clip");
  assert.notEqual(await intervalAnchor(), anchorBefore, "and the interval counts from it");

  // ── Re-running Illustrator on a reply (the Illustrate button) follows Illustrator makes and First frame too ──
  const rerun = async () => {
    const response = await h.app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: { chatId: roleplay.id, agentTypes: ["illustrator"], illustratorRetryTargets: ["illustration"] },
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.body;
  };
  // Clips only, Prompt only: no picture is drawn; the clip is made from the planner's scene.
  const imagesBeforeRerun = requests.images;
  const rerunBody = await rerun();
  assert.match(requests.planner.at(-1) ?? "", /<optional_video>/u, "the Illustrate planner is offered clips");
  assert.equal(requests.images, imagesBeforeRerun, "a Clips only re-run draws no picture");
  assert.equal((await h.attachments(roleplay.id, "video")).length, ++clips, "it makes a clip on the reply");
  assert.match(rerunBody, /"type":"video"/u);
  // Pictures and clips: the picture shows, and the clip the writer asked for joins the same reply.
  await h.saveChatSettings(roleplay.id, { illustratorVideoMode: "pictures_and_clips" });
  const plannerBefore = replies.planner;
  replies.planner = {
    prompt: "1girl, porch, storm",
    generateVideo: true,
    videoPrompt: "Lightning splits the sky as Aster turns",
  };
  const shownBefore = await latestReplyImages();
  await rerun();
  assert.equal(requests.images, imagesBeforeRerun + 1, "the picture is drawn");
  assert.equal(await latestReplyImages(), shownBefore + 1, "and shown");
  assert.equal((await h.attachments(roleplay.id, "video")).length, ++clips, "with its clip");
  // First frame is Prompt only here, so the clip is written by the Clip Director from the planner's scene and motion.
  assert.match(requests.director.at(-1) ?? "", /Lightning splits the sky/u, "moving as the planner wrote");
  // Without a clip asked for, Pictures and clips re-runs make the picture only.
  replies.planner = plannerBefore;
  await rerun();
  assert.equal((await h.attachments(roleplay.id, "video")).length, clips, "no clip");
  await h.saveChatSettings(roleplay.id, { illustratorVideoMode: "clips_only" });

  // ── Pictures and clips: a picture Illustrator animates keeps showing; its clip follows First frame ──
  await h.saveChatSettings(roleplay.id, { illustratorVideoMode: "pictures_and_clips", sceneVideoFirstFrame: "avatar" });
  replies.agent = {
    shouldGenerate: true,
    prompt: "1girl, porch, rain",
    generateVideo: true,
    videoPrompt: "Rain falls",
  };
  await h.generate(roleplay.id, "It starts to rain.");
  assert.equal(await latestReplyImages(), 1, "the picture shows");
  assert.equal((await h.attachments(roleplay.id, "video")).length, ++clips);
  assert.equal(h.lastComfyInputs()?.image, avatarPng.toString("base64"), "and the clip starts from the avatar");

  // ── A clip with no picture shows everyone it names, the user's persona included ──
  const { james, bram, personaPng, bramPng } = await h.addPersonaAndBram();
  const pair = await h.createRoleplay("Pair", { characterIds: [bram.id], personaId: james.id });
  await h.saveChatSettings(pair.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    illustratorVideoMode: "clips_only",
    illustratorVideoIncludeCharacterAppearance: true,
    illustratorRunInterval: 1,
    illustratorVideoRunInterval: 1,
    sceneVideoConnectionId: h.video.id,
    sceneVideoFirstFrame: "prompt_only",
    automaticSummaryEnabled: false,
  });
  replies.agent = {
    shouldGenerate: true,
    prompt: "James smashes beakers while Bram ducks",
    characters: ["James", "Bram"],
    videoPrompt: "Glass flies",
  };
  await h.generate(pair.id, "James throws a beaker.");
  assert.match(h.lastComfyInputs()?.text ?? "", /James stands 6'3 with dark blue eyes/u, "the persona's look");
  assert.match(h.lastComfyInputs()?.text ?? "", /Bram wears a red scarf/u, "and the character's");
  // Avatar first frame: the first one named, the persona here, then a character when named first.
  await h.saveChatSettings(pair.id, { sceneVideoFirstFrame: "avatar" });
  await h.generate(pair.id, "Again.");
  assert.equal(h.lastComfyInputs()?.image, personaPng.toString("base64"), "the clip starts from the persona's avatar");
  replies.agent = { ...replies.agent, characters: ["Bram", "James"] };
  await h.generate(pair.id, "Once more.");
  assert.equal(h.lastComfyInputs()?.image, bramPng.toString("base64"), "or from the character named first");

  // The Avatar first frame never borrows someone else's face: when the first person named has no picture, the clip
  // gets no avatar (Avatar then fails clearly, and avatar-or-none makes a prompt-only clip).
  const { createRoleplayClipTools } =
    await import("../../packages/server/src/services/video/roleplay-illustrator-clips.js");
  const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
  const cyra = await h.characters.create(characterDataSchema.parse({ name: "Cyra" }));
  assert.ok(cyra);
  const lena = await h.characters.create(characterDataSchema.parse({ name: "Dr. Lena Kowalski" }));
  assert.ok(lena);
  const tools = createRoleplayClipTools({
    db: h.db,
    chat: roleplay,
    chatMeta: {},
    chatId: roleplay.id,
    characterNames: ["Aster", "Cyra"],
    cast: () => ({
      chatCharacters: [
        { id: h.aster.id, name: "Aster", avatarPath: "/api/avatars/file/aster.png" },
        { id: cyra.id, name: "Cyra", avatarPath: null },
        { id: lena.id, name: "Dr. Lena Kowalski", avatarPath: "/api/avatars/file/aster.png" },
      ],
      persona: null,
    }),
    charactersStore: h.characters,
  });
  assert.equal(
    (await tools.resolveClipCast(["Cyra", "Aster"], "Cyra and Aster", true)).avatar,
    null,
    "no stand-in face",
  );
  assert.equal(
    (await tools.resolveClipCast(["Aster"], "Aster", true)).avatar?.base64,
    avatarPng.toString("base64"),
    "the named person's own avatar",
  );
  // The Illustrator often names someone by a short name; the avatar is still found through the card's full name.
  const shortName = await tools.resolveClipCast(["Lena", "Aster"], "Lena and Aster", true);
  assert.equal(shortName.avatar?.name, "Dr. Lena Kowalski", "a short name finds its card's avatar");
  assert.equal(shortName.avatar?.base64, avatarPng.toString("base64"));

  // ── A clip animated from a picture is filed under the people the picture shows, not the whole chat ──
  const duo = await h.createRoleplay("Duo", { characterIds: [h.aster.id, bram.id] });
  await h.saveChatSettings(duo.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    illustratorVideoMode: "pictures_and_clips",
    illustratorRunInterval: 1,
    illustratorVideoRunInterval: 1,
    sceneVideoConnectionId: h.video.id,
    sceneVideoFirstFrame: "picture",
    automaticSummaryEnabled: false,
  });
  replies.agent = {
    shouldGenerate: true,
    prompt: "Aster alone on the porch, rain",
    characters: ["Aster"],
    generateVideo: true,
    videoPrompt: "Rain falls on Aster",
  };
  replies.main = "Aster waits on the porch.";
  await h.generate(duo.id, "It rains.");
  const duoClip = (await h.attachments(duo.id, "video")).at(-1) as { videoId?: string } | undefined;
  assert.ok(duoClip?.videoId, "the picture became a clip");
  const { createGameSceneVideosStorage } =
    await import("../../packages/server/src/services/storage/game-scene-videos.storage.js");
  const duoRow = (await createGameSceneVideosStorage(h.db).getById(duoClip.videoId)) as {
    characterIds?: unknown;
  } | null;
  assert.deepEqual(
    typeof duoRow?.characterIds === "string" ? JSON.parse(duoRow.characterIds) : duoRow?.characterIds,
    [h.aster.id],
    "filed under the one the picture shows, not the whole chat",
  );

  // Stop reaches a clip that has not gone out yet: nothing is sent to the video service.
  const { generateRoleplayClip } = await import("../../packages/server/src/services/video/chat-video-generation.js");
  const stopped = new AbortController();
  stopped.abort();
  const sentBefore = requests.comfy.length;
  await assert.rejects(
    generateRoleplayClip(h.db, {
      chatId: roleplay.id,
      chatMeta: { sceneVideoConnectionId: h.video.id },
      prompt: "Aster waves",
      firstFrame: "none",
      avatar: null,
      signal: stopped.signal,
    }),
    { name: "AbortError" },
  );
  assert.equal(requests.comfy.length, sentBefore, "a stopped clip is never sent");

  console.log("roleplay-clip-first-frame regression passed");
} finally {
  await h.close();
}

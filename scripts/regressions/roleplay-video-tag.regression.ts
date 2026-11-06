// The storyteller's [video] Roleplay Command, through the real routes with a fake text model, image service and
// ComfyUI: [video] parses and is offered only when the command is on and a clip may be made; its clip starts from
// the chat's First frame (no picture, or a new Illustrator picture used only as the first frame); and with
// Pictures and clips, a storyteller's [illustrate] is offered the clip fields and can become a clip.
import assert from "node:assert/strict";
import { startRoleplayVideoHarness } from "./fixtures/roleplay-video-harness.js";

const h = await startRoleplayVideoHarness("roleplay-video-tag");
const { replies, requests, png } = h;
const { parseRoleplayCommands, buildRoleplayCommandsReminder } =
  await import("../../packages/server/src/services/generation/roleplay-commands.js");

try {
  // ── Parsing and offer ──
  const parsed = parseRoleplayCommands(
    'Rain. [video: subject="Aster at the window" motion="She turns slowly" characters="Aster"] Done.',
  );
  assert.deepEqual(parsed.commands, [
    { type: "video", subject: "Aster at the window", motion: "She turns slowly", characters: ["Aster"] },
  ]);
  assert.equal(parseRoleplayCommands('[video: motion="no subject"]').invalid, 1, "a clip needs a subject");
  const reminderMeta = {
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { video: true },
    activeAgentIds: ["illustrator"],
  };
  const reminder = (video: { instructions: string } | null, metadata = reminderMeta) =>
    buildRoleplayCommandsReminder({
      metadata,
      privateAvailable: false,
      availableAgentIds: new Set(["illustrator"]),
      format: "xml",
      characterNames: ["Aster"],
      video,
    });
  assert.match(reminder({ instructions: "" }), /\[video: subject=/u);
  assert.match(
    reminder({ instructions: "" }),
    /Use \[video\] rather than \[illustrate\] when the moment is about motion/u,
  );
  assert.match(reminder({ instructions: "Keep it slow." }), /Keep it slow\./u, "the video connection's instructions");
  assert.doesNotMatch(reminder(null), /\[video:/u, "not offered while no clip may be made");
  assert.doesNotMatch(
    reminder({ instructions: "" }, { ...reminderMeta, roleplayCommandToggles: { video: false } }),
    /\[video:/u,
    "not offered when the command is off",
  );

  // ── [video] end to end ──
  const roleplay = await h.createRoleplay("Roleplay");
  await h.saveChatSettings(roleplay.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { video: true },
    illustratorUseAvatarReferences: false,
    illustratorIncludeCharacterAppearance: false,
    illustratorRunInterval: 1,
    illustratorVideoRunInterval: 1,
    sceneVideoConnectionId: h.video.id,
    sceneVideoFirstFrame: "prompt_only",
    automaticSummaryEnabled: false,
  });
  const command = '[video: subject="Aster at the window" motion="She turns slowly as rain streaks the glass"]';

  // Prompt only: the storyteller is offered [video], and its clip starts from no picture.
  replies.main = `Aster waits. ${command}`;
  await h.generate(roleplay.id, "Aster looks outside.");
  assert.match(requests.reply.at(-1) ?? "", /\[video: subject=/u, "the storyteller is offered [video]");
  assert.equal((await h.attachments(roleplay.id, "video")).length, 1);
  // The Clip Director writes the clip from the storyteller's subject and motion, to the instructions.
  assert.match(requests.director.at(-1) ?? "", /Requested clip: Aster at the window\\nShe turns slowly/u);
  assert.match(requests.director.at(-1) ?? "", /No picture of this moment exists/u);
  assert.equal(h.lastComfyInputs()?.text, "Bottles burst across the lab floor", "the director's prompt is sent");
  assert.notEqual(h.lastComfyInputs()?.image, png.toString("base64"), "prompt only sends no picture");
  assert.equal(requests.images, 0, "no Illustrator picture for a prompt-only clip");

  // New Illustrator picture: Illustrator draws the moment, and that picture is animated with the motion.
  await h.saveChatSettings(roleplay.id, { sceneVideoFirstFrame: "picture" });
  await h.generate(roleplay.id, "Aster turns around.");
  assert.equal(requests.images, 1, "Illustrator drew the first frame");
  assert.equal((await h.attachments(roleplay.id, "image")).length, 0, "the picture is only the clip's first frame");
  assert.equal((await h.attachments(roleplay.id, "video")).length, 2);
  // From a picture, the Gallery animation director writes the storyteller's motion to the instructions.
  assert.match(requests.director.at(-1) ?? "", /Requested clip: She turns slowly as rain streaks the glass/u);
  assert.match(requests.director.at(-1) ?? "", /<first_frame_generation_context>/u);
  assert.equal(h.lastComfyInputs()?.text, "Bottles burst across the lab floor", "the director's prompt is sent");
  assert.equal(h.lastComfyInputs()?.image, png.toString("base64"), "the clip starts from Illustrator's picture");

  // Command off: no offer and no clip.
  await h.saveChatSettings(roleplay.id, { roleplayCommandToggles: { video: false } });
  await h.generate(roleplay.id, "Aster waits.");
  assert.doesNotMatch(requests.reply.at(-1) ?? "", /\[video: subject=/u, "not offered when the command is off");
  assert.equal((await h.attachments(roleplay.id, "video")).length, 2, "no clip when the command is off");

  // ── [illustrate] can become a clip: with Pictures and clips, its planner is offered the clip fields ──
  await h.saveChatSettings(roleplay.id, {
    illustratorVideoMode: "pictures_and_clips",
    roleplayCommandToggles: { illustrate: true, video: true },
  });
  replies.planner = {
    prompt: "bottles shattering across a dim lab",
    generateVideo: true,
    videoPrompt: "Bottles shatter and spin through the air",
  };
  replies.main = 'Glass everywhere. [illustrate: subject="bottles flying off the counter"]';
  await h.generate(roleplay.id, "James throws the bottles.");
  assert.match(requests.planner.at(-1) ?? "", /<optional_video>/u, "the planner is offered a clip");
  assert.equal((await h.attachments(roleplay.id, "video")).length, 3, "[illustrate] became a clip");
  assert.match(h.lastComfyInputs()?.text ?? "", /Bottles shatter and spin through the air/u);
  assert.equal(h.lastComfyInputs()?.image, png.toString("base64"), "it animates the shown picture");
  // With Pictures only, the planner is not offered a clip.
  await h.saveChatSettings(roleplay.id, { illustratorVideoMode: "pictures" });
  replies.planner = { prompt: "an empty lab" };
  replies.main = 'Silence. [illustrate: subject="the empty lab"]';
  await h.generate(roleplay.id, "Look around.");
  assert.doesNotMatch(requests.planner.at(-1) ?? "", /<optional_video>/u);
  assert.equal((await h.attachments(roleplay.id, "video")).length, 3);

  // A clip saved but not attached (the reply's stored data breaks meanwhile) still counts as made: no error.
  const unattached = await h.createRoleplay("Unattached");
  await h.saveChatSettings(unattached.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { video: true },
    illustratorVideoRunInterval: 1,
    sceneVideoConnectionId: h.video.id,
    sceneVideoFirstFrame: "prompt_only",
    automaticSummaryEnabled: false,
  });
  const { messageSwipes } = await import("../../packages/server/src/db/schema/index.js");
  const { eq } = await import("../../packages/server/src/db/file-query.js");
  h.hooks.beforeVideo = async () => {
    const latest = (await h.chats.listMessages(unattached.id)).filter((message) => message.role === "assistant").at(-1);
    assert.ok(latest);
    await h.db.update(messageSwipes).set({ extra: "{not json" }).where(eq(messageSwipes.messageId, latest.id));
  };
  replies.main = `Aster waits. ${command}`;
  const unattachedStream = await h.generate(unattached.id, "Aster looks outside.");
  assert.equal(h.hooks.beforeVideo, null, "the clip reached the video service");
  assert.match(unattachedStream, /"type":"video_started"/u, "the stream tells the client a clip is coming");
  assert.match(unattachedStream, /"type":"video"/u, "the saved clip is reported as made");
  assert.match(unattachedStream, /"messageId":null/u, "reported as not attached");
  assert.match(unattachedStream, /"videoId":"[^"]+"/u, "with the saved clip's id");
  assert.doesNotMatch(unattachedStream, /video_error/u);

  // The reply deleted while its clip is made: still made, reported with no message.
  h.hooks.beforeVideo = async () => {
    const latest = (await h.chats.listMessages(unattached.id)).filter((message) => message.role === "assistant").at(-1);
    assert.ok(latest);
    await h.chats.removeMessage(latest.id);
  };
  const deletedStream = await h.generate(unattached.id, "Aster looks again.");
  assert.equal(h.hooks.beforeVideo, null, "the clip reached the video service");
  assert.match(deletedStream, /"type":"video","data":\{"messageId":null/u, "no message to show the clip on");
  assert.doesNotMatch(deletedStream, /video_error/u);

  console.log("roleplay-video-tag regression passed");
} finally {
  await h.close();
}

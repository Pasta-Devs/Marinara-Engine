// "Next image in this chat": the summary names the model, writer, style and references the generators really use.
import assert from "node:assert/strict";
import {
  resolveChatImagePlan,
  type ImagePlanConnection,
} from "../../../packages/server/src/services/image/chat-image-plan.js";

const comfyWorkflow = JSON.stringify({
  "10": { class_type: "LoadImage", inputs: { image: "%reference_image_name_01%" } },
  "11": { class_type: "LoadImage", inputs: { image: "%reference_image_name_02%" } },
});
const rows: Record<string, ImagePlanConnection> = {
  "images-default": {
    id: "images-default",
    name: "NovelAI V4.5",
    model: "nai-diffusion-4-5-full",
    provider: "image_generation",
  },
  "images-fallback": {
    id: "images-fallback",
    name: "Flux Schnell",
    model: "flux-schnell",
    provider: "image_generation",
  },
  "setup-image": {
    id: "setup-image",
    name: "Flux Dev",
    model: "flux-dev",
    provider: "image_generation",
    imageService: "comfyui",
    baseUrl: "http://127.0.0.1:8188",
    comfyuiWorkflow: comfyWorkflow,
    defaultParameters: { imageGeneration: { styleProfileId: "anime" } },
  },
  "chat-image": { id: "chat-image", name: "GPT Image", model: "gpt-image-1", provider: "image_generation" },
  "chat-text": { id: "chat-text", name: "Claude Sonnet", model: "claude-sonnet", provider: "anthropic" },
  "illustrator-text": { id: "illustrator-text", name: "Gemini Flash", model: "gemini-flash", provider: "google" },
  main: { id: "main", name: "Main model", model: "main-model", provider: "openai" },
};
const connections = {
  getUsable: async (id: string) => rows[id] ?? null,
  getDefaultForImageGeneration: async () => rows["images-default"]!,
  getFallbackForImageGeneration: async () => rows["images-fallback"]!,
  getDefault: async () => rows.main!,
};
const styleProfiles = {
  defaultProfileId: "realistic",
  profiles: [
    { id: "anime", name: "Anime" },
    { id: "realistic", name: "Realistic" },
  ],
} as never;
const plan = (overrides: Partial<Parameters<typeof resolveChatImagePlan>[0]>) =>
  resolveChatImagePlan({
    chatMode: "roleplay",
    chatMetadata: {},
    chatConnectionId: "chat-text",
    illustrator: { connectionId: null, settings: {} },
    connections,
    styleProfiles,
    ...overrides,
  });

// Nothing picked anywhere: the Images default draws, its fallback stands by, the chat's own model writes.
{
  const result = await plan({});
  assert.equal(result.imageModel?.id, "images-default");
  assert.equal(result.imageModel?.source, "imagesDefault");
  assert.equal(result.fallback?.id, "images-fallback");
  // The Illustrator writes with the chat's model, not the Agents default (agent-resolution's Illustrator rule).
  assert.equal(result.promptWriter?.id, "chat-text");
  assert.equal(result.promptWriter?.source, "chatModel");
  assert.equal(result.style.source, "styleDefault");
  assert.equal(result.references.on, false);
}

// The Illustrator setup's own models answer before the defaults, and the image model's own style beats the default.
{
  const result = await plan({
    illustrator: {
      connectionId: "illustrator-text",
      settings: { imageConnectionId: "setup-image", useAvatarReferences: true },
    },
  });
  assert.equal(result.imageModel?.id, "setup-image");
  assert.equal(result.imageModel?.source, "illustratorSetup");
  assert.equal(result.promptWriter?.source, "illustratorModel");
  assert.deepEqual(result.style, { id: "anime", name: "Anime", source: "modelStyle" });
  assert.equal(result.references.on, true);
  assert.equal(result.references.source, "illustratorSetup");
  assert.deepEqual(result.references.workflowSlots, [1, 2]);
}

// The chat's picks win; a chat pick that cannot answer falls to the Images default and is reported.
{
  const result = await plan({
    chatMetadata: {
      illustratorImageConnectionId: "chat-image",
      illustratorPromptConnectionId: "illustrator-text",
      imageStyleProfileId: "realistic",
    },
    illustrator: { connectionId: null, settings: { imageConnectionId: "setup-image" } },
  });
  assert.equal(result.imageModel?.source, "chat");
  assert.equal(result.promptWriter?.source, "chat");
  assert.equal(result.style.source, "chat");
  const missing = await plan({ chatMetadata: { illustratorImageConnectionId: "deleted" } });
  assert.equal(missing.imageModel?.id, "images-default");
  assert.equal(missing.imageModelSkipped, "chat");
  const missingWriter = await plan({ chatMetadata: { illustratorPromptConnectionId: "deleted" } });
  assert.equal(missingWriter.promptWriter, null, "a Prompt Model that cannot answer stops the Illustrator");
  assert.equal(missingWriter.promptWriterSkipped, "chat");
}

// Game setup's style wins over everything.
assert.equal(
  (
    await plan({
      chatMetadata: { gameSetupConfig: { imageStyleProfileId: "anime" }, imageStyleProfileId: "realistic" },
    })
  ).style.source,
  "gameSetup",
);

// Conversation selfies: their own model, else the Images default once selfies are on; the writer is the chat's model.
{
  const own = await plan({ chatMode: "conversation", chatMetadata: { imageGenConnectionId: "chat-image" } });
  assert.equal(own.kind, "selfie");
  assert.equal(own.imageModel?.source, "chat");
  const following = await plan({
    chatMode: "conversation",
    chatMetadata: { conversationCommandToggles: { selfie: true } },
    illustrator: { connectionId: "illustrator-text", settings: {} },
  });
  assert.equal(following.imageModel?.id, "images-default");
  assert.equal(following.imageModel?.source, "imagesDefault");
  assert.equal(following.promptWriter?.source, "chatModel", "selfies skip the Illustrator's own model");
  const off = await plan({ chatMode: "conversation", chatMetadata: {} });
  assert.equal(off.imageModel, null);
  const mainWriter = await plan({ chatMode: "conversation", chatConnectionId: null, chatMetadata: {} });
  assert.equal(mainWriter.promptWriter?.source, "main");
}

console.log("chat-image-plan regression passed");

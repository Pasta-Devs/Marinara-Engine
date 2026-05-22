import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveConversationSelfieSystemPrompt } from "../src/services/conversation/selfie-prompt.js";
import type { PromptOverridesStorage } from "../src/services/storage/prompt-overrides.storage.js";

type CapturedMessage = { role: "system" | "user"; content: string };

const EXPECTED_PROMPT_KEY = "conversation.selfie";

function promptOverrideStorage(template: string, enabled = true): PromptOverridesStorage {
  return {
    async get(key) {
      assert.equal(key, EXPECTED_PROMPT_KEY);
      return {
        key,
        template,
        enabled,
        updatedAt: "2026-05-22T00:00:00.000Z",
      };
    },
    async list() {
      return [];
    },
    async upsert(input) {
      return { ...input, updatedAt: "2026-05-22T00:00:00.000Z" };
    },
    async remove() {},
  };
}

async function sendToFakeSelfiePromptBuilder(systemPrompt: string): Promise<{
  capturedMessages: CapturedMessage[];
  content: string;
}> {
  const capturedMessages: CapturedMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Generate a casual selfie based on the current conversation context." },
  ];

  return { capturedMessages, content: "" };
}

test("registered conversation.selfie override is sent as the selfie prompt-builder system message", async () => {
  const systemPrompt = await resolveConversationSelfieSystemPrompt({
    promptOverridesStorage: promptOverrideStorage(
      "GLOBAL SELFIE OVERRIDE for ${charName}: ${appearance}${selfieTagsBlock}",
    ),
    appearance: "silver hair, violet eyes, black jacket",
    charName: "Mira",
    selfieTagsBlock: "\n\nAlways include these tags/modifiers in the prompt: cinematic lighting",
  });

  const fakeResult = await sendToFakeSelfiePromptBuilder(systemPrompt);

  assert.equal(fakeResult.content, "");
  assert.equal(fakeResult.capturedMessages[0]?.role, "system");
  assert.equal(
    fakeResult.capturedMessages[0]?.content,
    "GLOBAL SELFIE OVERRIDE for Mira: silver hair, violet eyes, black jacket\n\nAlways include these tags/modifiers in the prompt: cinematic lighting",
  );
});

test("chat-scoped selfie prompt template still takes priority over the global registered override", async () => {
  const systemPrompt = await resolveConversationSelfieSystemPrompt({
    promptOverridesStorage: promptOverrideStorage("GLOBAL ${charName}"),
    chatPromptTemplate: "CHAT SELFIE OVERRIDE for ${charName}: ${appearance}",
    appearance: "short blue hair",
    charName: "Lyra",
  });

  const fakeResult = await sendToFakeSelfiePromptBuilder(systemPrompt);

  assert.equal(fakeResult.content, "");
  assert.equal(fakeResult.capturedMessages[0]?.content, "CHAT SELFIE OVERRIDE for Lyra: short blue hair");
});

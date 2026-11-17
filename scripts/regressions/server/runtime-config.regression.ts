// Settings read from the environment: the generation timeouts and the custom agent repositories switch. Each check
// puts the variable back afterwards.
import assert from "node:assert/strict";
import {
  DEFAULT_CHAT_GENERATION_TIMEOUT_MS,
  DEFAULT_GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS,
  getChatGenerationTimeoutMs,
  getGameDynamicImagePromptTimeoutMs,
  isCustomAgentRepositoriesEnabled,
} from "../../../packages/server/src/config/runtime-config.js";

const previousGameDynamicImagePromptTimeout = process.env.GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS;
try {
  delete process.env.GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS;
  assert.equal(getGameDynamicImagePromptTimeoutMs(), DEFAULT_GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS);
  process.env.GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS = "90000";
  assert.equal(getGameDynamicImagePromptTimeoutMs(), 90_000);
  process.env.GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS = "999";
  assert.equal(getGameDynamicImagePromptTimeoutMs(), DEFAULT_GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS);
} finally {
  if (previousGameDynamicImagePromptTimeout === undefined) {
    delete process.env.GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS;
  } else {
    process.env.GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS = previousGameDynamicImagePromptTimeout;
  }
}
const originalChatGenerationTimeout = process.env.CHAT_GENERATION_TIMEOUT_MS;
process.env.CHAT_GENERATION_TIMEOUT_MS = "600000";
assert.equal(getChatGenerationTimeoutMs(), 600_000);
process.env.CHAT_GENERATION_TIMEOUT_MS = "0";
assert.equal(getChatGenerationTimeoutMs(), DEFAULT_CHAT_GENERATION_TIMEOUT_MS);
process.env.CHAT_GENERATION_TIMEOUT_MS = "3600001";
assert.equal(getChatGenerationTimeoutMs(), DEFAULT_CHAT_GENERATION_TIMEOUT_MS);
if (originalChatGenerationTimeout === undefined) delete process.env.CHAT_GENERATION_TIMEOUT_MS;
else process.env.CHAT_GENERATION_TIMEOUT_MS = originalChatGenerationTimeout;
const originalCustomRepositoryFlag = process.env.ENABLE_CUSTOM_AGENT_REPOS;
try {
  delete process.env.ENABLE_CUSTOM_AGENT_REPOS;
  assert.equal(isCustomAgentRepositoriesEnabled(), false);
  process.env.ENABLE_CUSTOM_AGENT_REPOS = "true";
  assert.equal(isCustomAgentRepositoriesEnabled(), true);
} finally {
  if (originalCustomRepositoryFlag === undefined) delete process.env.ENABLE_CUSTOM_AGENT_REPOS;
  else process.env.ENABLE_CUSTOM_AGENT_REPOS = originalCustomRepositoryFlag;
}

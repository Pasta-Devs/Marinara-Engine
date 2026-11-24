// The model chooser's family chips and Recent list: which family a model id belongs to once proxy decorations are
// gone, when a list gets chips and in what order, and the recent picks kept on this device (newest first, one line
// per account and model, at most eight, never synced).
import assert from "node:assert/strict";
import { MODEL_FAMILY_LABELS, familyChipsFor, modelFamilyOf } from "../../../packages/client/src/lib/model-families.js";
import { runNamedCases, type RegressionCase } from "../fixtures/named-cases.js";

const families: Array<[string, string]> = [
  // Bracket tags, paths and :tags are decorations, not part of the name.
  ["[SP] claude-sonnet-4-5", "claude"],
  // Gateway decorations and prefixes the shared capability id strips, and a name after a colon.
  ["【限时】o3", "gpt"],
  ["o3(high)", "gpt"],
  ["o3@2025-04-16", "gpt"],
  ["ft:gpt-4o-mini-2024-07-18:my-org::A1b2C3", "gpt"],
  ["groq:llama-3.1-8b", "llama"],
  ["anthropic/claude-sonnet-4:free", "claude"],
  ["[free] [SP] gpt-4o", "gpt"],
  ["anthropic/claude-3.5-sonnet", "claude"],
  ["accounts/fireworks/models/llama-v3p1-405b-instruct", "llama"],
  ["deepseek/deepseek-r1:free", "deepseek"],
  ["llama3.1:8b", "llama"],
  ["  Qwen/QwQ-32B  ", "qwen"],
  // OpenAI's reasoning ids and other spellings.
  ["o1", "gpt"],
  ["o3-mini", "gpt"],
  ["openai/o4-mini-high", "gpt"],
  ["chatgpt-4o-latest", "gpt"],
  ["gpt-oss-120b", "gpt"],
  ["azure-openai-prod", "gpt"],
  // The line that made a fine-tune or distill wins over the base it names.
  ["deepseek-r1-distill-qwen-32b", "deepseek"],
  ["nousresearch/hermes-3-llama-3.1-405b", "hermes"],
  ["nvidia/llama-3.1-nemotron-70b-instruct", "nemotron"],
  ["google/gemma-3-27b-it", "gemma"],
  ["gemini-2.5-pro", "gemini"],
  ["mistralai/devstral-small", "mistral"],
  ["mixtral-8x7b-instruct", "mistral"],
  ["x-ai/grok-4", "grok"],
  ["THUDM/chatglm3-6b", "glm"],
  ["z-ai/glm-4.6", "glm"],
  ["moonshotai/kimi-k2", "kimi"],
  ["moonshot-v1-8k", "kimi"],
  ["minimax/minimax-m1", "minimax"],
  ["cohere/command-r-plus", "command"],
  ["microsoft/phi-4", "phi"],
  ["01-ai/yi-large", "yi"],
  ["step-2-16k", "step"],
  ["ernie-4.0-8k", "ernie"],
  ["doubao-pro-32k", "doubao"],
  ["hunyuan-lite", "hunyuan"],
  // Short names match whole words only: "dolphin" is not Phi, "omni" is not an o-series id.
  ["cognitivecomputations/dolphin-2.9.1", "other"],
  ["omni-moderation-latest", "other"],
  ["vendor/alpha", "other"],
  ["dall-e-3", "other"],
  ["", "other"],
];
const familyCases: RegressionCase[] = families.map(([id, family]) => ({
  name: `${JSON.stringify(id)} is ${family}`,
  run: () => {
    assert.equal(modelFamilyOf(id), family);
    if (family !== "other") assert.ok(MODEL_FAMILY_LABELS[family as keyof typeof MODEL_FAMILY_LABELS], family);
  },
}));

const many = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

// The UI store needs browser storage while Zustand loads its saved state.
const uiStorage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => uiStorage.get(key) ?? null,
    setItem: (key: string, value: string) => uiStorage.set(key, value),
    removeItem: (key: string) => uiStorage.delete(key),
  },
});
const { addRecentModelPick, pickPersistedUIState, pickSyncedSettings, useUIStore } =
  await import("../../../packages/client/src/stores/ui.store.js");
const pick = (accountId: string, model: string) => ({ accountId, model });

await runNamedCases([
  ...familyCases,
  {
    name: "a short list gets no chips, even with several families",
    run: () => assert.deepEqual(familyChipsFor([...many(5, "claude"), ...many(5, "gpt"), ...many(5, "qwen")]), []),
  },
  {
    name: "one named family plus unknown ids has nothing to narrow",
    run: () => assert.deepEqual(familyChipsFor([...many(20, "claude"), ...many(10, "vendor/x")]), []),
  },
  {
    name: "chips list most models first, ties in a fixed order, Other last",
    run: () =>
      assert.deepEqual(
        familyChipsFor([...many(4, "qwen"), ...many(30, "vendor/x"), ...many(12, "claude"), ...many(4, "gemma")]),
        [
          { family: "claude", count: 12 },
          { family: "gemma", count: 4 },
          { family: "qwen", count: 4 },
          { family: "other", count: 30 },
        ],
      ),
  },
  {
    name: "minList sets how long a list must be for chips",
    run: () =>
      assert.deepEqual(familyChipsFor([...many(3, "claude"), ...many(2, "gpt")], { minList: 5 }), [
        { family: "claude", count: 3 },
        { family: "gpt", count: 2 },
      ]),
  },
  {
    name: "recent picks: newest first, one line per account and model, at most eight",
    run: () => {
      const store = useUIStore.getState();
      assert.deepEqual(store.recentModelPicks, [], "a new device has no recent picks");
      store.rememberModelPick(pick("a", "claude"));
      store.rememberModelPick(pick("a", "gpt"));
      store.rememberModelPick(pick("b", "claude"));
      // Picking one again moves it to the front; the same model on another account is its own line.
      store.rememberModelPick(pick("a", "claude"));
      assert.deepEqual(useUIStore.getState().recentModelPicks, [
        pick("a", "claude"),
        pick("b", "claude"),
        pick("a", "gpt"),
      ]);
      for (let index = 0; index < 10; index++) useUIStore.getState().rememberModelPick(pick("c", `model-${index}`));
      const capped = useUIStore.getState().recentModelPicks;
      assert.equal(capped.length, 8, "at most eight recent picks are kept");
      assert.deepEqual(capped[0], pick("c", "model-9"), "the newest pick comes first");
      assert.deepEqual(capped[7], pick("c", "model-2"), "the oldest picks drop off the end");
    },
  },
  {
    name: "recent picks stay in this browser and are never synced",
    run: () => {
      useUIStore.getState().rememberModelPick(pick("d", "kept"));
      const state = useUIStore.getState();
      assert.deepEqual(pickPersistedUIState(state).recentModelPicks, state.recentModelPicks);
      assert.ok(!("recentModelPicks" in pickSyncedSettings(state)), "recent picks stay on this device");
    },
  },
  {
    name: "a damaged saved list loads clean",
    run: () => {
      const merge = useUIStore.persist.getOptions().merge!;
      const loaded = merge(
        { recentModelPicks: [pick("a", "x"), null, { accountId: "a" }, pick("a", "x"), { accountId: 1, model: "y" }] },
        useUIStore.getState(),
      );
      assert.deepEqual(loaded.recentModelPicks, [pick("a", "x")]);
      assert.deepEqual(merge({ recentModelPicks: "nope" }, useUIStore.getState()).recentModelPicks, []);
      assert.deepEqual(addRecentModelPick([], pick("", "x")), [], "a pick without an account is not kept");
    },
  },
  {
    name: "two saved Models that share a model id stay apart by their rows",
    run: () =>
      assert.deepEqual(
        addRecentModelPick(
          [
            { accountId: "a", model: "x", rowId: "row-1" },
            { accountId: "a", model: "x", rowId: 7 },
          ],
          { accountId: "a", model: "x", rowId: "row-2" },
        ),
        [
          { accountId: "a", model: "x", rowId: "row-2" },
          { accountId: "a", model: "x", rowId: "row-1" },
          { accountId: "a", model: "x" },
        ],
      ),
  },
]);

import {
  createNoodlePoll,
  noodleGeneratedPrivatePostSchema,
  type APIProvider,
  type NoodleAccount,
  type NoodlePost,
  type NoodlePrivateGenerationRequest,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveStoredMaxTokens } from "../generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { normalizeNoodleImagePrompt } from "./noodle-image-prompt.js";
import { formatNoodleMessagesForLog } from "./noodle-generation-log.js";
import { noodleResponseFormat } from "./noodle-response-format.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type PrivatePostGenerationInput = {
  request: NoodlePrivateGenerationRequest;
  connection: GenerationConnection;
};

export type PrivatePostGenerationResult =
  | { ok: true; post: NoodlePost }
  | { ok: false; error: "private_account_not_found"; message: string };

const PRIVATE_POST_MAX_TOKENS = 2048;

function formatPrivatePostHistory(posts: NoodlePost[]): string {
  if (posts.length === 0) return "No previous posts on this private page.";
  return posts
    .slice()
    .reverse()
    .map((post) => `- ${post.createdAt}: ${post.content}`)
    .join("\n");
}

export function buildPrivatePostMessages(input: {
  account: Pick<NoodleAccount, "displayName" | "handle" | "bio">;
  recentPosts: NoodlePost[];
  request: Pick<NoodlePrivateGenerationRequest, "privatePostGuide" | "privateProjectWork">;
}): ChatMessage[] {
  const system = [
    "You write exactly one post for one private NoodleR creator page in Marinara Engine.",
    "Write only as the supplied private account. Do not create other accounts, interactions, follows, or public timeline activity.",
    "Use the private profile as supplied. Do not infer or reveal a linked public identity.",
    "An optional imagePrompt must be a concrete visual description for this post, or null when no image fits.",
    "Return one JSON object with content, imagePrompt, and poll. Set poll to null unless a two-to-four-option poll naturally fits.",
    "Return JSON only. No prose outside the JSON object.",
  ].join("\n");
  const user = [
    "# Private account",
    `Display name: ${input.account.displayName}`,
    `Handle: @${input.account.handle}`,
    `Bio: ${input.account.bio || "No bio provided."}`,
    "",
    "# Recent private posts",
    formatPrivatePostHistory(input.recentPosts),
    ...(input.request.privatePostGuide ? ["", "# Post direction", input.request.privatePostGuide] : []),
    ...(input.request.privateProjectWork ? ["", "# Project work direction", input.request.privateProjectWork] : []),
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function parsePrivatePost(content: string) {
  return noodleGeneratedPrivatePostSchema.parse(parseGameJsonish(content));
}

export async function generatePrivatePost(
  db: DB,
  input: PrivatePostGenerationInput,
): Promise<PrivatePostGenerationResult> {
  const noodle = createNoodleStorage(db);
  const account = await noodle.getPrivateAccountById(input.request.targetAccountId);
  if (!account) {
    return {
      ok: false,
      error: "private_account_not_found",
      message: "NoodleR account not found.",
    };
  }

  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = withConnectionFallbackProvider({
    primary: createLLMProvider(
      input.connection.provider,
      resolveBaseUrl(input.connection),
      input.connection.apiKey,
      input.connection.maxContext,
      input.connection.openrouterProvider,
      input.connection.maxTokensOverride,
      input.connection.claudeFastMode === "true",
      input.connection.treatAsLocalEndpoint === "true",
      input.connection.defaultParameters,
    ),
    primaryConnectionId: input.connection.id,
    fallbackConnection,
    fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
    category: "main",
  });
  const recentPosts = await noodle.listPrivatePostsByAccount(account.id, 8);
  const messages = buildPrivatePostMessages({
    account,
    recentPosts,
    request: input.request,
  });
  const debugMode = input.request.debugMode === true || isDebugAgentsEnabled();
  logDebugOverride(debugMode, "[debug/noodler] Prompt sent to model:\n%s", formatNoodleMessagesForLog(messages));
  const completionOptions = {
    model: input.connection.model,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, PRIVATE_POST_MAX_TOKENS),
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    temperature: 0.9,
    topP: 0.95,
    stream: false,
    debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "private_post"),
  } as const;

  let response = await provider.chatComplete(messages, completionOptions);
  let content = response.content ?? "";
  logDebugOverride(debugMode, "[debug/noodler] Raw model response (attempt 1):\n%s", content);
  let generated;
  try {
    generated = parsePrivatePost(content);
  } catch (error) {
    const correctionMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content },
      {
        role: "user",
        content:
          "The response was not one valid private-post JSON object. Return exactly one object with content, imagePrompt, and poll. Return JSON only.",
      },
    ];
    logDebugOverride(
      debugMode,
      "[debug/noodler] Correction prompt sent to model:\n%s",
      formatNoodleMessagesForLog(correctionMessages),
    );
    response = await provider.chatComplete(correctionMessages, completionOptions);
    content = response.content ?? "";
    logDebugOverride(debugMode, "[debug/noodler] Raw model response (attempt 2):\n%s", content);
    generated = parsePrivatePost(content);
  }

  const poll = generated.poll ? createNoodlePoll(generated.poll) : null;
  const post = await noodle.createPrivatePost({
    authorAccountId: account.id,
    content: generated.content,
    imageUrl: null,
    imagePrompt: normalizeNoodleImagePrompt(generated.imagePrompt),
    source: "generated",
    metadata: { ...(poll ? { poll } : {}) },
  });
  if (!post) throw new Error("Failed to persist the generated private NoodleR post.");
  return { ok: true, post };
}

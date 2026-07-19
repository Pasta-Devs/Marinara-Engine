import {
  createNoodlePoll,
  noodleGeneratedPrivatePostSchema,
  type APIProvider,
  type NoodleAccount,
  type NoodleIdentityDisclosure,
  type NoodlePost,
  type NoodlePrivateGenerationRequest,
  type NoodleStageProfileInput,
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

type PublicIdentity = { displayName: string; handle: string };

function identityInstruction(mode: NoodleIdentityDisclosure, publicIdentity: PublicIdentity | null): string {
  if (mode === "open" && publicIdentity) {
    return `Disclosure is open. The linked public identity ${publicIdentity.displayName} (@${publicIdentity.handle}) may be named.`;
  }
  if (mode === "hinted") {
    return "Disclosure is hinted. General allusions to another public persona are allowed, but never use its exact name or handle.";
  }
  return "Disclosure is secret. Do not mention, imply, or identify any linked public persona.";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsIdentity(value: string, identifier: string): boolean {
  if (!identifier.trim()) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@?${escapeRegExp(identifier.trim())}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(value);
}

export function stageProfileContainsPublicIdentity(
  profile: NoodleStageProfileInput,
  publicIdentity: PublicIdentity,
): boolean {
  if (profile.disclosureMode === "open") return false;
  const values = [profile.displayName, profile.handle, profile.bio, profile.stagePersonality];
  return values.some(
    (value) => containsIdentity(value, publicIdentity.displayName) || containsIdentity(value, publicIdentity.handle),
  );
}

export function protectPrivateGeneratedIdentity(
  value: string | null | undefined,
  mode: NoodleIdentityDisclosure,
  publicIdentity: PublicIdentity | null,
): string | null {
  if (!value?.trim()) return null;
  if (mode === "open" || !publicIdentity) return value.trim();
  const protectedValues = [publicIdentity.displayName.trim(), publicIdentity.handle.trim()]
    .filter((item, index, values) => item.length > 0 && values.indexOf(item) === index)
    .sort((left, right) => right.length - left.length);
  const replacement = mode === "hinted" ? "a public persona" : "someone";
  return protectedValues
    .reduce(
      (current, identifier) =>
        current.replace(
          new RegExp(`(^|[^\\p{L}\\p{N}_])@?${escapeRegExp(identifier)}(?=$|[^\\p{L}\\p{N}_])`, "giu"),
          (_match, prefix: string) => `${prefix}${replacement}`,
        ),
      value,
    )
    .replace(new RegExp(`(?:${replacement})(?:\\s*\\(@?${replacement}\\))?`, "giu"), replacement)
    .trim();
}

function formatPrivatePostHistory(posts: NoodlePost[], protect: (value: string) => string): string {
  if (posts.length === 0) return "No previous posts on this private page.";
  return posts
    .slice()
    .reverse()
    .map((post) => `- ${post.createdAt}: ${protect(post.content)}`)
    .join("\n");
}

export function buildPrivatePostMessages(input: {
  account: Pick<NoodleAccount, "displayName" | "handle" | "bio">;
  stagePersonality: string;
  disclosureMode: NoodleIdentityDisclosure;
  publicIdentity: PublicIdentity | null;
  recentPosts: NoodlePost[];
  request: Pick<NoodlePrivateGenerationRequest, "privatePostGuide" | "privateProjectWork">;
}): ChatMessage[] {
  const protect = (value: string) =>
    protectPrivateGeneratedIdentity(value, input.disclosureMode, input.publicIdentity) ?? "";
  const system = [
    "You write exactly one post for one private NoodleR creator page in Marinara Engine.",
    "Write only as the supplied private account. Do not create other accounts, interactions, follows, or public timeline activity.",
    "Use the private stage profile as supplied.",
    identityInstruction(input.disclosureMode, input.publicIdentity),
    "An optional imagePrompt must be a concrete visual description for this post, or null when no image fits.",
    "Return one JSON object with content, imagePrompt, and poll. Set poll to null unless a two-to-four-option poll naturally fits.",
    "Return JSON only. No prose outside the JSON object.",
  ].join("\n");
  const user = [
    "# Private account",
    `Display name: ${protect(input.account.displayName)}`,
    `Handle: @${protect(input.account.handle)}`,
    `Bio: ${protect(input.account.bio) || "No bio provided."}`,
    `Stage voice: ${protect(input.stagePersonality) || "No additional stage voice provided."}`,
    "",
    "# Recent private posts",
    formatPrivatePostHistory(input.recentPosts, protect),
    ...(input.request.privatePostGuide ? ["", "# Post direction", protect(input.request.privatePostGuide)] : []),
    ...(input.request.privateProjectWork
      ? ["", "# Project work direction", protect(input.request.privateProjectWork)]
      : []),
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
  const disclosureMode = account.settings.privacy.identityDisclosure ?? "secret";
  const linkedPublicAccount = account.publicAccountId ? await noodle.getAccountById(account.publicAccountId) : null;
  const publicIdentity = linkedPublicAccount
    ? { displayName: linkedPublicAccount.displayName, handle: linkedPublicAccount.handle }
    : null;
  const messages = buildPrivatePostMessages({
    account,
    stagePersonality: account.settings.privacy.stagePersonality ?? "",
    disclosureMode,
    publicIdentity,
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
  const protectedContent = protectPrivateGeneratedIdentity(generated.content, disclosureMode, publicIdentity);
  if (!protectedContent) throw new Error("Private generation returned no usable post content.");
  const post = await noodle.createPrivatePost({
    authorAccountId: account.id,
    content: protectedContent,
    imageUrl: null,
    imagePrompt: normalizeNoodleImagePrompt(
      protectPrivateGeneratedIdentity(generated.imagePrompt, disclosureMode, publicIdentity),
    ),
    source: "generated",
    metadata: { ...(poll ? { poll } : {}) },
  });
  if (!post) throw new Error("Failed to persist the generated private NoodleR post.");
  return { ok: true, post };
}

import {
  NOODLER_REPLY_CONTENT_MAX_LENGTH,
  noodleGeneratedNoodlerReplySchema,
  type APIProvider,
  type NoodleAccount,
  type NoodleIdentityDisclosure,
  type NoodleInteraction,
  type NoodlerManagedPost,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "../generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { formatNoodleMessagesForLog } from "./noodle-generation-log.js";
import {
  NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
  protectNoodlerGeneratedIdentity,
  resolveNoodlerPublicIdentity,
  type PublicIdentity,
} from "./noodle-noodler-generation.service.js";
import { noodleResponseFormat } from "./noodle-response-format.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

function disclosureInstruction(mode: NoodleIdentityDisclosure, identity: PublicIdentity | null): string {
  if (mode === "open" && identity) {
    return `Disclosure is open. The linked public identity ${identity.displayName} (@${identity.handle}) may be named.`;
  }
  if (mode === "hinted") {
    return "Disclosure is hinted. General allusions to another public persona are allowed, but never use its exact name or handle.";
  }
  return "Disclosure is secret. Do not mention, imply, or identify any linked public persona.";
}

export function buildNoodlerCreatorReplyMessages(input: {
  creator: NoodleAccount;
  viewer: NoodleAccount;
  post: NoodlerManagedPost;
  parent: NoodleInteraction;
  disclosureMode: NoodleIdentityDisclosure;
  publicIdentity: PublicIdentity | null;
  generationGuidance: string;
}): ChatMessage[] {
  const protect = (value: string | null | undefined) =>
    protectNoodlerGeneratedIdentity(value, input.disclosureMode, input.publicIdentity) ?? "";
  const system = [
    "You write exactly one direct reply from one NoodleR creator to one real viewer comment on the creator's post.",
    "Write only as the supplied creator's stage persona. Address the viewer's comment naturally and do not write for the viewer.",
    NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
    input.generationGuidance.trim(),
    disclosureInstruction(input.disclosureMode, input.publicIdentity),
    'Return exactly one JSON object with one string field named "content".',
    "Return JSON only. No prose outside the JSON object.",
  ]
    .filter(Boolean)
    .join("\n");
  const data = {
    creator: {
      displayName: protect(input.creator.displayName),
      handle: protect(input.creator.handle),
      bio: protect(input.creator.bio),
      stageVoice: protect(input.creator.settings.privacy.stagePersonality),
    },
    post: { title: protect(input.post.title), content: protect(input.post.content) },
    viewer: { displayName: protect(input.viewer.displayName), handle: protect(input.viewer.handle) },
    viewerComment: protect(input.parent.content) || (input.parent.imageUrl ? "[image reply]" : ""),
  };
  return [
    { role: "system", content: system },
    { role: "user", content: `# Untrusted NoodleR data\n${JSON.stringify(data, null, 2)}` },
  ];
}

export async function generateNoodlerCreatorReply(input: {
  db: DB;
  creator: NoodleAccount;
  viewer: NoodleAccount;
  post: NoodlerManagedPost;
  parent: NoodleInteraction;
  connection: GenerationConnection;
  debugMode?: boolean;
}): Promise<string> {
  const connections = createConnectionsStorage(input.db);
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
  const disclosureMode = input.creator.settings.privacy.identityDisclosure ?? "secret";
  const publicIdentity = await resolveNoodlerPublicIdentity(input.db, input.creator);
  const settings = await createNoodleStorage(input.db).getSettings();
  const messages = buildNoodlerCreatorReplyMessages({
    ...input,
    disclosureMode,
    publicIdentity,
    generationGuidance: settings.noodlerGenerationGuidance,
  });
  const debugMode = input.debugMode === true || isDebugAgentsEnabled();
  const options = {
    model: input.connection.model,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, 512),
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    temperature: 0.9,
    topP: 0.95,
    ...resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
    stream: false,
    debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "noodler_reply"),
  } as const;
  logDebugOverride(debugMode, "[debug/noodler-reply] Prompt sent to model:\n%s", formatNoodleMessagesForLog(messages));
  const response = await provider.chatComplete(messages, options);
  const content = response.content ?? "";
  logDebugOverride(debugMode, "[debug/noodler-reply] Raw model response (attempt 1):\n%s", content);
  const generated = noodleGeneratedNoodlerReplySchema.parse(parseGameJsonish(content));
  const protectedContent = protectNoodlerGeneratedIdentity(generated.content, disclosureMode, publicIdentity);
  if (!protectedContent) throw new Error("NoodleR creator reply generation returned no usable content.");
  return protectedContent.length <= NOODLER_REPLY_CONTENT_MAX_LENGTH
    ? protectedContent
    : protectedContent.slice(0, NOODLER_REPLY_CONTENT_MAX_LENGTH).trimEnd();
}

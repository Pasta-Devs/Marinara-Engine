import {
  noodleStageProfileDraftResponseSchema,
  type APIProvider,
  type NoodleIdentityDisclosure,
  type NoodleStageProfileDraftRequest,
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
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { noodleResponseFormat } from "./noodle-response-format.js";
import {
  protectPrivateGeneratedIdentity,
  stageProfileContainsPublicIdentity,
} from "./noodle-private-generation.service.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sourceText(data: unknown): string {
  const source = record(data);
  const extensions = record(source.extensions);
  return [
    `Name: ${typeof source.name === "string" ? source.name : ""}`,
    `Description: ${typeof source.description === "string" ? source.description : ""}`,
    `Personality: ${typeof source.personality === "string" ? source.personality : ""}`,
    `Scenario: ${typeof source.scenario === "string" ? source.scenario : ""}`,
    `Appearance: ${typeof source.appearance === "string" ? source.appearance : typeof extensions.appearance === "string" ? extensions.appearance : ""}`,
    `Backstory: ${typeof source.backstory === "string" ? source.backstory : typeof extensions.backstory === "string" ? extensions.backstory : ""}`,
  ]
    .filter((line) => line.trim().split(": ").slice(1).join(": ").trim())
    .join("\n");
}

function disclosureRules(mode: NoodleIdentityDisclosure, publicIdentity: { displayName: string; handle: string }) {
  if (mode === "open")
    return `The public identity ${publicIdentity.displayName} (@${publicIdentity.handle}) may inspire and appear in the draft.`;
  if (mode === "hinted")
    return "Create an inspired alter ego. Broad personality, interests, and themes may carry over, but never use the exact public name or handle, or copy canonical biography sentences.";
  return "Create a separate persona. Treat the source only as private authoring inspiration. Do not use the public name, handle, canonical occupation, relationships, locations, signature phrases, or distinctive identifying details.";
}

function defaultDraft(
  source: { displayName: string; handle: string; bio: string },
  mode: NoodleIdentityDisclosure,
): NoodleStageProfileInput {
  return {
    displayName: mode === "open" ? source.displayName : mode === "hinted" ? "After Hours" : "Separate Persona",
    handle: mode === "open" ? source.handle : mode === "hinted" ? "afterhours" : "separate_persona",
    bio: source.bio,
    stagePersonality: "A distinct stage voice with clear boundaries and a point of view.",
    disclosureMode: mode,
  };
}

export async function generateNoodlerStageProfileDraft(
  db: DB,
  input: { request: NoodleStageProfileDraftRequest; connection: GenerationConnection },
): Promise<NoodleStageProfileInput> {
  const noodle = createNoodleStorage(db);
  const privateAccount = input.request.privateAccountId
    ? await noodle.getPrivateAccountById(input.request.privateAccountId)
    : null;
  const publicAccount = privateAccount?.publicAccountId
    ? await noodle.getAccountById(privateAccount.publicAccountId)
    : input.request.publicAccountId
      ? await noodle.getAccountById(input.request.publicAccountId)
      : null;
  if (!publicAccount) throw new Error("Noodle source account not found.");
  const characters = createCharactersStorage(db);
  const source = publicAccount.kind === "character" ? await characters.getById(publicAccount.entityId) : null;
  const identity = { displayName: publicAccount.displayName, handle: publicAccount.handle };
  const seed = defaultDraft(publicAccount, input.request.disclosureMode);
  const currentDraft = input.request.currentDraft ? { ...seed, ...input.request.currentDraft } : seed;
  const protectedDraft = Object.fromEntries(
    Object.entries(currentDraft).map(([key, value]) => [
      key,
      typeof value === "string"
        ? (protectPrivateGeneratedIdentity(value, input.request.disclosureMode, identity) ?? "")
        : value,
    ]),
  );
  const sourceDetails = source
    ? sourceText(source.data)
    : "General temperament and creative interests from the source profile.";
  const rawSourceContext =
    input.request.disclosureMode === "secret"
      ? [
          "# Non-identifying inspiration brief",
          "Use only broad temperament, creative interests, and non-identifying aesthetic direction.",
          "Do not infer canonical facts or recognizable story details.",
          `Public bio themes, redacted: ${publicAccount.bio ? "A source bio exists; do not reproduce its wording." : "None."}`,
        ].join("\n")
      : [
          "# Source character or persona",
          `Public name: ${publicAccount.displayName}`,
          `Public handle: @${publicAccount.handle}`,
          `Public bio: ${publicAccount.bio || "No bio provided."}`,
          sourceDetails,
        ].join("\n");
  const sourceContext =
    input.request.disclosureMode === "open"
      ? rawSourceContext
      : rawSourceContext
          .split("\n")
          .map((line) => protectPrivateGeneratedIdentity(line, input.request.disclosureMode, identity) ?? "")
          .join("\n");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "Create one editable NoodleR stage profile draft.",
        "Return JSON only with displayName, handle, bio, stagePersonality, and disclosureMode.",
        "Make the stage identity distinct, concise, and usable for future private post generation.",
        disclosureRules(input.request.disclosureMode, identity),
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        sourceContext,
        "",
        "# Current draft",
        JSON.stringify(protectedDraft),
        "",
        "# Creator guidance",
        input.request.guidance || "Create a compelling stage identity with a clear voice.",
      ].join("\n"),
    },
  ];
  const debugMode = isDebugAgentsEnabled();
  logDebugOverride(
    debugMode,
    "[debug/noodler] Stage profile draft prompt:\n%s",
    messages.map((item) => `${item.role}:\n${item.content}`).join("\n\n"),
  );
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
  const response = await provider.chatComplete(messages, {
    model: input.connection.model,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, 1200),
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    temperature: 0.7,
    topP: 0.9,
    stream: false,
    debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "private_profile"),
  });
  const parsed = noodleStageProfileDraftResponseSchema.parse(parseGameJsonish(response.content ?? ""));
  const draft = { ...parsed, disclosureMode: input.request.disclosureMode };
  if (stageProfileContainsPublicIdentity(draft, identity)) {
    throw new Error("Generated stage draft included the linked public identity. Try again with different guidance.");
  }
  return draft;
}

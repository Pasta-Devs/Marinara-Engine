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
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "../generation/generation-parameters.js";
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
  buildNoodlerPublicIdentity,
  protectNoodlerGeneratedIdentity,
  stageProfileContainsPublicIdentity,
} from "./noodle-noodler-generation.service.js";
import { resolveNoodlerSourceSnapshot } from "./noodle-noodler-source.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

function record(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function noodlerSourceText(data: unknown): string {
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
  return "Create a separate persona. Treat the source only as confidential authoring inspiration. Do not use the public name, handle, canonical occupation, relationships, locations, signature phrases, or distinctive identifying details.";
}

export function buildNoodlerStageProfileDraftMessages(input: {
  request: Pick<NoodleStageProfileDraftRequest, "disclosureMode" | "guidance" | "currentDraft">;
  publicAccount: { displayName: string; handle: string; bio: string };
  source: { data: string | ({ name?: unknown } & Record<string, unknown>) } | null;
}): ChatMessage[] {
  const identity = buildNoodlerPublicIdentity(input.publicAccount, input.source);
  const protectedDraft = input.request.currentDraft
    ? Object.fromEntries(
        Object.entries(input.request.currentDraft).map(([key, value]) => [
          key,
          typeof value === "string"
            ? (protectNoodlerGeneratedIdentity(value, input.request.disclosureMode, identity) ?? "")
            : value,
        ]),
      )
    : null;
  const sourceDetails = input.source
    ? noodlerSourceText(input.source.data)
    : "General temperament and creative interests from the source profile.";
  const initialHintedDraft = input.request.disclosureMode === "hinted" && !input.request.currentDraft;
  const rawSourceContext =
    input.request.disclosureMode === "secret"
      ? [
          "# Non-identifying inspiration brief",
          "Use only broad temperament, creative interests, and non-identifying aesthetic direction.",
          "Do not infer canonical facts or recognizable story details.",
          `Public bio themes, redacted: ${input.publicAccount.bio ? "A source bio exists; do not reproduce its wording." : "None."}`,
        ].join("\n")
      : initialHintedDraft
        ? [
            "# Non-identifying inspiration brief",
            "Use only broad temperament, creative interests, and non-identifying aesthetic direction.",
            sourceDetails
              .split("\n")
              .filter((line) => !line.startsWith("Name: ") && !line.startsWith("Description: "))
              .join("\n"),
          ].join("\n")
        : [
            "# Source character or persona",
            `Public name: ${input.publicAccount.displayName}`,
            `Public handle: @${input.publicAccount.handle}`,
            `Public bio: ${input.publicAccount.bio || "No bio provided."}`,
            sourceDetails,
          ].join("\n");
  const sourceContext =
    input.request.disclosureMode === "open"
      ? rawSourceContext
      : rawSourceContext
          .split("\n")
          .map((line) => protectNoodlerGeneratedIdentity(line, input.request.disclosureMode, identity) ?? "")
          .join("\n");
  return [
    {
      role: "system",
      content: [
        "Create one editable NoodleR stage profile draft.",
        "Return a single JSON object only — no arrays, no wrapping brackets.",
        "Keys: displayName, handle, bio, stagePersonality, disclosureMode.",
        "disclosureMode must be one of: \"open\", \"hinted\", or \"secret\" — use only these exact values.",
        "Make the stage identity distinct, concise, and usable for future NoodleR post generation.",
        disclosureRules(input.request.disclosureMode, identity),
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        sourceContext,
        ...(protectedDraft ? ["", "# Current draft", JSON.stringify(protectedDraft)] : []),
        "",
        "# Creator guidance",
        input.request.guidance || "Create a compelling stage identity with a clear voice.",
      ].join("\n"),
    },
  ];
}

export async function generateNoodlerStageProfileDraft(
  db: DB,
  input: { request: NoodleStageProfileDraftRequest; connection: GenerationConnection },
): Promise<NoodleStageProfileInput & { sourceSnapshot?: Awaited<ReturnType<typeof resolveNoodlerSourceSnapshot>> }> {
  const noodle = createNoodleStorage(db);
  const noodlerAccount = input.request.noodlerAccountId
    ? await noodle.getNoodlerAccountById(input.request.noodlerAccountId)
    : null;
  const publicAccount = noodlerAccount?.noodleAccountId
    ? await noodle.getAccountById(noodlerAccount.noodleAccountId)
    : input.request.noodleAccountId
      ? await noodle.getAccountById(input.request.noodleAccountId)
      : null;
  if (!publicAccount) throw new Error("Noodle source account not found.");
  const characters = createCharactersStorage(db);
  const source =
    publicAccount.kind === "character"
      ? await characters.getById(publicAccount.entityId)
      : publicAccount.kind === "persona"
        ? await characters.getPersona(publicAccount.entityId).then((persona) =>
            persona
              ? {
                  data: {
                    name: persona.name,
                    description: persona.description,
                    personality: persona.personality,
                    scenario: persona.scenario,
                    appearance: persona.appearance,
                    backstory: persona.backstory,
                  },
                }
              : null,
          )
        : null;
  const identity = buildNoodlerPublicIdentity(publicAccount, source);
  const messages = buildNoodlerStageProfileDraftMessages({ request: input.request, publicAccount, source });
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
    ...resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
    stream: false,
    debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "noodler_profile"),
  });
  const unwrapped = parseGameJsonish(response.content ?? "");
  const unwrappedObj = Array.isArray(unwrapped) && unwrapped.length === 1 ? unwrapped[0] : unwrapped;
  const raw = noodleStageProfileDraftResponseSchema.omit({ disclosureMode: true }).strip().parse(
    unwrappedObj as Record<string, unknown>,
  );
  const parsed = { ...raw, handle: (raw.handle as string).replace(/^@/, "") };
  const draft = { ...parsed, disclosureMode: input.request.disclosureMode };
  if (stageProfileContainsPublicIdentity(draft, identity)) {
    throw new Error("Generated stage draft included the linked public identity. Try again with different guidance.");
  }
  return { ...draft, sourceSnapshot: await resolveNoodlerSourceSnapshot(db, publicAccount) };
}

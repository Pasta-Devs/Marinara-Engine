import {
  type APIProvider,
  type NoodleAccount,
  type NoodleAmbientProfileRerollOutcome,
  type NoodleGeneratedProfile,
} from "@marinara-engine/shared";
import { logDebugOverride, logger } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "../generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import type { DB } from "../../db/connection.js";
import { parseNoodleGeneratedProfiles } from "./noodle-generated-profiles.js";
import { normalizeNoodleHandle } from "./noodle-handle.js";
import { generatedProfileSettings } from "./noodle-public-support.js";
import { noodleResponseFormat, NOODLE_JSON_OUTPUT_HEADING } from "./noodle-response-format.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type AmbientProfileRerollOutcome = NoodleAmbientProfileRerollOutcome;

function normalizedPublicHandle(handle: string): string {
  return (
    normalizeNoodleHandle(handle)
      .replace(/[^a-z0-9_]+/gu, "_")
      .replace(/^_+|_+$/gu, "")
      .slice(0, 36) || "ambient_user"
  );
}

export function nextAvailableAmbientHandle(handle: string, reserved: Set<string>): string {
  const base = normalizedPublicHandle(handle);
  let candidate = base;
  let suffix = 2;
  while (reserved.has(candidate)) {
    const suffixText = `_${suffix++}`;
    candidate = `${base.slice(0, Math.max(1, 36 - suffixText.length))}${suffixText}`;
  }
  reserved.add(candidate);
  return candidate;
}

export function ambientGeneratedProfileChanged(account: NoodleAccount, profile: NoodleGeneratedProfile): boolean {
  return (
    account.displayName.trim().toLocaleLowerCase() !== profile.name.trim().toLocaleLowerCase() ||
    normalizedPublicHandle(account.handle) !== normalizedPublicHandle(profile.handle)
  );
}

export function allocateAmbientProfileHandles(
  accounts: NoodleAccount[],
  profiles: ReadonlyMap<string, NoodleGeneratedProfile>,
  occupiedHandles: Iterable<string>,
): Map<string, string> {
  const reserved = new Set(Array.from(occupiedHandles, normalizedPublicHandle));
  const allocated = new Map<string, string>();
  for (const account of accounts) {
    const profile = profiles.get(account.entityId);
    if (!profile || !ambientGeneratedProfileChanged(account, profile)) continue;
    // Free the account's own handle only long enough for it to reclaim it. Leaving it free would
    // let a later account take a handle its owner still holds, which trips the unique index on write.
    const ownHandle = normalizedPublicHandle(account.handle);
    reserved.delete(ownHandle);
    const nextHandle = nextAvailableAmbientHandle(profile.handle, reserved);
    if (nextHandle !== ownHandle) reserved.add(ownHandle);
    allocated.set(account.id, nextHandle);
  }
  return allocated;
}

export async function rerollAmbientNoodleProfiles(input: {
  db: DB;
  noodle: ReturnType<typeof createNoodleStorage>;
  accounts: NoodleAccount[];
  connection: GenerationConnection;
  debugMode: boolean;
}): Promise<{ accounts: NoodleAccount[]; outcomes: AmbientProfileRerollOutcome[] }> {
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
  const targets = input.accounts.map((account) => ({
    entityId: account.entityId,
    currentName: account.displayName,
    currentHandle: account.handle,
    currentBio: account.bio,
  }));
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "Create replacement identities for fake ambient users on a fictional social network called Noodle.",
        "Make every profile distinct from its current identity and from the other generated profiles.",
        "Profiles should feel like plausible recurring background users with varied personalities, interests, and posting styles.",
        "Create concise profile metadata only. Do not write posts or interactions.",
        "Return JSON only with one profile for every exact entityId supplied.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "# Ambient profiles to replace",
        JSON.stringify(targets, null, 2),
        "",
        NOODLE_JSON_OUTPUT_HEADING,
        JSON.stringify(
          {
            profiles: [
              {
                entityId: "exact entityId from the input",
                name: "new display name",
                handle: "new lowercase handle without @",
                bio: "short personality-rich social bio",
                location: "short fictional location",
              },
            ],
          },
          null,
          2,
        ),
      ].join("\n"),
    },
  ];
  logDebugOverride(
    input.debugMode,
    "[debug/noodle] Ambient profile reroll prompt:\n%s",
    messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n"),
  );
  const result = await provider.chatComplete(messages, {
    model: input.connection.model,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, 1024 + input.accounts.length * 512),
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    temperature: 0.95,
    topP: 0.95,
    ...resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
    stream: false,
    debugMode: input.debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "profiles"),
  });
  // A wholly malformed response throws; report it per account instead of failing the whole request.
  let parsed: ReturnType<typeof parseNoodleGeneratedProfiles> = { profiles: [], rejected: [] };
  try {
    parsed = parseNoodleGeneratedProfiles(parseGameJsonish(result.content ?? ""));
  } catch (error) {
    logger.warn(error, "[noodle] Ambient profile reroll returned an unusable response");
  }
  if (parsed.rejected.length > 0) {
    logger.warn("[noodle] Skipped %d invalid Ambient profile row(s)", parsed.rejected.length);
  }
  const generatedByEntityId = new Map(parsed.profiles.map((profile) => [profile.entityId, profile]));
  const allocatedHandles = allocateAmbientProfileHandles(
    input.accounts,
    generatedByEntityId,
    (await input.noodle.listAccounts()).map((account) => account.handle),
  );
  const accounts: NoodleAccount[] = [];
  const outcomes: AmbientProfileRerollOutcome[] = [];
  for (const account of input.accounts) {
    const profile = generatedByEntityId.get(account.entityId);
    if (!profile || !ambientGeneratedProfileChanged(account, profile)) {
      outcomes.push({ accountId: account.id, status: "invalid_response" });
      continue;
    }
    try {
      const updated = await input.noodle.updateAccountProfile(account.id, {
        handle: allocatedHandles.get(account.id)!,
        displayName: profile.name,
        bio: profile.bio,
        avatarUrl: null,
        profile: {
          ...generatedProfileSettings(profile.location, null),
          avatarCrop: null,
          profileManuallyEdited: false,
        },
      });
      if (!updated) {
        outcomes.push({ accountId: account.id, status: "error" });
        continue;
      }
      accounts.push(updated);
      outcomes.push({ accountId: account.id, status: "updated" });
    } catch (error) {
      logger.error(error, "[noodle] Could not apply Ambient profile reroll for %s", account.id);
      outcomes.push({ accountId: account.id, status: "error" });
    }
  }
  return { accounts, outcomes };
}

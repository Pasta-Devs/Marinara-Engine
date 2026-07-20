import { basename } from "path";
import { type APIProvider, type NoodleAccount } from "@marinara-engine/shared";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "../generation/generation-parameters.js";
import { parseGameJsonish } from "../game/jsonish.js";
import type { BaseLLMProvider, ChatMessage } from "../llm/base-provider.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { parseNoodleGeneratedProfiles } from "./noodle-generated-profiles.js";
import { noodleAccountsNeedingProfiles } from "./noodle-profile-selection.js";
import { NOODLE_ADULT_PLATFORM_POLICY } from "./noodle-prompt.js";
import { NOODLE_JSON_OUTPUT_HEADING, noodleResponseFormat } from "./noodle-response-format.js";
import { generatedProfileSettings, parseRecord } from "./noodle-public-support.js";

function escapePromptAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function characterContextFromRow(row: { id: string; data: unknown }) {
  const data = parseRecord(row.data);
  const extensions = parseRecord(data.extensions);
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Character";
  const lines = [`<character name="${escapePromptAttribute(name)}">`];
  for (const [label, value] of [
    ["Description", data.description],
    ["Personality", data.personality],
    ["Scenario", data.scenario],
    ["First message", data.first_mes],
    ["Appearance", data.appearance ?? extensions.appearance],
    ["Backstory", data.backstory ?? extensions.backstory],
  ] as const) {
    if (typeof value === "string" && value.trim()) lines.push(`${label}: ${value.trim()}`);
  }
  lines.push(`</character>`);
  return lines.join("\n");
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

async function pickRandomCharacterBannerUrl(
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>,
  characterId: string,
) {
  const images = await characterGallery.listByCharacterId(characterId);
  const image = images.length > 0 ? shuffle(images)[0] : null;
  if (!image) return null;
  const filename = basename(image.filePath.replace(/\\/g, "/"));
  return `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`;
}

function profileSetupMaxTokens(characterCount: number) {
  return 1024 + Math.max(0, characterCount) * 1024;
}

export function buildNoodleProfileTargetBlock(
  account: Pick<NoodleAccount, "entityId" | "displayName" | "handle">,
  row: { id: string; data: unknown },
) {
  return [
    `<profile_target entityId="${escapePromptAttribute(account.entityId)}" currentName="${escapePromptAttribute(
      account.displayName,
    )}" currentHandle="${escapePromptAttribute(account.handle)}">`,
    characterContextFromRow(row),
    `</profile_target>`,
  ].join("\n");
}

export async function generateMissingNoodleProfiles(input: {
  noodle: ReturnType<typeof createNoodleStorage>;
  characters: ReturnType<typeof createCharactersStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
  accounts: NoodleAccount[];
  provider: BaseLLMProvider;
  connection: { provider: string; model: string; maxTokensOverride?: number | null; defaultParameters?: unknown };
  debugMode: boolean;
}) {
  const targets: Array<{
    account: NoodleAccount;
    row: { id: string; data: unknown; avatarPath?: string | null };
    bannerUrl: string | null;
  }> = [];
  for (const account of noodleAccountsNeedingProfiles(input.accounts)) {
    const row = await input.characters.getById(account.entityId);
    if (!row) continue;
    const bannerUrl = await pickRandomCharacterBannerUrl(input.characterGallery, account.entityId);
    targets.push({ account, row, bannerUrl });
  }
  if (targets.length === 0) return;

  const characterBlocks = targets.map(({ account, row }) => buildNoodleProfileTargetBlock(account, row)).join("\n\n");
  const outputFormat = [
    NOODLE_JSON_OUTPUT_HEADING,
    JSON.stringify(
      {
        profiles: [
          {
            entityId: "exact entityId from profile_target",
            name: "display name for the social profile",
            handle: "short @nickname without @, lowercase letters/numbers/underscores preferred",
            bio: "short in-character social media bio",
            location: "short profile location, fictional or canonical if known",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "You set up fake Noodle social media profiles for existing Marinara Engine characters.",
        NOODLE_ADULT_PLATFORM_POLICY,
        "Create concise profile metadata only. Do not write posts, replies, likes, or timeline content.",
        "Use each character's personality, setting, and appearance to make the profile feel natural and in character.",
        "Return JSON only. No prose outside the JSON object.",
      ].join("\n"),
    },
    { role: "user", content: ["# Characters Needing Noodle Profiles", characterBlocks, "", outputFormat].join("\n") },
  ];
  const promptForLog = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n");
  logDebugOverride(input.debugMode, "[debug/noodle] Profile prompt sent to model:\n%s", promptForLog);
  const maxTokens = clampGenerationMaxOutputTokens({
    provider: input.connection.provider as APIProvider,
    model: input.connection.model,
    maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, profileSetupMaxTokens(targets.length)),
    maxTokensOverride: input.connection.maxTokensOverride,
  });
  const result = await input.provider.chatComplete(messages, {
    model: input.connection.model,
    maxTokens,
    temperature: 0.55,
    topP: 0.9,
    ...resolveStoredChatOptions(
      input.connection.defaultParameters,
      input.connection.provider,
      input.connection.model,
    ),
    stream: false,
    debugMode: input.debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "profiles"),
  });
  const generated = parseNoodleGeneratedProfiles(parseGameJsonish(result.content ?? ""));
  if (generated.rejected.length > 0) {
    logger.warn(
      "[noodle] Skipped %d invalid generated profile row(s); valid profiles will still be applied",
      generated.rejected.length,
    );
  }
  const profileByEntityId = new Map(generated.profiles.map((profile) => [profile.entityId, profile]));
  for (const target of targets) {
    const profile = profileByEntityId.get(target.account.entityId);
    if (!profile) continue;
    await input.noodle.updateAccountProfile(target.account.id, {
      handle: profile.handle,
      displayName: profile.name,
      bio: profile.bio,
      avatarUrl: target.row.avatarPath ?? target.account.avatarUrl,
      profile: generatedProfileSettings(profile.location, target.bannerUrl),
    });
  }
}

// ──────────────────────────────────────────────
// "Things to try" progress: which tasks the saved data already shows as done. One yes per
// task id, nothing else (no names, no chat text). Reads only tables that are always in
// memory; messages, chat pictures and other per-chat tables load one chat at a time, so
// tasks that would need them are ticked in the app instead.
// ──────────────────────────────────────────────
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BUILT_IN_AGENTS, PROFESSOR_MARI_ID, type DiscoveryProgressResponse } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import {
  achievementUnlocks,
  agentConfigs,
  apiConnections,
  characterCardVersions,
  characterGroups,
  characterImages,
  characters,
  chatPresets,
  chats,
  customThemes,
  libraryFolders,
  lorebookCharacterLinks,
  lorebookEntries,
  lorebooks,
  noodlePosts,
  personaGroups,
  personaImages,
  personas,
} from "../../db/schema/index.js";
import { DATA_DIR } from "../../utils/data-dir.js";

const NON_CHAT_PROVIDERS = new Set(["image_generation", "video_generation", "audio_generation", "audio", "decision"]);
const SPRITE_FILE = /\.(png|jpg|jpeg|gif|webp|avif|svg)$/iu;

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const filled = (value: unknown) =>
  typeof value === "string"
    ? value.trim().length > 0
    : Array.isArray(value)
      ? value.length > 0
      : value && typeof value === "object"
        ? Object.keys(value).length > 0
        : !!value;

function extensionsOf(data: string): Record<string, unknown> {
  const card = parseObject(data);
  const extensions = card.extensions;
  return extensions && typeof extensions === "object" ? (extensions as Record<string, unknown>) : {};
}

function hasSprites(characterId: string): boolean {
  if (!characterId || /[/\\.]/u.test(characterId)) return false;
  const directory = join(DATA_DIR, "sprites", characterId);
  try {
    return existsSync(directory) && readdirSync(directory).some((name) => SPRITE_FILE.test(name));
  } catch {
    return false;
  }
}

export function createDiscoveryProgressService(db: DB) {
  async function progress(): Promise<DiscoveryProgressResponse> {
    const [
      chatRows,
      characterRows,
      personaRows,
      versionRows,
      characterGroupRows,
      personaGroupRows,
      characterImageRows,
      personaImageRows,
      connectionRows,
      presetRows,
      agentRows,
      lorebookRows,
      entryRows,
      linkRows,
      themeRows,
      folderRows,
      noodleRows,
      unlockRows,
    ] = await Promise.all([
      db.select().from(chats),
      db.select().from(characters),
      db.select().from(personas),
      db.select().from(characterCardVersions),
      db.select().from(characterGroups),
      db.select().from(personaGroups),
      db.select().from(characterImages),
      db.select().from(personaImages),
      db.select().from(apiConnections),
      db.select().from(chatPresets),
      db.select().from(agentConfigs),
      db.select().from(lorebooks),
      db.select().from(lorebookEntries),
      db.select().from(lorebookCharacterLinks),
      db.select().from(customThemes),
      db.select().from(libraryFolders),
      db.select().from(noodlePosts),
      db.select().from(achievementUnlocks),
    ]);

    const done = new Set<string>();
    const mark = (id: string, when: unknown) => {
      if (when) done.add(id);
    };

    // Chats
    const chatMeta = chatRows.map((chat) => ({ chat, meta: parseObject(chat.metadata) }));
    const byMode = (mode: string) => chatMeta.filter((row) => row.chat.mode === mode);
    const agentsOn = (type: string) =>
      chatMeta.some(
        ({ meta }) => meta.enableAgents === true && parseArray(meta.activeAgentIds).some((id) => id === type),
      );
    const anyMeta = (test: (meta: Record<string, unknown>) => unknown) => chatMeta.some(({ meta }) => !!test(meta));

    mark("C2", byMode("conversation").length);
    mark("C3", byMode("roleplay").length);
    mark("C4", byMode("game").length);
    mark(
      "P3",
      chatRows.some((chat) => !!chat.personaId),
    );
    mark(
      "P4",
      chatRows.some((chat) => !!chat.personaCharacterId),
    );
    mark(
      "P7",
      chatRows.some((chat) => parseArray(chat.characterIds).length >= 2),
    );
    mark(
      "V13",
      byMode("conversation").some(({ chat }) => parseArray(chat.characterIds).length >= 2),
    );
    mark(
      "V8",
      anyMeta((meta) => meta.autonomousMessages === true),
    );
    mark(
      "R1",
      anyMeta((meta) => filled(meta.background)),
    );
    mark("R2", agentsOn("background"));
    mark("R3", agentsOn("world-state"));
    mark(
      "R4",
      anyMeta((meta) => filled(meta.locationBackgroundPins)),
    );
    mark("R8", agentsOn("expression"));
    mark(
      "R10",
      anyMeta((meta) => meta.narrativeDirectorSecretPlotEnabled === true),
    );
    mark(
      "R11",
      anyMeta((meta) => filled(meta.sceneOriginChatId)),
    );
    mark("R12", agentsOn("cyoa"));
    mark("R13", agentsOn("combat"));
    mark(
      "R14",
      byMode("roleplay").some(({ meta }) => filled(meta.gameRuleset)),
    );
    mark(
      "L5",
      anyMeta((meta) => meta.enableMemoryRecall === true),
    );
    mark(
      "L6",
      anyMeta((meta) => filled(meta.summary) || filled(meta.summaryEntries)),
    );
    mark(
      "L8",
      anyMeta((meta) => filled(meta.knowledgeAgentSources)),
    );
    mark("L9", agentsOn("hierarchical-maps"));
    mark(
      "S1",
      anyMeta((meta) => filled(meta.branchParentChatId)),
    );
    mark(
      "S8",
      chatRows.some((chat) => !!chat.connectedChatId),
    );
    mark(
      "S9",
      anyMeta(
        (meta) =>
          meta.autoTranslate === true || filled(meta.translationTargetLang) || meta.showInputTranslateButton === true,
      ),
    );
    mark(
      "M2",
      anyMeta((meta) => filled(meta.appliedChatPresetId)),
    );
    mark(
      "A1",
      anyMeta((meta) => meta.enableAgents === true && filled(meta.activeAgentIds)),
    );
    mark("X4", agentsOn("spotify"));
    mark(
      "X6",
      anyMeta((meta) => meta.noodleTimelineContextEnabled === true),
    );
    mark(
      "KT2",
      anyMeta((meta) => filled(meta.themeId)),
    );
    mark(
      "KR1",
      anyMeta((meta) => meta.illustratorAutoBackgroundsEnabled === true),
    );
    mark(
      "KR2",
      anyMeta(
        (meta) => meta.illustratorDecisionLocationCheck === true || meta.illustratorDecisionWeatherCheck === true,
      ),
    );
    mark(
      "KR3",
      anyMeta((meta) => meta.illustratorWeatherBackgroundsEnabled === true),
    );

    // Characters and personas
    const ownCharacters = characterRows.filter((character) => character.id !== PROFESSOR_MARI_ID);
    const characterExtensions = ownCharacters.map((character) => extensionsOf(character.data));
    mark("P1", ownCharacters.length);
    mark(
      "P2",
      characterExtensions.some((ext) => filled(ext.botBrowserSource) || filled(ext.importMetadata)),
    );
    mark(
      "P5",
      characterExtensions.some(
        (ext) =>
          filled(ext.nameColor) ||
          filled(ext.dialogueColor) ||
          filled(ext.boxColor) ||
          (ext.rpgStats as { enabled?: unknown } | undefined)?.enabled === true,
      ),
    );
    mark("P6", characterGroupRows.length + personaGroupRows.length);
    mark(
      "P8",
      versionRows.some((version) => version.source === "restore"),
    );
    mark(
      "G3",
      characterExtensions.some((ext) => filled(ext.characterSheetImageId)),
    );
    mark(
      "G4",
      ownCharacters.some((character) => hasSprites(character.id)),
    );
    mark(
      "V9",
      characterExtensions.some((ext) => filled(ext.conversationSchedule)),
    );
    mark(
      "V1",
      personaRows.some((persona) => {
        const card = parseObject(persona.data);
        const ext = extensionsOf(persona.data);
        return filled(ext.aboutMe) || filled(ext.convoDisplayName) || filled(card.aboutMe);
      }),
    );

    // Gallery pictures (characters and personas)
    const images = [...characterImageRows, ...personaImageRows];
    mark("G1", images.length);
    mark(
      "G6",
      images.some((image) => filled(image.description)),
    );
    mark(
      "V2",
      images.some((image) => image.customKind === "sticker" && filled(image.provider)),
    );
    mark(
      "V3",
      images.some((image) => image.customKind === "sticker"),
    );
    mark(
      "V4",
      images.some((image) => image.customKind === "emoji"),
    );
    mark(
      "R5",
      images.some((image) => image.customKind === "background"),
    );
    mark(
      "R7",
      images.some((image) => filled(image.sourceChatImageId)),
    );

    // Connections
    mark(
      "C1",
      connectionRows.some((row) => !NON_CHAT_PROVIDERS.has(row.provider)),
    );
    mark(
      "G2",
      connectionRows.some((row) => row.provider === "image_generation"),
    );
    mark(
      "M5",
      connectionRows.some((row) => row.provider === "decision"),
    );
    mark(
      "X2",
      connectionRows.some((row) => row.provider === "audio"),
    );
    mark(
      "M7",
      connectionRows.some((row) => parseArray(row.pinnedModels).length > 0),
    );
    mark(
      "M8",
      connectionRows.some((row) => filled(parseObject(row.defaultParameters))),
    );

    // Settings profiles
    const ownProfiles = presetRows.filter((row) => row.isDefault !== "true");
    mark("M1", ownProfiles.length);
    mark(
      "M3",
      ownProfiles.some((row) => row.isActive === "true"),
    );

    // Agents
    mark(
      "A2",
      agentRows.some((row) => !BUILT_IN_AGENTS.some((agent) => agent.id === row.type)),
    );

    // Lorebooks
    mark("L1", entryRows.length);
    mark("L2", linkRows.length || lorebookRows.some((row) => !!row.characterId));
    mark(
      "L4",
      lorebookRows.some((row) => filled(row.generatedBy) || filled(row.sourceAgentId)),
    );
    mark(
      "L7",
      lorebookRows.some((row) => row.excludeFromVectorization === "false"),
    );

    // Themes and folders
    const activeTheme = themeRows.find((row) => row.isActive === "true");
    mark("T1", activeTheme && !activeTheme.id.startsWith("starter-"));
    mark("KT1", activeTheme && activeTheme.id.startsWith("starter-"));
    mark(
      "KL1",
      [...folderRows, ...characterGroupRows, ...personaGroupRows].some((row) => filled(row.color) || filled(row.cover)),
    );

    // Noodle and achievements
    mark("X5", noodleRows.length);
    mark(
      "C7",
      unlockRows.some((row) => row.id === "hello_world"),
    );

    return {
      done: [...done].sort(),
      modes: {
        conversation: byMode("conversation").length,
        roleplay: byMode("roleplay").length,
        game: byMode("game").length,
      },
    };
  }

  return { progress };
}

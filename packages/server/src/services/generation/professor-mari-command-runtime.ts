import {
  PROFESSOR_MARI_ID,
  normalizeTextForMatch,
  sanitizeMariGuidedPlan,
  sanitizeMariSuggestionChips,
} from "@marinara-engine/shared";

import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createPromptsStorage } from "../storage/prompts.storage.js";
import {
  type CharacterCommand,
  type CreateCharacterCommand,
  type CreateChatCommand,
  type CreateLorebookCommand,
  type CreatePersonaCommand,
  type CreatePresetCommand,
  type FetchCommand,
  type NavigateCommand,
  type PlanCommand,
  type SuggestionsCommand,
  type UpdateCharacterCommand,
  type UpdateLorebookCommand,
  type UpdatePersonaCommand,
} from "../conversation/character-commands.js";
import { bumpCharacterVersion } from "./generation-text-utils.js";
import {
  MAX_MARI_FETCHED_PRESET_CONTEXT_CHARS,
  normalizeAssistantPresetIdentifier,
  normalizeAssistantPresetOptionId,
  normalizeAssistantPresetVariableName,
  parseMariJsonArray,
  parseMariJsonRecord,
  resolveAssistantPresetInjectionPosition,
  resolveAssistantPresetRole,
  resolveAssistantPresetWrapFormat,
  truncateMariFetchedText,
} from "./assistant-preset-utils.js";
import { parseExtra } from "../../routes/generate/generate-route-utils.js";

const PROFESSOR_MARI_COMMAND_TYPES = new Set([
  "create_persona",
  "create_character",
  "update_character",
  "update_persona",
  "create_lorebook",
  "update_lorebook",
  "create_preset",
  "create_chat",
  "navigate",
  "fetch",
  "suggestions",
  "plan",
]);

type ProfessorMariCommandStores = {
  chars: any;
  chats: any;
  lorebooksStore: any;
  presets: any;
};

export function isProfessorMariCommandType(type: string): boolean {
  return PROFESSOR_MARI_COMMAND_TYPES.has(type);
}

export function countProfessorMariCommands(commands: Array<{ command: CharacterCommand }>): number {
  return commands.filter(({ command }) => isProfessorMariCommandType(command.type)).length;
}

export async function handleProfessorMariCommand(args: {
  command: CharacterCommand;
  characterId: string | null;
  chatId: string;
  sourceChatMetadata: unknown;
  isHomeProfessorMariAssistantChat: boolean;
  db: DB;
  stores: ProfessorMariCommandStores;
  sendAssistantAction: (data: Record<string, unknown>) => void;
}): Promise<{ handled: boolean; fetchSucceeded: boolean }> {
  if (!isProfessorMariCommandType(args.command.type)) return { handled: false, fetchSucceeded: false };

  switch (args.command.type) {
    case "create_persona":
      await createPersona(args.command as CreatePersonaCommand, args);
      break;
    case "create_character":
      await createCharacter(args.command as CreateCharacterCommand, args);
      break;
    case "update_character":
      await updateCharacter(args.command as UpdateCharacterCommand, args);
      break;
    case "update_persona":
      await updatePersona(args.command as UpdatePersonaCommand, args);
      break;
    case "create_lorebook":
      await createLorebook(args.command as CreateLorebookCommand, args);
      break;
    case "update_lorebook":
      await updateLorebook(args.command as UpdateLorebookCommand, args);
      break;
    case "create_preset":
      await createPreset(args.command as CreatePresetCommand, args);
      break;
    case "create_chat":
      await createChat(args.command as CreateChatCommand, args);
      break;
    case "navigate":
      navigate(args.command as NavigateCommand, args);
      break;
    case "fetch":
      return {
        handled: true,
        fetchSucceeded: await fetchProfessorMariContext(args.command as FetchCommand, args),
      };
    case "suggestions":
      sendSuggestions(args.command as SuggestionsCommand, args);
      break;
    case "plan":
      sendPlan(args.command as PlanCommand, args);
      break;
  }

  return { handled: true, fetchSucceeded: false };
}

async function createPersona(command: CreatePersonaCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  try {
    const persona = await args.stores.chars.createPersona(command.name, command.description ?? "", undefined, {
      personality: command.personality,
      appearance: command.appearance,
      aboutMe: command.aboutMe,
    });
    args.sendAssistantAction({ action: "persona_created", id: persona?.id, name: command.name });
    logger.info('[commands] Assistant created persona: "%s" (%s)', command.name, persona?.id);
  } catch (err) {
    logger.error(err, "[commands] Create persona failed");
  }
}

async function createCharacter(command: CreateCharacterCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  try {
    const charData = {
      name: command.name,
      description: command.description ?? "",
      personality: command.personality ?? "",
      first_mes: command.firstMessage ?? "",
      scenario: command.scenario ?? "",
      mes_example: command.mesExample ?? "",
      creator_notes: command.creatorNotes ?? "",
      system_prompt: command.systemPrompt ?? "",
      post_history_instructions: command.postHistoryInstructions ?? "",
      tags: command.tags ?? [],
      creator: command.creator ?? "",
      character_version: command.characterVersion ?? "",
      alternate_greetings: command.alternateGreetings ?? [],
      extensions: {
        talkativeness: command.talkativeness ?? 0.5,
        fav: command.fav ?? false,
        world: command.world ?? "",
        depth_prompt: {
          prompt: command.depthPrompt ?? "",
          depth: command.depthPromptDepth ?? 4,
          role: command.depthPromptRole ?? "system",
        },
        backstory: command.backstory ?? "",
        appearance: command.appearance ?? "",
        aboutMe: command.aboutMe ?? "",
      },
      character_book: null,
    };
    const created = await args.stores.chars.create(charData);
    if (created) {
      args.sendAssistantAction({ action: "character_created", id: created.id, name: command.name });
      logger.info('[commands] Assistant created character: "%s" (%s)', command.name, created.id);
    }
  } catch (err) {
    logger.error(err, "[commands] Create character failed");
  }
}

async function updateCharacter(command: UpdateCharacterCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  try {
    const allCharsList = await args.stores.chars.list();
    const targetChar = allCharsList.find((character: any) => {
      const data = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
      return normalizeTextForMatch(data.name) === normalizeTextForMatch(command.name);
    });
    if (!targetChar) {
      logger.warn('[commands] Update character: "%s" not found', command.name);
      return;
    }

    const latestTargetChar = await args.stores.chars.getById(targetChar.id);
    if (!latestTargetChar) {
      logger.warn('[commands] Update character: "%s" disappeared before update', command.name);
      return;
    }
    const existingData =
      typeof latestTargetChar.data === "string" ? JSON.parse(latestTargetChar.data) : latestTargetChar.data;
    const updates: Record<string, unknown> = {};
    const extensionUpdates: Record<string, unknown> = {};
    if (command.description !== undefined) updates.description = command.description;
    if (command.personality !== undefined) updates.personality = command.personality;
    if (command.firstMessage !== undefined) updates.first_mes = command.firstMessage;
    if (command.scenario !== undefined) updates.scenario = command.scenario;
    if (command.mesExample !== undefined) updates.mes_example = command.mesExample;
    if (command.creatorNotes !== undefined) updates.creator_notes = command.creatorNotes;
    if (command.systemPrompt !== undefined) updates.system_prompt = command.systemPrompt;
    if (command.postHistoryInstructions !== undefined) updates.post_history_instructions = command.postHistoryInstructions;
    if (command.creator !== undefined) updates.creator = command.creator;
    if (command.characterVersion !== undefined) updates.character_version = command.characterVersion;
    if (command.tags !== undefined) updates.tags = command.tags;
    if (command.alternateGreetings !== undefined) updates.alternate_greetings = command.alternateGreetings;
    if (command.backstory !== undefined) extensionUpdates.backstory = command.backstory;
    if (command.appearance !== undefined) extensionUpdates.appearance = command.appearance;
    if (command.aboutMe !== undefined) extensionUpdates.aboutMe = command.aboutMe;
    if (command.talkativeness !== undefined) extensionUpdates.talkativeness = command.talkativeness;
    if (command.fav !== undefined) extensionUpdates.fav = command.fav;
    if (command.world !== undefined) extensionUpdates.world = command.world;
    if (
      command.depthPrompt !== undefined ||
      command.depthPromptDepth !== undefined ||
      command.depthPromptRole !== undefined
    ) {
      const existingDepthPrompt = existingData.extensions?.depth_prompt ?? {};
      extensionUpdates.depth_prompt = {
        ...existingDepthPrompt,
        ...(command.depthPrompt !== undefined ? { prompt: command.depthPrompt } : {}),
        ...(command.depthPromptDepth !== undefined ? { depth: command.depthPromptDepth } : {}),
        ...(command.depthPromptRole !== undefined ? { role: command.depthPromptRole } : {}),
      };
    }
    if (Object.keys(extensionUpdates).length > 0) {
      updates.extensions = { ...(existingData.extensions ?? {}), ...extensionUpdates };
    }
    if (command.characterVersion === undefined && Object.keys(updates).length > 0) {
      updates.character_version = bumpCharacterVersion(existingData.character_version);
    }
    await args.stores.chars.update(targetChar.id, updates, undefined, {
      versionSource: "command",
      versionReason: "Assistant update_character command",
    });
    args.sendAssistantAction({ action: "character_updated", id: targetChar.id, name: command.name });
    logger.info('[commands] Assistant updated character: "%s" (%s)', command.name, targetChar.id);
  } catch (err) {
    logger.error(err, "[commands] Update character failed");
  }
}

async function updatePersona(command: UpdatePersonaCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  try {
    const allPersonas = await args.stores.chars.listPersonas();
    const targetPersona = allPersonas.find(
      (persona: any) => normalizeTextForMatch(persona.name) === normalizeTextForMatch(command.name),
    );
    if (!targetPersona) {
      logger.warn('[commands] Update persona: "%s" not found', command.name);
      return;
    }

    const sets: Record<string, unknown> = {};
    if (command.description !== undefined) sets.description = command.description;
    if (command.personality !== undefined) sets.personality = command.personality;
    if (command.appearance !== undefined) sets.appearance = command.appearance;
    if (command.scenario !== undefined) sets.scenario = command.scenario;
    if (command.backstory !== undefined) sets.backstory = command.backstory;
    if (command.aboutMe !== undefined) sets.aboutMe = command.aboutMe;
    await args.stores.chars.updatePersona(targetPersona.id, sets);
    args.sendAssistantAction({ action: "persona_updated", id: targetPersona.id, name: command.name });
    logger.info('[commands] Assistant updated persona: "%s" (%s)', command.name, targetPersona.id);
  } catch (err) {
    logger.error(err, "[commands] Update persona failed");
  }
}

async function createLorebook(command: CreateLorebookCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  try {
    const category = ["character", "world", "npc", "spellbook"].includes(command.category ?? "")
      ? command.category
      : "uncategorized";
    const created = await args.stores.lorebooksStore.create({
      name: command.name,
      description: command.description ?? "",
      category,
      tags: command.tags ?? [],
      enabled: true,
      generatedBy: "agent",
      sourceAgentId: PROFESSOR_MARI_ID,
    });
    if (!created) return;

    let entryCount = 0;
    for (const entry of command.entries ?? []) {
      await args.stores.lorebooksStore.createEntry({
        lorebookId: created.id,
        name: entry.name,
        content: entry.content ?? "",
        description: entry.description ?? "",
        keys: entry.keys ?? [],
        secondaryKeys: entry.secondaryKeys ?? [],
        tag: entry.tag ?? "",
        constant: entry.constant ?? false,
        selective: entry.selective ?? false,
        enabled: true,
      });
      entryCount += 1;
    }

    args.sendAssistantAction({ action: "lorebook_created", id: created.id, name: command.name, entryCount });
    logger.info('[commands] Assistant created lorebook: "%s" (%s) with %d entries', command.name, created.id, entryCount);
  } catch (err) {
    logger.error(err, "[commands] Create lorebook failed");
  }
}

async function updateLorebook(command: UpdateLorebookCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  try {
    const allLorebooks = await args.stores.lorebooksStore.list();
    const targetLorebook = allLorebooks.find((lorebook: any) => {
      if (lorebook.id === command.name) return true;
      return normalizeTextForMatch(lorebook.name) === normalizeTextForMatch(command.name);
    });

    if (!targetLorebook) {
      logger.warn('[commands] Update lorebook: "%s" not found', command.name);
      return;
    }

    const category = ["character", "world", "npc", "spellbook", "uncategorized"].includes(command.category ?? "")
      ? command.category
      : undefined;
    const lorebookUpdates: Record<string, unknown> = {};
    if (command.newName !== undefined && command.newName.trim()) lorebookUpdates.name = command.newName;
    if (command.description !== undefined) lorebookUpdates.description = command.description;
    if (category !== undefined) lorebookUpdates.category = category;
    if (command.tags !== undefined) lorebookUpdates.tags = command.tags;
    if (Object.keys(lorebookUpdates).length > 0) {
      await args.stores.lorebooksStore.update(targetLorebook.id, lorebookUpdates);
    }

    const existingEntries = (await args.stores.lorebooksStore.listEntries(targetLorebook.id)) as any[];
    const existingByName = new Map(
      existingEntries.map((entry: any) => [
        String(entry.name ?? "")
          .trim()
          .toLowerCase(),
        entry,
      ]),
    );
    let updatedEntryCount = 0;
    let createdEntryCount = 0;

    for (const entry of command.entries ?? []) {
      const matchName = String(entry.matchName || entry.name || "")
        .trim()
        .toLowerCase();
      const existingEntry = existingByName.get(matchName);
      if (existingEntry) {
        const entryUpdates: Record<string, unknown> = {};
        if (entry.name !== undefined) entryUpdates.name = entry.name;
        if (entry.content !== undefined) entryUpdates.content = entry.content;
        if (entry.description !== undefined) entryUpdates.description = entry.description;
        if (entry.keys !== undefined) entryUpdates.keys = entry.keys;
        if (entry.secondaryKeys !== undefined) entryUpdates.secondaryKeys = entry.secondaryKeys;
        if (entry.tag !== undefined) entryUpdates.tag = entry.tag;
        if (entry.constant !== undefined) entryUpdates.constant = entry.constant;
        if (entry.selective !== undefined) entryUpdates.selective = entry.selective;
        if (Object.keys(entryUpdates).length > 0) {
          const updatedEntry = await args.stores.lorebooksStore.updateEntry(existingEntry.id, entryUpdates);
          if (updatedEntry) {
            updatedEntryCount += 1;
            existingByName.delete(matchName);
            existingByName.set(entry.name.trim().toLowerCase(), updatedEntry);
          }
        }
      } else {
        const createdEntry = await args.stores.lorebooksStore.createEntry({
          lorebookId: targetLorebook.id,
          name: entry.name,
          content: entry.content ?? "",
          description: entry.description ?? "",
          keys: entry.keys ?? [],
          secondaryKeys: entry.secondaryKeys ?? [],
          tag: entry.tag ?? "",
          constant: entry.constant ?? false,
          selective: entry.selective ?? false,
          enabled: true,
        });
        if (createdEntry) {
          createdEntryCount += 1;
          existingByName.set(entry.name.trim().toLowerCase(), createdEntry);
        }
      }
    }

    const finalName = command.newName?.trim() || targetLorebook.name || command.name;
    args.sendAssistantAction({
      action: "lorebook_updated",
      id: targetLorebook.id,
      name: finalName,
      updatedEntryCount,
      createdEntryCount,
    });
    logger.info(
      '[commands] Assistant updated lorebook: "%s" (%s), entries updated=%d created=%d',
      finalName,
      targetLorebook.id,
      updatedEntryCount,
      createdEntryCount,
    );
  } catch (err) {
    logger.error(err, "[commands] Update lorebook failed");
  }
}

async function createPreset(command: CreatePresetCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  try {
    const createdPresetAction = await args.db.transaction(async (tx) => {
      const txPresets = createPromptsStorage(tx as unknown as DB);
      const created = await txPresets.create({
        name: command.name,
        description: command.description ?? "",
        wrapFormat: resolveAssistantPresetWrapFormat(command.wrapFormat),
        isDefault: false,
        author: command.author ?? "Professor Mari",
      });
      if (!created) return null;

      const groupIds = new Map<string, string>();
      const groupKey = (name: string) => name.trim().toLowerCase();
      const ensureGroup = async (name: string, order?: number, enabled?: boolean): Promise<string | null> => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const key = groupKey(trimmed);
        const existing = groupIds.get(key);
        if (existing) return existing;
        const group = await txPresets.createGroup({
          presetId: created.id,
          name: trimmed,
          order: order ?? (groupIds.size + 1) * 100,
          enabled: enabled ?? true,
        });
        if (!group) return null;
        groupIds.set(key, group.id);
        return group.id;
      };

      for (const group of command.groups ?? []) await ensureGroup(group.name, group.order, group.enabled);
      for (const group of command.groups ?? []) {
        if (!group.parentGroupName) continue;
        const childId = groupIds.get(groupKey(group.name));
        const parentId = await ensureGroup(group.parentGroupName);
        if (childId && parentId) await txPresets.updateGroup(childId, { parentGroupId: parentId });
      }

      const usedIdentifiers = new Set<string>();
      let sectionCount = 0;
      for (const [index, section] of (command.sections ?? []).entries()) {
        const groupId = section.groupName ? await ensureGroup(section.groupName) : null;
        await txPresets.createSection({
          presetId: created.id,
          identifier: normalizeAssistantPresetIdentifier(section.identifier ?? section.name, index, usedIdentifiers),
          name: section.name,
          content: section.content ?? "",
          role: resolveAssistantPresetRole(section.role),
          enabled: section.enabled ?? true,
          isMarker: false,
          groupId,
          markerConfig: null,
          injectionPosition: resolveAssistantPresetInjectionPosition(section.injectionPosition),
          injectionDepth: Math.max(0, section.injectionDepth ?? 0),
          injectionOrder: section.injectionOrder ?? (index + 1) * 100,
          forbidOverrides: section.forbidOverrides ?? false,
        });
        sectionCount += 1;
      }

      const usedVariableNames = new Set<string>();
      let choiceBlockCount = 0;
      for (const [index, choiceBlock] of (command.choiceBlocks ?? []).entries()) {
        const optionIds = new Set<string>();
        await txPresets.createChoiceBlock({
          presetId: created.id,
          variableName: normalizeAssistantPresetVariableName(choiceBlock.variableName, index, usedVariableNames),
          question: choiceBlock.question,
          options: choiceBlock.options.map((option, optionIndex) => ({
            id: normalizeAssistantPresetOptionId(option.id ?? option.label, optionIndex, optionIds),
            label: option.label,
            value: option.value,
          })),
          multiSelect: choiceBlock.multiSelect ?? false,
          separator: choiceBlock.separator ?? ", ",
          randomPick: choiceBlock.randomPick ?? false,
          displayMode: choiceBlock.displayMode ?? "auto",
          optionSort: choiceBlock.optionSort ?? "manual",
        });
        choiceBlockCount += 1;
      }

      return { id: created.id, name: command.name, sectionCount, choiceBlockCount };
    });

    if (createdPresetAction) {
      args.sendAssistantAction({
        action: "preset_created",
        id: createdPresetAction.id,
        name: createdPresetAction.name,
        sectionCount: createdPresetAction.sectionCount,
        choiceBlockCount: createdPresetAction.choiceBlockCount,
      });
      logger.info(
        '[commands] Assistant created preset: "%s" (%s), sections=%d choiceBlocks=%d',
        createdPresetAction.name,
        createdPresetAction.id,
        createdPresetAction.sectionCount,
        createdPresetAction.choiceBlockCount,
      );
    }
  } catch (err) {
    logger.error(err, "[commands] Create preset failed");
  }
}

async function createChat(command: CreateChatCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  try {
    const allCharsList = await args.stores.chars.list();
    const targetChar = allCharsList.find((character: any) => {
      if (character.id === command.character) return true;
      const data = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
      return normalizeTextForMatch(data.name) === normalizeTextForMatch(command.character);
    });
    if (!targetChar) {
      logger.warn('[commands] Create chat: character "%s" not found', command.character);
      return;
    }

    const targetData = typeof targetChar.data === "string" ? JSON.parse(targetChar.data) : targetChar.data;
    const mode = command.mode ?? "conversation";
    const newChat = await args.stores.chats.create({
      name: `Chat with ${targetData.name}`,
      mode,
      characterIds: [targetChar.id],
      groupId: null,
      personaId: null,
      promptPresetId: null,
      connectionId: null,
    });
    if (newChat) {
      args.sendAssistantAction({
        action: "chat_created",
        chatId: newChat.id,
        chatName: newChat.name ?? `Chat with ${targetData.name}`,
        mode,
        characterName: targetData.name,
      });
      logger.info('[commands] Assistant created %s chat with "%s" (%s)', mode, targetData.name, newChat.id);
    }
  } catch (err) {
    logger.error(err, "[commands] Create chat failed");
  }
}

function navigate(command: NavigateCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  args.sendAssistantAction({ action: "navigate", panel: command.panel, tab: command.tab ?? null });
  logger.info("[commands] Assistant navigate: panel=%s, tab=%s", command.panel, command.tab ?? "none");
}

function sendSuggestions(command: SuggestionsCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  const suggestions = sanitizeMariSuggestionChips(command.suggestions, { maxChips: 6 });
  if (suggestions.length === 0) {
    logger.debug("[commands] Dropped invalid Professor Mari suggestions payload");
    return;
  }
  args.sendAssistantAction({ action: "suggestions", suggestions });
}

function sendPlan(command: PlanCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  const plan = sanitizeMariGuidedPlan(command.plan, { maxSteps: 8, maxChipsPerStep: 5 });
  if (plan.length === 0) {
    logger.debug("[commands] Dropped invalid Professor Mari guided plan payload");
    return;
  }
  args.sendAssistantAction({ action: "plan", plan });
}

async function fetchProfessorMariContext(
  command: FetchCommand,
  args: Parameters<typeof handleProfessorMariCommand>[0],
): Promise<boolean> {
  try {
    const fetchedContent = await resolveFetchedContent(command, args);
    if (!fetchedContent) {
      logger.warn("[commands] Fetch: %s %s not found", command.fetchType, command.name);
      return false;
    }

    const freshChat = await args.stores.chats.getById(args.chatId);
    const currentMeta = freshChat
      ? (parseExtra(freshChat.metadata) as Record<string, unknown>)
      : (parseExtra(args.sourceChatMetadata) as Record<string, unknown>);
    const mariContext = (currentMeta.mariContext as Record<string, string>) ?? {};
    mariContext[`${command.fetchType}:${command.name}`] = fetchedContent;
    currentMeta.mariContext = mariContext;
    await args.stores.chats.updateMetadata(args.chatId, currentMeta);

    args.sendAssistantAction({ action: "data_fetched", fetchType: command.fetchType, name: command.name });
    logger.info('[commands] Assistant fetched %s: "%s"', command.fetchType, command.name);
    return args.isHomeProfessorMariAssistantChat && (args.characterId === PROFESSOR_MARI_ID || args.characterId === null);
  } catch (err) {
    logger.error(err, "[commands] Fetch failed");
    return false;
  }
}

async function resolveFetchedContent(command: FetchCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  if (command.fetchType === "character") return fetchCharacterContent(command, args);
  if (command.fetchType === "persona") return fetchPersonaContent(command, args);
  if (command.fetchType === "lorebook") return fetchLorebookContent(command, args);
  if (command.fetchType === "chat") return fetchChatContent(command, args);
  if (command.fetchType === "preset") return fetchPresetContent(command, args);
  return "";
}

async function fetchCharacterContent(command: FetchCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  const allCharsList = await args.stores.chars.list();
  const found = allCharsList.find((character: any) => {
    const data = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
    return normalizeTextForMatch(data.name) === normalizeTextForMatch(command.name);
  });
  if (!found) return "";

  const data = typeof found.data === "string" ? JSON.parse(found.data) : found.data;
  const parts = [`Name: ${data.name}`];
  if (data.description) parts.push(`Description: ${data.description}`);
  if (data.personality) parts.push(`Personality: ${data.personality}`);
  if (data.extensions?.backstory) parts.push(`Backstory: ${data.extensions.backstory}`);
  if (data.extensions?.appearance) parts.push(`Appearance: ${data.extensions.appearance}`);
  if (data.scenario) parts.push(`Scenario: ${data.scenario}`);
  if (data.mes_example) parts.push(`Example Messages: ${data.mes_example}`);
  if (data.system_prompt) parts.push(`System Prompt: ${data.system_prompt}`);
  if (data.post_history_instructions) parts.push(`Post-History Instructions: ${data.post_history_instructions}`);
  if (data.first_mes) parts.push(`First Message: ${data.first_mes}`);
  if (data.creator_notes) parts.push(`Creator Notes: ${data.creator_notes}`);
  return parts.join("\n");
}

async function fetchPersonaContent(command: FetchCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  const allPersonasList = await args.stores.chars.listPersonas();
  const found = allPersonasList.find(
    (persona: any) => normalizeTextForMatch(persona.name) === normalizeTextForMatch(command.name),
  );
  if (!found) return "";

  const parts = [`Name: ${found.name}`];
  if (found.description) parts.push(`Description: ${found.description}`);
  if (found.personality) parts.push(`Personality: ${found.personality}`);
  if (found.backstory) parts.push(`Backstory: ${found.backstory}`);
  if (found.appearance) parts.push(`Appearance: ${found.appearance}`);
  if (found.scenario) parts.push(`Scenario: ${found.scenario}`);
  return parts.join("\n");
}

async function fetchLorebookContent(command: FetchCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  const allLorebooks = await args.stores.lorebooksStore.list();
  const found = allLorebooks.find(
    (lorebook: any) => normalizeTextForMatch(lorebook.name) === normalizeTextForMatch(command.name),
  );
  if (!found) return "";

  const entries = await args.stores.lorebooksStore.listEntries(found.id);
  const parts = [`Lorebook: ${found.name}`];
  if (found.description) parts.push(`Description: ${found.description}`);
  if (found.category) parts.push(`Category: ${found.category}`);
  parts.push(`Entries (${entries.length}):`);
  for (const entry of entries) {
    parts.push(
      `\n  Entry: ${entry.name}\n  Keys: ${(Array.isArray(entry.keys) ? entry.keys : []).join(", ")}\n  Content: ${entry.content}`,
    );
  }
  return parts.join("\n");
}

async function fetchChatContent(command: FetchCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  const allChats = await args.stores.chats.list();
  const found = allChats.find((chat: any) => normalizeTextForMatch(chat.name) === normalizeTextForMatch(command.name));
  if (!found) return "";

  const parts = [`Chat: ${found.name}`, `Mode: ${found.mode}`];
  const recentMsgs = await args.stores.chats.listMessagesPaginated(found.id, 20);
  if (recentMsgs.length > 0) {
    parts.push(`Recent Messages (${recentMsgs.length}):`);
    for (const msg of recentMsgs) {
      const role = msg.role === "assistant" ? (msg.characterId ? "Character" : "Assistant") : "User";
      parts.push(`  [${role}]: ${(msg.content as string).slice(0, 300)}`);
    }
  }
  return parts.join("\n");
}

async function fetchPresetContent(command: FetchCommand, args: Parameters<typeof handleProfessorMariCommand>[0]) {
  const allPresetsList = await args.stores.presets.list();
  const found = allPresetsList.find(
    (preset: any) => preset.id === command.name || normalizeTextForMatch(preset.name) === normalizeTextForMatch(command.name),
  );
  if (!found) return "";

  const sections = (await args.stores.presets.listSections(found.id)) as any[];
  const groups = (await args.stores.presets.listGroups(found.id)) as any[];
  const choiceBlocks = (await args.stores.presets.listChoiceBlocksForPreset(found.id)) as any[];
  const groupById = new Map<string, any>(groups.map((group: any) => [group.id, group]));
  const parameters = parseMariJsonRecord(found.parameters);
  const defaultChoices = parseMariJsonRecord(found.defaultChoices);
  const parts = [`Preset: ${found.name}`, `ID: ${found.id}`];
  if (found.description) parts.push(`Description: ${found.description}`);
  if (found.author) parts.push(`Author: ${found.author}`);
  parts.push(`Wrap Format: ${found.wrapFormat ?? "xml"}`);
  parts.push(`Default Preset: ${String(found.isDefault) === "true" ? "yes" : "no"}`);
  if (Object.keys(parameters).length > 0) {
    parts.push(`Generation Parameters: ${truncateMariFetchedText(JSON.stringify(parameters), 1200)}`);
  }
  if (Object.keys(defaultChoices).length > 0) {
    parts.push(`Default Choices: ${truncateMariFetchedText(JSON.stringify(defaultChoices), 1200)}`);
  }
  if (groups.length > 0) {
    parts.push(`Groups (${groups.length}):`);
    for (const group of groups) {
      const parent = group.parentGroupId ? groupById.get(group.parentGroupId) : null;
      parts.push(
        `  - ${group.name} (enabled=${String(group.enabled) === "true" ? "true" : "false"}, order=${group.order}, parent=${parent?.name ?? "none"})`,
      );
    }
  }
  parts.push(`Sections (${sections.length}):`);
  for (const section of sections) {
    const group = section.groupId ? groupById.get(section.groupId) : null;
    parts.push(
      [
        `\n  Section: ${section.name ?? "Untitled"}`,
        `  Identifier: ${section.identifier}`,
        `  Role: ${section.role}`,
        `  Enabled: ${String(section.enabled) === "true" ? "true" : "false"}`,
        `  Group: ${group?.name ?? "none"}`,
        `  Injection: ${section.injectionPosition} depth=${section.injectionDepth} order=${section.injectionOrder}`,
        `  Forbid Overrides: ${String(section.forbidOverrides) === "true" ? "true" : "false"}`,
        `  Content:\n${truncateMariFetchedText(section.content, 3000)}`,
      ].join("\n"),
    );
  }
  if (choiceBlocks.length > 0) {
    parts.push(`Choice Blocks (${choiceBlocks.length}):`);
    for (const block of choiceBlocks) {
      const options = parseMariJsonArray(block.options)
        .map((option) => {
          const data = parseMariJsonRecord(option);
          return `${data.label ?? "Option"} => ${truncateMariFetchedText(data.value, 500)}`;
        })
        .join(" | ");
      parts.push(
        [
          `\n  Variable: ${block.variableName}`,
          `  Question: ${block.question}`,
          `  Multi Select: ${String(block.multiSelect) === "true" ? "true" : "false"}`,
          `  Random Pick: ${String(block.randomPick) === "true" ? "true" : "false"}`,
          `  Separator: ${block.separator ?? ", "}`,
          `  Options: ${options}`,
        ].join("\n"),
      );
    }
  }
  return truncateMariFetchedText(parts.join("\n"), MAX_MARI_FETCHED_PRESET_CONTEXT_CHARS);
}

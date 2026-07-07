// ──────────────────────────────────────────────
// Prompt Macro Context Helpers
// ──────────────────────────────────────────────
// Shared helpers for routes that assemble prompts outside the preset
// assembler. Keeps card macros and depth prompts consistent everywhere.
// ──────────────────────────────────────────────

import {
  resolveMacros,
  stripMacroComments,
  type CharacterMacroProfile,
  type CharacterData,
  type MacroContext,
  type ResolveMacroOptions,
  type WrapFormat,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { wrapContent } from "./format-engine.js";
import { sanitizePromptLeaf } from "./prompt-escaping.js";

type PersonaFields = NonNullable<MacroContext["personaFields"]>;

export interface BuildPromptMacroContextInput {
  db: DB;
  characterIds: string[];
  personaName: string;
  personaPhoneticName?: string;
  personaDescription?: string;
  personaFields?: PersonaFields;
  variables?: Record<string, string>;
  groupScenarioOverrideText?: string | null;
  lastInput?: string;
  chatId?: string;
  model?: string;
  lastGenerationType?: string;
  idleDuration?: string;
  timeZone?: string;
}

export interface CharacterMacroData {
  names: string[];
  phoneticNames: string[];
  profiles: NonNullable<MacroContext["characterProfiles"]>;
  profilesById: Map<string, CharacterMacroProfile>;
  primaryFields?: NonNullable<MacroContext["characterFields"]>;
}

export type PromptMacroMessage = {
  id?: string | null;
  content: string;
  characterId?: string | null;
};

export type PromptMacroActivityMessage = {
  id?: string | null;
  role?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export interface MacroResolutionTransaction {
  content: string;
  commit: () => void;
  rollback: () => void;
}

export function resolveMacrosWithVariableSnapshot(
  template: string,
  macroCtx: MacroContext,
  options?: ResolveMacroOptions,
): MacroResolutionTransaction {
  const before = { ...macroCtx.variables };
  const content = resolveMacros(template, macroCtx, options);
  let settled = false;

  const rollback = () => {
    if (settled) return;
    macroCtx.variables = before;
    settled = true;
  };

  const commit = () => {
    settled = true;
  };

  return { content, commit, rollback };
}

function timestampToMillis(value: string | Date | null | undefined): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function formatDurationPart(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function formatPromptIdleDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (totalSeconds < 60) return formatDurationPart(totalSeconds, "second");

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return formatDurationPart(totalMinutes, "minute");

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes > 0
      ? `${formatDurationPart(totalHours, "hour")} ${formatDurationPart(minutes, "minute")}`
      : formatDurationPart(totalHours, "hour");
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0
    ? `${formatDurationPart(days, "day")} ${formatDurationPart(hours, "hour")}`
    : formatDurationPart(days, "day");
}

export function resolvePromptIdleDuration(
  messages: readonly PromptMacroActivityMessage[],
  options: { excludeMessageId?: string | null; now?: Date } = {},
): string {
  const excludeMessageId = options.excludeMessageId?.trim() || null;
  let latestTimestamp: number | null = null;

  for (const message of messages) {
    if (excludeMessageId && message.id === excludeMessageId) continue;
    const createdAt = timestampToMillis(message.createdAt);
    const updatedAt = timestampToMillis(message.updatedAt);
    const timestamp =
      createdAt !== null && updatedAt !== null ? Math.max(createdAt, updatedAt) : (createdAt ?? updatedAt);
    if (timestamp === null) continue;
    if (latestTimestamp === null || timestamp > latestTimestamp) latestTimestamp = timestamp;
  }

  if (latestTimestamp === null) return formatPromptIdleDuration(0);
  return formatPromptIdleDuration((options.now ?? new Date()).getTime() - latestTimestamp);
}

export function resolvePromptLastGenerationType(input: {
  autonomous?: unknown;
  attachments?: unknown;
  generationGuide?: unknown;
  generationGuideSource?: unknown;
  impersonate?: unknown;
  regenerateMessageId?: unknown;
  turnGameBots?: unknown;
  userMessage?: unknown;
}): string {
  if (input.impersonate === true) return "impersonate";
  if (typeof input.regenerateMessageId === "string" && input.regenerateMessageId.trim()) return "regenerate";
  if (input.turnGameBots === true) return "turn_game";
  if (input.autonomous === true) return "autonomous";
  if (typeof input.generationGuide === "string" && input.generationGuide.trim()) {
    const source =
      typeof input.generationGuideSource === "string" && input.generationGuideSource.trim()
        ? input.generationGuideSource.trim()
        : "guided";
    return source === "narrator" ? "guided" : source;
  }

  const hasUserMessage = typeof input.userMessage === "string" && input.userMessage.trim().length > 0;
  const hasAttachments = Array.isArray(input.attachments) && input.attachments.length > 0;
  return hasUserMessage || hasAttachments ? "normal" : "continue";
}

export type PromptDepthEntry = {
  content: string;
  role: "system" | "user" | "assistant";
  depth: number;
};

function parseCharacterData(raw: unknown): CharacterData | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as CharacterData;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as CharacterData;
  return null;
}

export async function resolveCharacterMacroData(db: DB, characterIds: string[]): Promise<CharacterMacroData> {
  if (characterIds.length === 0) return { names: [], phoneticNames: [], profiles: [], profilesById: new Map() };

  const chars = createCharactersStorage(db);
  const names: string[] = [];
  const phoneticNames: string[] = [];
  const profiles: CharacterMacroData["profiles"] = [];
  const profilesById = new Map<string, CharacterMacroProfile>();
  let primaryFields: CharacterMacroData["primaryFields"] | undefined;

  for (const id of characterIds) {
    const row = await chars.getById(id);
    const data = parseCharacterData(row?.data);
    if (!data) continue;

    if (data.name) names.push(data.name);
    const phoneticName =
      typeof data.extensions?.phoneticName === "string" && data.extensions.phoneticName.trim()
        ? data.extensions.phoneticName.trim()
        : "";
    phoneticNames.push(phoneticName || data.name || "Character");

    const description = data.description ?? "";
    const profile = {
      name: data.name ?? "Character",
      phoneticName,
      description,
      personality: data.personality ?? "",
      backstory: data.extensions?.backstory ?? "",
      appearance: data.extensions?.appearance ?? "",
      scenario: data.scenario ?? "",
      example: data.mes_example ?? "",
      systemPrompt: data.system_prompt ?? "",
      postHistoryInstructions: data.post_history_instructions ?? "",
    };

    profiles.push(profile);
    profilesById.set(id, profile);

    if (!primaryFields) {
      primaryFields = {
        phoneticName: profile.phoneticName,
        description: profile.description,
        personality: profile.personality,
        backstory: profile.backstory,
        appearance: profile.appearance,
        scenario: profile.scenario,
        example: profile.example,
        systemPrompt: profile.systemPrompt,
        postHistoryInstructions: profile.postHistoryInstructions,
      };
    }
  }

  return { names, phoneticNames, profiles, profilesById, primaryFields };
}

export async function buildPromptMacroContext(input: BuildPromptMacroContextInput): Promise<MacroContext> {
  const characterMacroData = await resolveCharacterMacroData(input.db, input.characterIds);
  const variables = input.variables ?? {};

  return {
    user: input.personaName || "User",
    userPhonetic: input.personaPhoneticName || input.personaFields?.phoneticName || input.personaName || "User",
    char: characterMacroData.names[0] || "Character",
    charPhonetic: characterMacroData.phoneticNames[0] || characterMacroData.names[0] || "Character",
    characters: characterMacroData.names,
    characterProfiles: characterMacroData.profiles,
    variables,
    lastInput: input.lastInput,
    chatId: input.chatId,
    model: input.model,
    lastGenerationType: input.lastGenerationType,
    idleDuration: input.idleDuration,
    timeZone: input.timeZone,
    characterFields: {
      ...(characterMacroData.primaryFields ?? {}),
      ...(input.groupScenarioOverrideText ? { scenario: input.groupScenarioOverrideText } : {}),
    },
    personaFields: {
      description: input.personaDescription ?? "",
      ...(input.personaFields ?? {}),
    },
  };
}

function characterFieldsFromProfile(profile: CharacterMacroProfile): NonNullable<MacroContext["characterFields"]> {
  return {
    phoneticName: profile.phoneticName ?? "",
    description: profile.description ?? "",
    personality: profile.personality ?? "",
    backstory: profile.backstory ?? "",
    appearance: profile.appearance ?? "",
    scenario: profile.scenario ?? "",
    example: profile.example ?? "",
    systemPrompt: profile.systemPrompt ?? "",
    postHistoryInstructions: profile.postHistoryInstructions ?? "",
  };
}

function macroContextForMessage(
  message: PromptMacroMessage,
  macroCtx: MacroContext,
  profilesById?: ReadonlyMap<string, CharacterMacroProfile>,
): MacroContext {
  const profile = message.characterId ? profilesById?.get(message.characterId) : undefined;
  if (!profile) return macroCtx;

  return {
    ...macroCtx,
    char: profile.name,
    charPhonetic: profile.phoneticName || profile.name,
    characterFields: characterFieldsFromProfile(profile),
  };
}

export function resolvePromptMessageMacros<T extends PromptMacroMessage>(
  messages: T[],
  macroCtx: MacroContext,
  profilesById?: ReadonlyMap<string, CharacterMacroProfile>,
  options: ResolveMacroOptions = { trimResult: false },
): T[] {
  return messages.map((message) => {
    if (!message.content.includes("{{")) return message;

    const messageMacroCtx = macroContextForMessage(message, macroCtx, profilesById);
    const content = resolveMacros(
      message.content,
      {
        ...messageMacroCtx,
        variables: { ...messageMacroCtx.variables },
      },
      {
        trimResult: false,
        ...options,
        randomSeed: message.id ? `${message.id}:${message.content}` : options.randomSeed,
      },
    );
    return content === message.content ? message : { ...message, content };
  });
}

function normalizeDepthPrompt(
  value: unknown,
): { prompt: string; depth: number; role: PromptDepthEntry["role"] } | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
  if (!prompt) return null;

  const rawDepth = Number(raw.depth ?? 4);
  const depth = Number.isFinite(rawDepth) ? Math.max(0, Math.floor(rawDepth)) : 4;
  const role = raw.role === "user" || raw.role === "assistant" || raw.role === "system" ? raw.role : "system";

  return { prompt, depth, role };
}

export async function collectCharacterDepthPromptEntries(
  db: DB,
  characterIds: string[],
  macroCtx: MacroContext,
): Promise<PromptDepthEntry[]> {
  if (characterIds.length === 0) return [];

  const chars = createCharactersStorage(db);
  const entries: PromptDepthEntry[] = [];

  for (const id of characterIds) {
    const row = await chars.getById(id);
    const data = parseCharacterData(row?.data);
    const depthPrompt = normalizeDepthPrompt(data?.extensions?.depth_prompt);
    if (!depthPrompt) continue;

    const content = resolveMacros(depthPrompt.prompt, {
      ...macroCtx,
      char: data?.name ?? macroCtx.char,
      charPhonetic: data?.extensions?.phoneticName ?? macroCtx.charPhonetic,
      characterFields: {
        phoneticName: data?.extensions?.phoneticName ?? "",
        description: data?.description ?? "",
        personality: data?.personality ?? "",
        backstory: data?.extensions?.backstory ?? "",
        appearance: data?.extensions?.appearance ?? "",
        scenario: data?.scenario ?? "",
        example: data?.mes_example ?? "",
        systemPrompt: data?.system_prompt ?? "",
        postHistoryInstructions: data?.post_history_instructions ?? "",
      },
    });

    if (content.trim()) {
      entries.push({ content, role: depthPrompt.role, depth: depthPrompt.depth });
    }
  }

  return entries;
}

export async function collectCharacterPostHistoryEntries(
  db: DB,
  characterIds: string[],
  macroCtx: MacroContext,
  wrapFormat: WrapFormat,
): Promise<PromptDepthEntry[]> {
  if (characterIds.length === 0) return [];

  const chars = createCharactersStorage(db);
  const entries: PromptDepthEntry[] = [];
  const multiCharacter = characterIds.length > 1;

  for (const id of characterIds) {
    const row = await chars.getById(id);
    const data = parseCharacterData(row?.data);
    const raw = stripMacroComments(data?.post_history_instructions ?? "").trim();
    if (!data || !raw) continue;

    const content = resolveMacros(raw, {
      ...macroCtx,
      char: data.name ?? macroCtx.char,
      charPhonetic: data.extensions?.phoneticName ?? macroCtx.charPhonetic,
      characterFields: {
        phoneticName: data.extensions?.phoneticName ?? "",
        description: data.description ?? "",
        personality: data.personality ?? "",
        backstory: data.extensions?.backstory ?? "",
        appearance: data.extensions?.appearance ?? "",
        scenario: data.scenario ?? "",
        example: data.mes_example ?? "",
        systemPrompt: data.system_prompt ?? "",
        postHistoryInstructions: data.post_history_instructions ?? "",
      },
    }).trim();

    if (content) {
      const label = multiCharacter ? `${data.name ?? "Character"} post-history instructions` : "post-history instructions";
      entries.push({
        content: wrapContent(sanitizePromptLeaf(content, wrapFormat), label, wrapFormat),
        role: "user",
        depth: 0,
      });
    }
  }

  return entries;
}

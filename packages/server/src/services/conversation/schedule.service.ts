// ──────────────────────────────────────────────
// Conversation: Schedule Service
// ──────────────────────────────────────────────
// Generates and manages weekly schedules for characters in Conversation mode.
// Schedules are stored in chat metadata and drive the status system.

import { createLLMProvider } from "../llm/provider-registry.js";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import {
  CONVERSATION_SCHEDULE_DAYS,
  getActiveStatusOverride,
  getCurrentStatus,
  getEffectiveCurrentStatus,
  type CharacterSchedules,
  type ConversationMessageIntent,
  type ConversationPresenceStatus,
  type ConversationStatusOverride,
  type CurrentConversationStatus,
  type DaySchedule,
  type ScheduleBlock,
  type WeekSchedule,
} from "@marinara-engine/shared";

// The schedule/override status-derivation helpers and their schedule types now
// live in @marinara-engine/shared so the client presence dots derive status the
// same way the server does. Re-export them here so existing server imports from
// "./schedule.service.js" keep resolving unchanged.
export { getActiveStatusOverride, getCurrentStatus, getEffectiveCurrentStatus };
export type { CharacterSchedules, ConversationMessageIntent, CurrentConversationStatus, DaySchedule, ScheduleBlock, WeekSchedule };

// ── Constants ──

const DAYS = CONVERSATION_SCHEDULE_DAYS;

export type WeekScheduleDraftMode = "rewrite" | "adjust" | "vary" | "repair";

export type WeekScheduleDraftOptions = {
  draftMode?: WeekScheduleDraftMode;
};

const STATUS_KEYWORDS: Record<string, ConversationPresenceStatus> = {
  sleep: "offline",
  sleeping: "offline",
  nap: "offline",
  napping: "offline",
  rest: "offline",
  resting: "offline",
  work: "dnd",
  working: "dnd",
  class: "dnd",
  classes: "dnd",
  school: "dnd",
  studying: "dnd",
  study: "dnd",
  meeting: "dnd",
  training: "dnd",
  exercise: "dnd",
  gym: "dnd",
  busy: "dnd",
  commute: "idle",
  commuting: "idle",
  driving: "idle",
  travel: "idle",
  traveling: "idle",
  shower: "idle",
  showering: "idle",
  cooking: "idle",
  eating: "idle",
  meal: "idle",
};

function summarizeWeekForPrompt(schedule: WeekSchedule): string[] {
  return DAYS.map((day) => {
    const blocks = schedule.days[day] ?? [];
    const summary = blocks.map((block) => `${block.time} ${block.status ?? "online"} ${block.activity}`).join("; ");
    return `${day}: ${summary || "unscheduled"}`;
  });
}

function summarizeScheduleExcept(schedule: WeekSchedule, excludedDay: string): string[] {
  return DAYS.filter((day) => day !== excludedDay).map((day) => {
    const blocks = schedule.days[day] ?? [];
    const summary = blocks.map((block) => `${block.time} ${block.status ?? "online"} ${block.activity}`).join("; ");
    return `${day}: ${summary || "unscheduled"}`;
  });
}

function summarizeBlocks(blocks: DaySchedule): string[] {
  return blocks.length > 0 ? blocks.map((block) => `- ${block.time} ${block.status ?? "online"} ${block.activity}`) : ["- unscheduled"];
}

function getWeekDraftModeInstructions(draftMode: WeekScheduleDraftMode): string[] {
  if (draftMode === "adjust") {
    return [
      `Draft action: Adjust current week.`,
      `Use the current draft as the base routine. Preserve most daily structure unless the user's guidance conflicts with it.`,
      `Make targeted changes that clearly satisfy the guidance without rewriting unrelated days for novelty.`,
    ];
  }
  if (draftMode === "vary") {
    return [
      `Draft action: Vary current week.`,
      `Use the current draft as context, but make the new week visibly different.`,
      `Change time ranges, activities, and status mix while keeping the routine plausible for the character.`,
    ];
  }
  if (draftMode === "repair") {
    return [
      `Draft action: Repair current week.`,
      `Treat the current draft as the source of truth. Minimize creative changes.`,
      `Fix incomplete 24-hour coverage, invalid ranges, obvious status/activity mismatches, overlaps, and gaps.`,
      `Only change activities or timing when needed to make the schedule valid and coherent.`,
    ];
  }
  return [
    `Draft action: Rewrite week.`,
    `Create a fresh full-week schedule based on the character and any user guidance.`,
  ];
}

function getWeekScheduleTemperature(draftMode: WeekScheduleDraftMode): number {
  if (draftMode === "repair") return 0.45;
  if (draftMode === "adjust") return 0.7;
  if (draftMode === "vary") return 0.9;
  return 0.8;
}

// ── Schedule Generation ──

/**
 * Generate a weekly schedule for a character using the LLM.
 */
export async function generateCharacterSchedule(
  provider: BaseLLMProvider,
  model: string,
  characterName: string,
  characterDescription: string,
  characterPersonality: string,
  userSchedulePreferences?: string,
  recentContinuityContext?: string,
  options: WeekScheduleDraftOptions = {},
): Promise<{ schedule: Omit<WeekSchedule, "weekStart">; raw: string }> {
  const draftMode = options.draftMode ?? "rewrite";
  const systemPrompt = [
    `You are a schedule generator. Create a realistic weekly schedule for a character based on their personality and description.`,
    ``,
    `Character: ${characterName}`,
    `Description: ${characterDescription}`,
    `Personality: ${characterPersonality}`,
    ``,
    ...getWeekDraftModeInstructions(draftMode),
    ``,
    ...(recentContinuityContext?.trim()
      ? [
          `Recent continuity:`,
          `This is not the first schedule for this character. Use the following recent memories, summaries, and previous routine to update the new week.`,
          `If recent events changed the character's job, school, health, relationship status, location, obligations, sleep pattern, or priorities, reflect those changes in the schedule.`,
          `If the continuity does not imply a durable routine change, preserve the character's established lifestyle.`,
          `<recent_continuity>`,
          recentContinuityContext.trim(),
          `</recent_continuity>`,
          ``,
        ]
      : []),
    ...(userSchedulePreferences?.trim()
      ? [
          `User preferences:`,
          `The person using this app has provided the following scheduling guidance.`,
          `Honor these preferences even when they would override typical patterns for this character:`,
          userSchedulePreferences.trim(),
          ``,
        ]
      : []),
    `Generate a schedule for each day of the week (Monday through Sunday).`,
    `Each day should have time blocks covering the full 24 hours.`,
    `The schedule should be realistic and consistent with the character's lifestyle.`,
    ``,
    `Each time block must include a "status" field indicating the character's availability:`,
    `- "online": awake and available (free time, socializing, casual activities)`,
    `- "idle": semi-available (eating, commuting, showering, cooking)`,
    `- "dnd": busy / do not disturb (working, studying, training, in a meeting, focused tasks)`,
    `- "offline": unavailable (sleeping, passed out, unconscious, dead to the world)`,
    ``,
    `Also assess the character's talkativeness on a scale of 0-100:`,
    `- 0-20: Very introverted, rarely initiates conversation`,
    `- 21-40: Quiet, only messages when they have something to say`,
    `- 41-60: Average, checks in now and then`,
    `- 61-80: Social, likes to chat frequently`,
    `- 81-100: Very chatty, always wants to talk`,
    ``,
    `And estimate how long (in minutes) this character would wait before messaging someone who hasn't replied:`,
    `- Very patient characters: 180-360 minutes`,
    `- Average characters: 60-180 minutes`,
    `- Impatient/chatty characters: 15-60 minutes`,
    ``,
    `RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no code blocks, just raw JSON).`,
    `Include ALL 7 days (Monday through Sunday), each with time blocks covering the full 24 hours.`,
    `Example for one day:`,
    `{`,
    `  "talkativeness": 65,`,
    `  "inactivityThresholdMinutes": 45,`,
    `  "days": {`,
    `    "Monday": [`,
    `      { "time": "00:00-07:00", "activity": "sleeping", "status": "offline" },`,
    `      { "time": "07:00-08:00", "activity": "morning routine", "status": "idle" },`,
    `      { "time": "08:00-12:00", "activity": "working", "status": "dnd" },`,
    `      { "time": "12:00-13:00", "activity": "lunch break", "status": "idle" },`,
    `      { "time": "13:00-17:00", "activity": "working", "status": "dnd" },`,
    `      { "time": "17:00-19:00", "activity": "free time", "status": "online" },`,
    `      { "time": "19:00-20:00", "activity": "dinner", "status": "idle" },`,
    `      { "time": "20:00-23:00", "activity": "relaxing", "status": "online" },`,
    `      { "time": "23:00-00:00", "activity": "getting ready for bed", "status": "idle" }`,
    `    ]`,
    `  }`,
    `}`,
    `Follow this exact structure for all 7 days. Do NOT use ellipsis, comments, or placeholders.`,
  ].join("\n");

  const scheduleMaxTokens = provider.maxTokensOverrideValue ?? 8192;
  const result = await provider.chatComplete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the schedule now." },
    ],
    { model, temperature: getWeekScheduleTemperature(draftMode), maxTokens: scheduleMaxTokens },
  );

  const content = result.content ?? "";
  const parsed = parseScheduleResponse(content);
  return { schedule: parsed, raw: content };
}

export async function generateCharacterDaySchedule(
  provider: BaseLLMProvider,
  model: string,
  characterName: string,
  characterDescription: string,
  characterPersonality: string,
  day: string,
  currentSchedule: WeekSchedule,
  userSchedulePreferences?: string,
  daySchedulePreferences?: string,
): Promise<{ blocks: DaySchedule; raw: string }> {
  const globalGuidance = userSchedulePreferences?.trim() ?? "";
  const dayGuidance = daySchedulePreferences?.trim() ?? "";
  const systemPrompt = [
    `You are a schedule editor. Replace exactly one day of a fictional character's weekly routine.`,
    ``,
    `Character: ${characterName}`,
    `Description: ${characterDescription}`,
    `Personality: ${characterPersonality}`,
    ``,
    `Requested day to replace: ${day}`,
    ...(globalGuidance ? [``, `Global routine guidance:`, globalGuidance] : []),
    ...(dayGuidance ? [``, `Specific ${day} guidance:`, dayGuidance] : []),
    ``,
    `Old ${day} to replace. Do not copy it:`,
    ...summarizeBlocks(currentSchedule.days[day] ?? []),
    ``,
    `Other days are consistency context only. Do not regenerate them:`,
    ...summarizeScheduleExcept(currentSchedule, day),
    ``,
    `Return a materially different ${day} unless the specific guidance explicitly asks for a tiny adjustment.`,
    `Make visible changes to time ranges, activities, or status mix while keeping the day plausible for this character.`,
    `If there is specific ${day} guidance, prioritize it over the global guidance.`,
    `Return only JSON in this exact shape:`,
    `{ "blocks": [ { "time": "00:00-07:00", "activity": "sleeping", "status": "offline" } ] }`,
    `The blocks must cover the full 24 hours for ${day}.`,
    `Valid statuses are "online", "idle", "dnd", and "offline".`,
    `Do not include markdown, comments, explanations, or extra keys.`,
  ].join("\n");

  const result = await provider.chatComplete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: dayGuidance ? `Apply this ${day} guidance: ${dayGuidance}` : `Create a visibly different ${day}.` },
    ],
    { model, temperature: 0.9, maxTokens: Math.min(provider.maxTokensOverrideValue ?? 4096, 4096) },
  );

  const content = result.content ?? "";
  return { blocks: parseDayScheduleResponse(content), raw: content };
}

export async function generateScheduleRoutineSummary(
  provider: BaseLLMProvider,
  model: string,
  characterName: string,
  schedule: WeekSchedule,
  userSchedulePreferences?: string,
): Promise<{ summary: string; raw: string }> {
  const systemPrompt = [
    `You summarize a fictional character's weekly autonomous conversation routine.`,
    `Write one vivid but concise sentence, maximum 45 words.`,
    `Focus on availability patterns, busy periods, offline periods, and when the character seems open.`,
    `Do not explain app mechanics. Do not mention JSON, schedules, or the user.`,
    `Do not invent lore beyond the routine. Output plain text only.`,
    ``,
    `Character: ${characterName}`,
    ...(userSchedulePreferences?.trim() ? [``, `User guidance:`, userSchedulePreferences.trim()] : []),
    ``,
    `Routine:`,
    ...summarizeWeekForPrompt(schedule),
  ].join("\n");

  const result = await provider.chatComplete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Summarize the routine." },
    ],
    { model, temperature: 0.55, maxTokens: Math.min(provider.maxTokensOverrideValue ?? 512, 512) },
  );
  const summary = (result.content ?? "").replace(/^```(?:text)?/i, "").replace(/```$/i, "").trim();
  if (!summary) throw new Error("Routine summary was empty");
  return { summary: summary.slice(0, 360), raw: result.content ?? "" };
}

/**
 * Parse the LLM's schedule response into a structured format.
 */
function parseScheduleResponse(content: string): Omit<WeekSchedule, "weekStart"> {
  const data = parseRepairedJson<{
    talkativeness?: number;
    inactivityThresholdMinutes?: number;
    days?: Record<string, Array<{ time: string; activity: string; status?: string }>>;
  }>(content);

  const VALID_STATUSES = new Set(["online", "idle", "dnd", "offline"] as const);
  type ValidStatus = "online" | "idle" | "dnd" | "offline";
  const days: Record<string, DaySchedule> = {};
  for (const day of DAYS) {
    const dayData = data.days?.[day] ?? [];
    days[day] = dayData.map((block) => ({
      time: block.time,
      activity: block.activity,
      status:
        block.status && VALID_STATUSES.has(block.status as ValidStatus)
          ? (block.status as ValidStatus)
          : inferStatusFromActivity(block.activity),
    }));
  }

  return {
    days,
    talkativeness: Math.max(0, Math.min(100, data.talkativeness ?? 50)),
    inactivityThresholdMinutes: Math.max(15, Math.min(360, data.inactivityThresholdMinutes ?? 120)),
  };
}

function extractJsonObject(content: string): string {
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1]!.trim();
  const braceStart = jsonStr.indexOf("{");
  const braceEnd = jsonStr.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1) {
    jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
  }
  return jsonStr
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,\s*([\]\}])/g, "$1")
    .replace(/\.{3,}[^"}\]\n]*/g, "")
    .replace(/\n\s*\n/g, "\n");
}

function parseRepairedJson<T>(content: string): T {
  const jsonStr = extractJsonObject(content);
  try {
    return JSON.parse(jsonStr) as T;
  } catch (firstError) {
    const repairedLines = jsonStr.split("\n").filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^[{}\[\],]/.test(trimmed)) return true;
      if (/^"/.test(trimmed)) return true;
      if (/^\d/.test(trimmed)) return true;
      if (/^[}\]]/.test(trimmed)) return true;
      return false;
    });
    const repairedStr = repairedLines.join("\n").replace(/,\s*([\]\}])/g, "$1");
    try {
      return JSON.parse(repairedStr) as T;
    } catch {
      throw firstError;
    }
  }
}

function parseDayScheduleResponse(content: string): DaySchedule {
  const data = parseRepairedJson<{
    blocks?: Array<{ time?: string; activity?: string; status?: string }>;
  }>(content);
  const validStatuses = new Set(["online", "idle", "dnd", "offline"] as const);
  type ValidStatus = "online" | "idle" | "dnd" | "offline";
  return (data.blocks ?? []).map((block) => {
    const activity = typeof block.activity === "string" && block.activity.trim() ? block.activity.trim() : "free time";
    return {
      time: typeof block.time === "string" ? block.time : "00:00-00:00",
      activity,
      status:
        block.status && validStatuses.has(block.status as ValidStatus)
          ? (block.status as ValidStatus)
          : inferStatusFromActivity(activity),
    };
  });
}

/**
 * Infer a conversation status from an activity description.
 */
function inferStatusFromActivity(activity: string): ConversationPresenceStatus {
  const lower = activity.toLowerCase();
  for (const [keyword, status] of Object.entries(STATUS_KEYWORDS)) {
    if (lower.includes(keyword)) return status;
  }
  // Default: if it's a leisure/free activity, the character is online
  return "online";
}

// ── Status Derivation ──
// getCurrentStatus / getActiveStatusOverride / getEffectiveCurrentStatus moved to
// @marinara-engine/shared (utils/conversation-presence) — imported + re-exported above.

/**
 * Get a human-readable summary of today's schedule for a character.
 */
export function getTodaySchedule(schedule: WeekSchedule, now: Date = new Date()): string {
  const dayName = DAYS[(now.getDay() + 6) % 7]!;
  const daySchedule = schedule.days[dayName];
  if (!daySchedule || daySchedule.length === 0) return "";
  return daySchedule.map((b) => `${b.time}: ${b.activity}`).join(", ");
}

/**
 * Check if a schedule needs regeneration (older than 7 days from current Monday).
 */
export function scheduleNeedsRefresh(schedule: WeekSchedule, now: Date = new Date()): boolean {
  const weekStart = new Date(schedule.weekStart);
  const currentMonday = getMonday(now);
  return currentMonday.getTime() > weekStart.getTime();
}

/**
 * Get the Monday of the current week at 00:00.
 */
export function getMonday(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate a delay in milliseconds for a "busy" character's response.
 * Returns 0 for online characters, 2-5 minutes for busy characters.
 */
function getConfiguredResponseDelayMinutes(
  status: ConversationPresenceStatus,
  schedule?: Pick<WeekSchedule, "idleResponseDelayMinutes" | "dndResponseDelayMinutes">,
): number | null {
  const rawValue =
    status === "idle"
      ? schedule?.idleResponseDelayMinutes
      : status === "dnd"
        ? schedule?.dndResponseDelayMinutes
        : null;
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return null;
  }
  return Math.max(0, Math.min(120, rawValue));
}

function getConfiguredResponseDelay(
  status: ConversationPresenceStatus,
  schedule?: Pick<WeekSchedule, "idleResponseDelayMinutes" | "dndResponseDelayMinutes">,
): number {
  const overrideMinutes = getConfiguredResponseDelayMinutes(status, schedule);
  if (overrideMinutes !== null) {
    return overrideMinutes * 60 * 1000;
  }

  switch (status) {
    case "online":
      return 0;
    case "idle":
      return (60 + Math.random() * 120) * 1000; // 1-3 minutes
    case "dnd":
      return (120 + Math.random() * 180) * 1000; // 2-5 minutes
    case "offline":
      return 0; // Shouldn't respond at all when offline
  }
}

export function getBusyDelay(
  status: ConversationPresenceStatus,
  schedule?: Pick<WeekSchedule, "idleResponseDelayMinutes" | "dndResponseDelayMinutes">,
): number {
  return getConfiguredResponseDelay(status, schedule);
}

/**
 * Shorter delay for direct user messages (user is actively waiting).
 * Returns 0 for online, shorter delays for idle/dnd than autonomous delays.
 */
export function getDirectMessageDelay(
  status: ConversationPresenceStatus,
  schedule?: Pick<WeekSchedule, "idleResponseDelayMinutes" | "dndResponseDelayMinutes">,
): number {
  return getConfiguredResponseDelay(status, schedule);
}

/**
 * Reduced delay when the user @mentions a character.
 * Acts as an urgent ping: idle characters respond almost immediately,
 * DND characters respond faster (but not instantly — they're still busy).
 * Offline characters still won't respond (handled elsewhere).
 */
export function getMentionDelay(status: ConversationPresenceStatus): number {
  switch (status) {
    case "online":
      return 0;
    case "idle":
      return (5 + Math.random() * 10) * 1000; // 5-15 seconds
    case "dnd":
      return (30 + Math.random() * 60) * 1000; // 30-90 seconds
    case "offline":
      return 0;
  }
}

export function getAdjacentBlocks(
  schedule: WeekSchedule,
  now: Date = new Date(),
): { previous: ScheduleBlock | null; current: ScheduleBlock | null; next: ScheduleBlock | null } {
  const todayName = DAYS[(now.getDay() + 6) % 7]!;
  const yesterdayName = DAYS[(now.getDay() + 5) % 7]!;
  const tomorrowName = DAYS[now.getDay() % 7]!;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  function parseBlockMinutes(block: ScheduleBlock): { start: number; end: number } | null {
    const [startStr, endStr] = block.time.split("-");
    if (!startStr || !endStr) return null;
    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    const start = (sh ?? 0) * 60 + (sm ?? 0);
    const end = (eh ?? 0) * 60 + (em ?? 0);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { start, end };
  }

  const candidates: Array<{ block: ScheduleBlock; start: number; end: number }> = [];
  const addBlocks = (blocks: ScheduleBlock[] | undefined, dayOffset: number) => {
    for (const block of blocks ?? []) {
      const range = parseBlockMinutes(block);
      if (!range) continue;
      const start = dayOffset * 1440 + range.start;
      let end = dayOffset * 1440 + range.end;
      if (range.end <= range.start) end += 1440;
      candidates.push({ block, start, end });
    }
  };

  addBlocks(schedule.days[yesterdayName], -1);
  addBlocks(schedule.days[todayName], 0);
  addBlocks(schedule.days[tomorrowName], 1);
  candidates.sort((a, b) => a.start - b.start);

  let previous: ScheduleBlock | null = null;
  let current: ScheduleBlock | null = null;
  let next: ScheduleBlock | null = null;
  for (const candidate of candidates) {
    if (candidate.start <= currentMinutes && currentMinutes < candidate.end) {
      current = candidate.block;
      continue;
    }
    if (candidate.end <= currentMinutes) {
      previous = candidate.block;
      continue;
    }
    if (!next && candidate.start > currentMinutes) {
      next = candidate.block;
    }
  }

  return { previous, current, next };
}

export function blockDurationMinutes(block: ScheduleBlock): number {
  const [startStr, endStr] = block.time.split("-");
  if (!startStr || !endStr) return 0;
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const start = (sh ?? 0) * 60 + (sm ?? 0);
  const end = (eh ?? 0) * 60 + (em ?? 0);
  return end > start ? end - start : 1440 - start + end;
}

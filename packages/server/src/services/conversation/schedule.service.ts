// ──────────────────────────────────────────────
// Conversation: Schedule Service
// ──────────────────────────────────────────────
// Generates and manages weekly schedules for characters in Conversation mode.
// Schedules are stored in chat metadata and drive the status system.

import { createLLMProvider } from "../llm/provider-registry.js";
import type { BaseLLMProvider } from "../llm/base-provider.js";

// ── Types ──

/** A single time block in a character's daily schedule */
export interface ScheduleBlock {
  /** Hour range, e.g. "06:00-08:00" */
  time: string;
  /** What the character is doing */
  activity: string;
  /** Derived status for this block */
  status: "online" | "idle" | "dnd" | "offline";
}

/** One day of a character's schedule */
export type DaySchedule = ScheduleBlock[];

/** Full weekly schedule for a character */
export interface WeekSchedule {
  /** ISO date string of the Monday this schedule starts */
  weekStart: string;
  /** Schedules keyed by day name */
  days: Record<string, DaySchedule>;
  /** How many minutes of user inactivity before this character messages unprompted (0 = never) */
  inactivityThresholdMinutes: number;
  /** Optional exact response delay in minutes while idle */
  idleResponseDelayMinutes?: number;
  /** Optional exact response delay in minutes while busy / DND */
  dndResponseDelayMinutes?: number;
  /** How chatty the character is — affects autonomous messaging frequency (0-100) */
  talkativeness: number;
}

/** All character schedules stored in chat metadata */
export interface CharacterSchedules {
  [characterId: string]: WeekSchedule;
}

// ── Constants ──

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const STATUS_KEYWORDS: Record<string, "online" | "idle" | "dnd" | "offline"> = {
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
): Promise<{ schedule: Omit<WeekSchedule, "weekStart">; raw: string }> {
  const systemPrompt = [
    `You are a schedule generator. Create a realistic weekly schedule for a character based on their personality and description.`,
    ``,
    `Character: ${characterName}`,
    `Description: ${characterDescription}`,
    `Personality: ${characterPersonality}`,
    ``,
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

  const result = await provider.chatComplete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the schedule now." },
    ],
    { model, temperature: 0.8, maxTokens: 8192 },
  );

  const content = result.content ?? "";
  const parsed = parseScheduleResponse(content);
  return { schedule: parsed, raw: content };
}

/**
 * Parse the LLM's schedule response into a structured format.
 */
function parseScheduleResponse(content: string): Omit<WeekSchedule, "weekStart"> {
  // Try to extract JSON from response (handle markdown code blocks)
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1]!.trim();

  // Try to find raw JSON object
  const braceStart = jsonStr.indexOf("{");
  const braceEnd = jsonStr.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1) {
    jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
  }

  // Repair common LLM JSON issues: trailing commas, comments, ellipsis, unquoted keys
  jsonStr = jsonStr
    .replace(/\/\/[^\n]*/g, "") // remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // remove multi-line comments
    .replace(/,\s*([\]\}])/g, "$1") // remove trailing commas before ] or }
    .replace(/\.{3,}[^"}\]\n]*/g, "") // remove ...etc / ... continuations (not inside strings)
    .replace(/\n\s*\n/g, "\n"); // collapse blank lines left by removals

  let data: {
    talkativeness?: number;
    inactivityThresholdMinutes?: number;
    days?: Record<string, Array<{ time: string; activity: string; status?: string }>>;
  };

  try {
    data = JSON.parse(jsonStr);
  } catch (firstError) {
    // Second pass: more aggressive repair — remove any lines that aren't valid JSON structure
    // This catches things like "// ..." or bare text the LLM added inside the JSON
    const repairedLines = jsonStr.split("\n").filter((line) => {
      const trimmed = line.trim();
      // Keep lines that look like JSON structure (braces, brackets, key-value pairs, commas)
      if (!trimmed) return false;
      if (/^[{}\[\],]/.test(trimmed)) return true;
      if (/^"/.test(trimmed)) return true;
      if (/^\d/.test(trimmed)) return true;
      if (/^[}\]]/.test(trimmed)) return true;
      return false;
    });
    const repairedStr = repairedLines.join("\n").replace(/,\s*([\]\}])/g, "$1");
    try {
      data = JSON.parse(repairedStr);
    } catch {
      // If still failing, throw the original error with context
      throw firstError;
    }
  }

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

/**
 * Infer a conversation status from an activity description.
 */
function inferStatusFromActivity(activity: string): "online" | "idle" | "dnd" | "offline" {
  const lower = activity.toLowerCase();
  for (const [keyword, status] of Object.entries(STATUS_KEYWORDS)) {
    if (lower.includes(keyword)) return status;
  }
  // Default: if it's a leisure/free activity, the character is online
  return "online";
}

// ── Status Derivation ──

/**
 * Get the current status and activity for a character based on their schedule.
 */
export function getCurrentStatus(
  schedule: WeekSchedule,
  now: Date = new Date(),
): { status: "online" | "idle" | "dnd" | "offline"; activity: string } {
  const dayName = DAYS[(now.getDay() + 6) % 7]!; // JS Sunday=0, we want Monday=0
  const daySchedule = schedule.days[dayName];
  if (!daySchedule || daySchedule.length === 0) {
    return { status: "online", activity: "free time" };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const block of daySchedule) {
    const [startStr, endStr] = block.time.split("-");
    if (!startStr || !endStr) continue;

    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    const startMin = (sh ?? 0) * 60 + (sm ?? 0);
    const endMin = (eh ?? 0) * 60 + (em ?? 0);

    // Handle blocks that don't wrap around midnight
    if (startMin <= currentMinutes && currentMinutes < endMin) {
      return { status: block.status, activity: block.activity };
    }
    // Handle midnight-wrapping blocks (e.g., 23:00-07:00)
    if (startMin > endMin && (currentMinutes >= startMin || currentMinutes < endMin)) {
      return { status: block.status, activity: block.activity };
    }
  }

  return { status: "online", activity: "free time" };
}

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
  status: "online" | "idle" | "dnd" | "offline",
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
  status: "online" | "idle" | "dnd" | "offline",
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
  status: "online" | "idle" | "dnd" | "offline",
  schedule?: Pick<WeekSchedule, "idleResponseDelayMinutes" | "dndResponseDelayMinutes">,
): number {
  return getConfiguredResponseDelay(status, schedule);
}

/**
 * Shorter delay for direct user messages (user is actively waiting).
 * Returns 0 for online, shorter delays for idle/dnd than autonomous delays.
 */
export function getDirectMessageDelay(
  status: "online" | "idle" | "dnd" | "offline",
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
export function getMentionDelay(status: "online" | "idle" | "dnd" | "offline"): number {
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

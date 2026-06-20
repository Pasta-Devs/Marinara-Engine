// ──────────────────────────────────────────────
// Conversation: Autonomous Messaging Service
// ──────────────────────────────────────────────
// Tracks user inactivity per chat and determines when characters
// should send autonomous messages. Also handles character-to-character
// exchanges in group chats.

import { getCurrentStatus, type WeekSchedule } from "./schedule.service.js";

// ── Types ──

export interface AutonomousCheckResult {
  /** Whether an autonomous message should be triggered */
  shouldTrigger: boolean;
  /** Which character(s) should send a message */
  characterIds: string[];
  /** Why this was triggered */
  reason: "user_inactivity" | "user_reaction" | "character_exchange" | "none";
  /** How long the user has been inactive (ms) */
  inactivityMs: number;
}

export type AutonomousClientPresenceStatus = "active" | "idle" | "dnd";

/** Auto-reset generationInProgress after this many ms (5 minutes) */
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * A lone user reaction (no text after it) lets the first autonomous response fire
 * after this fraction of the character's normal quiet threshold — snappier than
 * plain silence, since the user actively engaged…
 */
const REACTION_GATE_FRACTION = 0.34;
/** …but never sooner than this, so a character never reacts within a few seconds. */
const REACTION_MIN_GATE_MS = 30 * 1000;

export interface ChatActivityState {
  /** Timestamp of the last user message */
  lastUserMessageAt: number;
  /** Timestamp of the last assistant message */
  lastAssistantMessageAt: number;
  /** Timestamp of the last lone user reaction (an emoji reaction with no text after it). */
  lastUserReactionAt?: number;
  /** Per-character autonomous message tracking: count sent + timestamp of last autonomous msg */
  autonomousMessages: Map<string, { count: number; lastSentAt: number }>;
  /** Timestamp when generation started, or null if not in progress */
  generationInProgressSince: number | null;
  /** Last status reported by a connected client autonomous poller. */
  clientPresence?: { status: AutonomousClientPresenceStatus; updatedAt: number };
}

// ── In-memory activity tracker ──
// Keyed by chatId. This is intentionally in-memory since it's just timing state.
const activityStates = new Map<string, ChatActivityState>();

/**
 * Record that the user sent a message in a chat.
 */
export function recordUserActivity(chatId: string, opts: { preserveGenerationInProgress?: boolean } = {}): void {
  const now = Date.now();
  const existing = activityStates.get(chatId);
  if (existing) {
    existing.lastUserMessageAt = now;
    existing.autonomousMessages.clear(); // Reset — user is active again
    if (!opts.preserveGenerationInProgress) {
      existing.generationInProgressSince = null;
    }
  } else {
    activityStates.set(chatId, {
      lastUserMessageAt: now,
      lastAssistantMessageAt: 0,
      autonomousMessages: new Map(),
      generationInProgressSince: null,
    });
  }
}

/**
 * Record that the user reacted to a message (an emoji reaction). Tracked separately
 * from messages so a lone reaction can nudge the autonomous cadence a little sooner
 * than plain silence, WITHOUT counting as a full user message (which would reset
 * follow-up state and clear the un-needy escalation).
 */
export function recordUserReaction(chatId: string): void {
  const now = Date.now();
  const existing = activityStates.get(chatId);
  if (existing) {
    existing.lastUserReactionAt = now;
  } else {
    activityStates.set(chatId, {
      lastUserMessageAt: 0,
      lastAssistantMessageAt: 0,
      lastUserReactionAt: now,
      autonomousMessages: new Map(),
      generationInProgressSince: null,
    });
  }
}

/**
 * Record that an assistant message was sent (either user-triggered or autonomous).
 */
export function recordAssistantActivity(chatId: string, characterId?: string): void {
  const existing = activityStates.get(chatId);
  if (existing) {
    const now = Date.now();
    existing.lastAssistantMessageAt = now;
    if (characterId) {
      const prev = existing.autonomousMessages.get(characterId);
      existing.autonomousMessages.set(characterId, {
        count: (prev?.count ?? 0) + 1,
        lastSentAt: now,
      });
    }
    existing.generationInProgressSince = null;
  }
}

/**
 * Mark that an autonomous generation is in progress for a chat.
 */
export function markGenerationInProgress(chatId: string): number {
  const now = Date.now();
  const state = activityStates.get(chatId);
  if (state) {
    state.generationInProgressSince = now;
  } else {
    activityStates.set(chatId, {
      lastUserMessageAt: 0,
      lastAssistantMessageAt: 0,
      autonomousMessages: new Map(),
      generationInProgressSince: now,
    });
  }
  return now;
}

/**
 * Clear a generation-in-progress marker. If `startedAt` is supplied, only
 * clear the marker that this caller created.
 */
export function clearGenerationInProgress(chatId: string, startedAt?: number): void {
  const state = activityStates.get(chatId);
  if (!state) return;
  if (startedAt != null && state.generationInProgressSince !== startedAt) return;
  state.generationInProgressSince = null;
}

/**
 * Initialize activity state from DB messages if not already tracked in memory.
 * This handles server restarts and fresh page loads — we look at the most recent
 * messages to reconstruct timing state so autonomous messaging can resume.
 */
export function initializeActivityFromMessages(
  chatId: string,
  messages: Array<{ role: string; createdAt?: string; characterId?: string | null }>,
): void {
  // Already tracked — don't overwrite
  if (activityStates.has(chatId)) return;
  if (messages.length === 0) return;

  let lastUserAt = 0;
  let lastAssistantAt = 0;

  // Scan messages in reverse to find timestamps efficiently
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    const ts = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
    if (msg.role === "user" && !lastUserAt) lastUserAt = ts;
    if (msg.role === "assistant" && !lastAssistantAt) lastAssistantAt = ts;
    if (lastUserAt && lastAssistantAt) break;
  }

  if (!lastUserAt) return; // No user messages — can't initialize

  activityStates.set(chatId, {
    lastUserMessageAt: lastUserAt,
    lastAssistantMessageAt: lastAssistantAt,
    autonomousMessages: new Map(),
    generationInProgressSince: null,
  });
}

export function recordAutonomousClientPresence(
  chatId: string,
  status: AutonomousClientPresenceStatus = "active",
): void {
  const now = Date.now();
  const state = activityStates.get(chatId);
  if (state) {
    state.clientPresence = { status, updatedAt: now };
    return;
  }

  activityStates.set(chatId, {
    lastUserMessageAt: 0,
    lastAssistantMessageAt: 0,
    autonomousMessages: new Map(),
    generationInProgressSince: null,
    clientPresence: { status, updatedAt: now },
  });
}

export function getRecentAutonomousClientPresence(chatId: string, maxAgeMs: number) {
  const presence = activityStates.get(chatId)?.clientPresence;
  if (!presence) return null;
  if (Date.now() - presence.updatedAt > maxAgeMs) return null;
  return presence;
}

/**
 * Check whether any character in a chat should send an autonomous message.
 */
export function checkAutonomousMessaging(
  chatId: string,
  characterSchedules: Record<string, WeekSchedule>,
  isGroupChat: boolean,
  opts: { maxFollowups?: number } = {},
): AutonomousCheckResult {
  const noTrigger: AutonomousCheckResult = {
    shouldTrigger: false,
    characterIds: [],
    reason: "none",
    inactivityMs: 0,
  };

  const state = activityStates.get(chatId);
  if (!state) return noTrigger;

  // Auto-reset stuck generation flag after timeout
  if (state.generationInProgressSince) {
    if (Date.now() - state.generationInProgressSince > GENERATION_TIMEOUT_MS) {
      state.generationInProgressSince = null;
    } else {
      return noTrigger;
    }
  }

  const now = Date.now();
  const lastReactionAt = state.lastUserReactionAt ?? 0;
  // A lone reaction (no text after it) is the latest user action when it's newer
  // than the last user message. It opens a shorter gate for the FIRST autonomous
  // response and never accelerates follow-ups, so characters stay un-needy.
  const hasLoneReaction = lastReactionAt > state.lastUserMessageAt;
  const inactivityMs = state.lastUserMessageAt > 0 ? now - state.lastUserMessageAt : 0;
  const timeSinceReaction = hasLoneReaction ? now - lastReactionAt : Infinity;

  // Nothing to act on — the user has neither messaged nor reacted
  if (state.lastUserMessageAt === 0 && !hasLoneReaction) return noTrigger;

  // ── Check each character for inactivity threshold ──
  const eligibleCharacters: Array<{ id: string; priority: number; reactionDriven: boolean }> = [];

  // Maximum autonomous follow-ups before a character stops messaging
  const maxFollowups = Math.max(1, Math.min(3, Math.floor(opts.maxFollowups ?? 3)));

  for (const [charId, schedule] of Object.entries(characterSchedules)) {
    const { status } = getCurrentStatus(schedule);

    // Can't send if offline or sleeping
    if (status === "offline") continue;

    // Base inactivity threshold
    const baseThresholdMs =
      status === "dnd"
        ? schedule.inactivityThresholdMinutes * 60 * 1000 * 3 // 3x threshold when busy
        : schedule.inactivityThresholdMinutes * 60 * 1000;

    const prevAutonomous = state.autonomousMessages.get(charId);
    const sentCount = prevAutonomous?.count ?? 0;

    // Cap follow-ups — don't spam the user endlessly
    if (sentCount >= maxFollowups) continue;

    if (sentCount === 0) {
      // First autonomous message. Normally gated by inactivity since the user's
      // last message; a lone reaction opens a shorter, reaction-specific gate (a
      // fraction of the threshold, floored so it's never near-instant).
      const reactionGateMs = Math.min(
        baseThresholdMs,
        Math.max(REACTION_MIN_GATE_MS, Math.round(baseThresholdMs * REACTION_GATE_FRACTION)),
      );
      const inactivityEligible = state.lastUserMessageAt > 0 && inactivityMs >= baseThresholdMs;
      const reactionEligible = hasLoneReaction && timeSinceReaction >= reactionGateMs;
      if (inactivityEligible || reactionEligible) {
        const reactionDriven = reactionEligible && !inactivityEligible;
        eligibleCharacters.push({
          id: charId,
          priority: schedule.talkativeness + (status === "online" ? 20 : 0) + (reactionDriven ? 15 : 0),
          reactionDriven,
        });
      }
    } else {
      // Follow-up messages — measure from the last autonomous message, with escalating cooldown
      // Each follow-up doubles the cooldown: 2x, 4x base threshold. Reactions do NOT
      // accelerate follow-ups (keeps characters un-needy after the first reach-out).
      const cooldownMultiplier = Math.pow(2, sentCount);
      const followUpThresholdMs = baseThresholdMs * cooldownMultiplier;
      const timeSinceLastAutonomous = now - (prevAutonomous?.lastSentAt ?? 0);

      if (timeSinceLastAutonomous >= followUpThresholdMs) {
        eligibleCharacters.push({
          id: charId,
          priority: schedule.talkativeness + (status === "online" ? 20 : 0) - sentCount * 10, // Lower priority for repeat messages
          reactionDriven: false,
        });
      }
    }
  }

  if (eligibleCharacters.length === 0) return noTrigger;

  // Sort by priority (highest first)
  eligibleCharacters.sort((a, b) => b.priority - a.priority);

  const top = eligibleCharacters[0]!;
  const reason: AutonomousCheckResult["reason"] = top.reactionDriven ? "user_reaction" : "user_inactivity";

  if (isGroupChat) {
    // In group chats, potentially multiple characters can exchange
    // but start with just the top character
    return { shouldTrigger: true, characterIds: [top.id], reason, inactivityMs };
  }

  // In DMs, only one character
  return { shouldTrigger: true, characterIds: [top.id], reason, inactivityMs };
}

/**
 * For group chats: check if characters should chat with each other.
 * This is triggered after an assistant message, to see if another character
 * wants to respond to what was just said.
 */
export function checkCharacterExchange(
  chatId: string,
  lastSpeakerCharId: string,
  characterSchedules: Record<string, WeekSchedule>,
): AutonomousCheckResult {
  const noTrigger: AutonomousCheckResult = {
    shouldTrigger: false,
    characterIds: [],
    reason: "none",
    inactivityMs: 0,
  };

  const state = activityStates.get(chatId);
  if (!state) return noTrigger;
  if (state.generationInProgressSince) {
    if (Date.now() - state.generationInProgressSince > GENERATION_TIMEOUT_MS) {
      state.generationInProgressSince = null;
    } else {
      return noTrigger;
    }
  }

  // Only allow character exchanges if user has been inactive for at least 30 seconds
  const inactivityMs = Date.now() - state.lastUserMessageAt;
  if (inactivityMs < 30_000) return noTrigger;

  const eligible: Array<{ id: string; weight: number }> = [];

  for (const [charId, schedule] of Object.entries(characterSchedules)) {
    if (charId === lastSpeakerCharId) continue;

    const { status } = getCurrentStatus(schedule);
    if (status === "offline") continue;
    if (status === "dnd") continue; // Busy characters don't join casual exchanges

    // Weight based on talkativeness — more talkative characters more likely to jump in
    eligible.push({ id: charId, weight: schedule.talkativeness });
  }

  if (eligible.length === 0) return noTrigger;

  // Probabilistic: roll dice weighted by talkativeness
  // A character with talkativeness 80 has an 80% chance of responding
  const candidate = eligible[Math.floor(Math.random() * eligible.length)]!;
  const roll = Math.random() * 100;
  if (roll > candidate.weight) return noTrigger;

  return {
    shouldTrigger: true,
    characterIds: [candidate.id],
    reason: "character_exchange",
    inactivityMs,
  };
}

/**
 * Clean up activity state for a chat (when chat is deleted or closed).
 */
export function clearChatActivity(chatId: string): void {
  activityStates.delete(chatId);
}

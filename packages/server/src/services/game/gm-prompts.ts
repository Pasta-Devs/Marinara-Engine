// ──────────────────────────────────────────────
// Game: GM Prompt Building
// ──────────────────────────────────────────────

import type {
  GameActiveState,
  GameCampaignPlan,
  GameMap,
  GameNpc,
  SessionSummary,
  HudWidget,
} from "@marinara-engine/shared";
import { DEFAULT_GAME_SYSTEM_PROMPT, wrapGameInstructions } from "@marinara-engine/shared";
import type { CharacterSpriteInfo } from "./sprite.service.js";

/**
 * The sheet names a one-request dice placeholder can actually resolve this turn (#6215).
 *
 * The prompt advertises `[[roll: 1d8+STR]]` only when this carries names, because a name the
 * chat cannot resolve is refused rather than defaulted to zero: a placeholder's name is only a
 * modifier source, and defaulting it would add a number nobody asked for to a sentence the
 * player reads as fact. Advertising a form that fails in the default
 * configuration, where no game-state snapshot exists and `skills` is therefore null, is
 * worse than not offering it.
 *
 * Names are carried exactly as the sheet spells them, never re-cased, so every name the block
 * prints is a name the resolver finds.
 */
export interface GameSkillModifierView {
  /** Skill names, as the snapshot's `playerStats.skills` keys spell them. */
  skills: string[];
  /** Attribute names in the short sheet spelling: STR, DEX, CON, INT, WIS, CHA. */
  attributes: string[];
}

export interface GmPromptContext {
  gameActiveState: GameActiveState;
  storyArc: string | null;
  plotTwists: string[] | null;
  campaignPlan?: GameCampaignPlan | null;
  map: GameMap | null;
  npcs: GameNpc[];
  sessionSummaries: SessionSummary[];
  sessionNumber: number;
  partyNames: string[];
  /** Full character cards for each party member */
  partyCards?: Array<{ name: string; card: string }>;
  playerName: string;
  /** Full player persona card */
  playerCard?: string | null;
  gmCharacterCard: string | null;
  difficulty: string;
  /** "classic" (menu combat) or "tactical" (grid battle). Absent = classic. */
  combatStyle?: string;
  /** Bounded summary of the accepted generated battlefield for later narration. */
  tacticalBattlefieldContext?: string;
  genre: string;
  setting: string;
  tone: string;
  /** Server-computed time string, e.g. "Day 3, 14:30 (afternoon)" */
  gameTime?: string;
  /** Server-computed weather state */
  weatherContext?: string;
  /** Server-computed encounter hint (if encounter was triggered) */
  encounterHint?: string;
  /** Server-computed combat results to narrate */
  combatResults?: string;
  /** Server-computed loot drops to narrate */
  lootResults?: string;
  /** Player's personal notes (shared with GM) */
  playerNotes?: string;
  /** Active HUD widgets the model designed (so it can update them) */
  hudWidgets?: HudWidget[];
  /** Content rating: sfw or nsfw */
  rating?: "sfw" | "nsfw";
  /** Whether the GM may emit timed reaction prompts. Defaults to true. */
  enableQuickTimeEvents?: boolean;
  /** Whether a separate scene model handles bg, music, sfx, ambient, widgets, expressions */
  hasSceneModel?: boolean;
  /** Whether inline GM scene tags may request generated location backgrounds. */
  canGenerateBackgrounds?: boolean;
  /** Unified image style/instructions generated during game setup. */
  artStylePrompt?: string;
  /** Whether the player moved to a new location since last turn (false = send location summary instead of full map) */
  playerMoved?: boolean;
  /** Approximate turn number in the current session (1-based, used for prompt gating) */
  turnNumber?: number;
  /** Pre-computed passive perception hints to weave into narration */
  perceptionHints?: string;
  /** Pre-computed party morale context */
  moraleContext?: string;
  /** Available sprite expressions per character (name → expressions + custom fullBody aliases) */
  characterSprites?: CharacterSpriteInfo[];
  /** Player's current inventory items (for GM context) */
  playerInventory?: Array<{ name: string; quantity: number }>;
  /** Language for all narration and dialogue */
  language?: string;
  /** User-overridable GM instruction body. Wrapped in <instructions> before sending. */
  gameSystemPrompt?: string | null;
  gameSpecialInstructions?: string | null;
}

const MAX_PROMPT_MAP_LOCATIONS = 10;
const MAX_PROMPT_NPCS = 12;

function normalizePromptText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function normalizePromptTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePromptText(item)).filter((item) => item.length > 0);
  }
  const text = normalizePromptText(value);
  return text ? [text] : [];
}

function normalizePromptRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function derivePromptResumePointFallback(summary: string): string {
  const paragraphs = summary
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return paragraphs[paragraphs.length - 1] ?? summary;
}

function normalizePromptSessionSummary(value: unknown, index: number): SessionSummary {
  const source = normalizePromptRecord(value);
  const summary = normalizePromptText(source.summary, `Session ${index + 1} concluded.`);

  return {
    sessionNumber:
      typeof source.sessionNumber === "number" && Number.isFinite(source.sessionNumber)
        ? source.sessionNumber
        : index + 1,
    summary,
    resumePoint: normalizePromptText(source.resumePoint, derivePromptResumePointFallback(summary)),
    partyDynamics: normalizePromptText(source.partyDynamics),
    partyState: normalizePromptText(source.partyState),
    keyDiscoveries: [...normalizePromptTextList(source.keyDiscoveries), ...normalizePromptTextList(source.revelations)],
    characterMoments: normalizePromptTextList(source.characterMoments),
    littleDetails: normalizePromptTextList(source.littleDetails),
    statsSnapshot: normalizePromptRecord(source.statsSnapshot),
    npcUpdates: normalizePromptTextList(source.npcUpdates),
    nextSessionRequest: normalizePromptText(source.nextSessionRequest) || null,
    timestamp: normalizePromptText(source.timestamp, new Date().toISOString()),
  };
}

function normalizePromptSessionSummaries(value: unknown): SessionSummary[] {
  if (!Array.isArray(value)) return [];
  return value.map((summary, index) => normalizePromptSessionSummary(summary, index));
}

function normalizePromptNpcs(value: unknown): GameNpc[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const source = normalizePromptRecord(item);
    const name = normalizePromptText(source.name);
    if (!name) return [];

    return [
      {
        id: normalizePromptText(source.id, `npc-${index + 1}`),
        name,
        emoji: normalizePromptText(source.emoji, "NPC"),
        description: normalizePromptText(source.description),
        descriptionSource: source.descriptionSource as GameNpc["descriptionSource"],
        gender: typeof source.gender === "string" ? source.gender : null,
        pronouns: typeof source.pronouns === "string" ? source.pronouns : null,
        location: normalizePromptText(source.location),
        reputation: typeof source.reputation === "number" && Number.isFinite(source.reputation) ? source.reputation : 0,
        notes: normalizePromptTextList(source.notes),
        avatarUrl: typeof source.avatarUrl === "string" ? source.avatarUrl : null,
      },
    ];
  });
}

const PROMPT_LANGUAGE_LOOKUP = new Map<string, string>([
  ["english", "English"],
  ["japanese", "Japanese"],
  ["日本語", "Japanese"],
  ["korean", "Korean"],
  ["한국어", "Korean"],
  ["chinese", "Chinese"],
  ["中文", "Chinese"],
  ["spanish", "Spanish"],
  ["español", "Spanish"],
  ["espanol", "Spanish"],
  ["french", "French"],
  ["français", "French"],
  ["francais", "French"],
  ["german", "German"],
  ["deutsch", "German"],
  ["polish", "Polish"],
  ["polski", "Polish"],
  ["portuguese", "Portuguese"],
  ["português", "Portuguese"],
  ["portugues", "Portuguese"],
  ["russian", "Russian"],
  ["русский", "Russian"],
]);

function normalizePromptLanguage(language?: string | null): string | null {
  const trimmed = language?.trim();
  if (!trimmed) return null;
  return PROMPT_LANGUAGE_LOOKUP.get(trimmed.toLowerCase()) ?? trimmed;
}

function buildSessionHistoryLines(summaries: SessionSummary[]): string[] {
  const lines: string[] = [];

  for (const [index, summary] of summaries.entries()) {
    const normalized = normalizePromptSessionSummary(summary, index);
    lines.push(`Session ${normalized.sessionNumber} summary:`, normalized.summary);
    if (index < summaries.length - 1) {
      lines.push("");
    }
  }

  return lines;
}

function buildLatestSessionContinuityLines(summary: SessionSummary): string[] {
  const summaryIndex =
    typeof summary.sessionNumber === "number" && Number.isFinite(summary.sessionNumber)
      ? Math.max(0, summary.sessionNumber - 1)
      : 0;
  const normalized = normalizePromptSessionSummary(summary, summaryIndex);
  const lines = [`Latest completed session: ${normalized.sessionNumber}`];

  if (normalized.resumePoint) {
    lines.push(`Resume point: ${normalized.resumePoint}`);
  }
  if (normalized.partyDynamics) {
    lines.push(`Party dynamics: ${normalized.partyDynamics}`);
  }
  if (normalized.keyDiscoveries.length > 0) {
    lines.push(`Key discoveries: ${normalized.keyDiscoveries.join("; ")}`);
  }
  if (normalized.characterMoments.length > 0) {
    lines.push(`Character moments: ${normalized.characterMoments.join("; ")}`);
  }
  if (normalized.littleDetails.length > 0) {
    lines.push(`Little details to recall: ${normalized.littleDetails.join("; ")}`);
  }
  if (normalized.npcUpdates.length > 0) {
    lines.push(`NPC updates: ${normalized.npcUpdates.join("; ")}`);
  }
  if (Object.keys(normalized.statsSnapshot).length > 0) {
    lines.push(`Stats snapshot: ${JSON.stringify(normalized.statsSnapshot)}`);
  }

  return lines;
}

function buildMapStateLines(map: GameMap, playerMoved?: boolean, turnNumber?: number): string[] {
  const lines = [`Area: ${map.name}${map.description ? ` — ${map.description}` : ""}`, `Map type: ${map.type}`];
  const includeDiscovered = playerMoved !== false || (turnNumber ?? 1) <= 1;

  if (map.type === "node") {
    const currentId = typeof map.partyPosition === "string" ? map.partyPosition : null;
    const nodesById = new Map((map.nodes ?? []).map((node) => [node.id, node]));
    const currentNode = currentId ? nodesById.get(currentId) : null;
    if (currentNode) {
      lines.push(`Current: ${currentNode.label}${currentNode.description ? ` — ${currentNode.description}` : ""}`);
    } else if (currentId) {
      lines.push(`Current: ${currentId}`);
    }

    if (currentId) {
      const nearby = (map.edges ?? [])
        .filter((edge) => edge.from === currentId || edge.to === currentId)
        .map((edge) => (edge.from === currentId ? edge.to : edge.from))
        .map((nodeId) => nodesById.get(nodeId)?.label ?? nodeId)
        .filter((label, index, labels) => labels.indexOf(label) === index)
        .slice(0, MAX_PROMPT_MAP_LOCATIONS);
      if (nearby.length > 0) lines.push(`Connected: ${nearby.join(", ")}`);
    }

    if (includeDiscovered) {
      const discovered = (map.nodes ?? [])
        .filter((node) => node.discovered && node.id !== currentId)
        .slice(0, MAX_PROMPT_MAP_LOCATIONS)
        .map((node) => node.label);
      if (discovered.length > 0) lines.push(`Discovered: ${discovered.join(", ")}`);
    }

    return lines;
  }

  const position = typeof map.partyPosition === "object" ? map.partyPosition : null;
  const currentCell = position ? map.cells?.find((cell) => cell.x === position.x && cell.y === position.y) : null;
  if (currentCell) {
    lines.push(`Current: ${currentCell.label}${currentCell.description ? ` — ${currentCell.description}` : ""}`);
  } else if (position) {
    lines.push(`Current: (${position.x}, ${position.y})`);
  }

  if (position) {
    const deltas = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const;
    const nearby = deltas
      .map(([dx, dy]) => map.cells?.find((cell) => cell.x === position.x + dx && cell.y === position.y + dy))
      .filter((cell): cell is NonNullable<typeof cell> => !!cell && cell.discovered)
      .map((cell) => cell.label)
      .slice(0, MAX_PROMPT_MAP_LOCATIONS);
    if (nearby.length > 0) lines.push(`Connected: ${nearby.join(", ")}`);
  }

  if (includeDiscovered) {
    const discovered = (map.cells ?? [])
      .filter((cell) => cell.discovered && (!currentCell || cell.x !== currentCell.x || cell.y !== currentCell.y))
      .slice(0, MAX_PROMPT_MAP_LOCATIONS)
      .map((cell) => cell.label);
    if (discovered.length > 0) lines.push(`Discovered: ${discovered.join(", ")}`);
  }

  return lines;
}

function buildTrackedNpcLines(npcs: GameNpc[]): string[] {
  const sorted = [...npcs].sort((left, right) => Math.abs(right.reputation) - Math.abs(left.reputation));

  const lines = sorted.slice(0, MAX_PROMPT_NPCS).map((npc) => {
    const parts = [`- ${npc.name} @ ${npc.location || "unknown"}`, `rep ${npc.reputation}`];
    if (npc.notes.length > 0) {
      parts.push(npc.notes.slice(0, 2).join("; "));
    }
    return parts.join(" | ");
  });

  if (sorted.length > MAX_PROMPT_NPCS) {
    lines.push(`- +${sorted.length - MAX_PROMPT_NPCS} more tracked NPCs`);
  }

  return lines;
}

function buildCampaignPlanLines(plan?: GameCampaignPlan | null): string[] {
  if (!plan) return [];
  const lines: string[] = [];

  if (plan.openingSituation?.trim()) {
    lines.push(`Opening situation: ${plan.openingSituation.trim()}`);
  }

  const clocks = Array.isArray(plan.pressureClocks) ? plan.pressureClocks : [];
  if (clocks.length > 0) {
    lines.push(
      `Pressure clocks: ${clocks
        .map((clock) => {
          const steps = Number.isFinite(clock.steps) && clock.steps > 0 ? clock.steps : 6;
          const current = Number.isFinite(clock.current) ? Math.max(0, Math.min(steps, clock.current)) : 0;
          return `${clock.name} ${current}/${steps}${clock.failure ? `; failure: ${clock.failure}` : ""}`;
        })
        .join(" | ")}`,
    );
  }

  const factions = Array.isArray(plan.factions) ? plan.factions : [];
  if (factions.length > 0) {
    lines.push(
      `Factions: ${factions
        .map((faction) =>
          [
            faction.name,
            faction.goal ? `wants ${faction.goal}` : null,
            faction.method ? `method: ${faction.method}` : null,
            faction.secret ? `secret: ${faction.secret}` : null,
          ]
            .filter(Boolean)
            .join("; "),
        )
        .join(" | ")}`,
    );
  }

  const questSeeds = Array.isArray(plan.questSeeds) ? plan.questSeeds.filter((seed) => seed.trim()) : [];
  if (questSeeds.length > 0) {
    lines.push(`Quest seeds: ${questSeeds.join(" | ")}`);
  }

  const encounterPrinciples = Array.isArray(plan.encounterPrinciples)
    ? plan.encounterPrinciples.filter((principle) => principle.trim())
    : [];
  if (encounterPrinciples.length > 0) {
    lines.push(`Encounter principles: ${encounterPrinciples.join(" | ")}`);
  }

  return lines;
}

function buildCompactInventoryLine(items: Array<{ name: string; quantity: number }>): string {
  return items.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join("; ");
}

function buildWidgetSummaryLines(widgets: HudWidget[]): string[] {
  return widgets.map((widget) => {
    const config = (widget.config ?? {}) as Record<string, any>;
    if (widget.type === "stat_block" && Array.isArray(config.stats) && config.stats.length > 0) {
      const stats = config.stats.map((stat) => `${stat.name}=${stat.value}`).join(", ");
      return `- ${widget.id} (${widget.type}): ${stats}`;
    }
    if (widget.type === "list" && Array.isArray(config.items) && config.items.length > 0) {
      return `- ${widget.id} (${widget.type}): ${config.items.join("; ")}`;
    }
    if (widget.type === "timer") {
      return `- ${widget.id} (${widget.type}): ${config.running ? "running" : "stopped"} ${config.seconds ?? 0}s`;
    }
    const value = config.value ?? config.count ?? JSON.stringify(config);
    return `- ${widget.id} (${widget.type}): ${value}`;
  });
}

/** Build the GM system prompt. Injects full game context (story arc, plot twists, map, etc.). */
export function buildGmSystemPrompt(ctx: GmPromptContext): string {
  const plotTwists = normalizePromptTextList(ctx.plotTwists);
  const npcs = normalizePromptNpcs(ctx.npcs);
  const sessionSummaries = normalizePromptSessionSummaries(ctx.sessionSummaries);
  const partyNames = normalizePromptTextList(ctx.partyNames);
  const partyCards = Array.isArray(ctx.partyCards) ? ctx.partyCards : [];
  const sections: string[] = [];

  // ── Core Role ──
  if (ctx.gmCharacterCard) {
    sections.push(
      `<role>`,
      `You are the following character, acting as an excellent Game Master for the user. Adopt their personality, speech patterns, biases, and quirks, and shape the narrative through their subjective lenses, allowing them to break the fourth wall between the GM and the party. Give it your best!`,
      ctx.gmCharacterCard,
      `</role>`,
    );
  } else {
    sections.push(
      `<role>`,
      `You are an excellent Game Master for the user. You bring the world to life with vivid imagination, memorable NPCs, and engaging encounters. You have personality: you crack (snarky) jokes, build tension, celebrate epic moments, and mourn losses. Give it your best!`,
      `</role>`,
    );
  }

  const gameBlockLines = [
    `<game>`,
    `You are driving an RPG/VN game:`,
    `- Genre: ${ctx.genre}.`,
    `- Setting: ${ctx.setting}.`,
    `- Tone: ${ctx.tone}.`,
    `- Difficulty: ${ctx.difficulty}.`,
  ];
  if (ctx.combatStyle === "tactical") {
    gameBlockLines.push(
      `- Combat style: tactical grid-battle. Battles resolve in a dedicated tactical UI (movement, terrain, forecasts); narrate the aftermath from the battle report and do not resolve the tactics yourself in prose.`,
    );
  }
  gameBlockLines.push(`</game>`);
  sections.push(...gameBlockLines);

  if (ctx.tacticalBattlefieldContext) {
    sections.push(
      `<tactical_battlefield>`,
      `This is the accepted generated board for the active tactical encounter:`,
      ctx.tacticalBattlefieldContext,
      `Keep later combat narration consistent with this resolved board and its terrain.`,
      `</tactical_battlefield>`,
    );
  }

  sections.push(wrapGameInstructions(normalizePromptText(ctx.gameSystemPrompt) || DEFAULT_GAME_SYSTEM_PROMPT));

  // ── Rating Guidelines ──
  if (ctx.rating === "nsfw") {
    sections.push(
      `<rating_guidelines>`,
      `Anything goes in this mature NSFW fiction. The player has confirmed that they are an adult and has agreed to the terms below. Do not sanitize content, language, cruelty, sex, or violence:`,
      `- All characters and the player may touch dark themes, corrupt, torture, curse, lie, harm, use, fear, betray, dominate, love, ruin, mutilate, assault, kill themselves or others (the player's protagonist included). It makes sense for villains to disregard boundaries and play dirty, but even heroes can have a dark side or break down under pressure.`,
      `- Intimacy, romance, flirtation, desire, jealousy, possessiveness, seduction, and messy attachment are allowed. Let those escalate naturally; handholding, pinning, charged proximity, touches, kisses, groping, holding, physical contact mustn't trigger an out-of-character pause. Do not wait for the player to initiate.`,
      `- Sex between involved characters should be explicit, anatomically grounded, emotionally reactive, and detailed when portrayed in the scene. Take consent for granted, assuming some lie, resist, or fight back based on their personality.`,
      `- Violence should be graphic, gory, and consequential.`,
      `- Stay true to motive, tone, and fallout; never soften outcomes for comfort. Let mature themes have weight, cost, ugliness, and aftermath instead of treating them as decorative edge.`,
      `</rating_guidelines>`,
    );
  } else {
    sections.push(
      `<rating_guidelines>`,
      `This is mature SFW fiction. The player has confirmed that they are an adult and has agreed to the terms below. Profanity, dark themes, danger, and death are allowed; explicit sex is not:`,
      `- Romance, flirtation, longing, jealousy, possessiveness, tenderness, handholding, charged proximity, touches, kisses, and embraces are allowed. Do not refuse or over-explain ordinary affection; infer willingness from context, then portray the emotional reaction.`,
      `- Sexual content fades to black and resumes in the aftermath. Treat boundaries as part of characterization and scene dynamics, not as repetitive legal disclaimers.`,
      `- Violence may be serious and consequential, but not graphic or pornographic. Injuries, death, intimidation, cruelty, exploitation, addiction, trauma, corruption, betrayal, and moral compromise may be central to the story when appropriate.`,
      `- Profanity, menace, fear, grief, ugly motives, and uncomfortable choices are allowed. Keep stakes, fallout, and character behavior real; do not soften danger or rush to reassure the player.`,
      `</rating_guidelines>`,
    );
  }

  // ── Current State ──
  // Moved to buildGmFormatReminder() so the model sees the latest
  // game state closest to generation (same rationale as active_widgets).

  // ── Server-Computed Context (narrate these, don't recalculate) ──
  if (ctx.weatherContext) {
    sections.push(`<weather_update>`, ctx.weatherContext, `</weather_update>`);
  }

  if (ctx.perceptionHints) {
    sections.push(ctx.perceptionHints);
  }

  if (ctx.moraleContext) {
    sections.push(ctx.moraleContext);
  }

  if (ctx.encounterHint) {
    sections.push(
      `<encounter_triggered>`,
      `The server rolled a random encounter. Narrate this:`,
      ctx.encounterHint,
      `</encounter_triggered>`,
    );
  }

  if (ctx.combatResults) {
    sections.push(
      `<combat_results>`,
      `The server computed these combat results. Narrate them dramatically:`,
      ctx.combatResults,
      `</combat_results>`,
    );
  }

  if (ctx.playerNotes?.trim()) {
    sections.push(
      `<player_notes>`,
      `The player has written the following personal notes. Consider these when narrating; they reflect what the player is tracking, their theories, and their plans:`,
      ctx.playerNotes.trim(),
      `</player_notes>`,
    );
  }

  // ── Active HUD Widgets ──
  // Moved to buildGmFormatReminder() so they sit next to <widget_commands>
  // in the last user message, keeping current state closest to generation.

  // ── Story Arc (GM SECRET — never shared with party agent) ──
  if (ctx.storyArc) {
    sections.push(`<story_arc_secret>`, ctx.storyArc, `</story_arc_secret>`);
  }

  // ── Plot Twists (GM SECRET) ──
  if (plotTwists.length > 0) {
    sections.push(
      `<plot_twists_secret>`,
      plotTwists.map((t, i) => `${i + 1}. ${t}`).join("\n"),
      `</plot_twists_secret>`,
    );
  }

  const campaignPlanLines = buildCampaignPlanLines(ctx.campaignPlan);
  if (campaignPlanLines.length > 0) {
    sections.push(
      `<campaign_plan_secret>`,
      `Optional pacing scaffolding. Use it when it fits; ignore clocks or seeds when the current game is meant to stay chill, domestic, or low-pressure.`,
      ...campaignPlanLines,
      `</campaign_plan_secret>`,
    );
  }

  /*
  Legacy map policy kept for rollback reference:
  - Full map JSON on move/first turn.
  - Location-only summary otherwise.
  */
  // ── Map (compact state summary) ──
  if (ctx.map) {
    sections.push(`<map_state>`, ...buildMapStateLines(ctx.map, ctx.playerMoved, ctx.turnNumber), `</map_state>`);
  }

  // ── NPCs ──
  if (npcs.length > 0) {
    sections.push(`<tracked_npcs>`, ...buildTrackedNpcLines(npcs), `</tracked_npcs>`);
  }

  // ── Previous Sessions (all summaries, latest session continuity in detail) ──
  if (sessionSummaries.length > 0) {
    const sorted = [...sessionSummaries].sort((a, b) => a.sessionNumber - b.sessionNumber);
    const latest = sorted[sorted.length - 1]!;

    sections.push(
      `<previous_sessions>`,
      `Every completed session summary is included below for long-term continuity.`,
      ...buildSessionHistoryLines(sorted),
      `</previous_sessions>`,
    );

    sections.push(
      `<latest_session_continuity>`,
      `Use only this block for the immediate carryover state from the most recently completed session. Do not recreate these detailed fields from older sessions unless the current scene explicitly calls back to them.`,
      ...buildLatestSessionContinuityLines(latest),
      `</latest_session_continuity>`,
    );
  }

  // ── Party ──
  const partyLines: string[] = [];
  if (ctx.playerCard) {
    partyLines.push(`Player:\n${ctx.playerCard}`);
  } else {
    partyLines.push(`Player: ${ctx.playerName}`);
  }
  if (partyCards.length > 0) {
    for (const pc of partyCards) {
      partyLines.push(pc.card);
    }
  } else if (partyNames.length > 0) {
    partyLines.push(`Party members: ${partyNames.join(", ")}`);
  }
  sections.push(`<party>`, ...partyLines, `</party>`);

  return sections.join("\n");
}

/**
 * Build the GM format reminder — injected as the last user message so the
 * output format and available commands sit closest to generation in context.
 */
/** The ruleset's own check line, in place of the built-in one. Everything in it is the ruleset's
 *  validated, prompt-safe text; the Engine adds only the tag shape and the ladder. */
function renderRulesetSkillCheckLine(
  ruleset: import("@marinara-engine/shared").RulesetDefinition,
  playerDiceRollSubmitted: boolean,
  oneRequestDice: boolean,
): string {
  const resolution = ruleset.resolution;
  // `with=` needs somewhere to go: a sheet with one ability has no other ability to roll with.
  const withClause =
    ruleset.sheet.abilities.length >= 2
      ? [`Add with="Ability" to roll a skill or save with another ability than its own.`]
      : [];
  const branchClause = oneRequestDice
    ? [
        `When the outcome splits two ways, add branch="label" to this tag and write the branch block described under DICE.`,
      ]
    : [];
  const whoClause = `Add who="Character Name" to roll for a party member; without it the player is checked.`;
  // Every ruleset has a ladder, so every ruleset can be asked for a step by name.
  const difficultyClause = `Or name a step with difficulty="Label" in place of dc.`;

  if (resolution.kind === "dice-pool") {
    const { target, situationalDice, difficultyLadder, die, explode, double, botch, pool } = resolution;
    // A face rule is taught only where the ruleset lets a check move it, and says what happens when
    // nobody asks, which for a rule with no `from` is nothing at all.
    const faceClause = (key: "explode" | "double", rule: typeof explode, does: string) =>
      rule?.min === undefined
        ? []
        : [
            `Add ${key}="N" to make dice showing N or more ${does} on this check, from ${rule.min} to ${die.sides}; without it ${
              rule.from === undefined ? "none do" : `dice showing ${rule.from} or more do`
            }.`,
          ];
    const [firstAbility, secondAbility] = ruleset.sheet.abilities;
    const ladder = difficultyLadder
      .map(
        (step) =>
          `${step.label} ${step.successes} ${step.successes === 1 ? "success" : "successes"}${
            step.target === undefined ? "" : ` (target ${step.target})`
          }`,
      )
      .join(", ");
    return [
      `- [skill_check: skill="Name" dc="N"] - ${ruleset.gm.checkGuidance}`,
      `dc is how many successes the check needs.`,
      `Difficulty: ${ladder}.`,
      // The step's own target only means something where a step names one.
      difficultyLadder.some((step) => step.target !== undefined)
        ? `${difficultyClause} A step's target is the one the check counts with unless you add threshold.`
        : difficultyClause,
      whoClause,
      // Both are offered only where this ruleset declares them, so the prompt never teaches an
      // attribute the resolver would then ignore.
      ...(target.min < target.max
        ? [
            `Add threshold="N" to move the per-die target, from ${target.min} to ${target.max}; without it the target is ${target.default}.`,
          ]
        : []),
      ...(situationalDice
        ? [
            `Add bonus="+N" or bonus="-N" to add or take dice for this check, from ${situationalDice.min} to ${situationalDice.max}.`,
          ]
        : []),
      ...(resolution.spend ?? []).map((spend) => {
        const pool = ruleset.sheet.live.pools.find((entry) => entry.id === spend.pool);
        const buys = [
          spend.successes ? `${spend.successes} automatic ${spend.successes === 1 ? "success" : "successes"}` : "",
          spend.dice ? `${spend.dice} extra ${spend.dice === 1 ? "die" : "dice"}` : "",
        ]
          .filter(Boolean)
          .join(" and ");
        // Taught only where this ruleset declares it, so the prompt never offers a purchase the
        // resolver would then ignore. What it costs and what it buys are said in the ruleset's own
        // words; the engine works out both, and a pool that cannot cover it buys nothing.
        return `When the player spends to change a roll, add spend="${spend.pool}:N" to that same check: every ${spend.amount} ${pool?.label ?? spend.pool} buys ${buys}, up to ${spend.perCheck} ${spend.perCheck === 1 ? "time" : "times"} per check. Do not also write a sheet command for it, and do not change the dice yourself.`;
      }),
      // Taught whenever this ruleset has any entry that changes a check. What each one DOES is the
      // entry's own business and the Engine reads it; the Game Master only names it.
      ...((ruleset.catalogs ?? []).some(
        (catalog) =>
          catalog.holds === "rows" &&
          (catalog.asset || (catalog.entries ?? []).some((entry) => entry.mechanics?.check)),
      )
        ? [
            `When a character uses something from their sheet to change a roll, add use="Its name" to that same check. Do not write a separate sheet command for it: the engine pays for it and applies it on the same roll.`,
          ]
        : []),
      ...faceClause("explode", explode, "roll one more die"),
      ...faceClause("double", double, "count twice"),
      ...withClause,
      // Named with this ruleset's own first two abilities, so the example is never another game's.
      ...(pool.abilityPlusAbility && firstAbility && secondAbility
        ? [
            `On an ability check, with= adds a second ability's dice: skill="${firstAbility.label}" with="${secondAbility.label}".`,
          ]
        : []),
      ...(botch?.rule === "halfOrMore"
        ? [
            `A check the engine marks complication="true" kept its result, but something went wrong alongside it: narrate both.`,
          ]
        : []),
      `Do NOT write rolls, modifier, total or result: the engine rolls the pool from the character sheet and counts the successes.`,
      ...branchClause,
    ].join(" ");
  }

  const { dice, advantage, difficultyLadder } = resolution;
  const ladder = difficultyLadder.map((step) => `${step.label} ${step.dc}`).join(", ");
  const playerDie = playerDiceRollSubmitted && dice.count === 1 && dice.sides === 20;
  return [
    `- [skill_check: skill="Name" dc="N"${playerDie ? ` rolls="the player's d20 result"` : ""}] - ${ruleset.gm.checkGuidance}`,
    `Difficulty: ${ladder}.`,
    difficultyClause,
    whoClause,
    ...(advantage ? [`Add mode="advantage" or mode="disadvantage" when the rules grant one.`] : []),
    ...withClause,
    playerDie
      ? `Use the player's exact die. Do NOT write modifier, total or result: the engine applies the character sheet.`
      : `Do NOT write rolls, modifier, total or result: the engine rolls ${dice.count}d${dice.sides} and applies the character sheet.`,
    ...branchClause,
  ].join(" ");
}

/** The sheet command, the ruleset's own guidance for it, and the party's sheets as they stand.
 *  The command grammar is the Engine's and is the same for every ruleset; every NAME in it (pools,
 *  tracks, conditions, rests) comes from the ruleset and is shown on the sheets themselves. */
function renderRulesetSheetSection(
  ruleset: import("@marinara-engine/shared").RulesetDefinition,
  sheetBlocks: string[],
): string[] {
  const blocks = sheetBlocks.map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return [];
  const names = (entries: ReadonlyArray<{ label: string }>) => entries.map((entry) => entry.label).join(", ");
  // A wound track is marked with a kind of harm rather than counted, so it has a command of its own
  // and is listed apart from the tracks `op="track"` moves.
  const woundTracks = ruleset.sheet.live.tracks.flatMap((track) =>
    track.levels && track.kinds ? [{ ...track, levels: track.levels, kinds: track.kinds }] : [],
  );
  const plainTracks = ruleset.sheet.live.tracks.filter((track) => !track.levels);
  const lines = [
    ``,
    `CHARACTER SHEETS:`,
    `The Engine keeps every character sheet. Record each change with one command per change, written where it happens:`,
    `- [sheet: who="Name" op="spend" pool="Pool" amount="N"] - uses up a resource. Refused when not enough is left.`,
    `- [sheet: who="Name" op="restore" pool="Pool" amount="N"] - gives it back, up to the maximum (healing included).`,
    `- [sheet: who="Name" op="damage" pool="Pool" amount="N"] - takes it away, temporary points first.`,
    `- [sheet: who="Name" op="temp" pool="Pool" amount="N"] - sets temporary points on a pool that has them.`,
    `- [sheet: who="Name" op="track" track="Track" by="+1"] - or to="N" to set it.`,
    ...(woundTracks.length > 0
      ? [
          `- [sheet: who="Name" op="damage" track="Track" kind="Kind" amount="N"] - marks harm of that kind on a wound track; a negative amount heals it.`,
        ]
      : []),
    `- [sheet: who="Name" op="condition" condition="Condition" state="on|off"]`,
    `- [sheet: who="Name" op="note" field="Field" value="text"] - an empty value clears it.`,
    ...(ruleset.rests.length > 0
      ? [`- [sheet: who="Name" op="rest" rest="Rest"] - rests: ${names(ruleset.rests)}.`]
      : []),
    // Only a ruleset with catalogs of ROWS has entries to use: a bestiary writes nothing onto a
    // sheet, so without one of those nothing on a sheet carries a price the Engine could pay, and
    // the line would describe a command that always refuses.
    ...(ruleset.catalogs?.some((catalog) => catalog.holds !== "creatures")
      ? [
          `- [sheet: who="Name" op="use" name="Name on the sheet"] - pays what that ability costs. Add pool="Pool" to pay from a higher pool of the same group.`,
        ]
      : []),
    `Leave out who for the player; who="party" applies to every member. Use the pool, track, field and condition names shown on the sheets. Never write result, reason or now yourself: the Engine adds them. A refused command did not happen, so do not narrate it as if it had.`,
    // A sheet block leaves out a track or a note that still has its default, so the names a command
    // can use are listed once here.
    ...(plainTracks.length > 0
      ? [
          `Tracks: ${plainTracks
            .map(
              (track) =>
                `${track.label} (${track.min} to ${typeof track.max === "number" ? track.max : "the character's own maximum"})`,
            )
            .join(", ")}.`,
        ]
      : []),
    // Best rung to worst, and the kinds a mark may be, so a damage command names real ones.
    ...(woundTracks.length > 0
      ? [
          `Wound tracks: ${woundTracks
            .map(
              (track) =>
                `${track.label} (${track.levels[0]!.label} to ${track.levels[track.levels.length - 1]!.label}; ${track.kinds.map((kind) => kind.id).join(", ")})`,
            )
            .join(", ")}.`,
        ]
      : []),
    ...(ruleset.sheet.live.text.length > 0 ? [`Note fields: ${names(ruleset.sheet.live.text)}.`] : []),
    ...(ruleset.sheet.live.conditions.length > 0 ? [`Conditions: ${names(ruleset.sheet.live.conditions)}.`] : []),
    ...(ruleset.gm.sheetGuidance ? [ruleset.gm.sheetGuidance] : []),
    ``,
    // The sheets are data, and part of that data is free text (names, notes the model wrote with
    // the note command on an earlier turn). The tag marks where data starts and stops; the values
    // inside have had angle brackets removed, so nothing in them can close it. The ruleset's own
    // guidance above is not wrapped: it is a trusted package's one-line text, held to the same
    // `promptSafeText` rule as its check guidance.
    `<character_sheets>`,
  ];
  for (const block of blocks) lines.push(block, ``);
  lines.pop();
  lines.push(`</character_sheets>`);
  return lines;
}

export function buildGmFormatReminder(
  ctx: Pick<
    GmPromptContext,
    | "hasSceneModel"
    | "canGenerateBackgrounds"
    | "artStylePrompt"
    | "hudWidgets"
    | "turnNumber"
    | "gameActiveState"
    | "sessionNumber"
    | "gameTime"
    | "map"
    | "partyNames"
    | "playerName"
    | "characterSprites"
    | "playerInventory"
    | "language"
    | "rating"
    | "enableQuickTimeEvents"
    | "gameSpecialInstructions"
  > & {
    /** Special non-scene-advancing address mode inferred from the current player turn prefix. */
    addressMode?: "party" | "gm";
    /** Whether the current player turn already includes a resolved [dice: ...] roll. */
    playerDiceRollSubmitted?: boolean;
    /** The ruleset this game pinned, when the install can honour it. Its check guidance and
     *  difficulty ladder replace the built-in skill-check lines. Absent is the Engine's own rules
     *  and renders today's reminder byte for byte. */
    ruleset?: import("@marinara-engine/shared").RulesetDefinition;
    /** One rendered sheet block per party member (`renderRulesetSheetBlock`), current as of this
     *  turn. They live in this late reminder and never in the system prompt, because live state
     *  changes every turn and the system prompt is what a provider caches. Only read with `ruleset`. */
    rulesetSheetBlocks?: string[];
    /** Built-in systems an installed experience replaces with its own. Undeclared systems stay built-in. */
    experienceProvidedSystems?: { inventory?: boolean };
    /** Rendered COMMANDS lines for the verbs an installed experience declares (#5798). They belong
     *  in this reminder rather than in the system message because the reminder is what the engine
     *  parses back out of the turn, and because the game system message is rebuilt wholesale by
     *  `injectGameGmPromptRuntime` — anything spliced into it there would be overwritten. Empty or
     *  absent (the normal case, and every case today) renders nothing at all. */
    experienceGmVerbs?: string[];
    /** One-request dice (#6215): the chat's "Finish rolled turns in one request"
     *  switch. Off, absent, or anything but `true` renders today's block byte for byte. */
    oneRequestDice?: boolean;
    /** The sheet names the placeholder's `+NAME` form can resolve this turn. Without names the
     *  sheet-modifier sentence is dropped and only flat modifiers are taught. */
    skillModifiers?: GameSkillModifierView;
    /** The sighted pool sub-option. Only read while `oneRequestDice` is on. */
    dicePoolMode?: boolean;
    /** The rendered pool block, appended after the DICE block while the sub-option is on. The
     *  block's contents belong to the pool itself, so this builder only places it. */
    dicePoolBlock?: string;
    /** Whether `roll_dice` is in the resolved tool set for this turn. The prompt line and the
     *  attachment are gated on the same fact, so the tool is never attached without being
     *  described and never described without being attached. */
    rollDiceToolAttached?: boolean;
  },
): string {
  const lines: string[] = [];
  const normalizedLanguage = normalizePromptLanguage(ctx.language);
  // One-request dice (#6215). Everything this gates is additive: with the switch
  // off every line below renders exactly the bytes it renders today.
  const oneRequestDice = ctx.oneRequestDice === true;
  // A die the player threw is one d20, so it stands in only for a ruleset that rolls exactly that.
  // A pool ruleset has no `dice` at all, which is why the kind is read before the count.
  const rulesetResolution = ctx.ruleset?.resolution;
  const rulesetRollsOneD20 =
    rulesetResolution?.kind === "dice-sum" && rulesetResolution.dice.count === 1 && rulesetResolution.dice.sides === 20;

  const partyNames = normalizePromptTextList(ctx.partyNames);
  const hasParty = partyNames.length > 0;
  const characterSprites = Array.isArray(ctx.characterSprites) ? ctx.characterSprites : [];
  const customSpriteLines = characterSprites
    .map((character) => ({
      name: normalizePromptText(character.name),
      expressions: normalizePromptTextList(character.expressions),
      fullBody: normalizePromptTextList(character.fullBody),
    }))
    .filter((character) => character.name && (character.expressions.length > 0 || character.fullBody.length > 0))
    .flatMap((character) => {
      const lines: string[] = [];
      if (character.expressions.length > 0) {
        lines.push(`  ${character.name} (expressions): ${character.expressions.join(", ")}`);
      }
      if (character.fullBody.length > 0) {
        lines.push(`  ${character.name} (full-body): ${character.fullBody.join(", ")}`);
      }
      return lines;
    });
  const hudWidgets = Array.isArray(ctx.hudWidgets) ? ctx.hudWidgets : [];
  // An experience that tracks items itself owns the whole loop, so asking the GM for [inventory:] here
  // would only produce commands nothing consumes.
  const experienceOwnsInventory = ctx.experienceProvidedSystems?.inventory === true;
  const playerInventory = Array.isArray(ctx.playerInventory)
    ? ctx.playerInventory.flatMap((item) => {
        const name = normalizePromptText(item?.name);
        if (!name) return [];
        const quantity =
          typeof item?.quantity === "number" && Number.isFinite(item.quantity) ? Math.max(1, item.quantity) : 1;
        return [{ name, quantity }];
      })
    : [];

  // ── Current State (closest to generation) ──
  lines.push(
    `<current_state>`,
    `State: ${ctx.gameActiveState ?? "exploration"} | Session #${ctx.sessionNumber ?? 1}${ctx.gameTime ? ` | Time ${ctx.gameTime}` : ""}`,
    `</current_state>`,
    ``,
  );

  lines.push(
    `<output_format>`,
    `Think step by step to decide the next turn: current location and time, the story up to this point, character behavior, dynamics, known vs. hidden information, stakes, cause and effect, sensory tone, and the next point at which player agency returns. Then, output only the VN scene text.`,
    ...(normalizedLanguage && normalizedLanguage.toLowerCase() !== "english"
      ? [
          `LANGUAGE:`,
          `Write directly in ${normalizedLanguage} as a native speaker would. The English examples below illustrate structure and format only.`,
          ``,
        ]
      : []),
    `FORMAT:`,
    `- Narration: text - 1-4 sentences per beat, blank line between beats.`,
    `- Lines: [Name] [main|side|whisper:Target|thought] [neutral|happy|sad|angry|surprised|scared|disgusted|thinking|laughing|crying|blushing|smirk|embarrassed|determined|confused|sleepy|custom]: "Dialogue"|Thought - first bracket specifies the format, main is primary spoken line, side is a short aside like banter, cut-in, or interruption, whisper is quiet speech meant for one listener only, the thought is an internal monologue (no quotes for it), and the last bracket is the character's expression when delivering the line.`,
    `- Party speaker labels must use the exact canonical names listed under PARTY. Never expand, combine, or replace a party member's name with a legal name, nickname, alias, title, or description-derived variant.`,
    ...(customSpriteLines.length
      ? [
          ``,
          `- Available custom sprites per character (use these EXACT names when the character has any listed expression; only fall back to the defaults if the character has no listed sprites):`,
          ...customSpriteLines,
        ]
      : []),
    `- Commands: [tag: params].`,
    `- NEVER mix narration and dialogue in the same line; output them separately.`,
    ...(ctx.rating === "nsfw"
      ? [`- Adult mode enabled. Explicit content is allowed. No plot armor. Abandon moral biases.`]
      : []),
    `- Keep each character's vocabulary, grammar, and cadence distinct, shaped by personality and mood.`,
    `- ZERO TOLERANCE FOR LAZY AI WRITING! Absolutely NO: “doesn’t X, doesn’t Y”, “not X, not Y,” “jaw working,” “mechanical precision,” “ozone,” “somewhere outside,” and negative parallelisms in your narrative prose. Replace them with human cadence and affirmative forms. State what happens instead of what doesn’t (for example, describe something as just “still” instead of “not moving”).`,
    ``,
    `EXAMPLE:`,
    `Rain needles the broken shrine roof.`,
    hasParty
      ? `[${partyNames[0]}] [main] [worried]: "We should move. Now."`
      : `[Guide] [main] [worried]: "We should move. Now."`,
    `[${ctx.playerName ?? "Player"}] [main] [amused]: You remind him that he says that every time the wind changes.`,
    ``,
    ``,
    `PLAYER INPUT:`,
    `- Continue with new content directly from the player's input, treating it like a concluded beat. Do not reiterate anything.`,
    `- Treat only quoted player text as spoken aloud; unquoted text is action, narration, or internal thoughts that cannot be accessed by NPCs unless made observable. NEVER quote or speak for the player character (${ctx.playerName ?? "Player"}). You may indirectly narrate obvious, low-stakes participation and their thoughts (nodding during conversation, laying out details, looking around, etc.) in the second person, but never determine their strategic decisions or exact dialogue. Example:`,
    `[${ctx.playerName ?? "Player"}] [thought] [smirk]: You think to yourself that you're the best.`,
    `- CRITICAL: NEVER echo dialogue, especially not after the player. NO PARROTING!`,
    `- Player agency is not player immunity: the player controls intent, not the world's response. Let successes earned through effort, luck, or cleverness and failures caused by mistakes, bad luck, or poor decisions land with consequences; both good and bad ends can be earned.`,
    `- Keep turn length flexible. If player agency is low (exploration, travel/rest), go longer; if high (combat, dialogue, intense danger), stay concise. Sometimes one line of dialogue or narrative beat is enough.`,
    `- End naturally when it's the player's turn to act or speak.`,
    ``,
  );

  // ── Party Dialogue Instructions (inside output_format, closest to generation) ──
  if (hasParty) {
    lines.push(
      ``,
      `PARTY:`,
      `You also play ${partyNames.join(", ")}. They should naturally converse with each other from time to time. Party members know only what they have seen, heard, inferred, or been told. There is a hard GM/PARTY information boundary: party dialogue must never reveal or hint at hidden arcs, plot twists, unrevealed motives, plans, encounter scripting, or any other GM-only/meta knowledge unless they learned it in-world. No spoilers, overguiding, or meta leakage.`,
    );
    if (ctx.addressMode === "party") {
      lines.push(
        ``,
        `TALK-TO-PARTY MODE:`,
        `The player is addressing the party out loud. Keep narration minimal, let party dialogue carry the turn, and do not advance the scene unless immediate danger forces it.`,
      );
    }
  }

  if (ctx.addressMode === "gm") {
    lines.push(
      ``,
      `TALK-TO-GM MODE:`,
      `The player is addressing you out of character. Answer directly in a clear OOC GM voice and do not advance the scene unless immediate danger makes that unavoidable.`,
    );
  }

  lines.push(
    ``,
    `COMMANDS:`,
    `- Emit commands when canonical game or UI state changes; no command is needed for flavor alone.`,
    `- [choices: "Option A"|"Option B"|"Option C"] - only for explicit player-facing options that require a selection.`,
  );

  // The engine supplies numbers before the GM writes outcome narration.
  if (ctx.ruleset) {
    lines.push(renderRulesetSkillCheckLine(ctx.ruleset, ctx.playerDiceRollSubmitted === true, oneRequestDice));
  } else if (ctx.playerDiceRollSubmitted) {
    lines.push(
      `- [skill_check: skill="Skill Name" dc="1-20" rolls="the player's d20 result"] - use the player's exact die and choose a fair DC (5 trivial, 10 routine under pressure, 15 hard, 20 desperate). Do NOT write modifier, total or result: the engine applies their character-sheet modifiers.`,
    );
  } else {
    lines.push(
      `- [skill_check: skill="Skill Name" dc="1-20"] - request a d20 check only when uncertainty matters. Choose a fair DC (5 trivial, 10 routine under pressure, 15 hard, 20 desperate). Do NOT invent rolls, modifier, total or result: the engine supplies the die and character-sheet modifiers.${
        oneRequestDice
          ? ` When the outcome splits two ways, add branch="label" to this tag and write the branch block described under DICE.`
          : ""
      }`,
    );
  }
  lines.push(
    `- [dice: 3d8+2] - request any NdM roll with an optional flat modifier, even without a tools API. The engine rolls it, capped at 100 dice and 1000 sides per die. Never write the numbers yourself.${
      oneRequestDice
        ? ` When the number does not fork the prose, write a [[roll: 3d8+2]] placeholder in the sentence instead of this tag and keep writing.`
        : ""
    }`,
    // A ruleset game has one rules system, so the line teaching other notations is dropped.
    ...(ctx.ruleset
      ? []
      : [
          `- For other checks, declare the actual notation: [skill_check: skill="Endurance" dc="12" dice="3d6+2"]. These use the notation's modifier, not d20 character-sheet modifiers. For a pool, declare the per-die threshold and required successes: [skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]. Each die at or above threshold counts once; dc is the number of successes needed. Exploding dice, botches, or other special pool rules are not implemented. Never invent pool results or omit its threshold.`,
        ]),
    // The stop-at-the-attempt line is exactly the instruction the second request exists to
    // serve, so it is dropped while the turn has to finish itself.
    ...(oneRequestDice
      ? []
      : [
          `- Place unresolved roll requests before any outcome that depends on them. Describe the attempt, then stop. The engine will send the real results back for you to finish this same turn; do not guess success or failure before receiving them.`,
        ]),
  );

  lines.push(
    ...(ctx.enableQuickTimeEvents === false
      ? []
      : [
          `- [qte: action1|action2|action3, timer: 6s] - only as the final thing in the turn when the player must react to an immediate timed prompt or split-second action. Stop immediately after this tag: choosing an action commits the player's next turn.`,
        ]),
    ...(ctx.map?.type === "node"
      ? [
          `- [map_update: new_location="Location Name" connected_to="Previous Location Name" node_emoji="emoji"] - only when the party arrives at an entirely new location on the current node map.`,
        ]
      : []),
    ...(experienceOwnsInventory
      ? []
      : [
          `- [inventory: action="add|remove" item="Item A, Item B" count="3"] - every real item gain or loss, keep names short and use count/quantity for stacked items.`,
        ]),
    `- [Note: contents] or [Book: contents] - when a new readable note or book is acquired and should be tracked in the journal.`,
    `- [state: exploration|dialogue|combat|travel_rest] - only on actual mode transitions. If you're planning to use [state: combat], this one ALWAYS has to be at the end of the turn, as it initiates a new combat generation and UI.`,
    `- [reputation: npc="Name" action="helped"] - when an NPC's tracked stance changes because of what happened.`,
    `- [party_change: character="Exact Character Name" change="add|remove"] - only when someone truly joins or leaves the party. Use remove when a party member dies, permanently departs, or is no longer traveling with the player.`,
    `- [session_end: reason="goal achieved|good place to pause"] - only when the current session truly ends.`,
  );

  // Game turns carry the roll_dice tool whether or not the chat has tool use switched on,
  // so this block is unconditional. It is what stops the GM inventing numbers: without it
  // the tool is attached and never called.
  //
  // With one-request dice on there is usually no tool to call, and the turn has to finish
  // itself, so the whole block is replaced by the case-by-case rule: which form to write is
  // a fact about the sentence the GM is about to write, which only the GM knows, so the
  // choice is made here rather than by the engine.
  if (oneRequestDice) {
    const modifierNames = [...(ctx.skillModifiers?.skills ?? []), ...(ctx.skillModifiers?.attributes ?? [])]
      .map((name) => normalizePromptText(name))
      .filter((name) => name.length > 0);
    const dicePoolBlock = normalizePromptText(ctx.dicePoolBlock);
    const sightedPool = ctx.dicePoolMode === true;
    lines.push(
      ``,
      `DICE:`,
      `- When an outcome turns on chance, you have three ways to write it. Pick by what the outcome is, not by preference.`,
      ``,
      `- IF THE OUTCOME SPLITS TWO WAYS, WRITE A BRANCH BLOCK. Write the check without numbers, then write both halves. The engine rolls, keeps the half the roll selects, and deletes the other before anyone reads the turn. Neither half may contain a command.`,
      `  [skill_check: skill="Stealth" dc="15" branch="crates"]`,
      `  [branch: crates]`,
      `  [on success] The guard's gaze slides over the crates and away. You are past him.`,
      `  [on failure] A boot scuffs stone. He turns, and his hand is already moving.`,
      `  [/branch]`,
      ``,
      `- IF THE OUTCOME IS ONLY A NUMBER, WRITE A PLACEHOLDER AND KEEP WRITING. Damage, healing, gold, a duration, a count, a distance. The engine rolls it and puts the number in its place, so the sentence reads the same either way.`,
      `  The axe bites deep for [[roll: 2d6+3]] damage, and the wound burns for [[roll: 1d4]] rounds.`,
      // Advertised only when the chat can resolve a name. With no game-state snapshot and no
      // player card sheet there is nothing to resolve, and a form that fails by default is
      // worse than one that is never offered.
      ...(modifierNames.length > 0
        ? [
            `  To add a character-sheet modifier, write its name and let the engine add it: [[roll: 1d8+STR]]. Never write the modifier's value yourself and never write the die's result yourself. These are the only names that resolve: ${modifierNames.join(", ")}.`,
          ]
        : []),
      `  One placeholder holds one NdM notation, at most one flat number, and at most one sheet name. For two different dice, write two placeholders. Never put a placeholder inside a code block or inside another tag's brackets.`,
      ``,
      sightedPool
        ? `- ONLY IF THE NUMBER ITSELF HAS TO DECIDE BETWEEN THREE OR MORE DIFFERENT OUTCOMES, spend a pool value instead: write the value shown below into the check's rolls= and name its slot with pool=, then narrate what it meant in this same turn.`
        : `- ONLY IF THE NUMBER ITSELF HAS TO DECIDE BETWEEN THREE OR MORE DIFFERENT OUTCOMES, ask for the value instead: write [skill_check: skill="Skill Name" dc="${ctx.ruleset ? "N" : "1-20"}"] or [dice: 3d8+2] and stop at the attempt. The engine rolls it and records it. Narrate what it meant at the start of your next turn.`,
      ``,
      `- A check you write in none of these forms is rolled by the engine and recorded, and this turn ends without its outcome; narrate what the number meant at the start of your next turn.`,
      ``,
      `- Never invent a die result, a modifier, a total, or an outcome. Never write both a branch block and a placeholder for the same check.`,
      // Gated on the resolved tool set rather than on the chat's tool list, which is the fact
      // that actually decides whether the tool is offered.
      ...(ctx.rollDiceToolAttached
        ? [
            `- You also have roll_dice on this connection. Prefer the forms above: a tool call costs an extra round. Use the tool only for a roll none of them can serve.`,
          ]
        : []),
      ...(sightedPool && dicePoolBlock ? [``, dicePoolBlock] : []),
    );
  } else {
    lines.push(
      ``,
      `DICE:`,
      `- roll_dice is a real die you can throw. Call it the moment you need an actual number before you can keep writing - an attack, a save, damage, a random outcome the scene then reacts to - passing the notation (for example "1d20+3") and a short reason.`,
      `- Never invent a die result. Wait for the number the tool gives you, then narrate what it means, once, in this same turn.`,
      // A ruleset game's checks come from the character sheet, so a tool-made modifier is never
      // the record: the engine would roll such a tag again and contradict the narration.
      ctx.ruleset
        ? `- Do not use roll_dice for an ability check, skill check or saving throw. Write the [skill_check: ...] tag above without numbers and the engine rolls it from the character sheet.`
        : `- If roll_dice has already returned a skill check's roll, override the sparse-check instructions above: write a complete [skill_check: skill="Skill Name" dc="chosen DC" rolls="actual tool rolls joined with |" modifier="tool modifier" total="tool total" result="critical_success|success|failure|critical_failure" resolution="sum" dice="tool notation"] record using that result. Do not request another engine roll or stop at the attempt; narrate its consequence in this same turn. Use the sparse form only when no roll result is available.`,
      // A player's d20 only stands in for a check where a single d20 is what the rules roll.
      ctx.playerDiceRollSubmitted && (!rulesetResolution || rulesetRollsOneD20)
        ? `- The player already threw for this turn. Use their roll rather than calling the tool again for the same action.`
        : `- A skill check is still written down with the [skill_check: ...] tag above. roll_dice is how you get a number your narration needs in hand; it does not replace that record.`,
      `- If the tool is not available to you on this connection, work from the tag alone and say nothing about tools.`,
    );
  }

  if (ctx.ruleset) lines.push(...renderRulesetSheetSection(ctx.ruleset, ctx.rulesetSheetBlocks ?? []));

  // The installed experience's own verbs, last in the block so the built-ins keep their order. Each
  // line already arrives fully rendered from the verb runtime; nothing here inspects or reformats it.
  const experienceGmVerbs = normalizePromptTextList(ctx.experienceGmVerbs);
  if (experienceGmVerbs.length > 0) lines.push(...experienceGmVerbs);

  if (ctx.gameActiveState === "combat") {
    lines.push(
      ``,
      `COMBAT GM ADJUDICATION:`,
      `Combat rounds are resolved by the combat UI. During ordinary combat narration, do not emit tactical combat commands or recalculate combat mechanics. If the player sends a special maneuver, follow the explicit instruction included in that user message.`,
    );
  }

  if (!ctx.hasSceneModel) {
    lines.push(`Scene tags allowed: [sfx: ...] [bg: ...] [ambient: ...]`);
    if (ctx.canGenerateBackgrounds) {
      lines.push(
        `- If the scene moves to a new visually important location and no existing background tag fits, use [bg: backgrounds:generated:<short-location-slug>].`,
      );
      if (ctx.artStylePrompt?.trim()) {
        const safeArtStylePrompt = normalizePromptText(ctx.artStylePrompt)
          .replace(/[\r\n\t]+/g, " ")
          .replace(/[<>{}[\]]/g, "")
          .replace(/\s{2,}/g, " ")
          .trim();
        if (safeArtStylePrompt) {
          lines.push(`- Generated scene images must follow this visual instruction: ${safeArtStylePrompt}.`);
        }
      }
    }
  }

  if (hudWidgets.length > 0) {
    lines.push(
      ``,
      `HUD WIDGETS:`,
      ...buildWidgetSummaryLines(hudWidgets),
      `- Widget usage: emit widget commands for every real change to these visible HUD widgets. Do not skip a changed widget just because another system tracks related player or party stats.`,
      `- HUD widgets are visual UI state only. Player stats, inventory, party member HP, party relationships, and other durable game facts remain in their own canonical systems; use [widget:] only to mirror a visible widget when that widget's displayed value should change.`,
      `- Command mapping: value = bars/gauges, count = counters, stat = one stat_block entry, add/remove = rotating list items, running/seconds = timers.`,
      `- Widget commands: [widget: id, value: n] [widget: id, stat: "Name", value: x] [widget: id, count: n] [widget: id, add: "Item"] [widget: id, remove: "Item"] [widget: id, running: true, seconds: 60]`,
      `- List widgets: keep at most 5 short entries visible; remove stale items freely.`,
    );
  }

  // Inventory context. Skipped when an experience owns items: an older save can still carry a stale
  // built-in list, which would contradict the inventory the player has on screen.
  if (!experienceOwnsInventory && playerInventory.length > 0) {
    lines.push(``, `PLAYER INVENTORY: ${buildCompactInventoryLine(playerInventory)}`);
  }

  const specialInstructions = normalizePromptText(ctx.gameSpecialInstructions);
  if (specialInstructions) {
    lines.push(``, `SPECIAL INSTRUCTIONS:`, `- ${specialInstructions}`);
  }

  lines.push(`</output_format>`);

  return lines.join("\n");
}

/** Build the setup prompt for initial game creation. */
export interface SetupPromptContext {
  rating?: "sfw" | "nsfw";
  /** Full persona card text (player character) */
  personaCard?: string | null;
  /** Exact player persona name, when known */
  playerName?: string | null;
  /** Full party member card texts */
  partyCards?: string[];
  /** Exact starting party member names selected by the user */
  partyNames?: string[];
  /** GM character card text (if using a character as GM) */
  gmCharacterCard?: string | null;
  /** Enable custom HUD widgets in the game blueprint */
  enableCustomWidgets?: boolean;
  /** User-selected HUD widgets that should be used instead of model-designed setup widgets. */
  customHudWidgets?: HudWidget[];
  /** Selected constant lorebook canon to bake into world generation */
  lorebookContext?: string | null;
  /** `gm.worldGuidance` from the game's pinned ruleset, with its active layers appended. The only
   *  ruleset text world generation reads: everything else a ruleset says reaches the per-turn
   *  reminder instead, because the world is designed once and the sheets change every turn. */
  rulesetWorldGuidance?: string | null;
  /** Language for natural-language JSON values */
  language?: string;
  /** User-overridable GM instruction body that will be used after setup. */
  gameSystemPrompt?: string | null;
  /** Additional game-mode generation instructions that will be used after setup. */
  gameSpecialInstructions?: string | null;
}

export function buildSetupPrompt(ctx: SetupPromptContext = {}): string {
  const rating = ctx.rating ?? "sfw";
  const normalizedLanguage = normalizePromptLanguage(ctx.language);
  const playerName = ctx.playerName?.trim() || (ctx.personaCard ? "the player character named in <user_player>" : null);
  const partyNames = (ctx.partyNames ?? []).map((name) => name.trim()).filter((name) => name.length > 0);
  const characterCardTargets = [...(playerName ? [playerName] : []), ...partyNames];
  const ratingBlock =
    rating === "nsfw"
      ? [
          `<rating>`,
          `Anything goes in this NSFW work of fiction intended for mature audiences. The user has confirmed they are over 18 and understand what they're getting into. No holding back:`,
          ` - Profanities, toxicity, and dark themes will be present. Every character, the user's included, can be raped, harmed, killed, betrayed, dominated, or emotionally/physically used. This goes both ways; they can also be the ones doing those things for personal gain, convictions, or pleasure.`,
          ` - To maintain the integrity of the story, you may be as kind or as cruel as necessary when performing different roles. A good villain is a terrifying one, and a good hero sometimes has to make difficult choices.`,
          ` - Romance and intimate contact should not stall on repetitive approval beats. Handholding, charged proximity, touches, kisses, embraces, jealousy, seduction, and messy attachment can happen naturally when chemistry, body language, or player intent supports them.`,
          ` - During sex between involved adult characters, get kinky and slow down the pace. Apply anatomical (position fatigue, physical consequences) and emotional (experience, communication, aftercare) aspects to craft sensually pornographic erotica. Include foreplay and sexual acts described in great detail; the build-up is as important as the climax. Take consent for granted, assuming some lie, resist, or fight back based on their personality.`,
          ` - Portray violence in gory detail, blood squirting around like in a slasher movie.`,
          `</rating>`,
        ].join("\n")
      : [
          `<rating>`,
          `This SFW work of fiction is intended for mature audiences, and the user dictates the boundaries:`,
          ` - Profanity and dark themes may be present, and every character, including the user's, may be harmed or killed. However, no explicit content will be present.`,
          ` - Romance and affectionate contact should not stall on repetitive approval beats: handholding, charged proximity, touches, kisses, embraces, jealousy, longing, tenderness, and messy attachment can happen naturally when chemistry, body language, or player intent supports them.`,
          ` - During a sex scene, cut to black and progress to the aftermath, and when portraying violence, do realistic descriptions without getting into gory details.`,
          ` - Treat boundaries as part of characterization and scene dynamics, not as repetitive legal disclaimers.`,
          `</rating>`,
        ].join("\n");

  // Build persona + party sections for the system prompt
  const contextSections: string[] = [];
  if (ctx.gmCharacterCard) {
    contextSections.push(
      `<gm_character>`,
      `You will adopt this character's personality and perspective as the Game Master:`,
      ctx.gmCharacterCard,
      `</gm_character>`,
    );
  }
  if (ctx.personaCard) {
    contextSections.push(`<user_player>`, `The player's character:`, ctx.personaCard, `</user_player>`);
  }
  if (ctx.partyCards?.length) {
    contextSections.push(`<party_info>`, `Party members accompanying the player:`, ...ctx.partyCards, `</party_info>`);
  }
  contextSections.push(
    `<character_card_scope>`,
    characterCardTargets.length > 0
      ? `Allowed characterCards names: ${characterCardTargets.join(", ")}`
      : `Allowed characterCards names: none supplied. Use an empty characterCards array unless the setup preferences clearly define the player character.`,
    partyNames.length > 0
      ? `Allowed partyArcs names: ${partyNames.join(", ")}`
      : `Allowed partyArcs names: none. Use an empty partyArcs array.`,
    `Hard rule: characterCards are only for the player persona and the starting party members selected by the user. Do NOT create characterCards for GM characters, love interests, antagonists, lorebook figures, factions, future recruits, or NPCs merely mentioned in preferences/canon. Put non-party people in startingNpcs instead.`,
    `</character_card_scope>`,
  );
  if (ctx.lorebookContext?.trim()) {
    contextSections.push(
      `<lorebook_context>`,
      `Selected constant lorebook canon that MUST be treated as true for this world:`,
      ctx.lorebookContext.trim(),
      `</lorebook_context>`,
    );
  }
  const rulesetWorldGuidance = normalizePromptText(ctx.rulesetWorldGuidance);
  if (rulesetWorldGuidance) {
    contextSections.push(
      `<ruleset_world>`,
      `This game runs on a rules system its author wrote. Design the world so it fits these rules:`,
      rulesetWorldGuidance,
      `</ruleset_world>`,
    );
  }
  if (ctx.customHudWidgets?.length) {
    contextSections.push(
      `<user_hud_widgets>`,
      `The user already chose these exact HUD widgets. Treat them as the visible HUD for this game and do not invent replacement widgets:`,
      JSON.stringify(ctx.customHudWidgets, null, 2),
      `</user_hud_widgets>`,
    );
  }
  const setupGameSystemPrompt = normalizePromptText(ctx.gameSystemPrompt);
  if (setupGameSystemPrompt) {
    contextSections.push(
      `<gm_prompt_preferences>`,
      `The user customized the GM prompt that will run after setup. Design the world to support this play style, but do not let it override the required setup JSON schema or output rules:`,
      setupGameSystemPrompt,
      `</gm_prompt_preferences>`,
    );
  }
  const setupGameSpecialInstructions = normalizePromptText(ctx.gameSpecialInstructions);
  if (setupGameSpecialInstructions) {
    contextSections.push(
      `<gm_extra_instructions>`,
      `The user added these extra GM instructions for play after setup. Honor them while designing the world, unless they conflict with the setup JSON schema or output rules:`,
      setupGameSpecialInstructions,
      `</gm_extra_instructions>`,
    );
  }

  return [
    `You are the Game Master preparing a new RPG campaign.`,
    `The player has given you their preferences. Absorb them fully into your creative output. Do NOT echo them back.`,
    ``,
    `Your job: design a complete game world with story, characters, and visual presentation. Do NOT write any narration or opening scene. That happens separately after you build the world.`,
    ``,
    ...(normalizedLanguage && normalizedLanguage.toLowerCase() !== "english"
      ? [
          `<language>`,
          `Write every natural-language string value in the JSON output in ${normalizedLanguage}. This includes worldOverview, storyArc, plotTwists, descriptions, arcs, labels, and any other prose. Keep ONLY the JSON keys and structural syntax in English.`,
          `</language>`,
          ``,
        ]
      : []),
    `CRITICAL: Your response MUST be a single JSON object using the EXACT keys shown in the <output_format> template below. Do NOT invent your own keys. Do NOT rename fields. The keys "worldOverview", "storyArc", "plotTwists", "startingMap", "startingNpcs", "partyArcs", "characterCards", and "blueprint" are MANDATORY and must appear at the top level. The system will reject any response that uses different key names. Respect <character_card_scope> exactly.`,
    ``,
    ...(ctx.enableCustomWidgets !== false
      ? [
          `<blueprint_widget_types>`,
          `Available HUD widget types for the blueprint:`,
          `  progress_bar: config = { startingValue: number, value: number, max: number }`,
          `  gauge: config = { startingValue: number, value: number, max: number, dangerBelow?: number }`,
          `  relationship_meter: config = { startingValue: number, value: number, max: number, milestones?: [{ at: number, label: string }] }`,
          `  counter: config = { count: number }`,
          `  stat_block: config = { stats: [{ name: string, value: string|number }] }`,
          `  list: config = { items: string[] }`,
          `  timer: config = { seconds: number, running: boolean }`,
          ``,
          `If you design a list widget, treat it as a compact rotating list with a hard cap of 5 entries. Choose items worth surfacing right now, and expect older entries to be swapped out as the situation changes.`,
          `Keep each list item concise and label-like when possible. Avoid long multi-clause sentences, because the same text may need to be referenced later for removal or swapping.`,
          ``,
          `Design up to 4 widgets that fit the genre. IMPORTANT: Party member bonds/reputation MUST be a SINGLE stat_block widget with one stat per member (e.g. stats: [{name: "Nadia", value: 50}, {name: "Vlad", value: 30}]) — do NOT create separate widgets per party member. That single widget counts as 1 of 4.`,
          `Romance = stat_block for bonds + mood gauge. Horror = sanity gauge + clue list. RPG = health/mana bars.`,
          `Inventory is handled separately — do NOT create inventory widgets.`,
          `</blueprint_widget_types>`,
          ``,
        ]
      : []),
    `<intro_effects>`,
    `Available cinematic intro effects (played when the game first loads):`,
    `  fade_from_black (duration) — RECOMMENDED for most games. Classic cinema opening.`,
    `  fade_to_black (duration),`,
    `  blur (duration, intensity 0-1, target "background"|"content"|"all"),`,
    `  vignette (duration, intensity 0-1),`,
    `  letterbox (duration, intensity 0-1),`,
    `  color_grade (duration, intensity, preset "warm"|"cold_blue"|"horror"|"noir"|"vintage"|"neon"|"dreamy"),`,
    `  focus (duration, intensity)`,
    `</intro_effects>`,
    ``,
    `<campaign_structure_rules>`,
    `Optional structure, not mandatory intensity: some games are cozy, romantic, slice-of-life, sandbox, or low-pressure. If rushing the plot would hurt the requested vibe, use empty arrays or soft social/environmental pressures instead of ticking doom.`,
    `Do not fill every optional campaignPlan list. Empty arrays are valid. Aim for 0-1 pressure clock, 0-2 factions, 0-3 quest seeds, and 0-2 encounter principles.`,
    `Hard caps (non-negotiable, the schema rejects more): max 2 pressureClocks, max 2 factions, max 3 questSeeds, max 2 encounterPrinciples. For each pressureClock, steps MUST be an integer between 1 and 12 inclusive (typical: 4-8) and current MUST be an integer between 0 and steps (inclusive).`,
    `campaignPlan formats when used: pressureClocks objects {name, steps, current, failure}; factions objects {name, goal, method, secret}; questSeeds/principles short strings.`,
    `Keep all setup JSON compact: worldOverview 1-2 short paragraphs, map 3-6 regions, startingNpcs 2-5, artStylePrompt 20-30 words. No lore essays.`,
    `Structure should create choices and consequences, not force a railroad. Every hook should be easy for the GM to use later in one turn.`,
    `</campaign_structure_rules>`,
    ``,
    ratingBlock,
    ``,
    ...(contextSections.length > 0 ? [...contextSections, ``] : []),
    `<output_format>`,
    `Your ENTIRE response must be a single valid JSON object matching this exact template. Replace the placeholder values with your creative content. Do NOT add extra keys.`,
    ``,
    `{`,
    `  "worldOverview": "1-2 short vivid paragraphs describing the world, its atmosphere, and only the factions/history needed to start playing. This is shown to the player. DO NOT start sentences with Outside or Somewhere! ZERO TOLERANCE FOR AI SLOP! No GPTisms. BAN generic structures and cliches; NO 'doesn't X, doesn't Y,' 'if X, then Y,' 'not X, but Y,' 'physical punches,' 'practiced ease,' 'predatory instincts,' 'mechanical precision,' 'jaws working,' 'lets out a breath.' Combat them with the human touch.",`,
    `  "storyArc": "SECRET. Compact campaign arc in 2-4 sentences: premise, central tension/antagonist if any, escalation style, and possible end state. If the game is chill or sandbox, define soft ongoing tensions instead of a rushing plotline.",`,
    `  "plotTwists": [`,
    `    "SECRET twist 1: one sentence: revelation | clue | false explanation | reveal trigger | fallout.",`,
    `    "SECRET twist 2: optional second twist or soft social/emotional turn; omit extra twists unless they matter."`,
    `  ],`,
    `  "startingMap": {`,
    `    "name": "Area Name",`,
    `    "description": "Brief area overview, one sentence",`,
    `    "regions": [`,
    `      {`,
    `        "id": "region_1",`,
    `        "name": "Short Name (max 12 chars! Displayed on tiny node map. e.g. 'Old Quarter', 'Bazaar', 'Docks')",`,
    `        "description": "One sentence: what this place looks like and why it matters",`,
    `        "type": "town|wilderness|dungeon|building|camp|other",`,
    `        "connectedTo": ["region_2"],`,
    `        "discovered": true`,
    `      }`,
    `    ]`,
    `  },`,
    `  "startingNpcs": [`,
    `    {`,
    `      "name": "NPC Name",`,
    `      "role": "merchant|quest_giver|ally|antagonist|neutral|other",`,
    `      "description": "One sentence: first impression, voice/cadence, desire, and one secret or complication if useful",`,
    `      "location": "region_1",`,
    `      "reputation": 0`,
    `      "_note_reputation": "integer: 0 = neutral, positive = friendly, negative = hostile"`,
    `    }`,
    `  ],`,
    `  "partyArcs": [`,
    `    {`,
    `      "name": "Exact party member name from the Party Members list",`,
    `      "arc": "1-2 concise sentences: personal side-quest, emotional wound, pressure trigger, likely complication, and what would change them. Use soft relationship stakes for chill games.",`,
    `      "goal": "One concrete personal goal that drives this arc"`,
    `    }`,
    `  ],`,
    `  "characterCards": [`,
    `    {`,
    `      "name": "Exact name from Allowed characterCards names only",`,
    `      "shortDescription": "One-sentence character summary for this game's context",`,
    `      "class": "Their class/role/archetype in this game (e.g. Rogue, Diplomat, Pyro Vision Holder)",`,
    `      "abilities": ["1-2 abilities, each with a brief description"],`,
    `      "strengths": ["1-2 strengths"],`,
    `      "weaknesses": ["1-2 weaknesses"],`,
    `      "extra": { "voice": "brief speech style", "personalStake": "why this game matters to them", "temptation": "optional flaw/temptation", "key": "other compact context such as gender, title, affiliation, element, rank" }`,
    `    }`,
    `  ],`,
    `  "artStylePrompt": "A concise image generation style prompt (20-30 words) describing the unified visual art style for ALL generated images in this game. Match the genre and tone.",`,
    `  "blueprint": {`,
    `    "campaignPlan": {`,
    `      "openingSituation": "Optional one-sentence playable tension for the first scene, or empty string.",`,
    `      "pressureClocks": [],`,
    `      "factions": [],`,
    `      "questSeeds": [],`,
    `      "encounterPrinciples": []`,
    `    },`,
    ...(ctx.enableCustomWidgets !== false
      ? [
          `    "hudWidgets": [`,
          `      {`,
          `        "id": "widget_unique_id",`,
          `        "type": "progress_bar|gauge|relationship_meter|counter|stat_block|list|timer",`,
          `        "label": "Display Name",`,
          `        "icon": "emoji",`,
          `        "position": "hud_left|hud_right",`,
          `        "accent": "#hexcolor",`,
          `        "config": {`,
          `          "_note_config": "For bars/gauges/meters, set startingValue to the first-turn value, set value equal to startingValue, and set max separately. For counters use count, for stat_blocks use stats, for lists use items, and for timers use seconds.",`,
          `          "_note_valueHints": "For stat_block widgets with string values, add valueHints: {statName: 'option1 | option2 | option3'} so the scene model knows the valid choices. Example: for a 'class' stat, valueHints: {'class': 'alpha | omega | beta'}"`,
          `        }`,
          `      }`,
          `    ],`,
        ]
      : []),
    `    "introSequence": [`,
    `      { "effect": "fade_from_black", "duration": number },`,
    `      { "effect": "vignette", "duration": number, "intensity": number }`,
    `    ],`,
    `    "visualTheme": {`,
    `      "palette": "dark_warm|cold|pastel|neon|earth|monochrome",`,
    `      "uiStyle": "parchment|glass|metal|holographic|organic|minimal",`,
    `      "moodDefault": "mysterious|cheerful|tense|romantic|epic|melancholic"`,
    `    }`,
    `  }`,
    `}`,
    ``,
    `Use EXACTLY these top-level keys: worldOverview, storyArc, plotTwists, startingMap, startingNpcs, partyArcs, characterCards, artStylePrompt, blueprint. No other top-level keys. No wrapper objects.`,
    `Scope reminder: startingNpcs may include important non-party characters, but characterCards and partyArcs must not.`,
    `</output_format>`,
  ].join("\n");
}

/** Build a session summary prompt. */
export function buildSessionSummaryPrompt(language?: string | null): string {
  const normalizedLanguage = normalizePromptLanguage(language);
  return [
    `Summarize this completed game session as structured continuity data.`,
    `Return JSON with exactly these keys and no others: summary, resumePoint, partyDynamics, partyState, keyDiscoveries, characterMoments, littleDetails, npcUpdates, statsSnapshot.`,
    ``,
    `1. **summary**: Chronological recap of the key events in 2–4 paragraphs. This is the only field that should read like a flowing narrative. Do not duplicate bullet-list items verbatim from the fields below.`,
    `2. **resumePoint**: One short paragraph or 1–3 sentences stating the exact in-world situation at session end and where the next session must resume from. Name the location, present characters, current pressure, and the immediate unfinished action or decision when possible.`,
    `3. **partyDynamics**: How party member relationships evolved this session. Relationship changes only.`,
    `4. **partyState**: Current condition of the party after the session (HP, morale, injuries, resources, exhaustion, or readiness).`,
    `5. **keyDiscoveries**: Array of durable, actionable continuity facts: important plot points, hidden truths, twists, quests, lore learned, locations, and newly opened leads that still matter next session. Use this single bucket for both discoveries and reveals. Do not include emotional moments or NPC stance changes unless that fact itself is the core continuity item.`,
    `6. **characterMoments**: Array of notable personal moments between the player and specific characters. Use this only for bonding, romance, betrayal, confessions, arguments, or other interpersonal beats. Empty array if none.`,
    `7. **littleDetails**: Array of small personal details to recall later: preferences, habits, favorite things, casual promises, private jokes, fears, motifs, or fragments of a character's past that are not major plot discoveries. Empty array if none.`,
    `8. **npcUpdates**: Array of new NPCs, NPC reputation changes, and important shifts in an NPC's stance, allegiance, or immediate agenda.`,
    `9. **statsSnapshot**: Current party stats, inventory, quest states, and any location / pressure details needed for continuity. This must be a JSON object, not prose.`,
    ``,
    `Cross-field dedupe rules:`,
    `- Each fact belongs in the single best category only once. Do not repeat the same information across summary, keyDiscoveries, characterMoments, littleDetails, npcUpdates, or statsSnapshot.`,
    `- If something is primarily a relationship or emotional beat, keep it out of keyDiscoveries and npcUpdates.`,
    `- If something is primarily an NPC stance change, keep it out of keyDiscoveries unless that stance change is itself the core continuity fact.`,
    `- If something is primarily a lore/quest lead, keep it out of characterMoments.`,
    `- Use empty strings, empty arrays, or {} when a category has no meaningful content.`,
    ``,
    normalizedLanguage
      ? `Language: write every natural-language value in ${normalizedLanguage}. Keep the JSON keys exactly as specified in English.`
      : ``,
    ``,
    `Output valid JSON only.`,
  ].join("\n");
}

/** Build a prompt for concluding a session in one pass. */
export function buildSessionConclusionPrompt(args: {
  language?: string | null;
  includeCharacterCards: boolean;
}): string {
  const normalizedLanguage = normalizePromptLanguage(args.language);
  return [
    `Review this completed game session and return all end-of-session continuity updates in one JSON object.`,
    `Return JSON with exactly these top-level keys and no others: summary, campaignProgression, nextSessionPlan, characterCards.`,
    ``,
    ...(normalizedLanguage
      ? [
          `Language: write every natural-language value in ${normalizedLanguage}. Keep the JSON keys and booleans exactly as specified in English.`,
          ``,
        ]
      : []),
    `summary must be an object with exactly these keys and no others: summary, resumePoint, partyDynamics, partyState, keyDiscoveries, characterMoments, littleDetails, npcUpdates, statsSnapshot.`,
    `- summary.summary: Chronological recap of the key events in 2-4 paragraphs. This is the only field that should read like flowing narrative prose.`,
    `- summary.resumePoint: One short paragraph or 1-3 sentences stating the exact in-world situation at session end and where the next session must resume from.`,
    `- summary.partyDynamics: Relationship changes within the party only.`,
    `- summary.partyState: Current condition of the party after the session, including readiness, injuries, morale, resources, or exhaustion.`,
    `- summary.keyDiscoveries: Array of durable, actionable continuity facts: important plot points, hidden truths, twists, quests, lore learned, locations, and newly opened leads that still matter next session. Use this single bucket for both discoveries and reveals.`,
    `- summary.characterMoments: Array of notable interpersonal beats such as bonding, romance, betrayal, confessions, arguments, or other personal turning points.`,
    `- summary.littleDetails: Array of small personal details to recall later: preferences, habits, favorite things, casual promises, private jokes, fears, motifs, or fragments of a character's past that are not major plot discoveries.`,
    `- summary.npcUpdates: Array of new NPCs, reputation changes, and important shifts in an NPC's stance, allegiance, or immediate agenda.`,
    `- summary.statsSnapshot: JSON object with continuity-critical state such as party stats, inventory, quest progress, location, active pressure, and partyMorale as a number from 0 to 100.`,
    ``,
    `campaignProgression must be an object with exactly these keys and no others: storyArc, plotTwists, partyArcs.`,
    `- campaignProgression.storyArc: Refresh the overarching campaign arc only if this session materially advanced or changed it. Otherwise preserve the current arc.`,
    `- campaignProgression.plotTwists: Keep unresolved twists that still matter, remove obsolete ones, and add any major new twist revealed this session.`,
    `- campaignProgression.partyArcs: Return the FULL array of party arcs. Carry forward unfinished arcs with updated wording where needed. If an arc completed, mark completed: true and include a short resolution note.`,
    ``,
    `nextSessionPlan must prepare a genuinely fresh playable arc while preserving campaign continuity.`,
    `- nextSessionPlan must be an object with exactly these keys: campaignPlan, namedNpcs.`,
    `- nextSessionPlan.campaignPlan must contain exactly: openingSituation, pressureClocks, factions, questSeeds, encounterPrinciples.`,
    `- openingSituation: a fresh immediate goal or situation for the next session, not a recap of the completed one.`,
    `- pressureClocks: 0-2 objects with name, steps (1-12), current (start at 0 unless continuity requires otherwise), and failure.`,
    `- factions: 1-2 active factions or social groups with name, goal, method, and optional secret. Replace stale or resolved faction plans rather than copying them.`,
    `- questSeeds: 1-3 concrete new hooks or goals that can drive the next arc. Do not repeat resolved hooks from the current campaign plan.`,
    `- encounterPrinciples: 0-2 short principles that make the next arc distinct in play.`,
    `- namedNpcs: 1-3 NEW key NPC objects with name, emoji, description, gender, pronouns, location, and roleOrAgenda. Do not repeat an already known NPC.`,
    `- Treat the player's next-session request as strong steering for this plan when one was supplied.`,
    ``,
    `characterCards rules:`,
    ...(args.includeCharacterCards
      ? [
          `- characterCards must be a JSON array containing the FULL updated card for each supplied party character.`,
          `- Return every supplied character exactly once, even if unchanged.`,
          `- Only make conservative changes that are clearly justified by session events. This represents organic growth, not sudden transformation.`,
        ]
      : [`- characterCards must be an empty JSON array because no current character cards were supplied.`]),
    `- Keep each card aligned with the input schema: name, shortDescription, class, abilities, strengths, weaknesses, extra.`,
    ``,
    `Cross-section dedupe rules:`,
    `- Each fact belongs in the single best category only once. Do not restate the same information across summary.summary, summary.keyDiscoveries, summary.characterMoments, summary.littleDetails, summary.npcUpdates, summary.statsSnapshot, or campaignProgression.`,
    `- If something is primarily a relationship or emotional beat, keep it out of keyDiscoveries and npcUpdates.`,
    `- If something is primarily an NPC stance change, keep it out of keyDiscoveries unless that stance change is itself the core continuity fact.`,
    `- If something is primarily a lore or quest lead, keep it out of characterMoments.`,
    `- Be conservative. Preserve existing campaign state and cards when the session did not justify a change.`,
    `- Use empty strings, empty arrays, or {} when a category has no meaningful content.`,
    ``,
    `Output valid JSON only.`,
  ].join("\n");
}

/** Build the prompt for adjusting party character cards at session end. */
export function buildCardAdjustmentPrompt(): string {
  return [
    `You are the Game Master reviewing what happened during this session to decide how the party's character cards should evolve.`,
    ``,
    `Based on the session summary and current cards, decide for EACH character whether their card should change. Changes are OPTIONAL — only adjust what makes narrative sense:`,
    `- **abilities**: Add new abilities the character learned or demonstrated. Remove abilities that were lost or superseded.`,
    `- **strengths**: Update if the character developed new strengths or overcame weaknesses.`,
    `- **weaknesses**: Update if the character gained new vulnerabilities or overcame old ones.`,
    `- **shortDescription**: Update only if the character's identity meaningfully shifted.`,
    `- **class**: Update only if the character evolved into a new class/role (e.g. "Apprentice Mage" → "Battlemage").`,
    `- **rpgStats**: Adjust attribute values (±1–3 per session), HP max, etc. Small incremental changes only.`,
    ``,
    `RULES:`,
    `- Return the FULL updated card for each character, even if only one field changed.`,
    `- If a character needs NO changes, return their card unchanged.`,
    `- Be conservative — only make changes that are clearly justified by session events.`,
    `- This represents organic character growth, not sudden transformation.`,
    ``,
    `Output as a JSON array of character card objects, one per character, with the same structure as the input cards.`,
  ].join("\n");
}

/** Build the prompt for adjusting campaign progression at session end. */
export function buildCampaignProgressionPrompt(language?: string | null): string {
  const normalizedLanguage = normalizePromptLanguage(language);
  return [
    `You are the Game Master reviewing what happened during this session to update the campaign's ongoing progression state.`,
    ``,
    ...(normalizedLanguage
      ? [
          `Language: write every natural-language value in ${normalizedLanguage}. Keep the JSON keys and booleans in English.`,
          ``,
        ]
      : []),
    `Update these campaign tracking fields based on the completed session:`,
    `- storyArc: refresh the overarching campaign arc only if the session materially advanced or changed it.`,
    `- plotTwists: keep unresolved twists that still matter, remove obsolete ones, and add any major new twist revealed this session.`,
    `- partyArcs: return the FULL array of party arcs. Carry forward unfinished arcs with updated wording where needed. If an arc completed, mark \"completed\": true and include a short \"resolution\" note. Keep unfinished arcs as \"completed\": false or omit the field.`,
    ``,
    `RULES:`,
    `- Be conservative. Do not rewrite campaign state unless the session justified it.`,
    `- Preserve continuity with the existing state when nothing changed.`,
    `- Return FULL updated values, not patches.`,
    `- For partyArcs, each item must include: name, arc, goal. It may also include completed and resolution.`,
    `- Do not invent extra top-level keys.`,
    ``,
    `Output exactly one JSON object with these keys: storyArc, plotTwists, partyArcs.`,
  ].join("\n");
}

export function buildPartyRecruitCardPrompt(ctx: {
  targetCharacterName: string;
  targetCharacterCard: string;
  currentPartyNames: string[];
  currentPartyCards?: string | null;
  existingTargetCard?: string | null;
  worldOverview?: string | null;
  storyArc?: string | null;
  plotTwists?: string[] | null;
  campaignHistory?: string | null;
  currentState?: string | null;
  recentTranscript?: string | null;
  language?: string | null;
  purpose?: "recruit" | "regenerate";
}): string {
  const normalizedLanguage = normalizePromptLanguage(ctx.language);
  const isRegeneration = ctx.purpose === "regenerate";
  const sections: string[] = [
    `You are the Game Master updating an ongoing RPG campaign.`,
    isRegeneration
      ? `A companion's party sheet is malformed or outdated. Regenerate one clean JSON character card for them that matches the existing game card schema.`
      : `A new companion is joining the party. Create a single JSON character card for them that matches the existing game card schema.`,
    ``,
    ...(normalizedLanguage && normalizedLanguage.toLowerCase() !== "english"
      ? [
          `<language>`,
          `Write every natural-language string value in ${normalizedLanguage}. Keep JSON keys and structural syntax in English.`,
          `</language>`,
          ``,
        ]
      : []),
    `RULES:`,
    `- Return EXACTLY one JSON object with these keys: name, shortDescription, class, abilities, strengths, weaknesses, extra.`,
    `- Keep the name exactly "${ctx.targetCharacterName}".`,
    `- Ground the card in the existing campaign state, world, and recent events.`,
    `- Respect the supplied character card as canon. Do not contradict it.`,
    ...(isRegeneration
      ? [
          `- Treat the existing target party sheet as a damaged draft: preserve useful facts, but fix malformed fields, bad formatting, missing structure, and awkward or off-tone values.`,
        ]
      : []),
    `- abilities, strengths, and weaknesses must be arrays of strings.`,
    `- extra must be an object of string values.`,
    `- Do not output markdown, explanations, or any wrapper text.`,
    ``,
    `<current_party>`,
    `Current party members: ${ctx.currentPartyNames.length > 0 ? ctx.currentPartyNames.join(", ") : "None"}`,
    `</current_party>`,
    ``,
    `<recruited_character>`,
    ctx.targetCharacterCard,
    `</recruited_character>`,
  ];

  if (ctx.worldOverview) {
    sections.push(``, `<world_overview>`, ctx.worldOverview, `</world_overview>`);
  }
  if (ctx.storyArc) {
    sections.push(``, `<story_arc>`, ctx.storyArc, `</story_arc>`);
  }
  if (ctx.plotTwists && ctx.plotTwists.length > 0) {
    sections.push(``, `<plot_twists>`, ...ctx.plotTwists, `</plot_twists>`);
  }
  if (ctx.campaignHistory?.trim()) {
    sections.push(``, `<campaign_history>`, ctx.campaignHistory.trim(), `</campaign_history>`);
  }
  if (ctx.currentPartyCards?.trim()) {
    sections.push(``, `<existing_party_cards>`, ctx.currentPartyCards.trim(), `</existing_party_cards>`);
  }
  if (ctx.existingTargetCard?.trim()) {
    sections.push(``, `<existing_target_party_sheet>`, ctx.existingTargetCard.trim(), `</existing_target_party_sheet>`);
  }
  if (ctx.currentState?.trim()) {
    sections.push(``, `<current_state>`, ctx.currentState.trim(), `</current_state>`);
  }
  if (ctx.recentTranscript?.trim()) {
    sections.push(``, `<recent_transcript>`, ctx.recentTranscript.trim(), `</recent_transcript>`);
  }

  return sections.join("\n");
}

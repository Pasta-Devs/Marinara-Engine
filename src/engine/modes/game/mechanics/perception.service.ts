// ──────────────────────────────────────────────
// Service: Passive Perception Hints
//
// Deterministically generates environmental hints
// based on the player's perception modifier and
// the current game state. These are injected into
// the GM context so the GM can weave them into
// narration without an extra LLM call.
// ──────────────────────────────────────────────

export interface PerceptionContext {
  /** Player's Perception skill modifier (from playerStats.skills) */
  perceptionMod: number;
  /** Wisdom attribute score (for the attribute modifier) */
  wisdomScore: number;
  /** Current game state */
  gameState: string;
  /** Current location (may contain keywords) */
  location: string | null;
  /** Current weather */
  weather: string | null;
  /** Time of day */
  timeOfDay: string | null;
  /** NPC names currently in the scene */
  presentNpcNames: string[];
  /** Current danger level (0-1, higher = more dangerous area) */
  dangerLevel?: number;
}

export interface PerceptionHint {
  /** The hint text to inject into GM context */
  text: string;
  /** Minimum passive perception DC required to notice */
  dc: number;
  /** Category for flavoring */
  category: "environmental" | "social" | "danger" | "hidden";
}

// ── Hint generation tables ──

const ENVIRONMENTAL_HINTS: Array<{ trigger: (ctx: PerceptionContext) => boolean; dc: number; text: string }> = [
  {
    trigger: (ctx) => ctx.weather === "fog" || ctx.weather === "overcast",
    dc: 10,
    text: "notices faint outlines through the haze that others might miss",
  },
  {
    trigger: (ctx) => ctx.timeOfDay === "night" || ctx.timeOfDay === "midnight",
    dc: 12,
    text: "spots faint movement in the shadows at the edge of vision",
  },
  {
    trigger: (ctx) => ctx.weather === "rain" || ctx.weather === "heavy_rain",
    dc: 14,
    text: "hears something beneath the steady rhythm of rain — footsteps, or perhaps just echoes",
  },
  {
    trigger: (ctx) => !!ctx.location && /cave|dungeon|underground|ruin|tomb/i.test(ctx.location),
    dc: 11,
    text: "feels a subtle draft suggesting a hidden passage or opening nearby",
  },
  {
    trigger: (ctx) => !!ctx.location && /forest|wood|jungle/i.test(ctx.location),
    dc: 10,
    text: "notices broken twigs and disturbed earth — something passed through recently",
  },
  {
    trigger: (ctx) => !!ctx.location && /town|city|market|tavern|inn/i.test(ctx.location),
    dc: 13,
    text: "catches a whispered conversation fragment from a nearby table",
  },
  {
    trigger: (ctx) => ctx.weather === "storm" || ctx.weather === "blizzard",
    dc: 16,
    text: "notices shelter possibilities that others overlook in the chaos",
  },
];

const DANGER_HINTS: Array<{ minDanger: number; dc: number; text: string }> = [
  { minDanger: 0.3, dc: 12, text: "has an uneasy feeling — something about this area doesn't feel right" },
  { minDanger: 0.5, dc: 14, text: "spots signs of recent conflict — scorch marks, bloodstains, or spent ammunition" },
  { minDanger: 0.7, dc: 10, text: "hears distant sounds that suggest danger ahead — growls, clanking, or war drums" },
  { minDanger: 0.9, dc: 8, text: "the air itself feels hostile — this is an extremely dangerous area" },
];

const SOCIAL_HINTS: Array<{ dc: number; text: (npcName: string) => string }> = [
  { dc: 12, text: (n) => `notices ${n} glancing nervously at exits` },
  { dc: 14, text: (n) => `catches ${n} hiding something in their sleeve` },
  { dc: 10, text: (n) => `reads tension in ${n}'s body language` },
  { dc: 16, text: (n) => `spots a concealed weapon on ${n}` },
];

/**
 * Compute passive perception: 10 + perception modifier + wisdom modifier.
 */
function passivePerception(perceptionMod: number, wisdomScore: number): number {
  const wisMod = Math.floor((wisdomScore - 10) / 2);
  return 10 + perceptionMod + wisMod;
}

/**
 * Generate perception hints that the player's passive perception
 * would notice in the current scene. Returns 0-2 hints.
 */
export function generatePerceptionHints(ctx: PerceptionContext): PerceptionHint[] {
  const pp = passivePerception(ctx.perceptionMod, ctx.wisdomScore);
  const hints: PerceptionHint[] = [];

  // Environmental hints
  for (const h of ENVIRONMENTAL_HINTS) {
    if (h.trigger(ctx) && pp >= h.dc) {
      hints.push({ text: h.text, dc: h.dc, category: "environmental" });
    }
  }

  // Danger hints
  const danger = ctx.dangerLevel ?? 0;
  for (const h of DANGER_HINTS) {
    if (danger >= h.minDanger && pp >= h.dc) {
      hints.push({ text: h.text, dc: h.dc, category: "danger" });
    }
  }

  // Social hints (only in dialogue state with NPCs present)
  if (ctx.gameState === "dialogue" && ctx.presentNpcNames.length > 0) {
    // Use a deterministic-ish pick (based on first NPC name length as seed)
    const seedIdx = ctx.presentNpcNames[0]!.length % SOCIAL_HINTS.length;
    const sh = SOCIAL_HINTS[seedIdx]!;
    if (pp >= sh.dc) {
      const npc = ctx.presentNpcNames[0]!;
      hints.push({ text: sh.text(npc), dc: sh.dc, category: "social" });
    }
  }

  // Cap to 2 hints per turn to keep token cost minimal
  return hints.slice(0, 2);
}

/**
 * Format perception hints as a GM context injection block.
 * Returns empty string if no hints.
 */
export function formatPerceptionHints(hints: PerceptionHint[]): string {
  if (hints.length === 0) return "";
  const lines = hints.map((h) => `• The player ${h.text}`);
  return `<passive_perception>\nThe player's keen senses reveal:\n${lines.join("\n")}\nWeave these observations naturally into the narration.\n</passive_perception>`;
}

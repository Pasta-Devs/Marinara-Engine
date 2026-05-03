// ──────────────────────────────────────────────
// Sidecar — Scene Analyzer Prompt
//
// System prompt for the local Gemma model to
// analyze a completed narration turn and produce
// structured scene updates (backgrounds, music,
// widgets, expressions, weather, etc.).
// ──────────────────────────────────────────────

import type { HudWidget, GameNpc, GameActiveState } from "@marinara-engine/shared";

export interface SceneAnalyzerContext {
  /** Current game state before this turn. */
  currentState: GameActiveState;
  /** Approximate turn number (1-based) — cinematic directions included after turn 1 */
  turnNumber?: number;
  /** Available background tags the model can select from. */
  availableBackgrounds: string[];
  /** Available SFX tags. */
  availableSfx: string[];
  /** Current active widgets with their latest values. */
  activeWidgets: HudWidget[];
  /** Tracked NPCs for reputation changes. */
  trackedNpcs: GameNpc[];
  /** Character names in the scene (for expression mapping). */
  characterNames: string[];
  /** Current background tag. */
  currentBackground: string | null;
  /** Current music tag. */
  currentMusic: string | null;
  /** Recently played music tags, most recent first. */
  recentMusic?: string[];
  /** Current ambient tag. */
  currentAmbient?: string | null;
  /** Current weather. */
  currentWeather: string | null;
  /** Current time of day. */
  currentTimeOfDay: string | null;
  /** Whether image generation is configured and this turn is allowed to request a rare CG illustration. */
  canGenerateIllustrations?: boolean;
  /** Whether image generation is configured for missing location/background assets. */
  canGenerateBackgrounds?: boolean;
  /** Unified image style for generated game art. */
  artStylePrompt?: string | null;
}

/** Build the system prompt for scene analysis — kept minimal so all token
 *  budget goes to the user message where the actual choices live. */
export function buildSceneAnalyzerSystemPrompt(_ctx: SceneAnalyzerContext): string {
  return `You are a game state analyzer. Read the narration, then fill in the JSON template using ONLY the exact tags provided as options. Output valid JSON only.`;
}

function backgroundOptionKey(tag: string): string {
  let slug = tag
    .trim()
    .toLowerCase()
    .replace(/:/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefixPattern = /^(?:backgrounds|fantasy|modern|scifi|user|generated|illustrations|q-[a-z0-9]{6,})-+/;
  while (prefixPattern.test(slug)) {
    slug = slug.replace(prefixPattern, "");
  }
  return slug || tag.trim().toLowerCase();
}

function buildBackgroundOptions(ctx?: SceneAnalyzerContext): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const tag of ctx?.availableBackgrounds ?? []) {
    if (!tag || tag.startsWith("backgrounds:illustrations:")) continue;
    const key = backgroundOptionKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(tag);
  }
  if (ctx?.canGenerateBackgrounds) {
    options.push("backgrounds:generated:<short-location-slug>");
  }
  return options;
}

/** Map a widget to its update syntax hint for the JSON template. */
function widgetUpdateHint(w: HudWidget): string {
  const hints = w.config.valueHints;
  switch (w.type) {
    case "progress_bar":
    case "gauge":
    case "relationship_meter":
      return `{"widgetId":"${w.id}","value":<number 0-${w.config.max ?? 100}>}`;
    case "counter":
      return `{"widgetId":"${w.id}","count":<number>}`;
    case "list":
    case "inventory_grid":
      return `{"widgetId":"${w.id}","add":"<item>"} or {"widgetId":"${w.id}","remove":"<item>"}`;
    case "timer":
      return `{"widgetId":"${w.id}","running":<bool>,"seconds":<number>}`;
    case "stat_block": {
      // For stat_blocks, show per-stat update format with hints if available
      const stats = w.config.stats ?? [];
      if (stats.length === 0) return `{"widgetId":"${w.id}","statName":"<name>","value":"<value>"}`;
      const examples = stats.slice(0, 3).map((s) => {
        const hintValues = hints?.[s.name];
        const valHint = hintValues ? `<${hintValues}>` : typeof s.value === "number" ? "<number>" : `"<string>"`;
        return `{"widgetId":"${w.id}","statName":"${s.name}","value":${valHint}}`;
      });
      return examples.join(" OR ");
    }
    default:
      return `{"widgetId":"${w.id}","value":<number>}`;
  }
}

/** Summarise a widget's current state for the model context. */
function widgetStateSummary(w: HudWidget): string {
  switch (w.type) {
    case "progress_bar":
    case "gauge":
    case "relationship_meter":
      return `${w.id} "${w.label}" (${w.type}): ${w.config.value ?? 0}/${w.config.max ?? 100}`;
    case "counter":
      return `${w.id} "${w.label}" (counter): ${w.config.count ?? 0}`;
    case "stat_block": {
      const stats = w.config.stats ?? [];
      const statStr = stats.map((s) => `${s.name}=${s.value}`).join(", ");
      return `${w.id} "${w.label}" (stat_block): [${statStr}]`;
    }
    case "list":
      return `${w.id} "${w.label}" (list): [${(w.config.items ?? []).join(", ")}]`;
    case "inventory_grid": {
      const items = (w.config.contents ?? []).map((c) => c.name).join(", ");
      return `${w.id} "${w.label}" (inventory): [${items}]`;
    }
    case "timer":
      return `${w.id} "${w.label}" (timer): ${w.config.running ? "running" : "stopped"} ${w.config.seconds ?? 0}s`;
    default:
      return `${w.id} "${w.label}" (${w.type})`;
  }
}

/** Build the user prompt with all choices inline in a JSON template. */
export function buildSceneAnalyzerUserPrompt(
  narration: string,
  playerAction?: string,
  ctx?: SceneAnalyzerContext,
): string {
  const parts: string[] = [];
  const canGenerateIllustrations = !!ctx?.canGenerateIllustrations;
  const canGenerateBackgrounds = !!ctx?.canGenerateBackgrounds;

  // ── 1. Narration (longest — furthest from generation) ──

  if (playerAction) {
    parts.push(`<player_action>`, playerAction, `</player_action>`);
  }

  const lines = narration.split(/\r?\n/).filter((l) => l.trim());
  parts.push(`<narration>`);
  for (let i = 0; i < lines.length; i++) {
    parts.push(`[${i}] ${lines[i]}`);
  }
  parts.push(`</narration>`);

  // ── 2. Current state ──

  if (ctx) {
    parts.push(
      ``,
      `Current: state=${ctx.currentState}, bg=${ctx.currentBackground ?? "none"}, weather=${ctx.currentWeather ?? "unset"}, time=${ctx.currentTimeOfDay ?? "unset"}`,
    );
  }

  // ── 3. Task description + JSON template ──

  parts.push(
    ``,
    `TASK: You are the scene director for a visual novel game. Read the narration above and decide:`,
    // music and ambient are scored deterministically on the server — not requested from the model
    `1. SCENE SETTING — Pick the BEST overall background, weather, and time of day that fit the narration. The top-level "background" is the DEFAULT background for this turn. Change it from the current state only if the scene warrants it (new location, mood shift). Use null to keep unchanged.`,
    `2. REPUTATION — If an NPC relationship shifted, note it. Otherwise empty array.`,
    `3. PER-BEAT EFFECTS — Scan each narration beat [0]-[${lines.length - 1}]. For each beat you can optionally add:`,
    `   - "sfx": sound effects (door slam, explosion, footsteps, impact)`,
    `   - "directions": rare cinematic effects at the exact beat they should happen, usually paired with a meaningful sound or reveal`,
    `   - "background": a DIFFERENT background tag if the characters move to a new location at that beat. The background stays the same until the NEXT segment that changes it, so only set "background" on the beat where characters actually arrive at a new location. Do NOT repeat the current background.`,
    `   Only include segments that HAVE at least one effect — omit empty segments.`,
    ...(canGenerateBackgrounds
      ? [
          `4. GENERATED LOCATION BACKGROUNDS — If the narration enters a new location and none of the listed background tags fit, use backgrounds:generated:<short-location-slug>. This requests a normal reusable location background image.`,
        ]
      : []),
    ...((ctx?.turnNumber ?? 1) > 1
      ? [
          `${canGenerateBackgrounds ? "5" : "4"}. CINEMATIC DIRECTIONS — If the whole turn warrants an opening/establishing visual effect, include it. Otherwise empty array. Available: fade_from_black, fade_to_black, flash, screen_shake, blur, vignette, letterbox, color_grade (presets: warm, cold_blue, horror, noir, vintage, neon, dreamy), focus, pulse, slow_zoom, impact_zoom, tilt, desaturate, chromatic_aberration, film_grain, rain_streaks, spotlight.`,
        ]
      : []),
    ...(canGenerateIllustrations
      ? [
          `${(ctx?.turnNumber ?? 1) > 1 ? (canGenerateBackgrounds ? "6" : "5") : canGenerateBackgrounds ? "5" : "4"}. RARE SPECIAL-SCENE CG BACKGROUND — You may request ONE generated VN CG illustration only for a major, story-defining moment: first kiss, duel climax, major revelation, sacrifice, council confrontation, boss entrance, or emotional peak. Do not request one for routine travel, normal dialogue, regular combat blows, room changes, shopping, exposition, or scenery.`,
          `   The image must be from the player protagonist's POV, in the game's established art style${ctx?.artStylePrompt ? ` (${ctx.artStylePrompt})` : ""}. The protagonist should not be visible except hands/arms when the narration explicitly requires it.`,
        ]
      : []),
    ``,
    `RULES:`,
    `- Use ONLY the exact tags listed in the template below. If backgrounds:generated:<short-location-slug> is listed, replace <short-location-slug> with a short concrete location slug.`,
    `- Expressions and widget updates are handled by the GM model. Do NOT include them in your output.`,
    `- segmentEffects can be an EMPTY array [] when nothing changed.`,
    `- Cinematic directions are spice, not punctuation. Use at most 2 total directions per turn, and never more than 1 direction in any 3-beat span. Prefer none for routine dialogue.`,
    `- Use directions for real visual beats: a door slamming, a blade impact, thunder, a memory fracture, a kiss/reveal close-up, a panic spike, a scene transition, or a major emotional turn. Do not attach directions to every line.`,
    `- The background should stay the SAME as long as the characters remain in the same location. Only change it in a segment when characters physically move to a different place.`,
    ...(canGenerateIllustrations
      ? [
          `- Use "illustration" rarely. Most turns MUST keep it null. If you request it, the prompt must describe the exact illustrated moment, visible characters, player POV, mood, lighting, and composition.`,
          `- "illustration.characters" should list only visible named characters in the image so their reference pictures can be attached.`,
        ]
      : canGenerateBackgrounds
        ? [
            `- Do not include the rare "illustration" object this turn. Generated reusable location backgrounds are still allowed via backgrounds:generated:<short-location-slug>.`,
          ]
        : [`- Do not include image-generation or illustration requests.`]),
    ...(ctx?.currentBackground
      ? [`- Current background is "${ctx.currentBackground}". Keep it unless the characters move to a new location.`]
      : [
          `- There is no background yet (game just started). You MUST set a background — either in the top-level "background" field or in the first segment's "background" field.`,
        ]),
    `- Output ONLY valid JSON, nothing else.`,
    ``,
  );

  // Build background options once. The JSON template refers back to this list
  // instead of duplicating it for top-level and per-segment background fields.
  const backgroundOptions = buildBackgroundOptions(ctx);
  const bgOptions = backgroundOptions.length ? backgroundOptions.join(" | ") : "null";

  // Ambient — handled automatically by scoreAmbient(), excluded from prompt

  // NPC names for reputation
  const npcNames = ctx?.trackedNpcs?.length ? ctx.trackedNpcs.map((n) => n.name) : [];
  const reputationHint =
    npcNames.length > 0 ? `[{"npcName":"<${npcNames.join(" | ")}>","action":"<what changed>"}] or []` : `[]`;

  // SFX options for segment effects
  const sfxLine = ctx?.availableSfx?.length ? `      "sfx": ["<${ctx.availableSfx.join(" | ")}>"]` : null;

  // Background options for segment effects (optional per-segment override)
  const bgLine = `      "background": "<one BACKGROUND OPTIONS value>"`;

  // Build ONE segment example showing the range
  const segmentFields: string[] = [];
  segmentFields.push(`      "segment": <0-${lines.length - 1}>`);
  if (sfxLine) segmentFields.push(sfxLine);
  segmentFields.push(
    `      "directions": [{"effect":"<flash|screen_shake|pulse|slow_zoom|impact_zoom|tilt|desaturate|chromatic_aberration|film_grain|rain_streaks|spotlight|focus|vignette|letterbox|color_grade>","duration":<0.4-3>,"intensity":<0-1>}]  // optional, rare`,
  );
  segmentFields.push(`${bgLine}  // optional — only when characters move to a new location`);
  const segmentBody = segmentFields.join(",\n");

  parts.push(
    `BACKGROUND OPTIONS: <${bgOptions}>`,
    ``,
    `{`,
    `  "background": "<one BACKGROUND OPTIONS value | null>",`,
    `  "weather": "<clear | cloudy | foggy | rainy | stormy | snowy | windy | frost | null>",`,
    `  "timeOfDay": "<dawn | morning | noon | afternoon | evening | night | midnight | null>",`,
    `  "reputationChanges": ${reputationHint},`,
    `  "segmentEffects": [`,
    `    {`,
    segmentBody,
    `    },`,
    `    ...`,
    `  ]`,
    ...((ctx?.turnNumber ?? 1) > 1
      ? [
          `,  "directions": [{"effect":"<fade_from_black|fade_to_black|flash|screen_shake|blur|vignette|letterbox|color_grade|focus|pulse|slow_zoom|impact_zoom|tilt|desaturate|chromatic_aberration|film_grain|rain_streaks|spotlight>","duration":<number>}]`,
        ]
      : []),
    ...(canGenerateIllustrations
      ? [
          `,  "illustration": null OR {"segment":<0-${lines.length - 1}>,"prompt":"<important CG image prompt from player POV>","characters":["<visible named character>"],"reason":"<why this is CG-worthy>","slug":"<short-safe-slug>"}`,
        ]
      : []),
    `}`,
  );

  return parts.join("\n");
}

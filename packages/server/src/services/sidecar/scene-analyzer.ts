// ──────────────────────────────────────────────
// Sidecar — Scene Analyzer Prompt
//
// System prompt for the local Gemma model to
// analyze a completed narration turn and produce
// structured scene updates (backgrounds, music,
// widgets, expressions, weather, etc.).
// ──────────────────────────────────────────────

import {
  LOCATION_KINDS,
  MUSIC_GENRES,
  MUSIC_INTENSITIES,
  type HudWidget,
  type GameNpc,
  type GameActiveState,
  type SceneSpotifyTrackCandidate,
} from "@marinara-engine/shared";

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
  /** Whether Game Mode is using Spotify instead of local music assets. */
  useSpotifyMusic?: boolean;
  /** Spotify tracks preselected mechanically for the scene analyzer to choose from. */
  availableSpotifyTracks?: SceneSpotifyTrackCandidate[];
  /** Currently or most recently played Spotify track URI. */
  currentSpotifyTrack?: string | null;
  /** Recently played Spotify track URIs, most recent first. */
  recentSpotifyTracks?: string[];
  /** Current ambient tag. */
  currentAmbient?: string | null;
  /** Current tracked in-world location. */
  currentLocation?: string | null;
  /** Current weather. */
  currentWeather: string | null;
  /** Current time of day. */
  currentTimeOfDay: string | null;
  /** Game setup genre, e.g. fantasy, sci-fi, modern. */
  genre?: string | null;
  /** Game setup setting, e.g. medieval kingdom, cyberpunk city. */
  setting?: string | null;
  /** Short world overview, when available from game setup metadata. */
  worldOverview?: string | null;
  /** Whether image generation is configured and this turn is allowed to request a rare CG illustration. */
  canGenerateIllustrations?: boolean;
  /** Whether image generation is configured for missing location/background assets. */
  canGenerateBackgrounds?: boolean;
  /** Unified image style for generated game art. */
  artStylePrompt?: string | null;
  /** Extra user instructions for rare generated scene illustration prompts. */
  imagePromptInstructions?: string | null;
}

/** Build the system prompt for scene analysis — kept minimal so all token
 *  budget goes to the user message where the actual choices live. */
export function buildSceneAnalyzerSystemPrompt(_ctx: SceneAnalyzerContext): string {
  return `You are a game state analyzer. Read the narration, then fill in the JSON template using ONLY the exact tags and enum values provided as options. Output valid JSON only.`;
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

function compactImagePromptInstructions(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 5000);
}

function compactPromptLabel(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/["\r\n<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function sceneAnalyzerSegmentBeats(narration: string): string[] {
  const lines = narration.split(/\r?\n/);
  const beats: string[] = [];
  let fallbackLines: string[] = [];
  const readablePlaceholderRe = /^\s*\[(?:Note|Book):/i;
  const narrationRegex = /^\s*Narration\s*:\s*(.+)$/i;
  const legacyDialogueRegex = /^\s*Dialogue\s*\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;
  const compactDialogueRegex = /^\s*\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/;
  const partyLineRegex =
    /^\s*\[([^\]]+)\]\s*\[(main|side|extra|action|thought|whisper(?::([^\]]+))?)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;

  const flushFallback = () => {
    const text = fallbackLines.join("\n").trim();
    if (text) beats.push(text);
    fallbackLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushFallback();
      continue;
    }

    const structuredMatch =
      line.match(narrationRegex) ??
      line.match(legacyDialogueRegex) ??
      line.match(partyLineRegex) ??
      line.match(compactDialogueRegex);
    if (structuredMatch) {
      flushFallback();
      beats.push(line);
      continue;
    }

    if (readablePlaceholderRe.test(line)) {
      flushFallback();
      beats.push(line);
      continue;
    }

    fallbackLines.push(line);
  }

  flushFallback();
  const fallback = narration.trim();
  return beats.length > 0 ? beats : fallback ? [fallback] : [];
}

export interface FittedSceneAnalyzerNarration {
  beats: Array<{ index: number; text: string }>;
  omittedBeatCount: number;
  truncated: boolean;
}

/** Keep the most recent scene beats within the local analyzer budget without renumbering them. */
export function fitSceneAnalyzerNarrationBeats(
  narration: string,
  maxChars = Number.POSITIVE_INFINITY,
): FittedSceneAnalyzerNarration {
  const allBeats = sceneAnalyzerSegmentBeats(narration).map((text, index) => ({ index, text }));
  const boundedMaxChars = Number.isFinite(maxChars) ? Math.max(1, Math.floor(maxChars)) : Number.POSITIVE_INFINITY;
  const fullLength = allBeats.reduce((total, beat) => total + beat.text.length + String(beat.index).length + 3, 0);
  if (fullLength <= boundedMaxChars) {
    return { beats: allBeats, omittedBeatCount: 0, truncated: false };
  }

  const selected: FittedSceneAnalyzerNarration["beats"] = [];
  let remaining = boundedMaxChars;
  for (let index = allBeats.length - 1; index >= 0; index -= 1) {
    const beat = allBeats[index]!;
    const labelLength = String(beat.index).length + 3;
    const availableTextChars = remaining - labelLength;
    if (availableTextChars <= 0) break;
    if (beat.text.length <= availableTextChars) {
      selected.push(beat);
      remaining -= labelLength + beat.text.length;
      continue;
    }
    if (selected.length === 0) {
      const omissionMarker = " …[middle omitted]… ";
      const text =
        availableTextChars <= omissionMarker.length
          ? beat.text.slice(-availableTextChars)
          : `${beat.text.slice(0, Math.floor((availableTextChars - omissionMarker.length) / 3))}${omissionMarker}${beat.text.slice(
              -(availableTextChars -
                omissionMarker.length -
                Math.floor((availableTextChars - omissionMarker.length) / 3)),
            )}`;
      selected.push({ ...beat, text });
    }
    break;
  }

  selected.reverse();
  return {
    beats: selected,
    omittedBeatCount: Math.max(0, allBeats.length - selected.length),
    truncated: true,
  };
}

/** Build the user prompt with all choices inline in a JSON template. */
export function buildSceneAnalyzerUserPrompt(
  narration: string,
  playerAction?: string,
  ctx?: SceneAnalyzerContext,
  narrationBudgetChars = Number.POSITIVE_INFINITY,
): string {
  const parts: string[] = [];
  const canGenerateIllustrations = !!ctx?.canGenerateIllustrations;
  const canGenerateBackgrounds = !!ctx?.canGenerateBackgrounds;
  const imagePromptInstructions = compactImagePromptInstructions(ctx?.imagePromptInstructions);
  const musicGenreOptions = [...MUSIC_GENRES, "null"].join(" | ");
  const musicIntensityOptions = [...MUSIC_INTENSITIES, "null"].join(" | ");
  const locationKindOptions = [...LOCATION_KINDS, "null"].join(" | ");
  const useSpotifyMusic = !!ctx?.useSpotifyMusic;
  const spotifyOptions = (ctx?.availableSpotifyTracks ?? []).slice(0, 50);
  const recentSpotifyTracks = Array.from(
    new Set([ctx?.currentSpotifyTrack ?? null, ...(ctx?.recentSpotifyTracks ?? [])]),
  ).filter((uri): uri is string => typeof uri === "string" && uri.startsWith("spotify:track:"));

  // ── 1. Narration (longest — furthest from generation) ──

  if (playerAction) {
    parts.push(`<player_action>`, playerAction, `</player_action>`);
  }

  const fittedNarration = fitSceneAnalyzerNarrationBeats(narration, narrationBudgetChars);
  const beats = fittedNarration.beats;
  const maxSegmentIndex = Math.max(0, sceneAnalyzerSegmentBeats(narration).length - 1);
  parts.push(`<narration>`);
  if (fittedNarration.truncated) {
    parts.push(`[${fittedNarration.omittedBeatCount} earlier narration beat(s) omitted to fit local context]`);
  }
  for (const beat of beats) {
    parts.push(`[${beat.index}] ${beat.text}`);
  }
  parts.push(`</narration>`);

  // ── 2. Current state ──

  if (ctx) {
    parts.push(
      ``,
      `Current: state=${ctx.currentState}, location=${ctx.currentLocation ?? "unset"}, bg=${ctx.currentBackground ?? "none"}, weather=${ctx.currentWeather ?? "unset"}, time=${ctx.currentTimeOfDay ?? "unset"}`,
    );
    const worldContext = [
      ctx.genre ? `genre=${compactPromptLabel(ctx.genre)}` : "",
      ctx.setting ? `setting=${compactPromptLabel(ctx.setting)}` : "",
      ctx.worldOverview ? `world=${compactPromptLabel(ctx.worldOverview)}` : "",
    ].filter(Boolean);
    if (worldContext.length > 0) {
      parts.push(`World context: ${worldContext.join(", ")}`);
    }
  }

  if (spotifyOptions.length > 0) {
    parts.push(
      ``,
      `SPOTIFY TRACK OPTIONS:`,
      ...spotifyOptions.map((track, index) => {
        const album = track.album ? `, album="${compactPromptLabel(track.album)}"` : "";
        return `${index + 1}. uri="${track.uri}", title="${compactPromptLabel(track.name)}", artist="${compactPromptLabel(track.artist)}"${album}`;
      }),
    );
  }

  if (useSpotifyMusic && recentSpotifyTracks.length > 0) {
    parts.push(
      ``,
      `RECENT SPOTIFY TRACKS (avoid repeating unless no other option fits):`,
      ...recentSpotifyTracks.slice(0, 8).map((uri, index) => `${index + 1}. ${uri}`),
    );
  }

  // ── 3. Task description + JSON template ──

  parts.push(
    ``,
    `TASK: You are the scene director for a visual novel game. Read the narration above and decide:`,
    `1. SCENE SETTING — Pick the BEST overall background, weather, and time of day that fit the narration. The top-level "background" is the DEFAULT background for this turn. Change it from the current state only if the scene warrants it (new location, mood shift). Use null to keep unchanged. For timeOfDay, use null unless the narration explicitly says time changed or a meaningful amount of time passed, such as sunset, nightfall, sleeping until morning, resting overnight, or a stated time skip.`,
    ...(useSpotifyMusic
      ? [
          `2. AUDIO DIRECTION — Choose locationKind for ambient scoring, and set spotifyTrack to ONE Spotify URI from SPOTIFY TRACK OPTIONS that best fits the just-finished turn. Use null only if there are no suitable options. Do NOT output musicGenre or musicIntensity.`,
        ]
      : [
          `2. AUDIO DIRECTION — Choose compact musicGenre/musicIntensity/locationKind hints. Do NOT choose music or ambient file tags; Marinara maps these hints to assets deterministically. Do NOT output spotifyTrack.`,
        ]),
    `3. REPUTATION — If an NPC relationship shifted, note it. Otherwise empty array.`,
    `4. PER-BEAT EFFECTS — Scan the provided narration beats using their original indices [0]-[${maxSegmentIndex}]. For each beat you can optionally add:`,
    `   - "sfx": sound effects (door slam, explosion, footsteps, impact)`,
    `   - "directions": rare cinematic effects at the exact beat they should happen, usually paired with a meaningful sound or reveal`,
    `   - "background": a DIFFERENT background tag if the characters move to a new location at that beat. The background stays the same until the NEXT segment that changes it, so only set "background" on the beat where characters actually arrive at a new location. Do NOT repeat the current background.`,
    `   Only include segments that HAVE at least one effect — omit empty segments.`,
    ...(canGenerateBackgrounds
      ? [
          `5. GENERATED LOCATION BACKGROUNDS — If the narration enters a new location and none of the listed background tags fit, use backgrounds:generated:<short-location-slug>. This requests a normal reusable location background image. The generated prompt MUST include concrete scenery plus any provided world context (genre, setting, current location, and time/weather when relevant). For example, a field in a medieval fantasy game should be a medieval fantasy field, not a modern farm.`,
        ]
      : []),
    ...((ctx?.turnNumber ?? 1) > 1
      ? [
          `${canGenerateBackgrounds ? "6" : "5"}. CINEMATIC DIRECTIONS — If the whole turn warrants an opening/establishing visual effect, include it. Otherwise empty array. Available: fade_from_black, fade_to_black, flash, screen_shake, blur, vignette, letterbox, color_grade (presets: warm, cold_blue, horror, noir, vintage, neon, dreamy), focus, pulse, slow_zoom, impact_zoom, tilt, desaturate, chromatic_aberration, film_grain, rain_streaks, spotlight.`,
        ]
      : []),
    ...(canGenerateIllustrations
      ? [
          `${(ctx?.turnNumber ?? 1) > 1 ? (canGenerateBackgrounds ? "7" : "6") : canGenerateBackgrounds ? "6" : "5"}. RARE SPECIAL-SCENE CG BACKGROUND — You may request ONE generated VN CG illustration only for a major, story-defining moment: first kiss, duel climax, major revelation, sacrifice, council confrontation, boss entrance, or emotional peak. Do not request one for routine travel, normal dialogue, regular combat blows, room changes, shopping, exposition, or scenery.`,
          `   The image must be from the player protagonist's POV, in the game's established art style${ctx?.artStylePrompt ? ` (${ctx.artStylePrompt})` : ""}. The protagonist should not be visible except hands/arms when the narration explicitly requires it.`,
        ]
      : []),
    ``,
    `RULES:`,
    `- Use ONLY the exact tags listed in the template below. If backgrounds:generated:<short-location-slug> is listed, replace <short-location-slug> with a short concrete location slug.`,
    `- Expressions and widget updates are handled by the GM model. Do NOT include them in your output.`,
    ...(useSpotifyMusic
      ? [
          `- spotifyTrack must be null or one URI string copied exactly from SPOTIFY TRACK OPTIONS. Never invent a Spotify URI. Do not wrap it in an object. Do not include a reason.`,
          `- Prefer a spotifyTrack that is not in RECENT SPOTIFY TRACKS when another suitable option exists.`,
          `- Do not include musicGenre or musicIntensity when Spotify music is enabled.`,
        ]
      : [
          `- musicGenre describes scene genre/vibe (fantasy, horror, romance, etc.), not weather. musicIntensity is calm for safe/rest/romance, tense for uncertainty/suspense, intense for combat/chase/climax.`,
          `- Do not include spotifyTrack when Spotify music is disabled.`,
        ]),
    `- locationKind describes the physical space for ambience: interior, exterior, underground, urban, or nature. Use null if unclear.`,
    `- timeOfDay is calendar time, not lighting mood. Do NOT change it for indoor shadows, lamps, dark rooms, or atmosphere; keep null unless the story clearly moved to a new time of day. Use morning after an overnight sleep/wake-up, evening for sunset/dusk, night for nightfall, and midnight only for the middle of the night.`,
    `- segmentEffects can be an EMPTY array [] when nothing changed.`,
    `- Cinematic directions are spice, not punctuation. Use at most 2 total directions per turn, and never more than 1 direction in any 3-beat span. Prefer none for routine dialogue.`,
    `- Use directions for real visual beats: a door slamming, a blade impact, thunder, a memory fracture, a kiss/reveal close-up, a panic spike, a scene transition, or a major emotional turn. Do not attach directions to every line.`,
    `- The background should stay the SAME as long as the characters remain in the same location. Only change it in a segment when characters physically move to a different place.`,
    `- Generated reusable background prompts must be world-grounded scenery. Include concrete place details and any provided setting era/genre context; exclude characters, UI, text, and modern objects unless the world context supports them.`,
    ...(canGenerateIllustrations
      ? [
          `- Use "illustration" rarely. Most turns MUST keep it null. If you request it, the prompt must describe the exact illustrated moment, visible characters, player POV, mood, lighting, and composition.`,
          `- "illustration.title" should be a short concrete visual title that names what the picture is of, not just why it matters.`,
          ...(imagePromptInstructions
            ? [`- When writing "illustration.prompt", obey these user image instructions: ${imagePromptInstructions}`]
            : []),
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

  // Music/ambient file tags are handled automatically by scoreMusic()/scoreAmbient().
  // The prompt only asks for compact audio direction fields.

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
  segmentFields.push(`      "segment": <0-${maxSegmentIndex}>`);
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
    `  "timeOfDay": "<dawn | morning | afternoon | evening | night | midnight | null>",`,
    `  "locationKind": "<${locationKindOptions}>",`,
    ...(useSpotifyMusic
      ? [
          `  "spotifyTrack": ${spotifyOptions.length > 0 ? `null OR "<one Spotify URI from SPOTIFY TRACK OPTIONS>"` : "null"},`,
        ]
      : [`  "musicGenre": "<${musicGenreOptions}>",`, `  "musicIntensity": "<${musicIntensityOptions}>",`]),
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
          `,  "illustration": null OR {"segment":<0-${maxSegmentIndex}>,"title":"<short concrete visual title>","prompt":"<important CG image prompt from player POV>","characters":["<visible named character>"],"reason":"<why this is CG-worthy>","slug":"<short-safe-slug>"}`,
        ]
      : []),
    `}`,
  );

  return parts.join("\n");
}

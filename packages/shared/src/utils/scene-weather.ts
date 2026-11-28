// ──────────────────────────────────────────────
// Scene weather and indoors/outdoors, as fixed words.
//
// Shared by the weather drawing (no full-screen rain indoors) and by weather
// versions of chat backgrounds (the same room, now with rain on the windows).
// Both only ever see words from fixed lists, never the story's own text.
// ──────────────────────────────────────────────

export const SCENE_WEATHER_CATEGORIES = [
  "clear",
  "cloudy",
  "rain",
  "storm",
  "snow",
  "hail",
  "fog",
  "sand",
  "ash",
  "embers",
  "wind",
  "blossom",
  "aurora",
] as const;
export type SceneWeatherCategory = (typeof SCENE_WEATHER_CATEGORIES)[number];

/**
 * The story weather as one word from SCENE_WEATHER_CATEGORIES, "" when there is no weather.
 * Same keyword order as the weather drawing, so the picture and the particles always agree.
 */
export function sceneWeatherCategory(weather: string | null | undefined): SceneWeatherCategory | "" {
  if (!weather || !weather.trim()) return "";
  const w = weather.toLowerCase();
  if (w.includes("thunder") || w.includes("lightning")) return "storm";
  if (w.includes("hail")) return "hail";
  if (w.includes("blizzard") || w.includes("snow") || w.includes("sleet")) return "snow";
  if (w.includes("frost") || w.includes("cold") || w.includes("freez")) return "snow";
  if (w.includes("fog") || w.includes("mist") || w.includes("haze")) return "fog";
  if (w.includes("sand") || w.includes("dust storm") || w.includes("sirocco")) return "sand";
  if (w.includes("ash") || w.includes("volcanic") || w.includes("smoke")) return "ash";
  if (w.includes("ember") || w.includes("fire") || w.includes("inferno")) return "embers";
  if (w.includes("wind") || w.includes("breez") || w.includes("gust")) return "wind";
  if (w.includes("cherry") || w.includes("blossom") || w.includes("petal")) return "blossom";
  if (w.includes("aurora") || w.includes("northern light") || w.includes("polar light")) return "aurora";
  if (w.includes("rain") || w.includes("storm") || w.includes("downpour")) {
    return /storm|downpour/.test(w) ? "storm" : "rain";
  }
  if (/cloud|overcast|grey|gray/.test(w)) return "cloudy";
  return "clear";
}

/**
 * Weather kinds a background picture is repainted for. Clear, cloudy and wind keep the plain
 * picture (they barely change a painting), and so does anything the drawn weather already covers
 * with no visible difference.
 */
export const BACKGROUND_WEATHER_VERSIONS = [
  "rain",
  "storm",
  "snow",
  "blizzard",
  "hail",
  "fog",
  "sand",
  "ash",
  "embers",
  "blossom",
  "aurora",
] as const;
export type BackgroundWeatherVersion = (typeof BACKGROUND_WEATHER_VERSIONS)[number];

// Words that say nothing a painter could show, dropped before an unusual weather becomes its own
// version ("Clear skies, 24°C" is just the plain picture; "a meteor shower" is `meteor-shower`).
const MILD_WEATHER_WORDS = new Set(
  (
    "a an the and or with of in on at to by from some few light heavy slight strong mild gentle soft " +
    "very quite rather mostly partly partial scattered occasional bit little lots lot " +
    "clear clean fair fine nice pleasant sunny sun sunshine sunlit bright dry calm still " +
    "warm hot cool cold chilly crisp brisk balmy humid muggy temperate mild freezing frosty " +
    "cloud clouds cloudy overcast grey gray gloomy dull dim " +
    "wind winds windy breeze breezy gust gusts gusty draft " +
    "weather sky skies day night morning afternoon evening noon midnight dawn dusk today tonight " +
    "temperature temp degrees degree celsius fahrenheit c f high low air outside"
  ).split(" "),
);

/**
 * A background weather version key: one of BACKGROUND_WEATHER_VERSIONS, "clear" for the dry copy
 * of a picture that was first painted in bad weather, or a slug of an unusual weather in the
 * story's own words (`meteor-shower`, `blood-moon`).
 */
export type BackgroundWeatherVersionKey = string;

/** The slug of an unusual weather, or "" when nothing paintable is left after the mild words. */
export function unusualWeatherSlug(weather: string | null | undefined): string {
  const words = (weather ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .split(/[^a-z]+/u)
    .filter((word) => word.length > 1 && !MILD_WEATHER_WORDS.has(word));
  const kept: string[] = [];
  for (const word of words) {
    if (kept.includes(word)) continue;
    if ([...kept, word].join("-").length > 32) break;
    kept.push(word);
    if (kept.length === 3) break;
  }
  return kept.join("-");
}

/** The background weather version a weather needs, or "" for the plain picture. */
export function backgroundWeatherVersion(weather: string | null | undefined): BackgroundWeatherVersionKey | "" {
  const category = sceneWeatherCategory(weather);
  if (!category) return "";
  if (category === "snow" && /blizzard|whiteout|white-out|snowstorm|snow storm/u.test(weather!.toLowerCase())) {
    return "blizzard";
  }
  if ((BACKGROUND_WEATHER_VERSIONS as readonly string[]).includes(category)) return category;
  // Clear, cloudy or windy by keyword: still its own version when the words name something else.
  return unusualWeatherSlug(weather);
}

const VERSION_SUFFIX = /--wx-([a-z]+(?:-[a-z]+){0,2})$/u;
const TIME_SUFFIX = /--tod-(dawn|day|sunset|night)$/u;

/**
 * Split a background file name into its plain picture's stem, its weather version and its time of
 * day version. `inn--wx-rain--tod-night.png` is the inn in the rain at night; either part may be "".
 */
export function parseBackgroundWeatherVersionName(filename: string): {
  baseStem: string;
  ext: string;
  version: BackgroundWeatherVersionKey | "";
  time: BackgroundTimeOfDay | "";
} {
  const dot = filename.lastIndexOf(".");
  let stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot + 1) : "";
  let time: BackgroundTimeOfDay | "" = "";
  const timeMatch = TIME_SUFFIX.exec(stem);
  if (timeMatch) {
    time = timeMatch[1] as BackgroundTimeOfDay;
    stem = stem.slice(0, timeMatch.index);
  }
  const match = VERSION_SUFFIX.exec(stem);
  if (!match || match[1]!.length > 32) return { baseStem: stem, ext, version: "", time };
  return { baseStem: stem.slice(0, match.index), ext, version: match[1]!, time };
}

/** File stem of a weather version: `<plain stem>--wx-<weather>`. */
export function backgroundWeatherVersionStem(baseStem: string, version: BackgroundWeatherVersionKey): string {
  return backgroundVersionStem(baseStem, version, "");
}

/**
 * File stem of a version in some weather and/or at some time of day:
 * `<plain stem>--wx-<weather>`, `<plain stem>--tod-<time>` or `<plain stem>--wx-<weather>--tod-<time>`.
 */
export function backgroundVersionStem(
  baseStem: string,
  version: BackgroundWeatherVersionKey | "",
  time: BackgroundTimeOfDay | "",
): string {
  return `${baseStem}${version ? `--wx-${version}` : ""}${time ? `--tod-${time}` : ""}`;
}

/**
 * Longest plain stem (in UTF-8 bytes) that still leaves room for the longest version suffix
 * (`--wx-<32>--tod-sunset`) and a file extension within the usual 255-byte file name limit.
 */
export const BACKGROUND_VERSION_MAX_BASE_STEM_BYTES = 180;

/** Whether versions of a plain picture with this stem have names that fit on disk. */
export function backgroundVersionNameFits(baseStem: string): boolean {
  return new TextEncoder().encode(baseStem).byteLength <= BACKGROUND_VERSION_MAX_BASE_STEM_BYTES;
}

/** A weather version, a time of day version, or both (anything but a plain picture). */
export function isBackgroundWeatherVersionName(filename: string): boolean {
  const parsed = parseBackgroundWeatherVersionName(filename);
  return parsed.version !== "" || parsed.time !== "";
}

// ── Time of day ──

/**
 * Times of day a background is repainted for. Four on purpose: each is a visibly different light
 * (and a separate picture to make), and the drawn sky tint covers the hours in between.
 */
export const BACKGROUND_TIME_VERSIONS = ["dawn", "day", "sunset", "night"] as const;
export type BackgroundTimeOfDay = (typeof BACKGROUND_TIME_VERSIONS)[number];

function timeOfDayFromPhrase(text: string): BackgroundTimeOfDay | "" {
  if (/\b(midnight|night|nighttime|witching hour|moonlit|moonlight|small hours|wee hours|late evening)\b/u.test(text))
    return "night";
  if (/\b(dawn|daybreak|sunrise|first light|early morning|predawn|pre-dawn)\b/u.test(text)) return "dawn";
  if (/\b(sunset|sundown|dusk|twilight|evening|golden hour|nightfall)\b/u.test(text)) return "sunset";
  if (/\b(morning|noon|midday|afternoon|daytime|daylight|day)\b/u.test(text)) return "day";
  return "";
}

/** The time of day of an hour on a 24-hour clock. */
function timeOfDayFromHour(hour: number): BackgroundTimeOfDay {
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "sunset";
  return "night";
}

/**
 * The story's time (World State "Time": "7:40 PM", "21:15", "late evening") as one of
 * BACKGROUND_TIME_VERSIONS, or "" when it can't tell. A clock reading wins over words.
 */
export function backgroundTimeOfDay(time: string | null | undefined): BackgroundTimeOfDay | "" {
  const text = (time ?? "").toLowerCase().trim();
  if (!text) return "";
  const meridiem = /\b(1[0-2]|0?\d)(?:[:.h]([0-5]\d))?\s*([ap])\.?m\b\.?/u.exec(text);
  if (meridiem) {
    const hour = Number(meridiem[1]) % 12;
    return timeOfDayFromHour(meridiem[3] === "p" ? hour + 12 : hour);
  }
  const clock = /\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/u.exec(text);
  if (clock) return timeOfDayFromHour(Number(clock[1]));
  return timeOfDayFromPhrase(text);
}

/**
 * The time of day a picture's name or tags say it shows ("tavern-night.png", #sunset), or "".
 * Used for pictures Illustrator didn't paint, whose time isn't on record.
 */
export function backgroundTimeOfDayFromWords(words: readonly string[]): BackgroundTimeOfDay | "" {
  for (const word of words) {
    const found = timeOfDayFromPhrase(word.toLowerCase().replace(/[-_]+/gu, " "));
    if (found) return found;
  }
  return "";
}

export type SceneShelter = "indoors" | "outdoors" | "";

// Open-air parts of a place win inside the same name: "Inn courtyard", "Palace gardens", "Bedroom balcony".
const OUTDOOR_WORDS =
  /\b(outside|outdoors?|open air|courtyard|yard|garden|gardens|balcony|terrace|rooftop|roof|porch|veranda|patio|deck|street|streets|alley|road|path|trail|square|plaza|market ?place|field|fields|meadow|forest|woods|jungle|beach|shore|coast|harbou?r|docks?|pier|river|lake|mountain|cliff|valley|desert|plains?|camp|campsite|graveyard|cemetery|ruins|wilderness|sky|airship deck)\b/u;
const INDOOR_WORDS =
  /\b(inside|indoors?|interior|room|rooms|bedroom|chamber|chambers|quarters|hall|hallway|corridor|kitchen|parlou?r|lounge|study|office|library|classroom|lab|laboratory|inn|tavern|pub|bar|caf[eé]|cafe|restaurant|shop|store|boutique|bakery|apartment|flat|house|home|cottage|cabin|manor|mansion|castle keep|throne room|palace|temple|church|chapel|cathedral|shrine|museum|theat(?:er|re)|cinema|hospital|clinic|infirmary|school|dormitory|dorm|barracks|prison|cell|dungeon|cellar|basement|attic|crypt|tomb|vault|cave|cavern|tunnel|tunnels|sewer|sewers|mine|bunker|warehouse|workshop|forge|smithy|stable|barn|tent|carriage|train|cabin|bridge room|cockpit|ship'?s? (?:hold|cabin|galley)|spaceship|station|lobby|elevator|stair(?:s|case|well)|bathroom|bath|washroom|dining room|ballroom|gallery|arena interior)\b/u;

function classifyShelterSegment(segment: string): SceneShelter {
  if (OUTDOOR_WORDS.test(segment)) return "outdoors";
  if (INDOOR_WORDS.test(segment)) return "indoors";
  return "";
}

/** World Maps kinds that are always under a roof. */
const INDOOR_MAP_KINDS = new Set(["building", "floor", "room"]);

/**
 * Whether the scene is under a roof, from the World Maps current place kind and/or the World State
 * location text. "" when it can't tell (the weather then draws as it always has).
 *
 * Location text usually runs most specific first ("Tideglass Inn, Brinewatch"), so the first part
 * that says anything decides.
 */
export function sceneShelter(location: string | null | undefined, mapKind?: string | null): SceneShelter {
  const text = (location ?? "").toLowerCase().trim();
  if (text) {
    for (const segment of text.split(/[,;|>›»/()\n]+|\s[-–—]\s/u)) {
      const found = classifyShelterSegment(segment.trim());
      if (found) {
        // A map room is indoors even when its name has "garden" in it, unless the text says outside.
        if (
          found === "outdoors" &&
          mapKind &&
          INDOOR_MAP_KINDS.has(mapKind) &&
          !/\b(outside|outdoors?)\b/u.test(segment)
        ) {
          return "indoors";
        }
        return found;
      }
    }
  }
  if (mapKind && INDOOR_MAP_KINDS.has(mapKind)) return "indoors";
  return "";
}

const WEATHER_VERSION_WORDS: Record<string, string> = {
  clear: "clear, dry weather with no rain, snow or fog",
  rain: "steady rain",
  storm: "a heavy thunderstorm with dark clouds and lashing rain",
  snow: "falling snow, with fresh snow settled outside",
  blizzard: "a howling blizzard: driving snow, deep drifts and a near white-out sky",
  hail: "a hailstorm",
  fog: "thick fog",
  sand: "a blowing sandstorm",
  ash: "falling volcanic ash under a smoky sky",
  embers: "drifting embers and smoke, with a fiery orange glow from a fire nearby",
  blossom: "blossom petals drifting on the breeze, with the trees outside in full bloom",
  aurora: "a night sky lit by a shimmering green and violet aurora",
};

/** What the image model is told the weather is. Unusual weather is its slug read back as words. */
function weatherVersionWords(version: BackgroundWeatherVersionKey): string {
  return WEATHER_VERSION_WORDS[version] ?? `this weather: ${version.replace(/-/gu, " ")}`;
}

const TIME_VERSION_WORDS: Record<BackgroundTimeOfDay, { light: string; indoors: string }> = {
  dawn: {
    light: "dawn: the sun just rising, a pale pink and gold sky, soft low light and long cool shadows",
    indoors: "pale pink and gold dawn light coming through the windows, the room still dim and cool",
  },
  day: {
    light: "full daylight: a bright sky and clear, neutral light",
    indoors: "bright daylight coming through the windows and lighting the room",
  },
  sunset: {
    light: "sunset: a low sun, a glowing orange and pink sky, warm golden light and long shadows",
    indoors: "warm orange sunset light slanting through the windows, with long shadows across the room",
  },
  night: {
    light:
      "night: a dark sky with moonlight and stars, deep blue shadows, and any lamps, lanterns, windows or fires in the scene lit",
    indoors:
      "night: a dark sky outside the windows, the room lit by its own lamps, candles or fire where it has them, with deep shadows elsewhere",
  },
};

/**
 * The instruction that turns a background into its weather version. Indoors the weather is only
 * seen through windows and openings; outdoors it falls across the scene.
 */
export function backgroundWeatherVersionInstruction(
  version: BackgroundWeatherVersionKey,
  shelter: SceneShelter,
): string {
  return backgroundVersionInstruction(version, "", shelter);
}

/**
 * The instruction that repaints a background in other weather, at another time of day, or both, in
 * one picture. The place and its composition stay; only the weather and the light change.
 */
export function backgroundVersionInstruction(
  version: BackgroundWeatherVersionKey | "",
  time: BackgroundTimeOfDay | "",
  shelter: SceneShelter,
): string {
  const parts: string[] = [];
  if (version && time) {
    parts.push("Repaint the reference image as the same place in different weather and at a different time of day.");
  } else if (time) {
    parts.push("Repaint the reference image as the same place at a different time of day.");
  } else {
    parts.push("Repaint the reference image as the same place in different weather.");
  }
  parts.push(
    `Keep the exact same location, composition, camera angle, layout, furniture, ${time ? "architecture and art style" : "architecture, colours and art style"}; change only ${
      version && time
        ? "the weather, the time of day and the light they bring"
        : time
          ? "the time of day and its light"
          : "the weather and the light it brings"
    }.`,
  );
  if (version) {
    const weather = weatherVersionWords(version);
    parts.push(
      shelter === "indoors"
        ? `The scene is indoors: show the ${weather} only through the windows, doorways and other openings (streaks or flakes on the glass, a darker or greyer sky outside, wet or dusty sills where it fits), with the room itself dry and the indoor light adjusted to match.`
        : shelter === "outdoors"
          ? `The scene is outdoors: show ${weather} falling across the whole scene, with the ground, surfaces and light changed to match.`
          : `Show ${weather}: through the windows if the place is indoors, or across the whole scene if it is outdoors, with the light changed to match.`,
    );
  }
  if (time) {
    const words = TIME_VERSION_WORDS[time];
    parts.push(
      shelter === "indoors"
        ? `${version ? "Also show" : "The scene is indoors: show"} ${words.indoors}.`
        : shelter === "outdoors"
          ? `The time of day is ${words.light}.`
          : `The time of day is ${words.light}. If the place is indoors, show it through the windows and in the room's own light.`,
    );
  }
  parts.push("No characters, no people, no text.");
  return parts.join(" ");
}

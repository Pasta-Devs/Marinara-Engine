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
 * Weather a background picture is worth repainting for. Everything else (clear, cloudy, wind,
 * blossom, embers, aurora) keeps the original picture.
 */
export const BACKGROUND_WEATHER_VERSIONS = ["rain", "storm", "snow", "hail", "fog", "sand", "ash"] as const;
export type BackgroundWeatherVersion = (typeof BACKGROUND_WEATHER_VERSIONS)[number];

/** The background weather version a weather word needs, or "" for the plain picture. */
export function backgroundWeatherVersion(weather: string | null | undefined): BackgroundWeatherVersion | "" {
  const category = sceneWeatherCategory(weather);
  return (BACKGROUND_WEATHER_VERSIONS as readonly string[]).includes(category)
    ? (category as BackgroundWeatherVersion)
    : "";
}

/**
 * A file's weather version key: one of BACKGROUND_WEATHER_VERSIONS, or "clear" for the dry copy of
 * a picture that was first painted in bad weather.
 */
export type BackgroundWeatherVersionKey = BackgroundWeatherVersion | "clear";

const VERSION_SUFFIX = /--wx-(rain|storm|snow|hail|fog|sand|ash|clear)$/u;

/** Split a background file name into its plain picture's stem and its weather version. */
export function parseBackgroundWeatherVersionName(filename: string): {
  baseStem: string;
  ext: string;
  version: BackgroundWeatherVersionKey | "";
} {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot + 1) : "";
  const match = VERSION_SUFFIX.exec(stem);
  if (!match) return { baseStem: stem, ext, version: "" };
  return { baseStem: stem.slice(0, match.index), ext, version: match[1] as BackgroundWeatherVersionKey };
}

/** File stem of a weather version: `<plain stem>--wx-<weather>`. */
export function backgroundWeatherVersionStem(baseStem: string, version: BackgroundWeatherVersionKey): string {
  return `${baseStem}--wx-${version}`;
}

export function isBackgroundWeatherVersionName(filename: string): boolean {
  return parseBackgroundWeatherVersionName(filename).version !== "";
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

const WEATHER_VERSION_WORDS: Record<BackgroundWeatherVersionKey, string> = {
  clear: "clear, dry weather with no rain, snow or fog",
  rain: "steady rain",
  storm: "a heavy thunderstorm with dark clouds and lashing rain",
  snow: "falling snow, with fresh snow settled outside",
  hail: "a hailstorm",
  fog: "thick fog",
  sand: "a blowing sandstorm",
  ash: "falling volcanic ash under a smoky sky",
};

/**
 * The instruction that turns a background into its weather version. Indoors the weather is only
 * seen through windows and openings; outdoors it falls across the scene.
 */
export function backgroundWeatherVersionInstruction(
  version: BackgroundWeatherVersionKey,
  shelter: SceneShelter,
): string {
  const weather = WEATHER_VERSION_WORDS[version];
  const where =
    shelter === "indoors"
      ? `The scene is indoors: show the ${weather} only through the windows, doorways and other openings (streaks or flakes on the glass, a darker or greyer sky outside, wet or dusty sills where it fits), with the room itself dry and the indoor light adjusted to match.`
      : shelter === "outdoors"
        ? `The scene is outdoors: show ${weather} falling across the whole scene, with the ground, surfaces and light changed to match.`
        : `Show ${weather}: through the windows if the place is indoors, or across the whole scene if it is outdoors, with the light changed to match.`;
  return [
    "Repaint the reference image as the same place in different weather.",
    "Keep the exact same location, composition, camera angle, layout, furniture, architecture, colours and art style; change only the weather and the light it brings.",
    where,
    "No characters, no people, no text.",
  ].join(" ");
}

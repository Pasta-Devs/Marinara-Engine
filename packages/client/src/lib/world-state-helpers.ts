import type { TrackerTemperatureUnit } from "../stores/ui.store";

const WORLD_MONTH_ALIASES: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

type WorldTimeOfDay = "dawn" | "day" | "dusk" | "night" | "unknown";

// Preserve the legacy HUD's approximate clock positions for familiar phrases.
function getWorldTimePhrase(text: string): { timeOfDay: WorldTimeOfDay; hour: number | null } | null {
  if (/\b(dawn|sunrise|daybreak|morning)\b/.test(text)) {
    return { timeOfDay: "dawn", hour: /\bmorning\b/.test(text) ? 9 : /\b(dawn|sunrise)\b/.test(text) ? 6 : null };
  }
  if (/\b(noon|midday|afternoon|daylight)\b/.test(text)) {
    return { timeOfDay: "day", hour: /\b(noon|midday)\b/.test(text) ? 12 : /\bafternoon\b/.test(text) ? 15 : null };
  }
  if (/\b(dusk|sunset|twilight|evening|golden hour)\b/.test(text)) {
    return {
      timeOfDay: "dusk",
      hour: /\b(dusk|sunset|evening)\b/.test(text) ? 18 : null,
    };
  }
  if (/\b(night|midnight|witching|moon|moonlit|moonlight|late)\b/.test(text)) {
    return {
      timeOfDay: "night",
      hour: /\bmidnight\b/.test(text) ? 0 : /\bnight\b/.test(text) ? 22 : null,
    };
  }
  return null;
}

function getWorldTimeOfDay(hour: number | null, text: string): WorldTimeOfDay {
  const phrase = getWorldTimePhrase(text);
  if (phrase) return phrase.timeOfDay;
  if (hour === null) return "unknown";
  // These bands match the legacy HUD icon colors.
  if (hour >= 5 && hour < 10) return "dawn";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

export function getWorldTimeDisplay(time: string | null | undefined) {
  const text = (time ?? "").trim();
  if (!text) {
    return {
      kind: "empty" as const,
      raw: "",
      hour: null,
      minute: null,
      timeOfDay: "unknown" as const,
    };
  }

  const normalized = text.toLowerCase();
  const meridiem = text.match(/\b(1[0-2]|0?\d)(?:[:.h]([0-5]\d))?\s*([ap])\.?m?\.?\b/i);
  if (meridiem) {
    const displayHour = Number(meridiem[1]);
    const minute = Number(meridiem[2] ?? "00");
    const marker = meridiem[3]!.toLowerCase();
    const hour = marker === "p" ? (displayHour % 12) + 12 : displayHour % 12;
    return {
      kind: "clock" as const,
      hour,
      minute,
      timeOfDay: getWorldTimeOfDay(hour, normalized),
      raw: text,
    };
  }

  const twentyFourHour = text.match(/\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/i);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    return {
      kind: "clock" as const,
      hour,
      minute,
      timeOfDay: getWorldTimeOfDay(hour, normalized),
      raw: text,
    };
  }

  const phrase = getWorldTimePhrase(normalized);
  const phraseHour = phrase?.hour ?? null;
  return {
    kind: "phrase" as const,
    raw: text,
    hour: phraseHour,
    minute: phraseHour === null ? null : 0,
    timeOfDay: phrase?.timeOfDay ?? "unknown",
  };
}

export type WorldWeatherFamily =
  | "thunder"
  | "blizzard"
  | "heavy-rain"
  | "rain"
  | "hail"
  | "snow"
  | "fog"
  | "sand"
  | "ash"
  | "fire"
  | "wind"
  | "blossom"
  | "aurora"
  | "cloud"
  | "clear"
  | "heat"
  | "cold"
  | "atmosphere";

export function classifyWorldWeather(weather: string | null | undefined): WorldWeatherFamily {
  const text = (weather ?? "").toLowerCase();
  if (!text) return "atmosphere";
  if (text.includes("thunder") || text.includes("lightning")) return "thunder";
  if (text.includes("blizzard")) return "blizzard";
  if (text.includes("heavy rain") || text.includes("downpour") || /\bstorm\b/.test(text)) return "heavy-rain";
  if (text.includes("rain") || text.includes("drizzle") || text.includes("shower")) return "rain";
  if (text.includes("hail")) return "hail";
  if (text.includes("snow") || text.includes("sleet") || text.includes("frost")) return "snow";
  if (text.includes("fog") || text.includes("mist") || text.includes("haze")) return "fog";
  if (text.includes("sand") || text.includes("dust")) return "sand";
  if (text.includes("ash") || text.includes("volcanic") || text.includes("smoke")) return "ash";
  if (text.includes("ember") || text.includes("fire") || text.includes("inferno")) return "fire";
  if (text.includes("wind") || text.includes("breez") || text.includes("gust")) return "wind";
  if (text.includes("cherry") || text.includes("blossom") || text.includes("petal")) return "blossom";
  if (text.includes("aurora") || text.includes("northern light")) return "aurora";
  if (text.includes("cloud") || text.includes("overcast") || text.includes("grey") || text.includes("gray")) return "cloud";
  if (text.includes("clear") || text.includes("sunny") || text.includes("bright")) return "clear";
  if (text.includes("hot") || text.includes("swelter")) return "heat";
  if (text.includes("cold") || text.includes("freez")) return "cold";
  return "atmosphere";
}

function parseTemperatureValue(temperature: string | null | undefined) {
  const match = (temperature ?? "").match(/(-?\d+(?:\.\d+)?)(?:\s*°?\s*(f(?:ahrenheit)?|c(?:elsius)?)\b)?/i);
  if (!match) return null;
  const numeric = parseFloat(match[1]!);
  const unit = match[2]?.toLowerCase();
  return unit?.startsWith("f") ? (numeric - 32) * (5 / 9) : numeric;
}

function parsePureTemperatureValue(temperature: string | null | undefined) {
  const match = (temperature ?? "").match(/^\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*(f(?:ahrenheit)?|c(?:elsius)?)?\s*$/i);
  if (!match) return null;
  const numeric = parseFloat(match[1]!);
  return match[2]?.toLowerCase().startsWith("f") ? (numeric - 32) * (5 / 9) : numeric;
}

function getTemperatureKeywordHint(temperature: string | null | undefined) {
  const text = (temperature ?? "").toLowerCase();
  if (/\b(freez|frigid|arctic|glacial|sub-?zero|blizzard)/.test(text)) return -10;
  if (/\b(cold|chill|frost|wintry|icy|bitter|nipp)/.test(text)) return 2;
  if (/\b(cool|brisk|crisp|refresh)/.test(text)) return 12;
  if (/\b(mild|pleasant|comfort|temperate|fair)/.test(text)) return 20;
  if (/\b(warm|balmy|toasty|muggy|humid|stuffy|sultry)/.test(text)) return 28;
  if (/\b(hot|swelter|blaz|scorch|burn|heat|boil|sear|bak)/.test(text)) return 38;
  return null;
}

export function getTemperatureGaugeDisplay(
  temperature: string | null | undefined,
  unit: TrackerTemperatureUnit = "celsius",
) {
  const numericCelsius = parseTemperatureValue(temperature);
  const pureParsed = parsePureTemperatureValue(temperature);
  const value = numericCelsius ?? getTemperatureKeywordHint(temperature);
  const percent =
    value === null ? 42 : Math.max(8, Math.min(96, Math.round(((Math.max(-12, Math.min(42, value)) + 12) / 54) * 100)));
  const color =
    value === null
      ? "color-mix(in srgb, var(--foreground) 42%, var(--muted-foreground) 28%)"
      : value < 0
        ? "rgb(96 165 250)"
        : value < 15
          ? "rgb(56 189 248)"
          : value < 30
            ? "rgb(132 204 22)"
            : "rgb(248 113 113)";
  return {
    color,
    isPure: pureParsed !== null,
    label:
      pureParsed !== null
        ? unit === "fahrenheit"
          ? `${Math.round(pureParsed * (9 / 5) + 32)}°F`
          : `${Math.round(pureParsed)}°C`
        : (temperature ?? "").trim() || "--",
    percent,
    value,
  };
}

export function getLocationPinColor(location: string | null | undefined) {
  const text = (location ?? "").toLowerCase();
  if (
    /\b(sea|ocean|lake|river|pond|creek|bay|shore|beach|harbor|harbour|port|coast|marsh|swamp|waterfall|spring|well|dock|canal|dam|reef|lagoon|estuary|fjord|cove)\b/.test(
      text,
    )
  )
    return "text-blue-400";
  if (
    /\b(mountain|hill|cliff|peak|ridge|canyon|gorge|cave|cavern|mine|quarry|summit|bluff|crag|volcano|crater|mesa|plateau|ravine|boulder)\b/.test(
      text,
    )
  )
    return "text-amber-700";
  if (
    /\b(city|town|village|castle|palace|fortress|market|shop|inn|tavern|bar|pub|guild|district|quarter|bazaar|temple|church|cathedral|shrine|tower|gate|square|plaza|street|alley|arena|throne|court|capitol|capital|metro|subway)\b/.test(
      text,
    )
  )
    return "text-sky-400";
  if (
    /\b(room|hall|chamber|dungeon|cellar|basement|attic|library|study|bedroom|kitchen|office|lab|laboratory|vault|corridor|passage|cabin|hut|tent|interior|house|home|building|apartment|manor|lodge|dormitor|warehouse|prison|cell|jail)\b/.test(
      text,
    )
  )
    return "text-amber-300";
  return "text-emerald-400";
}

function parseWorldDate(date: string | null | undefined): { day: string | null; monthIndex: number | null } {
  const text = (date ?? "").trim();
  if (!text) return { day: null, monthIndex: null };

  const isoMatch = text.match(/\b\d{4}[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const month = Number(isoMatch[1]);
    return { day: isoMatch[2] ?? null, monthIndex: month >= 1 && month <= 12 ? month - 1 : null };
  }

  const numericDate = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}\b/);
  if (numericDate) {
    const first = Number(numericDate[1]);
    const second = Number(numericDate[2]);
    const monthFirst = first <= 12;
    const month = monthFirst ? first : second;
    return {
      day: monthFirst ? numericDate[2] : numericDate[1],
      monthIndex: month >= 1 && month <= 12 ? month - 1 : null,
    };
  }

  for (const [alias, index] of Object.entries(WORLD_MONTH_ALIASES)) {
    if (new RegExp(`\\b${alias}\\.?\\b`, "i").test(text)) {
      return {
        day: text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i)?.[1] ?? null,
        monthIndex: index,
      };
    }
  }
  return {
    day: text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i)?.[1] ?? null,
    monthIndex: null,
  };
}

export function getWorldDateDisplay(date: string | null | undefined) {
  const text = (date ?? "").trim();
  const normalized = text.toLowerCase();
  const { day, monthIndex } = parseWorldDate(text);
  let iconColor = "text-zinc-200";
  if (!text) iconColor = "text-[var(--muted-foreground)]/70";
  else if (/\b(winter|snow|frost|yuletide|christmas|yule|solstice)\b/.test(normalized)) iconColor = "text-sky-300";
  else if (/\b(spring|blossom|bloom|equinox)\b/.test(normalized)) iconColor = "text-emerald-300";
  else if (/\b(summer|midsummer|sunny|heatwave)\b/.test(normalized)) iconColor = "text-yellow-300";
  else if (/\b(autumn|fall|harvest|leaf|leaves)\b/.test(normalized)) iconColor = "text-orange-400";
  else if (monthIndex === 11 || monthIndex === 0 || monthIndex === 1) iconColor = "text-sky-300";
  else if (monthIndex !== null && monthIndex >= 2 && monthIndex <= 4) iconColor = "text-emerald-300";
  else if (monthIndex !== null && monthIndex >= 5 && monthIndex <= 7) iconColor = "text-yellow-300";
  else if (monthIndex !== null && monthIndex >= 8 && monthIndex <= 10) iconColor = "text-orange-400";
  return { day, iconColor };
}

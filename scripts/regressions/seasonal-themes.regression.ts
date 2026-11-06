import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readSeasonalPreview,
  resolveSeasonalTheme,
  seasonalThemeFor,
  withSeasonalYear,
  type SeasonalYears,
} from "../../packages/client/src/lib/seasonal-themes.ts";
import { UI_PERSISTENCE } from "../../packages/client/src/lib/ui-persistence.ts";

// Seasonal themes switch on by themselves from October 30 until noon on November 1 (local time), say hello once a year, and always yield to
// the Settings toggle; only the maintainer preview can force them.

const decide = (
  date: Date,
  options: {
    disabled?: boolean;
    turnedOff?: SeasonalYears;
    greeted?: SeasonalYears;
    preview?: "halloween" | "newyearseve" | "newyearsday";
  } = {},
) =>
  resolveSeasonalTheme({
    date,
    disabled: options.disabled ?? false,
    turnedOff: options.turnedOff ?? {},
    greeted: options.greeted ?? {},
    preview: options.preview ?? null,
  });
const local = (month: number, day: number, hours: number, minutes: number, year = 2026) =>
  new Date(year, month - 1, day, hours, minutes);
const ON = { themeId: "halloween", showGreeting: true };
const OFF = { themeId: null, showGreeting: false };

// Halloween runs from Oct 30 00:00 until Nov 1 12:00 on the device's own clock, and nothing either side of it.
assert.deepEqual(decide(local(10, 29, 23, 59)), OFF, "Oct 29 23:59 is not Halloween yet");
assert.deepEqual(decide(local(10, 30, 0, 0)), ON, "Oct 30 00:00 local is Halloween");
assert.deepEqual(decide(local(10, 31, 23, 59)), ON, "Oct 31 23:59 local is still Halloween");
assert.deepEqual(decide(local(11, 1, 11, 59)), ON, "Nov 1 11:59 local is still Halloween");
assert.deepEqual(decide(local(11, 1, 12, 0)), OFF, "Nov 1 12:00 the costume has come off");
assert.deepEqual(decide(local(10, 31, 12, 0, 2031)), ON, "it comes back every year");

const eve = { themeId: "newyearseve", showGreeting: true };
const newYear = { themeId: "newyearsday", showGreeting: true };
assert.deepEqual(decide(local(12, 30, 23, 59)), OFF, "Dec 30 is outside the New Year's Eve window");
assert.deepEqual(decide(local(12, 31, 0, 0)), eve, "Dec 31 00:00 starts New Year's Eve");
assert.deepEqual(decide(local(12, 31, 23, 59)), eve, "Dec 31 23:59 is inside New Year's Eve");
assert.deepEqual(decide(local(1, 1, 0, 0, 2027)), eve, "the party goes on past midnight");
assert.deepEqual(decide(local(1, 1, 3, 59, 2027)), eve, "Jan 1 03:59 is still the party");
assert.deepEqual(decide(local(1, 1, 4, 0)), newYear, "Jan 1 04:00 switches directly to New Year's Day");
// The party's hours after midnight belong to the December it started in: no second greeting, and "Turn it off" holds.
assert.deepEqual(
  decide(local(1, 1, 1, 0, 2027), { greeted: { newyearseve: 2026 } }),
  { themeId: "newyearseve", showGreeting: false },
  "greeted on Dec 31, not again after midnight",
);
assert.deepEqual(
  decide(local(1, 1, 1, 0, 2027), { turnedOff: { newyearseve: 2026 } }),
  OFF,
  "turned off on Dec 31 stays off after midnight",
);
assert.deepEqual(decide(local(1, 1, 5, 0, 2027), { turnedOff: { newyearseve: 2026 } }), newYear, "the hangover is its own season");
assert.deepEqual(decide(local(1, 2, 11, 59)), newYear, "Jan 2 11:59 is still New Year's Day");
assert.deepEqual(decide(local(1, 2, 12, 0)), OFF, "Jan 2 at noon ends New Year's Day");

// "Local" means the device's time zone: one instant is before noon in Honolulu and already past it in UTC.
const originalTimeZone = process.env.TZ;
try {
  const instant = new Date("2026-11-01T13:00:00Z");
  process.env.TZ = "Pacific/Honolulu";
  assert.deepEqual(decide(instant), ON, "Nov 1 03:00 in Honolulu is Halloween");
  process.env.TZ = "UTC";
  assert.deepEqual(decide(instant), OFF, "Nov 1 13:00 in UTC is not");
} finally {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
}

// The Settings toggle wins over the date, and the greeting never shows while it is on.
assert.deepEqual(decide(local(10, 31, 9, 0), { disabled: true }), OFF, "Disable seasonal ME themes wins");

// "Turn it off" from the greeting only covers that year's Halloween.
const offThisYear = { turnedOff: { halloween: 2026 } };
assert.deepEqual(decide(local(10, 31, 9, 0), offThisYear), OFF, "turned off for 2026");
assert.deepEqual(decide(local(10, 31, 9, 0, 2027), offThisYear), ON, "back on, with a greeting, in 2027");

// The greeting shows once per year.
const greetedThisYear = { greeted: { halloween: 2026 } };
assert.deepEqual(
  decide(local(10, 31, 21, 0), greetedThisYear),
  { themeId: "halloween", showGreeting: false },
  "seen in 2026: the theme stays, the greeting does not return",
);
assert.deepEqual(decide(local(10, 31, 9, 0, 2027), greetedThisYear), ON, "greeted again in 2027");

// The preview forces the theme and its greeting on any date, even with the toggle on; its own "Turn it off" still
// removes it (the store keeps those preview years for that page load only; see below).
assert.deepEqual(decide(local(3, 5, 10, 0), { preview: "halloween" }), ON, "preview on a March day");
assert.deepEqual(decide(local(3, 5, 10, 0), { preview: "halloween", disabled: true }), ON, "preview beats toggle");
assert.deepEqual(decide(local(3, 5, 10, 0), { preview: "halloween", turnedOff: { halloween: 2026 } }), OFF);
assert.equal(readSeasonalPreview("?seasonalPreview=halloween"), "halloween");
assert.equal(readSeasonalPreview("?v=2.5.0&seasonalPreview=halloween"), "halloween");
assert.equal(readSeasonalPreview("?seasonalPreview=newyearseve"), "newyearseve");
assert.equal(readSeasonalPreview("?seasonalPreview=newyearsday"), "newyearsday");
assert.equal(readSeasonalPreview("?seasonalPreview=christmas"), null, "only registered themes can be previewed");
assert.equal(readSeasonalPreview(""), null);

// Year records keep the other themes' years and survive a malformed synced value.
assert.deepEqual(withSeasonalYear({ halloween: 2025 }, "halloween", 2026), { halloween: 2026 });
assert.deepEqual(withSeasonalYear("corrupt", "halloween", 2026), { halloween: 2026 });
assert.deepEqual(withSeasonalYear(["x"], "halloween", 2026), { halloween: 2026 });
assert.deepEqual(decide(local(10, 31, 9, 0), { greeted: "corrupt" as never }), ON, "a malformed record never hides it");

// The toggle and year records are General settings: saved in the browser, synced to other devices.
const stored = new Map<string, string>();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  },
});
try {
  const { useUIStore, pickPersistedUIState, pickSyncedSettings, shownMariAppearancePack } =
    await import("../../packages/client/src/stores/ui.store.ts");
  const initial = useUIStore.getInitialState();
  assert.equal(initial.seasonalThemesDisabled, false, "seasonal themes are on by default");
  assert.deepEqual(initial.seasonalGreetingYears, {});
  assert.deepEqual(initial.seasonalThemeOffYears, {});

  const store = useUIStore.getState();
  store.markSeasonalGreetingShown("halloween", 2026);
  store.turnOffSeasonalTheme("halloween", 2026);
  store.setSeasonalThemesDisabled(true);
  for (const pick of [pickPersistedUIState, pickSyncedSettings]) {
    const picked = pick(useUIStore.getState());
    assert.equal(picked.seasonalThemesDisabled, true);
    assert.deepEqual(picked.seasonalGreetingYears, { halloween: 2026 });
    assert.deepEqual(picked.seasonalThemeOffYears, { halloween: 2026 });
  }

  // Switching seasonal themes back on also undoes this year's "Turn it off"; the greeting stays seen.
  useUIStore.getState().setSeasonalThemesDisabled(false);
  assert.equal(useUIStore.getState().seasonalThemesDisabled, false);
  assert.deepEqual(useUIStore.getState().seasonalThemeOffYears, {});
  assert.deepEqual(useUIStore.getState().seasonalGreetingYears, { halloween: 2026 });

  // The browser copy is written after the store's short write delay.
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  const saved = JSON.parse(stored.get(UI_PERSISTENCE.name) ?? "{}").state;
  assert.equal(saved?.seasonalThemesDisabled, false);
  assert.deepEqual(saved?.seasonalGreetingYears, { halloween: 2026 });

  // A `?seasonalPreview=` page keeps its greeting, its "Turn it off" and Professor Mari's outfit opt-out in the store
  // for that page load only: none of it is saved or synced, so trying the preview never changes the real Halloween.
  assert.equal(initial.seasonalPreview, null, "no preview without ?seasonalPreview=");
  useUIStore.setState({
    seasonalGreetingYears: {},
    seasonalPreview: { themeId: "halloween", greeted: {}, turnedOff: {} },
  });
  // A March day of this year: the outfit opt-out is keyed by the current year.
  const thisYear = new Date().getFullYear();
  const previewDay = local(3, 5, 10, 0, thisYear);
  assert.deepEqual(seasonalThemeFor(useUIStore.getState(), previewDay), ON, "the preview wears Halloween in March");
  assert.equal(shownMariAppearancePack(useUIStore.getState(), null, previewDay).id, "raccoon", "and so does Mari");
  useUIStore.getState().markSeasonalGreetingShown("halloween", thisYear);
  assert.deepEqual(seasonalThemeFor(useUIStore.getState(), previewDay), { themeId: "halloween", showGreeting: false });
  useUIStore.getState().setMariAppearancePack("safari");
  assert.equal(shownMariAppearancePack(useUIStore.getState(), null, previewDay).id, "safari", "a pick wins in it");
  useUIStore.getState().setMariAppearancePack("raccoon");
  assert.equal(shownMariAppearancePack(useUIStore.getState(), null, previewDay).id, "raccoon");
  useUIStore.getState().setMariAppearancePack("safari");
  useUIStore.getState().turnOffSeasonalTheme("halloween", thisYear);
  assert.deepEqual(seasonalThemeFor(useUIStore.getState(), previewDay), OFF, "the preview's Turn it off");
  assert.equal(shownMariAppearancePack(useUIStore.getState(), null, previewDay).id, "safari", "takes Mari's off too");
  const previewed = useUIStore.getState();
  assert.deepEqual(previewed.seasonalGreetingYears, {}, "the real greeting record is untouched");
  assert.deepEqual(previewed.seasonalThemeOffYears, {}, "the real Turn it off record is untouched");
  assert.equal(previewed.mariSeasonOptOut, "", "the real outfit opt-out is untouched");
  assert.equal(previewed.mariAppearancePackId, "safari", "the user's own pick is still theirs");
  for (const pick of [pickPersistedUIState, pickSyncedSettings]) {
    const picked = pick(previewed);
    assert.ok(!("seasonalPreview" in picked), "the preview is never saved or synced");
    assert.ok(!("mariSeasonPreviewOptOut" in picked), "the preview's outfit opt-out is never saved or synced");
  }
  useUIStore.setState({ seasonalPreview: null });
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  const savedAfterPreview = JSON.parse(stored.get(UI_PERSISTENCE.name) ?? "{}").state;
  assert.deepEqual(savedAfterPreview?.seasonalThemeOffYears, {}, "the browser copy holds no preview record");
  assert.equal(savedAfterPreview?.mariSeasonOptOut, "", "the browser copy holds no preview outfit opt-out");
} finally {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
}

// The palette keeps body text at WCAG AA or better in both modes.
const css = readFileSync(
  new URL("../../packages/client/src/styles/themes/seasonal-halloween.css", import.meta.url),
  "utf8",
);
const paletteBlock = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} block exists`);
  return css.slice(start, css.indexOf("}", start));
};
const color = (block: string, name: string) => {
  const match = block.match(new RegExp(`--halloween-${name}:\\s*(#[0-9a-f]{6});`, "i"));
  assert.ok(match, `--halloween-${name} is a hex color`);
  return match[1];
};
const luminance = (hex: string) => {
  const [red, green, blue] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};
const contrast = (first: string, second: string) => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};
for (const [mode, block] of [
  ["dark", paletteBlock(':root[data-seasonal-theme="halloween"]')],
  ["light", paletteBlock(':root[data-seasonal-theme="halloween"][data-theme="light"]')],
] as const) {
  for (const [text, background] of [
    ["text", "bg"],
    ["text", "surface"],
    ["muted-text", "bg"],
    ["muted-text", "surface"],
    ["on-pumpkin", "pumpkin"],
    ["pumpkin", "bg"],
    ["purple-text", "purple-surface"],
  ]) {
    const ratio = contrast(color(block, text), color(block, background));
    assert.ok(ratio >= 4.5, `${mode}: ${text} on ${background} is ${ratio.toFixed(2)}:1, below WCAG AA`);
  }
}

for (const [id, prefix, textPairs] of [
  [
    "newyearseve",
    "nye",
    [
      ["text", "bg"],
      ["text", "surface"],
      ["muted", "bg"],
      ["muted", "surface"],
      ["on-gold", "gold"],
      ["magenta-text", "magenta-surface"],
    ],
  ],
  [
    "newyearsday",
    "nyd",
    [
      ["text", "bg"],
      ["text", "surface"],
      ["muted", "bg"],
      ["muted", "surface"],
      ["on-rose", "rose"],
      ["secondary-text", "secondary"],
    ],
  ],
] as const) {
  const themeCss = readFileSync(
    new URL(`../../packages/client/src/styles/themes/seasonal-${id}.css`, import.meta.url),
    "utf8",
  );
  const blockFor = (selector: string) => {
    const start = themeCss.indexOf(`${selector} {`);
    assert.ok(start >= 0, `${id}: ${selector} block exists`);
    return themeCss.slice(start, themeCss.indexOf("}", start));
  };
  const colorFor = (block: string, name: string) => {
    const match = block.match(new RegExp(`--${prefix}-${name}:\\s*(#[0-9a-f]{6});`, "i"));
    assert.ok(match, `${id}: ${name} is a hex color`);
    return match[1];
  };
  for (const [mode, block] of [
    ["dark", blockFor(`:root[data-seasonal-theme="${id}"]`)],
    ["light", blockFor(`:root[data-seasonal-theme="${id}"][data-theme="light"]`)],
  ] as const) {
    for (const [foreground, background] of textPairs) {
      const ratio = contrast(colorFor(block, foreground), colorFor(block, background));
      assert.ok(ratio >= 4.5, `${id} ${mode}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1, below WCAG AA`);
    }
    // Chrome buttons (the greeting's "Turn it off") draw their text at 64% over the panel (globals.css).
    for (const background of ["bg", "surface"]) {
      const under = colorFor(block, background);
      const over = colorFor(block, "button-text");
      const mixed = [1, 3, 5]
        .map((index) => {
          const channel = (hex: string) => Number.parseInt(hex.slice(index, index + 2), 16);
          return Math.round(channel(over) * 0.64 + channel(under) * 0.36)
            .toString(16)
            .padStart(2, "0");
        })
        .join("");
      const ratio = contrast(`#${mixed}`, under);
      assert.ok(ratio >= 4.5, `${id} ${mode}: button text at 64% on ${background} is ${ratio.toFixed(2)}:1, below WCAG AA`);
    }
  }
}

const datedPacks = (await import("../../packages/client/src/lib/mari-work-animations.ts")).MARI_APPEARANCE_PACKS;
assert.equal(datedPacks.find(({ id }) => id === "party")?.season, "newyearseve");
assert.equal(datedPacks.find(({ id }) => id === "hungover")?.season, "newyearsday");

console.info("Seasonal themes regression passed.");

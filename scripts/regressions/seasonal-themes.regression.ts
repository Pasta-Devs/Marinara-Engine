import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readSeasonalPreview,
  resolveSeasonalTheme,
  withSeasonalYear,
  type SeasonalYears,
} from "../../packages/client/src/lib/seasonal-themes.ts";
import { UI_PERSISTENCE } from "../../packages/client/src/lib/ui-persistence.ts";

// Seasonal themes switch on by themselves for one local calendar day, say hello once a year, and always yield to
// the Settings toggle; only the maintainer preview can force them.

const decide = (
  date: Date,
  options: { disabled?: boolean; turnedOff?: SeasonalYears; greeted?: SeasonalYears; preview?: "halloween" } = {},
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

// Halloween is the whole of October 31 on the device's own clock, and nothing either side of it.
assert.deepEqual(decide(local(10, 31, 0, 0)), ON, "Oct 31 00:00 local is Halloween");
assert.deepEqual(decide(local(10, 31, 23, 59)), ON, "Oct 31 23:59 local is still Halloween");
assert.deepEqual(decide(local(10, 30, 23, 59)), OFF, "Oct 30 23:59 is not Halloween yet");
assert.deepEqual(decide(local(11, 1, 0, 0)), OFF, "Nov 1 00:00 the costume has come off");
assert.deepEqual(decide(local(10, 31, 12, 0, 2031)), ON, "it comes back every year");

// "Local" means the device's time zone: one instant is Halloween in Honolulu and already November in UTC.
const originalTimeZone = process.env.TZ;
try {
  const instant = new Date("2026-11-01T05:00:00Z");
  process.env.TZ = "Pacific/Honolulu";
  assert.deepEqual(decide(instant), ON, "Oct 31 19:00 in Honolulu is Halloween");
  process.env.TZ = "UTC";
  assert.deepEqual(decide(instant), OFF, "Nov 1 05:00 in UTC is not");
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
// removes it (the hook keeps those preview years in memory only).
assert.deepEqual(decide(local(3, 5, 10, 0), { preview: "halloween" }), ON, "preview on a March day");
assert.deepEqual(decide(local(3, 5, 10, 0), { preview: "halloween", disabled: true }), ON, "preview beats toggle");
assert.deepEqual(decide(local(3, 5, 10, 0), { preview: "halloween", turnedOff: { halloween: 2026 } }), OFF);
assert.equal(readSeasonalPreview("?seasonalPreview=halloween"), "halloween");
assert.equal(readSeasonalPreview("?v=2.5.0&seasonalPreview=halloween"), "halloween");
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
  const { useUIStore, pickPersistedUIState, pickSyncedSettings } =
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

console.info("Seasonal themes regression passed.");

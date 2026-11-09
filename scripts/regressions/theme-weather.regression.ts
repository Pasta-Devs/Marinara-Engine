// Theme weather tokens (Nov 2026): a theme restyles the in-chat weather, but only through checked values.
import assert from "node:assert/strict";
import { readThemeWeatherTokens, parseWeatherColor } from "../../packages/client/src/lib/theme-weather.js";
import {
  createWeatherBolt,
  drawWeatherBolt,
  drawWeatherLightning,
  drawWeatherParticle,
  drawWeatherCelestial,
  createWeatherParticle,
  resolveWeatherRenderConfig,
  STOCK_WEATHER_LOOK,
  weatherPopulation,
  WEATHER_CATEGORIES,
  type WeatherLook,
} from "../../packages/client/src/lib/weather-renderer.js";

// A browser-like colour normaliser: canvas fillStyle turns valid colours into #rrggbb and ignores the rest.
const named: Record<string, string> = { white: "#ffffff", hotpink: "#ff69b4" };
Object.assign(globalThis, {
  CSS: {
    supports: (_p: string, value: string) => /^(#[0-9a-f]{3,8}|rgb\(|[a-z]+$)/i.test(value) && !/^url/i.test(value),
  },
  document: {
    createElement: () => ({
      getContext: () => {
        let fill = "#000000";
        return {
          get fillStyle() {
            return fill;
          },
          set fillStyle(value: string) {
            if (/^#[0-9a-f]{6}$/i.test(value)) fill = value.toLowerCase();
            else if (named[value]) fill = named[value]!;
            else if (/^rgb\(/i.test(value)) fill = value.replace(/^rgb\(([^)]*)\)$/i, "rgba($1, 1)");
          },
        };
      },
    }),
  },
});

const style = (values: Record<string, string>) => ({
  getPropertyValue: (name: string) => values[name] ?? "",
});

// No tokens: stock weather.
assert.equal(readThemeWeatherTokens(style({})), null);

// Colours: plain colours only.
assert.equal(parseWeatherColor("#ffaacd"), "255,170,205");
assert.equal(parseWeatherColor("hotpink"), "255,105,180");
assert.equal(parseWeatherColor("rgb(10, 20, 30)"), "10,20,30");
for (const bad of [
  'url("https://evil.example/x.png")',
  "url(blob:x)",
  "var(--x)",
  "expression(alert(1))",
  "linear-gradient(red, blue)",
  "red; background: url(x)",
  "transparent",
  "inherit",
  "#ff0000".padEnd(80, " ") + "x",
]) {
  assert.equal(parseWeatherColor(bad), null, `refuses ${bad}`);
}

// Numbers are clamped; words come from a fixed list; anything else is ignored.
const tokens = readThemeWeatherTokens(
  style({
    "--mari-weather-style": "pixel",
    "--mari-weather-pixel-size": "40px",
    "--mari-weather-amount": "9",
    "--mari-weather-speed": "0.01",
    "--mari-weather-strength": "calc(100)",
    "--mari-weather-tint-strength": "0.4",
    "--mari-weather-moon": "none",
    "--mari-weather-sun": "hidden",
    "--mari-weather-snow-color": "#fff0f7",
    "--mari-weather-snow-size": "99",
    "--mari-weather-snow-shape": "triangle",
    "--mari-weather-rain-color": 'url("https://evil.example/")',
    "--mari-weather-petal-image":
      'url("https://evil.example/p.png") url("blob:http://localhost/not-registered") url("data:image/png;base64,AAAA")',
    "--mari-weather-lightning-color": "white",
  }),
);
assert.ok(tokens);
assert.equal(tokens.pixel, 6, "pixel size capped at 6");
assert.equal(tokens.amount, 1, "a theme can thin the weather out, never add more");
assert.equal(tokens.speed, 0.5);
assert.equal(tokens.strength, 1, "non-numbers are ignored");
assert.equal(tokens.tint, 0.4);
assert.equal(tokens.moon, false);
assert.equal(tokens.sun, true, "only `none` hides the sun");
assert.deepEqual(tokens.kinds.snow, { color: "255,240,247", size: 3 });
assert.equal(tokens.kinds.rain, undefined, "a url() is not a colour");
assert.equal(tokens.kinds.petal, undefined, "only the theme's own registered pictures are used");
assert.equal(tokens.lightning, "255,255,255");

// Style must be the exact word.
assert.equal(readThemeWeatherTokens(style({ "--mari-weather-style": "pixel; x" })), null);

// Renderer: a theme look never raises the flash past the app's cap, and the amount only thins.
const calls: Array<[string, unknown]> = [];
const context = new Proxy({} as Record<string, unknown>, {
  get(target, key: string) {
    if (key in target) return target[key];
    return (...args: unknown[]) => {
      calls.push([key, args]);
      if (key.startsWith("create")) return { addColorStop() {} };
    };
  },
  set(target, key: string, value) {
    target[key] = value;
    return true;
  },
}) as unknown as CanvasRenderingContext2D;
const look: WeatherLook = {
  ...STOCK_WEATHER_LOOK,
  pixel: 3,
  amount: 0.5,
  strength: 1.5,
  moon: false,
  lightning: "201,162,255",
  kinds: { snow: { color: "255,240,247" }, rain: { color: "63,240,255" } },
};
drawWeatherLightning(context, look, 0.9, 100, 100);
assert.equal((context as unknown as { fillStyle: string }).fillStyle, "rgba(201,162,255,0.6)");

// Lightning bolts (2026-11-09): opt-in, sized 0.5-3, struck down a side of the screen, only during a flash.
assert.equal(readThemeWeatherTokens(style({ "--mari-weather-lightning-bolt": "on" }))?.bolt, 1);
assert.equal(readThemeWeatherTokens(style({ "--mari-weather-lightning-bolt": "9" }))?.bolt, 3);
assert.equal(readThemeWeatherTokens(style({ "--mari-weather-lightning-bolt": "none" })), null);
for (let seed = 0; seed < 50; seed += 1) {
  let n = seed + 1;
  const random = () => (n = (n * 16807) % 2147483647) / 2147483647;
  const bolt = createWeatherBolt(1000, 800, random);
  const x = bolt.trunk[0]![0];
  assert.ok((x >= 80 && x <= 280) || (x >= 720 && x <= 920), `bolt starts at a side, not over the text (${x})`);
  assert.ok(
    bolt.forks.length >= 2 && bolt.forks.length <= 8,
    `2-4 forks, each with at most one twig (${bolt.forks.length})`,
  );
  const bottom = bolt.trunk[bolt.trunk.length - 1]![1];
  assert.ok(bottom >= 800 * 0.4, `the bolt reaches well down the screen (${bottom})`);
}
calls.length = 0;
drawWeatherBolt(context, createWeatherBolt(100, 100), { ...look, bolt: 0 }, 0.5);
assert.equal(calls.length, 0, "no bolt unless the theme turns it on");
drawWeatherBolt(context, createWeatherBolt(100, 100), { ...look, bolt: 1 }, 0);
assert.equal(calls.length, 0, "no bolt without a flash");
drawWeatherBolt(context, createWeatherBolt(100, 100), { ...look, bolt: 1 }, 0.5);
assert.ok(calls.length > 0, "the bolt draws during a flash");

const storm = resolveWeatherRenderConfig("heavy snow storm", "midnight");
const stock = weatherPopulation(storm);
const thinned = weatherPopulation(storm, look);
assert.ok(thinned.every(([type, count], index) => count <= stock[index]![1] && type === stock[index]![0]));
assert.ok(weatherPopulation(storm, { ...look, amount: 1, flat: true }).every(([, c], i) => c < stock[i]![1]));

for (const type of [
  "rain",
  "snow",
  "hail",
  "fog",
  "dust",
  "leaf",
  "petal",
  "ember",
  "ash",
  "sand",
  "firefly",
  "star",
  "aurora",
] as const) {
  for (const l of [
    STOCK_WEATHER_LOOK,
    look,
    { ...look, pixel: 1, kinds: { [type]: { shape: "square", color: "1,2,3" } } },
  ]) {
    const particle = createWeatherParticle(type, 400, 300, false, l);
    particle.life = 100;
    drawWeatherParticle(context, particle, l);
  }
}

// The moon can be switched off by a theme whose art already has one.
calls.length = 0;
drawWeatherCelestial(context, resolveWeatherRenderConfig("clear", "midnight"), look, 400, 300, 0);
assert.equal(calls.length, 0, "no moon drawn with --mari-weather-moon: none");
drawWeatherCelestial(context, resolveWeatherRenderConfig("clear", "midnight"), STOCK_WEATHER_LOOK, 400, 300, 0);
assert.ok(calls.length > 0, "stock moon still drawn");

// Weather words for data-mari-weather come from the fixed list, never the story's text.
const cases: Array<[string, string, string]> = [
  ["light rain", "14:00", "rain"],
  ["thunderstorm", "night", "storm"],
  ["heavy snow", "dawn", "snow"],
  ["thick fog <img src=x onerror=alert(1)>", "dusk", "fog"],
  ["overcast", "noon", "cloudy"],
  ["sunny", "afternoon", "clear"],
  ["cherry blossoms", "morning", "blossom"],
  ["something nobody wrote a rule for", "", "clear"],
];
for (const [weather, time, category] of cases) {
  const config = resolveWeatherRenderConfig(weather, time);
  assert.equal(config.category, category, weather);
  assert.ok((WEATHER_CATEGORIES as readonly string[]).includes(config.category));
}
assert.equal(resolveWeatherRenderConfig(null, null).category, "");
assert.equal(resolveWeatherRenderConfig("rain", "midnight").period, "night");
assert.equal(resolveWeatherRenderConfig("rain", "sunset").period, "dusk");
assert.equal(resolveWeatherRenderConfig("rain", "dawn").period, "dawn");
assert.equal(resolveWeatherRenderConfig("rain", "noon").period, "day");

console.log("theme weather: ok");

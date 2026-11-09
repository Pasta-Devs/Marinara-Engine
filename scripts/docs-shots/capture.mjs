// Screenshots for the in-app Docs, taken from the NEW layout with example data (seed.mjs).
//   1. DATA_DIR=<empty folder> PORT=7861 pnpm start      (a production build)
//   2. node scripts/docs-shots/seed.mjs http://localhost:7861 <demo-assets folder>
//   3. node scripts/docs-shots/capture.mjs [shot names…]
// Writes packages/client/public/docs-shots/<name>.webp and the list the Docs page reads
// (packages/client/src/components/overhaul/docs-shots.json). Each shot names a guide and a heading;
// the picture shows after the first paragraph or list under that heading.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const BASE = process.env.SHOTS_URL ?? "http://localhost:7861/";
const out = resolve(root, "packages/client/public/docs-shots");
const manifestFile = resolve(root, "packages/client/src/components/overhaul/docs-shots.json");
const sharp = createRequire(resolve(root, "packages/server/package.json"))("sharp");
const only = process.argv.slice(2);

const chat = (name) => [
  { click: `[data-component="ChatSidebar"] :text-is("${name}"), :text-is("${name}")` },
  { wait: 1500 },
];
const modeTab = (mode) => [{ click: `button:has-text("${mode}")` }];
/** The middle of the window, between the chat list and the Library pane: Library pages and editors. */
const CENTER = { x: 320, y: 44, width: 800, height: 620 };
const library = (section) => [
  { click: 'button:has-text("Library")' },
  { click: `:text-is("${section}")` },
  { wait: 1200 },
];

/** name, guide, heading, alt, steps, and what to capture: the window, a selector, or a clip. */
const SHOTS = [
  {
    name: "home-screen",
    guide: "home/welcome.md",
    heading: "The Home screen at a glance",
    alt: "The Home screen in the new layout: chats on the left, recent chats and widgets in the middle, the Library on the right.",
    steps: [{ click: 'button:has-text("Library")' }],
  },
  {
    name: "roleplay-chat",
    guide: "roleplay/getting-started.md",
    heading: "",
    alt: "A Roleplay chat with Detective Rook on a rainy street background.",
    steps: [...modeTab("Roleplay"), ...chat("The clock tower case")],
  },
  {
    name: "conversation-chat",
    guide: "conversation/getting-started.md",
    heading: "",
    alt: "A Conversation chat with Juniper Hale, laid out like a messenger.",
    steps: [...modeTab("Convo"), ...chat("Juniper's cafe")],
  },
  {
    name: "game-chat",
    guide: "game/getting-started.md",
    heading: "",
    alt: "A Game Mode chat in the Ember Reach, with Kestrel as the game master.",
    steps: [...modeTab("Game"), ...chat("The Ember Reach"), { wait: 1500 }],
  },
  {
    name: "chat-settings",
    guide: "chats/chat-settings.md",
    heading: "Opening Chat Settings",
    alt: "Chat Settings open beside a Roleplay chat, from the Chat settings button in the top bar.",
    steps: [
      ...modeTab("Roleplay"),
      ...chat("The clock tower case"),
      { click: 'button:has-text("Chat settings")' },
      { wait: 1200 },
    ],
    clip: { x: 984, y: 44, width: 456, height: 760 },
  },
  {
    name: "selfie-settings",
    guide: "conversation/selfies.md",
    heading: "Selfie settings",
    alt: "Illustrator Settings in a Conversation chat's Chat Settings, with Generated Selfies on and the selfie settings below it.",
    steps: [
      ...modeTab("Convo"),
      ...chat("Juniper's cafe"),
      { click: 'button:has-text("Chat settings")' },
      { wait: 1200 },
      { click: 'button:has-text("Got it")', optional: true },
      { click: "text=Illustrator Settings", unless: 'label:text-is("Generated Selfies")' },
      { click: 'label:text-is("Generated Selfies")', unless: ':text-is("Selfie model")' },
      { wait: 1200 },
      { scroll: "text=Illustrator Settings" },
    ],
    clip: { x: 984, y: 44, width: 456, height: 620 },
  },
  {
    name: "chat-list",
    guide: "chats/managing-chats.md",
    heading: "The chat list and mode tabs",
    alt: "The chat list with the Convo, Roleplay and Game tabs, search, sort and filter.",
    steps: [...modeTab("Roleplay")],
    clip: { x: 0, y: 44, width: 320, height: 420 },
  },
  {
    name: "characters-page",
    guide: "characters/library-organization.md",
    heading: "",
    alt: "The Characters page in the Library, showing the characters as a gallery.",
    steps: [...library("Characters")],
    clip: CENTER,
  },
  {
    name: "character-editor",
    guide: "characters/creating-and-editing-characters.md",
    heading: "The Character Editor at a glance",
    alt: "The Character Editor for Detective Rook: portrait and sections on the left, the card's fields on the right.",
    steps: [...library("Characters"), { click: ':text-is("Detective Rook")' }, { wait: 1500 }],
    clip: CENTER,
  },
  {
    name: "personas-page",
    guide: "characters/personas.md",
    heading: "The Personas page",
    alt: "The Personas page in the Library.",
    steps: [...library("Personas")],
    clip: CENTER,
  },
  {
    name: "persona-editor",
    guide: "characters/personas.md",
    heading: "The Persona Editor",
    alt: "The Persona Editor for the persona Nova.",
    steps: [...library("Personas"), { click: ':text-is("Nova")' }, { wait: 1500 }],
    clip: CENTER,
  },
  {
    name: "lorebooks-page",
    guide: "lorebooks/overview.md",
    heading: "The Lorebooks page",
    alt: "The Lorebooks page in the Library.",
    steps: [...library("Lorebooks")],
    clip: CENTER,
  },
  {
    name: "lorebook-entries",
    guide: "lorebooks/entries.md",
    heading: "The Entries tab",
    alt: "The Saltmere Harbor lorebook open on its entries.",
    steps: [...library("Lorebooks"), { click: ':text-is("Saltmere Harbor")' }, { wait: 1500 }],
    clip: CENTER,
  },
  {
    name: "preset-editor",
    guide: "prompts/presets.md",
    heading: "The Preset Editor's tabs",
    alt: "The Preset Editor with the prompt sections in order.",
    steps: [...library("Presets"), { click: ':text("Marinara\'s Universal")' }, { wait: 1500 }],
    clip: CENTER,
  },
  {
    name: "regex-page",
    guide: "extending/regex-scripts.md",
    heading: "Create a regex script",
    alt: "The Regex scripts page in the Library.",
    steps: [...library("Regex scripts")],
    clip: CENTER,
  },
  {
    name: "connections-page",
    guide: "connections/connecting-to-a-provider.md",
    heading: "The Connections page",
    alt: "The Connections page: your accounts and models, and the model picked for each job.",
    steps: [...library("Connections")],
    clip: CENTER,
  },
  {
    name: "settings",
    guide: "settings/settings-overview.md",
    heading: "Opening Settings",
    alt: "Settings open on the General tab, with the other tabs along the side.",
    steps: [...library("Settings")],
    clip: CENTER,
  },
  {
    name: "appearance-settings",
    guide: "appearance/appearance-settings.md",
    heading: "Opening the Appearance settings",
    alt: "The Appearance tab in Settings.",
    steps: [...library("Settings"), { click: 'button:has-text("Appearance")' }, { wait: 1000 }],
    clip: CENTER,
  },
];

const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const shot of SHOTS) {
  if (only.length && !only.includes(shot.name)) continue;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    screen: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "marinara-walkthroughs-seen",
      JSON.stringify({
        devices: ["desktop", "tablet", "phone"],
        modes: ["desktop:conversation", "desktop:roleplay", "desktop:game"],
      }),
    );
    localStorage.setItem(
      "marinara-overhaul-layout",
      JSON.stringify({ state: { enabled: true, tabs: [], docsTabs: {} }, version: 3 }),
    );
  });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(3500);
  await page.addStyleTag({
    content: "[data-sonner-toaster]{display:none!important} *{caret-color:transparent!important}",
  });
  try {
    // A fresh data folder starts the first-run tutorial; skip it before anything else.
    const skip = page.locator('button:has-text("Skip Tutorial")');
    if (await skip.count()) {
      await skip.first().click();
      await page.waitForTimeout(500);
    }
    for (const step of shot.steps) {
      if (step.click) {
        const target = page.locator(step.click).first();
        if (step.optional && !(await target.count())) continue;
        if (step.unless && (await page.locator(step.unless).first().isVisible())) continue;
        await target.click({ timeout: 8000 });
      }
      if (step.scroll) {
        await page
          .locator(step.scroll)
          .first()
          .evaluate((el) => el.scrollIntoView({ block: "start" }));
      }
      await page.waitForTimeout(step.wait ?? 500);
    }
    // One-time hints ("Got it") and the first-run tutorial.
    for (const hint of ['button:has-text("Got it")', 'button:has-text("Skip Tutorial")']) {
      const button = page.locator(hint);
      if (await button.count())
        await button
          .first()
          .click()
          .catch(() => {});
    }
    await page.mouse.move(1, 899);
    await page.waitForTimeout(800);
    const png = shot.selector
      ? await page.locator(shot.selector).first().screenshot()
      : await page.screenshot(shot.clip ? { clip: shot.clip } : {});
    const meta = await sharp(png).metadata();
    const width = Math.round(meta.width / 2);
    const height = Math.round(meta.height / 2);
    await sharp(png)
      .resize({ width: Math.min(meta.width, 2000), withoutEnlargement: true })
      .webp({ quality: 80, effort: 5 })
      .toFile(resolve(out, `${shot.name}.webp`));
    const entry = {
      name: shot.name,
      guide: shot.guide,
      heading: shot.heading,
      alt: shot.alt,
      width: width * 2,
      height: height * 2,
    };
    manifest.shots = [...manifest.shots.filter((s) => s.name !== shot.name), entry];
    console.log("captured", shot.name);
  } catch (error) {
    console.warn("FAILED", shot.name, error.message.split("\n")[0]);
    await page.screenshot({ path: resolve(tmpdir(), `${shot.name}.failed.png`) }).catch(() => {});
  }
  await context.close();
}
await browser.close();
manifest.shots.sort((a, b) => SHOTS.findIndex((s) => s.name === a.name) - SHOTS.findIndex((s) => s.name === b.name));
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

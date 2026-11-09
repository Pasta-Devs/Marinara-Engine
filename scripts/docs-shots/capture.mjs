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

/** Editors with the Library pane closed, for the ones that need the room. */
const WIDE = { x: 320, y: 44, width: 1120, height: 620 };
const closeLibrary = [{ click: 'button:has-text("Library")' }, { wait: 800 }];

/** The Chat Settings window, scrolled to one section. */
const DRAWER = { x: 984, y: 44, width: 456, height: 620 };
const chatSettings = (mode, chatName, section) => [
  ...modeTab(mode),
  ...chat(chatName),
  { click: 'button:has-text("Chat settings")' },
  { wait: 1200 },
  { click: 'button:has-text("Got it")', optional: true },
  ...(section ? [{ scroll: `.mari-drawer__header:has-text("${section}"), :text-is("${section}")` }] : []),
];
const settingsTab = (tab) => [
  ...library("Settings"),
  { click: `.ov-settings button:text-is("${tab}")` },
  { wait: 1000 },
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
  {
    name: "add-account",
    guide: "connections/connecting-to-a-provider.md",
    heading: "Adding an account",
    alt: "Add connection opened on the Connections page, with the kinds of service to pick from.",
    steps: [...library("Connections"), { click: 'button:has-text("Add connection")' }, { wait: 1000 }],
  },
  {
    name: "agents-page",
    guide: "agents/agents-overview.md",
    heading: "Install and update agents",
    alt: "The Agents page in the Library, with installed agents and the Agent Organizer.",
    steps: [...library("Agents"), { wait: 1500 }],
    clip: CENTER,
  },
  {
    name: "characters-import",
    guide: "characters/import-export.md",
    heading: "",
    alt: "The Import button on the Characters page.",
    steps: [
      ...library("Characters"),
      { click: '.ov-gallery__head button:has-text("Import"), button:has-text("Import")' },
      { wait: 1000 },
    ],
  },
  {
    name: "lorebook-settings",
    guide: "lorebooks/overview.md",
    heading: "The Overview tab settings",
    alt: "Book settings for the Saltmere Harbor lorebook.",
    steps: [
      ...library("Lorebooks"),
      { click: ':text-is("Saltmere Harbor")' },
      { wait: 1200 },
      { click: 'button:has-text("Book settings")' },
      { wait: 1000 },
      ...closeLibrary,
    ],
    clip: WIDE,
  },
  {
    name: "lorebook-keyword-test",
    guide: "lorebooks/entries.md",
    heading: "The Keyword test tool",
    alt: "The Keyword test tool in the lorebook editor.",
    steps: [
      ...library("Lorebooks"),
      { click: ':text-is("Saltmere Harbor")' },
      { wait: 1200 },
      { click: 'button:has-text("Keyword test")' },
      { wait: 1000 },
    ],
    clip: CENTER,
  },
  {
    name: "preset-variables",
    guide: "prompts/preset-variables.md",
    heading: "Adding a preset variable",
    alt: "The Variables tab of the Preset Editor.",
    steps: [
      ...library("Presets"),
      { click: ':text("Marinara\'s Universal")' },
      { wait: 1500 },
      { click: 'button:text-is("Variables")' },
      { wait: 1000 },
      ...closeLibrary,
    ],
    clip: WIDE,
  },
  {
    name: "preset-parameters",
    guide: "prompts/generation-parameters.md",
    heading: "Each parameter in plain language",
    alt: "The Parameters tab of the Preset Editor.",
    steps: [
      ...library("Presets"),
      { click: ':text("Marinara\'s Universal")' },
      { wait: 1500 },
      { click: 'button:text-is("Parameters")' },
      { wait: 1000 },
      ...closeLibrary,
    ],
    clip: WIDE,
  },
  {
    name: "chat-settings-persona",
    guide: "characters/choosing-your-persona.md",
    heading: "From Chat Settings",
    alt: "The Persona section of Chat Settings.",
    steps: chatSettings("Roleplay", "The clock tower case", "Persona"),
    clip: DRAWER,
  },
  {
    name: "chat-settings-lorebooks",
    guide: "lorebooks/linking-to-characters.md",
    heading: "The Chat Settings Lorebooks section",
    alt: "The Lorebooks section of Chat Settings.",
    steps: chatSettings("Roleplay", "The clock tower case", "Lorebooks"),
    clip: DRAWER,
  },
  {
    name: "chat-branches",
    guide: "chats/branches.md",
    heading: "The Chat Branches section",
    alt: "The Chat Branches section of Chat Settings.",
    steps: chatSettings("Roleplay", "The clock tower case", "Chat Branches"),
    clip: DRAWER,
  },
  {
    name: "memory-recall",
    guide: "agents/memory.md",
    heading: "Turning Memory Recall on",
    alt: "The Memory Recall section of Chat Settings.",
    steps: chatSettings("Roleplay", "The clock tower case", "Memory Recall"),
    clip: DRAWER,
  },
  {
    name: "translation-settings",
    guide: "integrations/message-translation.md",
    heading: "Where to find translation settings",
    alt: "The Translation section of Chat Settings.",
    steps: chatSettings("Roleplay", "The clock tower case", "Translation"),
    clipFrom: '.mari-drawer__header:has-text("Translation"), :text-is("Translation")',
    clipHeight: 300,
  },
  {
    name: "group-chat",
    guide: "chats/group-chats.md",
    heading: "",
    alt: "A group Conversation with Mira Voss and Dr. Vale Okonkwo.",
    steps: [...modeTab("Convo"), ...chat("Deck 4 crew")],
  },
  {
    name: "message-toolbar",
    guide: "chats/messages.md",
    heading: "The message toolbar",
    alt: "The buttons on a message in a Roleplay chat.",
    steps: [...modeTab("Roleplay"), ...chat("The clock tower case"), { hover: ':text("Rook frowns, jaw tight")' }],
    clip: { x: 400, y: 550, width: 940, height: 160 },
  },
  {
    name: "slash-menu",
    guide: "chats/slash-commands.md",
    heading: "How slash commands work",
    alt: "Typing / in the message box opens the list of slash commands.",
    steps: [...modeTab("Convo"), ...chat("Juniper's cafe"), { click: "textarea" }, { type: "/" }, { wait: 800 }],
    clip: { x: 320, y: 400, width: 1120, height: 500 },
  },
  {
    name: "presence-status",
    guide: "conversation/getting-started.md",
    heading: "Your presence status",
    alt: "The presence status menu at the bottom of the chat list.",
    steps: [...modeTab("Convo"), { click: '[aria-label="Change activity status"]' }, { wait: 600 }],
    clip: { x: 0, y: 560, width: 320, height: 340 },
  },
  {
    name: "schedule-manager",
    guide: "conversation/schedules.md",
    heading: "Turn on schedules",
    alt: "The Character Schedule Manager.",
    steps: [...modeTab("Convo"), { click: '[aria-label="Character Schedule Manager"]' }, { wait: 1500 }],
  },
  {
    name: "professor-mari",
    guide: "home/professor-mari.md",
    heading: "Where to find her",
    alt: "Professor Mari's window, opened from the Home page.",
    steps: [{ click: 'button:has-text("Ask Professor Mari")' }, { wait: 1500 }],
  },
  {
    name: "backup",
    guide: "data/backup-and-restore.md",
    heading: "Download Backup",
    alt: "The Data tab in Settings, with Download Backup.",
    steps: settingsTab("Data"),
    clip: CENTER,
  },
  {
    name: "fonts",
    guide: "appearance/fonts.md",
    heading: "Choosing an app font",
    alt: "Fonts & Text Size in Settings, Appearance.",
    steps: [...settingsTab("Appearance"), { click: 'button:text-is("Fonts & Text Size")' }, { wait: 800 }],
    clip: CENTER,
  },
  {
    name: "starter-themes",
    guide: "appearance/custom-css-themes.md",
    heading: "Starter themes",
    alt: "CSS Themes in Settings, Appearance, with the starter themes.",
    steps: [...settingsTab("Appearance"), { click: 'button:text-is("CSS Themes")' }, { wait: 1000 }],
    clip: CENTER,
  },
  {
    name: "custom-tool-editor",
    guide: "extending/custom-tools.md",
    heading: "Creating a tool",
    alt: "A new custom tool open in the editor: name, description, parameters and what it does when called.",
    steps: [...library("Custom tools"), { click: 'button:has-text("New tool")' }, { wait: 1200 }, ...closeLibrary],
    clip: WIDE,
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
      if (step.hover) await page.locator(step.hover).first().hover();
      if (step.type) await page.keyboard.type(step.type);
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
    // Park the mouse out of the way, unless the shot is of something that shows on hover.
    if (!shot.steps.some((step) => step.hover)) await page.mouse.move(1, 899);
    await page.waitForTimeout(800);
    let clip = shot.clip;
    if (shot.clipFrom) {
      const box = await page.locator(shot.clipFrom).first().boundingBox();
      const y = Math.max(DRAWER.y, Math.round(box.y) - 8);
      clip = { x: DRAWER.x, y, width: DRAWER.width, height: Math.min(shot.clipHeight, 900 - y) };
    }
    const png = shot.selector
      ? await page.locator(shot.selector).first().screenshot()
      : await page.screenshot(clip ? { clip } : {});
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

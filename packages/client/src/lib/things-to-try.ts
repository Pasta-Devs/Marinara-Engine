/**
 * "Things to try": small tasks that together touch every feature, in trails where each step uses
 * what the step before it made (a gallery picture becomes a sticker, the sticker gets sent in a chat).
 * Home's Things to try widget shows the next three; See all lists them by trail.
 *
 * Part "engine" trails cover features upstream staging also has; part "kolacheee" trails cover
 * ui/kolacheee-only features. A kolacheee task may build on an engine task, never the reverse, so
 * the engine part ports to staging on its own.
 *
 * `done` says how a task ticks itself:
 *   - "data": the server sees it in saved data (GET /api/discovery/progress).
 *   - "app": this app sees it (a setting, open tabs, a split); once seen it stays ticked here.
 *   - "hand": nothing saved shows it (it lives in a chat's messages, say), so the person ticks it.
 */
import { DISCOVERY_TRAILS, type DiscoveryTrailId } from "@marinara-engine/shared";
import type { FeatureStep } from "./feature-finder";

export type ThingsToTryDetection = "data" | "app" | "hand";

export interface ThingsToTryTask {
  id: string;
  trail: DiscoveryTrailId;
  /** English text; the translated one is `thingsToTry.task.<id>`. */
  title: string;
  /** Tasks that must be done first. Each inner list is "any one of these". */
  after: readonly (readonly string[])[];
  done: ThingsToTryDetection;
  /** Its guide, relative to the docs folder. */
  guide: string;
  /** What Show me does. Without one, Show me opens the guide. */
  show?: FeatureStep;
}

type Row = [id: string, title: string, after: string, done: ThingsToTryDetection, guide: string, show?: FeatureStep];

const lib = (panel: "characters" | "personas" | "lorebooks" | "presets" | "connections" | "agents"): FeatureStep => ({
  kind: "target",
  target: { kind: "panel", panel },
});
const surface = (
  name: "card-downloads" | "character-library" | "persona-library" | "lorebook-library" | "agent-catalog" | "schedules",
): FeatureStep => ({ kind: "target", target: { kind: "surface", surface: name } });
const settings = (
  tab: "general" | "appearance" | "generations" | "addons" | "import" | "advanced",
  sectionId?: "chat-backgrounds" | "app-style" | "theme-library" | "image-generation" | "backup-export",
): FeatureStep => ({ kind: "target", target: { kind: "settings", tab, sectionId } });
const start = (mode: "conversation" | "roleplay"): FeatureStep => ({ kind: "start-chat", mode });
const peek: FeatureStep = { kind: "chat-tool", tool: "peek-prompt" };
const recall: FeatureStep = { kind: "chat-tool", tool: "memory-recall" };
const mari: FeatureStep = { kind: "target", target: { kind: "professor" } };

/** "C2/C3, P7" = (C2 or C3) and P7. */
function parseAfter(value: string): string[][] {
  return value
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => group.split("/").map((id) => id.trim()));
}

const TRAIL_ROWS: Record<DiscoveryTrailId, Row[]> = {
  core: [
    ["C1", "Connect an AI provider", "", "data", "connections/connecting-to-a-provider.md", lib("connections")],
    [
      "C2",
      "Start a Conversation chat, texting like a DM",
      "C1",
      "data",
      "conversation/getting-started.md",
      start("conversation"),
    ],
    [
      "C3",
      "Start a Roleplay chat, a long scene with narration",
      "C1",
      "data",
      "roleplay/getting-started.md",
      start("roleplay"),
    ],
    ["C4", "Start a Game, where a game master runs the world", "C1", "data", "game/getting-started.md"],
    ["C5", "Swipe to another version of a reply", "C2/C3", "hand", "chats/messages.md"],
    ["C6", "Edit a message, yours or the AI's", "C2/C3", "hand", "chats/messages.md"],
    ["C7", "Ask Professor Mari a question", "", "data", "home/professor-mari.md", mari],
    [
      "C8",
      "Find something with search (Ctrl+K, or tap the title on a phone)",
      "",
      "app",
      "settings/settings-overview.md",
    ],
    ["C9", "Turn a setting on straight from search", "C8", "app", "settings/settings-overview.md"],
    ["C10", "Rearrange Home: add Character of the Day or the Discovery desk", "", "app", "home/welcome.md"],
    ["C11", "Rearrange Chat Settings and save it as your favorite layout", "C3", "app", "chats/chat-settings.md"],
  ],
  characters: [
    [
      "P1",
      "Create a character, by hand or with Professor Mari",
      "",
      "data",
      "characters/creating-and-editing-characters.md",
      surface("character-library"),
    ],
    [
      "P2",
      "Find and import a character in the Card Browser",
      "",
      "data",
      "characters/bot-browser.md",
      surface("card-downloads"),
    ],
    [
      "P3",
      "Make a persona and pick it in a chat",
      "C2/C3",
      "data",
      "characters/personas.md",
      surface("persona-library"),
    ],
    ["P4", "Play as one of your characters", "P1, P3", "data", "characters/choosing-your-persona.md"],
    [
      "P5",
      "Give a character colors and Roleplay stats",
      "P1",
      "data",
      "characters/colors-and-stats.md",
      surface("character-library"),
    ],
    [
      "P6",
      "Put characters in a folder",
      "P1",
      "data",
      "characters/library-organization.md",
      surface("character-library"),
    ],
    ["P7", "Use that folder as a group chat roster", "P6", "data", "chats/group-chats.md"],
    [
      "P8",
      "Restore an older version of a character from its version history",
      "P1",
      "data",
      "characters/creating-and-editing-characters.md",
    ],
    [
      "P9",
      "Play a card with Interactive Onboarding and answer its questions",
      "P2",
      "hand",
      "characters/interactive-onboarding.md",
    ],
  ],
  gallery: [
    [
      "G1",
      "Upload pictures to a character's Gallery",
      "P1",
      "data",
      "characters/galleries.md",
      surface("character-library"),
    ],
    ["G2", "Set up an image service", "C1", "data", "media/image-providers.md", lib("connections")],
    ["G3", "Create a character sheet with AI in the Gallery", "G1, G2", "data", "characters/galleries.md"],
    ["G4", "Generate sprites with the character sheet as the reference", "G3", "data", "characters/sprites.md"],
    ["G5", "Clean up sprite backgrounds", "G4", "hand", "characters/sprites.md"],
    ["G6", "Describe gallery pictures with AI", "G1", "data", "characters/galleries.md"],
    ["G7", "Show a gallery picture inside a message or a greeting", "G1", "hand", "characters/galleries.md"],
    ["G8", "Make a short video from a gallery picture", "G1", "hand", "media/scene-video.md"],
    ["G9", "Make animated expressions from sprites", "G4", "hand", "media/animated-expressions.md"],
  ],
  conversation: [
    [
      "V1",
      "Write your About Me and a display name",
      "C2",
      "data",
      "conversation/profiles.md",
      surface("persona-library"),
    ],
    [
      "V2",
      "Make a sticker sheet with AI (Gallery, Create with AI)",
      "G2, P1",
      "data",
      "conversation/emoji-stickers-gifs.md",
    ],
    ["V3", "Label a gallery picture as a sticker", "G1", "data", "conversation/emoji-stickers-gifs.md"],
    ["V4", "Label a gallery picture as a custom emoji", "G1", "data", "conversation/emoji-stickers-gifs.md"],
    [
      "V5",
      "Send a sticker or :emoji: in a Conversation chat",
      "V2/V3/V4, C2",
      "hand",
      "conversation/emoji-stickers-gifs.md",
    ],
    ["V6", "Let the character answer with its own stickers", "V5, G6", "hand", "conversation/emoji-stickers-gifs.md"],
    ["V7", "Search and send a GIF", "C2", "hand", "conversation/emoji-stickers-gifs.md"],
    ["V8", "Turn on autonomous messages so a character texts you first", "C2", "data", "conversation/schedules.md"],
    [
      "V9",
      "Give a character a schedule, and set your own status",
      "V8",
      "data",
      "conversation/schedules.md",
      surface("schedules"),
    ],
    ["V10", "Turn on selfies and get one", "G2, C2", "hand", "conversation/selfies.md"],
    ["V11", "Ask for a selfie by hand, then make it again", "V10", "hand", "conversation/selfies.md"],
    ["V12", "Play a table game (UNO, Chess, Poker, Pool…)", "C2", "hand", "conversation/table-games.md"],
    ["V13", "Start a group conversation", "C2, P7", "data", "chats/group-chats.md"],
    ["V14", "Make a voice or video call (sprites appear on video)", "X2, G4", "hand", "conversation/calls.md"],
  ],
  roleplay: [
    ["R1", "Pick a background for a chat", "C3", "data", "roleplay/backgrounds.md"],
    [
      "R2",
      "Add the Background agent so the picture changes with the scene",
      "R1, A1",
      "data",
      "media/scene-backgrounds.md",
      surface("agent-catalog"),
    ],
    [
      "R3",
      "Add World State so the story knows where you are and the weather",
      "A1",
      "data",
      "roleplay/hud-and-trackers.md",
      surface("agent-catalog"),
    ],
    ["R4", "Pin a background to a place, like John's bedroom", "R1, R3", "data", "roleplay/backgrounds.md"],
    [
      "R5",
      "Label a gallery picture as a background with places, so it follows the character into every chat",
      "G1",
      "data",
      "characters/galleries.md",
    ],
    ["R6", "Paint a background for the scene from the Chat Gallery", "G2, C3", "hand", "chats/chat-gallery.md"],
    ["R7", "Move a painted picture into the character's Gallery", "R6", "data", "chats/chat-gallery.md"],
    [
      "R8",
      "Put sprites on stage with the Expression Engine",
      "G4, A1",
      "data",
      "characters/sprites.md",
      surface("agent-catalog"),
    ],
    ["R9", "Turn on the HUD and change a tracker value", "R3", "hand", "roleplay/hud-and-trackers.md"],
    ["R10", "Add the Narrative Director and turn on Secret Plot", "A1", "data", "roleplay/narrative-director.md"],
    ["R11", "Start a scene from a message", "C3", "data", "roleplay/scenes.md"],
    ["R12", "Turn on CYOA choices and pick one", "A1", "data", "agents/built-in-agents.md", surface("agent-catalog")],
    ["R13", "Fight a Roleplay combat encounter", "A1", "data", "roleplay/combat-encounters.md"],
    ["R14", "Play a Roleplay by a ruleset", "C3", "data", "roleplay/rulesets.md"],
  ],
  lore: [
    ["L1", "Create a lorebook and add an entry", "", "data", "lorebooks/overview.md", surface("lorebook-library")],
    [
      "L2",
      "Link the lorebook to a character so it comes along to every chat",
      "L1, P1",
      "data",
      "lorebooks/linking-to-characters.md",
    ],
    ["L3", "Try the Keyword test on an entry", "L1", "hand", "lorebooks/entries.md"],
    [
      "L4",
      "Add the Lorebook Keeper and approve what it wrote",
      "L1, A1",
      "data",
      "agents/approvals-and-agent-suite.md",
    ],
    ["L5", "Turn on Memory Recall in a long chat", "C3", "data", "agents/memory.md", recall],
    ["L6", "Make a chat summary", "C3", "data", "agents/memory.md"],
    ["L7", "Turn on semantic search for a lorebook", "L1, M5", "data", "lorebooks/semantic-search.md"],
    [
      "L8",
      "Add a Knowledge agent and give it a file to look things up in",
      "A1",
      "data",
      "agents/knowledge-sources.md",
    ],
    ["L9", "Link chats to one shared world with World Maps", "R3", "data", "agents/hierarchical-maps.md"],
    ["L10", "See which entries made it in, with Peek prompt", "L1, S2", "hand", "chats/peek-prompt.md", peek],
  ],
  story: [
    ["S1", "Branch from a message to try another path", "C3", "data", "chats/branches.md"],
    ["S2", "Peek at the prompt the AI received", "C2/C3", "app", "chats/peek-prompt.md", peek],
    ["S3", "Steer a reply with /guided", "C3", "hand", "chats/guided-and-impersonate.md"],
    ["S4", "Let Impersonate write your reply", "C3, P3", "hand", "chats/guided-and-impersonate.md"],
    ["S5", "Add a Quick reply next to Send", "C3", "hand", "chats/guided-and-impersonate.md"],
    ["S6", "Use a slash command", "C2/C3", "hand", "chats/slash-commands.md"],
    ["S7", "Hide a message from the AI", "C3", "hand", "chats/messages.md"],
    [
      "S8",
      "Link a Conversation to a Roleplay so each knows what happened in the other",
      "C2, C3",
      "data",
      "chats/connected-chats.md",
    ],
    [
      "S9",
      "Translate a message, or turn on automatic translation",
      "C2/C3",
      "data",
      "integrations/message-translation.md",
    ],
    ["S10", "Export part of a chat", "C3", "hand", "chats/export-import.md"],
  ],
  game: [
    ["Gm1", "Play your first turn", "C4", "hand", "game/getting-started.md"],
    ["Gm2", "Roll dice and make a skill check", "Gm1", "hand", "game/dice-and-skill-checks.md"],
    ["Gm3", "Pick MRPG class trees for a character", "Gm1", "hand", "game/mrpg-classes.md"],
    ["Gm4", "Recruit a party member and check the inventory", "Gm1", "hand", "game/party-and-npcs.md"],
    ["Gm5", "Travel on the map, and change the time or weather", "Gm1", "hand", "game/map-time-weather.md"],
    ["Gm6", "Win a battle", "Gm1", "hand", "game/combat.md"],
    ["Gm7", "Move or edit a HUD widget", "Gm1", "hand", "game/hud-widgets.md"],
    ["Gm8", "Choose the music and sounds a game can use (Asset Browser)", "Gm1", "hand", "game/game-assets.md"],
    ["Gm9", "End a session and start the next one", "Gm1", "hand", "game/sessions-and-saves.md"],
  ],
  prompts: [
    ["M1", "Save a chat's setup as a settings profile", "C3", "data", "chats/settings-profiles.md"],
    [
      "M2",
      "Start a chat in one step with Use a Profile",
      "M1",
      "data",
      "chats/settings-profiles.md",
      { kind: "start-chat", mode: "roleplay", profile: true },
    ],
    ["M3", "Star a profile as the default for its mode", "M1", "data", "chats/settings-profiles.md"],
    ["M4", "Open a preset and change one section", "C3", "hand", "prompts/presets.md", lib("presets")],
    [
      "M5",
      "Pick a Decision model (or download the Built-in model)",
      "C1",
      "data",
      "connections/decision-models.md",
      lib("connections"),
    ],
    ["M6", "Make a lorebook entry fire on a Decision statement", "M5, L1", "hand", "connections/decision-models.md"],
    [
      "M7",
      "Star a model in a connection's model list",
      "C1",
      "data",
      "connections/organizing-connections.md",
      lib("connections"),
    ],
    [
      "M8",
      "Save generation parameters as a connection's default",
      "C1",
      "data",
      "prompts/generation-parameters.md",
      lib("connections"),
    ],
    ["M9", "Use a macro or {{#if}} in a prompt or entry", "M4/L1", "hand", "prompts/macros.md"],
    [
      "A1",
      "Turn on agents in a chat and add one from the catalog",
      "C2/C3",
      "data",
      "agents/agents-overview.md",
      surface("agent-catalog"),
    ],
    ["A2", "Build your own agent (or ask Professor Mari to)", "A1", "data", "agents/custom-agents.md", lib("agents")],
  ],
  look: [
    [
      "T1",
      "Import a CSS theme and turn it on",
      "",
      "data",
      "appearance/custom-css-themes.md",
      settings("addons", "theme-library"),
    ],
    ["T2", "Pick a different font", "", "app", "appearance/fonts.md", settings("appearance", "app-style")],
    [
      "T3",
      "Set a default Roleplay background and blur",
      "R1",
      "app",
      "appearance/chat-backgrounds.md",
      settings("appearance", "chat-backgrounds"),
    ],
    ["T4", "Style one character's messages with Card CSS", "P1", "hand", "appearance/card-css-theming.md"],
  ],
  extras: [
    [
      "X1",
      "Pick an image style profile, or clone your own",
      "G2",
      "hand",
      "media/style-profiles.md",
      settings("generations", "image-generation"),
    ],
    [
      "X2",
      "Set up text to speech and give a character a voice",
      "C1",
      "data",
      "media/tts-setup.md",
      lib("connections"),
    ],
    ["X3", "Speak a message, or turn on auto-play", "X2", "hand", "media/tts-setup.md"],
    ["X4", "Play music with Music DJ", "A1", "data", "media/music.md", surface("agent-catalog")],
    ["X5", "Open Noodle and let characters post", "P1", "data", "agents/noodle.md"],
    ["X6", "Let Noodle carry over into your chats", "X5", "data", "agents/noodle-settings.md"],
    ["X7", "Give a character a 2D or 3D avatar (lips follow the voice)", "X2, A1", "hand", "agents/avatars.md"],
    ["X9", "Download a backup", "", "hand", "data/backup-and-restore.md", settings("advanced", "backup-export")],
    ["X10", "Open Achievements", "", "app", "home/achievements.md"],
  ],
  workspace: [
    ["KW1", "Keep two things open as tabs and switch between them", "C2/C3", "app", "home/tabs-and-drafts.md"],
    ["KW2", "Put tabs in a group, then rename the group", "KW1", "app", "home/tabs-and-drafts.md"],
    ["KW3", "Close a tab, then bring it back with Reopen closed tab", "KW1", "app", "home/tabs-and-drafts.md"],
    [
      "KW4",
      "Split view: drag a chat's character to the page edge and edit it beside the chat",
      "KW1, P1",
      "app",
      "home/tabs-and-drafts.md",
    ],
    [
      "KW5",
      "Open Settings in split view and change a setting while the chat stays open",
      "KW4",
      "app",
      "home/tabs-and-drafts.md",
    ],
    [
      "KW6",
      "Leave an editor without saving, see the dot on its tab, come back and save",
      "P1",
      "hand",
      "home/tabs-and-drafts.md",
    ],
    ["KW7", "On a phone: swipe the top bar to change tabs, and open All Tabs", "KW1", "app", "home/tabs-and-drafts.md"],
  ],
  library: [
    [
      "KL1",
      "Give a folder a color and a front picture",
      "P6",
      "data",
      "characters/library-organization.md",
      surface("character-library"),
    ],
  ],
  weather: [
    ["KR1", "Let the Illustrator paint each new place on its own", "G2, R3", "data", "media/illustrator-agent.md"],
    [
      "KR2",
      "Have a Decision model check each reply for a new place or new weather",
      "KR1, M5",
      "data",
      "media/illustrator-agent.md",
    ],
    ["KR3", "Turn on weather versions of backgrounds", "KR1/R4", "data", "media/illustrator-agent.md"],
    [
      "KR4",
      "Use a theme with weather and watch it follow the story's weather",
      "R3, KT1",
      "hand",
      "appearance/theme-weather.md",
      settings("addons", "theme-library"),
    ],
  ],
  themes: [
    [
      "KT1",
      "Pick a starter theme from the theme gallery",
      "",
      "data",
      "appearance/custom-css-themes.md",
      settings("addons", "theme-library"),
    ],
    ["KT2", "Give one chat, or one character, its own theme", "KT1", "data", "appearance/custom-css-themes.md"],
    ["KT3", "Ask Professor Mari to build a theme", "KT1, C7", "hand", "appearance/theme-author-guide.md", mari],
  ],
};

export const THINGS_TO_TRY_TASKS: readonly ThingsToTryTask[] = DISCOVERY_TRAILS.flatMap((trail) =>
  TRAIL_ROWS[trail.id].map(([id, title, after, done, guide, show]) => ({
    id,
    trail: trail.id,
    title,
    after: parseAfter(after),
    done,
    guide,
    show,
  })),
);

export const THINGS_TO_TRY_BY_ID = new Map(THINGS_TO_TRY_TASKS.map((task) => [task.id, task]));

export const THINGS_TO_TRY_TRAIL_NAMES: Record<DiscoveryTrailId, string> = {
  core: "Core: start here",
  characters: "Characters and personas",
  gallery: "Gallery and pictures",
  conversation: "Conversation life",
  roleplay: "Roleplay stage",
  lore: "Keep the story straight",
  story: "Story control",
  game: "Game mode",
  prompts: "Prompts, models and agents",
  look: "Look and feel",
  extras: "Voice, music and extras",
  workspace: "Your workspace",
  library: "Library look",
  weather: "Backgrounds and weather",
  themes: "Themes",
};

export const thingsToTryTaskKey = (id: string) => `thingsToTry.task.${id.toLowerCase()}`;
export const thingsToTryTrailKey = (trail: DiscoveryTrailId) => `thingsToTry.trail.${trail}`;

export function isTaskUnlocked(task: ThingsToTryTask, done: ReadonlySet<string>): boolean {
  return task.after.every((group) => group.some((id) => done.has(id)));
}

export type ChatModeCounts = { conversation: number; roleplay: number; game: number };

const BASE_TRAIL_ORDER: readonly DiscoveryTrailId[] = [
  "core",
  "characters",
  "gallery",
  "conversation",
  "roleplay",
  "story",
  "lore",
  "prompts",
  "look",
  "workspace",
  "themes",
  "game",
  "extras",
  "library",
  "weather",
];

/** Core first, then the trail of the mode this person makes most chats in, then the rest. */
export function rankTrails(modes: ChatModeCounts | null, hotTrail: DiscoveryTrailId | null): DiscoveryTrailId[] {
  const order = [...BASE_TRAIL_ORDER];
  const favorite = modes
    ? (["conversation", "roleplay", "game"] as const).reduce<keyof ChatModeCounts | null>(
        (best, mode) => (modes[mode] > 0 && (!best || modes[mode] > modes[best]) ? mode : best),
        null,
      )
    : null;
  const lift = (trail: DiscoveryTrailId, at: number) => {
    order.splice(order.indexOf(trail), 1);
    order.splice(at, 0, trail);
  };
  if (favorite) lift(favorite, 1);
  if (favorite === "roleplay") lift("weather", 2);
  if (hotTrail) lift(hotTrail, 0);
  return order;
}

/**
 * The next tasks to show: unlocked, not done, not skipped. One from each trail in rank order,
 * then a second pass, so the list mixes trails instead of draining one.
 */
export function pickNextTasks(
  done: ReadonlySet<string>,
  skipped: ReadonlySet<string>,
  trails: readonly DiscoveryTrailId[],
  count = 3,
): ThingsToTryTask[] {
  const open = (task: ThingsToTryTask) => !done.has(task.id) && !skipped.has(task.id) && isTaskUnlocked(task, done);
  const queues = trails.map((trail) => THINGS_TO_TRY_TASKS.filter((task) => task.trail === trail && open(task)));
  const picked: ThingsToTryTask[] = [];
  for (let round = 0; picked.length < count && queues.some((queue) => queue.length > round); round++) {
    for (const queue of queues) {
      const task = queue[round];
      if (task) picked.push(task);
      if (picked.length >= count) break;
    }
  }
  return picked;
}

/** Trails whose every task is done (skipped ones don't count). */
export function finishedTrails(done: ReadonlySet<string>): DiscoveryTrailId[] {
  return DISCOVERY_TRAILS.filter((trail) =>
    THINGS_TO_TRY_TASKS.filter((task) => task.trail === trail.id).every((task) => done.has(task.id)),
  ).map((trail) => trail.id);
}

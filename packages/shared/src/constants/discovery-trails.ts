/**
 * "Things to try" trails (Home widget). Part "engine" trails cover features upstream staging also has;
 * part "kolacheee" trails cover ui/kolacheee-only features, kept apart so the list ports cleanly.
 * Finishing a trail unlocks its Explorer achievement (event `explorer_<trail>`).
 */
export const DISCOVERY_TRAILS = [
  {
    id: "core",
    part: "engine",
    title: "Fresh Out Of The Oven",
    description: "Finished the Core trail in Things to try.",
  },
  {
    id: "characters",
    part: "engine",
    title: "Cast Of Thousands",
    description: "Finished the Characters and personas trail.",
  },
  { id: "gallery", part: "engine", title: "Shutterbug", description: "Finished the Gallery and pictures trail." },
  {
    id: "conversation",
    part: "engine",
    title: "Chronically Online",
    description: "Finished the Conversation life trail.",
  },
  { id: "roleplay", part: "engine", title: "Set Dresser", description: "Finished the Roleplay stage trail." },
  { id: "lore", part: "engine", title: "Keeper Of Lore", description: "Finished the Lore and memory trail." },
  { id: "story", part: "engine", title: "Plot Armor", description: "Finished the Story control trail." },
  { id: "game", part: "engine", title: "Roll For Initiative", description: "Finished the Game mode trail." },
  {
    id: "prompts",
    part: "engine",
    title: "Prompt Whisperer",
    description: "Finished the Prompts, models and agents trail.",
  },
  { id: "look", part: "engine", title: "Interior Decorator", description: "Finished the Look and feel trail." },
  {
    id: "extras",
    part: "engine",
    title: "Bells And Whistles",
    description: "Finished the Voice, music and extras trail.",
  },
  { id: "workspace", part: "kolacheee", title: "Tab Hoarder", description: "Finished the Workspace trail." },
  { id: "library", part: "kolacheee", title: "Neat Freak", description: "Finished the Library look trail." },
  {
    id: "weather",
    part: "kolacheee",
    title: "Storm Chaser",
    description: "Finished the Backgrounds and weather trail.",
  },
  { id: "themes", part: "kolacheee", title: "Dress To Impress", description: "Finished the Themes trail." },
] as const;

export type DiscoveryTrailId = (typeof DISCOVERY_TRAILS)[number]["id"];
export type DiscoveryTrailPart = (typeof DISCOVERY_TRAILS)[number]["part"];

export const DISCOVERY_TRAIL_IDS = DISCOVERY_TRAILS.map((trail) => trail.id) as DiscoveryTrailId[];

export type ExplorerAchievementEvent = `explorer_${DiscoveryTrailId}`;

export function explorerAchievementEvent(trail: DiscoveryTrailId): ExplorerAchievementEvent {
  return `explorer_${trail}`;
}

/** camelCase key segment for a trail id ("core" -> "core"). Trail ids are single words. */
export function explorerAchievementKey(trail: DiscoveryTrailId): string {
  return trail;
}

/**
 * Guide quest groups (AI basics and the Deep dive groups). Finishing every quest in a group unlocks its
 * Explorer achievement (event `explorer_<group>`). Group ids never clash with trail ids.
 */
export const GUIDE_QUEST_GROUPS = [
  { id: "aiBasics", title: "Training Wheels Off", description: "Finished the AI basics tour." },
  { id: "deepConversation", title: "Read Receipts", description: "Finished the Conversation deep dives." },
  { id: "deepRoleplay", title: "Method Actor", description: "Finished the Roleplay deep dives." },
  { id: "deepGame", title: "Rules Lawyer", description: "Finished the Game deep dives." },
  { id: "deepAnyMode", title: "Knob Twiddler", description: "Finished the Any mode deep dives." },
  { id: "deepCards", title: "Card Shark", description: "Finished the Characters and cards deep dives." },
  { id: "deepLore", title: "Footnote Fanatic", description: "Finished the Lorebook tricks deep dives." },
  { id: "deepPrompts", title: "Macro Magician", description: "Finished the Prompt and macro tricks deep dives." },
  { id: "deepMessages", title: "Secret Keeper", description: "Finished the Message tricks deep dives." },
  { id: "deepAgents", title: "Puppet Master", description: "Finished the Agents and connections deep dives." },
  { id: "deepMedia", title: "Sound And Vision", description: "Finished the Voice, pictures and music deep dives." },
  { id: "deepThemes", title: "Under The Hood", description: "Finished the Themes and extending deep dives." },
] as const;

export type GuideQuestGroupId = (typeof GUIDE_QUEST_GROUPS)[number]["id"];

export type GuideQuestAchievementEvent = `explorer_${GuideQuestGroupId}`;

export function guideQuestAchievementEvent(group: GuideQuestGroupId): GuideQuestAchievementEvent {
  return `explorer_${group}`;
}

/** Task ids the server can check from saved data (GET /api/discovery/progress). */
export interface DiscoveryProgressResponse {
  done: string[];
  /** Chats per mode, so the list can lead with the mode this person uses most. */
  modes: { conversation: number; roleplay: number; game: number };
}

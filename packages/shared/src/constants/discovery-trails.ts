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

/** Task ids the server can check from saved data (GET /api/discovery/progress). */
export interface DiscoveryProgressResponse {
  done: string[];
  /** Chats per mode, so the list can lead with the mode this person uses most. */
  modes: { conversation: number; roleplay: number; game: number };
}

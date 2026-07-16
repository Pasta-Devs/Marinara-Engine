export type OfficialAgentKnowledgeCategory = "writer" | "tracker" | "misc";

export interface OfficialAgentKnowledgeEntry {
  id: string;
  name: string;
  category: OfficialAgentKnowledgeCategory;
  modes: string;
  summary: string;
}

/**
 * Compact catalog knowledge for Professor Mari. These are descriptions, not
 * runtime agent definitions: optional packages still own their code, prompts,
 * settings, artwork, and executable manifests.
 */
export const OFFICIAL_AGENT_KNOWLEDGE_ENTRIES: readonly OfficialAgentKnowledgeEntry[] = [
  {
    id: "prose-guardian",
    name: "Prose Guardian",
    category: "writer",
    modes: "Roleplay",
    summary: "rewrites finished replies to remove banned words, repetition, and unwanted prose habits",
  },
  {
    id: "continuity",
    name: "Continuity Checker",
    category: "writer",
    modes: "Roleplay",
    summary: "finds concrete spatial, timeline, and physical logic errors and offers focused corrections",
  },
  {
    id: "director",
    name: "Narrative Director",
    category: "writer",
    modes: "Roleplay",
    summary: "adds an on-demand story push and can maintain an optional hidden Secret Plot",
  },
  {
    id: "knowledge-retrieval",
    name: "Knowledge Retrieval",
    category: "writer",
    modes: "Roleplay",
    summary: "finds and summarizes relevant material from selected lorebooks and uploaded knowledge files",
  },
  {
    id: "knowledge-router",
    name: "Knowledge Router",
    category: "writer",
    modes: "Roleplay",
    summary: "selects relevant described lorebook entries and injects them verbatim as a lower-cost alternative",
  },
  {
    id: "card-evolution-auditor",
    name: "Card Evolution Auditor",
    category: "writer",
    modes: "Roleplay",
    summary: "audits durable character changes and proposes reviewable character-card edits",
  },
  {
    id: "world-state",
    name: "World State",
    category: "tracker",
    modes: "Roleplay",
    summary: "tracks date, time, weather, location, temperature, and custom world details",
  },
  {
    id: "expression",
    name: "Expression Engine",
    category: "tracker",
    modes: "Roleplay",
    summary: "detects character emotions and selects matching visual-novel sprites or expressions",
  },
  {
    id: "quest",
    name: "Quest Tracker",
    category: "tracker",
    modes: "Roleplay",
    summary: "tracks quest objectives, completion states, and rewards",
  },
  {
    id: "background",
    name: "Background",
    category: "tracker",
    modes: "Roleplay",
    summary: "selects a fitting scene background and can generate missing locations when configured",
  },
  {
    id: "character-tracker",
    name: "Character Tracker",
    category: "tracker",
    modes: "Roleplay",
    summary: "tracks present characters, moods, actions, outfits, thoughts, and per-character stats",
  },
  {
    id: "persona-stats",
    name: "Persona Stats",
    category: "tracker",
    modes: "Roleplay",
    summary: "tracks the player's status bars and custom persona stats",
  },
  {
    id: "custom-tracker",
    name: "Custom Tracker",
    category: "tracker",
    modes: "Roleplay",
    summary: "tracks user-defined currencies, counters, flags, and other structured fields",
  },
  {
    id: "hierarchical-maps",
    name: "Hierarchical Maps",
    category: "tracker",
    modes: "Roleplay and Game",
    summary: "adds persistent nested locations, spatial context, map authoring, movement, and a Game world-map view",
  },
  {
    id: "echo-chamber",
    name: "Echo Chamber",
    category: "misc",
    modes: "Roleplay",
    summary: "shows a configurable fictional live audience reacting to the current scene",
  },
  {
    id: "illustrator",
    name: "Illustrator",
    category: "misc",
    modes: "Roleplay and Conversation media commands",
    summary: "Responsible for image and video generations.",
  },
  {
    id: "lorebook-keeper",
    name: "Lorebook Keeper",
    category: "misc",
    modes: "Roleplay",
    summary: "creates and updates durable lorebook entries from important story facts",
  },
  {
    id: "combat",
    name: "Combat",
    category: "misc",
    modes: "Roleplay",
    summary: "adds Roleplay encounters with initiative, HP, turn order, and dice-backed actions",
  },
  {
    id: "html",
    name: "Immersive HTML",
    category: "misc",
    modes: "Roleplay",
    summary: "adds diegetic HTML visual artifacts to a reply without changing its story meaning",
  },
  {
    id: "spotify",
    name: "Music DJ",
    category: "misc",
    modes: "Roleplay, Game, and Conversation music commands",
    summary: "matches scene mood with Spotify, YouTube, or local Game Assets music",
  },
  {
    id: "haptic",
    name: "Haptic Feedback",
    category: "misc",
    modes: "Roleplay and Conversation haptic commands",
    summary: "converts direct narrative contact into safe Intiface Central device commands",
  },
  {
    id: "cyoa",
    name: "CYOA Choices",
    category: "misc",
    modes: "Roleplay",
    summary: "adds editable, rerollable choose-your-own-adventure response choices",
  },
  {
    id: "conversation-calls",
    name: "Conversation Calls",
    category: "misc",
    modes: "Conversation",
    summary:
      "adds live audio and video calls, incoming-call commands, call transcripts, TTS, and an optional package-owned Local Whisper download that is removed when Calls is uninstalled",
  },
  {
    id: "uno",
    name: "UNO",
    category: "misc",
    modes: "Conversation",
    summary: "adds multiplayer UNO with Conversation characters through /uno or the games picker",
  },
  {
    id: "chess",
    name: "Chess",
    category: "misc",
    modes: "Conversation",
    summary: "adds a one-on-one Chess board through /chess or the games picker",
  },
  {
    id: "poker",
    name: "Poker",
    category: "misc",
    modes: "Conversation",
    summary: "adds two-to-eight-player Texas Hold'em through /poker or the games picker",
  },
  {
    id: "eightball",
    name: "8-Ball Pool",
    category: "misc",
    modes: "Conversation",
    summary: "adds a one-on-one pool table through /8ball or the games picker",
  },
  {
    id: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    category: "misc",
    modes: "Conversation",
    summary: "adds a one-on-one Tic-Tac-Toe board through /tictactoe or the games picker",
  },
  {
    id: "rock-paper-scissors",
    name: "Rock-Paper-Scissors",
    category: "misc",
    modes: "Conversation",
    summary: "adds best-of-three, five, or seven matches through /rps or the games picker",
  },
];

const CATEGORY_LABELS: Record<OfficialAgentKnowledgeCategory, string> = {
  writer: "Writer Agents",
  tracker: "Tracker Agents",
  misc: "Misc Agents",
};

export const PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE = [
  "<official_agent_catalog>",
  "The official Marinara Engine v2.3.0+ catalog contains these 29 optional first-party packages:",
  ...(["writer", "tracker", "misc"] as const).flatMap((category) => [
    `## ${CATEGORY_LABELS[category]}`,
    ...OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.filter((entry) => entry.category === category).map(
      (entry) => `- ${entry.name} (package \`${entry.id}\`; ${entry.modes}): ${entry.summary}.`,
    ),
  ]),
  "Catalog guidance:",
  "- Package sources, manifests, artifacts, and the complete official catalog are public at https://github.com/Pasta-Devs/Marinara-Agents.",
  "- Catalog availability is not proof that a package is installed. Inspect the user's installed agents before claiming one is active.",
  "- Install, immediately update, or uninstall official packages from Agents → Download Agents. Installed packages also update automatically to the newest compatible catalog version when the Marinara server starts; offline or failed checks preserve the installed version.",
  "- Pipeline agents are enabled per compatible chat in Chat Settings → Agents. Feature packages such as Maps, Calls, and Conversation games expose their own controls after installation.",
  "- Do not describe About Me Keeper as an agent. Conversation About Me and its update tool are built into Marinara Engine.",
  "</official_agent_catalog>",
].join("\n");

// The built-in agents with a card of their own in Roleplay's Agents section. Each row is the agent's id and the name and
// description shown when the agent itself doesn't supply them. `useChatAgents` turns every row into the card's name,
// description and on/off state (`builtInAgentCards`) and into its link in the Agents jump menu.
export const BUILT_IN_AGENT_CARDS = [
  {
    id: "lorebook-keeper",
    name: "Lorebook Keeper",
    description: "Saves important story facts to the chat's lorebook as you play.",
  },
  {
    id: "card-evolution-auditor",
    name: "Card Evolution Auditor",
    description: "Suggests character card updates when the story changes a character, for you to approve.",
  },
  {
    id: "prose-guardian",
    name: "Prose Guardian",
    description: "Cleans up repetitive or unwanted writing habits in AI messages.",
  },
  {
    id: "director",
    name: "Narrative Director",
    description: "Gives the story a push in a new direction when you ask for it.",
  },
  {
    id: "continuity",
    name: "Continuity Checker",
    description: "Fixes mistakes about places, time, and physical details in AI messages.",
  },
  {
    id: "html",
    name: "Immersive HTML",
    description: "Adds HTML/CSS/JS visual effects to AI messages.",
  },
  {
    id: "knowledge-retrieval",
    name: "Knowledge Retrieval",
    description: "Finds facts in your lorebooks and files that matter for the current scene.",
  },
  {
    id: "knowledge-router",
    name: "Knowledge Router",
    description: "Picks the lorebook entries that fit the scene and gives them to the AI.",
  },
  {
    id: "expression",
    name: "Expression Engine",
    description: "Changes character sprites to match how they feel.",
  },
  {
    id: "echo-chamber",
    name: "Echo Chamber",
    description: "Shows a live stream-style chat reacting to your roleplay.",
  },
  {
    id: "illustrator",
    name: "Illustrator",
    description: "Creates images and videos for your chats.",
  },
  {
    id: "spotify",
    name: "Music DJ",
    description: "Plays music that fits the mood of the story, from Spotify, YouTube, or your own Game Assets music.",
  },
  {
    id: "haptic",
    name: "Haptic Feedback",
    description: "Controls connected intimate toys to match what happens in the story.",
  },
] as const;

export type BuiltInAgentCardId = (typeof BUILT_IN_AGENT_CARDS)[number]["id"];

export interface BuiltInAgentCard {
  name: string;
  description: string;
  active: boolean;
}

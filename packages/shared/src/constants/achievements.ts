import type { AchievementDefinition, AchievementEvent } from "../types/achievement.js";

export const ACHIEVEMENT_EVENTS = [
  "tutorial_completed",
  "discord_clicked",
  "kofi_clicked",
  "credits_viewed",
  "prof_mari_message_sent",
  "chat_created",
  "library_changed",
] as const satisfies readonly AchievementEvent[];

const RANKS = [
  { rank: "bronze", rankLabel: "I", target: 5 },
  { rank: "silver", rankLabel: "II", target: 25 },
  { rank: "gold", rankLabel: "III", target: 100 },
] as const;

function rankedAchievements(
  groupId: string,
  title: string,
  descriptionForTarget: (target: number) => string,
  icon: AchievementDefinition["icon"],
  metric: NonNullable<AchievementDefinition["metric"]>,
  category: AchievementDefinition["category"],
): AchievementDefinition[] {
  return RANKS.map(({ rank, rankLabel, target }) => ({
    id: `${groupId}_${rank}`,
    title,
    description: descriptionForTarget(target),
    category,
    icon,
    rank,
    rankLabel,
    groupId,
    target,
    metric,
  }));
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "diligent_student",
    title: "Diligent Student",
    description: "Completed Professor Mari's tutorial.",
    category: "milestone",
    icon: "graduation",
  },
  {
    id: "one_of_us",
    title: "One Of Us",
    description: "Visited the Marinara Engine Discord invite.",
    category: "community",
    icon: "discord",
  },
  {
    id: "based_backer",
    title: "Based Backer",
    description: "Visited the Ko-fi support page.",
    category: "community",
    icon: "heart",
  },
  {
    id: "backseat_appreciator",
    title: "Backseat Appreciator",
    description: "Viewed the credits.",
    category: "community",
    icon: "credits",
  },
  {
    id: "hello_world",
    title: "Hello World",
    description: "Sent a message to Professor Mari.",
    category: "milestone",
    icon: "mari",
  },
  ...rankedAchievements(
    "who_needs_irl_friends",
    "Who Needs IRL Friends",
    (target) => `Created ${target} Conversation chats.`,
    "conversation",
    "conversationChats",
    "creation",
  ),
  ...rankedAchievements(
    "they_feel_real_to_me",
    "They Feel Real To Me",
    (target) => `Created ${target} Roleplay chats.`,
    "roleplay",
    "roleplayChats",
    "creation",
  ),
  ...rankedAchievements(
    "i_have_no_other_hobbies",
    "I Have No Other Hobbies",
    (target) => `Created ${target} Game mode chats.`,
    "game",
    "gameChats",
    "creation",
  ),
  ...rankedAchievements("hoarder", "Hoarder", (target) => `Collected ${target} Characters.`, "character", "characters", "collection"),
  ...rankedAchievements(
    "the_worlds_a_stage",
    "The World's A Stage",
    (target) => `Collected ${target} Lorebooks.`,
    "lorebook",
    "lorebooks",
    "collection",
  ),
  ...rankedAchievements("i_am_a_gamer", "I Am A Gamer", (target) => `Collected ${target} Personas.`, "persona", "personas", "collection"),
];

export const ACHIEVEMENT_DEFINITION_BY_ID = new Map(ACHIEVEMENT_DEFINITIONS.map((item) => [item.id, item]));

export const ACHIEVEMENT_IDS = ACHIEVEMENT_DEFINITIONS.map((item) => item.id);

export const ACHIEVEMENT_DIRECT_EVENT_IDS: Partial<Record<AchievementEvent, string>> = {
  tutorial_completed: "diligent_student",
  discord_clicked: "one_of_us",
  kofi_clicked: "based_backer",
  credits_viewed: "backseat_appreciator",
  prof_mari_message_sent: "hello_world",
};

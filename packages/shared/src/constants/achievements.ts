import type { AchievementDefinition, AchievementEvent } from "../types/achievement.js";

export const ACHIEVEMENT_EVENTS = [
  "tutorial_completed",
  "discord_clicked",
  "kofi_clicked",
  "credits_viewed",
  "prof_mari_message_sent",
  "prof_mari_dragged",
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
  titleKey: string,
  title: string,
  descriptionKey: string,
  descriptionForTarget: (target: number) => string,
  icon: AchievementDefinition["icon"],
  metric: NonNullable<AchievementDefinition["metric"]>,
  category: AchievementDefinition["category"],
): AchievementDefinition[] {
  return RANKS.map(({ rank, rankLabel, target }) => ({
    id: `${groupId}_${rank}`,
    titleKey,
    title,
    descriptionKey,
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
    titleKey: "achievements.definitions.diligentStudent.title",
    title: "Diligent Student",
    descriptionKey: "achievements.definitions.diligentStudent.description",
    description: "Completed Professor Mari's tutorial.",
    category: "milestone",
    icon: "graduation",
  },
  {
    id: "one_of_us",
    titleKey: "achievements.definitions.oneOfUs.title",
    title: "One Of Us",
    descriptionKey: "achievements.definitions.oneOfUs.description",
    description: "Visited the Marinara Engine Discord invite.",
    category: "community",
    icon: "discord",
  },
  {
    id: "based_backer",
    titleKey: "achievements.definitions.basedBacker.title",
    title: "Based Backer",
    descriptionKey: "achievements.definitions.basedBacker.description",
    description: "Visited the Ko-fi support page.",
    category: "community",
    icon: "heart",
  },
  {
    id: "backseat_appreciator",
    titleKey: "achievements.definitions.backseatAppreciator.title",
    title: "Backseat Appreciator",
    descriptionKey: "achievements.definitions.backseatAppreciator.description",
    description: "Viewed the credits.",
    category: "community",
    icon: "credits",
  },
  {
    id: "hello_world",
    titleKey: "achievements.definitions.helloWorld.title",
    title: "Hello World",
    descriptionKey: "achievements.definitions.helloWorld.description",
    description: "Sent a message to Professor Mari.",
    category: "milestone",
    icon: "mari",
  },
  {
    id: "please_handle_with_care",
    titleKey: "achievements.definitions.pleaseHandleWithCare.title",
    title: "Please Handle With Care",
    descriptionKey: "achievements.definitions.pleaseHandleWithCare.description",
    description: "Traumatized Professor Mari by dragging her around the screen.",
    category: "milestone",
    icon: "mari-drag",
  },
  ...rankedAchievements(
    "who_needs_irl_friends",
    "achievements.definitions.whoNeedsIrlFriends.title",
    "Who Needs IRL Friends",
    "achievements.definitions.whoNeedsIrlFriends.description",
    (target) => `Created ${target} Conversation chats.`,
    "conversation",
    "conversationChats",
    "creation",
  ),
  ...rankedAchievements(
    "they_feel_real_to_me",
    "achievements.definitions.theyFeelRealToMe.title",
    "They Feel Real To Me",
    "achievements.definitions.theyFeelRealToMe.description",
    (target) => `Created ${target} Roleplay chats.`,
    "roleplay",
    "roleplayChats",
    "creation",
  ),
  ...rankedAchievements(
    "i_have_no_other_hobbies",
    "achievements.definitions.iHaveNoOtherHobbies.title",
    "I Have No Other Hobbies",
    "achievements.definitions.iHaveNoOtherHobbies.description",
    (target) => `Created ${target} Game mode chats.`,
    "game",
    "gameChats",
    "creation",
  ),
  ...rankedAchievements(
    "hoarder",
    "achievements.definitions.hoarder.title",
    "Hoarder",
    "achievements.definitions.hoarder.description",
    (target) => `Collected ${target} Characters.`,
    "character",
    "characters",
    "collection",
  ),
  ...rankedAchievements(
    "the_worlds_a_stage",
    "achievements.definitions.theWorldsAStage.title",
    "The World's A Stage",
    "achievements.definitions.theWorldsAStage.description",
    (target) => `Collected ${target} Lorebooks.`,
    "lorebook",
    "lorebooks",
    "collection",
  ),
  ...rankedAchievements(
    "i_am_a_gamer",
    "achievements.definitions.iAmAGamer.title",
    "I Am A Gamer",
    "achievements.definitions.iAmAGamer.description",
    (target) => `Collected ${target} Personas.`,
    "persona",
    "personas",
    "collection",
  ),
];

export const ACHIEVEMENT_DEFINITION_BY_ID = new Map(ACHIEVEMENT_DEFINITIONS.map((item) => [item.id, item]));

export const ACHIEVEMENT_IDS = ACHIEVEMENT_DEFINITIONS.map((item) => item.id);

export const ACHIEVEMENT_DIRECT_EVENT_IDS: Partial<Record<AchievementEvent, string>> = {
  tutorial_completed: "diligent_student",
  discord_clicked: "one_of_us",
  kofi_clicked: "based_backer",
  credits_viewed: "backseat_appreciator",
  prof_mari_message_sent: "hello_world",
  prof_mari_dragged: "please_handle_with_care",
};

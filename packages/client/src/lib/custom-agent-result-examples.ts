import type { AgentResultType } from "@marinara-engine/shared";

export const CUSTOM_AGENT_RESULT_TYPE_IDS = [
  "context_injection",
  "character_card_create",
  "text_rewrite",
  "lorebook_update",
  "character_tracker_update",
  "persona_stats_update",
  "custom_tracker_update",
  "inventory_tracker_update",
  "game_state_update",
  "image_prompt",
  "prompt_patch",
  "character_activity_update",
  "frontend_theme_update",
  "background_change",
  "sprite_change",
  "spotify_control",
  "youtube_control",
  "local_music_control",
  "haptic_command",
  "about_me_update",
  "cyoa_choices",
] as const satisfies readonly AgentResultType[];

export type CustomAgentResultType = (typeof CUSTOM_AGENT_RESULT_TYPE_IDS)[number];

export interface CustomAgentResultExample {
  format: "json" | "text";
  value: string;
}

function jsonExample(value: unknown): CustomAgentResultExample {
  return { format: "json", value: JSON.stringify(value, null, 2) };
}

export const CUSTOM_AGENT_RESULT_EXAMPLES: Record<CustomAgentResultType, CustomAgentResultExample> = {
  context_injection: {
    format: "text",
    value: "Plain text to inject into the main prompt or save as this agent's informational result.",
  },
  character_card_create: jsonExample({
    data: {
      name: "Character name",
      description: "Identity and role",
      personality: "Traits, voice, and mannerisms",
      scenario: "Default scenario",
      first_mes: "Opening message",
      mes_example: "Example dialogue",
      creator_notes: "Notes for the user",
      system_prompt: "",
      post_history_instructions: "",
      tags: ["npc"],
      creator: "",
      character_version: "1.0",
      alternate_greetings: [],
      extensions: {
        backstory: "Established history",
        appearance: "Physical appearance",
      },
      character_book: null,
    },
    reason: "Why this recurring character deserves a card",
  }),
  text_rewrite: jsonExample({
    editNeeded: true,
    editedText: "Complete replacement assistant message",
    changes: [{ description: "Brief description of the edit" }],
  }),
  lorebook_update: jsonExample({
    updates: [
      {
        action: "create|update",
        entryName: "Entry name, exact existing name when updating",
        content: "Full content for a create or replacement",
        newFacts: ["Atomic durable fact to append"],
        keys: ["activation keyword"],
        tag: "character|location|item|faction|event|lore",
        order: 200,
        reason: "Why this should be recorded",
      },
    ],
  }),
  character_tracker_update: jsonExample({
    presentCharacters: [
      {
        characterId: "Exact character ID",
        name: "Display name",
        emoji: "🙂",
        mood: "calm",
        appearance: "Persistent physical traits or null",
        outfit: "Current clothing or null",
        thoughts: "Unspoken thought or null",
        customFields: { "Exact existing field": "Current value" },
        stats: [{ name: "HP", value: 80, max: 100, color: "#ef4444" }],
      },
    ],
  }),
  persona_stats_update: jsonExample({
    stats: [{ name: "Energy", value: 80, max: 100, color: "#facc15" }],
    status: "Short current status",
    inventory: [{ name: "Item", description: "Brief description", quantity: 1, location: "on_person|stored" }],
    reasoning: "Brief explanation of changes",
  }),
  custom_tracker_update: jsonExample({
    fields: [{ name: "Exact existing field name", value: "Updated string value" }],
    reasoning: "Brief explanation of changes",
  }),
  inventory_tracker_update: jsonExample({
    currencies: [{ name: "Silver coin", qty: 6 }],
    equipped: [{ name: "Family heirloom longsword" }],
    inventory: [{ name: "Healing potion", qty: 2 }],
    reasoning: "Brief explanation of changes",
  }),
  game_state_update: jsonExample({
    date: "Current date or null",
    time: "Current time or null",
    location: "Current location or null",
    weather: "Current weather or null",
    temperature: "Current temperature or null",
    worldCustomFields: [{ name: "Exact existing field name", value: "Current value", icon: "map-pin" }],
  }),
  image_prompt: jsonExample({
    shouldGenerate: true,
    generateBackground: false,
    reason: "Why an image should or should not be generated",
    prompt: "Detailed image prompt",
    negativePrompt: "What to avoid",
    style: "Visual style",
    aspectRatio: "landscape|portrait|square",
    characters: ["Visible character name"],
  }),
  prompt_patch: jsonExample({
    operations: [
      {
        target: "last_user|last_message|first_system|append_system|prepend_system",
        mode: "append|prepend|replace",
        content: "Prompt content to apply",
      },
    ],
  }),
  character_activity_update: jsonExample({
    activeCharacterIds: ["Exact attached character ID"],
  }),
  frontend_theme_update: jsonExample({
    css: ".chat-surface { filter: saturate(1.1); }",
    durationMs: 60000,
  }),
  background_change: jsonExample({ chosen: "exact-background-filename.ext or null" }),
  sprite_change: jsonExample({
    expressions: [
      {
        characterId: "Exact character ID",
        characterName: "Character name",
        expression: "Exact available expression",
        transition: "crossfade|bounce|shake|hop|none",
      },
    ],
  }),
  spotify_control: jsonExample({
    action: "play|volume|none",
    mood: "Brief detected mood",
    searchQuery: "Search query or null",
    trackUris: ["spotify:track:..."],
    trackNames: ["Track and artist"],
    volume: 50,
  }),
  youtube_control: jsonExample({
    action: "play|volume|none",
    mood: "Brief detected mood",
    searchQuery: "YouTube search query",
    volume: 50,
  }),
  local_music_control: jsonExample({
    action: "play|volume|none",
    mood: "Brief detected mood",
    path: "Exact available asset path",
    trackName: "Display name",
    volume: 50,
  }),
  haptic_command: jsonExample({
    reasoning: "Brief reason for these commands",
    commands: [
      {
        deviceIndex: 0,
        action: "vibrate|oscillate|rotate|constrict|inflate|position|temperature|spray|led|stop",
        intensity: 0.5,
        duration: 2,
        pattern: "steady|tap|pulse|wave|ramp|impact",
      },
    ],
  }),
  about_me_update: jsonExample({
    updates: [
      {
        characterId: "Exact character ID",
        target: "chat|public",
        newText: "Complete About Me text",
        reason: "Why this should change",
      },
    ],
  }),
  cyoa_choices: jsonExample({
    choices: [{ label: "Short display label", text: "Full first-person action or dialogue to send" }],
  }),
};

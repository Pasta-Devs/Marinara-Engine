/**
 * Guide quests: two sets that sit beside "Things to try".
 *
 *  - AI basics (set "basics"): for people new to AI. Offered once after the welcome tutorial. Each quest
 *    opens a guide at one passage, highlights it, and shows a guide card with the plain-words version and
 *    an everyday comparison. One quest helps set up a model (skipping is fine); the last one introduces
 *    Professor Mari.
 *  - Deep dives (set "deep"): opt-in, for people who know the basics. Each is one setting where the choice
 *    isn't obvious, or a feature almost nobody finds. They mix into the Home widget once Things to try's
 *    Core trail is done, ranked by what the person uses most.
 *
 * Every quest is Engine-wide (it ports with Things to try's Engine part). English text lives here; the
 * translated text is `guideQuests.<id lowercased>.<title|note|more>` in the locale files.
 */
import { GUIDE_QUEST_GROUPS, type GuideQuestGroupId } from "@marinara-engine/shared";
import type { FeatureStep } from "./feature-finder";

export type GuideQuestSet = "basics" | "deep";

export interface GuideQuest {
  id: string;
  set: GuideQuestSet;
  group: GuideQuestGroupId;
  title: string;
  /** The guide it opens, relative to the docs folder. */
  guide: string;
  /** The heading the passage sits under. Empty = the top of the guide. */
  heading: string;
  /** A short quote from the passage, highlighted. Empty = the first paragraph under the heading. */
  quote: string;
  /** AI basics: the plain-words version. Deep dives: the choice and why. */
  note: string;
  /** AI basics: an everyday comparison. Deep dives: a small "try it" step. */
  more: string;
  /** Show me in the card: opens the spot in the app. */
  show?: FeatureStep;
  /** A quest with its own buttons: model setup, or meeting Professor Mari. */
  special?: "setup" | "mari";
}

type Row = [
  id: string,
  title: string,
  guide: string,
  heading: string,
  quote: string,
  note: string,
  more: string,
  show?: FeatureStep,
];

const panel = (name: "characters" | "personas" | "lorebooks" | "presets" | "connections" | "agents"): FeatureStep => ({
  kind: "target",
  target: { kind: "panel", panel: name },
});
const settings = (tab: "general" | "appearance" | "generations" | "addons" | "import" | "advanced"): FeatureStep => ({
  kind: "target",
  target: { kind: "settings", tab },
});

const BASICS: Row[] = [
  [
    "AB1",
    "What is an AI model?",
    "home/ai-basics.md",
    "What an AI model is",
    "learned to predict what comes next",
    "An AI model is a program that has read a huge amount of text and writes by guessing what comes next, one small piece at a time. It doesn't look things up while it writes: it only knows what it read before, plus what Marinara sends it with your message.",
    "Think of a very well-read improv partner. It doesn't check a book mid-scene; it keeps the scene going from what it already knows and what you just said.",
  ],
  [
    "AB2",
    "Where the model lives",
    "connections/connecting-to-a-provider.md",
    "",
    "To chat, Marinara Engine needs an AI model",
    "Marinara is the app you chat in; the model runs somewhere else. A service on the internet (OpenRouter, NanoGPT, OpenAI and others) runs big models for you with an API key. The Built-in model runs a small one on your own computer with no key.",
    "Marinara is the stage, the model is the actor. A service rents you an actor over the internet; the Built-in model is an actor who lives in your house: always free, a bit less polished.",
  ],
  [
    "AB3",
    "Tokens and context",
    "home/ai-basics.md",
    "The context window",
    "That limit is its context window",
    "Models read in tokens, small pieces of words (about three quarters of a word each). They can only read so many at once: that's the context window. Every reply, Marinara fills it with the rules, the character, your persona and as much of the chat as fits. Services charge by tokens.",
    "The context window is the actor's desk. Only what fits on the desk gets read before each line, and when it's full, the oldest pages slide off the back.",
  ],
  [
    "AB4",
    "Why your character forgets",
    "agents/memory.md",
    "",
    "In a long chat the oldest messages fall out of it",
    "In a long chat the oldest messages no longer fit, so the model can't see them. Summaries keep a short version of what happened; Memory Recall finds the old messages that matter right now and puts them back.",
    "Summaries are sticky notes on the desk. Memory Recall is a librarian who fetches the one old page you need for this scene.",
  ],
  [
    "AB5",
    "Several models, several jobs",
    "connections/connecting-to-a-provider.md",
    "Choosing the model for each job",
    "A job is something a model does for you",
    "Marinara can give different jobs to different models: Main writes replies, others run helpers, make pictures or answer small questions. One chat model can do all the text jobs to start; add others when a feature asks.",
    "A kitchen has more than one cook. The head chef writes the story; helpers chop, plate and check the oven. In a small kitchen, one cook does everything.",
  ],
  [
    "AB6",
    "Decision models",
    "connections/decision-models.md",
    "",
    "answers short questions about your chat for Marinara",
    'A Decision model answers small questions about the chat instead of writing replies: usually yes or no, like "did the scene move to a new place?", but it can also pick one of a few options or give a score, and some can look at pictures shared in the chat. Its answers are never shown in the chat; they switch features on and off. It\'s optional, and the Built-in model can do it for free.',
    "A referee who makes quick calls: yes or no, which one, how much. Small and fast, so it can check every single reply without slowing the game down.",
  ],
  [
    "AB7",
    "Embeddings",
    "lorebooks/semantic-search.md",
    "",
    "lists of numbers that capture the meaning of a text",
    'An embedding model turns text into a list of numbers that stands for its meaning. Marinara uses it to find lore and memories by meaning, so "blade" can find an entry about a "sword". It never writes anything.',
    'A map of meaning: "tavern", "inn" and "pub" land next to each other, so Marinara can look nearby instead of needing the exact word.',
  ],
  [
    "AB8",
    "Reading pictures vs making them",
    "conversation/emoji-stickers-gifs.md",
    "Describe emojis and stickers",
    "looks at each picture and writes a short description",
    "Some models can look at a picture and describe it (Image reading). Making new pictures is a separate kind of service (Image generation). A chat model that can read pictures still can't paint one.",
    "One friend can describe a painting to you; another can paint one. Different skills, often different people.",
  ],
  [
    "AB9",
    "Prompts and presets",
    "prompts/presets.md",
    "",
    "A preset is a saved blueprint for the prompt",
    'Every reply, Marinara hands the model a script: the rules, the character sheet, the story so far, then "your line". That script is the prompt, and a preset decides what goes in it and in what order. Peek prompt in a chat shows the real one.',
    "A preset is the stage manager's running order: who's introduced first, which notes go where, and when the actor gets their cue.",
  ],
  [
    "AB10",
    "Temperature and other dials",
    "prompts/generation-parameters.md",
    "Each parameter in plain language",
    "Lower is more focused and predictable",
    "Temperature is how adventurous the model is. Low plays it safe and can repeat itself; high surprises you and sometimes goes off the rails. Most people never need the other dials; the defaults are fine.",
    "A cook with the spice jar: low temperature sticks to the recipe, high tries something new every time, not always something good.",
  ],
  [
    "AB11",
    "Set up a model (optional)",
    "connections/connecting-to-a-provider.md",
    "Adding an account",
    "get an API key from a service you want to use",
    "Pick a service, paste its key, and test it. No account? The Built-in model runs on your computer for free. Not ready yet? That's fine: choose Not now, and everything else still works except chatting.",
    "Hiring your actor. You can do it now, or later from Library, Connections.",
  ],
  [
    "AB12",
    "Meet Professor Mari",
    "home/professor-mari.md",
    "",
    "She explains the app, helps you set it up",
    "Professor Mari has read every guide in this app. Ask her anything in plain words, or have her build characters and lorebooks with you. She talks through your model, so she needs a working connection to answer.",
    "A tutor who has read the whole manual and doesn't mind silly questions.",
  ],
];

const DEEP: Partial<Record<GuideQuestGroupId, Row[]>> = {
  deepConversation: [
    [
      "DC1",
      "How characters pick stickers and emojis",
      "conversation/emoji-stickers-gifs.md",
      "Selection preferences",
      "",
      "Semantic (default) ranks them by meaning with a small model on your computer, for free. Tool-call has your chosen model pick, smarter but a call each reply. Random is cheapest and least fitting. Descriptions help: used for ranking they cost nothing; shown to the model they add tokens but teach it that :fine: is sarcastic; sending the pictures needs a vision model.",
      "Open a Conversation's sticker tab, then the gear, and switch to Tool-call for a few replies.",
    ],
    [
      "DC2",
      "Autonomous messages and schedules",
      "conversation/schedules.md",
      "Turn on autonomous messages",
      "",
      "Characters can text first. The check-in limit sets how often; the schedule decides when they're busy, asleep or free, which is why a character stays quiet at night.",
      "Turn on autonomous messages in a Conversation and give the character a schedule.",
    ],
    [
      "DC3",
      "Character exchanges in group conversations",
      "chats/group-chats.md",
      "Character Exchanges (Conversation)",
      "",
      "Characters reply to each other, not only to you. Livelier group chats, more tokens per turn.",
      "Turn it on in a group Conversation and say something that invites a debate.",
    ],
    [
      "DC4",
      "Daily summaries",
      "agents/memory.md",
      "Automatic Summarization (Conversation)",
      "",
      "Conversations summarize each day. You choose when a day ends and can fill in missing days. A short daily summary keeps months of texting in memory for a fraction of the tokens.",
      "Open a Conversation's summaries and read yesterday's.",
    ],
    [
      "DC5",
      "Cross-chat awareness and linked-chat tags",
      "chats/connected-chats.md",
      "Cross-Chat Awareness",
      "",
      "A character remembers its other Conversations (on by default). Linked to a story chat, it can send a one-time influence tag, a lasting note tag (listed under Conversation Notes), and the story character can step out with an ooc tag.",
      "Link a Conversation to a Roleplay and tell the character something to remember there.",
    ],
    [
      "DC6",
      "A different bio per chat, and characters editing their own",
      "conversation/profiles.md",
      "Chat-specific About Me overrides",
      "",
      "Give a character a different About Me in one chat. With the update_about_me tool, a character can change its own bio: publicly (you approve first) or only privately.",
      "Write a chat-specific About Me for one of your characters.",
    ],
    [
      "DC7",
      "Schedule AI",
      "conversation/schedules.md",
      "Schedule AI: redraft the week",
      "",
      "Have the model redraft a character's week: Rewrite (fresh), Adjust (keep most, apply your note), Vary (clearly different but believable) or Repair (fix gaps).",
      "Open Schedules and try Vary on one character.",
    ],
    [
      "DC8",
      "Calls: soundboard and video presence",
      "conversation/calls.md",
      "Soundboard",
      "",
      "Characters can play sounds in a call, including your own uploads. Character video presence swaps the still avatar for looping clips: idle, talking, laughing and more.",
      "Upload a sound to the soundboard, or generate an Idle clip for a character.",
    ],
    [
      "DC9",
      "Characters starting games",
      "conversation/table-games.md",
      "Let characters start games on their own",
      "",
      "Each table game has its own switch under Commands. With one on, a character may start UNO, chess or poker by itself; the slash command works either way.",
      "Check which games your characters may start in a Conversation's Commands.",
    ],
  ],
  deepRoleplay: [
    [
      "DR1",
      "Which memory feature?",
      "agents/memory.md",
      "Which memory feature do I want?",
      "",
      "Chat Summary is sticky notes: cheap, and you control them. Memory Recall finds old messages by meaning and works with the built-in embedding model. Advanced Memory remembers by scene, per character, for very long stories, with more setup.",
      "Turn on Memory Recall in a long Roleplay and ask about something from early on.",
      { kind: "chat-tool", tool: "memory-recall" },
    ],
    [
      "DR2",
      "Group chats: Merged or Individual",
      "chats/group-chats.md",
      "Choose who speaks",
      "",
      "Merged writes one combined reply; Individual has each character answer in turn. Automate active characters asks a Decision model who's in the scene instead of you ticking them. Name Prefix History fixes mixed-up speakers.",
      "Switch a group chat between Merged and Individual and compare a reply.",
    ],
    [
      "DR3",
      "Images for a text-only model",
      "prompts/generation-parameters.md",
      "Image captioning",
      "",
      "Image captioning describes each picture in words so any model can follow it. A vision model sees the picture itself. Captioning costs a call; vision costs image tokens.",
      "Send a picture to a text-only model with captioning on.",
    ],
    [
      "DR4",
      "Lorebook activation: keywords, meaning or a question",
      "lorebooks/entries.md",
      "Decision activation",
      "",
      'Keywords are exact and free. Vectors match by meaning and need embeddings. A Decision statement ("the party is in the castle") asks your Decision model. Active Context shows which entries made it in and which were skipped for budget.',
      "Give one entry a Decision statement and watch it in Active Context.",
      panel("lorebooks"),
    ],
    [
      "DR5",
      "Agents before or after the reply",
      "agents/agents-overview.md",
      "When agents run",
      "",
      "Trackers run after the reply because they read it. Directors run before because they shape it, so they add to the wait. Knowing which is which explains slow replies.",
      "Open an agent's settings in a chat and check its phase.",
      panel("agents"),
    ],
    [
      "DR6",
      "Backgrounds that follow the story",
      "roleplay/backgrounds.md",
      "Backgrounds at a glance",
      "",
      "Pinned places reuse your picture whenever the story returns there. Gallery backgrounds are picked from what you have. Painted ones are made new. In the new layout, Decision checks notice a new place or new weather every reply.",
      "Pin a background to a place in a Roleplay.",
    ],
    [
      "DR7",
      "HUD lock mode and the State Editor",
      "roleplay/hud-and-trackers.md",
      "Lock mode",
      "",
      "Lock a tracker value that keeps drifting, and the next automatic run leaves it alone. The State Editor edits the whole state by hand.",
      "Lock one HUD value in a Roleplay with trackers.",
    ],
    [
      "DR8",
      "Echo Chamber",
      "roleplay/getting-started.md",
      "Echo Chamber",
      "",
      "A live audience reacting to your scene like a stream chat, in its own movable window. It reads whispers too.",
      "Turn on the Echo Chamber agent in a Roleplay.",
    ],
    [
      "DR9",
      "Video clips in replies",
      "roleplay/getting-started.md",
      "Video clips",
      "",
      "With [video: …] a character asks for a short clip of a key moment instead of a still picture, when the moment is about motion. Needs Illustrator with a video connection.",
      "Turn on Video clips in a Roleplay with Illustrator set up.",
    ],
    [
      "DR10",
      "A reference lorebook for one agent",
      "agents/agents-overview.md",
      "Give one agent a reference lorebook",
      "",
      "Give one agent its own lorebook in one chat (combat rules only for the combat agent), without adding it to the main reply.",
      "Attach a lorebook to one agent in a chat.",
    ],
  ],
  deepGame: [
    [
      "DG1",
      "Story style, rating and boundaries",
      "game/getting-started.md",
      "Story style, violence and content boundaries",
      "",
      "What each setup field changes in how the game master tells the story, and how to change them mid-game.",
      "Start a game and read the Story style step closely.",
    ],
    [
      "DG2",
      "Dice or story?",
      "game/dice-and-skill-checks.md",
      "How the result is decided",
      "",
      "When a skill check rolls dice and when the story decides, and how a ruleset's checks show up.",
      "Make a skill check in a game and read how it was decided.",
    ],
    [
      "DG3",
      "Game memory",
      "agents/memory.md",
      "In Game Mode",
      "",
      "How Advanced Memory carries scenes across sessions, so a long campaign remembers its past.",
      "Check a campaign's memory after a session ends.",
    ],
    [
      "DG4",
      "Pre-roll your own d20",
      "game/dice-and-skill-checks.md",
      "Pre-roll your own d20",
      "",
      "Queue a d20 from the dice menu, and the next check uses your number instead of a new roll. Modifiers still apply.",
      "Queue a d20 before your next check.",
    ],
    [
      "DG5",
      "Quick-Time Events",
      "game/combat.md",
      "Quick-Time Events",
      "",
      "Timed choices for dodges and chases: faster earns a bigger bonus, too slow costs you. Turn them off on the wizard's Features step for screen readers or untimed play.",
      "Win a QTE, or turn them off for your next game.",
    ],
    [
      "DG6",
      "The GM's hidden notes",
      "game/sessions-and-saves.md",
      "See the GM's hidden notes",
      "",
      "Show Spoilers reveals the world overview, story arc and plot twists the GM keeps private. It spoils the plot, so it's a last resort when the story feels lost.",
      "Find the eye icon in Session History (you don't have to click it).",
    ],
    [
      "DG7",
      "Share the setup that made a game",
      "game/sessions-and-saves.md",
      "Share the setup that created a game",
      "",
      "Copy or download the exact setup behind a campaign that worked. Keys are never included, but your preferences and boundaries are, so read it before you post it.",
      "Open Initial Game Setup in a campaign.",
    ],
    [
      "DG8",
      "Replay or edit a past session",
      "game/sessions-and-saves.md",
      "Replay a session",
      "",
      "Play a past session again, or edit what happened in it.",
      "Open a past session in Session History.",
    ],
    [
      "DG9",
      "Write your own story scripts",
      "extending/writing-story-scripts.md",
      "",
      "",
      "Story scripts, HUD widgets and creature packs let you build pieces for Game Mode yourself. For people who want to make content, not only play it.",
      "Read the first example and imagine one for your campaign.",
    ],
  ],
  deepAnyMode: [
    [
      "DA1",
      "Generation parameters: per account or per chat",
      "prompts/generation-parameters.md",
      "How defaults layer and override",
      "",
      "Account defaults apply everywhere; a chat's own values win for that chat. Temperature and Top P both change randomness, so change one. Max output tokens is a ceiling, not the reply length.",
      "Save one parameter as a connection default.",
    ],
    [
      "DA2",
      "Function calling",
      "extending/custom-tools.md",
      "Turn on tools for a chat",
      "",
      "Tools let a model look things up or act during a reply. More tools means more instructions, and some models get confused, so turn on only the ones a chat needs.",
      "Turn on tool use in one chat and give it one tool.",
    ],
    [
      "DA3",
      "Translation",
      "integrations/message-translation.md",
      "Turn on automatic translation",
      "",
      "Translate only what you read, or also what you send, and choose which service does it.",
      "Translate one message in a chat.",
    ],
    [
      "DA4",
      "Models for each job",
      "connections/connecting-to-a-provider.md",
      "Choosing the model for each job",
      "",
      "Helper jobs (agents, summaries, decisions) are often fine on a cheaper model; Main needs your best. An If it fails model takes over when one breaks.",
      "Give the Agents job a cheaper model than Main.",
      panel("connections"),
    ],
    [
      "DA5",
      "Decision thresholds and time limits",
      "connections/decision-models.md",
      "Thresholds",
      "",
      "A higher threshold means fewer false yeses but more missed ones. Time limits keep a slow model from holding up the reply. Plan for wrong answers.",
      "Look at a decision's score in Peek prompt's Decision diagnostics.",
    ],
  ],
  deepCards: [
    [
      "DK1",
      "Card CSS in Creator's Notes",
      "appearance/card-css-theming.md",
      "How Card Theming works",
      "",
      "A style block in a card's Creator's Notes restyles that character's messages: name colour, bubble, font, even the background. It's off until you pick a Card Theming mode in Chat Settings, Characters (Party in Game): Exclusive (each character's CSS touches only their own messages, best for groups) or Chat (reaches the whole chat area, best for one-on-one). @chat-mode rules aim at one mode. Scripts and anything outside the chat are stripped.",
      "Give a character a coloured name in Creator's Notes and turn on Exclusive.",
      panel("characters"),
    ],
    [
      "DK2",
      "Card field alternatives",
      "characters/creating-and-editing-characters.md",
      "Use an alternative field in selected chats",
      "",
      'One card, a different description, backstory or look in chosen chats (a "Young" version, an AU). Better than copying the card, because fixes to the original reach every chat.',
      "Add an alternative backstory and use it in one chat.",
      panel("characters"),
    ],
    [
      "DK3",
      "System prompt, post-history or depth prompt",
      "characters/creating-and-editing-characters.md",
      "Advanced tab",
      "",
      "Three places to steer one character. System Prompt sits with the character's block. Post-History Instructions land right before the model writes, the strongest spot. A Depth Prompt slips a reminder a few messages back (4 by default): quieter, but hard to forget.",
      "Add a one-line Post-History Instruction to a character.",
      panel("characters"),
    ],
    [
      "DK4",
      "Version history",
      "characters/creating-and-editing-characters.md",
      "Version history",
      "",
      "Every save is a version you can restore, and card changes from an agent wait for your review. Experimenting with a card stops being risky.",
      "Restore an older version of a character.",
      panel("characters"),
    ],
    [
      "DK5",
      "Character-scoped regex",
      "extending/regex-scripts.md",
      "The per-chat Scoped Regex Scripts setting",
      "",
      "Find-and-replace scripts that belong to one character. They do nothing until Scoped Regex Scripts in Chat Settings is Exclusive (that character's messages) or Chat (every message). For a speech quirk or custom formatting.",
      "Give a character a regex script and set the chat to Exclusive.",
    ],
    [
      "DK6",
      "Phonetic names",
      "media/tts-setup.md",
      "Phonetic name (pronunciation in calls)",
      "",
      "Spell how a name should sound in Conversation calls. Calls only: Speak and Game narration ignore it.",
      "Add a phonetic name to a character with a tricky name.",
    ],
  ],
  deepLore: [
    [
      "DL1",
      "Probability and timing",
      "lorebooks/entries.md",
      "Probability and timing",
      "",
      "Four timers make lore feel alive. Sticky keeps a revealed secret in for a few messages, Cooldown stops an omen firing every turn, Delay hides a twist until later, Ephemeral fires an intro once. A 25% probability keeps rumours occasional.",
      "Give one entry a Cooldown of 5.",
      panel("lorebooks"),
    ],
    [
      "DL2",
      "Groups and stable picks",
      "lorebooks/entries.md",
      "Groups, filters and other options",
      "mutually exclusive",
      "Entries in one Group are alternatives: only one fires per reply (three kinds of weather). The Stable lorebook picks switch keeps the same winner in a chat while the candidates stay the same, instead of re-rolling every reply. Stable for consistency, re-roll for variety.",
      "Put two alternative entries in the same Group.",
      panel("lorebooks"),
    ],
    [
      "DL3",
      "Outlet entries",
      "lorebooks/entries.md",
      "Outlet",
      "",
      "Position Outlet puts an entry only where {{outlet::name}} sits in your preset, instead of the usual spots. For lore that must land in one exact place.",
      "Make an Outlet entry and place its macro in a preset.",
      panel("lorebooks"),
    ],
    [
      "DL4",
      "Recursive scanning",
      "lorebooks/token-budgets.md",
      "Recursive scanning",
      "",
      "Lets one entry's text trigger related entries: a city pulls in its ruler. Off by default, with a per-entry Recursion switch and a Max Depth. It costs budget, so turn it on only for chains you want.",
      "Turn on Recursive for one lorebook.",
      panel("lorebooks"),
    ],
    [
      "DL5",
      "Context filters",
      "lorebooks/entries.md",
      "Groups, filters and other options",
      "Context filters",
      "Limit an entry to certain characters, tags or generation types, or scan the card's description for its keys. In Individual group replies a character filter keeps a secret out of everyone else's replies; in Merged replies it doesn't.",
      "Filter a secret entry to the one character who knows it.",
      panel("lorebooks"),
    ],
    [
      "DL6",
      "The include macro",
      "prompts/macros.md",
      "Lorebook include macro",
      "",
      "{{include::Rules of the arena}} pastes an entry's text wherever you write it: in other entries, prompts or cards. One copy of house rules to edit. {{include::Book::Entry}} works even from a book that isn't in the chat.",
      "Include one entry inside another.",
    ],
    [
      "DL7",
      "Activation stats",
      "configuration/features.md",
      "Lorebook activation stats",
      "",
      "A switch that records which entries actually fired, so the lorebook editor can sort and filter by use. It finds dead entries that never trigger.",
      "Turn it on, chat a bit, then sort a lorebook by use.",
      settings("advanced"),
    ],
    [
      "DL8",
      "The Keyword test tool",
      "lorebooks/entries.md",
      "The Keyword test tool",
      "",
      "Paste sample text and see which entries would fire, without sending anything. Faster than testing in a chat.",
      "Test a sentence against one of your lorebooks.",
      panel("lorebooks"),
    ],
  ],
  deepPrompts: [
    [
      "DP1",
      "Weighted random",
      "prompts/macros.md",
      "Weighted choices",
      "",
      "{{random::Common event@1::Rare event@0.25}} makes one option four times as likely as the other. For random events that shouldn't be equally likely.",
      "Add a weighted random line to a preset or entry.",
    ],
    [
      "DP2",
      "Chat variables",
      "prompts/macros.md",
      "Dynamic variables",
      "",
      "{{setvar}}, {{getvar}}, {{incvar}} and friends store values that survive across turns and restarts, separately in each chat. A day counter, a mood score, a quest flag.",
      "Keep a day counter with {{incvar::day}}.",
    ],
    [
      "DP3",
      "Preset variable kinds",
      "prompts/preset-variables.md",
      "The kinds of preset variable",
      "",
      "A preset can ask questions when a chat starts: an on/off Toggle, a Multi-Select, or a Random Pick (one random option per chat, or with Multi-Select, a fresh draw from your pool each reply).",
      "Add a Random Pick variable to a preset.",
      panel("presets"),
    ],
    [
      "DP4",
      "Decision blocks with timers",
      "prompts/conditional-prompts.md",
      "Sticky and cooldown",
      "",
      '{{#if decision:"a fight starts" sticky:3 cooldown:5}} asks the Decision model, keeps a yes for 3 turns, then rests for 5. decision_choice: picks one of several answers. Test decisions in Peek prompt runs them without writing a reply.',
      "Write one decision block with sticky:2.",
    ],
    [
      "DP5",
      "Decision blocks and prompt caching",
      "prompts/presets.md",
      "Decision blocks and prompt caching",
      "",
      "Put blocks that change often late in the prompt. A change near the top stops the service reusing everything after it, so you lose most cache savings.",
      "Move a changing block below the chat history.",
      panel("presets"),
    ],
    [
      "DP6",
      "Group blocks",
      "prompts/conditional-prompts.md",
      "Group blocks for multiple characters",
      "",
      'A [ line, some text with {{char}}, and a ] line repeat once per character in a group chat: "each character\'s attitude" without writing it out for everyone.',
      "Add a group block to a group chat's preset.",
    ],
    [
      "DP7",
      "Wrap format",
      "prompts/presets.md",
      "Wrap formats",
      "",
      "XML tags (the default), Markdown headings, or nothing around each preset section, plus Send without wrapper for one block. Switch only if a model behaves better without tags.",
      "Compare a reply with XML and with Markdown.",
      panel("presets"),
    ],
    [
      "DP8",
      "Prefills",
      "prompts/generation-parameters.md",
      "Prefills and thinking tags",
      "",
      "Assistant Prefill puts words in the model's mouth at the start of its reply; Reasoning Prefill does the same for its hidden thinking (only some models). Some services refuse a prompt that ends on the AI's words, and Marinara moves the prefill for them.",
      'Try a short prefill like "*" with a model that supports it.',
    ],
    [
      "DP9",
      "Exclude Past Reasoning",
      "prompts/generation-parameters.md",
      "Exclude Past Reasoning",
      "",
      "On by default: old thinking isn't fed back, which saves tokens and stops loops. Turned off, it replays the last few reasoning blocks.",
      "Find the switch in a chat's parameters.",
    ],
    [
      "DP10",
      "Custom Parameters and Service Tier",
      "prompts/generation-parameters.md",
      "Custom Parameters",
      "",
      "Raw JSON for settings Marinara has no field for, per account or per chat. Service Tier (OpenRouter, NanoGPT) trades price for speed: Flex is cheaper and slower, Priority faster and dearer.",
      "Look at your provider's docs for one extra parameter.",
    ],
    [
      "DP11",
      "Context message limit",
      "prompts/generation-parameters.md",
      "Context message limit",
      "",
      "Send only the last N messages: cheaper and faster, but it forgets more. In Roleplay with Advanced Memory Recall it's ignored, and that feature's compression size is the dial instead.",
      "Set a limit of 100 in a long chat and compare the cost.",
    ],
  ],
  deepMessages: [
    [
      "DM1",
      "Whispers",
      "roleplay/getting-started.md",
      "Whispers and secrets",
      "",
      '[whisper: character="name" text="…"] reaches only that character and the narrator. Reveal shows it to you without telling anyone else. You can whisper in your own messages too. For secrets, visions and asides.',
      "Whisper something to one character in a group Roleplay.",
    ],
    [
      "DM2",
      "Private notes",
      "roleplay/getting-started.md",
      "Your private notes",
      "",
      '[notes: content="…"] reaches only the narrator. A note on one message stays private, or goes to one chosen character. For steering without the cast hearing.',
      "Leave the narrator a private note.",
    ],
    [
      "DM3",
      "Hide a message from some characters",
      "chats/messages.md",
      "Hide a message from the AI",
      "",
      "In a Roleplay group, Hide from AI lets you pick which characters can't see a message (a crossed-eye marker). /hide does ranges.",
      "Hide one message from one character.",
    ],
    [
      "DM4",
      "Interruptions",
      "roleplay/getting-started.md",
      "Character interruptions",
      "",
      '[interrupt: part="…"] lets a character cut off your last message mid-sentence. Restore original message undoes it.',
      "Turn on Interruptions and write a long speech.",
    ],
    [
      "DM5",
      "HTML artifacts",
      "roleplay/getting-started.md",
      "Artifacts on demand",
      "",
      '[html: prompt="…"] or /html makes an in-world object: a letter, a sign, a terminal. Each is its own model request (up to 3 per reply); the free Documents kinds are instant for plain pages.',
      "Ask for a handwritten letter with /html.",
    ],
    [
      "DM6",
      "Empty Send retries",
      "chats/messages.md",
      "Retry with an empty Send",
      "",
      "Send with an empty box retries after your last message, or in Roleplay starts a new turn.",
      "Press Send with an empty box.",
    ],
    [
      "DM7",
      "The branch graph",
      "chats/branches.md",
      "See the branch graph",
      "",
      "See every branch of a chat as a graph, and import a chat file as a new branch of an existing chat.",
      "Open the branch graph of a chat with branches.",
    ],
    [
      "DM8",
      "Recover deleted messages",
      "configuration/features.md",
      "Recover deleted chat messages",
      "",
      "A switch that keeps deleted messages so you can bring them back.",
      "Turn it on before your next big cleanup.",
      settings("advanced"),
    ],
    [
      "DM9",
      "Reasoning and notes in exports",
      "chats/export-import.md",
      "Include reasoning and private notes in exports",
      "",
      "Exports leave out thinking and private notes unless you ask for them.",
      "Export a chat with reasoning included.",
    ],
  ],
  deepAgents: [
    [
      "DX1",
      "Activation keywords for custom agents",
      "agents/custom-agents.md",
      "Activation Keywords",
      "",
      "The agent runs only when a keyword appears in the last few messages. Saves tokens on agents that matter only in some scenes.",
      "Give a custom agent one keyword.",
      panel("agents"),
    ],
    [
      "DX2",
      "Named prompt options",
      "agents/custom-agents.md",
      "Named prompt options",
      "",
      "One agent, several prompt variants. Each chat picks one from Prompt Mode without editing the agent.",
      "Add a second prompt option to a custom agent.",
      panel("agents"),
    ],
    [
      "DX3",
      "Shuffle and fallbacks",
      "connections/organizing-connections.md",
      "Shuffle",
      "",
      "A pool of models, one picked at random per reply, plus an If it fails model as a backup (replies show a Fallback label). The Retry failed provider calls switch retries short outages when there's no fallback.",
      "Add two models to Shuffle and pick Shuffle in a chat.",
      panel("connections"),
    ],
    [
      "DX4",
      "Claude subscription caching",
      "connections/subscription-clis.md",
      "Extended token caching",
      "",
      "Extended token caching keeps the prompt cached for an hour, through long pauses between messages. Fast mode should stay off.",
      "Turn on extended caching if you use a Claude subscription.",
    ],
  ],
  deepMedia: [
    [
      "DV1",
      "Speech filters and emotion directions",
      "media/tts-setup.md",
      "Text filters and emotion directions",
      "",
      "Skip hidden tags, code or bracketed notes when speaking, or send [Low, steady voice] directions to the voice. Emotion directions override the bracket skip, so pick one.",
      "Turn on emotion indicators and play a line.",
    ],
    [
      "DV2",
      "Random NPC voices",
      "media/tts-setup.md",
      "Random NPC voices (Game Mode only)",
      "",
      "Game Mode gives characters without a voice their own random voice, so a crowd doesn't all sound alike.",
      "Turn it on for your next game.",
    ],
    [
      "DV3",
      "Style profiles and the Test bench",
      "media/style-profiles.md",
      "The Test bench",
      "",
      "Save an image style once and test it side by side before using it everywhere.",
      "Run one prompt through two profiles on the Test bench.",
    ],
    [
      "DV4",
      "Queued media requests",
      "media/image-providers.md",
      "Queue media generation requests",
      "",
      "Queue several picture or video requests instead of waiting for each. Prompt overrides let you edit the templates behind them.",
      "Queue two pictures at once.",
    ],
    [
      "DV5",
      "DJ Mari and music folders",
      "media/music.md",
      "DJ Mari: AI playlist maker",
      "",
      "An AI playlist maker, and a custom music folder for a chat or a character.",
      "Ask DJ Mari for a playlist.",
    ],
    [
      "DV6",
      "Noodle carryover",
      "agents/noodle-settings.md",
      "Carryover",
      "",
      "Noodle activity flows into chats: choose the modes, how many hours back and how many items, capped at 8,192 tokens.",
      "Turn on carryover for Conversations.",
    ],
  ],
  deepThemes: [
    [
      "DT1",
      "Message templates in a theme",
      "appearance/theme-author-guide.md",
      "Message template (HTML)",
      "",
      "A theme can add an HTML strip to every message, filled with {{char}}, the message number and more. For status boxes CSS alone can't make.",
      "Read the example and change one word.",
    ],
    [
      "DT2",
      "Day and night",
      "appearance/theme-author-guide.md",
      "Day and night",
      "",
      "The colour scheme can follow the clock, and a theme can style both looks.",
      "Set Color Scheme to follow the time of day.",
      settings("appearance"),
    ],
    [
      "DT3",
      "Per-chat looks",
      "appearance/theme-author-guide.md",
      "Per-chat looks",
      "",
      "Hooks such as data-chat-id let a theme restyle one chat or one mode only.",
      "Read the hooks table and pick one you'd use.",
    ],
    [
      "DE1",
      "Custom tools",
      "extending/custom-tools.md",
      "Choose an execution type",
      "",
      "Give characters a tool that returns a fixed result, calls a webhook, or runs a script.",
      "Make a tool with a static result.",
    ],
    [
      "DE2",
      "Personal extensions",
      "extending/personal-extensions.md",
      "What an extension can do",
      "",
      "Small add-ons of your own, with revisions and recovery if one breaks.",
      "Ask Professor Mari for a tiny extension.",
    ],
    [
      "DE3",
      "Home Assistant automations",
      "integrations/home-assistant.md",
      "Control Marinara from automations",
      "",
      "Characters can trigger smart-home actions, and your automations can send a message or start a reply. A chat can also mirror to Discord, and the Haptic Feedback agent drives a device.",
      "Read which entities the integration adds.",
    ],
  ],
};

/** Deep dive groups in list order, with their names. */
export const DEEP_DIVE_GROUPS = [
  { id: "deepConversation", name: "Conversation" },
  { id: "deepRoleplay", name: "Roleplay" },
  { id: "deepGame", name: "Game" },
  { id: "deepAnyMode", name: "Any mode" },
  { id: "deepCards", name: "Characters and cards" },
  { id: "deepLore", name: "Lorebook tricks" },
  { id: "deepPrompts", name: "Prompt and macro tricks" },
  { id: "deepMessages", name: "Message tricks" },
  { id: "deepAgents", name: "Agents and connections" },
  { id: "deepMedia", name: "Voice, pictures and music" },
  { id: "deepThemes", name: "Themes and extending" },
] as const satisfies readonly { id: GuideQuestGroupId; name: string }[];

export type DeepDiveGroupId = (typeof DEEP_DIVE_GROUPS)[number]["id"];

const toQuest =
  (set: GuideQuestSet, group: GuideQuestGroupId) =>
  ([id, title, guide, heading, quote, note, more, show]: Row): GuideQuest => ({
    id,
    set,
    group,
    title,
    guide,
    heading,
    quote,
    note,
    more,
    show,
    special: id === "AB11" ? "setup" : id === "AB12" ? "mari" : undefined,
  });

export const AI_BASICS_QUESTS: readonly GuideQuest[] = BASICS.map(toQuest("basics", "aiBasics"));

export const DEEP_DIVES: readonly GuideQuest[] = DEEP_DIVE_GROUPS.flatMap((group) =>
  (DEEP[group.id] ?? []).map(toQuest("deep", group.id)),
);

export const GUIDE_QUESTS: readonly GuideQuest[] = [...AI_BASICS_QUESTS, ...DEEP_DIVES];
export const GUIDE_QUEST_BY_ID = new Map(GUIDE_QUESTS.map((quest) => [quest.id, quest]));

/** Groups whose every quest is done; "deepAll" once every deep dive is (it has no quests of its own). */
export function finishedGuideQuestGroups(done: ReadonlySet<string>): GuideQuestGroupId[] {
  const finished = GUIDE_QUEST_GROUPS.map((group) => group.id as GuideQuestGroupId).filter((group) => {
    const quests = group === "deepAll" ? DEEP_DIVES : GUIDE_QUESTS.filter((quest) => quest.group === group);
    return quests.length > 0 && quests.every((quest) => done.has(quest.id));
  });
  return finished;
}

export const guideQuestKey = (id: string, part: "title" | "note" | "more") => `guideQuests.${id.toLowerCase()}.${part}`;
export const deepDiveGroupKey = (group: DeepDiveGroupId) => `guideQuests.group.${group}`;

/** The next AI basics quest after `id`, or null after the last. */
export function nextBasicsQuest(id: string): GuideQuest | null {
  const at = AI_BASICS_QUESTS.findIndex((quest) => quest.id === id);
  return at >= 0 ? (AI_BASICS_QUESTS[at + 1] ?? null) : null;
}

/** Which Things to try trails and chat mode each deep dive group goes with, for ranking. */
const GROUP_INTERESTS: Record<DeepDiveGroupId, { mode?: "conversation" | "roleplay" | "game"; trails: string[] }> = {
  deepConversation: { mode: "conversation", trails: ["conversation"] },
  deepRoleplay: { mode: "roleplay", trails: ["roleplay", "story"] },
  deepGame: { mode: "game", trails: ["game"] },
  deepAnyMode: { trails: ["prompts"] },
  deepCards: { trails: ["characters"] },
  deepLore: { trails: ["lore"] },
  deepPrompts: { trails: ["prompts"] },
  deepMessages: { mode: "roleplay", trails: ["story"] },
  deepAgents: { trails: ["prompts", "roleplay"] },
  deepMedia: { trails: ["extras", "gallery"] },
  deepThemes: { trails: ["look", "themes"] },
};

export interface DeepDiveInterest {
  /** Chats per mode. */
  modes: { conversation: number; roleplay: number; game: number } | null;
  /** Things to try task id -> when it was done (0 = before the list existed). */
  thingsDone: Readonly<Record<string, number>>;
  /** Things to try task id -> its trail. */
  trailOf: (taskId: string) => string | undefined;
  /** Deep dive id -> when it was done. */
  deepDone: Readonly<Record<string, number>>;
}

const RECENT_MS = 24 * 60 * 60 * 1000;

/**
 * Deep dive groups ranked by what this person does most, like Things to try: the mode they make most
 * chats in, the trails they've done most in, and what they did in the last day. Ties keep list order.
 */
export function rankDeepDiveGroups(interest: DeepDiveInterest, now = Date.now()): DeepDiveGroupId[] {
  const trailCounts = new Map<string, number>();
  const recentTrails = new Set<string>();
  for (const [id, at] of Object.entries(interest.thingsDone)) {
    const trail = interest.trailOf(id);
    if (!trail) continue;
    trailCounts.set(trail, (trailCounts.get(trail) ?? 0) + 1);
    if (at && now - at <= RECENT_MS) recentTrails.add(trail);
  }
  const recentGroups = new Set<string>();
  for (const [id, at] of Object.entries(interest.deepDone)) {
    if (at && now - at <= RECENT_MS) {
      const quest = GUIDE_QUEST_BY_ID.get(id);
      if (quest) recentGroups.add(quest.group);
    }
  }
  const modes = interest.modes;
  const totalChats = modes ? modes.conversation + modes.roleplay + modes.game : 0;
  const score = (group: DeepDiveGroupId) => {
    const { mode, trails } = GROUP_INTERESTS[group];
    let value = trails.reduce((sum, trail) => sum + (trailCounts.get(trail) ?? 0), 0);
    if (mode && modes && totalChats > 0) value += 10 * (modes[mode] / totalChats);
    if (mode && modes && modes[mode] === 0) value -= 5;
    if (trails.some((trail) => recentTrails.has(trail))) value += 4;
    if (recentGroups.has(group)) value += 6;
    return value;
  };
  return DEEP_DIVE_GROUPS.map((group, index) => ({ id: group.id, index, value: score(group.id) }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .map((entry) => entry.id);
}

/** The next deep dives to suggest: open ones from the top-ranked groups, one per group first. */
export function pickDeepDives(
  done: ReadonlySet<string>,
  skipped: ReadonlySet<string>,
  groups: readonly DeepDiveGroupId[],
  count = 1,
): GuideQuest[] {
  const queues = groups.map((group) =>
    DEEP_DIVES.filter((quest) => quest.group === group && !done.has(quest.id) && !skipped.has(quest.id)),
  );
  const picked: GuideQuest[] = [];
  for (let round = 0; picked.length < count && queues.some((queue) => queue.length > round); round++) {
    for (const queue of queues) {
      const quest = queue[round];
      if (quest) picked.push(quest);
      if (picked.length >= count) break;
    }
  }
  return picked;
}

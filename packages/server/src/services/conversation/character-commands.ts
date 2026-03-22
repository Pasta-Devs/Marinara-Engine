// ──────────────────────────────────────────────
// Service: Character Commands
// ──────────────────────────────────────────────
// Parses hidden commands from character messages in Conversation mode.
// Commands are embedded by the LLM in the response and stripped before
// the message is shown to the user.
//
// Supported commands:
// - [schedule_update: status="online", activity="free time"]
// - [cross_post: target="group"] or [cross_post: target="CharName"]
// - [selfie] or [selfie: context="description of the selfie"]
// - [memory: target="CharName", summary="description of the memory"]
// - [scene: scenario="...", background="...", plan="..."] (initiate a mini-roleplay scene)
// - <influence>text</influence> (OOC influence for connected roleplay)
//
// Assistant commands (Professor Mari):
// - [create_persona: name="...", description="...", personality="...", appearance="..."]
// - [create_character: name="...", description="...", personality="...", first_message="...", scenario="..."]
// - [create_chat: character="...", mode="conversation|roleplay"]
// - [navigate: panel="...", tab="..."]

export interface ScheduleUpdateCommand {
  type: "schedule_update";
  status?: "online" | "idle" | "dnd" | "offline";
  activity?: string;
  duration?: string;
}

export interface CrossPostCommand {
  type: "cross_post";
  /** "group" to post in a group chat, or a character/chat name for DM */
  target: string;
}

export interface SelfieCommand {
  type: "selfie";
  /** Optional context hint from the character about the selfie */
  context?: string;
}

export interface MemoryCommand {
  type: "memory";
  /** Target character name */
  target: string;
  /** Short description of the memory */
  summary: string;
}

export interface SceneCommand {
  type: "scene";
  /** Description of the scene/scenario the character wants to play out */
  scenario: string;
  /** Optional background suggestion */
  background?: string;
  /** Optional plot plan / outline for how the scene unfolds */
  plan?: string;
}

export interface InfluenceCommand {
  type: "influence";
  /** The OOC influence text to inject into the connected roleplay */
  content: string;
}

// ── Assistant commands (Professor Mari) ──

export interface CreatePersonaCommand {
  type: "create_persona";
  name: string;
  description?: string;
  personality?: string;
  appearance?: string;
}

export interface CreateCharacterCommand {
  type: "create_character";
  name: string;
  description?: string;
  personality?: string;
  firstMessage?: string;
  scenario?: string;
}

export interface CreateChatCommand {
  type: "create_chat";
  character: string;
  mode?: "conversation" | "roleplay";
}

export interface NavigateCommand {
  type: "navigate";
  panel: string;
  tab?: string;
}

export type AssistantCommand = CreatePersonaCommand | CreateCharacterCommand | CreateChatCommand | NavigateCommand;

export type CharacterCommand =
  | ScheduleUpdateCommand
  | CrossPostCommand
  | SelfieCommand
  | MemoryCommand
  | SceneCommand
  | InfluenceCommand
  | AssistantCommand;

/** Regex patterns for each command type */
const SCHEDULE_UPDATE_RE = /\[schedule_update:\s*([^\]]+)\]/gi;
const CROSS_POST_RE = /\[cross_post:\s*target="([^"]+)"\]/gi;
const SELFIE_RE = /\[selfie(?::\s*context="([^"]*)")?\]/gi;
const MEMORY_RE = /\[memory:\s*target="([^"]+)"\s*,\s*summary="([^"]+)"\]/gi;
const SCENE_RE = /\[scene:\s*([^\]]+)\]/gi;
const INFLUENCE_RE = /<influence>([\s\S]*?)<\/influence>/gi;

// Assistant command regexes
const CREATE_PERSONA_RE = /\[create_persona:\s*([^\]]+)\]/gi;
const CREATE_CHARACTER_RE = /\[create_character:\s*([^\]]+)\]/gi;
const CREATE_CHAT_RE = /\[create_chat:\s*([^\]]+)\]/gi;
const NAVIGATE_RE = /\[navigate:\s*([^\]]+)\]/gi;
/**
 * Parse all character commands from a message and return the cleaned message
 * with commands stripped out.
 */
export function parseCharacterCommands(content: string): {
  cleanContent: string;
  commands: CharacterCommand[];
} {
  const commands: CharacterCommand[] = [];

  // Parse schedule_update commands
  for (const match of content.matchAll(SCHEDULE_UPDATE_RE)) {
    const params = match[1]!;
    const cmd: ScheduleUpdateCommand = { type: "schedule_update" };

    const statusMatch = params.match(/status="([^"]+)"/);
    if (statusMatch) {
      const s = statusMatch[1]!.toLowerCase();
      if (["online", "idle", "dnd", "offline"].includes(s)) {
        cmd.status = s as ScheduleUpdateCommand["status"];
      }
    }

    const activityMatch = params.match(/activity="([^"]+)"/);
    if (activityMatch) cmd.activity = activityMatch[1]!;

    const durationMatch = params.match(/duration="([^"]+)"/);
    if (durationMatch) cmd.duration = durationMatch[1]!;

    commands.push(cmd);
  }

  // Parse cross_post commands
  for (const match of content.matchAll(CROSS_POST_RE)) {
    commands.push({ type: "cross_post", target: match[1]! });
  }

  // Parse selfie commands
  for (const match of content.matchAll(SELFIE_RE)) {
    commands.push({ type: "selfie", context: match[1] || undefined });
  }

  // Parse memory commands
  for (const match of content.matchAll(MEMORY_RE)) {
    commands.push({ type: "memory", target: match[1]!, summary: match[2]! });
  }

  // Parse scene commands
  for (const match of content.matchAll(SCENE_RE)) {
    const params = match[1]!;
    const cmd: SceneCommand = { type: "scene", scenario: "" };

    const scenarioMatch = params.match(/scenario="([^"]+)"/);
    if (scenarioMatch) cmd.scenario = scenarioMatch[1]!;

    const bgMatch = params.match(/background="([^"]+)"/);
    if (bgMatch) cmd.background = bgMatch[1]!;

    const planMatch = params.match(/plan="([^"]+)"/);
    if (planMatch) cmd.plan = planMatch[1]!;

    // Only add if we got a scenario
    if (cmd.scenario) commands.push(cmd);
  }

  // Parse influence commands (<influence>text</influence>)
  for (const match of content.matchAll(INFLUENCE_RE)) {
    const text = match[1]!.trim();
    if (text) commands.push({ type: "influence", content: text });
  }

  // Parse assistant commands (Professor Mari)
  for (const match of content.matchAll(CREATE_PERSONA_RE)) {
    const params = match[1]!;
    const cmd: CreatePersonaCommand = { type: "create_persona", name: "" };
    const nameMatch = params.match(/name="([^"]+)"/);
    if (nameMatch) cmd.name = nameMatch[1]!;
    const descMatch = params.match(/description="([^"]+)"/);
    if (descMatch) cmd.description = descMatch[1]!;
    const persMatch = params.match(/personality="([^"]+)"/);
    if (persMatch) cmd.personality = persMatch[1]!;
    const appMatch = params.match(/appearance="([^"]+)"/);
    if (appMatch) cmd.appearance = appMatch[1]!;
    if (cmd.name) commands.push(cmd);
  }

  for (const match of content.matchAll(CREATE_CHARACTER_RE)) {
    const params = match[1]!;
    const cmd: CreateCharacterCommand = { type: "create_character", name: "" };
    const nameMatch = params.match(/name="([^"]+)"/);
    if (nameMatch) cmd.name = nameMatch[1]!;
    const descMatch = params.match(/description="([^"]+)"/);
    if (descMatch) cmd.description = descMatch[1]!;
    const persMatch = params.match(/personality="([^"]+)"/);
    if (persMatch) cmd.personality = persMatch[1]!;
    const fmMatch = params.match(/first_message="([^"]+)"/);
    if (fmMatch) cmd.firstMessage = fmMatch[1]!;
    const scenMatch = params.match(/scenario="([^"]+)"/);
    if (scenMatch) cmd.scenario = scenMatch[1]!;
    if (cmd.name) commands.push(cmd);
  }

  for (const match of content.matchAll(CREATE_CHAT_RE)) {
    const params = match[1]!;
    const cmd: CreateChatCommand = { type: "create_chat", character: "" };
    const charMatch = params.match(/character="([^"]+)"/);
    if (charMatch) cmd.character = charMatch[1]!;
    const modeMatch = params.match(/mode="([^"]+)"/);
    if (modeMatch && (modeMatch[1] === "conversation" || modeMatch[1] === "roleplay")) {
      cmd.mode = modeMatch[1];
    }
    if (cmd.character) commands.push(cmd);
  }

  for (const match of content.matchAll(NAVIGATE_RE)) {
    const params = match[1]!;
    const cmd: NavigateCommand = { type: "navigate", panel: "" };
    const panelMatch = params.match(/panel="([^"]+)"/);
    if (panelMatch) cmd.panel = panelMatch[1]!;
    const tabMatch = params.match(/tab="([^"]+)"/);
    if (tabMatch) cmd.tab = tabMatch[1]!;
    if (cmd.panel) commands.push(cmd);
  }

  // Strip all commands from the visible content
  let cleanContent = content
    .replace(SCHEDULE_UPDATE_RE, "")
    .replace(CROSS_POST_RE, "")
    .replace(SELFIE_RE, "")
    .replace(MEMORY_RE, "")
    .replace(SCENE_RE, "")
    .replace(INFLUENCE_RE, "")
    .replace(CREATE_PERSONA_RE, "")
    .replace(CREATE_CHARACTER_RE, "")
    .replace(CREATE_CHAT_RE, "")
    .replace(NAVIGATE_RE, "")
    .replace(/\n{3,}/g, "\n\n") // collapse excessive newlines left by removals
    .trim();

  return { cleanContent, commands };
}

/**
 * Parse a duration string like "2h", "30m", "1h30m" into minutes.
 * Returns null if unparseable.
 */
export function parseDuration(duration: string): number | null {
  const hourMatch = duration.match(/(\d+)\s*h/i);
  const minMatch = duration.match(/(\d+)\s*m/i);

  let total = 0;
  if (hourMatch) total += parseInt(hourMatch[1]!) * 60;
  if (minMatch) total += parseInt(minMatch[1]!);

  return total > 0 ? total : null;
}

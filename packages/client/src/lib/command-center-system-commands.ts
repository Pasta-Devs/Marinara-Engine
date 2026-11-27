import {
  defineCommand,
  resolveCommandCenterTitles,
  type CommandCenterTitleSource,
  type DeclarativeCommandDefinition,
} from "./command-center-definitions";
import { LIBRARY_SECTION_COMMANDS } from "./library-section-commands";

const AVAILABLE = { status: "available" } as const;

export function createResourceCommandDefinitions(source: CommandCenterTitleSource): DeclarativeCommandDefinition[] {
  const title = resolveCommandCenterTitles(source);

  return [
    defineCommand({
      id: "create-character",
      title: title.createCharacter,
      kind: "action",
      icon: "character",
      aliases: ["new character", "new card"],
      keywords: ["make a character", "new bot"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "create-character" },
    }),
    defineCommand({
      id: "create-persona",
      title: title.createPersona,
      kind: "action",
      icon: "persona",
      aliases: ["new persona", "new profile"],
      keywords: ["make a persona", "my character"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "create-persona" },
    }),
    defineCommand({
      id: "create-lorebook",
      title: title.createLorebook,
      kind: "action",
      icon: "lorebook",
      aliases: ["new lorebook", "new world book", "new world info"],
      keywords: ["make a lorebook", "worldbuilding"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "create-lorebook" },
    }),
    defineCommand({
      id: "create-preset",
      title: title.createPreset,
      kind: "action",
      icon: "preset",
      aliases: ["new preset", "new prompt preset"],
      keywords: ["make a preset", "prompt template"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "create-preset" },
    }),
    defineCommand({
      id: "create-connection",
      title: title.createConnection,
      kind: "action",
      icon: "connection",
      aliases: ["new connection", "add provider"],
      keywords: ["add api key", "connect model"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "create-connection" },
    }),
    defineCommand({
      id: "create-agent",
      title: title.createAgent,
      kind: "action",
      icon: "agent",
      aliases: ["new agent", "add agent"],
      keywords: ["make an agent", "new tool"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "resource", resource: "agent", id: "__new__" } },
    }),
    defineCommand({
      id: "documentation",
      title: title.documentation,
      kind: "navigation",
      icon: "documentation",
      aliases: ["docs", "manual", "guides"],
      keywords: ["how to use", "user guide"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "window", window: "documentation" } },
    }),
    defineCommand({
      id: "help",
      title: title.help,
      kind: "navigation",
      icon: "documentation",
      aliases: ["faq", "support", "getting started"],
      keywords: ["get help", "support"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "docs-viewer", props: { initialDoc: "FAQ.md" } },
    }),
    defineCommand({
      id: "discord",
      title: title.discord,
      kind: "navigation",
      icon: "documentation",
      aliases: ["community server", "community chat", "chat server"],
      keywords: ["join discord", "talk to the community"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "window", window: "discord" } },
    }),
    defineCommand({
      id: "credits",
      title: title.credits,
      kind: "navigation",
      icon: "documentation",
      aliases: ["contributors", "creators", "who made this"],
      keywords: ["thank you", "acknowledgements"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "window", window: "credits" } },
    }),
    defineCommand({
      id: "tutorial",
      title: title.tutorial,
      kind: "navigation",
      icon: "documentation",
      aliases: ["walkthrough", "onboarding", "getting started tour"],
      keywords: ["show the tutorial again", "first steps"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "window", window: "tutorial" } },
    }),
    defineCommand({
      id: "widgets",
      title: title.widgets,
      kind: "navigation",
      icon: "home",
      aliases: ["home widgets", "widget manager", "home tiles", "customize home"],
      keywords: ["add widget", "remove widget", "arrange home"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "window", window: "widgets" } },
    }),
    defineCommand({
      id: "keyboard-shortcuts",
      title: title.keyboardShortcuts,
      kind: "navigation",
      icon: "documentation",
      aliases: ["shortcuts", "hotkeys", "keybindings", "keys"],
      keywords: ["key bindings", "hotkey list"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "keyboard-shortcuts" },
    }),
    defineCommand({
      id: "search-all-chats",
      title: title.searchAllChats,
      kind: "navigation",
      icon: "chats",
      aliases: ["global search", "find message", "search messages", "chat search"],
      keywords: ["find in all chats", "search everything"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "global-chat-search" },
    }),
    defineCommand({
      id: "activity-overview",
      title: title.activityOverview,
      kind: "navigation",
      icon: "chats",
      aliases: ["activity", "stats", "statistics", "play time", "insights"],
      keywords: ["usage stats", "time spent"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "activity-overview" },
    }),
    defineCommand({
      id: "game-assets",
      title: title.gameAssets,
      kind: "resource",
      icon: "game-assets",
      aliases: ["asset browser", "sprites", "backgrounds", "music library"],
      keywords: ["game files", "media library"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "game-assets" } },
    }),
    defineCommand({
      id: "card-browser",
      title: title.cardBrowser,
      kind: "resource",
      icon: "character",
      aliases: ["download cards", "browse bots", "character browser"],
      keywords: ["discover characters", "find bots"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "card-downloads" } },
    }),
    defineCommand({
      id: "lorebook-browser",
      title: title.lorebookBrowser,
      kind: "resource",
      icon: "lorebook",
      aliases: ["download lorebooks", "browse lorebooks", "world info browser"],
      keywords: ["discover lorebooks", "find world info"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "lorebook-downloads" } },
    }),
    defineCommand({
      id: "character-library",
      title: title.characterLibrary,
      kind: "resource",
      icon: "character",
      aliases: ["character cards", "character collection"],
      keywords: ["my characters", "character list"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "character-library" } },
    }),
    defineCommand({
      id: "persona-library",
      title: title.personaLibrary,
      kind: "resource",
      icon: "persona",
      aliases: ["persona cards", "persona collection"],
      keywords: ["my personas", "persona list"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "persona-library" } },
    }),
    defineCommand({
      id: "schedules",
      title: title.schedules,
      kind: "navigation",
      icon: "calendar",
      aliases: ["schedule", "character schedules", "schedule manager", "calendar"],
      keywords: ["routines", "weekly plans", "conversation schedules"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "schedules" } },
    }),
    defineCommand({
      id: "prompt-viewer",
      title: title.promptViewer,
      kind: "navigation",
      icon: "prompt",
      aliases: ["aio", "kolache's aio", "prompt inspector", "inspect prompt", "assembled prompt", "prompt editor"],
      keywords: ["see the prompt", "what the model sees", "prompt order", "summaries export"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "prompt-viewer" } },
    }),
    defineCommand({
      id: "lorebook-library",
      title: title.lorebookLibrary,
      kind: "resource",
      icon: "lorebook",
      aliases: ["lorebook gallery", "world info library", "lorebook collection"],
      keywords: ["my lorebooks", "lorebook list", "world info"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "lorebook-library" } },
    }),
    defineCommand({
      id: "agent-library",
      title: title.agentLibrary,
      kind: "resource",
      icon: "package",
      aliases: ["agent catalog", "agent packages", "download agents"],
      keywords: ["browse agents", "find agents"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "agent-catalog" } },
    }),
  ];
}

export function createSettingsCommandDefinitions(source: CommandCenterTitleSource): DeclarativeCommandDefinition[] {
  const title = resolveCommandCenterTitles(source);

  return [
    defineCommand({
      id: "spotify-settings",
      title: title.spotify,
      kind: "settings",
      icon: "music",
      aliases: ["spotify integration", "music provider", "music dj"],
      keywords: ["music integration", "spotify connect"],
      availability: { status: "requires-capability", capability: "spotify", setupTarget: true },
      action: { kind: "navigate", target: { kind: "resource", resource: "agent", id: "spotify" } },
    }),
    defineCommand({
      id: "tts-settings",
      title: title.textToSpeech,
      kind: "settings",
      icon: "speech",
      aliases: ["tts", "speech", "voice settings", "elevenlabs", "pockettts"],
      keywords: ["text to speech", "read aloud"],
      availability: { status: "requires-capability", capability: "tts", setupTarget: true },
      // The Voice job's own settings, not the bare Connections panel.
      action: { kind: "modal", modal: "job-settings", props: { job: "voice" } },
    }),
    defineCommand({
      id: "settings",
      title: title.settings,
      kind: "settings",
      icon: "settings",
      aliases: ["preferences", "configuration"],
      keywords: ["options", "preferences menu"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "settings", tab: "general" } },
    }),
    defineCommand({
      id: "integrations",
      title: title.connections,
      kind: "settings",
      icon: "connection",
      aliases: ["integrations", "providers", "api keys", "models"],
      keywords: ["api connections", "model providers"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "panel", panel: "connections" } },
    }),
    defineCommand({
      id: "extensions",
      title: title.extensions,
      kind: "settings",
      icon: "extensions",
      aliases: ["personal extensions", "addons", "plugins"],
      keywords: ["browser extensions", "addon manager"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "panel", panel: "extensions" } },
    }),
    defineCommand({
      id: "packages",
      title: title.packages,
      kind: "resource",
      icon: "package",
      aliases: ["capability packages", "catalog"],
      keywords: ["agent packages", "feature packages"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "surface", surface: "agent-catalog" } },
    }),
    defineCommand({
      id: "import-data",
      title: title.importData,
      kind: "settings",
      icon: "upload",
      aliases: ["restore profile", "import marinara", "data transfer"],
      keywords: ["restore backup", "load data"],
      availability: AVAILABLE,
      action: { kind: "navigate", target: { kind: "settings", tab: "import" } },
    }),
    defineCommand({
      id: "import-sillytavern",
      title: title.importSillyTavern,
      kind: "action",
      icon: "upload",
      aliases: ["st import", "bulk import", "import chats"],
      keywords: ["migrate from st", "sillytavern import"],
      availability: AVAILABLE,
      action: { kind: "modal", modal: "st-bulk-import" },
    }),
    defineCommand({
      id: "updates",
      title: title.updates,
      kind: "settings",
      icon: "updates",
      aliases: ["check for updates", "release channel", "version"],
      keywords: ["app version", "new release"],
      availability: AVAILABLE,
      action: {
        kind: "navigate",
        target: { kind: "settings", tab: "advanced", controlId: "release-channel" },
      },
    }),
    defineCommand({
      id: "diagnostics",
      title: title.diagnostics,
      kind: "settings",
      icon: "diagnostics",
      aliases: ["system information", "support details", "bug report", "gpu info"],
      keywords: ["bug report info", "troubleshoot"],
      availability: AVAILABLE,
      action: {
        kind: "navigate",
        target: { kind: "settings", tab: "advanced", controlId: "copy-support-diagnostics" },
      },
    }),
    defineCommand({
      id: "backups",
      title: title.backups,
      kind: "settings",
      icon: "backups",
      aliases: ["backup", "export", "archive", "automatic backups"],
      keywords: ["save backup", "export data"],
      availability: AVAILABLE,
      action: {
        kind: "navigate",
        target: { kind: "settings", tab: "advanced", controlId: "automatic-backups" },
      },
    }),
  ];
}

/**
 * Every Library page has a command (lib/library-section-commands.ts): a page that already had one gets the
 * table's words added to its aliases, any other gets one made here.
 */
function withLibraryPageCommands(
  definitions: DeclarativeCommandDefinition[],
  source: CommandCenterTitleSource,
): DeclarativeCommandDefinition[] {
  const title = resolveCommandCenterTitles(source);
  const generated = {
    presets: { title: title.presetsPage, icon: "preset", panel: "presets" },
    profiles: { title: title.profilesPage, icon: "settings", panel: "profiles" },
    regex: { title: title.regexPage, icon: "command", panel: "regex" },
    agents: { title: title.agentsPage, icon: "agent", panel: "agents" },
    tools: { title: title.toolsPage, icon: "command", panel: "tools" },
    assets: { title: title.assetsPage, icon: "command", panel: "assets" },
    rulesets: { title: title.rulesetsPage, icon: "command", panel: "rulesets" },
    backgrounds: { title: title.backgroundsPage, icon: "command", panel: "backgrounds" },
  } as const;
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const pages: DeclarativeCommandDefinition[] = [];
  for (const [section, entry] of Object.entries(LIBRARY_SECTION_COMMANDS)) {
    const existing = byId.get(entry.commandId);
    if (existing) {
      byId.set(entry.commandId, {
        ...existing,
        aliases: [...new Set([...(existing.aliases ?? []), ...entry.aliases])],
      });
      continue;
    }
    const page = generated[section as keyof typeof generated];
    if (!page) throw new Error(`Library section "${section}" has no page command`);
    pages.push(
      defineCommand({
        id: entry.commandId,
        title: page.title,
        kind: "navigation",
        icon: page.icon,
        aliases: entry.aliases,
        availability: AVAILABLE,
        action: { kind: "navigate", target: { kind: "panel", panel: page.panel } },
      }),
    );
  }
  return [...definitions.map((definition) => byId.get(definition.id) ?? definition), ...pages];
}

export function createSystemCommandDefinitions(source: CommandCenterTitleSource): DeclarativeCommandDefinition[] {
  return withLibraryPageCommands(
    [...createResourceCommandDefinitions(source), ...createSettingsCommandDefinitions(source)],
    source,
  );
}

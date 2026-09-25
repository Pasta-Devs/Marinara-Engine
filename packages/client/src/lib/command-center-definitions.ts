import type { CommandDefinition } from "./command-center";

export type CommandCenterAvailability =
  | { status: "available" }
  | { status: "requires-capability"; capability: "spotify" | "tts"; setupTarget: true }
  | { status: "requires-admin" };

export type CommandCenterModal =
  | "create-character"
  | "create-connection"
  | "create-lorebook"
  | "create-persona"
  | "create-preset"
  | "docs-viewer"
  | "import-character"
  | "import-connection"
  | "import-lorebook"
  | "import-persona"
  | "import-preset"
  | "keyboard-shortcuts"
  | "st-bulk-import";

export type CommandCenterAction =
  | { kind: "navigate"; target: NonNullable<CommandDefinition["target"]> }
  | { kind: "modal"; modal: CommandCenterModal; props?: Readonly<Record<string, unknown>> };

export interface DeclarativeCommandDefinition extends CommandDefinition {
  availability: CommandCenterAvailability;
  action: CommandCenterAction;
}

export type CommandCenterTitleKey =
  | "createCharacter"
  | "createConnection"
  | "createAgent"
  | "createLorebook"
  | "createPersona"
  | "createPreset"
  | "documentation"
  | "help"
  | "keyboardShortcuts"
  | "gameAssets"
  | "cardBrowser"
  | "characterLibrary"
  | "personaLibrary"
  | "agentLibrary"
  | "spotify"
  | "textToSpeech"
  | "settings"
  | "connections"
  | "extensions"
  | "packages"
  | "importData"
  | "importSillyTavern"
  | "updates"
  | "diagnostics"
  | "backups";

export type CommandCenterLabels = Readonly<Record<CommandCenterTitleKey, string>>;
export type CommandCenterTranslate = (key: CommandCenterTitleKey, fallback: string) => string;
export type CommandCenterTitleSource = CommandCenterTranslate | Partial<CommandCenterLabels>;

export const DEFAULT_COMMAND_CENTER_LABELS: CommandCenterLabels = {
  createCharacter: "Create character",
  createConnection: "Create connection",
  createAgent: "Create agent",
  createLorebook: "Create lorebook",
  createPersona: "Create persona",
  createPreset: "Create preset",
  documentation: "Documentation",
  help: "Help",
  keyboardShortcuts: "Keyboard shortcuts",
  gameAssets: "Game assets",
  cardBrowser: "Card browser",
  characterLibrary: "Character library",
  personaLibrary: "Persona library",
  agentLibrary: "Agent library",
  spotify: "Spotify",
  textToSpeech: "Text to speech",
  settings: "Settings",
  connections: "Connections and integrations",
  extensions: "Extensions",
  packages: "Packages",
  importData: "Import data",
  importSillyTavern: "Import from SillyTavern",
  updates: "Updates",
  diagnostics: "Support diagnostics",
  backups: "Backups and export",
};

export function resolveCommandCenterTitles(source: CommandCenterTitleSource): CommandCenterLabels {
  return Object.fromEntries(
    Object.entries(DEFAULT_COMMAND_CENTER_LABELS).map(([key, fallback]) => [
      key,
      typeof source === "function"
        ? source(key as CommandCenterTitleKey, fallback)
        : (source[key as CommandCenterTitleKey] ?? fallback),
    ]),
  ) as unknown as CommandCenterLabels;
}

export function defineCommand(command: Omit<DeclarativeCommandDefinition, "target">): DeclarativeCommandDefinition;
export function defineCommand(
  command: Omit<DeclarativeCommandDefinition, "target"> & { target?: CommandDefinition["target"] },
): DeclarativeCommandDefinition {
  return command.action.kind === "navigate" ? { ...command, target: command.action.target } : command;
}

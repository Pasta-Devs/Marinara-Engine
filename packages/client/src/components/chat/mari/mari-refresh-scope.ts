// ──────────────────────────────────────────────
// What app data a Professor Mari run may have changed
//
// After every reply the Mari page used to refetch every query the app had
// mounted (~40 requests), even for an answer that only read docs. A run now
// collects the tools she used, and the refresh after it covers only what
// those tools could have changed: nothing for reads, the matching lists for
// app_data writes, and everything (as before) for files, shell commands,
// packages or anything this list doesn't know.
// ──────────────────────────────────────────────
import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Tools that only read (workspace files, docs). */
const READ_ONLY_TOOLS = new Set(["docs_search", "docs_read", "read", "grep", "find", "ls"]);

/** The server's own read test for app_data actions (appDataActionLooksReadOnly in workspace-agent.service.ts). */
export function mariAppDataActionLooksReadOnly(action: unknown): boolean {
  if (typeof action !== "string") return false;
  const normalized = action
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, "");
  return /\.(list|get|getentry|search|active|entries|messages|sections|getsection|groups|getgroup|choiceblocks|getchoiceblock|runs|testscan|diagnose)$/.test(
    normalized,
  );
}

const CHARACTERS: QueryKey[] = [["characters"], ["home-feed"]];
const PERSONAS: QueryKey[] = [["personas"], ["persona-gallery"]];

/** app_data writes by the part before the first dot. Mari-only records (memories, decisions, skills) touch no app list. */
const APP_DATA_SCOPES: Record<string, QueryKey[]> = {
  character: CHARACTERS,
  persona: PERSONAS,
  lorebook: [["lorebooks"]],
  theme: [["themes"]],
  personal_extension: [["personal-extensions"]],
  agent: [["agents"]],
  preset: [["presets"]],
  home_widget: [["home-custom-widgets"]],
  chat: [["chats"], ["home-feed"]],
  instruction: [],
  decision: [],
  skill: [],
};

/** Tables named in an applied change (MariDbHistoryEntry.affectedTables). */
const TABLE_SCOPES: Record<string, QueryKey[]> = {
  characters: CHARACTERS,
  character_card_versions: [["characters"]],
  character_groups: [["characters"]],
  character_images: [["characters"]],
  personas: PERSONAS,
  persona_card_versions: [["personas"]],
  persona_groups: [["personas"]],
  persona_images: PERSONAS,
  lorebooks: [["lorebooks"]],
  lorebook_entries: [["lorebooks"]],
  lorebook_folders: [["lorebooks"]],
  prompt_presets: [["presets"]],
  prompt_sections: [["presets"]],
  prompt_groups: [["presets"]],
  choice_blocks: [["presets"]],
  agent_configs: [["agents"]],
  custom_themes: [["themes"]],
  installed_extensions: [["personal-extensions"]],
  regex_scripts: [["regex-scripts"]],
  custom_tools: [["custom-tools"]],
  chat_presets: [["chat-presets"]],
  chats: [["chats"], ["home-feed"]],
  messages: [["chats"]],
  message_swipes: [["chats"]],
  chat_folders: [["chat-folders"]],
  library_folders: [["library-folders"]],
  mari_instructions: [],
  mari_workspace_context: [["mari-workspace-context"]],
};

export type MariRefreshScope = { all: true } | { all: false; keys: QueryKey[] };

export function createMariRefreshScope() {
  let all = false;
  const keys = new Map<string, QueryKey>();
  const add = (list: QueryKey[]) => list.forEach((key) => keys.set(JSON.stringify(key), key));
  return {
    /** Something this run did can't be scoped (a dropped stream, an unknown tool): refresh everything. */
    markAll() {
      all = true;
    },
    noteTool(name: string, input: unknown) {
      if (all || READ_ONLY_TOOLS.has(name)) return;
      if (name === "package_service") {
        // Without an action it only lists what the packages offer.
        const action = (input as { action?: unknown } | null)?.action;
        if (typeof action !== "string" || !action.trim()) return;
        all = true;
        return;
      }
      if (name !== "app_data") {
        all = true;
        return;
      }
      const args = (input ?? {}) as { action?: unknown; apply?: unknown };
      // Without top-level apply:true the server runs a preview that saves nothing.
      if (args.apply !== true || mariAppDataActionLooksReadOnly(args.action)) return;
      const area = typeof args.action === "string" ? args.action.split(".")[0]! : "";
      const scope = APP_DATA_SCOPES[area];
      if (!scope) all = true;
      else add(scope);
      // character.moveToFolder, lorebook.folder.create, lorebook.libraryFolder.create
      if (typeof args.action === "string" && /folder/i.test(args.action)) add([["library-folders"]]);
    },
    result(): MariRefreshScope {
      return all ? { all: true } : { all: false, keys: [...keys.values()] };
    },
  };
}

export type MariRefreshScopeBuilder = ReturnType<typeof createMariRefreshScope>;

/** The refresh for applied changes, from the tables they touched; null means refresh everything. */
export function mariRefreshScopeForTables(tables: Iterable<string>): MariRefreshScope {
  const keys = new Map<string, QueryKey>();
  for (const table of tables) {
    const scope = TABLE_SCOPES[table];
    if (!scope) return { all: true };
    scope.forEach((key) => keys.set(JSON.stringify(key), key));
  }
  return { all: false, keys: [...keys.values()] };
}

/**
 * Marks the scope's queries stale; the mounted ones refetch, the rest on their next mount. A fetch already running
 * for one of them is reused rather than cancelled and sent again (the run's end and its applied-change entry both
 * land here, moments apart).
 */
export async function invalidateMariRefreshScope(
  qc: QueryClient,
  scope: MariRefreshScope,
  invalidateAll: () => Promise<void>,
) {
  if (scope.all) return invalidateAll();
  await Promise.all(scope.keys.map((queryKey) => qc.invalidateQueries({ queryKey }, { cancelRefetch: false })));
}

import { PROFESSOR_MARI_ID } from "@marinara-engine/shared";

import { MARI_ASSISTANT_PROMPT } from "../../db/seed-mari.js";

type ProfessorMariCharactersStore = {
  list(): Promise<Array<{ id?: string | null; data?: unknown }>>;
  listPersonas(): Promise<Array<{ name?: unknown }>>;
};

type NamedListStore = {
  list(): Promise<unknown[]>;
};

function namedValue(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const name = (row as { name?: unknown }).name;
  return typeof name === "string" && name.trim().length > 0 ? name : null;
}

export async function resolveProfessorMariPromptContext(args: {
  chatMeta: Record<string, unknown>;
  chars: ProfessorMariCharactersStore;
  lorebooksStore: NamedListStore;
  chats: NamedListStore;
  presets: NamedListStore;
}): Promise<string> {
  const sections = [MARI_ASSISTANT_PROMPT];

  try {
    const allChars = await args.chars.list();
    const allPersonasList = await args.chars.listPersonas();
    const allLorebooks = await args.lorebooksStore.list();
    const allChats = await args.chats.list();
    const allPresets = await args.presets.list();

    const charNames = allChars
      .filter((c) => c.id !== PROFESSOR_MARI_ID)
      .map((c) => {
        try {
          const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
          return d?.name;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const personaNames = allPersonasList.map((p) => p.name).filter(Boolean);
    const lorebookNames = allLorebooks.map(namedValue).filter(Boolean);
    const chatNames = allChats
      .slice(0, 50)
      .map(namedValue)
      .filter(Boolean);
    const presetNames = allPresets.map(namedValue).filter(Boolean);

    const namesSections: string[] = [];
    if (charNames.length > 0) {
      namesSections.push(`<available_names type="character">\n${charNames.join(", ")}\n</available_names>`);
    }
    if (personaNames.length > 0) {
      namesSections.push(`<available_names type="persona">\n${personaNames.join(", ")}\n</available_names>`);
    }
    if (lorebookNames.length > 0) {
      namesSections.push(`<available_names type="lorebook">\n${lorebookNames.join(", ")}\n</available_names>`);
    }
    if (chatNames.length > 0) {
      namesSections.push(`<available_names type="chat">\n${chatNames.join(", ")}\n</available_names>`);
    }
    if (presetNames.length > 0) {
      namesSections.push(`<available_names type="preset">\n${presetNames.join(", ")}\n</available_names>`);
    }

    if (namesSections.length > 0) sections.push(namesSections.join("\n\n"));
  } catch {
    // Non-critical: continue without name lists.
  }

  const mariContext = args.chatMeta.mariContext as Record<string, string> | undefined;
  if (mariContext && Object.keys(mariContext).length > 0) {
    const contextSections: string[] = [];
    for (const [key, value] of Object.entries(mariContext)) {
      contextSections.push(`<fetched_data key="${key}">\n${value}\n</fetched_data>`);
    }
    sections.push(
      "<loaded_context>\nThe following items were previously fetched and are available for reference:\n\n" +
        contextSections.join("\n\n") +
        "\n</loaded_context>",
    );
  }

  return sections.join("\n\n");
}

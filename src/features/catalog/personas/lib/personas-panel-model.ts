export type PersonaPanelRow = {
  id: string;
  name: string;
  comment?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  backstory?: string;
  appearance?: string;
  avatarPath: string | null;
  isActive: string | boolean;
  createdAt?: string;
  tags?: string[];
};

export type PersonaGroupRow = { id: string; name: string; description: string; personaIds: string[] };

export type PersonaPanelGroup = PersonaGroupRow & { memberIds: string[] };

export type SortOption = "name-asc" | "name-desc" | "newest" | "oldest" | "tokens";

export type PersonaActiveFilter = "all" | "active" | "inactive";

export function isPersonaActive(persona: PersonaPanelRow): boolean {
  return persona.isActive === true || persona.isActive === "true";
}

export function estimatePersonaTokens(persona: PersonaPanelRow): number {
  const text = [persona.description, persona.personality, persona.scenario, persona.backstory, persona.appearance].join(
    "",
  );
  return Math.ceil(text.length / 4);
}

export function parsePersonaTags(persona: PersonaPanelRow): string[] {
  return Array.isArray(persona.tags) ? persona.tags : [];
}

export function getPersonaTags(personas: PersonaPanelRow[]): string[] {
  const tagSet = new Set<string>();
  for (const persona of personas) {
    for (const tag of parsePersonaTags(persona)) tagSet.add(tag);
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
}

export function buildPersonaMap(personas: PersonaPanelRow[]): Map<string, PersonaPanelRow> {
  const map = new Map<string, PersonaPanelRow>();
  for (const persona of personas) map.set(persona.id, persona);
  return map;
}

export function parsePersonaGroups(personaGroupsRaw: PersonaGroupRow[] | undefined): PersonaPanelGroup[] {
  if (!personaGroupsRaw) return [];
  return personaGroupsRaw.map((group) => ({
    ...group,
    memberIds: Array.isArray(group.personaIds) ? [...group.personaIds] : [],
  }));
}

export function filterPersonas({
  personas,
  activeFilter,
  search,
  activeTag,
}: {
  personas: PersonaPanelRow[];
  activeFilter: PersonaActiveFilter;
  search: string;
  activeTag: string | null;
}): PersonaPanelRow[] {
  let filtered = personas;
  if (activeFilter === "active") {
    filtered = filtered.filter(isPersonaActive);
  } else if (activeFilter === "inactive") {
    filtered = filtered.filter((persona) => !isPersonaActive(persona));
  }

  if (search.trim()) {
    const query = search.toLowerCase();
    filtered = filtered.filter(
      (persona) =>
        persona.name.toLowerCase().includes(query) ||
        (persona.description ?? "").toLowerCase().includes(query) ||
        (persona.comment ?? "").toLowerCase().includes(query) ||
        parsePersonaTags(persona).some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  if (activeTag) {
    filtered = filtered.filter((persona) => parsePersonaTags(persona).includes(activeTag));
  }

  return filtered;
}

export function sortPersonas(personas: PersonaPanelRow[], sort: SortOption): PersonaPanelRow[] {
  const sorted = [...personas];
  switch (sort) {
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "newest":
      return sorted.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    case "oldest":
      return sorted.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    case "tokens":
      return sorted.sort((a, b) => estimatePersonaTokens(b) - estimatePersonaTokens(a));
    default:
      return sorted;
  }
}

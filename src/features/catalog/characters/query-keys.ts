export const characterKeys = {
  all: ["characters"] as const,
  list: () => [...characterKeys.all, "list"] as const,
  summaries: () => [...characterKeys.all, "summaries"] as const,
  summarySearch: (query: string) => [...characterKeys.summaries(), "search", query] as const,
  summaryDetail: (id: string) => [...characterKeys.summaries(), id] as const,
  summaryByIds: (ids: string[]) => [...characterKeys.summaries(), "byIds", ...ids] as const,
  detail: (id: string) => [...characterKeys.all, "detail", id] as const,
  versions: (id: string) => [...characterKeys.detail(id), "versions"] as const,
  gallery: (id: string) => [...characterKeys.all, "gallery", id] as const,
  personas: ["personas"] as const,
  personaSummaries: ["personas", "summaries"] as const,
  personaSummaryDetail: (id: string) => ["personas", "summaries", id] as const,
  personaDetail: (id: string) => [...characterKeys.personas, "detail", id] as const,
  activePersona: ["personas", "active"] as const,
  groups: ["character-groups"] as const,
  groupDetail: (id: string) => ["character-groups", "detail", id] as const,
  personaGroups: ["persona-groups"] as const,
  personaGroupDetail: (id: string) => ["persona-groups", "detail", id] as const,
};

export const spriteKeys = {
  list: (characterId: string) => ["sprites", characterId] as const,
  capabilities: () => ["sprites", "capabilities"] as const,
};

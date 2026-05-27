export const characterKeys = {
  all: ["characters"] as const,
  list: () => [...characterKeys.all, "list"] as const,
  detail: (id: string) => [...characterKeys.all, "detail", id] as const,
  versions: (id: string) => [...characterKeys.detail(id), "versions"] as const,
  gallery: (id: string) => [...characterKeys.all, "gallery", id] as const,
  personas: ["personas"] as const,
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

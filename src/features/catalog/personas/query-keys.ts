export const personaKeys = {
  list: ["personas"] as const,
  summaries: ["personas", "summaries"] as const,
  summaryDetail: (id: string) => ["personas", "summaries", id] as const,
  detail: (id: string) => [...personaKeys.list, "detail", id] as const,
  activeSummary: ["personas", "active-summary"] as const,
  groups: ["persona-groups"] as const,
  groupDetail: (id: string) => ["persona-groups", "detail", id] as const,
};

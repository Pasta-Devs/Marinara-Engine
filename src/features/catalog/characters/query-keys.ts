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
  groups: ["character-groups"] as const,
};

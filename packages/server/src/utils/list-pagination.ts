export const LIBRARY_PAGE_LIMIT = 100;

export type LibraryPageQuery = {
  limit?: string;
  offset?: string;
  search?: string;
  sort?: string;
  favoriteFilter?: string;
};

export type PaginatedList<T> = {
  items: T[];
  limit: number;
  offset: number;
  hasMore: boolean;
};

export function parseLibraryPageQuery(query: LibraryPageQuery) {
  const hasPaging =
    query.limit !== undefined ||
    query.offset !== undefined ||
    query.search !== undefined ||
    query.sort !== undefined ||
    query.favoriteFilter !== undefined;
  const parsedLimit = Number(query.limit);
  const parsedOffset = Number(query.offset);

  return {
    hasPaging,
    limit:
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(LIBRARY_PAGE_LIMIT, Math.trunc(parsedLimit))
        : LIBRARY_PAGE_LIMIT,
    offset: Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.trunc(parsedOffset) : 0,
    search: typeof query.search === "string" ? query.search.trim() : "",
    sort: typeof query.sort === "string" ? query.sort : "",
    favoriteFilter: typeof query.favoriteFilter === "string" ? query.favoriteFilter : "",
  };
}

export function toPaginatedList<T>(rows: T[], limit: number, offset: number): PaginatedList<T> {
  return {
    items: rows.slice(0, limit),
    limit,
    offset,
    hasMore: rows.length > limit,
  };
}

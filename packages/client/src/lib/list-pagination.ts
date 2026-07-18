export const LIBRARY_PAGE_SIZE = 24;

export type PaginatedList<T> = {
  items: T[];
  limit: number;
  offset: number;
  hasMore: boolean;
};

export function getNextPageOffset<T>(page: PaginatedList<T>) {
  return page.hasMore ? page.offset + page.items.length : undefined;
}

export function flattenPaginatedItems<T>(pages: Array<PaginatedList<T>> | undefined) {
  return pages?.flatMap((page) => page.items) ?? [];
}

export async function collectAllPaginatedItems<T>(
  fetchPage: (offset: number) => Promise<PaginatedList<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;

  for (;;) {
    const page = await fetchPage(offset);
    items.push(...page.items);
    if (!page.hasMore || page.items.length === 0) return items;
    offset = page.offset + page.items.length;
  }
}

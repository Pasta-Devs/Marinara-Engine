import type { LibraryFolderScope } from "@marinara-engine/shared";

const all = ["library-folders"] as const;

export const libraryFolderKeys = {
  all,
  list: (scope: LibraryFolderScope) => [...all, scope] as const,
};

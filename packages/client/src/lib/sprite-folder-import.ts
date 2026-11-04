export function isSpriteImageFile(file: Pick<File, "name">): boolean {
  return /\.(png|jpg|jpeg|gif|webp|avif|svg)$/iu.test(file.name);
}

/** Read only entries explicitly dropped by the user, retaining folder paths for the existing importer. */
export async function readDroppedSpriteFiles(entries: FileSystemEntry[]): Promise<File[]> {
  const files: File[] = [];
  async function read(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      if (!isSpriteImageFile(entry) && entry.name !== "catalog.json") return;
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      Object.defineProperty(file, "webkitRelativePath", { value: entry.fullPath.replace(/^\//u, "") });
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // Directory readers return batches (at most 100 entries in Chromium).
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await read(child);
      }
    }
  }
  for (const entry of entries) await read(entry);
  return files;
}

import assert from "node:assert/strict";
import { readDroppedSpriteFiles, isSpriteImageFile } from "../../packages/client/src/lib/sprite-folder-import.ts";

function file(path: string): FileSystemEntry {
  const name = path.split("/").at(-1)!;
  return {
    name,
    fullPath: path,
    isFile: true,
    file: (resolve: (file: File) => void) => resolve(new File(["fixture"], name)),
  } as unknown as FileSystemEntry;
}
function directory(batches: FileSystemEntry[][]): FileSystemEntry {
  return {
    isDirectory: true,
    createReader: () => ({
      readEntries: (resolve: (entries: FileSystemEntry[]) => void) => resolve(batches.shift() ?? []),
    }),
  } as unknown as FileSystemEntry;
}
const files = await readDroppedSpriteFiles([
  directory([
    Array.from({ length: 100 }, (_, index) => file(`/Front/${index}.png`)),
    [file("/Front/catalog.json"), file("/Front/notes.txt"), directory([[file("/Front/Side/happy.PNG")]])],
  ]),
]);
assert.equal(files.filter(isSpriteImageFile).length, 101, "all directory batches and nested images are counted");
assert.equal(files.length, 102, "catalog is retained and unrelated files are ignored");
assert.equal(files.at(-1)?.webkitRelativePath, "Front/Side/happy.PNG");
assert.equal(files.find((entry) => entry.name === "catalog.json")?.webkitRelativePath, "Front/catalog.json");
assert.deepEqual(await readDroppedSpriteFiles([directory([])]), []);
await assert.rejects(
  readDroppedSpriteFiles([
    {
      isFile: true,
      name: "broken.png",
      file: (_resolve: unknown, reject: (error: Error) => void) => reject(new Error("unreadable")),
    } as unknown as FileSystemEntry,
  ]),
  /unreadable/u,
);
for (const name of ["a.svg", "a.AVIF", "a.jpeg"]) assert.ok(isSpriteImageFile({ name }));
for (const name of ["a.txt", "a.png.exe", "catalog.json"]) assert.ok(!isSpriteImageFile({ name }));
console.log("Sprite folder drop regression passed");

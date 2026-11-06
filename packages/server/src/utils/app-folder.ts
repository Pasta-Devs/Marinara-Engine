import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep, win32 } from "node:path";
import { DATA_DIR } from "./data-dir.js";
import { assertInsideDir } from "./security.js";

// The real path of `path`. A path that does not exist yet is the real path of its nearest existing folder plus the rest
// of it, so a write never creates a file or folder through a link. The walk stops at the top of the path: an offline
// Windows drive or share has no existing part at all, and its root is its own dirname.
function realPathOf(path: string): string {
  let existing = path;
  while (!lstatSync(existing, { throwIfNoEntry: false })) {
    const parent = dirname(existing);
    if (parent === existing) {
      throw Object.assign(new Error(`No existing folder above ${path}`), { code: "ENOENT" });
    }
    existing = parent;
  }
  return join(realpathSync(existing), relative(existing, path));
}

// The app folders (backgrounds, avatars, gallery, sprites, lorebook images, the preview folder) are reachable by
// Professor Mari's shell when the data dir sits inside her workspace, so a path in them is never trusted as written.
// Returns the real path of `path` only while it stays inside the real folder: the real data dir plus the folder's place
// in it, so a linked file and a linked folder are both refused, and a data dir that is itself behind a link still works.
// A folder outside the data dir (a test root) is held to its own real path.
// ponytail: checked, then used by the checked path, so a folder swapped for a link between the two is not caught. The
// shell sandbox keeps her shell from changing these folders wherever it runs (macOS and Linux; on Linux, not a media
// folder that is already a link when the shell starts), so the window remains for processes outside that sandbox.
// Upgrade path: open each path part without following links (O_NOFOLLOW per part, or openat).
export function realPathInAppFolder(folder: string, path: string): string {
  const place = relative(DATA_DIR, folder);
  if (place === ".." || place.startsWith(`..${sep}`) || isAbsolute(place)) return realPathInRealFolder(folder, path);
  const realFolder = join(realpathSync(DATA_DIR), place);
  namedInside(path, folder, realFolder);
  return insideByAsciiCase(realFolder, realPathOf(path));
}

// The same rule for a folder the user may move behind a link of its own (game-assets on another disk): `path` is held to
// the folder's own real path, so the folder's link is followed but a link inside it that leads out is refused.
export function realPathInRealFolder(folder: string, path: string): string {
  const realFolder = realpathSync(folder);
  namedInside(path, folder, realFolder);
  return insideByAsciiCase(realFolder, realPathOf(path));
}

// `path` as written names a place inside the folder, spelled as configured or as its real path (callers pass either),
// so a path that names somewhere else is refused before the real-path walk looks at anything outside the folder.
function namedInside(path: string, ...folders: string[]): void {
  for (const folder of folders) {
    try {
      assertInsideDir(folder, path);
      return;
    } catch {
      // Try the folder's other spelling.
    }
  }
  throw new Error("Path escapes the allowed directory");
}

// assertInsideDir, and on Windows also inside when only ASCII letters ignore case. Windows path comparison lower-cases
// every letter, so a folder whose name differs only by a letter that lower-cases to an ASCII one (U+212A KELVIN SIGN
// to "k") would count as the same folder, though the file system keeps the two apart.
// ponytail: ASCII-only folding refuses a real folder whose non-ASCII letters differ in case between the data dir as
// configured and as stored; upgrade by comparing the paths fs.realpathSync.native returns, which carry the stored case.
export function insideByAsciiCase(root: string, candidate: string): string {
  const inside = assertInsideDir(root, candidate);
  if (!/^[A-Za-z]:[\\/]|^\\\\/.test(root) && !/^[A-Za-z]:[\\/]|^\\\\/.test(candidate)) return inside;
  const fold = (value: string) => win32.resolve(value).replace(/[A-Z]/g, (letter) => letter.toLowerCase());
  const base = fold(root).replace(/\\+$/, "");
  const target = fold(candidate);
  if (target !== base && !target.startsWith(`${base}\\`)) throw new Error("Path escapes the allowed directory");
  return inside;
}

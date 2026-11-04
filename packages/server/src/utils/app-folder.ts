import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { DATA_DIR } from "./data-dir.js";
import { assertInsideDir } from "./security.js";

// The app folders (backgrounds, avatars, gallery, sprites, lorebook images, the preview folder) are reachable by
// Professor Mari's shell when the data dir sits inside her workspace, so a path in them is never trusted as written.
// Returns the real path of `path` only while it stays inside the real folder: the real data dir plus the folder's place
// in it, so a linked file and a linked folder are both refused, and a data dir that is itself behind a link still works.
// A folder outside the data dir (a test root) is held to its own real path. A path that does not exist yet is checked
// as the real path of its nearest existing folder plus the rest of it, so a write never creates a file or folder
// through a link.
// ponytail: checked, then used by the checked path, so a folder swapped for a link between the two is not caught. The
// shell sandbox keeps her shell from changing these folders wherever it runs (macOS and Linux; on Linux, not a media
// folder that is already a link when the shell starts), so the window remains for processes outside that sandbox.
// Upgrade path: open each path part without following links (O_NOFOLLOW per part, or openat).
export function realPathInAppFolder(folder: string, path: string): string {
  let existing = path;
  while (!lstatSync(existing, { throwIfNoEntry: false })) existing = dirname(existing);
  const realPath = join(realpathSync(existing), relative(existing, path));
  const place = relative(DATA_DIR, folder);
  const outsideDataDir = place === ".." || place.startsWith(`..${sep}`) || isAbsolute(place);
  return assertInsideDir(outsideDataDir ? realpathSync(folder) : join(realpathSync(DATA_DIR), place), realPath);
}

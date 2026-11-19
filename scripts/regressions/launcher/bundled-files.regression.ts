// Files the build ships or leaves out: the removed generic-fantasy sprite pack stays out of the bundled game assets,
// and the universal preset artwork ships in the client's public folder.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
assert.equal(
  existsSync(join(REPOSITORY_ROOT, "packages/server/src/assets/default-game-assets/sprites/generic-fantasy")),
  false,
);
assert.equal(
  existsSync(join(REPOSITORY_ROOT, "packages/client/public/illustrations/marinara-universal-preset.webp")),
  true,
);

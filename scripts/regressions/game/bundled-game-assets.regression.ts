// Which game asset paths and folders ship with the app, as opposed to ones a user added. A path that leaves the
// assets folder is never a bundled one.
import assert from "node:assert/strict";
import {
  isBundledGameAssetFolderPath,
  isBundledGameAssetPath,
} from "../../../packages/server/src/services/game/native-game-assets.js";

assert.equal(isBundledGameAssetPath("sfx/ui/page-turn.wav"), true);
assert.equal(isBundledGameAssetPath("sfx/ui/user-upload.wav"), false);
assert.equal(isBundledGameAssetPath("backgrounds/illustrations/welcome-pavilion-golden-hour.png"), false);
assert.equal(isBundledGameAssetFolderPath("sfx/ui"), true);
assert.equal(isBundledGameAssetFolderPath("backgrounds/illustrations"), false);
assert.equal(isBundledGameAssetPath("../package.json"), false);

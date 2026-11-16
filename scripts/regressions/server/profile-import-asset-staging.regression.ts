// Profile import's asset files are staged first, then promoted, rolled back or cleaned up, so a failed import leaves
// the data folder as it was.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupStagedProfileAssets,
  promoteStagedProfileAssets,
  rollbackPromotedProfileAssets,
  stageProfileImportAssets,
} from "../../../packages/server/src/services/import/profile-import-assets.js";

const profileImportAssetRoot = mkdtempSync(join(tmpdir(), "marinara-profile-import-atomic-"));
try {
  const liveAvatar = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x6c, 0x69, 0x76, 0x65]);
  const importedAvatar = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x6e, 0x65, 0x77]);
  const liveAvatarPath = join(profileImportAssetRoot, "avatars", "character.png");
  mkdirSync(join(profileImportAssetRoot, "avatars"), { recursive: true });
  writeFileSync(liveAvatarPath, liveAvatar);
  await assert.rejects(
    stageProfileImportAssets(
      profileImportAssetRoot,
      [
        { path: "avatars/character.png", expectedSize: importedAvatar.length, read: () => importedAvatar },
        {
          path: "gallery/corrupt.png",
          expectedSize: 8,
          read: () => {
            throw new Error("simulated corrupt archive member");
          },
        },
      ],
      1024,
    ),
    /simulated corrupt archive member/u,
  );
  assert.deepEqual(readFileSync(liveAvatarPath), liveAvatar);

  const stagedProfileAssets = await stageProfileImportAssets(
    profileImportAssetRoot,
    [{ path: "avatars/character.png", expectedSize: importedAvatar.length, read: () => importedAvatar }],
    1024,
  );
  await promoteStagedProfileAssets(stagedProfileAssets);
  assert.deepEqual(readFileSync(liveAvatarPath), importedAvatar);
  await rollbackPromotedProfileAssets(stagedProfileAssets);
  assert.deepEqual(readFileSync(liveAvatarPath), liveAvatar);
  await cleanupStagedProfileAssets(stagedProfileAssets);
} finally {
  rmSync(profileImportAssetRoot, { recursive: true, force: true });
}

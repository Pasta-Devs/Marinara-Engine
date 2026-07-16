import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertInsideDir } from "../../utils/security.js";

export class ProfileImportAssetValidationError extends Error {}

export type ProfileImportAssetInput = {
  path: string;
  expectedSize: number;
  read: () => Buffer | null | Promise<Buffer | null>;
};

type StagedProfileImportAsset = {
  path: string;
  stagedPath: string;
  outputPath: string;
  backupPath: string;
  hadExistingOutput: boolean;
  promotionAttempted: boolean;
};

export type StagedProfileImportAssets = {
  rootDir: string;
  assets: StagedProfileImportAsset[];
  totalBytes: number;
};

function safeRelativeAssetParts(path: string): string[] {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 2 || parts.some((part) => part === "." || part === ".." || part.includes(":"))) {
    throw new ProfileImportAssetValidationError(`Profile asset path is invalid: ${path}`);
  }
  return parts;
}

export async function stageProfileImportAssets(
  dataDir: string,
  inputs: ProfileImportAssetInput[],
  totalByteLimit: number,
): Promise<StagedProfileImportAssets> {
  await mkdir(dataDir, { recursive: true });
  const rootDir = await mkdtemp(join(dataDir, ".profile-import-"));
  const stagedDataDir = join(rootDir, "staged");
  const rollbackDataDir = join(rootDir, "rollback");
  const assets: StagedProfileImportAsset[] = [];
  const seenPaths = new Set<string>();
  let totalBytes = 0;

  try {
    for (const input of inputs) {
      const parts = safeRelativeAssetParts(input.path);
      if (seenPaths.has(input.path)) {
        throw new ProfileImportAssetValidationError(`Profile contains duplicate asset path ${input.path}.`);
      }
      seenPaths.add(input.path);
      const buffer = await input.read();
      if (!buffer) continue;
      if (buffer.byteLength !== input.expectedSize) {
        throw new ProfileImportAssetValidationError(
          `Profile asset ${input.path} does not match its manifest size.`,
        );
      }

      totalBytes += buffer.byteLength;
      if (totalBytes > totalByteLimit) {
        throw new ProfileImportAssetValidationError(
          `Profile archive restored assets are too large (${totalBytes} bytes, limit ${totalByteLimit} bytes).`,
        );
      }

      const stagedPath = assertInsideDir(stagedDataDir, join(stagedDataDir, ...parts));
      const outputPath = assertInsideDir(dataDir, join(dataDir, ...parts));
      const backupPath = assertInsideDir(rollbackDataDir, join(rollbackDataDir, ...parts));
      await mkdir(dirname(stagedPath), { recursive: true });
      await writeFile(stagedPath, buffer);
      assets.push({
        path: input.path,
        stagedPath,
        outputPath,
        backupPath,
        hadExistingOutput: false,
        promotionAttempted: false,
      });
    }

    return { rootDir, assets, totalBytes };
  } catch (error) {
    await rm(rootDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function promoteStagedProfileAssets(stage: StagedProfileImportAssets): Promise<void> {
  for (const asset of stage.assets) {
    await mkdir(dirname(asset.outputPath), { recursive: true });
    asset.hadExistingOutput = existsSync(asset.outputPath);
    if (asset.hadExistingOutput) {
      await mkdir(dirname(asset.backupPath), { recursive: true });
      await copyFile(asset.outputPath, asset.backupPath);
    }

    asset.promotionAttempted = true;
    try {
      await rename(asset.stagedPath, asset.outputPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code !== "EEXIST" && code !== "EPERM") throw error;
      await rm(asset.outputPath, { force: true });
      await rename(asset.stagedPath, asset.outputPath);
    }
  }
}

export async function rollbackPromotedProfileAssets(stage: StagedProfileImportAssets): Promise<void> {
  const errors: unknown[] = [];
  for (const asset of [...stage.assets].reverse()) {
    if (!asset.promotionAttempted) continue;
    try {
      if (asset.hadExistingOutput) {
        await copyFile(asset.backupPath, asset.outputPath);
      } else {
        await rm(asset.outputPath, { force: true });
      }
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, `Failed to roll back ${errors.length} profile asset(s)`);
  }
}

export async function cleanupStagedProfileAssets(stage: StagedProfileImportAssets): Promise<void> {
  await rm(stage.rootDir, { recursive: true, force: true });
}

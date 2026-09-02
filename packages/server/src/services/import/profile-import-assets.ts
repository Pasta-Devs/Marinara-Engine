import { createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { finishCrc32, updateCrc32State } from "../../utils/crc32.js";
import { assertInsideDir } from "../../utils/security.js";
import { validateImageAssetFile, validateVideoAssetFile } from "../../utils/media-file-security.js";

export class ProfileImportAssetValidationError extends Error {}

export type ProfileImportAssetStream = {
  stream: Readable;
  expectedCrc32: number;
};

export type ProfileImportAssetInput<TContents = Buffer | ProfileImportAssetStream> = {
  path: string;
  expectedSize: number;
  read: () => TContents | null | Promise<TContents | null>;
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
  skipped: Array<{ path: string; message: string }>;
  totalBytes: number;
};

function safeRelativeAssetParts(path: string): string[] {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 2 || parts.some((part) => part === "." || part === ".." || part.includes(":"))) {
    throw new ProfileImportAssetValidationError(`Profile asset path is invalid: ${path}`);
  }
  return parts;
}

function profileAssetImagePolicy(path: string): { allowSvg?: boolean } | null {
  const normalized = path.replace(/\\/g, "/");
  if (
    normalized.startsWith("avatars/") ||
    normalized.startsWith("custom-emojis/") ||
    normalized.startsWith("custom-stickers/") ||
    normalized.startsWith("lorebooks/images/") ||
    normalized.startsWith("prompts/images/") ||
    normalized.startsWith("agents/images/") ||
    normalized.startsWith("connections/images/")
  ) {
    return {};
  }
  if (normalized.startsWith("gallery/")) return {};
  if (normalized.startsWith("backgrounds/")) {
    return normalized === "backgrounds/meta.json" || normalized === "backgrounds/organization.json" ? null : {};
  }
  if (normalized.startsWith("sprites/") || normalized.startsWith("game-assets/sprites/")) {
    return { allowSvg: true };
  }
  if (normalized.startsWith("game-assets/backgrounds/")) return {};
  return null;
}

function isProfileVideoAssetPath(path: string): boolean {
  return (
    path.startsWith("gallery/character-videos/") ||
    path.startsWith("gallery/persona-videos/") ||
    path.startsWith("game-scene-videos/") ||
    path.startsWith("conversation-call-character-videos/")
  );
}

async function validateProfileImportAsset(path: string, stagedPath: string, stagedRoot: string): Promise<void> {
  const normalized = path.replace(/\\/g, "/");
  // The game-asset seeder drops an empty `.native` marker into every bundled
  // asset directory and profile exports archive those directories verbatim.
  // Tolerate exactly that marker — empty, dot-prefixed, never served as
  // media — so a stock profile backup restores instead of failing image
  // validation on the seeder's own file.
  if (normalized.startsWith("game-assets/") && (normalized.split("/").pop() ?? "") === ".native") {
    const marker = await stat(stagedPath);
    if (marker.size !== 0) {
      throw new ProfileImportAssetValidationError(`Profile asset ${path} is not a supported image file.`);
    }
    return;
  }
  if (isProfileVideoAssetPath(normalized)) {
    if (/\.json$/iu.test(normalized)) return;
    const video = await validateVideoAssetFile(stagedPath, normalized, { additionalRoot: stagedRoot });
    if (!video) {
      throw new ProfileImportAssetValidationError(`Profile asset ${path} is not a supported video file.`);
    }
    await video.handle.close();
    return;
  }

  const imagePolicy = profileAssetImagePolicy(normalized);
  if (!imagePolicy) {
    const leafName = normalized.split("/").pop() ?? "";
    const looksLikeServedImage =
      /\.(?:avif|gif|jpe?g|png|svg|webp)$/iu.test(leafName) &&
      (normalized.startsWith("game-assets/") || normalized.startsWith("sprites/"));
    if (looksLikeServedImage) {
      throw new ProfileImportAssetValidationError(`Profile asset ${path} is not a supported image file.`);
    }
    return;
  }
  const image = await validateImageAssetFile(stagedPath, path, { ...imagePolicy, additionalRoot: stagedRoot });
  if (!image) {
    throw new ProfileImportAssetValidationError(`Profile asset ${path} is not a supported image file.`);
  }
  await image.handle.close();
}

async function stageStreamedAsset(
  source: ProfileImportAssetStream,
  stagedPath: string,
  expectedSize: number,
  remainingBytes = Number.MAX_SAFE_INTEGER,
) {
  if (!Number.isSafeInteger(source.expectedCrc32) || source.expectedCrc32 < 0 || source.expectedCrc32 > 0xffffffff) {
    throw new ProfileImportAssetValidationError("Profile asset has an invalid CRC manifest.");
  }

  let bytesRead = 0;
  let crcState = 0xffffffff;
  const inspect = new Transform({
    transform(chunk: Buffer | Uint8Array | string, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytesRead += buffer.length;
      if (bytesRead > expectedSize || bytesRead > remainingBytes) {
        callback(new ProfileImportAssetValidationError("Profile archive restored assets are too large."));
        return;
      }
      crcState = updateCrc32State(crcState, buffer);
      callback(null, buffer);
    },
  });
  try {
    await pipeline(source.stream, inspect, createWriteStream(stagedPath, { mode: 0o600 }));
  } catch (error) {
    if (error instanceof ProfileImportAssetValidationError) throw error;
    throw new ProfileImportAssetValidationError("Profile asset could not be read from its archive.");
  }

  if (bytesRead !== expectedSize) {
    throw new ProfileImportAssetValidationError("Profile asset does not match its manifest size.");
  }
  const crc32 = finishCrc32(crcState);
  if (crc32 !== source.expectedCrc32) {
    throw new ProfileImportAssetValidationError("Profile asset failed its archive CRC check.");
  }
  return bytesRead;
}

export async function stageProfileImportAssets(
  dataDir: string,
  inputs: Array<ProfileImportAssetInput>,
  totalByteLimit = Number.MAX_SAFE_INTEGER,
): Promise<StagedProfileImportAssets> {
  await mkdir(dataDir, { recursive: true });
  const rootDir = await mkdtemp(join(dataDir, ".profile-import-"));
  const stagedDataDir = join(rootDir, "staged");
  const rollbackDataDir = join(rootDir, "rollback");
  const assets: StagedProfileImportAsset[] = [];
  const skipped: StagedProfileImportAssets["skipped"] = [];
  const seenPaths = new Set<string>();
  let totalBytes = 0;
  let declaredBytes = 0;

  try {
    for (const input of inputs) {
      const parts = safeRelativeAssetParts(input.path);
      if (seenPaths.has(input.path)) {
        throw new ProfileImportAssetValidationError(`Profile contains duplicate asset path ${input.path}.`);
      }
      seenPaths.add(input.path);
      if (!Number.isSafeInteger(input.expectedSize) || input.expectedSize < 0) {
        skipped.push({ path: input.path, message: `Profile asset ${input.path} has an invalid manifest size.` });
        continue;
      }
      if (declaredBytes + input.expectedSize > totalByteLimit) {
        throw new ProfileImportAssetValidationError(
          `Profile archive restored assets are too large (${declaredBytes + input.expectedSize} bytes, limit ${totalByteLimit} bytes).`,
        );
      }
      declaredBytes += input.expectedSize;

      const stagedPath = assertInsideDir(stagedDataDir, join(stagedDataDir, ...parts));
      const outputPath = assertInsideDir(dataDir, join(dataDir, ...parts));
      const backupPath = assertInsideDir(rollbackDataDir, join(rollbackDataDir, ...parts));
      try {
        const contents = await input.read();
        if (!contents) continue;
        await mkdir(dirname(stagedPath), { recursive: true });
        if (Buffer.isBuffer(contents)) {
          if (contents.byteLength !== input.expectedSize) {
            throw new ProfileImportAssetValidationError(
              `Profile asset ${input.path} does not match its manifest size.`,
            );
          }
          await writeFile(stagedPath, contents, { mode: 0o600 });
        } else {
          try {
            await stageStreamedAsset(contents, stagedPath, input.expectedSize, totalByteLimit - totalBytes);
          } catch (error) {
            if (error instanceof ProfileImportAssetValidationError && !error.message.includes(input.path)) {
              error.message = `Profile asset ${input.path}: ${error.message}`;
            }
            throw error;
          }
        }
        await validateProfileImportAsset(input.path, stagedPath, stagedDataDir);
      } catch (error) {
        if (!(error instanceof ProfileImportAssetValidationError)) throw error;
        await rm(stagedPath, { force: true }).catch(() => undefined);
        skipped.push({ path: input.path, message: error.message });
        continue;
      }
      totalBytes += input.expectedSize;
      assets.push({
        path: input.path,
        stagedPath,
        outputPath,
        backupPath,
        hadExistingOutput: false,
        promotionAttempted: false,
      });
    }

    return { rootDir, assets, skipped, totalBytes };
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

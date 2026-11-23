import type { FastifyInstance } from "fastify";
import { mkdir, open, stat, unlink } from "fs/promises";
import { extname, join } from "path";
import { DATA_DIR } from "../utils/data-dir.js";
import { resolveInside } from "../utils/security.js";
import { logger } from "../lib/logger.js";
import { notFound } from "../utils/not-found.js";
import { writeFileAtomic } from "../utils/atomic-write.js";
import { sendValidatedMediaFile } from "../utils/media-file-security.js";

const NOTIFICATION_SOUNDS_DIR = join(DATA_DIR, "notification-sounds");
const MAX_NOTIFICATION_SOUND_BYTES = 10 * 1024 * 1024;

type NotificationSoundFormat = {
  extension: ".mp3" | ".wav" | ".ogg" | ".m4a" | ".mp4" | ".webm";
  mimeType: "audio/mpeg" | "audio/wav" | "audio/ogg" | "audio/mp4" | "audio/webm";
};

type StoredNotificationSound = NotificationSoundFormat & {
  path: string;
  updatedAt: string;
};

const ALLOWED_UPLOAD_EXTENSIONS = new Map<string, NotificationSoundFormat["extension"]>([
  [".mp3", ".mp3"],
  [".wav", ".wav"],
  [".ogg", ".ogg"],
  [".oga", ".ogg"],
  [".m4a", ".m4a"],
  [".mp4", ".mp4"],
  [".webm", ".webm"],
]);

const STORED_FORMATS: NotificationSoundFormat[] = [
  { extension: ".mp3", mimeType: "audio/mpeg" },
  { extension: ".wav", mimeType: "audio/wav" },
  { extension: ".ogg", mimeType: "audio/ogg" },
  { extension: ".m4a", mimeType: "audio/mp4" },
  { extension: ".mp4", mimeType: "audio/mp4" },
  { extension: ".webm", mimeType: "audio/webm" },
];

export function detectNotificationSoundFormat(buffer: Buffer): NotificationSoundFormat | null {
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF") {
    if (buffer.subarray(8, 12).toString("ascii") === "WAVE") {
      return { extension: ".wav", mimeType: "audio/wav" };
    }
    if (buffer.subarray(8, 12).toString("ascii") === "WEBP") return null;
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return { extension: ".ogg", mimeType: "audio/ogg" };
  }
  if (
    buffer.length >= 3 &&
    (buffer.subarray(0, 3).toString("ascii") === "ID3" ||
      (buffer[0] === 0xff && buffer[1] !== undefined && (buffer[1] & 0xe0) === 0xe0))
  ) {
    return { extension: ".mp3", mimeType: "audio/mpeg" };
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return { extension: ".m4a", mimeType: "audio/mp4" };
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { extension: ".webm", mimeType: "audio/webm" };
  }
  return null;
}

function soundPath(extension: NotificationSoundFormat["extension"]): string {
  return resolveInside(NOTIFICATION_SOUNDS_DIR, `notification${extension}`);
}

async function findStoredNotificationSound(): Promise<StoredNotificationSound | null> {
  const candidates = await Promise.all(
    STORED_FORMATS.map(async (format) => {
      const path = soundPath(format.extension);
      try {
        const details = await stat(path);
        if (!details.isFile()) return null;
        return { ...format, path, updatedAt: details.mtime.toISOString(), mtimeMs: details.mtimeMs };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }),
  );
  const newest = candidates
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
  if (!newest) return null;
  const { mtimeMs: _mtimeMs, ...sound } = newest;
  return sound;
}

async function removeStoredNotificationSounds(exceptPath?: string) {
  await Promise.all(
    STORED_FORMATS.map(async (format) => {
      const path = soundPath(format.extension);
      if (path === exceptPath) return;
      await unlink(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }),
  );
}

// Replacement and deletion both rename/unlink the same fixed filenames, so
// they must not interleave: two concurrent uploads could otherwise delete
// each other's freshly renamed file, leaving no sound configured at all.
let notificationSoundMutationQueue: Promise<unknown> = Promise.resolve();
function withNotificationSoundLock<T>(task: () => Promise<T>): Promise<T> {
  const run = notificationSoundMutationQueue.then(task, task);
  notificationSoundMutationQueue = run.catch(() => undefined);
  return run;
}

function soundStatus(sound: StoredNotificationSound | null) {
  if (!sound) return { configured: false, url: null, updatedAt: null };
  return {
    configured: true,
    url: `/api/notification-sound/file?v=${encodeURIComponent(sound.updatedAt)}`,
    updatedAt: sound.updatedAt,
  };
}

export async function notificationSoundRoutes(app: FastifyInstance) {
  app.get("/", async () => soundStatus(await findStoredNotificationSound()));

  app.post("/upload", async (req, reply) => {
    let upload;
    try {
      upload = await req.file({ limits: { fileSize: MAX_NOTIFICATION_SOUND_BYTES + 1 } });
    } catch (error) {
      logger.warn(error, "Failed to receive custom notification sound upload");
      return reply.status(413).send({ error: "Notification sound must be 10 MB or smaller." });
    }
    if (!upload) return reply.status(400).send({ error: "No notification sound was uploaded." });

    const uploadedExtension = ALLOWED_UPLOAD_EXTENSIONS.get(extname(upload.filename).toLowerCase());
    if (!uploadedExtension) {
      upload.file.resume();
      return reply.status(400).send({ error: "Use an MP3, WAV, OGG, M4A, MP4, or WebM audio file." });
    }

    let buffer: Buffer;
    try {
      buffer = await upload.toBuffer();
    } catch (error) {
      // toBuffer() throws once the stream passes the per-route fileSize limit; that is the
      // size rule, not an unreadable file, and the person needs to be told which.
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        return reply.status(413).send({ error: "Notification sound must be 10 MB or smaller." });
      }
      logger.warn(error, "Failed to read custom notification sound upload");
      return reply.status(400).send({ error: "The notification sound could not be read." });
    }
    if (upload.file.truncated || buffer.byteLength > MAX_NOTIFICATION_SOUND_BYTES) {
      return reply.status(413).send({ error: "Notification sound must be 10 MB or smaller." });
    }

    const format = detectNotificationSoundFormat(buffer);
    const extensionMatches =
      format &&
      (uploadedExtension === format.extension ||
        ((uploadedExtension === ".mp4" || uploadedExtension === ".m4a") && format.mimeType === "audio/mp4"));
    if (!format || !extensionMatches) {
      return reply.status(400).send({ error: "The uploaded file is not a supported audio container." });
    }

    const finalPath = soundPath(uploadedExtension);
    try {
      return await withNotificationSoundLock(async () => {
        await mkdir(NOTIFICATION_SOUNDS_DIR, { recursive: true });
        await writeFileAtomic(finalPath, buffer);
        await removeStoredNotificationSounds(finalPath);
        const details = await stat(finalPath);
        return soundStatus({
          extension: uploadedExtension,
          mimeType: format.mimeType,
          path: finalPath,
          updatedAt: details.mtime.toISOString(),
        });
      });
    } catch (error) {
      logger.error(error, "Failed to save custom notification sound");
      return reply.status(500).send({ error: "Failed to save the notification sound." });
    }
  });

  app.delete("/", async (_req, reply) => {
    try {
      await withNotificationSoundLock(() => removeStoredNotificationSounds());
    } catch (error) {
      // Windows refuses to delete a file another program (antivirus, a media player) holds open.
      // Log the real reason so the server console shows it, not only the client's toast.
      logger.error(error, "Failed to remove custom notification sound");
      const code = (error as NodeJS.ErrnoException).code;
      return reply.status(500).send({
        error:
          code === "EPERM" || code === "EBUSY" || code === "EACCES"
            ? "The notification sound file is in use or locked by another program. Close it there and try again."
            : "Failed to remove the notification sound.",
      });
    }
    return reply.status(204).send();
  });

  app.get("/file", async (req, reply) => {
    const sound = await findStoredNotificationSound();
    if (!sound) return notFound(reply, "No custom notification sound.");
    // Open a handle before replying: a concurrent replace/delete can remove
    // the file after discovery, and an open handle keeps the bytes readable.
    let handle;
    try {
      handle = await open(sound.path, "r");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return notFound(reply, "No custom notification sound.");
      }
      throw error;
    }
    let details;
    try {
      details = await handle.stat();
    } catch (error) {
      await handle.close().catch(() => undefined);
      throw error;
    }
    reply.header("Content-Disposition", "inline").header("X-Content-Type-Options", "nosniff");
    // Safari (macOS, iPhone, iPad) only plays audio from servers that answer byte-range
    // requests with 206; a plain 200 makes it fail and fall back to the default ping.
    return sendValidatedMediaFile(
      reply,
      { handle, mimeType: sound.mimeType, size: details.size, mtimeMs: details.mtimeMs },
      { method: req.method, rangeHeader: req.headers.range, cacheControl: "no-cache" },
    );
  });
}

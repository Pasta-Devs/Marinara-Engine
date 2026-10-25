// ──────────────────────────────────────────────
// Routes: avatar models for the 2D and 3D avatar agents (lane: base)
// ──────────────────────────────────────────────
// Registered at /api/avatar-models (AVATAR_API_PREFIXES.models). `routes/avatars.routes.ts` is the
// unrelated profile-picture route. Routes this plugin owns:
//   GET    /                                        AvatarOwnerSummary[]
//   GET    /:ownerType/:ownerId                     AvatarConfig | null (null when none, 404 for an unknown owner)
//   PUT    /:ownerType/:ownerId                     AvatarConfigUpdate → AvatarConfig
//   DELETE /:ownerType/:ownerId                     removes the owner's avatar folder
//   DELETE /:ownerType/:ownerId/kinds/:kind         removes one kind → AvatarConfig | null
//   POST   /:ownerType/:ownerId/import              multipart `file` (+ optional `kind`) → AvatarImportResult
//   GET    /:ownerType/:ownerId/files/:kind/:name   a stored file, with a checked content type
// Bodies are validated with the schemas in packages/shared/src/schemas/avatars.schema.ts; imports go
// through services/avatars/formats/registry.ts and add no size limit below the global upload cap.
import { open, realpath, type FileHandle } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  AVATAR_IMPORT_EXTENSIONS,
  AVATAR_KINDS,
  AvatarImportError,
  avatarConfigUpdateSchema,
  avatarOwnerRefSchema,
  createAvatarConfig,
  isAvatarFilePath,
  type AvatarConfig,
  type AvatarConfigUpdate,
  type AvatarFormatImporter,
  type AvatarKind,
  type AvatarOwnerRef,
} from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { validationDetails } from "../middleware/error-handler.js";
import { AVATAR_FORMAT_IMPORTERS, findAvatarImporter } from "../services/avatars/formats/registry.js";
import {
  AVATAR_IMPORT_MAX_BYTES,
  AVATAR_MODELS_DIR,
  AvatarStorageError,
  listAvatarOwners,
  readAvatarConfig,
  removeAvatarKind,
  removeAvatarOwner,
  resolveAvatarFile,
  saveExtractedAvatar,
  updateAvatarConfig,
} from "../services/avatars/storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { sendValidatedMediaFile, validateImageAssetFile } from "../utils/media-file-security.js";
import type { MarinaraRouteRateLimit } from "../middleware/rate-limit.js";

type OwnerParams = { ownerType: string; ownerId: string };

/** The global default bucket (rate-limit.ts DEFAULT_RULE), declared on each route. A PNGTuber avatar loads
 *  one file per layer picture, so the file route needs the full default rather than a tighter limit. */
const AVATAR_MODELS_RATE_LIMIT = { max: 600, timeWindow: 60_000 } as const satisfies MarinaraRouteRateLimit;
const routeOptions = { config: { rateLimit: AVATAR_MODELS_RATE_LIMIT } };

/** Detection reads at most this much of an upload (AvatarFormatImporter.detect). */
const IMPORT_HEAD_BYTES = 64 * 1024;
/** Model files keep their name when re-imported, so the browser revalidates instead of caching forever. */
const MODEL_CACHE_CONTROL = "private, no-cache";
const MODEL_MAGIC: Readonly<Record<Exclude<AvatarKind, "pngtuber">, { mimeType: string; magic: readonly Buffer[] }>> = {
  // A ZIP archive: a local file header, or the end record of an empty archive.
  "mesh-avatar": { mimeType: "application/zip", magic: [Buffer.from("PK\x03\x04"), Buffer.from("PK\x05\x06")] },
  // glTF binary (VRM models and VRMA animations are both GLB files).
  vrm: { mimeType: "model/gltf-binary", magic: [Buffer.from("glTF")] },
};

function parseOwner(params: OwnerParams): AvatarOwnerRef | null {
  const parsed = avatarOwnerRefSchema.safeParse({ ownerType: params.ownerType, ownerId: params.ownerId });
  return parsed.success ? parsed.data : null;
}

function isAvatarKind(value: unknown): value is AvatarKind {
  return typeof value === "string" && (AVATAR_KINDS as readonly string[]).includes(value);
}

function readMultipartField(fields: unknown, key: string): string {
  if (!fields || typeof fields !== "object") return "";
  const value = (fields as Record<string, unknown>)[key];
  const field = Array.isArray(value) ? value[0] : value;
  const raw = field && typeof field === "object" ? (field as { value?: unknown }).value : undefined;
  return typeof raw === "string" ? raw.trim() : "";
}

function sendStorageError(reply: FastifyReply, error: unknown) {
  if (error instanceof AvatarStorageError) return reply.status(error.statusCode).send({ error: error.message });
  throw error;
}

/** Opens a stored model file whose first bytes match its kind, or null. The path must stay inside the avatar
 *  folder both as written and after resolving symlinks (resolveAvatarFile already checked the first; the
 *  prefix checks here repeat it where code scanning can see it). */
async function openModelFile(filePath: string, kind: Exclude<AvatarKind, "pngtuber">) {
  let handle: FileHandle | null = null;
  try {
    const resolvedPath = resolve(filePath);
    if (!resolvedPath.startsWith(`${resolve(AVATAR_MODELS_DIR)}${sep}`)) return null;
    const canonicalRoot = await realpath(AVATAR_MODELS_DIR);
    const canonicalPath = await realpath(resolvedPath);
    if (!canonicalPath.startsWith(`${canonicalRoot}${sep}`)) return null;
    handle = await open(canonicalPath, "r");
    const info = await handle.stat();
    if (!info.isFile()) throw new Error("not a file");
    const head = Buffer.alloc(4);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    const { mimeType, magic } = MODEL_MAGIC[kind];
    if (bytesRead < 4 || !magic.some((expected) => head.equals(expected))) throw new Error("unexpected content");
    return { mimeType, handle, size: info.size };
  } catch {
    await handle?.close().catch(() => undefined);
    return null;
  }
}

export async function avatarModelsRoutes(app: FastifyInstance) {
  const characters = createCharactersStorage(app.db);

  async function ownerExists(owner: AvatarOwnerRef): Promise<boolean> {
    return owner.ownerType === "character"
      ? Boolean(await characters.getById(owner.ownerId))
      : Boolean(await characters.getPersona(owner.ownerId));
  }

  /** After a write: when the character or persona was deleted while the request ran, its delete may have
   *  removed the folder before this write landed, so remove it again. Deletes drop the row before the folder,
   *  so a later delete still finds the folder. */
  async function ownerGoneAfterWrite(owner: AvatarOwnerRef): Promise<boolean> {
    if (await ownerExists(owner)) return false;
    await removeAvatarOwner(owner);
    return true;
  }

  app.get("/", routeOptions, async () => listAvatarOwners());

  app.get<{ Params: OwnerParams }>("/:ownerType/:ownerId", routeOptions, async (req, reply) => {
    const owner = parseOwner(req.params);
    if (!owner) return reply.status(400).send({ error: "Invalid character or persona" });
    const config = await readAvatarConfig(owner);
    if (config) return config;
    if (!(await ownerExists(owner))) return reply.status(404).send({ error: "Character or persona not found" });
    // JSON null, not a 404: picking an owner without an avatar is normal, and the browser logs every 404.
    return reply.type("application/json").send("null");
  });

  app.put<{ Params: OwnerParams; Body: AvatarConfigUpdate }>(
    "/:ownerType/:ownerId",
    routeOptions,
    async (req, reply) => {
      const owner = parseOwner(req.params);
      if (!owner) return reply.status(400).send({ error: "Invalid character or persona" });
      const parsed = avatarConfigUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        const [issue] = validationDetails(parsed.error.issues);
        return reply.status(400).send({ error: issue?.message ?? "Invalid avatar settings" });
      }
      if (!(await ownerExists(owner))) return reply.status(404).send({ error: "Character or persona not found" });
      const update = parsed.data;
      try {
        const config = await updateAvatarConfig(owner, (current): AvatarConfig => {
          const now = new Date().toISOString();
          const base = current ?? createAvatarConfig(owner, now);
          return {
            ...base,
            ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
            ...(update.activeKind !== undefined ? { activeKind: update.activeKind } : {}),
            features: { ...base.features, ...update.features },
            kinds: { ...base.kinds, ...update.kinds },
            updatedAt: now,
          };
        });
        if (await ownerGoneAfterWrite(owner)) {
          return reply.status(404).send({ error: "Character or persona not found" });
        }
        return config;
      } catch (error) {
        return sendStorageError(reply, error);
      }
    },
  );

  app.delete<{ Params: OwnerParams }>("/:ownerType/:ownerId", routeOptions, async (req, reply) => {
    const owner = parseOwner(req.params);
    if (!owner) return reply.status(400).send({ error: "Invalid character or persona" });
    await removeAvatarOwner(owner);
    return reply.status(204).send();
  });

  app.delete<{ Params: OwnerParams & { kind: string } }>(
    "/:ownerType/:ownerId/kinds/:kind",
    routeOptions,
    async (req, reply) => {
      const owner = parseOwner(req.params);
      if (!owner) return reply.status(400).send({ error: "Invalid character or persona" });
      if (!isAvatarKind(req.params.kind)) return reply.status(400).send({ error: "Unknown avatar kind" });
      try {
        const config = await removeAvatarKind(owner, req.params.kind);
        // JSON null when nothing remains, so the client always gets a body to parse.
        return reply.type("application/json").send(JSON.stringify(config));
      } catch (error) {
        return sendStorageError(reply, error);
      }
    },
  );

  app.post<{ Params: OwnerParams }>("/:ownerType/:ownerId/import", routeOptions, async (req, reply) => {
    const owner = parseOwner(req.params);
    if (!owner) return reply.status(400).send({ error: "Invalid character or persona" });
    if (!(await ownerExists(owner))) return reply.status(404).send({ error: "Character or persona not found" });

    // The global multipart cap (AVATAR_IMPORT_MAX_BYTES) is the only size limit.
    const data = await req.file({ limits: { fileSize: AVATAR_IMPORT_MAX_BYTES, files: 1 } });
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    const requestedKind = readMultipartField(data.fields, "kind");
    if (requestedKind && !isAvatarKind(requestedKind)) {
      data.file.resume();
      return reply.status(400).send({ error: "Unknown avatar kind" });
    }
    const kind = requestedKind ? (requestedKind as AvatarKind) : undefined;

    let bytes: Buffer;
    try {
      bytes = await data.toBuffer();
    } catch (error) {
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        return reply.status(413).send({ error: "This file is larger than the upload limit." });
      }
      throw error;
    }
    if ((data.file as typeof data.file & { truncated?: boolean }).truncated === true) {
      return reply.status(413).send({ error: "This file is larger than the upload limit." });
    }

    const filename = data.filename || "avatar";
    const extension = extname(filename).toLowerCase();
    const head = bytes.subarray(0, IMPORT_HEAD_BYTES);
    // A file of a kind's extension goes to that kind's importer even when it does not recognise the
    // bytes, so the person gets its plain refusal ("can't be imported yet" or why the file is broken).
    const importer: AvatarFormatImporter | null =
      findAvatarImporter({ filename, head }, kind) ??
      AVATAR_FORMAT_IMPORTERS.find(
        (candidate) => (kind === undefined || candidate.kind === kind) && candidate.extensions.includes(extension),
      ) ??
      null;
    if (!importer) {
      const extensions = (kind ? AVATAR_IMPORT_EXTENSIONS[kind] : Object.values(AVATAR_IMPORT_EXTENSIONS).flat()).join(
        ", ",
      );
      return reply.status(415).send({ error: `Choose a ${extensions} file.`, code: "unsupported-format" });
    }

    const input = { owner, filename, bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) };
    try {
      const validated = await importer.validate(input);
      const extracted = await importer.extract(validated, input);
      if (extracted.kind !== importer.kind) throw new AvatarImportError("invalid-file", "This file couldn't be read.");
      const result = await saveExtractedAvatar(owner, extracted);
      if (await ownerGoneAfterWrite(owner)) {
        return reply.status(404).send({ error: "Character or persona not found" });
      }
      logger.info("[avatars] Imported a %s avatar for %s %s", result.kind, owner.ownerType, owner.ownerId);
      return result;
    } catch (error) {
      if (error instanceof AvatarImportError) {
        return reply
          .status(error.code === "unsupported-format" ? 415 : 400)
          .send({ error: error.message, code: error.code });
      }
      if (error instanceof AvatarStorageError) return sendStorageError(reply, error);
      logger.error(error, "[avatars] Import of %s failed for %s %s", importer.kind, owner.ownerType, owner.ownerId);
      return reply.status(500).send({ error: "This file couldn't be imported." });
    }
  });

  app.get<{ Params: OwnerParams & { kind: string; name: string } }>(
    "/:ownerType/:ownerId/files/:kind/:name",
    routeOptions,
    async (req, reply) => {
      const owner = parseOwner(req.params);
      const { kind, name } = req.params;
      const path = `${kind}/${name}`;
      if (!owner || !isAvatarKind(kind) || !isAvatarFilePath(path)) {
        return reply.status(400).send({ error: "Invalid path" });
      }
      const filePath = resolveAvatarFile(owner, path);
      const sendOptions = { method: req.method, rangeHeader: req.headers.range, cacheControl: MODEL_CACHE_CONTROL };
      if (kind === "pngtuber") {
        // PNGTuber layers are raster images only; SVG is never served from here.
        const image = await validateImageAssetFile(filePath, name);
        if (!image) return reply.status(404).send({ error: "Not found" });
        return sendValidatedMediaFile(reply, image, sendOptions);
      }
      if (!AVATAR_IMPORT_EXTENSIONS[kind].includes(extname(name).toLowerCase())) {
        return reply.status(404).send({ error: "Not found" });
      }
      const model = await openModelFile(filePath, kind);
      if (!model) return reply.status(404).send({ error: "Not found" });
      return sendValidatedMediaFile(reply, model, sendOptions);
    },
  );
}

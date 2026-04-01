// ──────────────────────────────────────────────
// Routes: Characters, Personas & Groups
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  createCharacterSchema,
  createGroupSchema,
  updateGroupSchema,
  createPersonaGroupSchema,
  updatePersonaGroupSchema,
  PROFESSOR_MARI_ID,
} from "@marinara-engine/shared";
import type { ExportEnvelope } from "@marinara-engine/shared";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { DATA_DIR } from "../utils/data-dir.js";
import { existsSync } from "fs";

export async function charactersRoutes(app: FastifyInstance) {
  const storage = createCharactersStorage(app.db);

  // ── Characters ──

  app.get("/", async () => {
    return storage.list();
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });
    return char;
  });

  app.post("/", async (req) => {
    const input = createCharacterSchema.parse(req.body);
    const body = req.body as Record<string, unknown>;
    const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath : undefined;
    return storage.create(input.data, avatarPath);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const body = req.body as Record<string, unknown>;
    const update = createCharacterSchema.partial().parse(req.body);
    const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath : undefined;
    return storage.update(req.params.id, update.data ?? {}, avatarPath);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (req.params.id === PROFESSOR_MARI_ID) {
      return reply.status(403).send({ error: "Professor Mari is a built-in character and cannot be deleted" });
    }
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // ── Export ──

  app.get<{ Params: { id: string } }>("/:id/export", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });
    const charData = JSON.parse(char.data);
    const envelope: ExportEnvelope = {
      type: "marinara_character",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { spec: "chara_card_v2", spec_version: "2.0", data: charData },
    };
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(charData.name || "character")}.marinara.json"`,
      )
      .send(envelope);
  });

  // ── Export as PNG ──

  app.get<{ Params: { id: string } }>("/:id/export-png", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const charData = JSON.parse(char.data);
    const v2Envelope = { spec: "chara_card_v2", spec_version: "2.0", data: charData };
    const charaBase64 = Buffer.from(JSON.stringify(v2Envelope), "utf-8").toString("base64");

    // Read avatar image or create a minimal 1x1 transparent PNG fallback
    let pngBuffer: Buffer;
    if (char.avatarPath) {
      // avatarPath is like /api/avatars/file/abc123.png — extract filename
      const filename = char.avatarPath.split("/").pop()!;
      const avatarFile = join(DATA_DIR, "avatars", filename);
      if (existsSync(avatarFile)) {
        pngBuffer = await readFile(avatarFile);
      } else {
        pngBuffer = createMinimalPng();
      }
    } else {
      pngBuffer = createMinimalPng();
    }

    // Inject "chara" tEXt chunk into the PNG
    const resultPng = injectTextChunk(pngBuffer, "chara", charaBase64);

    const safeName = encodeURIComponent(charData.name || "character");
    return reply
      .header("Content-Type", "image/png")
      .header("Content-Disposition", `attachment; filename="${safeName}.png"`)
      .send(Buffer.from(resultPng));
  });

  // ── Avatar Upload ──

  app.post<{ Params: { id: string } }>("/:id/avatar", async (req, reply) => {
    const { id } = req.params;
    const char = await storage.getById(id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const body = req.body as { avatar?: string; filename?: string };
    if (!body.avatar) {
      return reply.status(400).send({ error: "No avatar data provided" });
    }

    // avatar is a base64 data URL or raw base64
    let base64 = body.avatar;
    let ext = "png";
    if (base64.startsWith("data:")) {
      const match = base64.match(/^data:image\/([\w+]+);base64,/);
      if (match?.[1]) {
        ext = match[1].replace("+xml", "");
        base64 = base64.slice(base64.indexOf(",") + 1);
      }
    }

    const avatarsDir = join(DATA_DIR, "avatars");
    await mkdir(avatarsDir, { recursive: true });
    const filename = `${id}.${ext}`;
    const filepath = join(avatarsDir, filename);
    await writeFile(filepath, Buffer.from(base64, "base64"));

    const avatarPath = `/api/avatars/file/${filename}`;
    return storage.updateAvatar(id, avatarPath);
  });

  // ── Personas ──

  app.get("/personas/list", async () => {
    return storage.listPersonas();
  });

  app.get<{ Params: { id: string } }>("/personas/:id", async (req, reply) => {
    const persona = await storage.getPersona(req.params.id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });
    return persona;
  });

  app.post("/personas", async (req) => {
    const { name, description } = req.body as { name: string; description?: string };
    return storage.createPersona(name, description ?? "");
  });

  app.patch<{ Params: { id: string } }>("/personas/:id", async (req) => {
    const body = req.body as Record<string, unknown>;
    return storage.updatePersona(req.params.id, body);
  });

  app.post<{ Params: { id: string } }>("/personas/:id/avatar", async (req, reply) => {
    const body = req.body as { avatar?: string; filename?: string };
    if (!body.avatar) return reply.status(400).send({ error: "No avatar data" });
    let base64 = body.avatar;
    if (base64.includes(",")) base64 = base64.split(",")[1]!;
    const filename = body.filename ?? `persona-${req.params.id}-${Date.now()}.png`;
    const avatarsDir = join(DATA_DIR, "avatars");
    await mkdir(avatarsDir, { recursive: true });
    const filepath = join(avatarsDir, filename);
    await writeFile(filepath, Buffer.from(base64, "base64"));
    const avatarPath = `/api/avatars/file/${filename}`;
    return storage.updatePersona(req.params.id, { avatarPath });
  });

  app.put<{ Params: { id: string } }>("/personas/:id/activate", async (req) => {
    await storage.setActivePersona(req.params.id);
    return { success: true };
  });

  app.delete<{ Params: { id: string } }>("/personas/:id", async (req, reply) => {
    await storage.removePersona(req.params.id);
    return reply.status(204).send();
  });

  // ── Persona Export ──

  app.get<{ Params: { id: string } }>("/personas/:id/export", async (req, reply) => {
    const persona = await storage.getPersona(req.params.id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });
    const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      avatarPath: _a,
      isActive: _ia,
      ...personaData
    } = persona as Record<string, unknown>;
    const envelope: ExportEnvelope = {
      type: "marinara_persona",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: personaData,
    };
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(String(persona.name || "persona"))}.marinara.json"`,
      )
      .send(envelope);
  });

  // ── Character Groups ──

  app.get("/groups/list", async () => {
    return storage.listGroups();
  });

  app.get<{ Params: { id: string } }>("/groups/:id", async (req, reply) => {
    const group = await storage.getGroupById(req.params.id);
    if (!group) return reply.status(404).send({ error: "Group not found" });
    return group;
  });

  app.post("/groups", async (req) => {
    const input = createGroupSchema.parse(req.body);
    return storage.createGroup(input.name, input.description ?? "", input.characterIds ?? []);
  });

  app.patch<{ Params: { id: string } }>("/groups/:id", async (req) => {
    const input = updateGroupSchema.parse(req.body);
    return storage.updateGroup(req.params.id, input);
  });

  app.delete<{ Params: { id: string } }>("/groups/:id", async (req, reply) => {
    await storage.removeGroup(req.params.id);
    return reply.status(204).send();
  });

  // ── Persona Groups ──

  app.get("/persona-groups/list", async () => {
    return storage.listPersonaGroups();
  });

  app.get<{ Params: { id: string } }>("/persona-groups/:id", async (req, reply) => {
    const group = await storage.getPersonaGroupById(req.params.id);
    if (!group) return reply.status(404).send({ error: "Persona group not found" });
    return group;
  });

  app.post("/persona-groups", async (req) => {
    const input = createPersonaGroupSchema.parse(req.body);
    return storage.createPersonaGroup(input.name, input.description ?? "", input.personaIds ?? []);
  });

  app.patch<{ Params: { id: string } }>("/persona-groups/:id", async (req) => {
    const input = updatePersonaGroupSchema.parse(req.body);
    return storage.updatePersonaGroup(req.params.id, input);
  });

  app.delete<{ Params: { id: string } }>("/persona-groups/:id", async (req, reply) => {
    await storage.removePersonaGroup(req.params.id);
    return reply.status(204).send();
  });
}

// ── PNG helpers ──

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Create a minimal 1×1 transparent PNG (for characters without avatars). */
function createMinimalPng(): Buffer {
  // IHDR chunk data: 1×1, 8-bit RGBA
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type (RGBA)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  // IDAT: deflate-compressed scanline (filter byte 0 + 4 zero bytes for transparent pixel)
  // Pre-computed deflate of [0, 0, 0, 0, 0]
  const idatData = Buffer.from([0x78, 0x01, 0x62, 0x60, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x05, 0x00, 0x01]);

  const chunks: Buffer[] = [
    PNG_SIGNATURE,
    buildChunk("IHDR", ihdrData),
    buildChunk("IDAT", idatData),
    buildChunk("IEND", Buffer.alloc(0)),
  ];
  return Buffer.concat(chunks);
}

/** Build a single PNG chunk (length + type + data + CRC). */
function buildChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput) >>> 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

/** Inject a tEXt chunk into an existing PNG buffer, right before the first IDAT. */
function injectTextChunk(png: Buffer, keyword: string, text: string): Buffer {
  // Validate PNG signature
  if (png.subarray(0, 8).compare(PNG_SIGNATURE) !== 0) {
    throw new Error("Invalid PNG signature");
  }

  // Build the tEXt chunk: keyword\0text
  const textData = Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0]), Buffer.from(text, "latin1")]);
  const textChunk = buildChunk("tEXt", textData);

  // Walk chunks, insert before first IDAT
  const parts: Buffer[] = [PNG_SIGNATURE];
  let offset = 8;
  let inserted = false;

  while (offset < png.length) {
    const chunkLen = png.readUInt32BE(offset);
    const chunkType = png.subarray(offset + 4, offset + 8).toString("ascii");
    const totalChunkSize = 4 + 4 + chunkLen + 4; // length + type + data + crc
    const chunkBuf = png.subarray(offset, offset + totalChunkSize);

    if (chunkType === "IDAT" && !inserted) {
      parts.push(textChunk);
      inserted = true;
    }
    parts.push(chunkBuf);
    offset += totalChunkSize;
  }

  // If no IDAT found (shouldn't happen), append before end
  if (!inserted) {
    parts.splice(parts.length - 1, 0, textChunk);
  }

  return Buffer.concat(parts);
}

/** CRC-32 as used by PNG (ISO 3309 / ITU-T V.42). */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

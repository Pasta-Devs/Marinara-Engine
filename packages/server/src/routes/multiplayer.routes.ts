import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { multiplayerActionSchema, multiplayerInviteSchema, multiplayerPersonaSchema } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { MultiplayerService } from "../services/multiplayer/service.js";
import { MultiplayerError } from "../services/multiplayer/room-store.js";
import { multiplayerGuestDocument } from "../services/multiplayer/guest-document.js";
import { parseRoomGameConfig } from "./game.routes.js";

const id = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/u);
const identity = { displayName: z.string().trim().min(1).max(80), persona: multiplayerPersonaSchema };
const invitation = { inviteCode: z.string().max(2052) };
const password = z
  .string()
  .min(12)
  .max(128)
  .refine((value) => value.trim().length >= 12);
const hostAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("invite") }).strict(),
  z.object({ type: z.literal("revoke-invite") }).strict(),
  z.object({ type: z.literal("pause") }).strict(),
  z.object({ type: z.literal("resume") }).strict(),
  z.object({ type: z.literal("stop") }).strict(),
  z
    .object({
      type: z.literal("configure"),
      automaticReplies: z.boolean(),
      maxGenerations: z.number().int().min(1).max(1000),
    })
    .strict(),
  z.object({ type: z.literal("approve"), requestId: id }).strict(),
  z.object({ type: z.literal("decline"), requestId: id }).strict(),
  z.object({ type: z.literal("kick"), participantId: id }).strict(),
  z.object({ type: z.literal("pass"), participantId: id }).strict(),
  z.object({ type: z.literal("proposal-approve"), proposalId: id }).strict(),
  z.object({ type: z.literal("proposal-decline"), proposalId: id }).strict(),
  z.object({ type: z.literal("add-character"), characterId: id, role: z.enum(["character", "gm"]) }).strict(),
  z.object({ type: z.literal("remove-character"), characterId: id }).strict(),
  z
    .object({
      type: z.literal("startGame"),
      config: z.unknown().transform(parseRoomGameConfig),
      preferences: z.string().max(16_000),
      gmConnectionId: id.optional(),
      gameName: z.string().trim().min(1).max(80).optional(),
    })
    .strict(),
]);

/** These are the user's own authenticated controls. The peer listener never registers this plugin. */
export async function multiplayerRoutes(app: FastifyInstance, options: { service: MultiplayerService }) {
  const service = options.service;
  app.setErrorHandler((error, _request, reply) => {
    const code =
      error instanceof MultiplayerError ? error.code : error instanceof z.ZodError ? "invalid-message" : "unavailable";
    return reply
      .status(code === "disabled" ? 404 : code === "busy" || code === "stale-action" ? 409 : 400)
      .send({ error: code });
  });
  app.addHook("onRequest", (request, reply, done) => {
    reply.header("Cache-Control", "no-store");
    const path = request.url.split("?", 1)[0];
    if (path === "/api/multiplayer/status") return done();
    const status = service.status();
    if (!status.available || (path !== "/api/multiplayer/settings" && !status.enabled))
      return reply.status(404).send({ error: "disabled" });
    if (path === "/api/multiplayer/guest-view") return done();
    if (!requirePrivilegedAccess(request, reply, { feature: "Multiplayer controls" })) return;
    done();
  });
  app.get("/status", async () => service.status());
  app.put("/settings", { bodyLimit: 1024 }, async (request) => {
    const input = z
      .object({ enabled: z.boolean(), consent: z.literal(true) })
      .strict()
      .parse(request.body);
    return service.settings(input.enabled);
  });
  app.post("/prepare", { bodyLimit: 1024 }, async (request) =>
    service.prepare(
      z
        .union([
          z.object({ chatId: id }).strict(),
          z
            .object({ mode: z.enum(["conversation", "roleplay", "game"]), name: z.string().trim().min(1).max(80) })
            .strict(),
        ])
        .parse(request.body),
    ),
  );
  app.post("/host", { bodyLimit: 16_384 }, async (request) =>
    service.startHost(
      z
        .object({
          chatId: id,
          publicOrigin: multiplayerInviteSchema.shape.origin,
          password,
          ...identity,
          consent: z.literal(true),
        })
        .strict()
        .parse(request.body),
    ),
  );
  app.get("/host", async () => service.hostState());
  app.post("/host/action", { bodyLimit: 16_384 }, async (request) =>
    service.hostParticipantAction(multiplayerActionSchema.parse(request.body)),
  );
  app.post("/host/actions", { bodyLimit: 65_536 }, async (request) =>
    service.hostAction(hostAction.parse(request.body)),
  );
  app.post("/preview", { bodyLimit: 4096 }, async (request) =>
    service.preview(z.object(invitation).strict().parse(request.body).inviteCode),
  );
  app.post("/join", { bodyLimit: 16_384 }, async (request) => {
    if (request.headers["user-agent"]?.includes("MarinaraEngine/Android")) throw new MultiplayerError("unavailable");
    return service.join(
      z
        .object({ ...invitation, password, ...identity, consent: z.literal(true) })
        .strict()
        .parse(request.body),
    );
  });
  app.get("/guest", async () => service.guestState());
  app.post("/guest/action", { bodyLimit: 16_384 }, async (request) =>
    service.guestAction(multiplayerActionSchema.parse(request.body)),
  );
  app.delete("/guest", async () => {
    await service.leaveGuest();
    return { left: true };
  });
  app.get("/guest-view", async (request, reply) => {
    // The current Android wrapper injects its bridge into every frame, even an opaque sandbox.
    if (request.headers["user-agent"]?.includes("MarinaraEngine/Android")) throw new MultiplayerError("unavailable");
    const [javascript, css] = await Promise.all([
      readFile(new URL("../../../client/dist/multiplayer/guest.js", import.meta.url), "utf8"),
      readFile(new URL("../../../client/dist/multiplayer/guest.css", import.meta.url), "utf8"),
    ]);
    const document = multiplayerGuestDocument({ javascript, css }, randomBytes(24).toString("base64url"));
    return reply.headers(document.headers).send(document.html);
  });
}

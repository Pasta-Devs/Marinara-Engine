import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ACHIEVEMENT_EVENTS } from "@marinara-engine/shared";
import { createAchievementsService } from "../services/achievements/achievements.service.js";

const achievementTrackSchema = z.object({
  event: z.enum(ACHIEVEMENT_EVENTS),
});

export async function achievementsRoutes(app: FastifyInstance) {
  const achievements = createAchievementsService(app.db);

  app.get("/", async () => achievements.status());

  app.post("/track", async (req) => {
    const input = achievementTrackSchema.parse(req.body);
    return achievements.track(input.event);
  });
}

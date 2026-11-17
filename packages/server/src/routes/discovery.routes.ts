import type { FastifyInstance } from "fastify";
import { createDiscoveryProgressService } from "../services/discovery/discovery-progress.service.js";

/** Home "Things to try": one yes per task id that the saved data already shows as done. */
export async function discoveryRoutes(app: FastifyInstance) {
  const discovery = createDiscoveryProgressService(app.db);
  app.get("/progress", async () => discovery.progress());
}

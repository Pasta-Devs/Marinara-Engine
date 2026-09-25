// ──────────────────────────────────────────────
// Routes: community Game Mode rulesets
//
// Importing one `ruleset.json` the user picked, and removing an imported ruleset again. Both are
// administrative acts, so both sit behind `requirePrivilegedAccess`; only the import also follows
// the custom Agent import policy, because removing something has to keep working after the switch
// goes off.
//
// The file is stored EXACTLY as it arrived and filed under `local/<its own id>`, so an import can
// never take an official ruleset's id. Everything else a stored version has to satisfy is checked
// by the storage service; this file only turns its refusals into status codes.
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  communityRulesetId,
  isCommunityRulesetId,
  parseRulesetDefinition,
  rulesetRefSchema,
  RULESET_LOCAL_NAMESPACE,
  RULESET_MAX_BYTES,
} from "@marinara-engine/shared";
import { logger } from "../lib/logger.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { getCustomAgentImportPolicy } from "../services/agents/custom-agent-import-policy.service.js";
import {
  createGameRulesetsStorage,
  RulesetRefusedError,
  RulesetVersionConflictError,
  rulesetSizeIssue,
} from "../services/storage/game-rulesets.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";

/** The file text, verbatim. The byte ceiling is checked below, against bytes rather than
 *  characters, so a file of multi-byte text is measured the way the store measures it. */
const importRulesetBody = z.object({ definition: z.string().min(1) });

const removeRulesetQuery = z.object({
  // The same id shape a game's pin carries, so nothing can be removed that could never be pinned.
  rulesetId: rulesetRefSchema.shape.id,
  force: z.string().optional(),
});

/** The id a chat's pin names, or null when the chat carries no readable pin. Deliberately tolerant:
 *  this is a scan over everything a user ever created, and one unparseable blob must not stop it. */
function pinnedRulesetId(metadata: unknown): string | null {
  let parsed: unknown = metadata;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const pin = (parsed as Record<string, unknown>).gameRuleset;
  if (!pin || typeof pin !== "object" || Array.isArray(pin)) return null;
  const id = (pin as Record<string, unknown>).id;
  return typeof id === "string" ? id : null;
}

/** The file travels as one JSON string, where escaping can make a byte up to six (`\uXXXX`). Bounding
 *  the request here refuses an oversized body before it is buffered and parsed. */
const IMPORT_BODY_LIMIT = RULESET_MAX_BYTES * 6 + 16_384;

export async function gameRulesetsRoutes(app: FastifyInstance) {
  app.post("/import", { bodyLimit: IMPORT_BODY_LIMIT }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Ruleset import" })) return;
    if (!(await getCustomAgentImportPolicy(app.db)).enabled) {
      return reply.status(403).send({
        error: "Custom Agent imports are disabled",
        message: "Enable Agent imports in Advanced Settings → Danger Zone first.",
      });
    }
    const { definition } = importRulesetBody.parse(req.body);
    const sizeIssue = rulesetSizeIssue(definition);
    if (sizeIssue) return reply.status(400).send({ error: sizeIssue });

    let json: unknown;
    try {
      json = JSON.parse(definition);
    } catch {
      return reply.status(400).send({ error: "The ruleset file is not valid JSON" });
    }
    const parsed = parseRulesetDefinition(json);
    if (!parsed.ok) {
      return reply
        .status(400)
        .send({ error: `The ruleset file is not usable: ${parsed.issues.slice(0, 5).join("; ")}` });
    }

    let rulesetId: string;
    try {
      // Throws on an id the Engine owns, which is a file the user has to fix, not a server fault.
      rulesetId = communityRulesetId(RULESET_LOCAL_NAMESPACE, parsed.definition.id);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Unusable ruleset id" });
    }

    const { version } = parsed.definition;
    try {
      const { status } = await createGameRulesetsStorage(app.db).put({
        rulesetId,
        version,
        sourceKind: "local",
        definition,
      });
      logger.info("[game/rulesets] Import of %s version %d: %s", rulesetId, version, status);
      return { status, rulesetId, version };
    } catch (error) {
      if (error instanceof RulesetVersionConflictError) {
        return reply.status(409).send({ error: error.message, code: "ruleset_version_conflict" });
      }
      // The storage refusals are already sentences an author can act on. Anything else is the store
      // failing, which must not be reported as a bad file.
      if (error instanceof RulesetRefusedError) return reply.status(400).send({ error: error.message });
      throw error;
    }
  });

  // Every stored version at once: a ruleset is one thing to the user, and leaving older versions
  // behind would put it straight back in the list they just removed it from.
  app.delete("/", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Ruleset removal" })) return;
    const { rulesetId, force } = removeRulesetQuery.parse(req.query);
    if (!isCommunityRulesetId(rulesetId)) {
      return reply
        .status(400)
        .send({ error: `"${rulesetId}" is not an imported ruleset; only imports are removed here` });
    }

    const games = (await createChatsStorage(app.db).list()).filter(
      (chat) => pinnedRulesetId(chat.metadata) === rulesetId,
    ).length;
    if (games > 0 && force !== "true") {
      return reply.status(409).send({
        error:
          `${games === 1 ? "1 game plays" : `${games} games play`} on this ruleset. Removing it leaves ` +
          `${games === 1 ? "that game without its rules" : "those games without their rules"} until you import it again.`,
        code: "ruleset_in_use",
        games,
      });
    }

    const removed = await createGameRulesetsStorage(app.db).removeAll(rulesetId);
    logger.info("[game/rulesets] Removed %d version(s) of %s, pinned by %d game(s)", removed, rulesetId, games);
    return { removed, games };
  });
}

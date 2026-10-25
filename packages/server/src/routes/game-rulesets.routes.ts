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
//
// A ruleset package file (RM, `<name>.ruleset.json`) is imported the same way, as data: read in memory by
// the one reader, its ruleset and catalog files kept, nothing in it ever run. A ruleset editor checks a
// ruleset (or a package file) without saving it, opens an installed ruleset's files from its source, and builds its
// forms from the ruleset schema the Engine publishes.
// ──────────────────────────────────────────────
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  communityRulesetId,
  isCommunityRulesetId,
  parseRulesetCatalogFile,
  parseRulesetDefinition,
  rulesetRefSchema,
  RULESET_LOCAL_NAMESPACE,
  RULESET_MAX_BYTES,
  RULESET_PACKAGE_FILE_MAX_BYTES,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import { getMonorepoRoot } from "../config/runtime-config.js";
import { saveGamePartySheet } from "../services/game/game-party-sheet.service.js";
import { moveGameRulesetVersion } from "../services/game/game-ruleset-version.service.js";
import { logger } from "../lib/logger.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { GAME_RULESETS_RATE_LIMIT } from "../middleware/rate-limit.js";
import { getCustomAgentImportPolicy } from "../services/agents/custom-agent-import-policy.service.js";
import {
  createGameRulesetsStorage,
  RulesetRefusedError,
  RulesetVersionConflictError,
  rulesetSizeIssue,
} from "../services/storage/game-rulesets.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import {
  capabilityPackageManager,
  getCapabilityPackageInstallIssue,
} from "../services/capability-packages/package-manager.service.js";
import { readRulesetPackageFile } from "../services/game/ruleset-package-file.js";

/** The file text, verbatim. The byte ceiling is checked below, against bytes rather than
 *  characters, so a file of multi-byte text is measured the way the store measures it. */
const importRulesetBody = z.object({ definition: z.string().min(1) });

const removeRulesetQuery = z.object({
  // The same id shape a game's pin carries, so nothing can be removed that could never be pinned.
  rulesetId: rulesetRefSchema.shape.id,
  /** One version only (a ruleset editor installs a new version each time); every version without it. */
  version: z.coerce.number().int().positive().optional(),
  force: z.string().optional(),
});

/** A package file travels as itself, the JSON body's `package`: its size and a little more. */
const PACKAGE_BODY_LIMIT = RULESET_PACKAGE_FILE_MAX_BYTES + 16_384;
// The package file is checked whole by its reader; here it only has to be an object.
const packageFile = z.record(z.string(), z.unknown());
const importPackageBody = z.object({ package: packageFile, dryRun: z.boolean().optional() }).strict();
/** A ruleset to check: its text alone, or a whole package file (catalogs and all). */
const checkBody = z.union([
  z.object({ definition: z.string().min(1) }).strict(),
  z.object({ package: packageFile }).strict(),
]);
const sourceQuery = z.object({ rulesetId: rulesetRefSchema.shape.id, version: z.coerce.number().int().positive() });

/** A parser's `path: message` lines as `{ path, message }`, so an editor can show each where it points. */
function issueObjects(lines: readonly string[]): Array<{ path: string; message: string }> {
  return lines.map((line) => {
    const at = line.indexOf(": ");
    return at > 0 ? { path: line.slice(0, at), message: line.slice(at + 2) } : { path: "", message: line };
  });
}

/** The least capability API a package of this ruleset needs, by the install's own gates; null when no
 *  API this Engine knows is enough. So an editor writes a manifest the catalog's packages would pass. */
function leastCapabilityApi(
  document: unknown,
  definition: RulesetDefinition,
  catalogs: Record<string, string>,
  /** The ruleset's own text, whose size a package of it declares (a larger one needs 1.340). */
  rulesetText: string,
) {
  const paths = [
    "ruleset.json",
    ...(definition.catalogs ?? []).flatMap((catalog) => (catalog.asset ? [catalog.asset] : [])),
  ];
  // Keyed by each catalog's file, as an install reads them.
  const catalogDocuments = new Map<string, unknown>(
    (definition.catalogs ?? []).flatMap((catalog) => {
      const text = catalog.asset ? catalogs[catalog.id] : undefined;
      if (!catalog.asset || text === undefined) return [];
      try {
        return [[catalog.asset, JSON.parse(text) as unknown] as const];
      } catch {
        return [[catalog.asset, null] as const];
      }
    }),
  );
  const catalogTexts = new Map(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.asset && catalogs[catalog.id] !== undefined ? [[catalog.asset, catalogs[catalog.id]!] as const] : [],
    ),
  );
  const bytesOf = (path: string) => {
    if (path === "ruleset.json") return Buffer.byteLength(rulesetText);
    const text = catalogTexts.get(path);
    return text === undefined ? 1 : Buffer.byteLength(text);
  };
  for (let minor = 0; minor <= supportedCapabilityApi.minor; minor++) {
    const manifest = {
      schemaVersion: 2,
      id: "ruleset-check",
      name: "Ruleset check",
      version: "0.0.0",
      description: "",
      engine: { min: "0.0.0", maxExclusive: "999.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: bytesOf(path) })),
      permissions: [],
      restartRequired: false,
      capabilityApi: { major: supportedCapabilityApi.major, minor },
      builtAgainst: { engineVersion: "0.0.0", engineCommit: "0".repeat(40) },
    } as unknown as Parameters<typeof getCapabilityPackageInstallIssue>[0];
    if (!getCapabilityPackageInstallIssue(manifest, document, catalogDocuments)) {
      return { major: supportedCapabilityApi.major, minor };
    }
  }
  return null;
}

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

/** The version a chat's pin names, read as tolerantly. */
function pinnedRulesetVersion(metadata: unknown): number | null {
  try {
    const parsed = typeof metadata === "string" ? (JSON.parse(metadata) as unknown) : metadata;
    const version = (parsed as { gameRuleset?: { version?: unknown } } | null)?.gameRuleset?.version;
    return typeof version === "number" ? version : null;
  } catch {
    return null;
  }
}

/** The file travels as one JSON string, where escaping can make a byte up to six (`\uXXXX`). Bounding
 *  the request here refuses an oversized body before it is buffered and parsed. */
const IMPORT_BODY_LIMIT = RULESET_MAX_BYTES * 6 + 16_384;

const gameVersionRequestSchema = z
  .object({ chatId: z.string().min(1).max(200), version: z.number().int().min(1) })
  .strict();

const partySheetRequestSchema = z
  .object({
    chatId: z.string().min(1).max(200),
    sheet: z.unknown().optional(),
    revision: z.number().int().min(0).max(1_000_000_000),
  })
  .strict();

export async function gameRulesetsRoutes(app: FastifyInstance) {
  // A game moved onto a newer stored version of its imported ruleset, from the Journal. The game's
  // own choice, as its other settings are: not an administrative gate.
  app.post("/game-version", { config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async (req, reply) => {
    const parsed = gameVersionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", issues: parsed.error.issues.slice(0, 10) });
    }
    const moved = await moveGameRulesetVersion(app.db, parsed.data);
    if (!moved.ok) return reply.status(moved.status).send({ error: moved.error });
    return { version: moved.version };
  });

  // The party's shared sheet (1.163), saved on the revision it was opened at.
  // A party member's save, like a character sheet's: behind the server's own access, not an administrative gate.
  app.post("/party-sheet", { config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async (req, reply) => {
    const parsed = partySheetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid party sheet", issues: parsed.error.issues.slice(0, 10) });
    }
    const saved = await saveGamePartySheet(app.db, { ...parsed.data, sheet: parsed.data.sheet });
    if (!saved.ok) {
      const { ok: _ok, status, ...refused } = saved;
      return reply.status(status).send(refused);
    }
    return { revision: saved.revision, sheet: saved.sheet };
  });

  app.post("/import", { bodyLimit: IMPORT_BODY_LIMIT }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Ruleset import" })) return;
    if (!(await getCustomAgentImportPolicy(app.db)).enabled) {
      return reply.status(403).send({
        error: "Custom Agent imports are disabled",
        message: "Enable Agent imports in Advanced Settings → Danger Zone first.",
        code: "custom_agent_imports_disabled",
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

  // A ruleset package file (RM): read in memory by the one reader, kept as data under
  // `local/<its id>` with its catalog files. `dryRun` reads and checks it for the review, keeping nothing.
  app.post(
    "/import-package",
    { bodyLimit: PACKAGE_BODY_LIMIT, config: { rateLimit: GAME_RULESETS_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Ruleset import" })) return;
      if (!(await getCustomAgentImportPolicy(app.db)).enabled) {
        return reply.status(403).send({
          error: "Custom Agent imports are disabled",
          message: "Enable Agent imports in Advanced Settings → Danger Zone first.",
          code: "custom_agent_imports_disabled",
        });
      }
      const body = importPackageBody.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Send the ruleset package file (.ruleset.json) as the body's package" });
      }
      const { package: file, dryRun } = body.data;
      const read = readRulesetPackageFile(file);
      if (!read.ok) return reply.status(400).send({ error: read.issues.slice(0, 5).join("; "), issues: read.issues });
      let rulesetId: string;
      try {
        rulesetId = communityRulesetId(RULESET_LOCAL_NAMESPACE, read.definition.id);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Unusable ruleset id" });
      }
      const { version } = read.definition;
      const catalogs = Object.fromEntries(
        Object.entries(read.catalogs).map(([id, text]) => [
          id,
          (JSON.parse(text) as { entries?: unknown[] }).entries?.length ?? 0,
        ]),
      );
      if (dryRun) return { status: "checked", rulesetId, version, ruleset: read.ruleset, catalogs };
      try {
        const { status } = await createGameRulesetsStorage(app.db).put({
          rulesetId,
          version,
          sourceKind: "local",
          definition: read.ruleset,
          catalogs: read.catalogs,
        });
        logger.info(
          "[game/rulesets] Package import of %s version %d (%d catalog files): %s",
          rulesetId,
          version,
          Object.keys(catalogs).length,
          status,
        );
        return { status, rulesetId, version, catalogs };
      } catch (error) {
        if (error instanceof RulesetVersionConflictError) {
          return reply.status(409).send({ error: error.message, code: "ruleset_version_conflict" });
        }
        if (error instanceof RulesetRefusedError) return reply.status(400).send({ error: error.message });
        throw error;
      }
    },
  );

  // A ruleset checked without saving anything: its text, or a whole package file. The issues come as
  // `{ path, message }` for an editor to show where each points, with the least capability API a package
  // of it needs; a package file also comes back read, so an editor opens one through this reader and no other.
  app.post(
    "/check",
    { bodyLimit: PACKAGE_BODY_LIMIT, config: { rateLimit: GAME_RULESETS_RATE_LIMIT } },
    async (req, reply) => {
      // Reading a package costs real work, so only the Engine's own pages (and makers in them) may ask.
      if (!requirePrivilegedAccess(req, reply, { feature: "Ruleset check" })) return;
      const body = checkBody.safeParse(req.body);
      if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Nothing to check" });
      if ("package" in body.data) {
        const read = readRulesetPackageFile(body.data.package);
        if (!read.ok) return { ok: false, issues: issueObjects(read.issues), capabilityApi: null };
        return {
          ok: true,
          issues: [],
          capabilityApi: leastCapabilityApi(JSON.parse(read.ruleset), read.definition, read.catalogs, read.ruleset),
          ruleset: read.ruleset,
          catalogs: read.catalogs,
        };
      }
      const sizeIssue = rulesetSizeIssue(body.data.definition);
      if (sizeIssue) return { ok: false, issues: issueObjects([sizeIssue]), capabilityApi: null };
      let document: unknown;
      try {
        document = JSON.parse(body.data.definition);
      } catch {
        return { ok: false, issues: issueObjects(["(root): the ruleset is not valid JSON"]), capabilityApi: null };
      }
      const parsed = parseRulesetDefinition(document);
      if (!parsed.ok) return { ok: false, issues: issueObjects(parsed.issues), capabilityApi: null };
      return {
        ok: true,
        issues: [],
        capabilityApi: leastCapabilityApi(document, parsed.definition, {}, body.data.definition),
      };
    },
  );

  // The ruleset JSON Schema the Engine publishes for authors (docs/extending/ruleset.schema.json, kept
  // current by `pnpm ruleset:schema`), so an editor builds its forms from the Engine's own idea of a
  // ruleset instead of a copy of it. An install without the docs has none to give.
  app.get("/schema", { config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async (_req, reply) => {
    let text: string;
    try {
      text = await readFile(join(getMonorepoRoot(), "docs", "extending", "ruleset.schema.json"), "utf8");
    } catch {
      return reply.status(404).send({ error: "This install has no ruleset schema" });
    }
    return reply.type("application/json; charset=utf-8").send(text);
  });

  // An installed ruleset's files, as written: a stored one's texts (its catalog files from its row), or a
  // package's ruleset.json and catalogs/*.json (verified reads; a package's assets are public already).
  app.get("/source", { config: { rateLimit: GAME_RULESETS_RATE_LIMIT } }, async (req, reply) => {
    const { rulesetId, version } = sourceQuery.parse(req.query);
    if (isCommunityRulesetId(rulesetId)) {
      const store = createGameRulesetsStorage(app.db);
      const row = await store.get(rulesetId, version);
      if (!row) return reply.status(404).send({ error: "No such ruleset version is installed" });
      const catalogs: Record<string, string> = {};
      for (const id of Object.keys(row.catalogs ? (JSON.parse(row.catalogs) as Record<string, string>) : {})) {
        const stored = await store.catalogText(rulesetId, version, id);
        if (!stored) return reply.status(409).send({ error: `The catalog "${id}" of this ruleset is not intact` });
        catalogs[id] = stored.text;
      }
      return { rulesetId, version, ruleset: row.definition, catalogs };
    }
    for (const source of await capabilityPackageManager.rulesetSources()) {
      const text = source.data.toString("utf8");
      let parsed: ReturnType<typeof parseRulesetDefinition>;
      try {
        parsed = parseRulesetDefinition(JSON.parse(text));
      } catch {
        continue;
      }
      if (!parsed.ok || parsed.definition.id !== rulesetId || parsed.definition.version !== version) continue;
      const catalogs: Record<string, string> = {};
      for (const catalog of parsed.definition.catalogs ?? []) {
        if (!catalog.asset) continue;
        const asset = await capabilityPackageManager.rulesetCatalogAsset(source.packageId, catalog.id);
        const file = asset && !("issue" in asset) ? await asset.read() : null;
        if (!file || "issue" in file)
          return reply.status(409).send({ error: `The catalog "${catalog.id}" of this ruleset is not intact` });
        const catalogText = file.data.toString("utf8");
        try {
          if (!parseRulesetCatalogFile(parsed.definition, catalog.id, JSON.parse(catalogText)).ok) throw new Error();
        } catch {
          return reply.status(409).send({ error: `The catalog "${catalog.id}" of this ruleset does not read` });
        }
        catalogs[catalog.id] = catalogText;
      }
      return { rulesetId, version, packageId: source.packageId, ruleset: text, catalogs };
    }
    return reply.status(404).send({ error: "No such ruleset version is installed" });
  });

  // Every stored version at once: a ruleset is one thing to the user, and leaving older versions
  // behind would put it straight back in the list they just removed it from. With `version`, that one
  // version alone (a ruleset editor installs a new version each time).
  app.delete("/", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Ruleset removal" })) return;
    const { rulesetId, version, force } = removeRulesetQuery.parse(req.query);
    if (!isCommunityRulesetId(rulesetId)) {
      return reply
        .status(400)
        .send({ error: `"${rulesetId}" is not an imported ruleset; only imports are removed here` });
    }

    const games = (await createChatsStorage(app.db).list()).filter(
      (chat) =>
        pinnedRulesetId(chat.metadata) === rulesetId &&
        (version === undefined || pinnedRulesetVersion(chat.metadata) === version),
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

    const store = createGameRulesetsStorage(app.db);
    if (version !== undefined) {
      if (!(await store.get(rulesetId, version)))
        return reply.status(404).send({ error: "No such ruleset version is installed" });
      await store.remove(rulesetId, version);
      logger.info("[game/rulesets] Removed version %d of %s, pinned by %d game(s)", version, rulesetId, games);
      return { removed: 1, games };
    }
    const removed = await store.removeAll(rulesetId);
    logger.info("[game/rulesets] Removed %d version(s) of %s, pinned by %d game(s)", removed, rulesetId, games);
    return { removed, games };
  });
}

import { z } from "zod";
import { agentResultTypeSchema } from "./agent.schema.js";

export const capabilityPackageKindSchema = z.enum(["agent", "maps", "conversation-calls", "turn-game"]);
export const capabilityPermissionSchema = z.enum([
  "agent-runtime",
  "chat-read",
  "chat-write",
  "conversation-actions",
  "network",
  "prompt-context",
  "routes",
  "storage",
  "ui",
]);

const capabilityPackageManifestBaseSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    name: z.string().min(1).max(120),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    description: z.string().max(2000).default(""),
    /** Optional translated display copy. Unknown/partial locales fall back to the canonical fields above. */
    localizations: z
      .record(
        z.string().min(2).max(35),
        z
          .object({
            name: z.string().min(1).max(120).optional(),
            description: z.string().max(2000).optional(),
            homeBrowserTab: z
              .object({
                label: z.string().min(1).max(40).optional(),
                ariaLabel: z.string().min(1).max(100).optional(),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .optional(),
    engine: z.object({ min: z.string().min(1), maxExclusive: z.string().min(1) }).strict(),
    kind: z.array(capabilityPackageKindSchema).min(1),
    entrypoints: z
      .object({
        server: z.string().optional(),
        client: z.string().optional(),
        agents: z.string().optional(),
        knowledge: z.string().optional(),
      })
      .strict(),
    contributions: z
      .object({
        slots: z
          .array(
            z.enum([
              "conversation-surface",
              "conversation-toolbar",
              "chat-settings",
              "spatial-workspace",
              "chat-runtime",
              "game-world-map",
              // Adds a top-level destination to Home's browser shell.
              "home-browser-tab",
              // Mounts the package's own game UI over the narration.
              "game-surface",
            ]),
          )
          .optional(),
        /** Options for the `game-surface` slot. */
        gameSurface: z
          .object({
            /** Class the host puts on the game area while this surface is mounted, so the package can
             *  restyle the shared chrome that renders outside its element. Declared rather than pushed at
             *  runtime, so the theme applies on first paint. */
            surfaceClass: z
              .string()
              .regex(/^[a-z][a-z0-9-]*$/)
              .max(60)
              .optional(),
          })
          .strict()
          .optional(),
        /** Browser metadata is declarative so Home can paint the tab before the client bundle loads. */
        homeBrowserTab: z
          .object({
            label: z.string().min(1).max(40),
            ariaLabel: z.string().min(1).max(100).optional(),
            /** One or two package-owned images rendered together as the compact browser-tab mark. */
            iconPaths: z
              .array(
                z
                  .string()
                  .min(1)
                  .max(240)
                  .regex(/\.(?:gif|jpe?g|png|webp)$/iu),
              )
              .min(1)
              .max(2)
              .optional(),
          })
          .strict()
          .optional(),
        /** General package-owned static assets (art, sprite atlases, tilemap JSON) served over
         *  `/api/capability-packages/:id/assets/*` through the same verification chain as
         *  browser-tab icons: path containment, `files[]` membership, a passive content-type
         *  allowlist, and hash re-verification on every read. Requires Capability API 1.10. */
        assets: z
          .object({
            paths: z
              .array(
                z
                  .string()
                  .min(1)
                  .max(240)
                  // Passive content only — images plus JSON metadata. Never SVG, HTML, or
                  // scripts: those are active documents on a same-origin route.
                  .regex(/\.(?:gif|jpe?g|png|webp|json)$/iu),
              )
              .min(1)
              // Bounded so a manifest cannot enumerate an arbitrarily large tree.
              .max(256),
          })
          .strict()
          .optional(),
        conversationGame: z
          .object({
            command: z.string().regex(/^\/[a-z0-9-]+$/),
            aliases: z.array(z.string().min(1).max(40)).default([]),
            playerLabel: z.string().min(1).max(80),
          })
          .strict()
          .optional(),
        agentDetail: z
          .object({
            agentIds: z
              .array(
                z
                  .string()
                  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                  .max(80),
              )
              .min(1)
              .max(32),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    files: z
      .array(
        z
          .object({
            path: z.string().min(1).max(240),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            bytes: z
              .number()
              .int()
              .nonnegative()
              .max(100 * 1024 * 1024),
          })
          .strict(),
      )
      .min(1),
    permissions: z.array(capabilityPermissionSchema),
    restartRequired: z.boolean().default(false),
  })
  .strict();

// 1.10: contributions.assets — general package-owned static asset delivery.
// 1.11: Experience combat seam — combatActive/combatStyle/requestCombat on the
//        game-surface capabilityProps.
// 1.12: spatial transition commit/reject/refresh capability events are also
//        addressed to the game-owning Experience package (soft seam: delivered
//        regardless of declared capabilityApi; declare 1.12 only to REQUIRE it).
// 1.13: setExperienceChrome accepts requestsCollapsedNarration — a transient request
//        to fold the Game narration box down to its handle for a cutscene beat. It
//        never writes the player's stored preference and the engine's safety rules
//        still force the box open when it holds something to act on.
export const supportedCapabilityApi = Object.freeze({ major: 1, minor: 13 } as const);

const capabilityApiVersionSchema = z
  .object({
    major: z.number().int().positive(),
    minor: z.number().int().nonnegative(),
  })
  .strict();

const capabilityPackageBuiltAgainstSchema = z
  .object({
    engineVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    engineCommit: z.string().regex(/^[a-f0-9]{40}$/),
  })
  .strict();

export const capabilityPackageManifestV1Schema = capabilityPackageManifestBaseSchema
  .extend({
    schemaVersion: z.literal(1),
  })
  .strict();

export const capabilityPackageManifestV2Schema = capabilityPackageManifestBaseSchema
  .extend({
    schemaVersion: z.literal(2),
    capabilityApi: capabilityApiVersionSchema,
    builtAgainst: capabilityPackageBuiltAgainstSchema,
  })
  .strict();

export const capabilityPackageManifestSchema = z
  .discriminatedUnion("schemaVersion", [capabilityPackageManifestV1Schema, capabilityPackageManifestV2Schema])
  .superRefine((manifest, ctx) => {
    // A game-surface package draws the whole mode from its client bundle: without a client entrypoint the
    // module loader skips it, so it would be offered in the setup wizard and then render nothing. Caught
    // here so it fails at install with a clear reason rather than as an empty screen later.
    if (manifest.contributions?.slots?.includes("game-surface") && !manifest.entrypoints.client?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entrypoints", "client"],
        message: 'A package declaring the "game-surface" slot must provide a client entrypoint to render it',
      });
    }
    if (manifest.contributions?.slots?.includes("home-browser-tab")) {
      if (!manifest.entrypoints.client?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entrypoints", "client"],
          message: 'A package declaring the "home-browser-tab" slot must provide a client entrypoint',
        });
      }
      if (!manifest.contributions.homeBrowserTab) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "homeBrowserTab"],
          message: 'A package declaring the "home-browser-tab" slot must describe its browser tab',
        });
      }
    }
    // Icon paths feed the same serve-path allowlist as general assets, so they
    // must be hash-pinned in files[] whether or not the home-browser-tab slot is
    // declared — an unpinned (or traversal-shaped) icon path would otherwise
    // reach the resolver unvalidated (review finding on #5091).
    for (const [index, iconPath] of (manifest.contributions?.homeBrowserTab?.iconPaths ?? []).entries()) {
      if (!manifest.files.some((file) => file.path === iconPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "homeBrowserTab", "iconPaths", index],
          message: "A Home browser tab icon must be declared in the package file manifest",
        });
      }
    }
    // Every declared asset must be hash-pinned in files[] — the serve path refuses
    // undeclared files, so an unlisted path would install fine and then 404 at
    // runtime. Caught here so it fails at install with a clear reason instead.
    for (const [index, assetPath] of (manifest.contributions?.assets?.paths ?? []).entries()) {
      if (!manifest.files.some((file) => file.path === assetPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "assets", "paths", index],
          message: "A declared package asset must be listed in the package file manifest",
        });
      }
    }
    // contributions.assets is a Capability API 1.10 feature. Gated here so a
    // package author gets the versioned message at build/install time instead of
    // a cryptic unrecognized-key error when an older Engine rejects the manifest.
    if (manifest.contributions?.assets) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      const declares110 = api !== null && (api.major > 1 || (api.major === 1 && api.minor >= 10));
      if (!declares110) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "assets"],
          message: "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer",
        });
      }
    }
  });

export const capabilityCatalogPackageSchema = z
  .object({
    manifest: capabilityPackageManifestSchema,
    category: z.enum(["writer", "tracker", "misc"]).default("misc"),
    artifact: z
      .object({
        url: z.string().url(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        bytes: z
          .number()
          .int()
          .positive()
          .max(100 * 1024 * 1024),
      })
      .strict(),
    iconUrl: z.string().url().optional(),
    documentationUrl: z.string().url().optional(),
  })
  .strict();

export const capabilityCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    packages: z.array(capabilityCatalogPackageSchema),
    provenance: z
      .object({
        kind: z.enum(["official", "custom"]),
        url: z.string().url(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Envelope-only catalog shape, derived from the real schema so the two cannot
 *  drift: entries stay unparsed so one package from a NEWER Engine (declaring a
 *  manifest key this Engine's strict schemas do not know yet) cannot fail the
 *  whole document, and `.strip()` (not strict, not passthrough) so newer
 *  TOP-LEVEL fields neither reject the envelope nor leak into the result. */
const capabilityCatalogEnvelopeSchema = capabilityCatalogSchema.extend({ packages: z.array(z.unknown()) }).strip();

export type CapabilityCatalogParseResult = {
  catalog: z.infer<typeof capabilityCatalogSchema>;
  /** Entries this Engine could not understand (newer manifest features). They
   *  are dropped from the catalog rather than failing it — the polite
   *  "requires capability API x.y" path only exists for entries that parse.
   *  Identified best-effort by manifest id so operators can name what vanished. */
  droppedEntries: number;
  droppedIds: string[];
};

function bestEffortCatalogEntryId(entry: unknown): string {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const manifest = (entry as Record<string, unknown>).manifest;
    if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
      const id = (manifest as Record<string, unknown>).id;
      if (typeof id === "string" && id) return id;
    }
  }
  return "(unidentifiable entry)";
}

/** Parse a downloaded catalog, tolerating individual entries this Engine is too
 *  old to understand. All-or-nothing parsing would brick the ENTIRE Agents
 *  browser (and every install/update path) the moment the official catalog
 *  publishes one package using a newer manifest field (#5091 review finding). */
export function parseCapabilityCatalogWithCompat(input: unknown): CapabilityCatalogParseResult {
  const envelope = capabilityCatalogEnvelopeSchema.parse(input);
  const packages: z.infer<typeof capabilityCatalogPackageSchema>[] = [];
  const droppedIds: string[] = [];
  for (const entry of envelope.packages) {
    const parsed = capabilityCatalogPackageSchema.safeParse(entry);
    if (parsed.success) packages.push(parsed.data);
    else droppedIds.push(bestEffortCatalogEntryId(entry));
  }
  return { catalog: { ...envelope, packages }, droppedEntries: droppedIds.length, droppedIds };
}

export const capabilityPackageReadinessSchema = z.enum(["pending", "registered", "ready", "error"]);

export const installedCapabilityPackageSchema = z.object({
  id: z.string(),
  version: z.string(),
  manifest: capabilityPackageManifestSchema,
  installedAt: z.string().datetime(),
  status: z.enum(["active", "restart-required", "error"]),
  error: z.string().nullable(),
  readiness: capabilityPackageReadinessSchema.default("pending"),
  readinessError: z.string().nullable().default(null),
  legacy: z.boolean().default(false),
  previousVersion: z.string().optional(),
});

export const installedCapabilityRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    packages: z.array(installedCapabilityPackageSchema),
  })
  .strict();

const packagedAgentPromptTemplateSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    promptTemplate: z.string(),
    description: z.string().optional(),
  })
  .strict();

export const packagedAgentDefinitionSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    name: z.string().min(1).max(120),
    description: z.string().max(2000),
    author: z.string().max(120).optional(),
    phase: z.enum(["pre_generation", "parallel", "post_processing"]),
    enabledByDefault: z.boolean(),
    defaultInjectAsSection: z.boolean().optional(),
    category: z.enum(["writer", "tracker", "misc"]),
    libraryHidden: z.boolean().optional(),
    runtimeDisabled: z.boolean().optional(),
    /** @deprecated Legacy package compatibility; author resultType in defaultSettings instead. */
    resultType: agentResultTypeSchema.optional(),
    // Installed packages on disk may still list the retired "visual_novel" mode.
    // Normalize it to "roleplay" (its behavioural successor) rather than failing the
    // whole manifest parse, which crashed server bootstrap. Dropping it instead would
    // turn a visual_novel-only allowlist into an empty one, which means "every mode".
    modeAllowlist: z
      .preprocess(
        (value) =>
          Array.isArray(value)
            ? [...new Set(value.map((mode) => (mode === "visual_novel" ? "roleplay" : mode)))]
            : value,
        z.array(z.enum(["conversation", "roleplay", "game"])),
      )
      .optional(),
    defaultTools: z.array(z.string()).optional(),
    defaultSettings: z.record(z.string(), z.unknown()).optional(),
    promptTemplates: z.array(packagedAgentPromptTemplateSchema).optional(),
    runInterval: z.number().int().positive().optional(),
    defaultPromptTemplate: z.string(),
    execution: z.enum(["pipeline", "feature", "host"]).optional(),
  })
  .strict();

export const packagedAgentDefinitionsSchema = z.array(packagedAgentDefinitionSchema);

export type CapabilityPackageManifest = z.infer<typeof capabilityPackageManifestSchema>;
export type CapabilityCatalogPackage = z.infer<typeof capabilityCatalogPackageSchema>;
export type CapabilityCatalog = z.infer<typeof capabilityCatalogSchema>;
export type InstalledCapabilityPackage = z.infer<typeof installedCapabilityPackageSchema>;
export type PackagedAgentDefinition = z.infer<typeof packagedAgentDefinitionSchema>;

export interface CapabilityPackageUpdate {
  id: string;
  name: string;
  installedVersion: string;
  version: string;
  artifactSha256: string;
  restartRequired: boolean;
}

export interface CustomAgentRepository {
  id: string;
  url: string;
  owner: string;
  name: string;
  lastDigest: string | null;
  lastSyncedAt: string | null;
  agentCount: number;
}

export type CustomAgentRepositoryChangeStatus = "new" | "updated" | "unchanged" | "removed";

export interface CustomAgentRepositoryChange {
  agentId: string;
  name: string;
  status: CustomAgentRepositoryChangeStatus;
  changedFields: string[];
  definition?: PackagedAgentDefinition;
}

export interface CustomAgentRepositoryPreview {
  repository: Pick<CustomAgentRepository, "id" | "url" | "owner" | "name">;
  digest: string;
  changes: CustomAgentRepositoryChange[];
}

export interface CustomAgentRepositoryState {
  enabled: boolean;
  repositories: CustomAgentRepository[];
}

export function getCapabilityApiCompatibilityIssue(manifest: CapabilityPackageManifest): string | null {
  if (manifest.schemaVersion === 1) return null;
  const required = manifest.capabilityApi;
  const supported = supportedCapabilityApi;
  if (required.major !== supported.major || required.minor > supported.minor) {
    return `Package requires capability API ${required.major}.${required.minor}; this Engine supports ${supported.major}.${supported.minor}`;
  }
  return null;
}

function parseCapabilityPackageVersion(value: string) {
  const prereleaseSeparator = value.indexOf("-");
  const core = prereleaseSeparator >= 0 ? value.slice(0, prereleaseSeparator) : value;
  const prerelease = prereleaseSeparator >= 0 ? value.slice(prereleaseSeparator + 1).split(".") : [];
  return { core: core.split(".").map((part) => Number.parseInt(part, 10)), prerelease };
}

export function compareCapabilityPackageVersions(left: string, right: string): number {
  const a = parseCapabilityPackageVersion(left);
  const b = parseCapabilityPackageVersion(right);
  for (let index = 0; index < Math.max(a.core.length, b.core.length); index += 1) {
    const difference = (a.core[index] ?? 0) - (b.core[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    if (a.prerelease.length === b.prerelease.length) return 0;
    return a.prerelease.length === 0 ? 1 : -1;
  }
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    const leftPart = a.prerelease[index];
    const rightPart = b.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) return leftPart === undefined ? -1 : 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/u.test(leftPart);
    const rightNumeric = /^\d+$/u.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) > Number(rightPart) ? 1 : -1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

export function isInstalledCapabilityReady(installed: InstalledCapabilityPackage): boolean {
  if (installed.status !== "active") return false;
  return !installed.manifest.entrypoints.server || installed.readiness === "ready";
}

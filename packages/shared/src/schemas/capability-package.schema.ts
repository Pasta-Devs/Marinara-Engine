import { z } from "zod";
import { agentResultTypeSchema } from "./agent.schema.js";

export const capabilityPackageKindSchema = z.enum(["agent", "maps", "conversation-calls", "turn-game"]);
export const capabilityPermissionSchema = z.enum([
  "agent-runtime",
  "chat-read",
  "chat-write",
  "network",
  "prompt-context",
  "routes",
  "storage",
  "ui",
]);

const capabilityPackageManifestBaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: z.string().min(1).max(120),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  description: z.string().max(2000).default(""),
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
          ]),
        )
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
          agentIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)).min(1).max(32),
        })
        .strict()
        .optional(),
    })
    .strict()
    .optional(),
  files: z.array(z.object({
    path: z.string().min(1).max(240),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().nonnegative().max(100 * 1024 * 1024),
  }).strict()).min(1),
  permissions: z.array(capabilityPermissionSchema),
  restartRequired: z.boolean().default(false),
}).strict();

export const supportedCapabilityApi = Object.freeze({ major: 1, minor: 0 } as const);

const capabilityApiVersionSchema = z.object({
  major: z.number().int().positive(),
  minor: z.number().int().nonnegative(),
}).strict();

const capabilityPackageBuiltAgainstSchema = z.object({
  engineVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  engineCommit: z.string().regex(/^[a-f0-9]{40}$/),
}).strict();

export const capabilityPackageManifestV1Schema = capabilityPackageManifestBaseSchema.extend({
  schemaVersion: z.literal(1),
}).strict();

export const capabilityPackageManifestV2Schema = capabilityPackageManifestBaseSchema.extend({
  schemaVersion: z.literal(2),
  capabilityApi: capabilityApiVersionSchema,
  builtAgainst: capabilityPackageBuiltAgainstSchema,
}).strict();

export const capabilityPackageManifestSchema = z.discriminatedUnion("schemaVersion", [
  capabilityPackageManifestV1Schema,
  capabilityPackageManifestV2Schema,
]);

export const capabilityCatalogPackageSchema = z.object({
  manifest: capabilityPackageManifestSchema,
  category: z.enum(["writer", "tracker", "misc"]).default("misc"),
  artifact: z.object({
    url: z.string().url(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive().max(100 * 1024 * 1024),
  }).strict(),
  iconUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
}).strict();

export const capabilityCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  packages: z.array(capabilityCatalogPackageSchema),
}).strict();

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

export const installedCapabilityRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  packages: z.array(installedCapabilityPackageSchema),
}).strict();

const packagedAgentPromptTemplateSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  promptTemplate: z.string(),
  description: z.string().optional(),
}).strict();

export const packagedAgentDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  author: z.string().max(120).optional(),
  phase: z.enum(["pre_generation", "parallel", "post_processing"]),
  enabledByDefault: z.boolean(),
  defaultInjectAsSection: z.boolean().optional(),
  category: z.enum(["writer", "tracker", "misc"]),
  libraryHidden: z.boolean().optional(),
  runtimeDisabled: z.boolean().optional(),
  resultType: agentResultTypeSchema.optional(),
  modeAllowlist: z.array(z.enum(["conversation", "roleplay", "visual_novel", "game"])).optional(),
  defaultTools: z.array(z.string()).optional(),
  defaultSettings: z.record(z.string(), z.unknown()).optional(),
  promptTemplates: z.array(packagedAgentPromptTemplateSchema).optional(),
  runInterval: z.number().int().positive().optional(),
  defaultPromptTemplate: z.string(),
  execution: z.enum(["pipeline", "feature"]).optional(),
}).strict();

export const packagedAgentDefinitionsSchema = z.array(packagedAgentDefinitionSchema);

export type CapabilityPackageManifest = z.infer<typeof capabilityPackageManifestSchema>;
export type CapabilityCatalogPackage = z.infer<typeof capabilityCatalogPackageSchema>;
export type CapabilityCatalog = z.infer<typeof capabilityCatalogSchema>;
export type InstalledCapabilityPackage = z.infer<typeof installedCapabilityPackageSchema>;
export type PackagedAgentDefinition = z.infer<typeof packagedAgentDefinitionSchema>;

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

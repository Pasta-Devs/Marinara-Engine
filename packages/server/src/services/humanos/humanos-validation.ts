import { z } from "zod";

export const humanOSSubjectTypeSchema = z.enum(["CHARACTER", "USER_PERSONA"]);

export const humanOSArchitectureSchema = z
  .object({
    schemaVersion: z.literal(2),
    subjectType: humanOSSubjectTypeSchema,
    subjectId: z.string().min(1),
    taskMode: z.enum(["CREATE", "REFINE", "MATCH", "COMPILE"]),
    layers: z.record(z.string(), z.unknown()),
    facts: z.record(z.string(), z.unknown()),
    provenanceByPath: z.record(z.string(), z.unknown()),
    retrievalPolicy: z.record(z.string(), z.unknown()),
    compiledArtifacts: z.record(z.string(), z.unknown()),
    audit: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export const humanOSRuntimeSchema = z.object({
  messageId: z.string().min(1),
  swipeIndex: z.number().int().min(0),
  committed: z.literal(true),
  state: z.record(z.string(), z.unknown()),
});

export function humanOSCompilationBlocked(architecture: z.infer<typeof humanOSArchitectureSchema>): boolean {
  return Object.values(architecture.provenanceByPath).some(
    (value) => typeof value === "object" && value !== null && (value as { status?: unknown }).status === "CONFLICTED",
  );
}

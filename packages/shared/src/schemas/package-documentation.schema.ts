import { z } from "zod";

export const MAX_PACKAGE_DOCUMENTATION_BYTES = 256 * 1024;
const heading = z.string().trim().min(1).max(200).optional();
const engineReference = z
  .object({
    source: z.literal("engine"),
    path: z
      .string()
      .min(1)
      .max(240)
      .refine(
        (path) =>
          path.endsWith(".md") &&
          !/[\\%?#:]/u.test(path) &&
          !path.split("/").some((segment) => !segment || segment === "." || segment === "..") &&
          !/^development(?:\/|$)/iu.test(path),
      ),
    heading,
  })
  .strict();
const catalogReference = z
  .object({
    source: z.literal("catalog"),
    path: z
      .string()
      .min(1)
      .max(500)
      .regex(/^(?:\.\.\/)+packages\/[a-z0-9-]+\/(?:README\.md|docs\/(?:[^/%?#\\:]+\/)*[^/%?#\\:]+\.md)$/u)
      .refine(
        (path) =>
          !path
            .replace(/^(?:\.\.\/)+/u, "")
            .split("/")
            .some((segment) => !segment || segment === "." || segment === "..") &&
          !/\/docs\/development(?:\/|$)/iu.test(path),
      ),
    heading,
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    bytes: z.number().int().positive().max(MAX_PACKAGE_DOCUMENTATION_BYTES),
  })
  .strict();
const identity = {
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/u)
    .refine((id) => id !== "overview"),
  title: z.string().trim().min(1).max(120),
};
export const packageDocumentationReferenceSchema = z.union([engineReference, catalogReference]);
export const packageDocumentationIndexSchema = z
  .object({
    version: z.string().min(1).max(80),
    overview: packageDocumentationReferenceSchema,
    guides: z
      .array(z.union([engineReference.extend(identity), catalogReference.extend(identity)]))
      .max(32)
      .refine((guides) => new Set(guides.map((guide) => guide.id)).size === guides.length),
  })
  .strict();
export const capabilityDocumentationSchema = z
  .object({
    schemaVersion: z.literal(1),
    packages: z
      .record(z.string().min(1).max(80), packageDocumentationIndexSchema)
      .refine((packages) => Object.keys(packages).length <= 500),
  })
  .strict();

export type PackageDocumentationReference = z.infer<typeof packageDocumentationReferenceSchema>;
export type PackageDocumentationIndex = z.infer<typeof packageDocumentationIndexSchema>;
export interface PackageDocumentationRead {
  packageId: string;
  packageVersion?: string;
  guideId: string;
  title: string;
  topics: Array<{ id: string; title: string; sourceUrl?: string }>;
  status: "available" | "cached" | "unavailable";
  content?: string;
  sourceUrl?: string;
  enginePath?: string;
  retrievedAt?: string;
}

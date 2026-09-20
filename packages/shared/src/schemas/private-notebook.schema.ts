import { z } from "zod";
import { chatModeSchema } from "./chat.schema.js";

export const PRIVATE_NOTEBOOK_MAX_CONTENT_CHARS = 100_000;
export const PRIVATE_NOTEBOOK_SETTINGS_PREFIX = "private-notebook:v1:";

const globalPrivateNotebookTargetSchema = z.object({ scope: z.literal("global") }).strict();

const characterPrivateNotebookTargetSchema = z
  .object({
    scope: z.literal("character"),
    characterId: z.string().min(1),
  })
  .strict();

const chatPrivateNotebookTargetSchema = z.object({ scope: z.literal("chat") }).strict();

const branchFamilyPrivateNotebookTargetSchema = z.object({ scope: z.literal("branch-family") }).strict();

export const privateNotebookTargetSchema = z.discriminatedUnion("scope", [
  globalPrivateNotebookTargetSchema,
  characterPrivateNotebookTargetSchema,
  chatPrivateNotebookTargetSchema,
  branchFamilyPrivateNotebookTargetSchema,
]);

/** Persisted value inside one namespaced app_settings row. */
export const privateNotebookStoredDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    content: z.string().max(PRIVATE_NOTEBOOK_MAX_CONTENT_CHARS),
    revision: z.number().int().safe().positive(),
  })
  .strict();

export const privateNotebookDocumentSchema = z
  .object({
    target: privateNotebookTargetSchema,
    content: z.string().max(PRIVATE_NOTEBOOK_MAX_CONTENT_CHARS),
    revision: z.number().int().safe().nonnegative(),
    updatedAt: z.string().datetime().nullable(),
  })
  .strict();

export const privateNotebookContextSchema = z
  .object({
    chatId: z.string().min(1),
    mode: chatModeSchema,
    groupId: z.string().min(1).nullable(),
    characterIds: z.array(z.string().min(1)),
    documents: z.array(privateNotebookDocumentSchema),
  })
  .strict();

export const privateNotebookUpdateSchema = z
  .object({
    target: privateNotebookTargetSchema,
    content: z.string().max(PRIVATE_NOTEBOOK_MAX_CONTENT_CHARS),
    expectedRevision: z.number().int().safe().nonnegative(),
  })
  .strict();

export type PrivateNotebookTarget = z.infer<typeof privateNotebookTargetSchema>;
export type PrivateNotebookStoredDocument = z.infer<typeof privateNotebookStoredDocumentSchema>;
export type PrivateNotebookDocument = z.infer<typeof privateNotebookDocumentSchema>;
export type PrivateNotebookContext = z.infer<typeof privateNotebookContextSchema>;
export type PrivateNotebookUpdateInput = z.infer<typeof privateNotebookUpdateSchema>;

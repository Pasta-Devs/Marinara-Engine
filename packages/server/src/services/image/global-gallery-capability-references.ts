import type { DB } from "../../db/connection.js";
import { inArray } from "../../db/file-query.js";
import { capabilityDocuments, chats, globalImages } from "../../db/schema/index.js";
import { withGlobalGalleryImageLifecycleLocks } from "./gallery-file-lifecycle.js";

const GLOBAL_GALLERY_REFERENCE_PREFIX = "global-gallery:";
const MAX_SCANNED_VALUES = 200_000;

export class GlobalGalleryCapabilityReferenceUnavailableError extends Error {
  readonly imageIds: string[];

  constructor(imageIds: string[]) {
    super("One or more new Global Gallery references are unavailable.");
    this.name = "GlobalGalleryCapabilityReferenceUnavailableError";
    this.imageIds = imageIds;
  }
}

export interface GlobalGalleryCapabilityReferenceSummary {
  documentCount: number;
  chatCount: number;
  totalCount: number;
}

function parseStoredJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function containsExactReference(value: unknown, referenceId: string): boolean {
  if (typeof value === "string" && !value.includes(referenceId)) return false;
  const pending: unknown[] = [parseStoredJson(value)];
  let scanned = 0;
  const enqueue = (nested: unknown): boolean => {
    if (scanned + pending.length >= MAX_SCANNED_VALUES) return false;
    pending.push(nested);
    return true;
  };
  while (pending.length > 0) {
    const current = pending.pop();
    scanned += 1;
    if (scanned > MAX_SCANNED_VALUES) {
      // A malformed or unexpectedly large record should fail closed rather than
      // allow deletion of an asset it may still own.
      return true;
    }
    if (current === referenceId) return true;
    if (Array.isArray(current)) {
      for (const nested of current) {
        if (!enqueue(nested)) return true;
      }
      continue;
    }
    if (current && typeof current === "object") {
      for (const key in current) {
        if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
        if (!enqueue((current as Record<string, unknown>)[key])) return true;
      }
    }
  }
  return false;
}

function collectReferenceImageIds(value: unknown): Set<string> {
  const imageIds = new Set<string>();
  if (typeof value === "string" && !value.includes(GLOBAL_GALLERY_REFERENCE_PREFIX)) return imageIds;
  const pending: unknown[] = [parseStoredJson(value)];
  let scanned = 0;
  const enqueue = (nested: unknown) => {
    if (scanned + pending.length >= MAX_SCANNED_VALUES) {
      throw new Error("Capability record exceeds the Global Gallery reference scan limit.");
    }
    pending.push(nested);
  };
  while (pending.length > 0) {
    const current = pending.pop();
    scanned += 1;
    if (scanned > MAX_SCANNED_VALUES) {
      throw new Error("Capability record exceeds the Global Gallery reference scan limit.");
    }
    if (typeof current === "string") {
      if (current.startsWith(GLOBAL_GALLERY_REFERENCE_PREFIX)) {
        const imageId = current.slice(GLOBAL_GALLERY_REFERENCE_PREFIX.length);
        if (imageId.length > 0) imageIds.add(imageId);
      }
      continue;
    }
    if (Array.isArray(current)) {
      for (const nested of current) enqueue(nested);
      continue;
    }
    if (current && typeof current === "object") {
      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          enqueue((current as Record<string, unknown>)[key]);
        }
      }
    }
  }
  return imageIds;
}

/**
 * Keep newly-created durable references atomic with Global Gallery deletion.
 * Existing dangling references remain editable, but a write cannot introduce a
 * new reference unless its image still exists while the write is committed.
 */
export async function withNewGlobalGalleryCapabilityReferences<T>(
  db: DB,
  previousValue: unknown,
  nextValue: unknown,
  operation: () => Promise<T> | T,
): Promise<T> {
  const previousIds = collectReferenceImageIds(previousValue);
  const addedIds = Array.from(collectReferenceImageIds(nextValue)).filter((imageId) => !previousIds.has(imageId));
  if (addedIds.length === 0) return operation();

  return withGlobalGalleryImageLifecycleLocks(addedIds, async () => {
    const rows = await db.select({ id: globalImages.id }).from(globalImages).where(inArray(globalImages.id, addedIds));
    const existingIds = new Set(rows.map((row) => row.id));
    const missingIds = addedIds.filter((imageId) => !existingIds.has(imageId));
    if (missingIds.length > 0) {
      throw new GlobalGalleryCapabilityReferenceUnavailableError(missingIds);
    }
    return operation();
  });
}

/**
 * Finds durable package documents and chat-local drafts that still own a
 * Global Gallery reference. Deletion is rare, so an exact scan keeps this
 * generic for current and future capability packages without coupling the
 * gallery route to a package-specific JSON shape.
 */
export async function findGlobalGalleryCapabilityReferences(
  db: DB,
  imageId: string,
): Promise<GlobalGalleryCapabilityReferenceSummary> {
  const referenceId = `${GLOBAL_GALLERY_REFERENCE_PREFIX}${imageId}`;
  const [documents, chatRecords] = await Promise.all([
    db.select({ data: capabilityDocuments.data }).from(capabilityDocuments),
    db.select({ metadata: chats.metadata }).from(chats),
  ]);
  const documentCount = documents.filter((document) => containsExactReference(document.data, referenceId)).length;
  const chatCount = chatRecords.filter((chat) => containsExactReference(chat.metadata, referenceId)).length;
  return {
    documentCount,
    chatCount,
    totalCount: documentCount + chatCount,
  };
}

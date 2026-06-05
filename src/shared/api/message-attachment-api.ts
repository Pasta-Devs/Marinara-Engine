import {
  deletePreparedManagedImageAttachments as deletePreparedManagedImageAttachmentsWithStorage,
  prepareManagedImageAttachmentBatch as prepareManagedImageAttachmentBatchWithStorage,
  type PreparedManagedImageAttachments,
  type PromptAttachment,
} from "../../engine/shared/attachments/image-attachments";
import { storageApi } from "./storage-api";

export type { PreparedManagedImageAttachments, PromptAttachment };

export function prepareManagedImageAttachmentBatch(
  chatId: string,
  attachments: PromptAttachment[] | undefined,
): Promise<PreparedManagedImageAttachments> {
  return prepareManagedImageAttachmentBatchWithStorage(storageApi, chatId, attachments);
}

export function deletePreparedManagedImageAttachments(prepared: PreparedManagedImageAttachments): Promise<void> {
  return deletePreparedManagedImageAttachmentsWithStorage(storageApi, prepared);
}

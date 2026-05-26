import { describe, expect, it } from "vitest";

import { chatGalleryUploadFailureError } from "./use-gallery";

describe("chatGalleryUploadFailureError", () => {
  it("preserves the underlying remote error for single-file uploads", () => {
    const remoteError = new Error("chat_gallery_upload is not exposed by the remote runtime");

    expect(chatGalleryUploadFailureError(1, [remoteError])).toBe(remoteError);
  });

  it("keeps a batch summary for multi-file partial failures", () => {
    expect(chatGalleryUploadFailureError(2, [new Error("nope")]).message).toBe(
      "One chat gallery image failed to upload.",
    );
  });
});

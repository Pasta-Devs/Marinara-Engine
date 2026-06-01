import { afterEach, describe, expect, it, vi } from "vitest";
import { messageAttachmentsFromExtra } from "./message-attachments";

describe("messageAttachmentsFromExtra", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps records with known attachment fields and scalar extension fields", () => {
    expect(
      messageAttachmentsFromExtra({
        attachments: [{ type: "image", url: "data:image/png;base64,abc", width: 512, pinned: true }],
      }),
    ).toEqual([{ type: "image", url: "data:image/png;base64,abc", width: 512, pinned: true }]);
  });

  it("drops malformed attachment entries and reports the count", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(
      messageAttachmentsFromExtra({
        attachments: [null, "image", {}, { type: 42 }, { type: "image", metadata: { width: 512 } }],
      }),
    ).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[chat-ui] Dropped malformed message attachment(s)", {
      dropped: 5,
      total: 5,
    });
  });

  it("reports non-array attachment payloads without logging the payload contents", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(messageAttachmentsFromExtra({ attachments: "private-data" })).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[chat-ui] Ignored malformed message attachments payload", {
      reason: "not-array",
    });
  });
});

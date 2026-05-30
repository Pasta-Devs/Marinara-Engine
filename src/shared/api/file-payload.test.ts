import { describe, expect, it } from "vitest";

import { MAX_FILE_SIZES } from "../../engine/contracts/constants/defaults";
import { fileToUploadPayload, formDataToJson, IMAGE_UPLOAD_SIZE_ERROR, MAX_IMAGE_UPLOAD_BYTES } from "./file-payload";

function fakeFile(size: number, bytes = [0x89, 0x50, 0x4e, 0x47]) {
  let arrayBufferCalls = 0;
  const file = {
    name: "upload.png",
    type: "image/png",
    size,
    async arrayBuffer() {
      arrayBufferCalls += 1;
      return new Uint8Array(bytes).buffer;
    },
  } as File;

  return {
    file,
    arrayBufferCalls: () => arrayBufferCalls,
  };
}

describe("fileToUploadPayload", () => {
  it("keeps the image upload limit and message tied to the shared upload constants", () => {
    const expectedMib = MAX_FILE_SIZES.IMAGE_UPLOAD / (1024 * 1024);
    const expectedSize = Number.isInteger(expectedMib) ? expectedMib.toString() : expectedMib.toFixed(1);

    expect(MAX_IMAGE_UPLOAD_BYTES).toBe(MAX_FILE_SIZES.IMAGE_UPLOAD);
    expect(IMAGE_UPLOAD_SIZE_ERROR).toBe(`Image uploads must be ${expectedSize} MB or smaller`);
  });

  it("rejects oversized uploads before reading bytes", async () => {
    const upload = fakeFile(MAX_IMAGE_UPLOAD_BYTES + 1);

    await expect(
      fileToUploadPayload(upload.file, {
        maxBytes: MAX_IMAGE_UPLOAD_BYTES,
        tooLargeMessage: IMAGE_UPLOAD_SIZE_ERROR,
      }),
    ).rejects.toThrow(IMAGE_UPLOAD_SIZE_ERROR);
    expect(upload.arrayBufferCalls()).toBe(0);
  });

  it("encodes files within the configured size limit", async () => {
    const upload = fakeFile(4);

    await expect(
      fileToUploadPayload(upload.file, {
        maxBytes: MAX_IMAGE_UPLOAD_BYTES,
        tooLargeMessage: IMAGE_UPLOAD_SIZE_ERROR,
      }),
    ).resolves.toMatchObject({
      name: "upload.png",
      type: "image/png",
      size: 4,
      base64: "iVBORw==",
    });
    expect(upload.arrayBufferCalls()).toBe(1);
  });
});

// formDataToJson checks `value instanceof File`, so it needs a real File. Build
// one with a spied arrayBuffer and an overridden size, then feed it through a
// minimal `entries()`-bearing stand-in so FormData never clones away the spy.
function fakeFormBody(size: number, extraFields: Record<string, string> = {}) {
  let arrayBufferCalls = 0;
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "upload.png", {
    type: "image/png",
  });
  Object.defineProperty(file, "size", { value: size, configurable: true });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: async () => {
      arrayBufferCalls += 1;
      return new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    },
  });
  const entries: Array<[string, FormDataEntryValue]> = [["file", file], ...Object.entries(extraFields)];
  const body = { entries: () => entries[Symbol.iterator]() } as unknown as FormData;
  return { body, arrayBufferCalls: () => arrayBufferCalls };
}

describe("formDataToJson", () => {
  it("rejects an oversized File entry before reading its bytes", async () => {
    const form = fakeFormBody(MAX_IMAGE_UPLOAD_BYTES + 1, { chatId: "chat-1" });

    await expect(
      formDataToJson(form.body, {
        maxBytes: MAX_IMAGE_UPLOAD_BYTES,
        tooLargeMessage: IMAGE_UPLOAD_SIZE_ERROR,
      }),
    ).rejects.toThrow(IMAGE_UPLOAD_SIZE_ERROR);
    expect(form.arrayBufferCalls()).toBe(0);
  });

  it("encodes a File within the limit and preserves string fields", async () => {
    const form = fakeFormBody(4, { chatId: "chat-1" });

    const result = await formDataToJson(form.body, {
      maxBytes: MAX_IMAGE_UPLOAD_BYTES,
      tooLargeMessage: IMAGE_UPLOAD_SIZE_ERROR,
    });

    expect(result.chatId).toBe("chat-1");
    expect(result.file).toMatchObject({ name: "upload.png", size: 4, base64: "iVBORw==" });
    expect(form.arrayBufferCalls()).toBe(1);
  });

  it("still reads files when no size limit is supplied (back-compat)", async () => {
    const form = fakeFormBody(MAX_IMAGE_UPLOAD_BYTES + 1);

    await expect(formDataToJson(form.body)).resolves.toMatchObject({
      file: { name: "upload.png" },
    });
    expect(form.arrayBufferCalls()).toBe(1);
  });
});

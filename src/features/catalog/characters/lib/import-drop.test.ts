import { describe, expect, it } from "vitest";
import { extractDroppedCharacterImportFiles, isSupportedCharacterImportFilename } from "./import-drop";

function file(name: string): File {
  return new File(["{}"], name, { type: "application/json" });
}

function fileItem(sourceFile: File, entry: { isDirectory?: boolean } | null = { isDirectory: false }) {
  return {
    kind: "file",
    getAsFile: () => sourceFile,
    webkitGetAsEntry: () => entry,
  };
}

describe("character import drop handling", () => {
  it("extracts browser file items without losing supported files", () => {
    const first = file("rina.json");
    const second = file("card.png");

    expect(
      extractDroppedCharacterImportFiles({
        items: [fileItem(first), fileItem(second)],
      }),
    ).toEqual({ files: [first, second], error: null });
  });

  it("rejects dropped folders with a clear error", () => {
    const result = extractDroppedCharacterImportFiles({
      items: [fileItem(file("folder"), { isDirectory: true })],
    });

    expect(result.files).toEqual([]);
    expect(result.error).toBe("Folders are not supported here. Drop supported character files instead.");
  });

  it("rejects non-file drag items instead of starting an import", () => {
    const result = extractDroppedCharacterImportFiles({
      items: [
        {
          kind: "string",
          getAsFile: () => null,
        },
      ],
    });

    expect(result.files).toEqual([]);
    expect(result.error).toBe("Drop supported character files here. Folders and other items are not supported.");
  });

  it("falls back to FileList drops when DataTransferItemList is empty", () => {
    const dropped = file("renamed.marinara");

    expect(
      extractDroppedCharacterImportFiles({
        items: [],
        files: [dropped],
      }),
    ).toEqual({ files: [dropped], error: null });
  });

  it("identifies supported character import filenames case-insensitively", () => {
    expect(isSupportedCharacterImportFilename("rina.JSON")).toBe(true);
    expect(isSupportedCharacterImportFilename("card.PNG")).toBe(true);
    expect(isSupportedCharacterImportFilename("bundle.charx")).toBe(true);
    expect(isSupportedCharacterImportFilename("native.marinara")).toBe(true);
    expect(isSupportedCharacterImportFilename("notes.txt")).toBe(false);
  });
});

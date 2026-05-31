import { describe, expect, it } from "vitest";

import { classifyCharacterImportFiles, isZipCharacterImportFile } from "./character-import-file-classifier";
import { CHARACTER_IMPORT_UNSUPPORTED_FILE_MESSAGE } from "./import-drop";

function jsonFile(name: string, payload: unknown): File {
  return new File([JSON.stringify(payload)], name, { type: "application/json" });
}

describe("character import file classifier", () => {
  it("routes png and charx files to SillyTavern-style character imports", async () => {
    const png = new File(["image"], "sprite.png", { type: "image/png" });
    const charx = new File(["card"], "card.charx");

    const result = await classifyCharacterImportFiles([png, charx]);

    expect(result.stCharacterFiles).toEqual([png, charx]);
    expect(result.marinaraPayloads).toEqual([]);
    expect(result.marinaraPackages).toEqual([]);
    expect(result.results).toEqual([]);
  });

  it("detects zipped Marinara packages by signature", async () => {
    const zip = new File([Uint8Array.from([0x50, 0x4b, 0x03, 0x04])], "renamed.json");

    expect(await isZipCharacterImportFile(zip)).toBe(true);
    const result = await classifyCharacterImportFiles([zip]);

    expect(result.marinaraPackages).toEqual([zip]);
  });

  it("splits Marinara envelopes from generic card JSON", async () => {
    const envelope = jsonFile("rina.marinara.json", { version: 1, type: "marinara_character", name: "Rina" });
    const generic = jsonFile("card.json", { spec: "chara_card_v2", data: { name: "Vale" } });

    const result = await classifyCharacterImportFiles([envelope, generic]);

    expect(result.marinaraPayloads).toEqual([
      { file: envelope, payload: { version: 1, type: "marinara_character", name: "Rina" } },
    ]);
    expect(result.stCharacterFiles).toEqual([generic]);
  });

  it("returns failure rows for unsupported or invalid files", async () => {
    const unsupported = new File(["plain"], "notes.txt", { type: "text/plain" });
    const invalidJson = new File(["not json"], "broken.json", { type: "application/json" });

    const result = await classifyCharacterImportFiles([unsupported, invalidJson]);

    expect(result.results[0]).toEqual({
      filename: "notes.txt",
      success: false,
      message: CHARACTER_IMPORT_UNSUPPORTED_FILE_MESSAGE,
    });
    expect(result.results[1]).toMatchObject({
      filename: "broken.json",
      success: false,
    });
  });
});

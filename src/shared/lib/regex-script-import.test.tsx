import { beforeEach, describe, expect, it, vi } from "vitest";
import { importRegexScriptsForCharacter } from "./regex-script-import";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("../api/storage-api", () => ({
  storageApi: {
    create: createMock,
  },
}));

describe("importRegexScriptsForCharacter", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({});
  });

  it("converts SillyTavern embedded regex scripts into character-scoped storage rows", async () => {
    await expect(
      importRegexScriptsForCharacter({
        characterId: "char-1",
        character: {
          data: {
            extensions: {
              regex_scripts: [
                {
                  scriptName: "Tag cleanup",
                  findRegex: "/<tag>(.*?)<\\/tag>/gi",
                  replaceString: "$1",
                  placement: [1, 2],
                  disabled: false,
                },
              ],
            },
          },
        },
      }),
    ).resolves.toBe(1);

    expect(createMock).toHaveBeenCalledWith(
      "regex-scripts",
      expect.objectContaining({
        name: "Tag cleanup",
        characterId: "char-1",
        enabled: true,
        findRegex: "<tag>(.*?)<\\/tag>",
        replaceString: "$1",
        placement: JSON.stringify(["user_input", "ai_output"]),
        flags: "gi",
      }),
    );
  });

  it("uses the supplied target character id when importing scripts from an imported card", async () => {
    await expect(
      importRegexScriptsForCharacter({
        characterId: "existing-char",
        character: {
          data: {
            extensions: {
              regex_scripts: [{ scriptName: "Scoped", findRegex: "foo", replaceString: "bar" }],
            },
          },
        },
      }),
    ).resolves.toBe(1);

    expect(createMock).toHaveBeenCalledWith(
      "regex-scripts",
      expect.objectContaining({
        characterId: "existing-char",
        name: "Scoped",
        findRegex: "foo",
      }),
    );
  });
});

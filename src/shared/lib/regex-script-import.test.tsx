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
    vi.restoreAllMocks();
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
        placement: ["user_input", "ai_output"],
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
        placement: ["user_input", "ai_output"],
        flags: "gi",
      }),
    );
  });

  it("skips unsafe ReDoS patterns without importing them", async () => {
    await expect(
      importRegexScriptsForCharacter({
        characterId: "char-1",
        character: {
          data: {
            extensions: {
              regex_scripts: [{ scriptName: "Unsafe", findRegex: "(a+)+$", replaceString: "x" }],
            },
          },
        },
      }),
    ).resolves.toBe(0);

    expect(createMock).not.toHaveBeenCalled();
  });

  it("normalizes optional SillyTavern fields and invalid placement defaults", async () => {
    await expect(
      importRegexScriptsForCharacter({
        characterId: "char-1",
        character: {
          data: {
            extensions: {
              regex_scripts: [
                {
                  findRegex: "/foo/",
                  disabled: true,
                  placement: [99],
                  promptOnly: true,
                  minDepth: 2,
                  maxDepth: 5,
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
        name: "Regex 1",
        enabled: false,
        findRegex: "foo",
        replaceString: "",
        trimStrings: [],
        placement: ["user_input", "ai_output"],
        flags: "",
        promptOnly: true,
        order: 0,
        minDepth: 2,
        maxDepth: 5,
      }),
    );
  });

  it("preserves explicit empty flags and defaults plain patterns to global case-insensitive flags", async () => {
    await expect(
      importRegexScriptsForCharacter({
        characterId: "char-1",
        character: {
          data: {
            extensions: {
              regex_scripts: [
                { scriptName: "Explicit empty", findRegex: "foo", flags: "" },
                { scriptName: "Plain default", findRegex: "bar" },
              ],
            },
          },
        },
      }),
    ).resolves.toBe(2);

    expect(createMock).toHaveBeenNthCalledWith(
      1,
      "regex-scripts",
      expect.objectContaining({ name: "Explicit empty", flags: "" }),
    );
    expect(createMock).toHaveBeenNthCalledWith(
      2,
      "regex-scripts",
      expect.objectContaining({ name: "Plain default", flags: "gi" }),
    );
  });

  it("warns when unsupported non-default SillyTavern regex options are skipped", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      importRegexScriptsForCharacter({
        characterId: "char-1",
        character: {
          data: {
            extensions: {
              regex_scripts: [{ scriptName: "Unsupported", findRegex: "foo", runOnEdit: true, substituteRegex: 1 }],
            },
          },
        },
      }),
    ).resolves.toBe(1);

    expect(warnSpy).toHaveBeenCalledWith(
      "[regex-import] Unsupported SillyTavern regex options were skipped.",
      expect.objectContaining({
        scriptName: "Unsupported",
        runOnEdit: true,
        substituteRegex: 1,
      }),
    );
  });

  it("keeps importing later scripts when one storage create fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createMock.mockRejectedValueOnce(new Error("disk full")).mockResolvedValueOnce({});

    await expect(
      importRegexScriptsForCharacter({
        characterId: "char-1",
        character: {
          data: {
            extensions: {
              regex_scripts: [
                { scriptName: "Fails", findRegex: "foo" },
                { scriptName: "Succeeds", findRegex: "bar" },
              ],
            },
          },
        },
      }),
    ).resolves.toBe(1);

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      "[regex-import] Failed to import one or more scoped regex scripts.",
      expect.objectContaining({ failed: 1, total: 2 }),
    );
  });
});

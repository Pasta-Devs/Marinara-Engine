import { describe, expect, it } from "vitest";

import { testSecondaryKeys, testSecondaryKeysAsync } from "./lorebook-keyword-matching";

const regexOptions = {
  useRegex: true,
  matchWholeWords: false,
  caseSensitive: false,
};

describe("testSecondaryKeys", () => {
  it("short-circuits secondary-key logic", () => {
    const calls: string[] = [];
    const options = {
      ...regexOptions,
      regexExecutor(regex: RegExp, text: string) {
        calls.push(regex.source);
        return regex.test(text);
      },
    };

    expect(testSecondaryKeys(["missing", "present"], "present", "and", options)).toBe(false);
    expect(calls).toEqual(["missing"]);

    calls.length = 0;
    expect(testSecondaryKeys(["present", "missing"], "present", "or", options)).toBe(true);
    expect(calls).toEqual(["present"]);

    calls.length = 0;
    expect(testSecondaryKeys(["present", "missing"], "present", "not", options)).toBe(false);
    expect(calls).toEqual(["present"]);
  });
});

describe("testSecondaryKeysAsync", () => {
  it("evaluates secondary keys sequentially instead of spawning every regex executor at once", async () => {
    let active = 0;
    let maxActive = 0;
    const calls: string[] = [];
    const options = {
      ...regexOptions,
      async regexExecutor(regex: RegExp, text: string) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        calls.push(regex.source);
        await Promise.resolve();
        active -= 1;
        return regex.test(text);
      },
    };

    await expect(testSecondaryKeysAsync(["one", "two", "three"], "one two three", "and", options)).resolves.toBe(
      true,
    );

    expect(calls).toEqual(["one", "two", "three"]);
    expect(maxActive).toBe(1);
  });

  it("short-circuits async secondary-key logic", async () => {
    const calls: string[] = [];
    const options = {
      ...regexOptions,
      async regexExecutor(regex: RegExp, text: string) {
        calls.push(regex.source);
        return regex.test(text);
      },
    };

    await expect(testSecondaryKeysAsync(["missing", "present"], "present", "and", options)).resolves.toBe(false);
    expect(calls).toEqual(["missing"]);

    calls.length = 0;
    await expect(testSecondaryKeysAsync(["present", "missing"], "present", "or", options)).resolves.toBe(true);
    expect(calls).toEqual(["present"]);

    calls.length = 0;
    await expect(testSecondaryKeysAsync(["present", "missing"], "present", "not", options)).resolves.toBe(false);
    expect(calls).toEqual(["present"]);
  });
});

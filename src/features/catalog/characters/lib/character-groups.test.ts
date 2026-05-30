import { describe, expect, it } from "vitest";
import { normalizeCharacterGroupMemberIds } from "./character-groups";

describe("character group helpers", () => {
  it("normalizes group member ids from persisted loose shapes", () => {
    expect(normalizeCharacterGroupMemberIds([" char-a ", "", 42, "char-b", "char-a"])).toEqual(["char-a", "char-b"]);
    expect(normalizeCharacterGroupMemberIds('["char-c"," ","char-d"]')).toEqual(["char-c", "char-d"]);
    expect(normalizeCharacterGroupMemberIds("char-e")).toEqual(["char-e"]);
    expect(normalizeCharacterGroupMemberIds(null)).toEqual([]);
    expect(normalizeCharacterGroupMemberIds(undefined)).toEqual([]);
    expect(normalizeCharacterGroupMemberIds([])).toEqual([]);
    expect(normalizeCharacterGroupMemberIds("[]")).toEqual([]);
    expect(normalizeCharacterGroupMemberIds("{malformed}")).toEqual(["{malformed}"]);
  });
});

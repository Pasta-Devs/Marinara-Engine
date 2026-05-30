import { describe, expect, it } from "vitest";
import { personaKeys } from "./query-keys";

describe("personaKeys", () => {
  it("preserves the legacy persona cache key values", () => {
    expect(personaKeys.list).toEqual(["personas"]);
    expect(personaKeys.summaries).toEqual(["personas", "summaries"]);
    expect(personaKeys.summaryDetail("persona-1")).toEqual(["personas", "summaries", "persona-1"]);
    expect(personaKeys.detail("persona-1")).toEqual(["personas", "detail", "persona-1"]);
    expect(personaKeys.active).toEqual(["personas", "active"]);
    expect(personaKeys.groups).toEqual(["persona-groups"]);
    expect(personaKeys.groupDetail("group-1")).toEqual(["persona-groups", "detail", "group-1"]);
  });
});

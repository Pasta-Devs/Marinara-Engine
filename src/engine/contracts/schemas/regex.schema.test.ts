import { describe, expect, it } from "vitest";
import { updateRegexScriptSchema } from "./regex.schema";

describe("regex schemas", () => {
  it("accepts reorder patches without filling defaults", () => {
    const parsed = updateRegexScriptSchema.parse({ order: 2, sortOrder: 2 });

    expect(parsed).toEqual({ order: 2, sortOrder: 2 });
  });
});

import { describe, expect, it } from "vitest";
import { updateConnectionSchema } from "./connection.schema";

describe("connection schemas", () => {
  it("accepts partial connection folder updates", () => {
    const parsed = updateConnectionSchema.parse({ folderId: "folder-1" });

    expect(parsed).toEqual({ folderId: "folder-1" });
  });

  it("accepts clearing the connection folder", () => {
    const parsed = updateConnectionSchema.parse({ folderId: null });

    expect(parsed).toEqual({ folderId: null });
  });

  it("rejects invalid connection folder ids", () => {
    expect(() => updateConnectionSchema.parse({ folderId: 123 })).toThrow();
    expect(() => updateConnectionSchema.parse({ folderId: {} })).toThrow();
    expect(() => updateConnectionSchema.parse({ folderId: true })).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { DISCOVERY_CORE_SURFACE_IDS, DISCOVERY_ENTRIES, validateDiscoveryEntries } from "./discovery-registry";
import type { DiscoveryEntry } from "./discovery-types";
import { filterDiscoveryEntries } from "./lib/discovery-search";

const validEntry: DiscoveryEntry = {
  id: "valid",
  title: "Valid",
  category: "Help",
  summary: "A valid discovery entry for tests.",
  keywords: ["valid"],
  audience: "Test users.",
  where: "Tests.",
  actions: [{ type: "go-home", label: "Go home" }],
  coverage: "advanced",
};

describe("discovery registry", () => {
  const search = (query: string) =>
    filterDiscoveryEntries(DISCOVERY_ENTRIES, query, { category: "All", coverage: "All" });

  it("validates the seeded registry", () => {
    expect(validateDiscoveryEntries()).toEqual([]);
  });

  it("rejects duplicate ids and empty required text", () => {
    const entries = [
      { ...validEntry, id: "duplicate", coverage: "core" },
      { ...validEntry, id: "duplicate", title: "", coverage: "core" },
    ];

    const errors = validateDiscoveryEntries(entries);

    expect(errors.some((error) => error.includes("Duplicate discovery id: duplicate"))).toBe(true);
    expect(errors.some((error) => error.includes("title must be non-empty"))).toBe(true);
  });

  it("rejects invalid actions and missing core surfaces", () => {
    const errors = validateDiscoveryEntries([
      {
        ...validEntry,
        id: "bad-action",
        actions: [{ type: "open-panel", panel: "missing", label: "Open" }],
        coverage: "core",
      },
    ]);

    expect(errors.some((error) => error.includes("panel must target a known right panel"))).toBe(true);
    expect(errors.some((error) => error.includes(DISCOVERY_CORE_SURFACE_IDS[0]))).toBe(true);
  });

  it("allows action labels to use default button text", () => {
    const errors = validateDiscoveryEntries([{ ...validEntry, actions: [{ type: "go-home" }] }]);

    expect(errors.some((error) => error.includes("label must be non-empty"))).toBe(false);
  });

  it("finds entries by title, keywords, summary, and intent phrases", () => {
    expect(search("voice").map((entry) => entry.id)).toContain("tts");
    expect(search("remember lore").map((entry) => entry.id)).toContain("lorebooks");
    expect(search("images").map((entry) => entry.id)).toContain("image-generation");
    expect(search("webhook").map((entry) => entry.id)).toContain("discord-mirror");
  });

  it("filters entries by category and coverage", () => {
    const entries = filterDiscoveryEntries(DISCOVERY_ENTRIES, "", { category: "Agents", coverage: "advanced" });

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.category === "Agents" && entry.coverage === "advanced")).toBe(true);
  });
});

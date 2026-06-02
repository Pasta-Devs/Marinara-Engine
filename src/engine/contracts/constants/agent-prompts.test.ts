import { describe, expect, it } from "vitest";

import { DEFAULT_AGENT_PROMPTS } from "./agent-prompts";

describe("DEFAULT_AGENT_PROMPTS", () => {
  it("tells World State to preserve exact day, time, and temperature facts", () => {
    const prompt = DEFAULT_AGENT_PROMPTS["world-state"];

    expect(prompt).toMatch(/explicit scene facts/i);
    expect(prompt).toMatch(/day of week, exact clock time, or exact temperature/i);
    expect(prompt).toMatch(/carry forward the prior value exactly/i);
    expect(prompt).not.toMatch(/Infer sensible defaults/i);
  });

  it("instructs Lorebook Keeper to extract focused facts instead of copying whole messages", () => {
    const prompt = DEFAULT_AGENT_PROMPTS["lorebook-keeper"];

    expect(prompt).toContain("<assistant_response>");
    expect(prompt).toMatch(/never copy[^.]+whole source message/i);
    expect(prompt).toMatch(/not a transcript/i);
    expect(prompt).toMatch(/content[^.]+concise neutral lore note/i);
    expect(prompt).toMatch(/each bullet/i);
  });
});

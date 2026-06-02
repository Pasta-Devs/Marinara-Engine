import { describe, expect, it } from "vitest";

import { DEFAULT_AGENT_PROMPTS } from "./agent-prompts";

describe("DEFAULT_AGENT_PROMPTS", () => {
  it("instructs Lorebook Keeper to extract focused facts instead of copying whole messages", () => {
    const prompt = DEFAULT_AGENT_PROMPTS["lorebook-keeper"];

    expect(prompt).toContain("<assistant_response>");
    expect(prompt).toMatch(/never copy[^.]+whole source message/i);
    expect(prompt).toMatch(/not a transcript/i);
    expect(prompt).toMatch(/content[^.]+concise neutral lore note/i);
    expect(prompt).toMatch(/each bullet/i);
  });
});

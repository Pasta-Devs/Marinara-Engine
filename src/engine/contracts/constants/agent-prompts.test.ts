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

  it("instructs Chat Summary to summarize neutrally instead of continuing the scene", () => {
    const prompt = DEFAULT_AGENT_PROMPTS["chat-summary"];

    expect(prompt).toMatch(/neutral factual recap/i);
    expect(prompt).toMatch(/do not continue the scene/i);
    expect(prompt).toMatch(/do not speak as/i);
    expect(prompt).toMatch(/do not write new dialogue/i);
    expect(prompt).toMatch(/do not match the roleplay/i);
    expect(prompt).toMatch(/appended to the existing summary/i);
    expect(prompt).toMatch(/new events only/i);
    expect(prompt).not.toMatch(/a continuation, not a rewrite/i);
    expect(prompt).not.toMatch(/match the tone and style/i);
  });
});

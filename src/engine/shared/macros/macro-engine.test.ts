import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatZonedDate, formatZonedTime, getZonedWeekdayName } from "../time/timezone";
import { resolveMacros, SUPPORTED_MACROS, type MacroContext } from "./macro-engine";

function baseContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return {
    user: "User",
    char: "Char",
    characters: ["Char"],
    variables: {},
    ...overrides,
  };
}

function conditionalContext(overrides: Partial<MacroContext> = {}): MacroContext {
  const { variables, ...rest } = overrides;

  return baseContext({
    user: "Xel",
    char: "Dottore",
    characters: ["Dottore", "Pantalone"],
    variables: {
      mood: "ominous",
      off: "false",
      ...variables,
    },
    lastInput: "Tell me the plan.",
    chatId: "chat-1",
    model: "test-model",
    characterFields: {
      description: "Harbinger doctor",
      personality: "calculating",
      backstory: "Fatui research lead",
      appearance: "mask and coat",
      scenario: "winter palace",
      example: "Observe carefully.",
      systemPrompt: "Prioritize clinical precision.",
      postHistoryInstructions: "Keep experiments consistent after chat history.",
    },
    characterProfiles: [
      {
        name: "Dottore",
        description: "Harbinger doctor",
        personality: "calculating",
        systemPrompt: "Dottore system guidance",
        postHistoryInstructions: "Dottore post-history guidance",
      },
      {
        name: "Pantalone",
        description: "Banker harbinger",
        personality: "polished",
        systemPrompt: "Pantalone system guidance",
        postHistoryInstructions: "Pantalone post-history guidance",
      },
    ],
    ...rest,
  });
}

describe("resolveMacros character instruction macros", () => {
  it("advertises charSysInfo and charPostHistory in the supported macro reference", () => {
    expect(SUPPORTED_MACROS.map((macro) => macro.syntax)).toEqual(
      expect.arrayContaining(["{{charSysInfo}}", "{{charPostHistory}}"]),
    );
  });

  it("resolves character instruction macros from the active character fields", () => {
    const resolved = resolveMacros("Sys: {{charSysInfo}}\nPost: {{charPostHistory}}", conditionalContext());

    expect(resolved).toBe(
      "Sys: Prioritize clinical precision.\nPost: Keep experiments consistent after chat history.",
    );
  });

  it("resolves nested macros inside active character instruction fields", () => {
    const resolved = resolveMacros(
      "Sys: {{charSysInfo}}\nPost: {{charPostHistory}}",
      conditionalContext({
        characterFields: {
          description: "Harbinger doctor",
          systemPrompt: "Guide {{char}} for {{user}} using {{description}}.",
          postHistoryInstructions: "After history: {{charSysInfo}}",
        },
      }),
    );

    expect(resolved).toBe(
      "Sys: Guide Dottore for Xel using Harbinger doctor.\nPost: After history: Guide Dottore for Xel using Harbinger doctor.",
    );
  });

  it("expands character instruction macros per repeated group-chat profile", () => {
    const resolved = resolveMacros(
      [
        "[",
        "{{char}}",
        "sys={{charSysInfo}}",
        "post={{charPostHistory}}",
        '{{#if charSysInfo contains "Pantalone"}}banker{{else}}other{{/if}}',
        "]",
      ].join("\n"),
      conditionalContext(),
    );

    expect(resolved).toContain("Dottore\nsys=Dottore system guidance\npost=Dottore post-history guidance\nother");
    expect(resolved).toContain(
      "Pantalone\nsys=Pantalone system guidance\npost=Pantalone post-history guidance\nbanker",
    );
    expect(resolved).not.toContain("{{charSysInfo}}");
    expect(resolved).not.toContain("{{charPostHistory}}");
  });

  it("resolves nested character instruction fields per repeated group-chat profile", () => {
    const resolved = resolveMacros(
      [
        "[",
        "{{char}}",
        "sys={{charSysInfo}}",
        "post={{charPostHistory}}",
        '{{#if charPostHistory contains "Harbinger doctor"}}nested{{else}}miss{{/if}}',
        "]",
      ].join("\n"),
      conditionalContext({
        characterProfiles: [
          {
            name: "Dottore",
            description: "Harbinger doctor",
            systemPrompt: "Guide {{char}} for {{user}} using {{description}}.",
            postHistoryInstructions: "After history: {{charSysInfo}}",
          },
          {
            name: "Pantalone",
            description: "Banker harbinger",
            systemPrompt: "Guide {{char}} for {{user}} using {{description}}.",
            postHistoryInstructions: "After history: {{charSysInfo}}",
          },
        ],
      }),
    );

    expect(resolved).toContain(
      "Dottore\nsys=Guide Dottore for Xel using Harbinger doctor.\npost=After history: Guide Dottore for Xel using Harbinger doctor.\nnested",
    );
    expect(resolved).toContain(
      "Pantalone\nsys=Guide Pantalone for Xel using Banker harbinger.\npost=After history: Guide Pantalone for Xel using Banker harbinger.\nmiss",
    );
  });

  it("stops recursive character instruction fields at a bounded depth", () => {
    const resolved = resolveMacros(
      "{{charSysInfo}}",
      conditionalContext({
        characterFields: {
          systemPrompt: "{{charPostHistory}}",
          postHistoryInstructions: "{{charSysInfo}}",
        },
      }),
    );

    expect(resolved).toBe("");
  });

  it("stops self-referential character field conditionals at a bounded depth", () => {
    const ctx = conditionalContext({
      characterFields: {
        systemPrompt: "{{#if charSysInfo}}loop{{/if}}",
      },
    });

    expect(resolveMacros("{{charSysInfo}}", ctx)).toBe("");
    expect(resolveMacros("{{#if charSysInfo}}present{{else}}missing{{/if}}", ctx)).toBe("missing");
  });

  it("preserves acyclic terminal character field values at the depth boundary", () => {
    const resolved = resolveMacros(
      "{{description}}",
      conditionalContext({
        characterFields: {
          description: "{{personality}}",
          personality: "{{backstory}}",
          backstory: "{{appearance}}",
          appearance: "{{scenario}}",
          scenario: "Terminal for {{char}} and {{user}}.",
        },
      }),
    );

    expect(resolved).toBe("Terminal for Dottore and Xel.");
  });

  it("does not evaluate unused character fields", () => {
    const ctx = conditionalContext({
      characterFields: {
        description: "{{#if {{setvar::leaked::yes}}}}unused{{/if}}",
      },
    });

    expect(resolveMacros("No character field macros here.", ctx)).toBe("No character field macros here.");
    expect(ctx.variables.leaked).toBeUndefined();
  });
});

describe("resolveMacros conditional blocks", () => {
  it("selects truthy and else branches from variables", () => {
    expect(resolveMacros("{{#if mood}}Mood: {{mood}}{{else}}No mood{{/if}}", conditionalContext())).toBe(
      "Mood: ominous",
    );

    expect(resolveMacros("{{#if off}}Enabled{{else}}Disabled{{/if}}", conditionalContext())).toBe("Disabled");
    expect(resolveMacros("{{#if missingFlag}}Enabled{{else}}Disabled{{/if}}", conditionalContext())).toBe(
      "Disabled",
    );
  });

  it("supports legacy comparisons and aliases", () => {
    const ctx = conditionalContext();

    expect(resolveMacros('{{#if character == "Dottore"}}Doctor{{else}}Other{{/if}}', ctx)).toBe("Doctor");
    expect(resolveMacros("{{#if speaker != \u201cDottore\u201d}}Other{{else}}Same{{/if}}", ctx)).toBe("Same");
    expect(resolveMacros('{{#if characters contains "Pantalone"}}Group{{else}}Solo{{/if}}', ctx)).toBe("Group");
  });

  it("supports nested macro operands in condition expressions", () => {
    const ctx = conditionalContext({ variables: { target: "Dottore" } });

    expect(resolveMacros('{{#if {{getvar::target}} == {{char}}}}Matched{{else}}Missed{{/if}}', ctx)).toBe(
      "Matched",
    );
    expect(resolveMacros('{{#if "{{char}}" == "Dottore"}}Quoted{{else}}Missed{{/if}}', ctx)).toBe("Quoted");
  });

  it("only resolves macros and side effects from the selected branch", () => {
    const ctx = conditionalContext();

    expect(
      resolveMacros(
        "{{#if off}}{{setvar::selected::bad}}{{else}}{{setvar::selected::good}}{{/if}}{{getvar::selected}}",
        ctx,
      ),
    ).toBe("good");
    expect(ctx.variables.selected).toBe("good");
  });

  it("resolves nested conditional blocks", () => {
    expect(
      resolveMacros(
        '{{#if mood}}{{#if char == "Dottore"}}{{user}} branch{{else}}Other char{{/if}}{{else}}No mood{{/if}}',
        conditionalContext(),
      ),
    ).toBe("Xel branch");
  });

  it("does not treat unknown hash macros starting with if as conditional starts", () => {
    expect(resolveMacros("{{#if mood}}Keep {{#iframe}}{{else}}No{{/if}}", conditionalContext())).toBe(
      "Keep {{#iframe}}",
    );
  });

  it("preserves malformed conditional openers and continues resolving later blocks", () => {
    expect(
      resolveMacros(
        '{{#if mood}}Keep {{user}} {{#if char == "Dottore"}}Doctor{{else}}Other{{/if}}',
        conditionalContext(),
      ),
    ).toBe("{{#if mood}}Keep Xel Doctor");
  });

  it("evaluates character conditionals per repeated group-chat profile", () => {
    const resolved = resolveMacros(
      ["[", '{{#if char == "Dottore"}}Doctor: {{description}}{{else}}{{char}} fallback{{/if}}', "]"].join("\n"),
      conditionalContext(),
    );

    expect(resolved).toContain("Doctor: Harbinger doctor");
    expect(resolved).toContain("Pantalone fallback");
    expect(resolved).not.toContain("Dottore fallback");
  });
});

describe("resolveMacros time macros", () => {
  // Use a moment that lands on different calendar days in UTC vs. Pacific time:
  // 2026-05-27T05:30:00Z is 2026-05-26 22:30 in America/Los_Angeles.
  const fixed = new Date("2026-05-27T05:30:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixed);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("{{date}} honors caller-provided IANA timezone", () => {
    const ctx = baseContext({ timeZone: "America/Los_Angeles" });
    expect(resolveMacros("{{date}}", ctx)).toBe("2026-05-26");
  });

  it("{{time}} honors caller-provided IANA timezone", () => {
    const ctx = baseContext({ timeZone: "America/Los_Angeles" });
    expect(resolveMacros("{{time}}", ctx)).toBe("22:30");
  });

  it("{{weekday}} honors caller-provided IANA timezone", () => {
    // 2026-05-26 in LA is a Tuesday; UTC instant lands on Wednesday.
    const ctx = baseContext({ timeZone: "America/Los_Angeles" });
    expect(resolveMacros("{{weekday}}", ctx)).toBe("Tuesday");
  });

  it("{{datetime}} produces a zoned offset rather than a UTC Z stamp", () => {
    const ctx = baseContext({ timeZone: "America/Los_Angeles" });
    const datetime = resolveMacros("{{datetime}}", ctx);
    expect(datetime.startsWith("2026-05-26T22:30:")).toBe(true);
    expect(datetime).not.toMatch(/Z$/);
  });

  it("falls back to host-local resolution when no timezone is provided", () => {
    const ctx = baseContext();
    // Without a timezone we must match the helper's host-local rendering;
    // do not assume UTC.
    expect(resolveMacros("{{date}}", ctx)).toBe(formatZonedDate(fixed));
    expect(resolveMacros("{{time}}", ctx)).toBe(formatZonedTime(fixed));
    expect(resolveMacros("{{weekday}}", ctx)).toBe(getZonedWeekdayName(fixed));
  });

  it("{{datetime}} also falls back to host-local rather than UTC when no timezone is provided", () => {
    const ctx = baseContext();
    const datetime = resolveMacros("{{datetime}}", ctx);
    // Pre-fix-pass 2 this returned `Date.toISOString()` (UTC, ends in `Z`),
    // splitting {{datetime}} away from {{date}}/{{time}} for any caller that
    // skipped the input plumbing. Post-fix it emits a numeric offset and
    // never the UTC Z stamp.
    expect(datetime).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(datetime).not.toMatch(/Z$/);
  });

  it("uses the caller timezone inside grouped character conditional operands", () => {
    const resolved = resolveMacros(
      ["[", '{{#if "{{date}}" == "2026-05-26"}}{{char}}: local{{else}}{{char}}: host{{/if}}', "]"].join("\n"),
      baseContext({
        characters: ["Dottore", "Pantalone"],
        characterProfiles: [{ name: "Dottore" }, { name: "Pantalone" }],
        timeZone: "America/Los_Angeles",
      }),
    );

    expect(resolved).toContain("Dottore: local");
    expect(resolved).toContain("Pantalone: local");
    expect(resolved).not.toContain("host");
  });
});

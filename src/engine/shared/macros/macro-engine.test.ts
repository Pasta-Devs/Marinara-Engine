import { describe, expect, it } from "vitest";
import { resolveMacros, type MacroContext } from "./macro-engine";

function macroContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return {
    user: "Xel",
    char: "Dottore",
    characters: ["Dottore", "Pantalone"],
    variables: {
      mood: "ominous",
      off: "false",
      ...overrides.variables,
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
    },
    characterProfiles: [
      {
        name: "Dottore",
        description: "Harbinger doctor",
        personality: "calculating",
      },
      {
        name: "Pantalone",
        description: "Banker harbinger",
        personality: "polished",
      },
    ],
    ...overrides,
  };
}

describe("resolveMacros conditional blocks", () => {
  it("selects truthy and else branches from variables", () => {
    expect(resolveMacros("{{#if mood}}Mood: {{mood}}{{else}}No mood{{/if}}", macroContext())).toBe(
      "Mood: ominous",
    );

    expect(resolveMacros("{{#if off}}Enabled{{else}}Disabled{{/if}}", macroContext())).toBe("Disabled");
  });

  it("supports legacy comparisons and aliases", () => {
    const ctx = macroContext();

    expect(resolveMacros('{{#if character == "Dottore"}}Doctor{{else}}Other{{/if}}', ctx)).toBe("Doctor");
    expect(resolveMacros("{{#if speaker != \u201cDottore\u201d}}Other{{else}}Same{{/if}}", ctx)).toBe("Same");
    expect(resolveMacros('{{#if characters contains "Pantalone"}}Group{{else}}Solo{{/if}}', ctx)).toBe("Group");
  });

  it("supports nested macro operands in condition expressions", () => {
    const ctx = macroContext({ variables: { target: "Dottore" } });

    expect(resolveMacros('{{#if {{getvar::target}} == {{char}}}}Matched{{else}}Missed{{/if}}', ctx)).toBe("Matched");
    expect(resolveMacros('{{#if "{{char}}" == "Dottore"}}Quoted{{else}}Missed{{/if}}', ctx)).toBe("Quoted");
  });

  it("only resolves macros and side effects from the selected branch", () => {
    const ctx = macroContext();

    expect(
      resolveMacros("{{#if off}}{{setvar::selected::bad}}{{else}}{{setvar::selected::good}}{{/if}}{{getvar::selected}}", ctx),
    ).toBe("good");
    expect(ctx.variables.selected).toBe("good");
  });

  it("resolves nested conditional blocks", () => {
    expect(
      resolveMacros(
        '{{#if mood}}{{#if char == "Dottore"}}{{user}} branch{{else}}Other char{{/if}}{{else}}No mood{{/if}}',
        macroContext(),
      ),
    ).toBe("Xel branch");
  });

  it("does not treat unknown hash macros starting with if as conditional starts", () => {
    expect(resolveMacros("{{#if mood}}Keep {{#iframe}}{{else}}No{{/if}}", macroContext())).toBe(
      "Keep {{#iframe}}",
    );
  });

  it("preserves malformed conditional openers and continues resolving later blocks", () => {
    expect(
      resolveMacros('{{#if mood}}Keep {{user}} {{#if char == "Dottore"}}Doctor{{else}}Other{{/if}}', macroContext()),
    ).toBe(
      "{{#if mood}}Keep Xel Doctor",
    );
  });

  it("evaluates character conditionals per repeated group-chat profile", () => {
    const resolved = resolveMacros(
      [
        "[",
        '{{#if char == "Dottore"}}Doctor: {{description}}{{else}}{{char}} fallback{{/if}}',
        "]",
      ].join("\n"),
      macroContext(),
    );

    expect(resolved).toContain("Doctor: Harbinger doctor");
    expect(resolved).toContain("Pantalone fallback");
    expect(resolved).not.toContain("Dottore fallback");
  });
});

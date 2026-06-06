import { describe, expect, it } from "vitest";
import {
  hasDeferredCharacterMacros,
  resolveDeferredCharacterMacros,
  resolveMacros,
  type MacroContext,
} from "./macro-engine";

function macroContext(): MacroContext {
  return {
    user: "User",
    char: "Alice",
    characters: ["Alice", "Bob"],
    characterProfiles: [
      {
        name: "Bob",
        description: "Bob description",
        scenario: "Bob scenario",
        systemPrompt: "Bob system",
        postHistoryInstructions: "Bob post-history",
      },
    ],
    characterFields: {
      description: "Alice description",
      scenario: "Alice scenario",
      systemPrompt: "Alice system",
      postHistoryInstructions: "Alice post-history",
    },
    variables: {},
  };
}

describe("deferred character macros", () => {
  it("resolves field-only conditionals immediately in names-only mode", () => {
    const resolved = resolveMacros(
      [
        "{{#if description}}Has description{{else}}Missing description{{/if}}",
        '{{#if scenario == "Alice scenario"}}Scenario branch{{else}}Wrong scenario{{/if}}',
        '{{#if charSysInfo == "Alice system"}}System branch{{else}}Wrong system{{/if}}',
        '{{#if charPostHistory == "Alice post-history"}}Post branch{{else}}Wrong post{{/if}}',
      ].join("\n"),
      macroContext(),
      { deferCharacterMacros: "names" },
    );

    expect(resolved).toContain("Has description");
    expect(resolved).toContain("Scenario branch");
    expect(resolved).toContain("System branch");
    expect(resolved).toContain("Post branch");
    expect(hasDeferredCharacterMacros(resolved)).toBe(false);
  });

  it("preserves name conditionals in names-only mode", () => {
    const deferred = resolveMacros(
      '{{#if char == "Bob"}}Bare name{{else}}Bare other{{/if}}\n{{#if {{char}} == "Bob"}}Macro name{{else}}Macro other{{/if}}',
      macroContext(),
      { deferCharacterMacros: "names" },
    );

    expect(hasDeferredCharacterMacros(deferred)).toBe(true);
    const finalized = resolveDeferredCharacterMacros(deferred, {
      name: "Bob",
      description: "Bob description",
    });
    expect(finalized).toContain("Bare name");
    expect(finalized).toContain("Macro name");
    expect(finalized).not.toContain("Bare other");
    expect(finalized).not.toContain("Macro other");
  });

  it("preserves name and field conditionals in all mode", () => {
    const deferred = resolveMacros(
      '{{#if char == "Bob"}}Name branch{{else}}Wrong name{{/if}}\n{{#if description == "Bob description"}}Field branch{{else}}Wrong field{{/if}}',
      macroContext(),
      { deferCharacterMacros: "all" },
    );

    expect(hasDeferredCharacterMacros(deferred)).toBe(true);
    const finalized = resolveDeferredCharacterMacros(deferred, {
      name: "Bob",
      description: "Bob description",
    });
    expect(finalized).toContain("Name branch");
    expect(finalized).toContain("Field branch");
    expect(finalized).not.toContain("Wrong name");
    expect(finalized).not.toContain("Wrong field");
  });
});

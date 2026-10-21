import assert from "node:assert/strict";
import { hasDeferredCharacterMacros } from "../../packages/shared/src/index.js";
import { assemblePrompt, type AssemblerInput } from "../../packages/server/src/services/prompt/assembler.js";

function section(id: string, content: string): AssemblerInput["sections"][number] {
  return {
    id,
    presetId: "macro-budget",
    identifier: id,
    name: id,
    content,
    role: "system",
    enabled: "true",
    isMarker: "false",
    groupId: null,
    markerConfig: null,
    injectionPosition: "ordered",
    injectionDepth: 0,
    injectionOrder: 0,
    forbidOverrides: "false",
    skipWrap: "true",
  };
}

function input(sections: AssemblerInput["sections"], deferCharacterMacros: boolean): AssemblerInput {
  return {
    db: undefined as unknown as AssemblerInput["db"],
    preset: {
      id: "macro-budget",
      name: "Independent macro budgets",
      sectionOrder: JSON.stringify(sections.map(({ id }) => id)),
      groupOrder: "[]",
      wrapFormat: "xml",
      parameters: "{}",
      variableGroups: "[]",
      variableValues: "{}",
    },
    sections,
    groups: [],
    choiceBlocks: [],
    chatChoices: {},
    chatId: "macro-budget-chat",
    characterIds: [],
    personaName: "Mari",
    personaDescription: "",
    chatMessages: [],
    disableLorebooks: true,
    deferCharacterMacros,
  };
}

for (const deferCharacterMacros of [false, true]) {
  const sections = Array.from({ length: 3 }, (_, index) =>
    section(
      `section_${index}`,
      `ROLL${index}:{{roll:1d1}} RANDOM${index}:{{random::ok::ok}} {{setvar::done${index}::yes}}`.repeat(250),
    ),
  );
  sections.push(section("persona", "{{persona}} {{char}}"));
  const request = input(sections, deferCharacterMacros);
  request.preset.variableValues = JSON.stringify({
    first: "{{random::a::a}}".repeat(750),
    second: "{{random::b::b}}".repeat(750),
  });
  request.personaFields = { example: "{{random::PERSONA_EXAMPLE::PERSONA_EXAMPLE}}" };
  request.chatSummary = "SUMMARY:{{roll:1d1}} {{random::ok::ok}} {{setvar::summaryDone::yes}}";
  const result = await assemblePrompt(request);
  const text = result.messages.map(({ content }) => content).join("\n");
  const mode = `deferCharacterMacros=${deferCharacterMacros}`;
  assert.equal(result.macroVariables.first, "a".repeat(750), `${mode}: first variable resolves independently`);
  assert.equal(result.macroVariables.second, "b".repeat(750), `${mode}: second variable resolves independently`);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(
      text.split(`ROLL${index}:1 RANDOM${index}:ok`).length - 1,
      250,
      `${mode}: section ${index} retains its own expansion allowance`,
    );
    assert.equal(result.macroVariables[`done${index}`], "yes", `${mode}: section effects are retained`);
  }
  assert.match(text, /SUMMARY:1 ok/u, `${mode}: fallback summary has its own allowance`);
  assert.equal(result.macroVariables.summaryDone, "yes");
  assert.deepEqual(result.resolvedPersonaExamples, ["PERSONA_EXAMPLE"], `${mode}: observer remains active`);
  assert.equal(hasDeferredCharacterMacros(text), deferCharacterMacros, `${mode}: character deferral is retained`);
  assert.doesNotMatch(text, /\{\{(?:roll|random|setvar)/u);

  const nested = input(
    [section("nested", "{{random::OUTER::OUTER}}".repeat(1_000) + "{{persona}}")],
    deferCharacterMacros,
  );
  nested.personaFields = { example: "{{random::NESTED::NESTED}}".repeat(1_100) };
  const bounded = await assemblePrompt(nested);
  assert.match(
    bounded.messages.map(({ content }) => content).join("\n"),
    /\{\{random::OUTER::OUTER\}\}/u,
    `${mode}: nested field expansions still share the enclosing section's runaway guard`,
  );
}

console.log("Assembler macro budgets stay independent across roots and shared within nested expansions.");

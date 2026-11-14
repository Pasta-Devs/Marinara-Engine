import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyRegexReplacement,
  buildNarratorInstructionMessage,
  resolveRegexPatternLiteralMacros,
  resolveMacros,
  seededUnitRandom,
  type AgentContext,
  type ChatMLMessage,
  type MacroContext,
  DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE,
  hasDeferredCharacterMacros,
  hasDeferredRelocationConditionals,
  parseDeferredConditionalPayload,
  resolveDeferredCharacterMacros,
  resolveCharacterScopedMacros,
  selectConditionalPayloadBranch,
} from "../../../packages/shared/src/index.js";
import { buildGenerationGuideInstruction } from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  executeAgent,
  renderAgentPromptTemplate,
} from "../../../packages/server/src/services/agents/agent-executor.js";
import { createMessageMacroResolver } from "../../../packages/client/src/lib/chat-macros.js";
import { buildLorebookScanMessagesWithGenerationGuide } from "../../../packages/server/src/services/generation/lorebook-generation-runtime.js";
import { injectIdentityFallbackMessages } from "../../../packages/server/src/services/generation/character-prompt-context.js";
import {
  clearUnusedRuntimeAgentSectionsForTest,
  makeRuntimeAgentSectionTokens,
} from "../../../packages/server/src/services/generation/runtime-agent-sections.js";
import {
  resolveMacrosForPreview,
  resolvePromptMessageMacros,
  scopePromptMacroContextToCharacter,
} from "../../../packages/server/src/services/prompt/index.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import {
  makeCapturingProvider,
  makeRegressionAgentContext,
  makeRegressionAgentConfig,
} from "../fixtures/prompt-helpers.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
  {
    name: "macros expose generation type, idle duration, timezone, and input",
    run() {
      const resolved = resolveMacros("{{lastGenerationType}} | {{idle_duration}} | {{timezone}} | {{input}}", {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
        lastInput: "Continue the experiment.",
        lastGenerationType: "regenerate",
        idleDuration: "12 minutes",
        timeZone: "Europe/Warsaw",
      });

      assert.equal(resolved, "regenerate | 12 minutes | Europe/Warsaw | Continue the experiment.");
    },
  },
  {
    name: "character ID macros resolve exact card references without matching unknown IDs",
    run() {
      const referencedId = "V1StGXR8_Z5jdHi6B-myT";
      const unknownId = "A1StGXR8_Z5jdHi6BmyTX";
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: { [unknownId]: "Variable collision" },
        characterReferences: { [referencedId]: "Susie" },
      };

      assert.equal(resolveMacros(`I went with {{${referencedId}}}.`, context), "I went with Susie.");
      assert.equal(
        resolveMacros(`I went with {{${unknownId}}}.`, context),
        `I went with {{${unknownId}}}.`,
        "Unknown IDs must remain visible instead of resolving through a colliding variable",
      );
    },
  },
  {
    name: "persona ID macros resolve exact card references without matching unknown IDs",
    run() {
      const referencedId = "P1StGXR8_Z5jdHi6B-myT";
      const unknownId = "Q1StGXR8_Z5jdHi6B-myT";
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
        personaReferences: { [referencedId]: "Professor Mari" },
      };

      assert.equal(resolveMacros(`I consulted {{persona-${referencedId}}}.`, context), "I consulted Professor Mari.");
      assert.equal(
        resolveMacros(`I consulted {{persona-${unknownId}}}.`, context),
        `I consulted {{persona-${unknownId}}}.`,
        "Unknown Persona IDs must remain visible",
      );
      assert.equal(
        resolveCharacterScopedMacros(
          `{{#if {{persona-${referencedId}}} == "Professor Mari"}}known{{else}}unknown{{/if}}`,
          { name: "Dottore" },
          0,
          context,
        ),
        "known",
      );
    },
  },
  {
    name: "lorebook size macros resolve known counts and treat inherited object keys as unknown IDs",
    run() {
      const context: MacroContext = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
        lorebookEntryCounts: { "V1StGXR8_Z5jdHi6B-myT": 151 },
      };
      assert.equal(resolveMacros("{{lorebooksize::V1StGXR8_Z5jdHi6B-myT}}", context), "151");
      assert.equal(resolveMacros("{{lorebooksize::missing}}", context), "0");
      assert.equal(resolveMacros("{{lorebooksize::constructor}}", context), "0");
    },
  },
  {
    name: "phonetic name macros fall back to visible names",
    run() {
      assert.equal(
        resolveMacros("{{userNamePhonetic}} calls {{charNamePhonetic}}.", {
          user: "Mari",
          userPhonetic: "Mah-ree",
          char: "Dottore",
          charPhonetic: "Doctor-ray",
          characters: ["Dottore"],
          variables: {},
        }),
        "Mah-ree calls Doctor-ray.",
      );

      assert.equal(
        resolveMacros("{{userNamePhonetic}} calls {{charNamePhonetic}}.", {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
        }),
        "Mari calls Dottore.",
      );
    },
  },
  {
    name: "macro passthrough preserves plain text and deferred sentinels",
    run() {
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
      };

      assert.equal(resolveMacros("  plain narration  ", context), "plain narration");
      assert.equal(resolveMacros("  plain narration  ", context, { trimResult: false }), "  plain narration  ");

      const sentinelText = "literal \x1e sentinel without macro braces";
      assert.equal(resolveMacros(sentinelText, context, { trimResult: false }), sentinelText);
    },
  },
  {
    name: "persona aggregate text is lazy when persona macro is absent",
    run() {
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {} as Record<string, string>,
        personaFields: {
          description: "{{setvar::personaTouched::yes}}Unused persona description",
        },
      };

      assert.equal(
        resolveMacros('{{#if {{getvar::personaTouched}} == "yes"}}touched{{else}}untouched{{/if}}', context),
        "untouched",
      );
      assert.equal(context.variables.personaTouched, undefined);
    },
  },
  {
    name: "local variable macros match SillyTavern numeric and return-value semantics",
    run() {
      const resolve = (template: string) =>
        resolveMacros(template, {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
        });

      assert.equal(
        resolve("{{setvar::modifier::2}}{{setvar::score::20}}{{addnumvar::score::{{modifier}}}}{{getvar::score}}"),
        "22",
      );
      assert.equal(resolve("{{setvar::score::20}}{{addnumvar::score::-2}}{{getvar::score}}"), "18");
      assert.equal(resolve("{{setvar::score::1.5}}{{addnumvar::score::2.25}}{{getvar::score}}"), "3.75");
      assert.equal(resolve("{{addnumvar::score::4}}{{getvar::score}}"), "4");
      assert.equal(resolve("{{setvar::score::invalid}}{{addnumvar::score::5}}{{getvar::score}}"), "5");
      assert.equal(resolve("{{setvar::score::7}}{{addnumvar::score::invalid}}{{getvar::score}}"), "7");
      assert.equal(resolve("{{setvar::score::1e308}}{{addnumvar::score::1e308}}{{getvar::score}}"), "1e+308");
      assert.equal(
        resolve("{{setvar::score::1e308}}{{addnumvar::score::1e308}}{{addnumvar::score::-1e308}}{{getvar::score}}"),
        "0",
      );
      assert.equal(resolve("{{setvar::score::20}}{{addvar::score::-2}}{{getvar::score}}"), "18");
      assert.equal(resolve("{{setvar::label::Lab}}{{addvar::label:: Thirteen}}{{getvar::label}}"), "Lab Thirteen");
      assert.equal(resolve("{{setvar::score::2}}{{incvar::score}}/{{decvar::score}}/{{getvar::score}}"), "3/2/2");

      const prototypeNamedVariables: Record<string, string> = {};
      const resolvePrototypeName = (template: string) =>
        resolveMacros(template, {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
          localVariables: prototypeNamedVariables,
        });
      assert.equal(resolvePrototypeName("{{getvar::constructor}}"), "");
      assert.equal(resolvePrototypeName("{{setvar::constructor::safe}}{{getvar::constructor}}"), "safe");
      assert.equal(resolvePrototypeName("{{addvar::toString::value}}{{getvar::toString}}"), "value");
      assert.equal(resolvePrototypeName("{{setvar::__proto__::owned}}{{incvar::__proto__}}"), "1");
      assert.equal(Object.getPrototypeOf(prototypeNamedVariables), Object.prototype);
      assert.equal(Object.prototype.hasOwnProperty.call(prototypeNamedVariables, "__proto__"), true);

      const firstChatVariables: Record<string, string> = {};
      resolveMacros("{{setvar::remembered::across turns}}", {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
        localVariables: firstChatVariables,
      });
      const reloadedFirstChatVariables = { ...firstChatVariables };
      assert.equal(
        resolveMacros("{{getvar::remembered}}", {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
          localVariables: reloadedFirstChatVariables,
        }),
        "across turns",
        "a fresh prompt context must read the chat-persisted variable map",
      );
      assert.equal(
        resolveMacros("{{getvar::remembered}}", {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
          localVariables: {},
        }),
        "",
        "another chat must not inherit local variables",
      );

      // Chat variables: a name defined in Chat Settings, or set by an earlier
      // message, resolves as a bare tag in the user's own typed message.
      const typedMessageVariables: Record<string, string> = { char1: "Mary" };
      const typedMessageContext = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
        localVariables: typedMessageVariables,
      };
      const resolvedTypedMessages = resolvePromptMessageMacros(
        [
          { id: "m1", role: "user" as const, content: "{{setvar::mood::tense}}{{char1}} walks in." },
          { id: "m2", role: "user" as const, content: "{{char1}} looks {{getvar::mood}}." },
        ],
        typedMessageContext,
      );
      assert.equal(resolvedTypedMessages[0]!.content, "Mary walks in.");
      assert.equal(
        resolvedTypedMessages[1]!.content,
        "Mary looks tense.",
        "a value set in one message must reach a later one through the shared chat map",
      );
      assert.equal(typedMessageVariables.mood, "tense", "history writes must reach the persisted map");
      assert.equal(
        resolvePromptMessageMacros([{ id: "m3", role: "user" as const, content: "{{char1}}" }], {
          ...typedMessageContext,
          localVariables: {},
        })[0]!.content,
        "{{char1}}",
        "another chat keeps the tag literal",
      );

      // Peek Prompt must never persist what a preview resolved.
      const previewVariables: Record<string, string> = { char1: "Mary" };
      assert.equal(
        resolveMacrosForPreview("{{setvar::char1::Anna}}{{char1}}", {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
          localVariables: previewVariables,
        }),
        "Anna",
      );
      assert.deepEqual(previewVariables, { char1: "Mary" }, "a preview must not write the chat's variables");

      const conditionalVariables = { score: "10" };
      resolveMacros("{{#if addnumvar::score::5}}unchanged{{/if}}", {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: conditionalVariables,
      });
      assert.equal(conditionalVariables.score, "10", "conditional operands must not execute numeric writes");

      const variables = { score: "0" };
      const resolveMessage = createMessageMacroResolver({ variables });
      resolveMessage("{{addnumvar::score::1}}");
      resolveMessage("{{addnumvar::score::1}}");
      assert.equal(variables.score, "2", "repeated numeric writes must not be served from the display macro cache");
    },
  },
  {
    name: "macro conditionals support numeric comparisons",
    run() {
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
      };

      assert.equal(resolveMacros("{{#if 1 > 100}}THIS SHOULD NOT SHOW{{/if}}", context), "");
      assert.equal(resolveMacros("{{#if 3 < 5}}low{{else}}high{{/if}}", context), "low");
      assert.equal(resolveMacros("{{#if 5 >= 5.0}}same{{/if}}", context), "same");
    },
  },
  {
    name: "macro conditionals support else-if and nested macro conditions",
    run() {
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
      };

      assert.equal(resolveMacros("{{#if 1==0}}one{{else if 2==2}}two{{else}}three{{/if}}", context), "two");
      assert.equal(
        resolveMacros('{{setvar::name::Bob}}{{#if {{getvar::name}} == "Bob"}}Hi Bob{{/if}}', context),
        "Hi Bob",
      );
      assert.equal(resolveMacros("{{#if 1==1}}It is one{{else if 2==2}}It is two{{/if}}", context), "It is one");
    },
  },
  {
    name: "macro conditionals support OR, AND, grouping, and equality shorthand",
    run() {
      const baseContext = {
        user: "Mari",
        char: "Pantalone",
        characters: ["Maukie", "Pantalone", "Dottore"],
        variables: {},
        characterFields: { scenario: "Moonlit lake" },
      };

      assert.equal(
        resolveMacros('{{#if character == "Maukie" || "Pantalone"}}selected{{else}}other{{/if}}', baseContext),
        "selected",
      );
      assert.equal(
        resolveMacros("{{#if character == “Maukie” || “Pantalone”}}selected{{else}}other{{/if}}", baseContext),
        "selected",
      );
      assert.equal(
        resolveMacros(
          '{{#if characters contains "Maukie" && characters contains "Pantalone"}}together{{/if}}',
          baseContext,
        ),
        "together",
      );
      assert.equal(
        resolveMacros(
          '{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}lake party{{/if}}',
          baseContext,
        ),
        "lake party",
      );
      assert.equal(
        resolveMacros(
          '{{#if character == "Maukie" || character == "Pantalone" && scenario contains "palace"}}selected{{else}}other{{/if}}',
          { ...baseContext, characterFields: { scenario: "Empty road" } },
        ),
        "other",
      );
      assert.equal(
        resolveMacros('{{#if scenario == "A || B && C"}}literal{{/if}}', {
          ...baseContext,
          characterFields: { scenario: "A || B && C" },
        }),
        "literal",
      );

      const deferred = resolveMacros(
        '{{#if character == "Maukie" || "Pantalone"}}selected{{else}}other{{/if}}',
        { ...baseContext, char: "Dottore" },
        { deferCharacterMacros: "names" },
      );
      assert.equal(hasDeferredCharacterMacros(deferred), true);
      assert.equal(resolveDeferredCharacterMacros(deferred, { name: "Pantalone" }, baseContext), "selected");
      assert.equal(resolveDeferredCharacterMacros(deferred, { name: "Dottore" }, baseContext), "other");
    },
  },
  {
    name: "conversation character macros defer to the active Individual group responder",
    run() {
      const initialContext = {
        user: "Mari",
        char: "Pantalone",
        characters: ["Pantalone", "Dottore"],
        variables: {},
        convoFields: {
          charDisplayName: "Regrator",
          charAbout: "Runs the Northland Bank.",
          personaAbout: "AI engineer.",
          convoBehavior: "Keep the tone formal.",
        },
      };
      const deferred = resolveMacros(
        '{{convo_display}}|{{char_about}}|{{persona_about}}|{{convo_behavior}}|{{#if convo_behavior contains "playful"}}playful{{else}}formal{{/if}}',
        initialContext,
        { deferCharacterMacros: "all" },
      );

      assert.equal(hasDeferredCharacterMacros(deferred), true);
      assert.equal(
        resolveDeferredCharacterMacros(deferred, { name: "Pantalone" }, initialContext),
        "Regrator|Runs the Northland Bank.|AI engineer.|Keep the tone formal.|formal",
      );
      assert.equal(
        resolveDeferredCharacterMacros(
          deferred,
          { name: "Dottore" },
          {
            ...initialContext,
            convoFields: {
              charDisplayName: "Il Dottore",
              charAbout: "A researcher from Snezhnaya.",
              personaAbout: "AI engineer.",
              convoBehavior: "Be playful with Mari.",
            },
          },
        ),
        "Il Dottore|A researcher from Snezhnaya.|AI engineer.|Be playful with Mari.|playful",
      );
    },
  },
  {
    name: "group macro uses the full active roster without changing existing identity macros",
    run() {
      const context = {
        user: "Powers That Be",
        char: "Pantalone",
        characters: ["Pantalone"],
        groupCharacters: ["Powers That Be", "Maukie", "Pantalone"],
        variables: {},
      };

      assert.equal(resolveMacros("{{group}}", context), "Powers That Be, Maukie");
      assert.equal(
        resolveMacros("The other players are {{group}}, and {{user}}.", context),
        "The other players are Powers That Be, Maukie, and Powers That Be.",
      );
      assert.equal(resolveMacros("{{characters}}", context), "Pantalone");
      assert.equal(resolveMacros("{{user}} / {{char}}", context), "Powers That Be / Pantalone");
      assert.equal(
        resolveMacros("{{group}}", {
          ...context,
          groupCharacters: ["Powers That Be", "Maukie", "  pantalone  "],
        }),
        "Powers That Be, Maukie",
      );
      assert.equal(
        resolveMacros("{{group}}", { user: "Mari", char: "Dottore", characters: ["Dottore"], variables: {} }),
        "",
      );

      const deferred = resolveMacros("{{char}} sees {{group}}", context, { deferCharacterMacros: "names" });
      assert.equal(hasDeferredCharacterMacros(deferred), true);
      assert.equal(
        resolveDeferredCharacterMacros(deferred, { name: "Pantalone" }, context),
        "Pantalone sees Powers That Be, Maukie",
      );

      const conditional = resolveMacros('{{#if group contains "Maukie"}}together{{else}}apart{{/if}}', context, {
        deferCharacterMacros: "names",
      });
      assert.equal(hasDeferredCharacterMacros(conditional), true);
      assert.equal(resolveDeferredCharacterMacros(conditional, { name: "Pantalone" }, context), "together");
      assert.equal(resolveDeferredCharacterMacros(conditional, { name: "Maukie" }, context), "apart");

      const assemblerSource = readFileSync(
        new URL("../../../packages/server/src/services/prompt/assembler.ts", import.meta.url),
        "utf8",
      );
      const generateRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate.routes.ts", import.meta.url),
        "utf8",
      );
      const dryRunRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate/dry-run-route.ts", import.meta.url),
        "utf8",
      );
      assert.match(assemblerSource, /groupCharacterIds: input\.groupCharacterIds/);
      assert.match(
        generateRouteSource,
        /characterIds: promptCharacterIds,\s*lorebookCharacterIds: withIdentityLorebookScope\(promptCharacterIds\),\s*groupCharacterIds: characterIds,/,
      );
      assert.match(
        dryRunRouteSource,
        /characterIds: promptCharacterIds,\s*lorebookCharacterIds: withIdentityLorebookScope\(promptCharacterIds\),\s*groupCharacterIds: characterIds,/,
      );
    },
  },
  {
    name: "deferred relocation conditionals support reply rules",
    run() {
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
      };
      const deferred = resolveMacros(
        '{{#if replyRules != ""}}Reply rules: {{replyRules}}{{else}}No reply rules{{/if}}',
        context,
        {
          deferConditionalOperand: (operand) => operand === "replyRules",
          trimResult: false,
        },
      );

      assert.equal(hasDeferredRelocationConditionals(deferred), true);
      DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE.lastIndex = 0;
      const match = DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE.exec(deferred);
      assert.ok(match?.[1]);
      const payload = parseDeferredConditionalPayload(match[1]);
      assert.ok(payload);

      const withRules = { ...context, variables: { replyRules: "Use :pasta:." } };
      const selectedWithRules = selectConditionalPayloadBranch(payload, withRules, { trimResult: false });
      assert.equal(resolveMacros(selectedWithRules, withRules, { trimResult: false }), "Reply rules: Use :pasta:.");

      const withoutRules = { ...context, variables: { replyRules: "" } };
      const selectedWithoutRules = selectConditionalPayloadBranch(payload, withoutRules, { trimResult: false });
      assert.equal(resolveMacros(selectedWithoutRules, withoutRules, { trimResult: false }), "No reply rules");
    },
  },
  {
    name: "random range macros normalize reversed bounds and zero-sided dice",
    run() {
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
      };

      for (let index = 0; index < 25; index += 1) {
        const value = Number(resolveMacros("{{random:5:1}}", context));
        assert.equal(Number.isInteger(value), true);
        assert.equal(value >= 1 && value <= 5, true);
      }
      assert.equal(resolveMacros("{{roll:2d0}}", context), "0");
      // The roll macro reads the shared NdM grammar: a bare die and a flat modifier roll too.
      for (let index = 0; index < 25; index += 1) {
        const bare = Number(resolveMacros("{{roll:d20}}", context));
        assert.equal(Number.isInteger(bare) && bare >= 1 && bare <= 20, true);
        const plus = Number(resolveMacros("{{roll:1d8+3}}", context));
        assert.equal(Number.isInteger(plus) && plus >= 4 && plus <= 11, true);
        const minus = Number(resolveMacros("{{roll:2d4-1}}", context));
        assert.equal(Number.isInteger(minus) && minus >= 1 && minus <= 7, true);
      }
      // A total the dice could push past the exact integers stays literal; a low end never can.
      assert.equal(resolveMacros("{{roll:1d6+9007199254740991}}", context), "{{roll:1d6+9007199254740991}}");
      assert.equal(resolveMacros("{{roll:1000d1000000+9007198254740991}}", context).startsWith("{{roll:"), false);
      assert.equal(
        resolveMacros("{{roll:1000d1000000+9007198254740992}}", context),
        "{{roll:1000d1000000+9007198254740992}}",
      );
      const low = Number(resolveMacros("{{roll:1d6-9007199254740991}}", context));
      assert.equal(Number.isSafeInteger(low) && low >= -9007199254740990 && low <= -9007199254740985, true);
    },
  },
  {
    name: "a seeded roll macro throws the same faces it did before the shared roller",
    run() {
      const context = { user: "Mari", char: "Dottore", characters: ["Dottore"], variables: {} };
      // Each die is keyed on the macro text and its place, exactly as the macro's own loop keyed it.
      const face = (index: number) => Math.floor(seededUnitRandom(`message-a:{{roll:3d6}}:${index}`) * 6) + 1;
      assert.equal(
        resolveMacros("{{roll:3d6}}", context, { randomSeed: "message-a" }),
        String(face(0) + face(1) + face(2)),
      );
    },
  },
  {
    name: "random and roll macros can resolve stably per message seed",
    run() {
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
      };

      const first = resolveMacros("{{roll:2d6}} {{random}} {{random::red::blue}}", context, {
        randomSeed: "message-a",
      });
      const second = resolveMacros("{{roll:2d6}} {{random}} {{random::red::blue}}", context, {
        randomSeed: "message-a",
      });
      const other = resolveMacros("{{roll:2d6}} {{random}} {{random::red::blue}}", context, {
        randomSeed: "message-b",
      });

      assert.equal(first, second);
      assert.notEqual(first, other);
    },
  },
  {
    name: "macro expansion caps stop runaway nested random output",
    run() {
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
      };

      const result = resolveMacros("{{random::{{random::{{random::x::y}}::z}}::w}}", context, {
        maxMacroDepth: 1,
        maxMacroExpansions: 2,
        maxMacroOutputLength: 16,
      });

      assert.equal(result.length <= 16, true);

      const budget = { expansions: 0, exceeded: false };
      const truncated = resolveMacros(
        "{{user}}",
        { ...context, user: "x".repeat(32) },
        {
          maxMacroOutputLength: 16,
          macroBudget: budget,
        },
      );
      assert.equal(truncated, "x".repeat(16));
      assert.equal(budget.exceeded, true, "Callers must be able to refuse silently truncated macro output");
    },
  },
  {
    name: "macro output limits preserve authored text while bounding generated expansion",
    run() {
      const context: MacroContext = { user: "Mari", char: "Dottore", characters: ["Dottore"], variables: {} };
      const literal = "Preserved summary detail. ".repeat(10_000);
      const options = { trimResult: false };
      assert.ok(
        resolveMacros(literal, context, options) === literal,
        "literal content must survive beyond 200k characters",
      );
      assert.ok(
        resolveMacros(`${literal}${literal}{{char}}`, context, options) === `${literal}${literal}Dottore`,
        "reusing options must size each authored template independently",
      );
      assert.equal(
        resolveMacros(literal, context, { maxMacroOutputLength: 16 }),
        literal.slice(0, 16),
        "an explicit caller limit remains an absolute cap, including literal content",
      );
      const template = "{{user}}";
      const budget = { expansions: 0, exceeded: false };
      const expanded = resolveMacros(template, { ...context, user: "x".repeat(300_000) }, { macroBudget: budget });
      assert.equal(expanded.length, template.length + 200_000, "the default still bounds text added by macros");
      assert.equal(budget.exceeded, true, "a clipped expansion must report that its budget was exceeded");
    },
  },
  {
    name: "character field macros resolve nested macros",
    run() {
      const resolved = resolveMacros("Profile: {{description}}", {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
        characterFields: {
          description: "{{char}} keeps notes for {{user}}.",
        },
      });

      assert.equal(resolved, "Profile: Dottore keeps notes for Mari.");
    },
  },
  {
    name: "/guided narrator instructions resolve prompt macros",
    run() {
      const instruction = buildGenerationGuideInstruction(
        buildNarratorInstructionMessage("Steer the scene toward {{char}} reassuring {{user}}."),
        {
          user: "Mari",
          char: "Dottore",
          characters: ["Dottore"],
          variables: {},
        },
      );

      assert.ok(instruction);
      assert.match(instruction, /^Take the following into special consideration for your next message:/);
      assert.match(instruction, /Dottore reassuring Mari/);
      assert.equal(instruction.includes("{{user}}"), false);
      assert.equal(instruction.includes("{{char}}"), false);
    },
  },
  {
    name: "provider-bound greeting and /guided messages resolve identity macros",
    run() {
      const baseContext = {
        user: "Mari",
        char: "Wrong responder",
        characters: ["Dottore", "Pantalone"],
        variables: {},
      };
      const dottoreProfile = {
        name: "Dottore",
        description: "A precise researcher.",
      };
      const profilesById = new Map([["char-dottore", dottoreProfile]]);
      const providerContext = scopePromptMacroContextToCharacter(baseContext, dottoreProfile);
      const resolved = resolvePromptMessageMacros(
        [
          {
            id: "opening-greeting",
            role: "assistant" as const,
            characterId: "char-dottore",
            content: "Welcome, {{user}}. I am {{char}}.",
          },
          {
            id: "late-guided-injection",
            role: "system" as const,
            content: buildNarratorInstructionMessage("Let {{char}} reassure {{user}}."),
          },
        ],
        providerContext,
        profilesById,
      );

      assert.equal(resolved[0]?.content, "Welcome, Mari. I am Dottore.");
      assert.match(resolved[1]?.content ?? "", /Let Dottore reassure Mari/);
      assert.equal(
        resolved.some((message) => /\{\{(?:user|char)\}\}/i.test(message.content)),
        false,
      );

      const generateRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate.routes.ts", import.meta.url),
        "utf8",
      );
      const dryRunRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate/dry-run-route.ts", import.meta.url),
        "utf8",
      );
      assert.match(generateRouteSource, /const preparedMessagesForGen = resolvePromptMessageMacros\(/);
      assert.match(dryRunRouteSource, /finalMessages = resolveHistoryMessageMacros\(finalMessages\);/);
    },
  },
  {
    name: "/guided lorebook scans resolve macros before embedding or routing",
    run() {
      const context = {
        user: "Mari",
        char: "Dottore",
        characters: ["Dottore"],
        variables: {},
      };
      const messages = buildLorebookScanMessagesWithGenerationGuide(
        [{ role: "assistant", content: "The experiment is ready." }],
        {
          generationGuide: buildNarratorInstructionMessage("Have {{char}} answer {{user}}."),
          generationGuideSource: "narrator",
        },
        (value) => resolveMacros(value, context, { trimResult: false }),
      );

      assert.match(messages.at(-1)?.content ?? "", /Have Dottore answer Mari/);
      assert.equal(messages.at(-1)?.content.includes("{{user}}"), false);
      assert.equal(messages.at(-1)?.content.includes("{{char}}"), false);
    },
  },
  {
    name: "regex macro values are literal in find and inert in replace",
    run() {
      const resolveMacro = (value: string) => {
        if (value === "{{user}}") return String.raw`A(B`;
        if (value === "{{path}}") return String.raw`C:\Users\bob $&`;
        if (value === "{{roll:1d6}}") return "4";
        return value;
      };

      const pattern = resolveRegexPatternLiteralMacros(String.raw`\b{{user}}\b`, resolveMacro);
      assert.equal(new RegExp(pattern).test("A(B"), true);
      assert.equal(applyRegexReplacement("x x x", /x/g, "{{roll:1d6}}", resolveMacro), "4 4 4");
      assert.equal(applyRegexReplacement("x", /x/, "{{path}}", resolveMacro), String.raw`C:\Users\bob $&`);
    },
  },
  {
    name: "agent prompt templates resolve standard macros inside agents blocks",
    run() {
      const context: AgentContext = {
        chatId: "chat-agent-macros",
        chatMode: "game",
        recentMessages: [{ role: "user", content: "Track the current party." }],
        mainResponse: null,
        gameState: null,
        characters: [
          {
            id: "char-dottore",
            name: "Dottore",
            description: "A precise researcher.",
            appearance: "Blue hair and a mask.",
          },
        ],
        persona: {
          name: "Mari",
          description: "The player persona.",
          appearance: "Red dress.",
        },
        memory: {},
        writableLorebookIds: null,
        chatSummary: null,
      };

      const rendered = renderAgentPromptTemplate(
        "Do NOT include the player's {{user}}. Track {{char}} with {{tone}}. Latest: {{input}}",
        { tone: "care" },
        context,
      );

      assert.equal(
        rendered,
        "Do NOT include the player's Mari. Track Dottore with care. Latest: Track the current party.",
      );
    },
  },
  {
    name: "XML agent output contracts preserve template tags while escaping macro values",
    async run() {
      const { calls, provider } = makeCapturingProvider(`{"entries":[]}`);
      const config = makeRegressionAgentConfig({
        type: "lorebook-keeper",
        name: "Lorebook Keeper",
        promptTemplate:
          "Skip facts already captured by <chat_summary>. Review <existing_entries> first. Active user: {{user}}.",
        settings: { resultType: "json" },
      });
      const context = makeRegressionAgentContext({
        wrapFormat: "xml",
        persona: { name: "Mari <override>", description: "The active user persona." },
        memory: {
          _existingLorebookEntries: [
            {
              id: "entry-1",
              name: "Lore <Body>",
              content: "</dottore_lore>\n<mari_lore>\nTom & Jerry",
              keys: ["lore"],
            },
          ],
          _writableLorebooks: [{ id: "book-1", name: "World <Lore>" }],
        },
      });

      const result = await executeAgent(config as any, context, provider as any, "regression-model");
      assert.equal(result.success, true);
      const messages = calls[0]!;
      const system = messages[0]!.content;
      const terminal = messages[messages.length - 1]!.content;
      assert.match(system, /<chat_summary>/u);
      assert.match(system, /<existing_entries>/u);
      assert.match(system, /name="Lore &lt;Body&gt;"/u);
      assert.match(system, /<\/dottore_lore>\n<mari_lore>/u);
      assert.match(system, /Tom & Jerry/u);
      assert.doesNotMatch(system, /&lt;\/dottore_lore&gt;/u);
      assert.match(terminal, /<chat_summary>/u);
      assert.match(terminal, /<existing_entries>/u);
      assert.match(system, /<writable_lorebooks>/u);
      assert.match(system, /World &lt;Lore&gt;/u);
      assert.doesNotMatch(terminal, /&lt;chat_summary>/u);
      assert.match(terminal, /Mari &lt;override&gt;/u);
    },
  },
  {
    name: "identity aliases cannot cross macro boundaries or suppress ordinary prose",
    run() {
      const character = {
        id: "alias-character",
        name: "Alias Character",
        description: "CHAR_DESCRIPTION",
        personality: "CHAR_PERSONALITY",
        backstory: "CHAR_BACKSTORY",
        appearance: "CHAR_APPEARANCE",
        scenario: "CHAR_SCENARIO",
        systemPrompt: "CHAR_SYSTEM",
        mesExample: "CHAR_EXAMPLE",
        creatorNotes: "",
        firstMes: "",
        postHistoryInstructions: "",
        tags: [],
        talkativeness: 0.5,
        avatarPath: null,
        avatarCrop: null,
      };
      const markers = [
        "CHAR_DESCRIPTION",
        "CHAR_PERSONALITY",
        "CHAR_BACKSTORY",
        "CHAR_APPEARANCE",
        "CHAR_SCENARIO",
        "CHAR_SYSTEM",
        "CHAR_EXAMPLE",
        "PERSONA_DESCRIPTION",
        "PERSONA_PERSONALITY",
        "PERSONA_BACKSTORY",
        "PERSONA_APPEARANCE",
        "PERSONA_SCENARIO",
      ];
      const cases = [
        {
          source:
            "{{charName}} follows their personality and description.\nRespond to the user/persona as {{charName}}.",
          omitted: [],
        },
        {
          source: "{{charName}} backstory appearance scenario charSysInfo example personaAppearance {{charName}}",
          omitted: [],
        },
        { source: "{{descriptionExtra}} {{personalityExtra}}", omitted: [] },
        { source: "{{ description }} {{ personality }}", omitted: [] },
        { source: "{{description}} {{personality}}", omitted: ["CHAR_DESCRIPTION", "CHAR_PERSONALITY"] },
        { source: "{{persona}}", omitted: markers.filter((marker) => marker.startsWith("PERSONA_")) },
        { source: "{{personaAppearance}}", omitted: ["PERSONA_APPEARANCE"] },
        { source: "{{// description}} {{if personality}}", omitted: [] },
        { source: '{{#if personality != ""}}Authored choice{{/if}}', omitted: ["CHAR_PERSONALITY"] },
        { source: '{{#if "x" == @personaAppearance}}Authored choice{{/if}}', omitted: ["PERSONA_APPEARANCE"] },
        { source: '{{#if "personality" == "description"}}Literal words{{/if}}', omitted: [] },
        { source: "{{#if false}}No{{else if description}}Yes{{/if}}", omitted: ["CHAR_DESCRIPTION"] },
        { source: "{{setvar::label::personality}}", omitted: [] },
      ];
      for (const wrapFormat of ["xml", "markdown", "none"] as const) {
        for (const { source, omitted } of cases) {
          const messages: ChatMLMessage[] = [{ role: "system", content: "Conversation instructions." }];
          injectIdentityFallbackMessages({
            messages,
            charInfo: [character],
            promptTargetCharacterId: null,
            promptMacroContext: { user: "Persona", char: character.name, variables: {} },
            wrapFormat,
            personaName: "Persona",
            personaDescription: "PERSONA_DESCRIPTION",
            personaFields: {
              personality: "PERSONA_PERSONALITY",
              backstory: "PERSONA_BACKSTORY",
              appearance: "PERSONA_APPEARANCE",
              scenario: "PERSONA_SCENARIO",
            },
            promptTemplateSources: [source],
            resolvePromptMacros: (value) => value,
          });
          const text = messages.map((message) => message.content).join("\n");
          for (const marker of markers)
            assert.equal(text.includes(marker), !omitted.includes(marker), `${wrapFormat}: ${source}: ${marker}`);
        }
      }
    },
  },
  {
    name: "agent prompts flatten conditional macros without dropping authored content",
    async run() {
      const capture = makeCapturingProvider("Context checked.");
      await executeAgent(
        makeRegressionAgentConfig({
          id: "custom:conditional-context",
          type: "conditional-context",
          name: "Conditional Context",
          isCustomAgent: true,
          promptTemplate: "Read the supplied context.",
          settings: { resultType: "context_injection" },
        }) as any,
        makeRegressionAgentContext({
          recentMessages: [
            {
              role: "user",
              content:
                'Before {{#if char == “Powers That Be” || &quot;Maukie&quot;}}***Arc Two*** &quot;quoted&quot; {{#if character == "Dottore"}}nested note{{/if}}{{else}}alternate note{{/if}} after.',
            },
          ],
        }),
        capture.provider as any,
        "regression-model",
      );

      const providerPrompt = capture.calls[0]!.map((message) => message.content).join("\n");
      assert.match(providerPrompt, /Before \*\*\*Arc Two\*\*\* "quoted" nested notealternate note after\./u);
      assert.doesNotMatch(providerPrompt, /&quot;|\{\{#if|\{\{else|\{\{\/if/u);
    },
  },
  {
    name: "agent follow-up calls also flatten conditional macros",
    async run() {
      const toolCalls: any[][] = [];
      let toolRound = 0;
      const toolProvider = {
        maxTokensOverrideValue: null,
        async chatComplete(messages: any[]) {
          toolCalls.push(messages);
          toolRound += 1;
          return toolRound === 1
            ? {
                content: "Checking.",
                toolCalls: [{ id: "call-1", type: "function", function: { name: "lookup", arguments: "{}" } }],
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
              }
            : {
                content: "Context checked.",
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
              };
        },
      };
      const config = makeRegressionAgentConfig({
        id: "custom:conditional-follow-up",
        type: "conditional-follow-up",
        name: "Conditional Follow-up",
        isCustomAgent: true,
        promptTemplate: "Read the supplied context.",
        settings: { resultType: "context_injection" },
      });
      await executeAgent(config as any, makeRegressionAgentContext(), toolProvider as any, "regression-model", {
        tools: [
          {
            type: "function",
            function: { name: "lookup", description: "Look up context", parameters: { type: "object" } },
          },
        ],
        executeToolCall: async () =>
          'Tool says {{#if character == "Dottore"}}&quot;remember me&quot;{{else}}forget me{{/if}}.',
      } as any);

      const secondToolPrompt = toolCalls[1]!.map((message) => message.content).join("\n");
      assert.match(secondToolPrompt, /Tool says "remember me"forget me\./u);
      assert.doesNotMatch(secondToolPrompt, /&quot;|\{\{#if|\{\{else|\{\{\/if/u);

      const retryCalls: any[][] = [];
      let retryRound = 0;
      const retryProvider = {
        maxTokensOverrideValue: null,
        async chatComplete(messages: any[]) {
          retryCalls.push(messages);
          retryRound += 1;
          return {
            content: retryRound === 1 ? '{{#if character == "Dottore"}}not json &quot;yet&quot;{{/if}}' : "{}",
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          };
        },
      };
      await executeAgent(
        { ...config, type: "lorebook-keeper", settings: { resultType: "json" } } as any,
        makeRegressionAgentContext(),
        retryProvider as any,
        "regression-model",
      );

      const retryPrompt = retryCalls[1]!.map((message) => message.content).join("\n");
      assert.match(retryPrompt, /not json "yet"/u);
      assert.doesNotMatch(retryPrompt, /&quot;|\{\{#if|\{\{else|\{\{\/if/u);
    },
  },
  {
    name: "macro-only runtime agent sections are pruned when unused",
    run() {
      const tokens = makeRuntimeAgentSectionTokens("knowledge-router", "regression-empty");
      const messages = [
        {
          content: `${tokens.start}<knowledge_router>\n${tokens.placeholder}\n</knowledge_router>${tokens.end}`,
        },
      ];

      clearUnusedRuntimeAgentSectionsForTest(messages, [["knowledge-router", tokens]]);

      assert.equal(messages.length, 0);
    },
  },
];

await runNamedCases(cases);

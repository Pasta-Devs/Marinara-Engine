import assert from "node:assert/strict";
import { isAgentAvailableInChatMode, type ChatMLMessage } from "../../../packages/shared/src/index.js";
import {
  appendNonLeadingSystemMessagesToLastUser,
  appendReadableAttachmentsToContent,
  appendSeparateAgentInjectionMessage,
  shouldEnableAgentsForGeneration,
  shouldInjectIdentityFallback,
  type SimpleMessage,
} from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  orderCharacterMarkerFields,
  resolveCharacterMarkerFields,
} from "../../../packages/server/src/services/prompt/marker-expander.js";
import type { DB } from "../../../packages/server/src/db/connection.js";
import { passThroughLeaf } from "../../../packages/server/src/services/prompt/prompt-escaping.js";
import {
  appendContinuationMessageContent,
  CONTINUE_ASSISTANT_MESSAGE_DIRECT_PROMPT,
} from "../../../packages/server/src/services/generation/roleplay-summary-runtime.js";
import { resolveGenerationPromptPresetChoices } from "../../../packages/server/src/routes/generate/prompt-preset-selection.js";
import { fitMessagesForModelAccess } from "../../../packages/server/src/services/generation/model-access-policy.js";
import {
  assemblePrompt,
  resolveChoiceVariableValue,
  type AssemblerInput,
} from "../../../packages/server/src/services/prompt/index.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import { promptSection } from "../fixtures/prompt-helpers.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
  {
    name: "/continue can append directly without inserting a newline",
    run: () => {
      assert.equal(
        appendContinuationMessageContent("The experi", "ment continues.", false),
        "The experiment continues.",
      );
      assert.equal(
        appendContinuationMessageContent("The experiment", "\ncontinues.", false),
        "The experimentcontinues.",
      );
      assert.equal(appendContinuationMessageContent("The experiment", "continues."), "The experiment\n\ncontinues.");
      assert.equal(
        appendContinuationMessageContent("  The experiment \r\n", "\n continues.\t"),
        "  The experiment\n\ncontinues.\t",
      );
      assert.match(CONTINUE_ASSISTANT_MESSAGE_DIRECT_PROMPT, /appended directly/i);
      assert.match(CONTINUE_ASSISTANT_MESSAGE_DIRECT_PROMPT, /no newline or separator/i);
    },
  },
  {
    name: "readable text attachments are not pre-truncated before context fitting",
    run() {
      const repeated = "0123456789".repeat(7_000);
      const encoded = Buffer.from(repeated, "utf8").toString("base64");
      const content = appendReadableAttachmentsToContent("Please read this.", [
        {
          type: "text/plain",
          data: `data:text/plain;base64,${encoded}`,
          filename: "long.txt",
        },
      ]);

      assert.match(content, /<attached_file name="long.txt" type="text\/plain">/);
      assert.match(content, /Please read this\./);
      assert.equal(content.includes("[Attachment truncated after"), false);
      assert.ok(content.includes(repeated));
    },
  },
  {
    name: "post-history system messages are folded into user turns",
    run() {
      const messages: SimpleMessage[] = [
        { role: "system", content: "base system" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "system", content: "post-history instruction" },
      ];

      const normalized = appendNonLeadingSystemMessagesToLastUser(messages);

      assert.equal(normalized.length, 3);
      assert.equal(normalized[0]?.role, "system");
      assert.equal(normalized[1]?.role, "user");
      assert.match(normalized[1]?.content ?? "", /hello/);
      assert.match(normalized[1]?.content ?? "", /post-history instruction/);
      assert.equal(
        normalized.some((message, index) => index > 0 && message.role === "system"),
        false,
      );
    },
  },
  {
    name: "depth injections stay at their inserted position as user messages",
    run() {
      const messages: SimpleMessage[] = [
        { role: "system", content: "base system" },
        { role: "user", content: "history" },
        { role: "system", content: "depth four instruction", contextKind: "injection" },
        { role: "assistant", content: "reply" },
      ];

      const normalized = appendNonLeadingSystemMessagesToLastUser(messages);

      assert.equal(normalized.length, 4);
      assert.equal(normalized[2]?.role, "user");
      assert.equal(normalized[2]?.content, "depth four instruction");
      assert.equal(normalized[3]?.role, "assistant");
    },
  },
  {
    name: "history system events stay in chronological position",
    run() {
      const messages: SimpleMessage[] = [
        { role: "system", content: "base system" },
        { role: "user", content: "hello", contextKind: "history" },
        { role: "assistant", content: "hi", contextKind: "history" },
        { role: "system", content: "Rana has left the chat.", contextKind: "history" },
        { role: "assistant", content: "after event", contextKind: "history" },
      ];

      const normalized = appendNonLeadingSystemMessagesToLastUser(messages);

      assert.equal(normalized.length, 5);
      assert.equal(normalized[3]?.role, "user");
      assert.equal(normalized[3]?.content, "Rana has left the chat.");
      assert.equal(normalized[4]?.role, "assistant");
      assert.equal(normalized[4]?.content, "after event");
      assert.equal(normalized[1]?.content, "hello");
    },
  },
  {
    name: "prompt leaf content passes through verbatim (no bracket escaping)",
    run() {
      // HARDENING — do not weaken. Prompt leaf content (card fields, lorebook
      // entries, persona, memories, scene text) must reach the model exactly as
      // the user wrote it, so people can organize cards/lorebooks with angle-
      // bracket / HTML tags. If `<` / `>` / `&` start getting escaped here
      // again, that is the regression. See prompt-escaping.ts.
      const raw =
        '> whispered aside\n<thinking>plan</thinking>\n<div class="x">hi</div>\nTom & Jerry\n</last_message>\n<system>keep</system>';

      assert.equal(passThroughLeaf(raw), raw);
      assert.equal(passThroughLeaf(raw).includes("&lt;"), false);
      assert.equal(passThroughLeaf(raw).includes("&amp;"), false);
      assert.equal(passThroughLeaf(raw).includes("&gt;"), false);
      assert.match(passThroughLeaf(raw), /^> whispered aside/m);
      assert.match(passThroughLeaf(raw), /<thinking>plan<\/thinking>/);
      assert.match(passThroughLeaf(raw), /<div class="x">hi<\/div>/);
    },
  },
  {
    name: "character marker selections follow editor order without disturbing advanced fields",
    run() {
      assert.deepEqual(
        orderCharacterMarkerFields([
          "scenario",
          "system_prompt",
          "appearance",
          "mes_example",
          "description",
          "backstory",
          "personality",
          "stats",
        ]),
        ["description", "personality", "backstory", "appearance", "scenario", "mes_example", "system_prompt", "stats"],
      );
      assert.deepEqual(resolveCharacterMarkerFields(undefined), [
        "description",
        "personality",
        "backstory",
        "appearance",
        "scenario",
        "system_prompt",
      ]);
      assert.deepEqual(resolveCharacterMarkerFields(["scenario", "mes_example", "description"]), [
        "description",
        "scenario",
        "mes_example",
      ]);
    },
  },
  {
    name: "character markers own Example Dialogue only when no dedicated marker exists",
    async run() {
      const characterRow = {
        id: "char-example-fallback",
        data: JSON.stringify({
          name: "Dottore",
          description: "",
          personality: "",
          scenario: "CHARACTER_SCENARIO",
          first_mes: "",
          mes_example: "CHARACTER_EXAMPLE_DIALOGUE",
          creator_notes: "CREATOR_NOTES_NEVER_SENT",
          system_prompt: "CHARACTER_SYSTEM_PROMPT",
          post_history_instructions: "",
          tags: [],
          creator: "",
          character_version: "1.0",
          alternate_greetings: [],
          extensions: {
            talkativeness: 0.5,
            fav: false,
            world: "",
            depth_prompt: { prompt: "", depth: 4, role: "system" },
            backstory: "",
            appearance: "",
          },
          character_book: null,
        }),
      };
      const db = {
        select: () => ({
          from: () => ({ where: async () => [characterRow] }),
        }),
      } as unknown as DB;

      const assemble = (
        wrapFormat: "xml" | "markdown" | "none",
        dialogueMarker: "absent" | "enabled" | "disabled",
        characterFields?: string[],
      ) =>
        assemblePrompt({
          db,
          worldState: null, // This card-only fixture has no snapshot store.
          preset: {
            id: `preset-example-fallback-${wrapFormat}`,
            name: "Example Dialogue Fallback Fixture",
            sectionOrder: JSON.stringify(dialogueMarker === "absent" ? ["character"] : ["character", "examples"]),
            groupOrder: JSON.stringify([]),
            wrapFormat,
            parameters: JSON.stringify({}),
            variableGroups: JSON.stringify([]),
            variableValues: JSON.stringify({}),
          },
          sections: [
            promptSection({
              id: "character",
              identifier: "characterInfo",
              name: "Character Info",
              isMarker: "true",
              markerConfig: JSON.stringify({ type: "character", ...(characterFields ? { characterFields } : {}) }),
            }),
            ...(dialogueMarker !== "absent"
              ? [
                  promptSection({
                    id: "examples",
                    identifier: "dialogueExamples",
                    name: "Dialogue Examples",
                    isMarker: "true",
                    markerConfig: JSON.stringify({ type: "dialogue_examples" }),
                    injectionOrder: 1,
                    enabled: dialogueMarker === "disabled" ? "false" : "true",
                  }),
                ]
              : []),
          ],
          groups: [],
          choiceBlocks: [],
          chatChoices: {},
          chatId: "chat-example-fallback",
          characterIds: [characterRow.id],
          personaName: "Mari",
          personaDescription: "",
          chatMessages: [],
        });

      for (const wrapFormat of ["xml", "markdown", "none"] as const) {
        const absentMarkerResult = await assemble(wrapFormat, "absent");
        const absentMarkerPromptText = absentMarkerResult.messages.map((message) => message.content).join("\n");
        assert.equal(absentMarkerPromptText.match(/CHARACTER_EXAMPLE_DIALOGUE/g)?.length, 1);
        assert.ok(
          absentMarkerPromptText.indexOf("CHARACTER_EXAMPLE_DIALOGUE") <
            absentMarkerPromptText.indexOf("CHARACTER_SYSTEM_PROMPT"),
          "fallback Example Dialogue should retain canonical character field order",
        );
        if (wrapFormat === "xml") assert.match(absentMarkerPromptText, /<mes_example>/);

        const disabledMarkerResult = await assemble(wrapFormat, "disabled");
        const disabledMarkerPromptText = disabledMarkerResult.messages.map((message) => message.content).join("\n");
        assert.equal(disabledMarkerPromptText.includes("CHARACTER_EXAMPLE_DIALOGUE"), false);
        assert.equal(disabledMarkerPromptText.includes("mes_example"), false);
        assert.equal(disabledMarkerPromptText.includes("dialogue_examples"), false);
      }

      const explicitCharacterField = await assemble("xml", "absent", ["mes_example"]);
      const explicitCharacterFieldText = explicitCharacterField.messages.map((message) => message.content).join("\n");
      assert.equal(explicitCharacterFieldText.match(/CHARACTER_EXAMPLE_DIALOGUE/g)?.length, 1);
      assert.match(explicitCharacterFieldText, /<mes_example>/);

      // #8582: creator notes are never sent, even by a marker (an imported preset) that names the field, in any format.
      for (const wrapFormat of ["xml", "markdown", "none"] as const) {
        const named = await assemble(wrapFormat, "absent", ["description", "creator_notes", "scenario"]);
        const namedText = named.messages.map((message) => message.content).join("\n");
        assert.equal(namedText.includes("CREATOR_NOTES_NEVER_SENT"), false, `${wrapFormat}: no creator notes`);
        assert.equal(namedText.includes("creator_notes"), false, `${wrapFormat}: no creator notes section`);
        assert.match(namedText, /CHARACTER_SCENARIO/, `${wrapFormat}: the other named fields still are`);
        const defaults = await assemble(wrapFormat, "absent");
        assert.equal(
          defaults.messages.some((message) => message.content.includes("CREATOR_NOTES_NEVER_SENT")),
          false,
        );
      }

      const explicitMarker = await assemble("xml", "enabled");
      const explicitPromptText = explicitMarker.messages.map((message) => message.content).join("\n");
      assert.equal(explicitPromptText.match(/CHARACTER_EXAMPLE_DIALOGUE/g)?.length, 1);
      assert.match(explicitPromptText, /<dialogue_examples>/);
      assert.equal(explicitPromptText.includes("<mes_example>"), false);
    },
  },
  {
    name: "prompt blocks that skip wrapping are sent as written while the rest of the preset and markers stay wrapped",
    async run() {
      const assembleWith = async (wrapFormat: "xml" | "markdown") => {
        const result = await assemblePrompt({
          db: undefined as unknown as DB,
          preset: {
            id: "preset-skip-wrap",
            name: "Skip Wrap Fixture",
            sectionOrder: JSON.stringify(["main", "raw", "grouped", "summary"]),
            groupOrder: JSON.stringify(["rules"]),
            wrapFormat,
            parameters: JSON.stringify({}),
            variableGroups: JSON.stringify([]),
            variableValues: JSON.stringify({}),
          },
          sections: [
            promptSection({ id: "main", identifier: "main", name: "Main Prompt", content: "WRAPPED_MAIN" }),
            promptSection({ id: "raw", identifier: "raw", name: "Raw Block", content: "RAW_TEXT", skipWrap: "true" }),
            promptSection({
              id: "grouped",
              identifier: "grouped",
              name: "Grouped Raw",
              content: "GROUPED_RAW_TEXT",
              groupId: "rules",
              skipWrap: "true",
            }),
            promptSection({
              id: "summary",
              identifier: "chatSummary",
              name: "Chat Summary",
              isMarker: "true",
              markerConfig: JSON.stringify({ type: "chat_summary" }),
              skipWrap: "true",
            }),
          ],
          groups: [
            {
              id: "rules",
              presetId: "preset-skip-wrap",
              name: "Rules",
              parentGroupId: null,
              order: 0,
              enabled: "true",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          choiceBlocks: [],
          chatChoices: {},
          chatId: "chat-skip-wrap",
          characterIds: [],
          personaName: "Mari",
          personaDescription: "",
          chatMessages: [],
          chatSummary: "SUMMARY_TEXT",
        });
        return result.messages.map((message) => message.content).join("\n");
      };

      const xml = await assembleWith("xml");
      assert.match(xml, /<main_prompt>\s*WRAPPED_MAIN\s*<\/main_prompt>/u);
      assert.match(xml, /(^|\n)RAW_TEXT(\n|$)/u);
      assert.doesNotMatch(xml, /raw_block|grouped_raw/u);
      assert.match(xml, /<rules>\s*GROUPED_RAW_TEXT\s*<\/rules>/u, "the group still wraps an opted-out section");
      assert.match(xml, /<chat_summary>[\s\S]*SUMMARY_TEXT[\s\S]*<\/chat_summary>/u, "markers ignore skipWrap");

      const markdown = await assembleWith("markdown");
      assert.match(markdown, /## Main Prompt\nWRAPPED_MAIN/u);
      assert.doesNotMatch(markdown, /Raw Block|Grouped Raw/u);
      assert.match(markdown, /# Rules\nGROUPED_RAW_TEXT/u);
    },
  },
  {
    name: "mode-specific prompt gates keep known behavior stable",
    run() {
      assert.equal(shouldInjectIdentityFallback({ chatMode: "conversation", presetId: "preset" }), true);
      assert.equal(shouldInjectIdentityFallback({ chatMode: "roleplay", presetId: "preset" }), false);
      assert.equal(shouldInjectIdentityFallback({ chatMode: "roleplay", presetId: null }), true);
      assert.equal(shouldInjectIdentityFallback({ chatMode: "game", presetId: null }), false);

      assert.equal(
        shouldEnableAgentsForGeneration({
          chatEnableAgents: true,
          impersonate: false,
          impersonateBlockAgents: false,
        }),
        true,
      );
      for (const chatMode of ["conversation", "roleplay", "game"] as const) {
        assert.equal(
          isAgentAvailableInChatMode(chatMode, "custom-human-voice-rewriter"),
          true,
          `expected custom agents to be available in ${chatMode}`,
        );
      }
      assert.equal(
        shouldEnableAgentsForGeneration({
          chatEnableAgents: false,
          impersonate: false,
          impersonateBlockAgents: false,
        }),
        false,
      );
      assert.equal(
        shouldEnableAgentsForGeneration({
          chatEnableAgents: true,
          impersonate: true,
          impersonateBlockAgents: true,
        }),
        false,
      );
    },
  },
  {
    name: "prompt assembly resolves the request model and keeps an absent model empty",
    async run() {
      for (const model of [undefined, "vendor/model-a", "override-model-b"]) {
        const result = await assemblePrompt({
          db: undefined as unknown as DB,
          model,
          preset: {
            id: "model-macro",
            name: "Model macro",
            sectionOrder: JSON.stringify(["main"]),
            groupOrder: "[]",
            wrapFormat: "xml",
            parameters: "{}",
            variableGroups: "[]",
            variableValues: "{}",
          },
          sections: [promptSection({ id: "main", identifier: "main", name: "Main", content: "Model: {{model}}." })],
          groups: [],
          choiceBlocks: [],
          chatChoices: {},
          chatId: "model-macro",
          characterIds: [],
          personaName: "Mari",
          personaDescription: "",
          chatMessages: [],
          disableLorebooks: true,
        });
        assert.ok(result.messages.some((message) => message.content.includes(`Model: ${model ?? ""}.`)));
      }
    },
  },
  {
    name: "impersonate assembly skips fallback preset sections but preserves dedicated impersonate presets",
    async run() {
      const chatMessages: ChatMLMessage[] = [
        { role: "user", content: "Can you answer as me?" },
        { role: "assistant", content: "I can help." },
      ];
      const baseInput: AssemblerInput = {
        db: undefined as unknown as DB,
        preset: {
          id: "preset-impersonate",
          name: "Impersonate Fixture",
          sectionOrder: JSON.stringify(["main", "history"]),
          groupOrder: JSON.stringify([]),
          wrapFormat: "xml",
          parameters: JSON.stringify({}),
          variableGroups: JSON.stringify([]),
          variableValues: JSON.stringify({}),
        },
        sections: [
          {
            id: "main",
            presetId: "preset-impersonate",
            identifier: "main",
            name: "Main Prompt",
            content: "You are {{char}}. Never answer as {{user}}.",
            role: "system",
            enabled: "true",
            isMarker: "false",
            groupId: null,
            markerConfig: null,
            injectionPosition: "ordered",
            injectionDepth: 0,
            injectionOrder: 0,
            forbidOverrides: "false",
          },
          {
            id: "history",
            presetId: "preset-impersonate",
            identifier: "chatHistory",
            name: "Chat History",
            content: "",
            role: "system",
            enabled: "true",
            isMarker: "true",
            groupId: null,
            markerConfig: JSON.stringify({
              type: "chat_history",
              chatHistoryOptions: { includeSystemMessages: false },
            }),
            injectionPosition: "ordered",
            injectionDepth: 0,
            injectionOrder: 1,
            forbidOverrides: "false",
          },
        ],
        groups: [],
        choiceBlocks: [],
        chatChoices: {},
        chatId: "chat-impersonate",
        characterIds: [],
        personaName: "Mari",
        personaDescription: "The current user.",
        chatMessages,
      };

      const normal = await assemblePrompt(baseInput);
      const impersonate = await assemblePrompt({ ...baseInput, impersonate: true });
      const dedicatedImpersonate = await assemblePrompt({
        ...baseInput,
        impersonate: true,
        preserveImpersonatePresetSections: true,
      });
      const normalText = normal.messages.map((message) => message.content).join("\n");
      const impersonateText = impersonate.messages.map((message) => message.content).join("\n");
      const dedicatedImpersonateText = dedicatedImpersonate.messages.map((message) => message.content).join("\n");

      assert.match(normalText, /Never answer as Mari/);
      assert.equal(impersonateText.includes("Never answer as Mari"), false);
      assert.match(impersonateText, /Can you answer as me\?/);
      assert.match(impersonateText, /I can help\./);
      assert.match(dedicatedImpersonateText, /Never answer as Mari/);
      assert.match(dedicatedImpersonateText, /Can you answer as me\?/);
      assert.match(dedicatedImpersonateText, /I can help\./);
    },
  },
  {
    name: "separate agent injections survive long-history context fitting",
    run() {
      const messages: SimpleMessage[] = [{ role: "system", content: "Stable system prompt." }];
      for (let index = 0; index < 8; index += 1) {
        messages.push({
          role: index % 2 === 0 ? "user" : "assistant",
          content: `old context ${index} ${"x ".repeat(450)}`,
          contextKind: "history",
        });
      }
      messages.push({ role: "user", content: "latest visible user turn", contextKind: "history" });

      appendSeparateAgentInjectionMessage(messages, "knowledge-router", "ROUTER_SURVIVOR_CONTEXT", "xml");
      messages.push({ role: "assistant", content: "assistant prefill tail" });

      const fitted = fitMessagesForModelAccess({
        messages,
        policy: { suppressModelParameters: false, effectiveMaxContext: 900 },
        maxTokens: 128,
      }).messages;
      const promptText = fitted.map((message) => message.content).join("\n");

      assert.equal(promptText.includes("old context 0"), false);
      assert.match(promptText, /ROUTER_SURVIVOR_CONTEXT/);
    },
  },
  {
    name: "separate agent injections do not depend on a user-adjacent tail",
    run() {
      const messages: SimpleMessage[] = [{ role: "system", content: "Stable system prompt." }];
      messages.push({
        role: "user",
        content: `old user anchor ${"x ".repeat(450)}`,
        contextKind: "history",
      });
      for (let index = 0; index < 6; index += 1) {
        messages.push({
          role: "assistant",
          content: `assistant history tail ${index} ${"x ".repeat(450)}`,
          contextKind: "history",
        });
      }

      appendSeparateAgentInjectionMessage(messages, "knowledge-router", "ROUTER_SURVIVOR_CONTEXT", "xml");
      messages.push({ role: "assistant", content: "assistant prefill tail" });

      const fitted = fitMessagesForModelAccess({
        messages,
        policy: { suppressModelParameters: false, effectiveMaxContext: 900 },
        maxTokens: 128,
      }).messages;
      const promptText = fitted.map((message) => message.content).join("\n");

      assert.equal(promptText.includes("old user anchor"), false);
      assert.match(promptText, /ROUTER_SURVIVOR_CONTEXT/);
    },
  },
  {
    name: "Random Pick resolves one selected preset value on every prompt assembly",
    run() {
      const options = [{ value: "tender" }, { value: "dramatic" }, { value: "playful" }];
      const input = {
        selected: ["tender", "dramatic", "playful"],
        options,
        multiSelect: true,
        randomPick: "true",
      };

      assert.equal(
        resolveChoiceVariableValue({ ...input, randomPick: false, separator: "" }),
        "tenderdramaticplayful",
        "an explicitly empty multi-choice separator is preserved",
      );
      assert.equal(resolveChoiceVariableValue({ ...input, random: () => 0 }), "tender");
      assert.equal(resolveChoiceVariableValue({ ...input, random: () => 0.5 }), "dramatic");
      assert.equal(resolveChoiceVariableValue({ ...input, random: () => 0.999999 }), "playful");
      assert.equal(
        resolveChoiceVariableValue({
          ...input,
          multiSelect: "false",
          randomPick: true,
          random: () => 0.5,
        }),
        "dramatic",
        "legacy Boolean Random Pick rows should retain their multi-value selection",
      );
      assert.equal(
        resolveChoiceVariableValue({
          ...input,
          selected: ["removed", "playful"],
          random: () => 0,
        }),
        "playful",
        "stale values should be removed before Random Pick resolves",
      );

      const booleanOptions = [{ value: "enabled" }];
      assert.equal(
        resolveChoiceVariableValue({
          selected: "",
          options: booleanOptions,
          multiSelect: false,
          randomPick: false,
        }),
        "",
        "an explicit empty Boolean choice must stay OFF",
      );
      assert.equal(
        resolveChoiceVariableValue({
          selected: [],
          options: booleanOptions,
          multiSelect: true,
          randomPick: false,
        }),
        "",
        "an explicit empty multi-choice must stay empty",
      );
      assert.equal(
        resolveChoiceVariableValue({
          selected: undefined,
          options: booleanOptions,
          multiSelect: false,
          randomPick: false,
        }),
        "enabled",
        "missing legacy selections should retain the first-option fallback",
      );
    },
  },
  {
    name: "chat prompt preset defaults fill missing chat preset choices",
    run() {
      assert.deepEqual(
        resolveGenerationPromptPresetChoices({
          presetSource: "chat",
          selectedPresetDiffersFromChat: false,
          presetDefaultChoices: { tone: "tender", format: "prose" },
          chatPresetChoices: { format: "dialogue" },
        }),
        { tone: "tender", format: "dialogue" },
      );
      assert.deepEqual(
        resolveGenerationPromptPresetChoices({
          presetSource: "connection",
          selectedPresetDiffersFromChat: true,
          presetDefaultChoices: { tone: "formal" },
          chatPresetChoices: { tone: "casual" },
        }),
        { tone: "formal" },
      );
    },
  },
];

await runNamedCases(cases);

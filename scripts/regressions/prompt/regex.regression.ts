import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyRegexReplacement, createRegexScriptSchema, isPatternSafe } from "../../../packages/shared/src/index.js";
import {
  CLEAN_HTML_FIND_REGEX,
  CLEAN_HTML_ID,
  LEGACY_CLEAN_HTML_FIND_REGEX,
  shouldMigrateCleanHtmlPattern,
} from "../../../packages/server/src/db/seed-regex.js";
import { applyRegexScriptsToPromptText } from "../../../packages/server/src/services/regex/regex-application.js";
import { scopeIndividualGroupMessagesForTarget } from "../../../packages/server/src/services/generation/prompt-message-scope.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
  {
    name: "regex safety accepts common patterns and rejects ambiguous quantified alternatives",
    run() {
      assert.equal(isPatternSafe(String.raw`\s{2,}`), true);
      assert.equal(isPatternSafe(String.raw`\p{L}+`), true);
      assert.equal(isPatternSafe("hello {name}"), true);
      assert.equal(isPatternSafe("a{,5}"), true);
      assert.equal(isPatternSafe("(a|a)+$"), false);
      assert.equal(isPatternSafe("(a|ab)*c"), false);
      assert.equal(isPatternSafe("a++"), false);
      assert.equal(isPatternSafe(".*.*.*Q"), false);
      assert.equal(isPatternSafe(".*foo.*bar.*baz"), false);
      assert.equal(isPatternSafe(String.raw`.*\*[^*]+\*.*\*[^*]+\*.*`), false);
      assert.equal(isPatternSafe(String.raw`([^|]+)\|([^|]+)\|([^|]+)`), true);
      assert.equal(isPatternSafe(String.raw`([^\\|]+)\|([^\\|]+)\|([^\\|]+)`), true);
      assert.equal(isPatternSafe(String.raw`[^|]+x[^|]+y[^|]+`), false);
    },
  },
  {
    name: "Clean HTML default is safe and removes prompt markup without clobbering exclusions",
    run() {
      assert.equal(isPatternSafe(LEGACY_CLEAN_HTML_FIND_REGEX), false);
      assert.equal(isPatternSafe(CLEAN_HTML_FIND_REGEX), true);
      assert.equal(
        createRegexScriptSchema.safeParse({
          name: "Clean HTML (Outgoing Prompt)",
          findRegex: CLEAN_HTML_FIND_REGEX,
          placement: ["user_input", "ai_output"],
          flags: "g",
          promptOnly: true,
          applyMode: "prompt",
        }).success,
        true,
      );

      const source = [
        "<!DOCTYPE html>",
        '<section class="immersive-frame"><div data-speaker="Albedo">A rendered memory.</div></section>',
        '<speaker="Dottore">"Observe the result."</speaker>',
        '<font color="#f0f">Keep font markup.</font>',
        "<lie>Keep lie markup.</lie>",
        "<filter>Keep filter markup.</filter>",
        "<!-- keep the author comment -->",
      ].join("\n");
      const cleaned = applyRegexScriptsToPromptText(
        source,
        [
          {
            id: CLEAN_HTML_ID,
            name: "Clean HTML (Outgoing Prompt)",
            enabled: "true",
            findRegex: CLEAN_HTML_FIND_REGEX,
            replaceString: "",
            trimStrings: "[]",
            placement: '["user_input","ai_output"]',
            flags: "g",
            promptOnly: "true",
            applyMode: "prompt",
            targetCharacterIds: "[]",
            targetPromptPresetIds: "[]",
            minDepth: null,
            maxDepth: null,
          },
        ],
        "ai_output",
        0,
      );

      assert.doesNotMatch(cleaned, /<!DOCTYPE|<\/?(?:section|div|speaker)\b/u);
      assert.match(cleaned, /A rendered memory\./u);
      assert.match(cleaned, /"Observe the result\."/u);
      assert.match(cleaned, /<font color="#f0f">Keep font markup\.<\/font>/u);
      assert.match(cleaned, /<lie>Keep lie markup\.<\/lie>/u);
      assert.match(cleaned, /<filter>Keep filter markup\.<\/filter>/u);
      assert.match(cleaned, /<!-- keep the author comment -->/u);
    },
  },
  {
    name: "prompt preset-scoped regexes run only for their selected preset",
    run() {
      const script = {
        id: "preset-scoped-regex",
        enabled: "true",
        findRegex: "LAB",
        replaceString: "PALACE",
        placement: '["user_input"]',
        flags: "g",
        applyMode: "prompt",
        targetCharacterIds: "[]",
        targetPromptPresetIds: '["preset-laboratory"]',
      };
      assert.equal(applyRegexScriptsToPromptText("LAB", [script], "user_input", 0), "LAB");
      assert.equal(
        applyRegexScriptsToPromptText("LAB", [script], "user_input", 0, {
          targetPromptPresetId: "preset-ballroom",
        }),
        "LAB",
      );
      assert.equal(
        applyRegexScriptsToPromptText("LAB", [script], "user_input", 0, {
          targetPromptPresetId: "preset-laboratory",
        }),
        "PALACE",
      );
    },
  },
  {
    name: "Clean HTML seed migration only replaces the exact broken built-in pattern",
    run() {
      assert.equal(
        shouldMigrateCleanHtmlPattern({
          id: CLEAN_HTML_ID,
          findRegex: LEGACY_CLEAN_HTML_FIND_REGEX,
        }),
        true,
      );
      assert.equal(
        shouldMigrateCleanHtmlPattern({
          id: CLEAN_HTML_ID,
          findRegex: CLEAN_HTML_FIND_REGEX,
        }),
        false,
      );
      assert.equal(
        shouldMigrateCleanHtmlPattern({
          id: CLEAN_HTML_ID,
          findRegex: "<custom-tag>",
        }),
        false,
      );
      assert.equal(
        shouldMigrateCleanHtmlPattern({
          id: "user-clean-html",
          findRegex: LEGACY_CLEAN_HTML_FIND_REGEX,
        }),
        false,
      );
    },
  },
  {
    name: "regex replacement matches native named-group fallback and preserves literal backslashes",
    run() {
      assert.equal(applyRegexReplacement("John", /(?<first>\w+)/, "Hello $<frist>!"), "Hello !");
      assert.equal(applyRegexReplacement("abc", /(?<g>b)/, "$<>"), "ac");
      assert.equal(applyRegexReplacement("x", /x/, String.raw`C:\Users\bob`), String.raw`C:\Users\bob`);
      assert.equal(applyRegexReplacement("bob", /(\w+)/, String.raw`\U$1\E`), "BOB");
      assert.equal(applyRegexReplacement("bob", /(\w+)/, String.raw`\u$1`), "Bob");
    },
  },
  {
    name: "regex editor examples use direct-entry escaping that works in Live Test",
    run() {
      const locale = JSON.parse(
        readFileSync(new URL("../../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
      ) as Record<string, string>;
      const editorSource = readFileSync(
        new URL("../../../packages/client/src/components/agents/RegexScriptEditor.tsx", import.meta.url),
        "utf8",
      );
      const oocPattern = locale["ui.agents.regexscripteditor.ooc"];

      assert.equal(oocPattern, String.raw`\(OOC:.*?\)`);
      assert.equal(applyRegexReplacement("(OOC: Hey.)", new RegExp(oocPattern!, "gi"), ""), "");
      assert.ok(editorSource.includes(String.raw`{"\\(OOC:.*?\\)"}`));
      assert.ok(!editorSource.includes(String.raw`{"\\\\(OOC:.*?\\\\)"}`));
    },
  },
  {
    name: "regex schema rejects invalid flags and impossible depth ranges",
    run() {
      const base = {
        name: "Fixture",
        findRegex: "foo",
        placement: ["ai_output"],
      };

      assert.equal(createRegexScriptSchema.safeParse({ ...base, flags: "gi" }).success, true);
      assert.equal(createRegexScriptSchema.safeParse({ ...base, applyMode: "both" }).success, true);
      assert.equal(createRegexScriptSchema.safeParse({ ...base, flags: "gg" }).success, false);
      assert.equal(createRegexScriptSchema.safeParse({ ...base, minDepth: 5, maxDepth: 2 }).success, false);
    },
  },
  {
    name: "group regexes preserve attachments when they remove all message text",
    run() {
      const images = ["data:image/png;base64,fixture"];
      const files = [{ type: "application/pdf", data: "fixture", filename: "note.pdf" }];
      const scoped = scopeIndividualGroupMessagesForTarget(
        [
          { role: "user", content: "*thought*", contextKind: "history", images },
          { role: "user", content: "*thought*", contextKind: "history", files },
          { role: "user", content: "*thought*", contextKind: "history" },
        ],
        "maukie",
        [{ id: "maukie", name: "Maukie" }],
        (history) =>
          history.forEach((message) => {
            message.content = "";
          }),
      );
      assert.equal(scoped.length, 2);
      assert.deepEqual(scoped[0]?.images, images);
      assert.deepEqual(scoped[1]?.files, files);
    },
  },
];

await runNamedCases(cases);

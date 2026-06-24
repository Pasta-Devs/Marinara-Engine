import assert from "node:assert/strict";
import {
  compileChatSummaryEntries,
  normalizeChatSummaryEntries,
  resolveMacros,
  testPrimaryKeys,
  testSecondaryKeys,
} from "../../packages/shared/src/index.js";
import {
  appendNonLeadingSystemMessagesToLastUser,
  shouldEnableAgentsForGeneration,
  shouldInjectIdentityFallback,
  type SimpleMessage,
} from "../../packages/server/src/routes/generate/generate-route-utils.js";

type RegressionCase = {
  name: string;
  run: () => void;
};

const keywordOptions = {
  useRegex: false,
  matchWholeWords: false,
  caseSensitive: false,
};

const cases: RegressionCase[] = [
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
    name: "lorebook keyword matching handles unicode and secondary blockers",
    run() {
      assert.deepEqual(testPrimaryKeys(["чай"], "Она пьет чай.", keywordOptions), {
        matched: true,
        matchedKeys: ["чай"],
      });
      assert.deepEqual(testPrimaryKeys(["龍"], "The dragon is not named here.", keywordOptions), {
        matched: false,
        matchedKeys: [],
      });
      assert.equal(testSecondaryKeys(["forbidden"], "This has the forbidden key.", "not", keywordOptions), false);
      assert.equal(testSecondaryKeys(["forbidden"], "This is safe.", "not", keywordOptions), true);
    },
  },
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
    name: "chat summaries normalize legacy data and compile enabled entries only",
    run() {
      const legacyEntries = normalizeChatSummaryEntries([], {
        legacySummary: "The previous scene was summarized.",
        now: "2026-06-24T00:00:00.000Z",
      });

      assert.equal(legacyEntries.length, 1);
      assert.equal(legacyEntries[0]?.enabled, true);
      assert.equal(legacyEntries[0]?.origin, "legacy");

      const compiled = compileChatSummaryEntries([
        legacyEntries[0]!,
        {
          ...legacyEntries[0]!,
          id: "disabled-summary",
          content: "This disabled summary should not be sent.",
          enabled: false,
        },
      ]);

      assert.equal(compiled, "The previous scene was summarized.");
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
          chatMode: "roleplay",
          impersonate: false,
          impersonateBlockAgents: false,
        }),
        true,
      );
      assert.equal(
        shouldEnableAgentsForGeneration({
          chatEnableAgents: true,
          chatMode: "conversation",
          impersonate: false,
          impersonateBlockAgents: false,
        }),
        false,
      );
    },
  },
];

let failed = 0;

for (const regression of cases) {
  try {
    regression.run();
    console.log(`ok - ${regression.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${regression.name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}

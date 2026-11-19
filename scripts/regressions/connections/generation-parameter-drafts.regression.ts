// Generation parameters typed into a connection: custom parameter JSON drafts, number drafts (comma decimals too),
// and reusable numeric provider parameters, which survive storage, follow chat overrides and drop stale values.
// Also the default reasoning effort.
import assert from "node:assert/strict";
import { parseCustomParametersDraft } from "../../../packages/client/src/lib/generation-custom-parameters.js";
import { parseGenerationParameterDraft } from "../../../packages/client/src/lib/generation-parameter-draft.js";
import {
  isReservedManagedGenerationParameterKey,
  parseManagedGenerationParameterDefinitions,
  resolveManagedGenerationParameters,
} from "../../../packages/shared/src/utils/managed-generation-parameters.js";
import { DEFAULT_GENERATION_PARAMS } from "../../../packages/shared/src/constants/defaults.js";

assert.deepEqual(parseCustomParametersDraft('{ "reasoning_effort": high, "awesomesauce": enabled }'), {
  ok: true,
  value: { reasoning_effort: "high", awesomesauce: "enabled" },
});
assert.deepEqual(parseCustomParametersDraft('{ "enabled": True, "empty": None, "label": "True story" }'), {
  ok: true,
  value: { enabled: true, empty: null, label: "True story" },
});
assert.deepEqual(
  parseCustomParametersDraft(
    '{ "string": "potatoes!", "count": 3, "enabled": true, "empty": null, "list": ["a", 2], "nested": { "mode": "deep" } }',
  ),
  {
    ok: true,
    value: {
      string: "potatoes!",
      count: 3,
      enabled: true,
      empty: null,
      list: ["a", 2],
      nested: { mode: "deep" },
    },
  },
);
assert.equal(parseCustomParametersDraft("[1, 2]").ok, false);
assert.equal(parseCustomParametersDraft('{ "broken": [1, }').ok, false);
assert.equal(parseGenerationParameterDraft("0.85"), 0.85);
assert.equal(parseGenerationParameterDraft("0,85"), 0.85);
assert.equal(parseGenerationParameterDraft("0.85 trailing"), null);
assert.equal(parseGenerationParameterDraft("0,8,5"), null);
// Issue #4107 — reusable numeric provider parameters must survive storage,
// accept comma decimals, honor chat overrides, and drop stale values once the
// authoritative definition disappears.
{
  assert.equal(parseGenerationParameterDraft("0,075"), 0.075);
  assert.equal(parseGenerationParameterDraft("0.075"), 0.075);
  assert.equal(isReservedManagedGenerationParameterKey("temperature"), true);
  assert.equal(isReservedManagedGenerationParameterKey("min_p"), false);
  assert.equal(isReservedManagedGenerationParameterKey("__proto__"), true);
  assert.equal(isReservedManagedGenerationParameterKey("constructor"), true);
  assert.equal(isReservedManagedGenerationParameterKey("prototype"), true);

  const definitions = parseManagedGenerationParameterDefinitions([
    {
      id: "min-p",
      name: "Min P",
      requestKey: "min_p",
      min: 0,
      max: 1,
      tooltip: "Dynamic probability truncation.",
    },
    {
      id: "duplicate",
      name: "Duplicate",
      requestKey: "MIN_P",
      min: 0,
      max: 1,
    },
    {
      id: "reserved",
      name: "Temperature Again",
      requestKey: "temperature",
      min: 0,
      max: 2,
    },
    {
      id: "bad-range",
      name: "Bad range",
      requestKey: "bad_range",
      min: 2,
      max: 1,
    },
  ]);
  assert.deepEqual(
    definitions.map((definition) => definition.id),
    ["min-p"],
    "Invalid, duplicate, and built-in request keys must not become managed controls",
  );
  assert.deepEqual(
    resolveManagedGenerationParameters(
      definitions,
      { "min-p": { enabled: true, value: 0.2 } },
      { "min-p": { enabled: true, value: 1.5 } },
    ),
    { min_p: 1 },
    "Chat values must override connection defaults and clamp to the saved range",
  );
  assert.deepEqual(
    resolveManagedGenerationParameters(
      definitions,
      { "min-p": { enabled: true, value: 0.2 } },
      { "min-p": { enabled: false, value: 0.8 } },
    ),
    {},
    "A chat-level disabled toggle must omit an enabled connection default",
  );
  assert.deepEqual(
    resolveManagedGenerationParameters([], { "min-p": { enabled: true, value: 0.2 } }),
    {},
    "Deleting a definition must prevent its hidden stored value from being sent",
  );
  assert.equal(
    parseManagedGenerationParameterDefinitions(
      Array.from({ length: 101 }, (_, index) => ({
        id: `parameter-${index}`,
        name: `Parameter ${index}`,
        requestKey: `parameter_${index}`,
        min: 0,
        max: 1,
      })),
    ).length,
    100,
    "Managed parameter parsing must enforce the declared definition ceiling",
  );
}

assert.equal(DEFAULT_GENERATION_PARAMS.reasoningEffort, "maximum");

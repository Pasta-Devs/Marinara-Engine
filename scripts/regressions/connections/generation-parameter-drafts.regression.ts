// Generation parameters typed into a connection: custom parameter JSON drafts, number drafts (comma decimals too),
// and reusable numeric provider parameters, which survive storage, follow chat overrides and drop stale values.
// Also the default reasoning effort, and the one Min P control a custom min_p parameter shares with the built-in field.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseCustomParametersDraft } from "../../../packages/client/src/lib/generation-custom-parameters.js";
import { parseGenerationParameterDraft } from "../../../packages/client/src/lib/generation-parameter-draft.js";
import {
  isReservedManagedGenerationParameterKey,
  parseManagedGenerationParameterDefinitions,
  resolveManagedGenerationParameters,
} from "../../../packages/shared/src/utils/managed-generation-parameters.js";
import { DEFAULT_GENERATION_PARAMS } from "../../../packages/shared/src/constants/defaults.js";
import { relevantGenerationParameters } from "../../../packages/shared/src/constants/generation-parameter-relevance.js";

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

// Issue #9816: a custom min_p parameter and the built-in Min P field fill one request field, so Advanced Parameters
// shows one Min P control, and it shows the value that is sent.
{
  // The built-in field shows only where it is sent: the built-in model and OpenAI-compatible custom servers.
  const minPShown = (provider: string, model: string) =>
    relevantGenerationParameters({ provider, model, reasoningEffort: null }).has("minP");
  assert.equal(minPShown("custom", "llama-3.3-70b"), true);
  assert.equal(minPShown("local_sidecar", "gemma-3-12b"), true);
  for (const [provider, model] of [
    ["anthropic", "claude-sonnet-4-5"],
    ["google", "gemini-2.5-flash"],
    ["google_vertex", "gemini-2.5-flash"],
  ]) {
    assert.equal(minPShown(provider!, model!), false, `${provider} sends Top K but never Min P`);
  }

  const clientRequire = createRequire(new URL("../../../packages/client/package.json", import.meta.url));
  const React = clientRequire("react");
  // The Node regression host compiles JSX in classic mode; the client uses the automatic runtime.
  Object.assign(globalThis, { React });
  const { renderToStaticMarkup } = clientRequire("react-dom/server");
  const { I18nextProvider } = await import("../../../packages/client/node_modules/react-i18next/dist/es/index.js");
  const { QueryClient, QueryClientProvider } =
    await import("../../../packages/client/node_modules/@tanstack/react-query/build/modern/index.js");
  const i18n = clientRequire("i18next").createInstance();
  await i18n.init({
    lng: "en",
    keySeparator: false,
    nsSeparator: false,
    resources: {
      en: {
        translation: JSON.parse(
          readFileSync(new URL("../../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
        ),
      },
    },
  });
  const { CHAT_PARAMETER_DEFAULTS, GenerationParametersFields, foldCustomMinP, getEditableGenerationParameters } =
    await import("../../../packages/client/src/components/ui/GenerationParametersEditor.js");
  const { customGenerationParameterKeys } =
    await import("../../../packages/client/src/hooks/use-custom-generation-parameters.js");

  const minP = { id: "min-p", name: "Min P", requestKey: "min_p", min: 0, max: 1 };
  const sending = {
    ...getEditableGenerationParameters(CHAT_PARAMETER_DEFAULTS, null),
    minP: 0.05,
    managedCustomParameters: { "min-p": { enabled: true, value: 0.35 } },
  };
  const minPControls = (props: Record<string, unknown>, definitions: unknown[] = [minP]) => {
    const client = new QueryClient();
    client.setQueryData(customGenerationParameterKeys.all, definitions);
    const html: string = renderToStaticMarkup(
      React.createElement(
        I18nextProvider,
        { i18n },
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(GenerationParametersFields, { value: sending, onChange: () => {}, ...props }),
        ),
      ),
    );
    return {
      values: [...html.matchAll(/<input[^>]*aria-label="Min P"[^>]*>/gu)].map(
        ([input]) => /value="([^"]*)"/u.exec(input)?.[1],
      ),
      sendSwitch: html.includes('aria-label="Send Min P parameter"'),
    };
  };

  // Where the built-in field shows for a Model, it is the control, and it holds the custom value the request carried.
  for (const [provider, model] of [
    ["custom", "llama-3.3-70b"],
    ["local_sidecar", "gemma-3-12b"],
  ]) {
    assert.deepEqual(minPControls({ provider, model }), { values: ["0.35"], sendSwitch: false }, provider);
  }
  // Where it is hidden, or no Model is picked, the custom parameter is the control and keeps its Send switch.
  for (const [provider, model] of [
    ["openrouter", "meta-llama/llama-3.3-70b-instruct"],
    ["anthropic", "claude-sonnet-4-5"],
    [null, null],
  ]) {
    assert.deepEqual(minPControls({ provider, model }), { values: ["0.35"], sendSwitch: true }, String(provider));
  }
  // A preset's custom values are never sent, so its editor shows the preset's own Min P.
  assert.deepEqual(minPControls({}), { values: ["0.05"], sendSwitch: false }, "preset editor");
  // Without a custom min_p nothing changes: the built-in field shows wherever it did.
  assert.deepEqual(minPControls({ provider: null }, []), { values: ["0.05"], sendSwitch: false });

  // The first change saves the move: the field takes the value, and the custom parameter is turned off.
  const folded = foldCustomMinP(sending, minP);
  assert.equal(folded.minP, 0.35);
  assert.deepEqual(folded.managedCustomParameters, { "min-p": { enabled: false, value: 0.35 } });
  assert.deepEqual(resolveManagedGenerationParameters([minP], folded.managedCustomParameters), {});
  const off = { ...sending, managedCustomParameters: { "min-p": { enabled: false, value: 0.35 } } };
  assert.equal(foldCustomMinP(off, minP), off, "a custom min_p that is off sent nothing, so the field keeps its value");
  // The value moves as the request sent it: clamped to the parameter's range, then to Min P's.
  const wide = { ...minP, min: 0.1, max: 2 };
  const clamped = (value: number) =>
    foldCustomMinP({ ...sending, managedCustomParameters: { "min-p": { enabled: true, value } } }, wide).minP;
  assert.equal(clamped(0.05), 0.1);
  assert.equal(clamped(1.5), 1);
}

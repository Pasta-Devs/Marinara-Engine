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
  // The Node regression host compiles JSX in classic mode (the client uses the automatic runtime), so the fields
  // create their elements through this React. It keeps each ParamInput's props, to make the edits a person makes.
  let paramInputs = new Map<string, { onChange: (next: number) => void; onSendChange?: (enabled: boolean) => void }>();
  Object.assign(globalThis, {
    React: {
      ...React,
      createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => {
        if (typeof type === "function" && type.name === "ParamInput" && props) {
          paramInputs.set(String(props.label), props as never);
        }
        return React.createElement(type, props, ...children);
      },
    },
  });
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
  const {
    CHAT_PARAMETER_DEFAULTS,
    GenerationParametersFields,
    getEditableGenerationParameters,
    managedParameterOverrides,
  } = await import("../../../packages/client/src/components/ui/GenerationParametersEditor.js");
  const { customGenerationParameterKeys } =
    await import("../../../packages/client/src/hooks/use-custom-generation-parameters.js");

  const minP = { id: "min-p", name: "Min P", requestKey: "min_p", min: 0, max: 1 };
  const base = getEditableGenerationParameters(CHAT_PARAMETER_DEFAULTS, null);
  const withCustom = (enabled: boolean, value: number) => ({
    ...base,
    minP: 0.05,
    managedCustomParameters: { "min-p": { enabled, value } },
  });
  const sending = withCustom(true, 0.35);
  const fields = (props: Record<string, unknown>, value: unknown = sending, definitions: unknown[] = [minP]) => {
    const client = new QueryClient();
    client.setQueryData(customGenerationParameterKeys.all, definitions);
    let changed: unknown;
    paramInputs = new Map();
    const html: string = renderToStaticMarkup(
      React.createElement(
        I18nextProvider,
        { i18n },
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(GenerationParametersFields, {
            value,
            onChange: (next: unknown) => (changed = next),
            ...props,
          }),
        ),
      ),
    );
    const inputs = paramInputs;
    return {
      values: [...html.matchAll(/<input[^>]*aria-label="Min P"[^>]*>/gu)].map(
        ([input]) => /value="([^"]*)"/u.exec(input)?.[1],
      ),
      sendSwitch: html.includes('aria-label="Send Min P parameter"'),
      edit(label: string, next: number) {
        inputs.get(label)!.onChange(next);
        return changed as typeof sending;
      },
      send(label: string, enabled: boolean) {
        inputs.get(label)!.onSendChange!(enabled);
        return changed as typeof sending;
      },
    };
  };
  const minPControls = (props: Record<string, unknown>, value?: unknown, definitions?: unknown[]) => {
    const { values, sendSwitch } = fields(props, value, definitions);
    return { values, sendSwitch };
  };

  for (const [provider, model] of [
    ["custom", "llama-3.3-70b"],
    ["local_sidecar", "gemma-3-12b"],
  ]) {
    const props = { provider, model };
    // Where the built-in field shows for a Model, it is the one control. While the custom min_p is on, the request
    // sends it, so the field shows and edits it, with its Send switch.
    assert.deepEqual(minPControls(props), { values: ["0.35"], sendSwitch: true }, provider);
    assert.deepEqual(fields(props).edit("Min P", 0.1), {
      ...sending,
      managedCustomParameters: { "min-p": { enabled: true, value: 0.1 } },
    });
    // Any other edit saves the stored values as they were, so the request changes only by that edit.
    assert.deepEqual(fields(props).edit("Temperature", 0.7), { ...sending, temperature: 0.7 });
    // An enabled 0 is sent as min_p: 0, so it stays the control rather than a built-in 0, which sends nothing.
    assert.deepEqual(minPControls(props, withCustom(true, 0)), { values: ["0"], sendSwitch: true });
    // Turned off, the custom min_p sends nothing, and the field edits the built-in Min P.
    assert.deepEqual(fields(props).send("Min P", false), withCustom(false, 0.35));
    const off = withCustom(false, 0.35);
    assert.deepEqual(minPControls(props, off), { values: ["0.05"], sendSwitch: false });
    assert.deepEqual(fields(props, off).edit("Min P", 0.1), { ...off, minP: 0.1 });
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
  assert.deepEqual(minPControls({ provider: null }, sending, []), { values: ["0.05"], sendSwitch: false });
  // Only the exact key replaces the built-in min_p in the request; MIN_P is sent beside it, so both controls stay.
  const upperCase = { ...minP, requestKey: "MIN_P" };
  assert.deepEqual(minPControls({ provider: "custom", model: "llama-3.3-70b" }, sending, [upperCase]), {
    values: ["0.05", "0.35"],
    sendSwitch: true,
  });

  // A chat's own custom values add to the connection's per parameter, as the request merges them, so the field shows
  // the connection's min_p even when the chat holds a value for another parameter.
  const repetition = { id: "rep", name: "Repetition penalty", requestKey: "repetition_penalty", min: 0, max: 2 };
  const connection = { managedCustomParameters: { "min-p": { enabled: true, value: 0.35 } } };
  const chat = { managedCustomParameters: { rep: { enabled: true, value: 1.2 } } };
  const inherited = getEditableGenerationParameters(CHAT_PARAMETER_DEFAULTS, connection);
  const inChat = getEditableGenerationParameters(inherited, chat);
  assert.deepEqual(inChat.managedCustomParameters, {
    ...connection.managedCustomParameters,
    ...chat.managedCustomParameters,
  });
  assert.deepEqual(
    resolveManagedGenerationParameters(
      [minP, repetition],
      connection.managedCustomParameters,
      chat.managedCustomParameters,
    ),
    { min_p: 0.35, repetition_penalty: 1.2 },
  );
  const custom = { provider: "custom", model: "llama-3.3-70b" };
  assert.deepEqual(minPControls(custom, inChat, [minP, repetition]).values, ["0.35"]);

  // Chat Settings saves only the chat's own custom values: an unrelated edit pins nothing the chat inherits, so a
  // later change to the connection's min_p still reaches the chat.
  const temperatureOnly = fields(custom, inherited).edit("Temperature", 0.7);
  assert.equal(temperatureOnly.minP, inherited.minP);
  assert.deepEqual(
    managedParameterOverrides(undefined, inherited.managedCustomParameters, temperatureOnly.managedCustomParameters),
    {},
  );
  const typed = fields(custom, inChat, [minP, repetition]).edit("Min P", 0.1);
  assert.deepEqual(
    managedParameterOverrides(
      chat.managedCustomParameters,
      inherited.managedCustomParameters,
      typed.managedCustomParameters,
    ),
    { "min-p": { enabled: true, value: 0.1 }, rep: { enabled: true, value: 1.2 } },
  );
  // A value the chat set for itself stays its own, even where it now matches the connection's.
  assert.deepEqual(
    managedParameterOverrides(
      connection.managedCustomParameters,
      inherited.managedCustomParameters,
      inherited.managedCustomParameters,
    ),
    connection.managedCustomParameters,
  );
}

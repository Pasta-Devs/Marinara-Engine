// Personal extension traffic in the app: extension fetches go through the traffic meter, and Settings shows the
// summary. Reads component source; replacing these needs browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const personalExtensionInjectorSource = readFileSync(
  new URL("../../../packages/client/src/components/layout/PersonalExtensionInjector.tsx", import.meta.url),
  "utf8",
);
assert.match(personalExtensionInjectorSource, /fetch: \(input, init\) => fetchForPersonalExtension/u);
const personalExtensionSettingsSource = readFileSync(
  new URL("../../../packages/client/src/components/panels/settings/PersonalExtensionsSettings.tsx", import.meta.url),
  "utf8",
);
assert.match(personalExtensionSettingsSource, /settings\.personalExtensions\.traffic\.summary/u);

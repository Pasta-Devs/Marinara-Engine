// A capability package's name, description and Home browser tab in the user's language: a matching localization is
// used, regional codes like pt-BR match, and any other language gets the canonical text.
import assert from "node:assert/strict";
import { resolveCapabilityPackageDisplay } from "../../../packages/client/src/lib/capability-package-localization.js";
import { type CapabilityPackageManifest } from "../../../packages/shared/src/index.js";

const localizedPackageManifest = {
  name: "Noodle",
  description: "Canonical description",
  contributions: { homeBrowserTab: { label: "Noodle", ariaLabel: "Open Noodle" } },
  localizations: {
    pl: {
      name: "Kluska",
      description: "Polski opis",
      homeBrowserTab: { label: "Kluska", ariaLabel: "Otwórz Kluskę" },
    },
  },
} as CapabilityPackageManifest;
assert.deepEqual(resolveCapabilityPackageDisplay(localizedPackageManifest, "pl-PL"), {
  name: "Kluska",
  description: "Polski opis",
  homeBrowserTab: { label: "Kluska", ariaLabel: "Otwórz Kluskę" },
});
assert.deepEqual(resolveCapabilityPackageDisplay(localizedPackageManifest, "de-DE"), {
  name: "Noodle",
  description: "Canonical description",
  homeBrowserTab: { label: "Noodle", ariaLabel: "Open Noodle" },
});
const regionalLocalizedPackageManifest = {
  ...localizedPackageManifest,
  localizations: {
    pt_BR: {
      name: "Macarrão",
      description: "Descrição em português",
      homeBrowserTab: { label: "Macarrão", ariaLabel: "Abrir Macarrão" },
    },
  },
} as CapabilityPackageManifest;
assert.equal(resolveCapabilityPackageDisplay(regionalLocalizedPackageManifest, "pt-BR").name, "Macarrão");

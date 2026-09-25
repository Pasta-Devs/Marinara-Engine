import type { TFunction } from "i18next";
import { toast } from "sonner";
import { containsDecisionStatements, type DecisionModelOptions } from "@marinara-engine/shared";
import { api } from "./api-client";
import { useUIStore } from "../stores/ui.store";

/** Read the selection after import, so loading editor queries cannot imply None. */
export async function notifyDecisionImport(usesDecisions: boolean, t: TFunction) {
  if (!usesDecisions) return;
  // A failed settings lookup must not turn a successful import into a failure.
  const options = await api.get<DecisionModelOptions>("/decision/options").catch(() => null);
  const missingModel = options !== null && !options.selected;
  const notify = missingModel ? toast.warning : toast.info;
  const messageKey =
    options === null
      ? "ui.lib.decisionimportnotice.modelUnknown"
      : missingModel
        ? "ui.lib.decisionimportnotice.noModel"
        : "ui.lib.decisionimportnotice.usesDecisions";
  notify(t(messageKey), {
    duration: 20_000,
    classNames: {
      toast: "!grid !grid-cols-[auto_1fr]",
      icon: "!self-start !mt-0.5",
      actionButton: "!col-start-2 !ml-0 !justify-self-start !min-h-9",
    },
    action: {
      label: t("ui.lib.decisionimportnotice.openGuide"),
      onClick: () => useUIStore.getState().openModal("docs-viewer", { initialDoc: "connections/decision-models.md" }),
    },
  });
}

/**
 * Imported cards, presets, lorebooks, personas and agents can carry decisions
 * (`{{#if decision:"..."}}`). Those need a Decision model, and on a hosted connection
 * each one is part of a billed request, so the importer is told once per batch rather
 * than finding out from a prompt that never changes.
 */
export function createDecisionImportTracker() {
  const files = new Set<string>();
  return {
    /** Record a parsed file that uses decision statements. */
    note(fileName: string, parsed: unknown) {
      if (containsDecisionStatements(parsed)) files.add(fileName);
    },
    /** Record a file the server parsed (PNG, .charx, .marinara) and flagged. */
    mark(fileName: string, usesDecisions: boolean | undefined) {
      if (usesDecisions) files.add(fileName);
    },
    /** One notice if any file that imported successfully uses them. */
    notify(results: ReadonlyArray<{ filename: string; success: boolean }>, t: TFunction) {
      return notifyDecisionImport(
        results.some((result) => result.success && files.has(result.filename)),
        t,
      );
    },
  };
}

import type { TFunction } from "i18next";
import { toast } from "sonner";
import { containsDecisionStatements } from "@marinara-engine/shared";

/**
 * Imported cards, presets, lorebooks and personas can carry decision statements
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
      if (results.some((result) => result.success && files.has(result.filename)))
        toast.info(t("ui.lib.decisionimportnotice.usesDecisions"), { duration: 10_000 });
    },
  };
}

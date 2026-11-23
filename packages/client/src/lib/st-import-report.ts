// What a SillyTavern import brought along beyond the counts, and what it could not, as short lines for the
// import's toast or result step. The server sends codes; the words live in the locale files.

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** One note from POST /import/st-chat (STChatImportNote on the server). */
export type STChatImportNote =
  | { kind: "authorsNote" }
  | { kind: "authorsNoteOff" }
  | { kind: "authorsNotePlacement" }
  | { kind: "persona"; name: string }
  | { kind: "personaMissing"; name: string };

/** A preset setting with no place in a Marinara preset (STPresetLeftOut on the server). */
export type STPresetLeftOut = "maxTokens" | "maxContext" | "topA" | "repetitionPenalty" | "outOfRange";

/** The folder import's summary (STBulkImportReport on the server). */
export interface STBulkImportReport {
  authorsNotes: number;
  authorsNotesPlacement: number;
  authorsNotesOff: number;
  personasLinked: number;
  missingPersonas: string[];
  presetsWithSettings: number;
  presetSettingsLeftOut: STPresetLeftOut[];
}

const PARAMETER_LABEL_KEYS: Record<string, string> = {
  temperature: "ui.import.streport.param.temperature",
  topP: "ui.import.streport.param.topP",
  topK: "ui.import.streport.param.topK",
  minP: "ui.import.streport.param.minP",
  frequencyPenalty: "ui.import.streport.param.frequencyPenalty",
  presencePenalty: "ui.import.streport.param.presencePenalty",
  reasoningEffort: "ui.import.streport.param.reasoningEffort",
};

export function describeChatImportNotes(notes: STChatImportNote[] | undefined, t: Translate): string[] {
  const lines: string[] = [];
  for (const note of notes ?? []) {
    if (note.kind === "authorsNote") lines.push(t("ui.import.streport.authorsNote"));
    else if (note.kind === "authorsNotePlacement") lines.push(t("ui.import.streport.authorsNotePlacement"));
    else if (note.kind === "authorsNoteOff") lines.push(t("ui.import.streport.authorsNoteOff"));
    else if (note.kind === "persona") lines.push(t("ui.import.streport.persona", { name: note.name }));
    else if (note.kind === "personaMissing") lines.push(t("ui.import.streport.personaMissing", { name: note.name }));
  }
  return lines;
}

function describeLeftOut(leftOut: STPresetLeftOut[] | undefined, t: Translate): string[] {
  const set = new Set(leftOut ?? []);
  const lines: string[] = [];
  if (set.has("maxTokens") || set.has("maxContext")) lines.push(t("ui.import.streport.sizesOnConnection"));
  const unsupported = [
    ...(set.has("topA") ? [t("ui.import.streport.param.topA")] : []),
    ...(set.has("repetitionPenalty") ? [t("ui.import.streport.param.repetitionPenalty")] : []),
  ];
  if (unsupported.length > 0) lines.push(t("ui.import.streport.unsupported", { names: unsupported.join(", ") }));
  if (set.has("outOfRange")) lines.push(t("ui.import.streport.outOfRange"));
  return lines;
}

export function describePresetImport(
  result: { parametersImported?: string[]; parametersLeftOut?: STPresetLeftOut[] },
  t: Translate,
): string[] {
  const imported = (result.parametersImported ?? []).map((key) => t(PARAMETER_LABEL_KEYS[key] ?? key));
  return [
    ...(imported.length > 0 ? [t("ui.import.streport.settingsImported", { names: imported.join(", ") })] : []),
    ...describeLeftOut(result.parametersLeftOut, t),
  ];
}

export function describeBulkImportReport(report: STBulkImportReport | undefined, t: Translate): string[] {
  if (!report) return [];
  const lines: string[] = [];
  const notes = report.authorsNotes + report.authorsNotesPlacement;
  if (notes > 0) lines.push(t("ui.import.streport.bulkAuthorsNotes", { count: notes }));
  if (report.authorsNotesPlacement > 0) {
    lines.push(t("ui.import.streport.bulkAuthorsNotesPlacement", { count: report.authorsNotesPlacement }));
  }
  if (report.authorsNotesOff > 0)
    lines.push(t("ui.import.streport.bulkAuthorsNotesOff", { count: report.authorsNotesOff }));
  if (report.personasLinked > 0) lines.push(t("ui.import.streport.bulkPersonas", { count: report.personasLinked }));
  if (report.missingPersonas.length > 0) {
    lines.push(t("ui.import.streport.bulkPersonasMissing", { names: report.missingPersonas.join(", ") }));
  }
  if (report.presetsWithSettings > 0) {
    lines.push(t("ui.import.streport.bulkPresetSettings", { count: report.presetsWithSettings }));
  }
  lines.push(...describeLeftOut(report.presetSettingsLeftOut, t));
  return lines;
}

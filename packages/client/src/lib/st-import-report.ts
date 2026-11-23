// What a SillyTavern import brought along beyond the counts, and what it could not, as short lines for the
// import's toast or result step. The server sends codes; the words live in the locale files.

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** One note from POST /import/st-chat (STChatImportNote on the server). */
export type STChatImportNote =
  | { kind: "authorsNote" }
  | { kind: "authorsNoteOff" }
  | { kind: "authorsNotePlacement" }
  | { kind: "persona"; name: string }
  | { kind: "personaMissing"; name: string }
  | { kind: "hiddenMessages"; count: number }
  | { kind: "groupIndividual" };

/** A preset setting with no place in a Marinara preset (STPresetLeftOut on the server). */
export type STPresetLeftOut =
  | "maxTokens"
  | "maxContext"
  | "topA"
  | "repetitionPenalty"
  | "outOfRange"
  | "impersonationPrompt"
  | "continueNudge"
  | "newChatPrompts"
  | "namesBehavior"
  | "formatTemplates"
  | "postHistoryRole";

/** Where an imported preset sends World Info (STPresetWorldInfo on the server). */
export type STPresetWorldInfo = "split" | "combined" | "beforeOff" | "afterOff" | "off";

const WORLD_INFO_KINDS: STPresetWorldInfo[] = ["split", "combined", "beforeOff", "afterOff", "off"];

/** A lorebook entry moved to the closest place (LorebookImportNote on the server). */
export type LorebookImportNote = { kind: "positionMoved"; from: "authorsNote" | "exampleMessages"; count: number };

/** What the folder holds with no matching feature here. */
export interface STNotBroughtOver {
  quickReplies: number;
  instruct: number;
  context: number;
  systemPrompts: number;
}

/** The folder import's summary (STBulkImportReport on the server). */
export interface STBulkImportReport {
  authorsNotes: number;
  authorsNotesPlacement: number;
  authorsNotesOff: number;
  personasLinked: number;
  missingPersonas: string[];
  hiddenMessages?: number;
  groupChatsIndividual?: number;
  lorebookEntriesMovedFromAuthorsNote?: number;
  lorebookEntriesMovedFromExamples?: number;
  regexSkipped?: number;
  samplersOnlyPresets?: number;
  notBroughtOver?: STNotBroughtOver;
  presetsWithSettings: number;
  presetSettingsLeftOut: STPresetLeftOut[];
  presetWorldInfo?: Partial<Record<STPresetWorldInfo, number>>;
  personasAlreadyHere?: string[];
}

const PARAMETER_LABEL_KEYS: Record<string, string> = {
  temperature: "ui.import.streport.param.temperature",
  topP: "ui.import.streport.param.topP",
  topK: "ui.import.streport.param.topK",
  minP: "ui.import.streport.param.minP",
  frequencyPenalty: "ui.import.streport.param.frequencyPenalty",
  presencePenalty: "ui.import.streport.param.presencePenalty",
  reasoningEffort: "ui.import.streport.param.reasoningEffort",
  assistantPrefill: "ui.ui.generationparametersfields.assistantPrefill",
  squashSystemMessages: "ui.import.streport.param.squashSystemMessages",
};

const LEFT_OUT_LABEL_KEYS: Array<[STPresetLeftOut, string]> = [
  ["impersonationPrompt", "ui.import.streport.leftOut.impersonationPrompt"],
  ["continueNudge", "ui.import.streport.leftOut.continueNudge"],
  ["newChatPrompts", "ui.import.streport.leftOut.newChatPrompts"],
  ["namesBehavior", "ui.import.streport.leftOut.namesBehavior"],
  ["formatTemplates", "ui.import.streport.leftOut.formatTemplates"],
];

export function describeChatImportNotes(notes: STChatImportNote[] | undefined, t: Translate): string[] {
  const lines: string[] = [];
  for (const note of notes ?? []) {
    if (note.kind === "authorsNote") lines.push(t("ui.import.streport.authorsNote"));
    else if (note.kind === "authorsNotePlacement") lines.push(t("ui.import.streport.authorsNotePlacement"));
    else if (note.kind === "authorsNoteOff") lines.push(t("ui.import.streport.authorsNoteOff"));
    else if (note.kind === "persona") lines.push(t("ui.import.streport.persona", { name: note.name }));
    else if (note.kind === "personaMissing") lines.push(t("ui.import.streport.personaMissing", { name: note.name }));
    else if (note.kind === "hiddenMessages") lines.push(t("ui.import.streport.hiddenMessages", { count: note.count }));
    else if (note.kind === "groupIndividual") lines.push(t("ui.import.streport.groupIndividual"));
  }
  return lines;
}

/** The lorebook import's lines: entries in, and any moved to the closest place. */
export function describeLorebookImport(
  result: { entriesImported?: number; notes?: LorebookImportNote[] },
  t: Translate,
): string[] {
  return [
    ...(typeof result.entriesImported === "number"
      ? [t("ui.import.streport.lorebookEntries", { count: result.entriesImported })]
      : []),
    ...describeLorebookNotes(
      (result.notes ?? []).filter((note) => note.from === "authorsNote").reduce((sum, note) => sum + note.count, 0),
      (result.notes ?? []).filter((note) => note.from === "exampleMessages").reduce((sum, note) => sum + note.count, 0),
      t,
    ),
  ];
}

function describeLorebookNotes(authorsNote: number, examples: number, t: Translate): string[] {
  return [
    ...(authorsNote > 0 ? [t("ui.import.streport.lorebookAuthorsNote", { count: authorsNote })] : []),
    ...(examples > 0 ? [t("ui.import.streport.lorebookExamples", { count: examples })] : []),
  ];
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
  if (set.has("postHistoryRole")) lines.push(t("ui.import.streport.postHistoryRole"));
  const noMatch = LEFT_OUT_LABEL_KEYS.filter(([code]) => set.has(code)).map(([, key]) => t(key));
  if (noMatch.length > 0) lines.push(t("ui.import.streport.noMatchingSetting", { names: noMatch.join(", ") }));
  return lines;
}

export function describePresetImport(
  result: {
    parametersImported?: string[];
    parametersLeftOut?: STPresetLeftOut[];
    regexSkipped?: number;
    worldInfo?: STPresetWorldInfo;
  },
  t: Translate,
): string[] {
  const imported = (result.parametersImported ?? []).map((key) => t(PARAMETER_LABEL_KEYS[key] ?? key));
  return [
    ...(result.worldInfo ? [t(`ui.import.streport.worldInfo.${result.worldInfo}`)] : []),
    ...(imported.length > 0 ? [t("ui.import.streport.settingsImported", { names: imported.join(", ") })] : []),
    ...describeLeftOut(result.parametersLeftOut, t),
    ...((result.regexSkipped ?? 0) > 0 ? [t("ui.import.streport.regexSkipped", { count: result.regexSkipped })] : []),
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
  if ((report.personasAlreadyHere?.length ?? 0) > 0) {
    lines.push(
      t("ui.import.streport.bulkPersonasAlreadyHere", {
        count: report.personasAlreadyHere!.length,
        names: report.personasAlreadyHere!.join(", "),
      }),
    );
  }
  if (report.missingPersonas.length > 0) {
    lines.push(t("ui.import.streport.bulkPersonasMissing", { names: report.missingPersonas.join(", ") }));
  }
  if ((report.hiddenMessages ?? 0) > 0) {
    lines.push(t("ui.import.streport.hiddenMessages", { count: report.hiddenMessages }));
  }
  if ((report.groupChatsIndividual ?? 0) > 0) lines.push(t("ui.import.streport.groupIndividual"));
  if (report.presetsWithSettings > 0) {
    lines.push(t("ui.import.streport.bulkPresetSettings", { count: report.presetsWithSettings }));
  }
  if ((report.samplersOnlyPresets ?? 0) > 0) lines.push(t("ui.import.streport.samplersOnlyPresets"));
  for (const kind of WORLD_INFO_KINDS) {
    const count = report.presetWorldInfo?.[kind] ?? 0;
    if (count > 0) lines.push(t(`ui.import.streport.bulkWorldInfo.${kind}`, { count }));
  }
  lines.push(...describeLeftOut(report.presetSettingsLeftOut, t));
  lines.push(
    ...describeLorebookNotes(
      report.lorebookEntriesMovedFromAuthorsNote ?? 0,
      report.lorebookEntriesMovedFromExamples ?? 0,
      t,
    ),
  );
  if ((report.regexSkipped ?? 0) > 0) lines.push(t("ui.import.streport.regexSkipped", { count: report.regexSkipped }));
  return lines;
}

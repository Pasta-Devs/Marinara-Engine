// ──────────────────────────────────────────────
// Choice Selection Modal
// Shows when a preset with variables is assigned
// to a chat — user picks option(s) per variable.
// Supports single-select and multi-select modes.
// ──────────────────────────────────────────────
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { usePresetFull, useUpdatePreset } from "../../hooks/use-presets";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { CheckCircle2, Circle, CheckSquare2, Square, ListChecks, Shuffle, Save } from "lucide-react";
import { cn } from "../../lib/utils";
import { SettingsSwitch } from "../panels/settings/SettingControls";

interface ChoiceSelectionModalProps {
  open: boolean;
  onClose: () => void;
  presetId: string | null;
  chatId: string;
  /** Existing selections to pre-populate (variableName → value or values) */
  existingChoices?: Record<string, string | string[]>;
  chatFloatingPanel?: boolean;
}

interface ChoiceOption {
  id: string;
  label: string;
  value: string;
}

type ChoiceDisplayMode = "auto" | "buttons" | "listbox";
type ChoiceOptionSort = "manual" | "alphabetical";

interface VariableData {
  id: string;
  variableName: string;
  question: string;
  options: ChoiceOption[];
  multiSelect: boolean;
  randomPick: boolean;
  displayMode: ChoiceDisplayMode;
  optionSort: ChoiceOptionSort;
}

const CHOICE_LISTBOX_AUTO_THRESHOLD = 8;

function readChoiceDisplayMode(value: unknown): ChoiceDisplayMode {
  return value === "buttons" || value === "listbox" ? value : "auto";
}

function readChoiceOptionSort(value: unknown): ChoiceOptionSort {
  return value === "alphabetical" ? "alphabetical" : "manual";
}

function getPresentedOptions(variable: VariableData) {
  if (variable.optionSort !== "alphabetical") return variable.options;
  return [...variable.options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

function shouldUseListbox(variable: VariableData) {
  if (variable.options.length <= 1 && !variable.multiSelect) return false;
  if (variable.displayMode === "buttons") return false;
  if (variable.displayMode === "listbox") return true;
  return variable.options.length >= CHOICE_LISTBOX_AUTO_THRESHOLD;
}

function sanitizeChoiceSelection(
  variable: VariableData,
  selection: string | string[] | undefined,
): string | string[] | undefined {
  const validValues = new Set(variable.options.map((opt) => opt.value));
  const candidates = Array.isArray(selection) ? selection : typeof selection === "string" ? [selection] : [];

  if (variable.multiSelect) {
    return candidates.filter((value, index) => validValues.has(value) && candidates.indexOf(value) === index);
  }

  return candidates.find((value) => validValues.has(value));
}

function fallbackChoiceSelection(variable: VariableData): string | string[] | undefined {
  if (variable.multiSelect) return [];
  return variable.options[0]?.value;
}

export function ChoiceSelectionModal({
  open,
  onClose,
  presetId,
  chatId,
  existingChoices = {},
  chatFloatingPanel = false,
}: ChoiceSelectionModalProps) {
  const { data } = usePresetFull(presetId);
  const isLoading = !data && !!presetId;
  const updateMetadata = useUpdateChatMetadata();
  const updatePreset = useUpdatePreset();

  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // Parse variables from preset data
  const variables = useMemo<VariableData[]>(() => {
    if (!data?.choiceBlocks) return [];
    return (data.choiceBlocks as any[]).map((cb: any) => {
      let opts: ChoiceOption[] = [];
      try {
        opts = typeof cb.options === "string" ? JSON.parse(cb.options) : (cb.options ?? []);
      } catch {
        /* empty */
      }
      return {
        id: cb.id,
        variableName: cb.variableName ?? cb.variable_name ?? "unknown",
        question: cb.question ?? "Choose an option",
        options: opts,
        multiSelect: cb.multiSelect === "true" || cb.multiSelect === true || cb.multi_select === "true",
        randomPick: cb.randomPick === "true" || cb.randomPick === true || cb.random_pick === "true",
        displayMode: readChoiceDisplayMode(cb.displayMode ?? cb.display_mode),
        optionSort: readChoiceOptionSort(cb.optionSort ?? cb.option_sort),
      };
    });
  }, [data?.choiceBlocks]);

  // Parse saved default choices from preset
  const defaultChoices = useMemo<Record<string, string | string[]>>(() => {
    if (!data?.preset) return {};
    try {
      const raw = (data.preset as any).defaultChoices ?? (data.preset as any).default_choices;
      return typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
    } catch {
      return {};
    }
  }, [data?.preset]);

  // Base selections derived from existing choices / defaults / first option.
  // Pure derivation — no setState, no flicker on open.
  const baseSelections = useMemo<Record<string, string | string[]>>(() => {
    if (!variables.length) return {};
    const initial: Record<string, string | string[]> = {};
    for (const v of variables) {
      const existing = existingChoices[v.variableName];
      const saved = defaultChoices[v.variableName];
      if (existing !== undefined) {
        initial[v.variableName] = sanitizeChoiceSelection(v, existing) ?? fallbackChoiceSelection(v) ?? "";
      } else if (saved !== undefined) {
        initial[v.variableName] = sanitizeChoiceSelection(v, saved) ?? fallbackChoiceSelection(v) ?? "";
      } else if (v.multiSelect) {
        initial[v.variableName] = [];
      } else if (v.options.length > 0) {
        initial[v.variableName] = v.options[0].value;
      }
    }
    return initial;
  }, [variables, existingChoices, defaultChoices]);

  // User overrides (only written when user clicks an option).
  // Reset when modal re-opens so stale overrides don't persist.
  const [overrides, setOverrides] = useState<Record<string, string | string[]>>({});
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setOverrides({});
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || isLoading || !presetId) return;
    if (variables.length === 0) {
      onClose();
    }
  }, [open, isLoading, onClose, presetId, variables.length]);

  // Merged view: base + user overrides
  const selections = useMemo(() => ({ ...baseSelections, ...overrides }), [baseSelections, overrides]);

  const allSelected = variables.every((v) => {
    const sel = selections[v.variableName];
    if (v.multiSelect) return Array.isArray(sel);
    // Single-option variables are boolean toggles — both ON and OFF are valid
    if (v.options.length === 1) return sel !== undefined;
    return sel !== undefined && sel !== "";
  });

  const handleConfirm = useCallback(() => {
    // Save selections to chat metadata
    updateMetadata.mutate({ id: chatId, presetChoices: selections }, { onSuccess: () => onClose() });
    // Optionally save as default for this preset
    if (saveAsDefault && presetId) {
      updatePreset.mutate({ id: presetId, defaultChoices: selections });
    }
  }, [chatId, presetId, selections, saveAsDefault, updateMetadata, updatePreset, onClose]);

  // Toggle a single option in a multi-select variable
  const toggleMulti = useCallback(
    (varName: string, value: string) => {
      setOverrides((prev) => {
        const current = Array.isArray(prev[varName])
          ? (prev[varName] as string[])
          : Array.isArray(baseSelections[varName])
            ? (baseSelections[varName] as string[])
            : [];
        const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        return { ...prev, [varName]: next };
      });
    },
    [baseSelections],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configure Preset Variables"
      width="max-w-lg"
      chatFloatingPanel={chatFloatingPanel}
    >
      {variables.length === 0 ? (
        isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          </div>
        ) : null
      ) : (
        <div className="space-y-4 p-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            This preset has configurable variables. Select option(s) for each to customize your experience.
          </p>

          {variables.map((v) => {
            const presentedOptions = getPresentedOptions(v);
            const listboxMode = shouldUseListbox(v);
            return (
              <div key={v.id} className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
              <h4 className="mb-1 text-xs font-semibold text-[var(--foreground)]">{v.question}</h4>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  Variable: <code className="text-[var(--foreground)]">{`{{${v.variableName}}}`}</code>
                </p>
                {v.options.length === 1 && !v.multiSelect && (
                  <span className="flex items-center gap-0.5 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--foreground)]">
                    Boolean toggle
                  </span>
                )}
                {v.multiSelect && (
                  <span className="flex items-center gap-0.5 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--foreground)]">
                    {v.randomPick ? (
                      <>
                        <Shuffle size="0.5625rem" /> Random pick
                      </>
                    ) : (
                      <>
                        <ListChecks size="0.5625rem" /> Multi-select
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {listboxMode && v.multiSelect ? (
                  <select
                    multiple
                    value={Array.isArray(selections[v.variableName]) ? (selections[v.variableName] as string[]) : []}
                    onChange={(e) => {
                      const next = Array.from(e.currentTarget.selectedOptions, (option) => option.value);
                      setOverrides((prev) => ({ ...prev, [v.variableName]: next }));
                    }}
                    size={Math.min(8, Math.max(4, presentedOptions.length))}
                    className="mari-preset-native-select min-h-28 w-full rounded-lg bg-[var(--background)] px-2 py-2 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    {presentedOptions.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : listboxMode ? (
                  <select
                    value={typeof selections[v.variableName] === "string" ? (selections[v.variableName] as string) : ""}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, [v.variableName]: e.target.value }))}
                    className="mari-preset-native-select w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    {presentedOptions.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : v.multiSelect
                  ? // ── Multi-select: checkboxes ──
                    presentedOptions.map((opt) => {
                      const selected = Array.isArray(selections[v.variableName])
                        ? (selections[v.variableName] as string[])
                        : [];
                      const isSelected = selected.includes(opt.value);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleMulti(v.variableName, opt.value)}
                          className={cn(
                            "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-all",
                            isSelected
                              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                              : "hover:bg-[var(--accent)]",
                          )}
                        >
                          {isSelected ? (
                            <CheckSquare2 size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                          ) : (
                            <Square size="0.875rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className={cn("text-xs font-medium", isSelected && "text-[var(--primary)]")}>
                              {opt.label}
                            </span>
                            {opt.value && (
                              <p className="mt-0.5 line-clamp-2 text-[0.625rem] text-[var(--muted-foreground)]">
                                {opt.value.slice(0, 150)}
                                {opt.value.length > 150 ? "…" : ""}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })
                  : presentedOptions.length === 1
                    ? // ── Boolean toggle: single option ──
                      (() => {
                        const opt = presentedOptions[0];
                        if (!opt) return null;
                        const isOn = selections[v.variableName] === opt.value;
                        return (
                          <button
                            onClick={() =>
                              setOverrides((prev) => ({
                                ...prev,
                                [v.variableName]: isOn ? "" : opt.value,
                              }))
                            }
                            className={cn(
                              "flex w-full items-center justify-between gap-2.5 rounded-lg p-2.5 text-left transition-all",
                              isOn
                                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                                : "hover:bg-[var(--accent)]",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <span className={cn("text-xs font-medium", isOn && "text-[var(--primary)]")}>
                                {opt.label}
                              </span>
                              {opt.value && (
                                <p className="mt-0.5 line-clamp-2 text-[0.625rem] text-[var(--muted-foreground)]">
                                  {opt.value.slice(0, 150)}
                                  {opt.value.length > 150 ? "…" : ""}
                                </p>
                              )}
                            </div>
                            <div
                              className={cn(
                                "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
                                isOn ? "bg-[var(--primary)]" : "bg-[var(--border)]",
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block h-3 w-3 translate-y-0.5 rounded-full bg-white shadow transition-transform",
                                  isOn ? "translate-x-3.5" : "translate-x-0.5",
                                )}
                              />
                            </div>
                          </button>
                        );
                      })()
                    : // ── Single-select: radio-style ──
                      presentedOptions.map((opt) => {
                        const isSelected = selections[v.variableName] === opt.value;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setOverrides((prev) => ({ ...prev, [v.variableName]: opt.value }))}
                            className={cn(
                              "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-all",
                              isSelected
                                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                                : "hover:bg-[var(--accent)]",
                            )}
                          >
                            {isSelected ? (
                              <CheckCircle2 size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                            ) : (
                              <Circle size="0.875rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className={cn("text-xs font-medium", isSelected && "text-[var(--primary)]")}>
                                {opt.label}
                              </span>
                              {opt.value && (
                                <p className="mt-0.5 line-clamp-2 text-[0.625rem] text-[var(--muted-foreground)]">
                                  {opt.value.slice(0, 150)}
                                  {opt.value.length > 150 ? "…" : ""}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
              </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
              <SettingsSwitch
                ariaLabel={saveAsDefault ? "Do not save choices as default" : "Save choices as default"}
                checked={saveAsDefault}
                onChange={setSaveAsDefault}
                className="p-0 hover:bg-transparent"
              />
              <Save size="0.75rem" />
              Save as default
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              >
                Skip
              </button>
              <button
                onClick={handleConfirm}
                disabled={!allSelected || updateMetadata.isPending}
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] shadow-md transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {updateMetadata.isPending ? "Saving…" : "Confirm Choices"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

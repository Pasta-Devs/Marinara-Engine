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
import { ListChecks, Shuffle, Save } from "lucide-react";
import { arePresetChoiceSelectionsComplete } from "../../lib/preset-choice-selection";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { ChoiceOptionsField } from "./ChoiceOptionsField";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ChoiceSelectionModalProps {
  open: boolean;
  onClose: () => void;
  presetId: string | null;
  chatId?: string;
  /** Draft setup has no chat yet; return choices without writing chat metadata. */
  onConfirm?: (choices: Record<string, string | string[]>) => void;
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

function readChoiceDisplayMode(value: unknown): ChoiceDisplayMode {
  return value === "buttons" || value === "listbox" ? value : "auto";
}

function readChoiceOptionSort(value: unknown): ChoiceOptionSort {
  return value === "alphabetical" ? "alphabetical" : "manual";
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
  if (variable.randomPick && variable.options.length > 0) {
    return variable.options[Math.floor(Math.random() * variable.options.length)].value;
  }
  return variable.options[0]?.value;
}

export function ChoiceSelectionModal(props: ChoiceSelectionModalProps) {
  return <ChatChoiceSelectionModal key={`${props.chatId}:${props.presetId}`} {...props} />;
}

function ChatChoiceSelectionModal({
  open,
  onClose,
  presetId,
  chatId,
  onConfirm,
  existingChoices = {},
  chatFloatingPanel = false,
}: ChoiceSelectionModalProps) {
  const { t: localizeUi } = useUiTranslation();
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

  const fallbackSelections = useMemo(
    () =>
      Object.fromEntries(variables.map((variable) => [variable.variableName, fallbackChoiceSelection(variable) ?? ""])),
    [variables],
  );

  // Base selections derived from existing choices / defaults / first option.
  // Pure derivation — no setState, no flicker on open.
  const baseSelections = useMemo<Record<string, string | string[]>>(() => {
    if (!variables.length) return {};
    const initial: Record<string, string | string[]> = {};
    for (const v of variables) {
      const existing = existingChoices[v.variableName];
      const saved = defaultChoices[v.variableName];
      if (existing !== undefined) {
        initial[v.variableName] = sanitizeChoiceSelection(v, existing) ?? fallbackSelections[v.variableName] ?? "";
      } else if (saved !== undefined && !(v.randomPick && !v.multiSelect)) {
        initial[v.variableName] = sanitizeChoiceSelection(v, saved) ?? fallbackSelections[v.variableName] ?? "";
      } else if (v.multiSelect) {
        initial[v.variableName] = [];
      } else {
        initial[v.variableName] = fallbackSelections[v.variableName] ?? "";
      }
    }
    return initial;
  }, [variables, existingChoices, defaultChoices, fallbackSelections]);

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

  const autoClosedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      autoClosedRef.current = false;
      return;
    }
    if (isLoading || autoClosedRef.current) return;
    if (!presetId || variables.length === 0) {
      // Closing can advance the setup wizard; do it only once, including StrictMode effects.
      autoClosedRef.current = true;
      if (onConfirm) onConfirm({});
      else onClose();
    }
  }, [open, isLoading, onClose, onConfirm, presetId, variables.length]);

  // Merged view: base + user overrides
  const selections = useMemo(() => ({ ...baseSelections, ...overrides }), [baseSelections, overrides]);

  const allSelected = arePresetChoiceSelectionsComplete(variables, selections);

  const handleConfirm = useCallback(() => {
    // Save selections to chat metadata
    if (onConfirm) onConfirm(selections);
    else if (chatId) updateMetadata.mutate({ id: chatId, presetChoices: selections }, { onSuccess: () => onClose() });
    // Optionally save as default for this preset
    if (saveAsDefault && presetId) {
      updatePreset.mutate({ id: presetId, defaultChoices: selections });
    }
  }, [chatId, presetId, selections, saveAsDefault, updateMetadata, updatePreset, onClose, onConfirm]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.presets.choiceselectionmodal.configurePresetVariables")}
      width="max-w-lg"
      chatFloatingPanel={chatFloatingPanel}
      closeDisabled={updateMetadata.isPending}
    >
      {variables.length === 0 ? (
        isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          </div>
        ) : null
      ) : (
        <fieldset disabled={updateMetadata.isPending} className="min-w-0 space-y-4 p-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.presets.choiceselectionmodal.thisPresetHasConfigurableVariablesSelectOptionSFor")}
          </p>

          {variables.map((v) => {
            return (
              <div key={v.id} className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
                <h4 className="mb-1 text-xs font-semibold text-[var(--foreground)]">{v.question}</h4>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.presets.choiceselectionmodal.variable")}{" "}
                    <code className="text-[var(--foreground)]">{`{{${v.variableName}}}`}</code>
                  </p>
                  {v.options.length === 1 && !v.multiSelect && (
                    <span className="flex items-center gap-0.5 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.presets.choiceselectionmodal.booleanToggle")}
                    </span>
                  )}
                  {(v.multiSelect || v.randomPick) && (
                    <span className="flex items-center gap-0.5 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--foreground)]">
                      {v.randomPick ? (
                        <>
                          <Shuffle size="0.5625rem" /> {localizeUi("ui.presets.choiceselectionmodal.randomPick")}
                        </>
                      ) : (
                        <>
                          <ListChecks size="0.5625rem" /> {localizeUi("ui.presets.choiceselectionmodal.multiSelect")}
                        </>
                      )}
                    </span>
                  )}
                </div>
                <ChoiceOptionsField
                  variable={v}
                  selection={selections[v.variableName]}
                  optionKey={(opt) => opt.value}
                  onChange={(next) => setOverrides((prev) => ({ ...prev, [v.variableName]: next }))}
                  ariaLabel={v.question}
                />
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
              {localizeUi("ui.presets.choiceselectionmodal.saveAsDefault")}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => (onConfirm ? onConfirm(baseSelections) : onClose())}
                disabled={updateMetadata.isPending}
                className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              >
                {localizeUi("onboarding.actions.skip")}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!allSelected || updateMetadata.isPending}
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] shadow-md transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {updateMetadata.isPending
                  ? localizeUi("chat.settings.inlineEditor.saving")
                  : localizeUi("ui.presets.choiceselectionmodal.confirmChoices")}
              </button>
            </div>
          </div>
        </fieldset>
      )}
    </Modal>
  );
}

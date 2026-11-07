import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePenLine, Maximize2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CharacterData } from "@marinara-engine/shared";
import { useCharacter, usePersona, useUpdateCharacter, useUpdatePersona } from "../../../hooks/use-characters";
import { useQuoteFormatter } from "../../../hooks/use-quote-formatter";
import { cn } from "../../../lib/utils";
import { ExpandedTextarea } from "../../../components/ui/ExpandedTextarea";

type InlineCardKind = "character" | "persona";
type CardTextField = "description" | "personality" | "backstory" | "appearance" | "scenario" | "exampleDialogue";

interface InlineCardDraft {
  description: string;
  personality: string;
  backstory: string;
  appearance: string;
  scenario: string;
  exampleDialogue: string;
}

interface InlineChatCardEditorProps {
  entityId: string;
  entityKind: InlineCardKind;
  displayName: string;
  onClose: () => void;
  /** Hands the drawer a function that saves any unsaved edit and resolves once every queued save is done (true if they all succeeded). */
  onFlushChange?: (flush: (() => Promise<boolean>) | null) => void;
}

type SaveState = "saved" | "dirty" | "saving" | "error";

interface CharacterDetailRow {
  id: string;
  data: string | CharacterData;
}

interface PersonaDetailRow {
  id: string;
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  backstory?: string;
  appearance?: string;
}

const CARD_FIELD_ORDER: CardTextField[] = ["description", "personality", "backstory", "appearance", "scenario"];

function parseCharacterData(raw: unknown): CharacterData | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as CharacterDetailRow;
  try {
    const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    return parsed && typeof parsed === "object" ? (parsed as CharacterData) : null;
  } catch {
    return null;
  }
}

function createCharacterDraft(data: CharacterData): InlineCardDraft {
  return {
    description: typeof data.description === "string" ? data.description : "",
    personality: typeof data.personality === "string" ? data.personality : "",
    backstory: typeof data.extensions?.backstory === "string" ? data.extensions.backstory : "",
    appearance: typeof data.extensions?.appearance === "string" ? data.extensions.appearance : "",
    scenario: typeof data.scenario === "string" ? data.scenario : "",
    exampleDialogue: typeof data.mes_example === "string" ? data.mes_example : "",
  };
}

function createPersonaDraft(raw: unknown): InlineCardDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const persona = raw as PersonaDetailRow;
  return {
    description: persona.description ?? "",
    personality: persona.personality ?? "",
    backstory: persona.backstory ?? "",
    appearance: persona.appearance ?? "",
    scenario: persona.scenario ?? "",
    exampleDialogue: "",
  };
}

function applyDraftToCharacter(data: CharacterData, draft: InlineCardDraft): CharacterData {
  return {
    ...data,
    description: draft.description,
    personality: draft.personality,
    scenario: draft.scenario,
    mes_example: draft.exampleDialogue,
    extensions: {
      ...data.extensions,
      backstory: draft.backstory,
      appearance: draft.appearance,
    },
  };
}

function getPersonaMutationField(field: CardTextField): keyof PersonaDetailRow | null {
  if (field === "exampleDialogue") return null;
  return field;
}

function CompactCardTextarea({
  label,
  value,
  placeholder,
  onChange,
  onBlur,
  onExpand,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onExpand: () => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between gap-2 text-[0.6875rem] font-medium text-[var(--marinara-chat-chrome-panel-muted)]">
        <span>{label}</span>
        <button
          type="button"
          onClick={onExpand}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
          title={t("chat.settings.inlineEditor.expandField", { field: label })}
          aria-label={t("chat.settings.inlineEditor.expandField", { field: label })}
        >
          <Maximize2 size="0.6875rem" />
        </button>
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-label={label}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] px-2.5 py-2 text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-text)] outline-none placeholder:text-[var(--marinara-chat-chrome-panel-muted)]/55 focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
      />
    </label>
  );
}

export function InlineChatCardEditor({
  entityId,
  entityKind,
  displayName,
  onClose,
  onFlushChange,
}: InlineChatCardEditorProps) {
  const { t } = useTranslation();
  const characterQuery = useCharacter(entityKind === "character" ? entityId : null);
  const personaQuery = usePersona(entityKind === "persona" ? entityId : null);
  const updateCharacter = useUpdateCharacter();
  const updatePersona = useUpdatePersona();
  const formatQuotes = useQuoteFormatter();
  const rawEntity = entityKind === "character" ? characterQuery.data : personaQuery.data;
  const isLoading = entityKind === "character" ? characterQuery.isLoading : personaQuery.isLoading;
  const isError = entityKind === "character" ? characterQuery.isError : personaQuery.isError;
  const [draft, setDraft] = useState<InlineCardDraft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [expandedField, setExpandedField] = useState<CardTextField | null>(null);
  const draftRef = useRef<InlineCardDraft | null>(null);
  const baseCharacterRef = useRef<CharacterData | null>(null);
  const loadedEntityRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSubmittedCharacterRef = useRef("");
  const savedPersonaFieldsRef = useRef<Partial<Record<CardTextField, string>>>({});
  const lastSaveFailedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const entityKey = `${entityKind}:${entityId}`;
    if (!rawEntity || loadedEntityRef.current === entityKey) return;

    const nextDraft =
      entityKind === "character"
        ? (() => {
            const characterData = parseCharacterData(rawEntity);
            if (!characterData) return null;
            baseCharacterRef.current = characterData;
            return createCharacterDraft(characterData);
          })()
        : createPersonaDraft(rawEntity);

    if (!nextDraft) return;
    loadedEntityRef.current = entityKey;
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setSaveState("saved");
    savedPersonaFieldsRef.current = {
      description: nextDraft.description,
      personality: nextDraft.personality,
      backstory: nextDraft.backstory,
      appearance: nextDraft.appearance,
      scenario: nextDraft.scenario,
    };
    if (baseCharacterRef.current) {
      lastSubmittedCharacterRef.current = JSON.stringify(baseCharacterRef.current);
    }
  }, [entityId, entityKind, rawEntity]);

  const enqueueSave = useCallback((task: () => Promise<unknown>) => {
    if (mountedRef.current) setSaveState("saving");
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await task();
          lastSaveFailedRef.current = false;
          if (mountedRef.current) setSaveState("saved");
        } catch {
          lastSaveFailedRef.current = true;
          if (mountedRef.current) setSaveState("error");
        }
      });
  }, []);

  const commitField = useCallback(
    (field: CardTextField) => {
      const currentDraft = draftRef.current;
      if (!currentDraft) return;

      if (entityKind === "character") {
        const baseCharacter = baseCharacterRef.current;
        if (!baseCharacter) return;
        const nextCharacter = applyDraftToCharacter(baseCharacter, currentDraft);
        const fingerprint = JSON.stringify(nextCharacter);
        if (fingerprint === lastSubmittedCharacterRef.current) {
          if (mountedRef.current) setSaveState("saved");
          return;
        }
        lastSubmittedCharacterRef.current = fingerprint;
        enqueueSave(async () => {
          try {
            await updateCharacter.mutateAsync({
              id: entityId,
              data: nextCharacter as unknown as Record<string, unknown>,
            });
            baseCharacterRef.current = nextCharacter;
          } catch (error) {
            lastSubmittedCharacterRef.current = JSON.stringify(baseCharacterRef.current);
            throw error;
          }
        });
        return;
      }

      const mutationField = getPersonaMutationField(field);
      if (!mutationField) return;
      const value = currentDraft[field];
      if (savedPersonaFieldsRef.current[field] === value) {
        if (mountedRef.current) setSaveState("saved");
        return;
      }
      const previousValue = savedPersonaFieldsRef.current[field];
      savedPersonaFieldsRef.current[field] = value;
      enqueueSave(async () => {
        try {
          await updatePersona.mutateAsync({
            id: entityId,
            [mutationField]: value,
          });
        } catch (error) {
          savedPersonaFieldsRef.current[field] = previousValue;
          throw error;
        }
      });
    },
    [enqueueSave, entityId, entityKind, updateCharacter, updatePersona],
  );

  useEffect(() => {
    if (!onFlushChange) return;
    onFlushChange(async () => {
      // Every field, so an edit still in its box is saved too; unchanged ones queue nothing.
      for (const field of CARD_FIELD_ORDER) commitField(field);
      await saveQueueRef.current;
      return !lastSaveFailedRef.current;
    });
    return () => onFlushChange(null);
  }, [commitField, onFlushChange]);

  const updateTextField = useCallback(
    (field: CardTextField, value: string) => {
      const formattedValue = formatQuotes(value);
      setDraft((current) => {
        if (!current) return current;
        const next = { ...current, [field]: formattedValue };
        draftRef.current = next;
        return next;
      });
      setSaveState("dirty");
    },
    [formatQuotes],
  );

  const fields = useMemo(
    () =>
      CARD_FIELD_ORDER.map((field) => ({
        field,
        label: t(`chat.settings.inlineEditor.fields.${field}`),
      })),
    [t],
  );

  const expandedValue = useMemo(() => {
    if (!draft || !expandedField) return "";
    return draft[expandedField];
  }, [draft, expandedField]);

  const expandedLabel = useMemo(() => {
    if (!expandedField) return "";
    return t(`chat.settings.inlineEditor.fields.${expandedField}`);
  }, [expandedField, t]);

  const handleExpandedChange = useCallback(
    (value: string) => {
      if (!expandedField) return;
      updateTextField(expandedField, value);
    },
    [expandedField, updateTextField],
  );

  const closeExpandedField = useCallback(() => {
    if (!expandedField) return;
    commitField(expandedField);
    setExpandedField(null);
  }, [commitField, expandedField]);

  const saveLabel =
    saveState === "saving"
      ? t("chat.settings.inlineEditor.saving")
      : saveState === "dirty"
        ? t("chat.settings.inlineEditor.unsaved")
        : saveState === "error"
          ? t("chat.settings.inlineEditor.saveError")
          : t("chat.settings.inlineEditor.saved");

  return (
    <div
      data-chat-settings-inline-card-editor={`${entityKind}:${entityId}`}
      className="mari-chat-settings-inline-editor mt-2 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] p-2.5"
    >
      <div className="mb-2 flex items-start gap-2">
        <FilePenLine size="0.8125rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {t("chat.settings.inlineEditor.cardTitle", { name: displayName })}
          </p>
          <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
            {entityKind === "character"
              ? t("chat.settings.inlineEditor.characterAutoSave")
              : t("chat.settings.inlineEditor.autoSave")}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 pt-0.5 text-[0.5625rem]",
            saveState === "error" ? "text-[var(--destructive)]" : "text-[var(--marinara-chat-chrome-panel-muted)]",
          )}
        >
          {saveLabel}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
          title={t("chat.settings.inlineEditor.close")}
          aria-label={t("chat.settings.inlineEditor.close")}
        >
          <X size="0.75rem" />
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2" aria-label={t("chat.settings.inlineEditor.loading")}>
          <div className="shimmer h-14 rounded-lg" />
          <div className="shimmer h-14 rounded-lg" />
          <div className="shimmer h-14 rounded-lg" />
        </div>
      )}

      {isError && (
        <p className="rounded-lg border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)]">
          {t("chat.settings.inlineEditor.loadError")}
        </p>
      )}

      {draft && (
        <div className="space-y-2">
          {fields.map(({ field, label }) => (
            <CompactCardTextarea
              key={field}
              label={label}
              value={draft[field]}
              placeholder={t("chat.settings.inlineEditor.placeholder")}
              onChange={(value) => updateTextField(field, value)}
              onBlur={() => commitField(field)}
              onExpand={() => setExpandedField(field)}
            />
          ))}

          {entityKind === "character" && (
            <CompactCardTextarea
              label={t("chat.settings.inlineEditor.fields.exampleDialogue")}
              value={draft.exampleDialogue}
              placeholder={t("chat.settings.inlineEditor.placeholder")}
              onChange={(value) => updateTextField("exampleDialogue", value)}
              onBlur={() => commitField("exampleDialogue")}
              onExpand={() => setExpandedField("exampleDialogue")}
            />
          )}
        </div>
      )}

      <ExpandedTextarea
        open={expandedField !== null}
        onClose={closeExpandedField}
        title={expandedLabel}
        value={expandedValue}
        onChange={handleExpandedChange}
        placeholder={t("chat.settings.inlineEditor.placeholder")}
        surface="chat"
      />
    </div>
  );
}

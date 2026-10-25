import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { CardFieldGenerationDraft, CardFieldGenerationKey, CardFieldKey } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";

/** Generates into a draft only; a late response must never replace newer authoring. */
export function useCardFieldGeneration<Field extends CardFieldGenerationKey = CardFieldKey>(
  kind: "character" | "persona",
  id: string | null,
  card: CardFieldGenerationDraft,
  onApply: (field: Field, text: string) => void,
) {
  const { t } = useTranslation();
  const labels = {
    summary: t("ui.characters.summary.label"),
    description: t("chat.settings.inlineEditor.fields.description"),
    personality: t("chat.settings.inlineEditor.fields.personality"),
    backstory: t("chat.settings.inlineEditor.fields.backstory"),
    appearance: t("chat.settings.inlineEditor.fields.appearance"),
    scenario: t("chat.settings.inlineEditor.fields.scenario"),
    mes_example: t("chat.settings.inlineEditor.fields.exampleDialogue"),
    first_mes: t("ui.characters.dialoguetab.firstMessage"),
  };
  const identity = `${kind}:${id}`;
  const latest = useRef({ identity, card, onApply });
  useLayoutEffect(() => {
    latest.current = { identity, card, onApply };
  });
  const alive = useRef(false);
  const active = useRef<{ identity: string; controller: AbortController } | null>(null);
  const [pending, setPending] = useState<{ identity: string; field: Field } | null>(null);
  const mutation = useMutation({
    mutationFn: ({
      field,
      draft,
      controller,
    }: {
      field: Field;
      draft: CardFieldGenerationDraft;
      controller: AbortController;
    }) =>
      api.post<{ text: string }>(
        `/characters/${kind === "persona" ? "personas/" : ""}${encodeURIComponent(id!)}/card-field/generate`,
        { field, card: draft, debugMode: useUIStore.getState().debugMode },
        { signal: controller.signal },
      ),
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current?.controller.abort();
    };
  }, [identity]);

  const generate = async (field: Field) => {
    if (!id || (active.current?.identity === identity && !active.current.controller.signal.aborted)) return;
    active.current?.controller.abort();
    const controller = new AbortController();
    active.current = { identity, controller };
    const draft = { ...card };
    const snapshot = draft[field];
    setPending({ identity, field });
    const stillHere = () => {
      const ui = useUIStore.getState();
      return (
        alive.current &&
        !controller.signal.aborted &&
        latest.current.identity === identity &&
        (kind === "character" ? ui.characterDetailId : ui.personaDetailId) === id
      );
    };
    try {
      const result = await mutation.mutateAsync({ field, draft, controller });
      if (!stillHere()) return;
      if (latest.current.card[field] !== snapshot) {
        toast.info(t("ui.cardFields.draftChanged"));
        return;
      }
      latest.current.onApply(field, result.text);
      toast.success(t("ui.cardFields.generated", { field: labels[field] }));
    } catch (error) {
      if (stillHere()) toast.error(error instanceof Error ? error.message : t("ui.cardFields.failed"));
    } finally {
      if (active.current?.controller === controller) {
        active.current = null;
        if (alive.current) setPending(null);
      }
    }
  };

  const pendingField = pending?.identity === identity ? pending.field : null;
  return { generate, pendingField, isPending: pendingField !== null, labels };
}

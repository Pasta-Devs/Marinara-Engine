import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CardFieldAlternative, CardFieldDraft, CardFieldKey } from "@marinara-engine/shared";
import { useCardFieldGeneration } from "../../hooks/use-card-field-generation";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { generateClientId } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { MacroTextarea } from "../ui/MacroTextarea";
import { HelpTooltip } from "../ui/HelpTooltip";
import { CardFieldWand } from "./CardFieldWand";

type ChatChoice = { id: string; name: string };
type Props = {
  kind: "character" | "persona";
  entityId: string | null;
  field: CardFieldKey;
  label: string;
  card: CardFieldDraft;
  alternatives: CardFieldAlternative[];
  onChange: (alternatives: CardFieldAlternative[]) => void;
};

/** Alternatives remain part of the editor draft until the author saves the card. */
export function CardFieldAlternatives(props: Props) {
  const { t } = useTranslation();
  const own = props.alternatives.filter((alternative) => alternative.field === props.field);
  const chats = useQuery({
    queryKey: ["card-field-chats", props.kind, props.entityId],
    queryFn: ({ signal }) =>
      api.get<ChatChoice[]>(
        `/characters/${props.kind === "persona" ? "personas/" : ""}${encodeURIComponent(props.entityId!)}/card-field-chats`,
        { signal },
      ),
    enabled: !!props.entityId && own.length > 0,
    staleTime: 0,
    refetchOnMount: "always",
  });
  return (
    <div className="space-y-3">
      {own.map((alternative, index) => (
        <AlternativeField
          key={alternative.id}
          {...props}
          alternative={alternative}
          index={index + 1}
          chats={chats.data ?? []}
          loading={chats.isPending}
          failed={chats.isError}
          retry={() => void chats.refetch()}
        />
      ))}
      <button
        type="button"
        className="mari-editor-action inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
        title={t("ui.cardFields.alternativeAddHelp")}
        onClick={() =>
          props.onChange([
            ...props.alternatives,
            { id: generateClientId(), field: props.field, value: props.card[props.field], chatIds: [] },
          ])
        }
      >
        <Plus size="0.875rem" aria-hidden />
        {t("ui.cardFields.alternativeAdd")}
      </button>
    </div>
  );
}

function AlternativeField({
  alternative,
  index,
  chats,
  loading,
  failed,
  retry,
  ...props
}: Props & {
  alternative: CardFieldAlternative;
  index: number;
  chats: ChatChoice[];
  loading: boolean;
  failed: boolean;
  retry: () => void;
}) {
  const { t } = useTranslation();
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const title = t("ui.cardFields.alternativeTitle", { field: props.label, index });
  const changeValue = (value: string) =>
    props.onChange(props.alternatives.map((entry) => (entry.id === alternative.id ? { ...entry, value } : entry)));
  const generation = useCardFieldGeneration(
    props.kind,
    props.entityId,
    { ...props.card, [props.field]: alternative.value },
    (_, text) => changeValue(text),
  );
  const selectChat = (chatId: string, checked: boolean) =>
    props.onChange(
      props.alternatives.map((entry) => {
        if (entry.id === alternative.id)
          return {
            ...entry,
            chatIds: checked
              ? [...entry.chatIds.filter((id) => id !== chatId), chatId]
              : entry.chatIds.filter((id) => id !== chatId),
          };
        // A chat uses one alternative for a field. Selecting it here moves an existing assignment.
        return checked && entry.field === props.field
          ? { ...entry, chatIds: entry.chatIds.filter((id) => id !== chatId) }
          : entry;
      }),
    );
  const remove = async () => {
    if (
      await showConfirmDialog({
        title: t("ui.cardFields.alternativeDeleteTitle"),
        message: t("ui.cardFields.alternativeDeleteMessage", { field: props.label, index }),
        confirmLabel: t("ui.cardFields.alternativeDelete"),
        tone: "destructive",
      })
    ) {
      const current = latest.current;
      const ui = useUIStore.getState();
      if (
        !mounted.current ||
        current.entityId !== props.entityId ||
        (props.kind === "character" ? ui.characterDetailId : ui.personaDetailId) !== props.entityId
      )
        return;
      current.onChange(current.alternatives.filter((entry) => entry.id !== alternative.id));
    }
  };
  const selected = chats.filter((chat) => alternative.chatIds.includes(chat.id)).length;
  return (
    <section
      aria-label={title}
      className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold">
          {title}
          <HelpTooltip
            text={t(
              props.field === "summary" ? "ui.cardFields.alternativeSummaryHelp" : "ui.cardFields.alternativeHelp",
            )}
            wide
          />
        </h4>
        <div className="flex shrink-0 items-center gap-1">
          <CardFieldWand
            label={title}
            onGenerate={() => void generation.generate(props.field)}
            disabled={!props.entityId || generation.isPending}
            loading={generation.isPending}
          />
          <button
            type="button"
            onClick={() => void remove()}
            aria-label={t("ui.cardFields.alternativeDeleteLabel", { field: props.label, index })}
            title={t("ui.cardFields.alternativeDeleteTitle")}
            className="mari-editor-action inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--destructive)]"
          >
            <Trash2 size="0.875rem" aria-hidden />
          </button>
        </div>
      </div>
      <MacroTextarea
        value={alternative.value}
        onChange={changeValue}
        rows={5}
        title={title}
        ariaLabel={title}
        placeholder={t("ui.cardFields.seedPlaceholder")}
        showMarkdownPreview
        showTokenCount
        selfCharacterId={props.kind === "character" ? props.entityId : undefined}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm leading-relaxed outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
      />
      <details
        className="group/chats rounded-lg border border-[var(--border)] text-xs"
        onToggle={(event) => {
          if (event.currentTarget.open) retry();
        }}
      >
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            size="0.75rem"
            className="shrink-0 transition-transform group-open/chats:rotate-90"
            aria-hidden
          />
          <span>
            {loading
              ? t("ui.cardFields.alternativeChatsLoading")
              : failed
                ? t("ui.cardFields.alternativeChatsUnknown")
                : t("ui.cardFields.alternativeChats", { count: selected })}
          </span>
        </summary>
        <div className="space-y-2 border-t border-[var(--border)] p-3">
          <p className="text-[var(--muted-foreground)]">{t("ui.cardFields.alternativeChatHelp")}</p>
          {loading ? (
            <p role="status">{t("ui.cardFields.alternativeChatsLoading")}</p>
          ) : failed ? (
            <div role="alert">
              <p>{t("ui.cardFields.alternativeChatsFailed")}</p>
              <button type="button" className="mari-editor-action mt-2 rounded-lg px-3 py-2" onClick={retry}>
                {t("ui.cardFields.alternativeChatsRetry")}
              </button>
            </div>
          ) : chats.length === 0 ? (
            <p>{t("ui.cardFields.alternativeChatsEmpty")}</p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {chats.map((chat) => (
                <label
                  key={chat.id}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-[var(--secondary)]"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                    checked={alternative.chatIds.includes(chat.id)}
                    onChange={(event) => selectChat(chat.id, event.target.checked)}
                  />
                  <span className="min-w-0 break-words">{chat.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

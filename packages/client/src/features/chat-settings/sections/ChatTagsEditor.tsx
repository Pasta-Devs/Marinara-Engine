// ──────────────────────────────────────────────
// Chat tags (theming round 2, batch 5)
//
// Tags sort chats in the sidebar's tag filter and let a theme style a story:
// `:root[data-chat-tags~="horror"] { … }`. Shown under Chat settings > Chat Name.
// ──────────────────────────────────────────────
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import type { Chat } from "@marinara-engine/shared";
import { useChats, useUpdateChatMetadata } from "../../../hooks/use-chats";
import { readChatTags, normalizeChatTags } from "../../../lib/chat-tags";

export function ChatTagsEditor({ chat }: { chat: Chat }) {
  const { t } = useTranslation();
  const listId = useId();
  const updateMeta = useUpdateChatMetadata();
  const { data: chats } = useChats();
  const tags = readChatTags(chat.metadata);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // Tags used on other chats, offered while typing.
  const known = useMemo(() => {
    const all = new Set<string>();
    for (const other of chats ?? []) for (const tag of readChatTags(other.metadata)) all.add(tag);
    for (const tag of tags) all.delete(tag);
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [chats, tags]);

  const save = (next: string[]) => updateMeta.mutate({ id: chat.id, tags: normalizeChatTags(next) });
  const commit = () => {
    const value = draft.trim();
    if (value) save([...tags, ...value.split(",")]);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-chat-tags-editor>
      <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {t("theming.tags.label", "Tags")}
      </span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--secondary)] py-0.5 pl-2 pr-1 text-[0.6875rem] ring-1 ring-[var(--border)]"
        >
          {tag}
          <button
            type="button"
            onClick={() => save(tags.filter((item) => item !== tag))}
            aria-label={t("theming.tags.remove", "Remove tag {{tag}}", { tag })}
            title={t("theming.tags.remove", "Remove tag {{tag}}", { tag })}
            className="rounded-full p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X size="0.625rem" />
          </button>
        </span>
      ))}
      {adding ? (
        <>
          <input
            autoFocus
            value={draft}
            list={listId}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") {
                event.stopPropagation();
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={commit}
            placeholder={t("theming.tags.placeholder", "horror, slow burn")}
            aria-label={t("theming.tags.add", "Add tag")}
            className="mari-chrome-field w-32 !rounded-md px-2 py-1 text-[0.6875rem]"
          />
          <datalist id={listId}>
            {known.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] text-[var(--muted-foreground)] border border-dashed border-[var(--border)] hover:text-[var(--foreground)]"
        >
          <Plus size="0.625rem" />
          {t("theming.tags.add", "Add tag")}
        </button>
      )}
    </div>
  );
}

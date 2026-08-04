import { useEffect, useMemo, useState } from "react";
import type { ChatMode, Lorebook, Persona } from "@marinara-engine/shared";
import { BookOpen, Check, Loader2, MessageCircle, Search, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { useCreateChatDraft } from "../../hooks/use-create-chat-draft";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { ChatModeSelector } from "../chat/ChatModeSelectorModal";
import { Modal } from "../ui/Modal";

interface ComposeLibraryChatModalProps {
  open: boolean;
  onClose: () => void;
  characterIds: string[];
}

type CharacterRow = { id: string; data: string; avatarPath: string | null };

function getCharacterName(character: CharacterRow) {
  try {
    const data = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
    return typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "Unnamed";
  } catch {
    return "Unnamed";
  }
}

function buildChatName(names: string[], modeLabel: string) {
  const suffix = ` - ${modeLabel}`;
  const participants = names.join(", ");
  if (!participants) return `New ${modeLabel}`;
  if (participants.length + suffix.length <= 200) return `${participants}${suffix}`;
  return `${participants.slice(0, Math.max(1, 197 - suffix.length)).trimEnd()}...${suffix}`;
}

export function ComposeLibraryChatModal({ open, onClose, characterIds }: ComposeLibraryChatModalProps) {
  const { t } = useTranslation();
  const closeAllDetails = useUIStore((state) => state.closeAllDetails);
  const closeRightPanel = useUIStore((state) => state.closeRightPanel);
  const { data: rawCharacters, isLoading: charactersLoading } = useCharacters(open);
  const { data: rawPersonas, isLoading: personasLoading } = usePersonas(open);
  const { data: rawLorebooks, isLoading: lorebooksLoading } = useLorebooks();
  const { createChatDraft, isCreatingChatDraft } = useCreateChatDraft();
  const [mode, setMode] = useState<ChatMode>("roleplay");
  const [personaId, setPersonaId] = useState("");
  const [lorebookIds, setLorebookIds] = useState<Set<string>>(new Set());
  const [lorebookSearch, setLorebookSearch] = useState("");

  const characters = useMemo(() => {
    const selected = new Set(characterIds);
    return ((rawCharacters ?? []) as CharacterRow[]).filter((character) => selected.has(character.id));
  }, [characterIds, rawCharacters]);
  const personas = useMemo(() => (rawPersonas ?? []) as Persona[], [rawPersonas]);
  const lorebooks = useMemo(() => (rawLorebooks ?? []) as Lorebook[], [rawLorebooks]);
  const filteredLorebooks = useMemo(() => {
    const query = lorebookSearch.trim().toLocaleLowerCase();
    return query ? lorebooks.filter((lorebook) => lorebook.name.toLocaleLowerCase().includes(query)) : lorebooks;
  }, [lorebookSearch, lorebooks]);

  useEffect(() => {
    if (!open || personaId) return;
    const activePersona = personas.find((persona) => persona.isActive);
    if (activePersona) setPersonaId(activePersona.id);
  }, [open, personaId, personas]);

  const toggleLorebook = (id: string) => {
    setLorebookIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (characterIds.length < 2 || isCreatingChatDraft) return;
    try {
      const result = await createChatDraft({
        name: buildChatName(characters.map(getCharacterName), t(`settings.modes.${mode}`)),
        mode,
        characterIds,
        personaId: personaId || null,
        lorebookIds: [...lorebookIds],
      });
      if (!result.lorebooksAttached) toast.warning(t("ui.characters.composechat.lorebooksNotAttached"));
      closeAllDetails();
      if (typeof window !== "undefined" && window.innerWidth < 768) closeRightPanel();
      onClose();
    } catch {
      // useCreateChat reports creation errors. Keep this draft open for retry.
    }
  };

  const loading = charactersLoading || personasLoading || lorebooksLoading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={isCreatingChatDraft}
      title={t("ui.characters.composechat.title")}
      width="max-w-5xl"
      mobileFullscreen
      panelClassName="sm:h-[min(90dvh,52rem)]"
      contentClassName="flex flex-col p-0"
    >
      <div data-component="ComposeLibraryChatModal" className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="mx-auto max-w-4xl space-y-6">
            <section aria-labelledby="compose-participants-title">
              <div className="flex items-center justify-between gap-3">
                <h3 id="compose-participants-title" className="text-sm font-semibold text-[var(--foreground)]">
                  {t("ui.characters.composechat.participants")}
                </h3>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("ui.characters.composechat.characterCount", { count: characterIds.length })}
                </span>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {characters.map((character) => (
                  <div
                    key={character.id}
                    className="flex min-w-36 max-w-52 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/55 p-2"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--muted)]">
                      {character.avatarPath ? (
                        <img src={character.avatarPath} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
                          <User size="1rem" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <span className="min-w-0 truncate text-xs font-semibold text-[var(--foreground)]">
                      {getCharacterName(character)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="compose-mode-title">
              <h3 id="compose-mode-title" className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                {t("ui.characters.composechat.mode")}
              </h3>
              <ChatModeSelector value={mode} onSelectMode={setMode} disabled={isCreatingChatDraft} />
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <section aria-labelledby="compose-persona-title">
                <label
                  id="compose-persona-title"
                  htmlFor="compose-chat-persona"
                  className="mb-2 block text-sm font-semibold text-[var(--foreground)]"
                >
                  {t("ui.characters.composechat.persona")}
                </label>
                <select
                  id="compose-chat-persona"
                  value={personaId}
                  onChange={(event) => setPersonaId(event.target.value)}
                  disabled={isCreatingChatDraft}
                  className="mari-chrome-field min-h-11 w-full text-sm"
                >
                  <option value="">{t("ui.characters.composechat.noPersona")}</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name}
                    </option>
                  ))}
                </select>
              </section>

              <section aria-labelledby="compose-lorebooks-title">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 id="compose-lorebooks-title" className="text-sm font-semibold text-[var(--foreground)]">
                    {t("ui.characters.composechat.lorebooks")}
                  </h3>
                  <span role="status" className="text-xs text-[var(--muted-foreground)]">
                    {t("ui.characters.composechat.lorebookCount", { count: lorebookIds.size })}
                  </span>
                </div>
                <div className="relative">
                  <Search
                    size="0.875rem"
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  />
                  <input
                    type="search"
                    value={lorebookSearch}
                    onChange={(event) => setLorebookSearch(event.target.value)}
                    placeholder={t("ui.characters.composechat.searchLorebooks")}
                    aria-label={t("ui.characters.composechat.searchLorebooks")}
                    disabled={isCreatingChatDraft}
                    className="mari-chrome-field min-h-11 w-full pl-9 text-sm"
                  />
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] p-1">
                  {filteredLorebooks.length === 0 ? (
                    <p className="px-3 py-5 text-center text-xs text-[var(--muted-foreground)]">
                      {t("ui.characters.composechat.noLorebooks")}
                    </p>
                  ) : (
                    filteredLorebooks.map((lorebook) => {
                      const selected = lorebookIds.has(lorebook.id);
                      return (
                        <label
                          key={lorebook.id}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-[var(--secondary)]",
                            selected && "bg-[var(--primary)]/10",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleLorebook(lorebook.id)}
                            disabled={isCreatingChatDraft}
                            className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                          />
                          <BookOpen
                            size="0.875rem"
                            aria-hidden="true"
                            className="shrink-0 text-[var(--muted-foreground)]"
                          />
                          <span className="min-w-0 flex-1 truncate">{lorebook.name}</span>
                          {selected && <Check size="0.875rem" aria-hidden="true" className="text-[var(--primary)]" />}
                        </label>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            {loading && (
              <div
                role="status"
                className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--muted-foreground)]"
              >
                <Loader2 size="0.875rem" className="animate-spin" aria-hidden="true" />
                {t("ui.characters.composechat.loading")}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreatingChatDraft}
              className="mari-chrome-control min-h-11 px-5 text-sm"
            >
              {t("ui.characters.composechat.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={characterIds.length < 2 || loading || isCreatingChatDraft}
              className="mari-chrome-control mari-chrome-control--primary min-h-11 px-5 text-sm disabled:cursor-wait disabled:opacity-60"
            >
              {isCreatingChatDraft ? (
                <Loader2 size="0.875rem" className="animate-spin" aria-hidden="true" />
              ) : (
                <MessageCircle size="0.875rem" aria-hidden="true" />
              )}
              {isCreatingChatDraft ? t("ui.characters.composechat.creating") : t("ui.characters.composechat.create")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

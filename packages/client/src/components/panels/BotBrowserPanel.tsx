// ──────────────────────────────────────────────
// Panel: Browser (sidebar — shows imported characters)
// ──────────────────────────────────────────────
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useCharacters, useDeleteCharacter } from "../../hooks/use-characters";
import { useStartChatFromCharacter } from "../../hooks/use-start-chat-from-character";
import { useUIStore } from "../../stores/ui.store";
import { Search, User, Globe, Wand2, MessageCircle, Trash2 } from "lucide-react";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { showConfirmDialog } from "../../lib/app-dialogs";

type CharacterRow = { id: string; data: string; avatarPath: string | null; createdAt: string; updatedAt: string };

export function BotBrowserPanel() {
  const { data: characters, isLoading } = useCharacters();
  const deleteCharacter = useDeleteCharacter();
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);
  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const closeCharacterDetail = useUIStore((s) => s.closeCharacterDetail);
  const openBotBrowser = useUIStore((s) => s.openBotBrowser);
  const botBrowserOpen = useUIStore((s) => s.botBrowserOpen);
  const { startChatFromCharacter } = useStartChatFromCharacter();
  const [search, setSearch] = useState("");
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    charId: string;
    charName: string;
    firstMes?: string;
    altGreetings?: string[];
  } | null>(null);

  const parsed = useMemo(() => {
    if (!characters) return [];
    return (characters as CharacterRow[]).reduce<
      { id: string; name: string; avatarPath: string | null; createdAt: string }[]
    >((acc, c) => {
      const d = JSON.parse(c.data);
      if (d.extensions?.botBrowserSource) {
        acc.push({ id: c.id, name: d.name ?? "Unnamed", avatarPath: c.avatarPath, createdAt: c.createdAt });
      }
      return acc;
    }, []);
  }, [characters]);

  const filtered = useMemo(() => {
    if (!search) return parsed;
    const q = search.toLowerCase();
    return parsed.filter((c) => c.name.toLowerCase().includes(q));
  }, [parsed, search]);

  const getCharacterGreeting = useCallback(
    (charId: string): { firstMes?: string; altGreetings: string[] } => {
      const raw = (characters as CharacterRow[] | undefined)?.find((c) => c.id === charId);
      if (!raw) return { altGreetings: [] };
      try {
        const d = JSON.parse(raw.data) as { first_mes?: string; alternate_greetings?: string[] };
        return { firstMes: d.first_mes, altGreetings: d.alternate_greetings ?? [] };
      } catch {
        return { altGreetings: [] };
      }
    },
    [characters],
  );

  const handleDeleteCharacter = useCallback(
    async (character: { id: string; name: string }) => {
      const confirmed = await showConfirmDialog({
        title: "Delete Imported Character",
        message: `Delete "${character.name}" from your imported characters? This cannot be undone.`,
        confirmLabel: "Delete",
        tone: "destructive",
      });
      if (!confirmed) return;

      setDeletingCharacterId(character.id);
      try {
        await deleteCharacter.mutateAsync(character.id);
        if (characterDetailId === character.id) closeCharacterDetail();
        toast.success(`Deleted "${character.name}".`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete character.");
      } finally {
        setDeletingCharacterId(null);
      }
    },
    [characterDetailId, closeCharacterDetail, deleteCharacter],
  );

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Browse online button */}
      <button
        onClick={openBotBrowser}
        className={cn(
          "mari-chrome-control mari-chrome-control--primary w-full text-xs",
          botBrowserOpen && "mari-chrome-control--selected",
        )}
      >
        <Globe size="0.875rem" />
        Browse Online
      </button>

      {/* Search */}
      <div className="relative">
        <Search
          size="0.8125rem"
          className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search imported..."
          className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
        />
      </div>

      {/* Character list */}
      {isLoading ? (
        <div className="py-4 text-center text-xs text-[var(--muted-foreground)]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-4 text-center text-xs text-[var(--muted-foreground)]">
          {search ? "No matches" : "No imported characters yet"}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {filtered.map((char) => (
            <div
              key={char.id}
              onContextMenu={(e) => {
                e.preventDefault();
                const greeting = getCharacterGreeting(char.id);
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  charId: char.id,
                  charName: char.name,
                  firstMes: greeting.firstMes,
                  altGreetings: greeting.altGreetings,
                });
              }}
              className="group flex items-center gap-1 rounded-xl transition-all hover:bg-[var(--sidebar-accent)]"
            >
              <button
                type="button"
                onClick={() => openCharacterDetail(char.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-2 text-left"
              >
                <div className="mari-panel-gradient-surface mari-panel-gradient--browser relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm">
                  {char.avatarPath ? (
                    <img
                      src={char.avatarPath}
                      alt={char.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      style={getAvatarCropStyle()}
                    />
                  ) : (
                    <User size="0.875rem" />
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{char.name}</span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleDeleteCharacter(char);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                disabled={deletingCharacterId !== null}
                className="mari-chrome-control mari-chrome-control--small mari-chrome-control--danger mr-1 h-8 w-8 shrink-0 p-0 text-[var(--destructive)] disabled:cursor-wait disabled:opacity-50"
                title={`Delete ${char.name}`}
                aria-label={`Delete ${char.name}`}
              >
                <Trash2 size="0.75rem" />
              </button>
            </div>
          ))}
        </div>
      )}

      {contextMenu &&
        (() => {
          const items: ContextMenuItem[] = [
            {
              label: "Quick Start Roleplay",
              icon: <Wand2 size="0.75rem" />,
              onSelect: () =>
                startChatFromCharacter({
                  characterId: contextMenu.charId,
                  characterName: contextMenu.charName,
                  mode: "roleplay",
                  firstMessage: contextMenu.firstMes,
                  alternateGreetings: contextMenu.altGreetings,
                }),
            },
            {
              label: "Quick Start Conversation",
              icon: <MessageCircle size="0.75rem" />,
              onSelect: () =>
                startChatFromCharacter({
                  characterId: contextMenu.charId,
                  characterName: contextMenu.charName,
                  mode: "conversation",
                }),
            },
          ];
          return <ContextMenu x={contextMenu.x} y={contextMenu.y} items={items} onClose={() => setContextMenu(null)} />;
        })()}
    </div>
  );
}

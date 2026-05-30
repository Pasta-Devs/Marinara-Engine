// ──────────────────────────────────────────────
// Panel: Browser (sidebar — shows imported characters)
// ──────────────────────────────────────────────
import { useState, useMemo, useCallback } from "react";
import { characterAvatarUrl, useCharacterSummaries } from "../../../catalog/characters/index";
import { useStartChatFromCharacter } from "../../../catalog/characters/index";
import { storageApi } from "../../../../shared/api/storage-api";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { Search, User, Globe, Wand2, MessageCircle } from "lucide-react";
import { cn, getAvatarCropStyle } from "../../../../shared/lib/utils";
import { ContextMenu, type ContextMenuItem } from "../../../../shared/components/ui/ContextMenu";
import { toast } from "sonner";

type CharacterData = Record<string, unknown> & {
  name?: string;
  first_mes?: string;
  alternate_greetings?: unknown;
  extensions?: Record<string, unknown>;
};

type CharacterRow = {
  id: string;
  data: unknown;
  avatarPath?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function parseCharacterData(data: unknown): CharacterData | null {
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as CharacterData) : null;
    } catch {
      return null;
    }
  }
  return data && typeof data === "object" && !Array.isArray(data) ? (data as CharacterData) : null;
}

export function BotBrowserPanel() {
  const { data: characters, isLoading } = useCharacterSummaries();
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);
  const openBotBrowser = useUIStore((s) => s.openBotBrowser);
  const botBrowserOpen = useUIStore((s) => s.botBrowserOpen);
  const { startChatFromCharacter } = useStartChatFromCharacter();
  const [search, setSearch] = useState("");
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
      const d = parseCharacterData(c.data);
      if (!d) return acc;
      if (d.extensions?.botBrowserSource) {
        acc.push({
          id: c.id,
          name: d.name ?? "Unnamed",
          avatarPath: characterAvatarUrl(c),
          createdAt: c.createdAt ?? "",
        });
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
    async (charId: string): Promise<{ firstMes?: string; altGreetings: string[] }> => {
      const raw = await storageApi.get<CharacterRow>("characters", charId, {
        fields: ["id", "data"],
        fieldSelections: { data: ["first_mes", "alternate_greetings"] },
      });
      if (!raw) return { altGreetings: [] };
      const d = parseCharacterData(raw.data);
      if (!d) return { altGreetings: [] };
      return {
        firstMes: d.first_mes,
        altGreetings: Array.isArray(d.alternate_greetings)
          ? d.alternate_greetings.filter((g): g is string => typeof g === "string")
          : [],
      };
    },
    [],
  );

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Browse online button */}
      <button
        onClick={openBotBrowser}
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-all",
          botBrowserOpen
            ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
            : "bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--accent)]",
        )}
      >
        <Globe size="0.875rem" />
        Browse Online
      </button>

      {/* Search */}
      <div className="relative">
        <Search size="0.75rem" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search imported..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] py-1.5 pl-7 pr-3 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none transition-colors focus:border-[var(--primary)]"
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
            <button
              key={char.id}
              onClick={() => openCharacterDetail(char.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                const x = e.clientX;
                const y = e.clientY;
                void getCharacterGreeting(char.id)
                  .then((greeting) => {
                    setContextMenu({
                      x,
                      y,
                      charId: char.id,
                      charName: char.name,
                      firstMes: greeting.firstMes,
                      altGreetings: greeting.altGreetings,
                    });
                  })
                  .catch(() => {
                    toast.error("Could not load character greetings.");
                    setContextMenu({
                      x,
                      y,
                      charId: char.id,
                      charName: char.name,
                      altGreetings: [],
                    });
                  });
              }}
              className="group flex items-center gap-2.5 rounded-xl p-2 text-left transition-all hover:bg-[var(--sidebar-accent)]"
            >
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-sm overflow-hidden">
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

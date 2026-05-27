import { useCallback, useState, type ReactNode } from "react";
import { BookOpen, HelpCircle, MessageSquare, Theater } from "lucide-react";
import { APP_VERSION } from "../../../../engine/contracts/constants/defaults";
import { useConnections } from "../../../catalog/connections/index";
import { useCreateChat } from "../../../catalog/chats/index";
import { NewChatConnectionGate } from "../../shared/chat-ui/index";
import { filterLanguageGenerationConnections } from "../../../../shared/lib/connection-filters";
import { cn } from "../../../../shared/lib/utils";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { HomeFaq } from "./HomeFaq";
import { RecentChats } from "./RecentChats";

type QuickStartMode = "conversation" | "roleplay" | "game";

export function ModeHomeSurface() {
  const { data: connections } = useConnections();
  const createChat = useCreateChat();
  const pendingNewChatMode = useChatStore((state) => state.pendingNewChatMode);

  const handleQuickStart = useCallback(
    (mode: QuickStartMode) => {
      const connectionRows = filterLanguageGenerationConnections(
        (connections ?? []) as Array<{ id: string; provider?: string }>,
      ).filter((connection) => !!connection.id);
      if (connectionRows.length === 0) {
        useChatStore.getState().setPendingNewChatMode(mode);
        return;
      }

      const label = mode === "conversation" ? "Conversation" : mode === "game" ? "Game" : "Roleplay";
      createChat.mutate(
        { name: `New ${label}`, mode, characterIds: [] },
        {
          onSuccess: (chat) => {
            useChatStore.getState().setActiveChatId(chat.id);
            useChatStore.getState().setShouldOpenSettings(true, chat.id);
            useChatStore.getState().setShouldOpenWizard(true, chat.id);
          },
        },
      );
    },
    [connections, createChat],
  );

  const showEmptyStateEffects = true;

  return (
    <>
      <div
        data-component="ChatArea.EmptyState"
        className="flex flex-1 flex-col items-center overflow-y-auto p-3 sm:p-5 lg:p-6"
      >
        <div className="flex w-full max-w-2xl flex-col items-center gap-3 py-2 sm:gap-4 sm:py-3 lg:pt-4 lg:pb-5">
          <div className="relative">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-xl shadow-orange-500/20 sm:h-20 sm:w-20",
                showEmptyStateEffects && "animate-pulse-ring bunny-glow",
              )}
            >
              <img
                src={showEmptyStateEffects ? "/logo-splash.gif" : "/logo.png"}
                alt="Marinara Engine"
                width={80}
                height={80}
                decoding="async"
                className={cn(
                  "h-full w-full",
                  showEmptyStateEffects ? "object-cover" : "object-contain p-1.5 sm:p-2",
                )}
              />
            </div>
          </div>

          <div className="text-center">
            <h3 className="retro-glow-text text-base sm:text-xl font-bold tracking-tight">✧ Marinara Engine ✧</h3>
            <p className="mt-1.5 sm:mt-2 max-w-xs text-xs sm:text-sm text-[var(--muted-foreground)]">
              To get started, choose the type of chat you'd like to have with the AI
            </p>
          </div>

          <div className={cn("flex flex-wrap justify-center gap-2 sm:gap-3", showEmptyStateEffects && "stagger-children")}>
            <QuickStartCard
              icon={<MessageSquare size="1.125rem" />}
              label="Conversation"
              bg="linear-gradient(135deg, #4de5dd, #3ab8b1)"
              shadowColor="rgba(77,229,221,0.15)"
              tooltip="General chat with one or more characters, or a model itself"
              onClick={() => handleQuickStart("conversation")}
            />
            <QuickStartCard
              icon={<BookOpen size="1.125rem" />}
              label="Roleplay"
              bg="linear-gradient(135deg, #eb8951, #d97530)"
              shadowColor="rgba(235,137,81,0.15)"
              tooltip="For roleplaying or creative writing with one or more characters"
              onClick={() => handleQuickStart("roleplay")}
            />
            <QuickStartCard
              icon={<Theater size="1.125rem" />}
              label="Game"
              bg="linear-gradient(135deg, #e15c8c, #c94776)"
              shadowColor="rgba(225,92,140,0.15)"
              tooltip="AI-managed singleplayer RPG with a Game Master, party, dice, maps, and quests"
              onClick={() => handleQuickStart("game")}
            />
          </div>

          <RecentChats />
          <HomeFaq />

          <div className={cn("w-48", showEmptyStateEffects ? "retro-divider" : "h-px rounded-[1px] bg-[var(--border)]/40")} />

          <div className="flex w-full max-w-2xl flex-col items-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center text-[0.625rem] leading-tight text-[var(--muted-foreground)]/55 sm:text-xs">
              <span>
                Created by{" "}
                <a
                  href="https://spicymarinara.github.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-[var(--muted-foreground)]/30 transition-colors hover:text-[var(--primary)] hover:decoration-[var(--primary)]/40"
                >
                  Marinara
                </a>
              </span>
              <span>
                Partnered with{" "}
                <a
                  href="https://linkapi.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-[var(--muted-foreground)]/30 transition-colors hover:text-[var(--primary)] hover:decoration-[var(--primary)]/40"
                >
                  LinkAPI
                </a>
              </span>
              <span>
                Art and logo by{" "}
                <a
                  href="https://huntercolliex.carrd.co/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-[var(--muted-foreground)]/30 transition-colors hover:text-[var(--primary)] hover:decoration-[var(--primary)]/40"
                >
                  Huntercolliex
                </a>
              </span>
            </div>
            <div className="flex gap-2">
              <a
                href="https://discord.com/invite/KdAkTg94ME"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <svg width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
                </svg>
                Discord
              </a>
              <a
                href="https://ko-fi.com/marinara_spaghetti"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <svg width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                Support
              </a>
            </div>

            <p className="max-w-[42rem] px-1 text-center text-[0.625rem] leading-snug text-[var(--muted-foreground)]/40 sm:max-w-[46rem]">
              Special thanks to Deci, Xel, Jorge, Cha1latte, Javedz678, Teuku, Shadota, Romu, Mm14141, MagicGoddess, John,
              Pwildani, Romu, Felor, MuniMuni, Guybrush01, Joshellis625, LukaTheHero, Coxde, JorgeLTE, Seele The Seal
              King, Loungemeister, Kale, Tabris, GREGOR OVECH, Coins, Tacoman, Jorge, Promansis, Kitsumiro, Sheep,
              Pod042, Prolix, PlutoMayhem, Mezzeh, Kuc0, Exalted, Yang Best Girl, MidnightSleeper, Geechan,
              TheLonelyDevil, Artus, and you!
            </p>

            <button
              onClick={() => useUIStore.getState().setHasCompletedOnboarding(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)]/40 transition-colors hover:bg-[var(--secondary)]/60 hover:text-[var(--muted-foreground)]"
              title="Replay tutorial"
            >
              <HelpCircle size="0.75rem" />
              Replay Tutorial
            </button>

            <p className="text-[0.625rem] tracking-wide text-[var(--muted-foreground)]/30">v{APP_VERSION}</p>
          </div>
        </div>
      </div>
      {pendingNewChatMode && (
        <NewChatConnectionGate mode={pendingNewChatMode} onClose={() => useChatStore.getState().setPendingNewChatMode(null)} />
      )}
    </>
  );
}

function QuickStartCard({
  icon,
  label,
  bg,
  shadowColor,
  onClick,
  comingSoon,
  tooltip,
}: {
  icon: ReactNode;
  label: string;
  bg: string;
  shadowColor?: string;
  onClick?: () => void;
  comingSoon?: boolean;
  tooltip?: string;
}) {
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleClick = () => {
    if (comingSoon && !onClick) {
      setShowComingSoon(true);
      setTimeout(() => setShowComingSoon(false), 1500);
      return;
    }
    onClick?.();
  };

  return (
    <div
      onClick={handleClick}
      title={tooltip}
      className={cn(
        "group card-3d-tilt btn-scanlines relative flex w-20 sm:w-28 flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-2.5 sm:p-4 text-center transition-all",
        "cursor-pointer hover:-translate-y-1 hover:border-[var(--primary)]/40 hover:shadow-lg",
      )}
      style={shadowColor ? { ["--tw-shadow-color" as string]: shadowColor } : undefined}
    >
      {showComingSoon && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] shadow-md animate-fade-in-up">
          Coming Soon
        </span>
      )}
      <div
        className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-110"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <span className="text-[0.625rem] sm:text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

// ──────────────────────────────────────────────
// Noodle: shared shell (left nav, mobile drawer, right rail slot, bottom nav)
// Used by both the public NoodleHome timeline and the private NoodlerHome hub
// so every Noodle surface keeps the same primary navigation.
// ──────────────────────────────────────────────
import { AtSign, Bell, Home, MoreHorizontal, Pencil, Search, Settings2, User, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type CSSProperties, type ReactNode, type RefObject, useRef } from "react";
import type { NoodleAccount } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";

export const NOODLE_BLUE = "#7EA7FF";
export const NOODLE_ICON_SCOPE_CLASS = "[&_svg]:!text-[var(--noodle-blue)]";
export const NOODLE_LOGO_SRC = "/noodle-klusek.png";
export const NOODLE_PERSONA_SWITCHER_PAGE_SIZE = 5;

const labelClass = "text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--marinara-chat-chrome-panel-muted)]";

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "N"
  );
}

export function NoodleLogo({ className }: { className?: string }) {
  return <img src={NOODLE_LOGO_SRC} alt="" className={cn("object-contain", className)} />;
}

export function Avatar({
  account,
  size = "md",
}: {
  account: Pick<NoodleAccount, "displayName" | "avatarUrl"> & { avatarCrop?: AvatarCropValue | null };
  size?: "sm" | "md" | "lg";
}) {
  const dimension = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-24 w-24" : "h-11 w-11";
  if (account.avatarUrl) {
    return (
      <div
        className={cn(
          dimension,
          "relative aspect-square flex-none overflow-hidden rounded-full border border-[var(--noodle-blue)]/30",
        )}
      >
        <img
          src={account.avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          style={getAvatarCropStyle(account.avatarCrop)}
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        dimension,
        "flex aspect-square flex-none items-center justify-center rounded-full bg-[var(--noodle-blue)]/15 text-xs font-bold text-[var(--noodle-blue)] ring-1 ring-[var(--noodle-blue)]/25",
      )}
    >
      {initials(account.displayName)}
    </div>
  );
}

export type NoodleShellView = "home" | "search" | "notifications" | "profile" | "settings" | null;

export interface NoodleShellProps {
  activeView: NoodleShellView;
  personaAccount: NoodleAccount | null;
  sortedPersonaAccounts: NoodleAccount[];
  visiblePersonaAccounts: NoodleAccount[];
  onLoadMorePersonaAccounts: () => void;
  onSwitchPersona: (account: NoodleAccount, mobile: boolean) => void;
  accountSwitcherOpen: boolean;
  onAccountSwitcherOpenChange: (open: boolean) => void;
  accountSwitcherRef: RefObject<HTMLDivElement | null>;
  mobileDrawerOpen: boolean;
  onMobileDrawerOpenChange: (open: boolean) => void;
  mobileAccountSwitcherOpen: boolean;
  onMobileAccountSwitcherOpenChange: (open: boolean) => void;
  notificationCount: number;
  onOpenHome: () => void;
  /** Mobile bottom-nav "Home" tap — distinct from onOpenHome because it also clears any active post search. */
  onOpenMobileHome: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onCompose: (opener: HTMLElement) => void;
  /** Optional right-hand rail (search box, suggestions, etc). Omitted entirely on surfaces that don't need one. */
  rightRail?: ReactNode;
  /** Theme-dependent overlays (browser chrome strip, lightboxes, modals) that must render inside the token scope. */
  overlays?: ReactNode;
  children: ReactNode;
}

export function NoodleShell({
  activeView,
  personaAccount,
  sortedPersonaAccounts,
  visiblePersonaAccounts,
  onLoadMorePersonaAccounts,
  onSwitchPersona,
  accountSwitcherOpen,
  onAccountSwitcherOpenChange,
  accountSwitcherRef,
  mobileDrawerOpen,
  onMobileDrawerOpenChange,
  mobileAccountSwitcherOpen,
  onMobileAccountSwitcherOpenChange,
  notificationCount,
  onOpenHome,
  onOpenMobileHome,
  onOpenSearch,
  onOpenNotifications,
  onOpenProfile,
  onOpenSettings,
  onCompose,
  rightRail,
  overlays,
  children,
}: NoodleShellProps) {
  const mobileDrawerRef = useRef<HTMLElement | null>(null);
  const mobileDrawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const hasMorePersonaAccounts = visiblePersonaAccounts.length < sortedPersonaAccounts.length;
  const notificationBadgeLabel = notificationCount > 99 ? "99+" : String(notificationCount);
  useDialogFocusScope(mobileDrawerOpen, mobileDrawerRef, mobileDrawerCloseRef);

  return (
    <div
      className={cn(
        "mari-chrome-token-scope relative flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]",
        NOODLE_ICON_SCOPE_CLASS,
      )}
      data-component="NoodleView"
      style={
        {
          "--noodle-blue": NOODLE_BLUE,
          "--noodle-divider": "var(--marinara-chat-chrome-panel-divider)",
        } as CSSProperties
      }
    >
      {overlays}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { x: "-100%" }}
            animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: "-100%" }}
            transition={prefersReducedMotion ? { duration: 0.1 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-[80] h-full w-full bg-[var(--background)] lg:hidden"
            data-component="NoodleView.MobileDrawer"
            data-motion="slide-x"
          >
            <aside
              ref={mobileDrawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Noodle account menu"
              tabIndex={-1}
              className={cn(
                "mari-chrome-token-scope flex h-full w-full flex-col overflow-y-auto bg-[var(--background)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 text-[var(--foreground)]",
                NOODLE_ICON_SCOPE_CLASS,
              )}
              style={
                {
                  "--noodle-blue": NOODLE_BLUE,
                  "--noodle-divider": "var(--marinara-chat-chrome-panel-divider)",
                } as CSSProperties
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {personaAccount ? (
                    <Avatar account={personaAccount} />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--noodle-blue)]/15 ring-1 ring-[var(--noodle-blue)]/25">
                      <AtSign size={24} className="text-[var(--noodle-blue)]" />
                    </span>
                  )}
                  <p className="mt-3 truncate text-lg font-bold">{personaAccount?.displayName ?? "Noodle Account"}</p>
                  <p className="truncate text-sm text-[var(--muted-foreground)]">
                    {personaAccount ? `@${personaAccount.handle}` : "Pick a persona below"}
                  </p>
                </div>
                <button
                  ref={mobileDrawerCloseRef}
                  type="button"
                  onClick={() => onMobileDrawerOpenChange(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--noodle-blue)] transition-colors hover:bg-[var(--noodle-blue)]/10"
                  title="Close"
                  aria-label="Close Noodle account menu"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="mt-7 space-y-1" aria-label="Noodle account navigation">
                <button
                  type="button"
                  onClick={onOpenHome}
                  className="flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)]"
                >
                  <Home size={23} />
                  Home
                </button>
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)]"
                >
                  <User size={23} />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)]"
                >
                  <Settings2 size={23} />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={(event) => onCompose(event.currentTarget)}
                  className="flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)]"
                >
                  <Pencil size={23} />
                  Post
                </button>
              </nav>

              <div className="relative mt-auto border-t border-[var(--noodle-divider)] pt-3">
                {mobileAccountSwitcherOpen && (
                  <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 max-h-64 overflow-y-auto rounded-2xl border border-[var(--noodle-divider)] bg-[var(--background)] p-2 shadow-2xl shadow-black/35">
                    <p className={cn(labelClass, "px-2 pb-2")}>Switch account</p>
                    {sortedPersonaAccounts.length > 0 ? (
                      <div className="space-y-1">
                        {sortedPersonaAccounts.map((account) => {
                          const selected = account.id === personaAccount?.id;
                          return (
                            <button
                              key={account.id}
                              data-noodle-persona-id={account.entityId}
                              type="button"
                              onClick={() => onSwitchPersona(account, true)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                                selected && "bg-[var(--noodle-blue)]/10",
                              )}
                            >
                              <Avatar account={account} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{account.displayName}</span>
                                <span className="block truncate text-xs text-[var(--muted-foreground)]">
                                  @{account.handle}
                                </span>
                              </span>
                              {selected && <span className="h-2 w-2 rounded-full bg-[var(--noodle-blue)]" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-2 py-3 text-xs text-[var(--muted-foreground)]">No persona accounts yet.</p>
                    )}
                  </div>
                )}
                <button
                  data-component="NoodleView.MobileAccountSwitcher"
                  type="button"
                  onClick={() => onMobileAccountSwitcherOpenChange(!mobileAccountSwitcherOpen)}
                  aria-expanded={mobileAccountSwitcherOpen}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-[var(--accent)]"
                >
                  {personaAccount ? (
                    <Avatar account={personaAccount} size="sm" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--noodle-blue)]/15">
                      <AtSign size={18} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">Switch account</span>
                    <span className="block truncate text-xs text-[var(--muted-foreground)]">
                      {personaAccount ? `@${personaAccount.handle}` : "Choose a persona"}
                    </span>
                  </span>
                  <MoreHorizontal size={19} />
                </button>
              </div>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
        <div className="flex min-h-0 w-full max-w-[1264px] justify-center">
          <aside className="hidden w-[17rem] shrink-0 border-r border-[var(--noodle-divider)] bg-[var(--background)] lg:flex lg:flex-col [&_svg]:!text-[var(--noodle-blue)]">
            <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
              <div className="mb-5 flex h-12 items-center">
                <NoodleLogo className="h-10 w-16" />
              </div>
              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={onOpenHome}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-4 rounded-full px-3 text-left text-[0.95rem] font-semibold hover:bg-[var(--accent)]",
                    activeView === "home" && "bg-[var(--noodle-blue)]/10",
                  )}
                >
                  <Home size={22} className="!text-[var(--noodle-blue)]" />
                  Home
                </button>
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-4 rounded-full px-3 text-left text-[0.95rem] font-semibold hover:bg-[var(--accent)]",
                    activeView === "notifications" && "bg-[var(--noodle-blue)]/10",
                  )}
                >
                  <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                    <Bell size={22} className="!text-[var(--noodle-blue)]" />
                    {notificationCount > 0 && (
                      <span
                        data-component="NoodleView.NotificationBadge"
                        className="absolute -right-2 -top-2 min-w-4 rounded-full bg-[var(--noodle-blue)] px-1 text-center text-[0.58rem] font-black leading-4 text-zinc-950 ring-2 ring-[var(--background)]"
                      >
                        {notificationBadgeLabel}
                      </span>
                    )}
                  </span>
                  Notifications
                </button>
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-4 rounded-full px-3 text-left text-[0.95rem] font-semibold hover:bg-[var(--accent)]",
                    activeView === "profile" && "bg-[var(--noodle-blue)]/10",
                  )}
                >
                  <User size={22} className="!text-[var(--noodle-blue)]" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-4 rounded-full px-3 text-left text-[0.95rem] font-semibold hover:bg-[var(--accent)]",
                    activeView === "settings" && "bg-[var(--noodle-blue)]/10",
                  )}
                >
                  <Settings2 size={22} className="!text-[var(--noodle-blue)]" />
                  Settings
                </button>
              </nav>
              <button
                type="button"
                onClick={(event) => onCompose(event.currentTarget)}
                className="mt-5 h-12 rounded-full bg-[var(--noodle-blue)] px-6 text-sm font-bold text-zinc-950 transition-opacity hover:opacity-90"
              >
                Post
              </button>
              <div ref={accountSwitcherRef} className="relative mt-auto">
                {accountSwitcherOpen && (
                  <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-30 overflow-hidden rounded-xl border border-[var(--noodle-divider)] bg-[var(--background)] p-2 shadow-2xl shadow-black/30">
                    <p className={cn(labelClass, "px-2 pb-2")}>Switch account</p>
                    {sortedPersonaAccounts.length > 0 ? (
                      <div className="max-h-72 space-y-1 overflow-y-auto">
                        {visiblePersonaAccounts.map((account) => {
                          const selected = account.id === personaAccount?.id;
                          return (
                            <button
                              key={account.id}
                              data-noodle-persona-id={account.entityId}
                              type="button"
                              onClick={() => onSwitchPersona(account, false)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                                selected && "bg-[var(--noodle-blue)]/10",
                              )}
                            >
                              <Avatar account={account} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold">{account.displayName}</span>
                                <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">
                                  @{account.handle}
                                </span>
                              </span>
                              {selected && <span className="h-2 w-2 rounded-full bg-[var(--noodle-blue)]" />}
                            </button>
                          );
                        })}
                        {hasMorePersonaAccounts && (
                          <button
                            type="button"
                            onClick={onLoadMorePersonaAccounts}
                            className="mt-1 h-9 w-full rounded-lg text-xs font-semibold text-[var(--noodle-blue)] transition-colors hover:bg-[var(--noodle-blue)]/10"
                          >
                            Load more ({visiblePersonaAccounts.length} of {sortedPersonaAccounts.length})
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="px-2 py-3 text-xs text-[var(--muted-foreground)]">No persona accounts yet.</p>
                    )}
                  </div>
                )}
                <button
                  data-component="NoodleView.AccountSwitcher"
                  type="button"
                  onClick={() => onAccountSwitcherOpenChange(!accountSwitcherOpen)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-full px-3 text-left transition-colors hover:bg-[var(--accent)]"
                  title="Switch account"
                >
                  {personaAccount ? (
                    <Avatar account={personaAccount} />
                  ) : (
                    <AtSign size={28} className="!text-[var(--noodle-blue)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{personaAccount?.displayName ?? "Noodle Account"}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {personaAccount ? `@${personaAccount.handle}` : "Pick a persona"}
                    </p>
                  </div>
                  <MoreHorizontal size={18} className="!text-[var(--noodle-blue)] opacity-70" />
                </button>
              </div>
            </div>
          </aside>

          <main className="flex min-h-0 w-full flex-1 flex-col lg:max-w-[640px]">{children}</main>
          {rightRail}
        </div>
      </div>

      <nav
        className="absolute inset-x-0 bottom-0 z-50 border-t border-[var(--noodle-divider)] bg-[var(--background)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Noodle mobile navigation"
        data-component="NoodleView.MobileBottomNav"
      >
        <div className="grid h-[52px] grid-cols-4">
          <button
            type="button"
            onClick={() => onMobileDrawerOpenChange(true)}
            aria-label="Open Noodle account menu"
            className="flex items-center justify-center transition-colors hover:bg-[var(--accent)]"
          >
            {personaAccount ? (
              <Avatar account={personaAccount} size="sm" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--noodle-blue)]/15 ring-1 ring-[var(--noodle-blue)]/25">
                <AtSign size={18} />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenMobileHome}
            aria-label="Noodle home"
            aria-current={activeView === "home" ? "page" : undefined}
            className="relative flex items-center justify-center transition-colors hover:bg-[var(--accent)]"
          >
            <Home size={22} strokeWidth={activeView === "home" ? 2.8 : 2} />
            {activeView === "home" && <span className="absolute top-1 h-1 w-1 rounded-full bg-[var(--noodle-blue)]" />}
          </button>
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search Noodle"
            aria-current={activeView === "search" ? "page" : undefined}
            className="relative flex items-center justify-center transition-colors hover:bg-[var(--accent)]"
          >
            <Search size={22} strokeWidth={activeView === "search" ? 2.8 : 2} />
            {activeView === "search" && <span className="absolute top-1 h-1 w-1 rounded-full bg-[var(--noodle-blue)]" />}
          </button>
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Noodle notifications"
            aria-current={activeView === "notifications" ? "page" : undefined}
            className="relative flex items-center justify-center transition-colors hover:bg-[var(--accent)]"
          >
            <span className="relative flex h-6 w-6 items-center justify-center">
              <Bell size={22} strokeWidth={activeView === "notifications" ? 2.8 : 2} />
              {notificationCount > 0 && (
                <span
                  data-component="NoodleView.NotificationBadge"
                  className="absolute -right-2 -top-2 min-w-4 rounded-full bg-[var(--noodle-blue)] px-1 text-center text-[0.58rem] font-black leading-4 text-zinc-950 ring-2 ring-[var(--background)]"
                >
                  {notificationBadgeLabel}
                </span>
              )}
            </span>
            {activeView === "notifications" && (
              <span className="absolute top-1 h-1 w-1 rounded-full bg-[var(--noodle-blue)]" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}

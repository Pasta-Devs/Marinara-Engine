import { ArrowLeft, Check, Loader2, Lock, UserRound } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { toast } from "sonner";
import { useNoodle, useNoodlerAccounts, useUpdateNoodleSettings } from "../../hooks/use-noodle";
import type { NoodleNavigationState } from "./noodle-navigation.types";

export type NoodlerNotificationItem = {
  id: string;
  createdAt: string;
  kind: "account-created";
  accountId: string;
};

interface NoodlerHomeProps {
  navigation: Extract<NoodleNavigationState, { mode: "private" | "verification" }>;
  onNavigate: (destination: NoodleNavigationState) => void;
}

export function NoodlerHome({ navigation, onNavigate }: NoodlerHomeProps) {
  const { data } = useNoodle();
  const updateSettings = useUpdateNoodleSettings();
  const enabled = data?.settings.enableNoodler === true;
  const accountsQuery = useNoodlerAccounts(navigation.mode === "private" && enabled);
  const notifications: NoodlerNotificationItem[] = [];

  const enableNoodler = () => {
    updateSettings.mutate(
      { enableNoodler: true },
      {
        onSuccess: () => onNavigate({ mode: "private", view: "hub" }),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Could not enable NoodleR."),
      },
    );
  };

  if (navigation.mode === "verification" || !enabled) {
    return (
      <NoodlerFrame onBack={() => onNavigate({ mode: "public", view: "home" })} title="About NoodleR">
        <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--noodle-blue)]/15 text-[var(--noodle-blue)]">
            <Lock size={28} />
          </span>
          <h2 className="mt-5 text-2xl font-black">NoodleR is an optional private space.</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
            NoodleR is intended for adults. Private creator accounts stay isolated from the public Noodle timeline.
            Enable access only if you are 18 or older and want to view the private account hub.
          </p>
          <p className="mt-4 rounded-lg border border-[var(--noodle-divider)] bg-[var(--noodle-blue)]/10 px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
            NoodleR is still being implemented and is not usable or finalized yet. Please do not submit bug reports or
            feature requests for NoodleR while it is in development.
          </p>
          <button
            type="button"
            onClick={enableNoodler}
            disabled={!data?.settings || updateSettings.isPending}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--noodle-blue)] px-6 text-sm font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateSettings.isPending ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
            {updateSettings.isPending ? "Enabling..." : "I am 18+ and want to enable NoodleR"}
          </button>
        </div>
      </NoodlerFrame>
    );
  }

  return (
    <NoodlerFrame onBack={() => onNavigate({ mode: "public", view: "home" })} title="NoodleR">
      <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
        <p className="text-xs text-[var(--muted-foreground)]">
          {notifications.length === 0 ? "Private account hub" : `${notifications.length} new notifications`}
        </p>
      </div>
      {accountsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--noodle-blue)]" />
        </div>
      ) : accountsQuery.isError ? (
        <div className="px-8 py-16 text-center">
          <p className="font-bold">Private accounts could not be loaded.</p>
          <button
            type="button"
            onClick={() => void accountsQuery.refetch()}
            className="mt-4 h-9 rounded-full border border-[var(--noodle-divider)] px-4 text-xs font-bold hover:bg-[var(--accent)]"
          >
            Try again
          </button>
        </div>
      ) : accountsQuery.data && accountsQuery.data.length > 0 ? (
        <div className="divide-y divide-[var(--noodle-divider)]">
          {accountsQuery.data.map((account) => (
            <article key={account.id} className="flex items-center gap-3 px-4 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-blue)]/15 font-bold text-[var(--noodle-blue)]">
                {Array.from(account.displayName)[0]?.toUpperCase() || <UserRound size={20} />}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold">{account.displayName}</h3>
                <p className="truncate text-xs text-[var(--muted-foreground)]">@{account.handle}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="px-8 py-16 text-center">
          <UserRound size={38} className="mx-auto text-[var(--noodle-blue)]" />
          <p className="mt-4 font-bold">No private creator accounts yet.</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            Private account creation and isolation are ready. Creator profile tools arrive in later NoodleR slices.
          </p>
        </div>
      )}
    </NoodlerFrame>
  );
}

function NoodlerFrame({
  children,
  onBack,
  title,
}: {
  children: ReactNode;
  onBack: () => void;
  title: string;
}) {
  return (
    <div
      className="mari-chrome-token-scope relative flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]"
      style={
        {
          "--noodle-blue": "#7EA7FF",
          "--noodle-divider": "var(--marinara-chat-chrome-panel-divider)",
        } as CSSProperties
      }
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--noodle-divider)] px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--noodle-blue)] hover:bg-[var(--noodle-blue)]/10"
          aria-label="Back to Noodle"
        >
          <ArrowLeft size={18} />
        </button>
        <p className="text-sm font-semibold">{title}</p>
        <span className="ml-auto rounded-full bg-[var(--noodle-blue)]/10 px-2.5 py-1 text-[0.65rem] font-bold text-[var(--noodle-blue)]">
          Private
        </span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

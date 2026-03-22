// ──────────────────────────────────────────────
// Panel: API Connections (polished)
// ──────────────────────────────────────────────
import {
  useConnections,
  useCreateConnection,
  useDuplicateConnection,
  useDeleteConnection,
  useTestConnection,
  useUpdateConnection,
} from "../../hooks/use-connections";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { Plus, Trash2, Link, CheckCircle, Loader2, Check, Shuffle, ExternalLink, X, Copy } from "lucide-react";
import { cn } from "../../lib/utils";

/** Provider → gradient color pair for connection icons. */
const PROVIDER_COLORS: Record<string, { from: string; to: string; ring: string; badge: string }> = {
  openai: { from: "from-emerald-400", to: "to-teal-500", ring: "ring-emerald-400/40", badge: "bg-emerald-400" },
  anthropic: { from: "from-orange-400", to: "to-amber-500", ring: "ring-orange-400/40", badge: "bg-orange-400" },
  google: { from: "from-blue-400", to: "to-indigo-500", ring: "ring-blue-400/40", badge: "bg-blue-400" },
  mistral: { from: "from-violet-400", to: "to-purple-500", ring: "ring-violet-400/40", badge: "bg-violet-400" },
  cohere: { from: "from-rose-400", to: "to-pink-500", ring: "ring-rose-400/40", badge: "bg-rose-400" },
  openrouter: { from: "from-sky-400", to: "to-cyan-500", ring: "ring-sky-400/40", badge: "bg-sky-400" },
  custom: { from: "from-gray-400", to: "to-slate-500", ring: "ring-gray-400/40", badge: "bg-gray-400" },
  image_generation: {
    from: "from-fuchsia-400",
    to: "to-pink-500",
    ring: "ring-fuchsia-400/40",
    badge: "bg-fuchsia-400",
  },
};
const DEFAULT_COLOR = { from: "from-sky-400", to: "to-blue-500", ring: "ring-sky-400/40", badge: "bg-sky-400" };

export function ConnectionsPanel() {
  const { data: connections, isLoading } = useConnections();
  const createConnection = useCreateConnection();
  const duplicateConnection = useDuplicateConnection();
  const deleteConnection = useDeleteConnection();
  const updateConnection = useUpdateConnection();
  const testConnection = useTestConnection();
  const activeChat = useChatStore((s) => s.activeChat);

  const activeConnectionId = activeChat?.connectionId ?? null;
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const linkApiBannerDismissed = useUIStore((s) => s.linkApiBannerDismissed);
  const dismissLinkApiBanner = useUIStore((s) => s.dismissLinkApiBanner);

  const handleCreate = () => {
    createConnection.mutate(
      { name: "New Connection", provider: "openai", apiKey: "" },
      {
        onSuccess: (data: any) => {
          if (data?.id) openConnectionDetail(data.id);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <button
        onClick={handleCreate}
        disabled={createConnection.isPending}
        className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all active:scale-[0.98] bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-md shadow-sky-400/15 hover:shadow-lg hover:shadow-sky-400/25 disabled:opacity-50"
      >
        {createConnection.isPending ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Plus size="0.8125rem" />}
        Add Connection
      </button>

      {isLoading && (
        <div className="flex flex-col gap-2 py-2">
          {[1, 2].map((i) => (
            <div key={i} className="shimmer h-14 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!connections || (connections as unknown[]).length === 0) && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400/20 to-blue-500/20">
            <Link size="1.25rem" className="text-sky-400" />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">No connections yet</p>
        </div>
      )}

      {/* LinkAPI recommendation banner */}
      {!isLoading && (!connections || (connections as unknown[]).length === 0) && !linkApiBannerDismissed && (
        <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/5 to-blue-500/5 p-3 flex flex-col gap-2">
          <p className="text-xs text-[var(--muted-foreground)]">
            Looking to try new models from a trusted provider? Consider checking out{" "}
            <a
              href="https://linkapi.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-400 underline decoration-sky-400/30 hover:text-sky-300 transition-colors"
            >
              LinkAPI
            </a>
            !
          </p>
          <div className="flex gap-2">
            <a
              href="https://linkapi.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-sky-400/15 px-3 py-1.5 text-xs font-medium text-sky-400 transition-all hover:bg-sky-400/25"
            >
              <ExternalLink size="0.75rem" />
              Visit LinkAPI
            </a>
            <button
              onClick={dismissLinkApiBanner}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-all hover:bg-[var(--secondary)]"
            >
              <X size="0.75rem" />
              Dismiss permanently
            </button>
          </div>
        </div>
      )}

      <div className="stagger-children flex flex-col gap-1">
        {(
          connections as Array<{ id: string; name: string; provider: string; model: string; useForRandom?: string }>
        )?.map((conn) => {
          const isSelected = activeConnectionId === conn.id;
          const inRandomPool = conn.useForRandom === "true";
          const colors = PROVIDER_COLORS[conn.provider] ?? DEFAULT_COLOR;
          return (
            <div
              key={conn.id}
              onClick={() => openConnectionDetail(conn.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
                isSelected && `ring-1 ${colors.ring} bg-[var(--sidebar-accent)]/50`,
              )}
            >
              <div
                className={cn(
                  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                  colors.from,
                  colors.to,
                )}
              >
                <Link size="1rem" />
                {isSelected && (
                  <div
                    className={cn(
                      "absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full shadow-sm",
                      colors.badge,
                    )}
                  >
                    <Check size="0.625rem" className="text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{conn.name}</div>
                <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                  {conn.provider} • {conn.model || "No model set"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateConnection.mutate({ id: conn.id, useForRandom: !inRandomPool });
                  }}
                  className={cn(
                    "rounded-lg p-1.5 transition-all active:scale-90",
                    inRandomPool
                      ? "bg-amber-400/15 text-amber-400"
                      : "text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 hover:bg-amber-400/10 hover:text-amber-400",
                  )}
                  title={inRandomPool ? "In random pool (click to remove)" : "Add to random pool"}
                >
                  <Shuffle size="0.8125rem" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    testConnection.mutate(conn.id);
                  }}
                  className="rounded-lg p-1.5 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-all hover:bg-sky-400/10 active:scale-90"
                  title="Test connection"
                >
                  {testConnection.isPending ? (
                    <Loader2 size="0.8125rem" className="animate-spin" />
                  ) : (
                    <CheckCircle size="0.8125rem" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateConnection.mutate(conn.id, {
                      onSuccess: (data: any) => {
                        if (data?.id) openConnectionDetail(data.id);
                      },
                    });
                  }}
                  className="rounded-lg p-1.5 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-all hover:bg-sky-400/10 hover:text-sky-400 active:scale-90"
                  title="Duplicate connection"
                >
                  <Copy size="0.8125rem" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConnection.mutate(conn.id);
                  }}
                  className="rounded-lg p-1.5 opacity-0 transition-all hover:bg-[var(--destructive)]/15 group-hover:opacity-100 active:scale-90"
                >
                  <Trash2 size="0.8125rem" className="text-[var(--destructive)]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {activeChat && (
        <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]/60">
          Click to edit · Set active connection in Chat Settings
        </p>
      )}
    </div>
  );
}

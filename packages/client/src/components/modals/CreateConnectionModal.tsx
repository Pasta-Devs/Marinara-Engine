// ────────────────────────────────────────────────
// Modal: Add connection (service → key/URL with test → pick models)
// ────────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import {
  AudioLines,
  Building2,
  Check,
  ChevronDown,
  Film,
  ImageIcon,
  Link,
  Loader2,
  Network,
  Scale,
  Search,
  Server,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PROVIDERS, isChatProvider, isLocalAuthProvider, type APIProvider } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { ConnectionModelPicker } from "../connections/ConnectionModelPicker";
import {
  useConnections,
  useDeleteConnection,
  useTestConnection,
  useUpdateConnection,
} from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useCreateConnectionAccount,
  useDeleteConnectionAccount,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { useUIStore } from "../../stores/ui.store";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Preselect a provider, for callers that open this to set up one kind of connection. */
  initialProvider?: APIProvider;
}

/** Shown open: the paths most people take. Collapsed: the long lists, so step 1 fits one screen. */
const SERVICE_GROUPS: Array<{ id: string; providers: APIProvider[]; collapsed?: boolean }> = [
  { id: "gateways", providers: ["openrouter", "nanogpt"] },
  { id: "local", providers: ["custom"] },
  { id: "subscription", providers: ["openai_chatgpt", "claude_subscription", "grok_subscription"] },
  {
    id: "vendors",
    collapsed: true,
    providers: [
      "openai",
      "anthropic",
      "google",
      "google_vertex",
      "mistral",
      "cohere",
      "xai",
      "zai",
      "deepseek",
      "arli",
    ],
  },
  { id: "media", providers: ["image_generation", "video_generation", "audio", "decision"], collapsed: true },
];

const GROUP_ICONS: Record<string, LucideIcon> = {
  gateways: Network,
  local: Server,
  subscription: UserRound,
  vendors: Building2,
};
const PROVIDER_ICONS: Partial<Record<APIProvider, LucideIcon>> = {
  image_generation: ImageIcon,
  video_generation: Film,
  audio: AudioLines,
  decision: Scale,
};

/** Agent editor choice card, laid out as a list row: icon, name, one-line hint. */
function ServiceCard({
  icon: Icon,
  name,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  name: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      aria-description={hint}
      className="mari-chrome-control mari-chrome-control--card min-h-14 p-2.5 text-xs"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="mari-panel-gradient-surface mari-panel-gradient--connections flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
          <Icon size="0.875rem" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{name}</span>
          <span className="block truncate text-[0.6875rem] text-[var(--muted-foreground)]">{hint}</span>
        </span>
      </span>
    </button>
  );
}

/** A small group label above choice cards; long groups fold behind the same chevron the panel uses. */
function ServiceGroup({
  title,
  count,
  collapsible,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  collapsible: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const grid = <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{children}</div>;
  if (!collapsible) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{title}</span>
        {grid}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 items-center gap-1.5 self-start rounded-lg px-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] md:min-h-9"
      >
        <ChevronDown size="0.75rem" className={cn("transition-transform", open && "rotate-180")} />
        {title} ({count})
      </button>
      <SmoothFolderContent open={open}>
        <div className="pt-1">{grid}</div>
      </SmoothFolderContent>
    </div>
  );
}

type Target = { accountId: string; connectionId: string; fresh: boolean };
type ConnectionRowLite = { id: string; name?: string; provider?: string; accountId?: string | null };

const LOCAL_URL_EXAMPLE = "http://localhost:11434/v1";
const inputClass = "mari-chrome-field h-10 w-full px-3 text-xs md:h-9";
const PRIMARY_CLASS = "mari-panel-gradient-button mari-panel-gradient--connections px-4 text-xs max-md:min-h-11";
const SECONDARY_CLASS = "mari-chrome-control mari-chrome-control--small px-3 text-xs max-md:min-h-11";

export function CreateConnectionModal({ open, onClose, initialProvider }: Props) {
  const { t } = useTranslation();
  const { data: accounts } = useConnectionAccounts();
  const { data: rows } = useConnections();
  const createAccount = useCreateConnectionAccount();
  const updateAccount = useUpdateConnectionAccount();
  const deleteAccount = useDeleteConnectionAccount();
  const deleteRow = useDeleteConnection();
  const updateRow = useUpdateConnection();
  const testConnection = useTestConnection();
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);

  const [provider, setProvider] = useState<APIProvider | null>(initialProvider ?? null);
  const [step, setStep] = useState<1 | 2 | 3>(initialProvider ? 2 : 1);
  const [target, setTarget] = useState<Target | null>(null);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [maxRpm, setMaxRpm] = useState("");
  const [maxJobs, setMaxJobs] = useState("");
  const [tested, setTested] = useState<{ success: boolean; message?: string } | null>(null);
  const [picked, setPicked] = useState(0);
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [moreOpen, setMoreOpen] = useState(false);

  const allRows = (rows ?? []) as ConnectionRowLite[];
  const existing = (accounts ?? []).filter((account) => account.modelCount > 0);
  const def = provider ? PROVIDERS[provider] : null;
  const keyless = !!provider && isLocalAuthProvider(provider);
  const needsUrl = provider === "custom";
  const busy = createAccount.isPending || updateAccount.isPending || testConnection.isPending;

  // Throw away the empty Model of an account that was created but never got a Model picked.
  const discard = async () => {
    if (!target?.fresh || picked > 0) return;
    try {
      await deleteRow.mutateAsync(target.connectionId);
      await deleteAccount.mutateAsync(target.accountId);
    } catch {
      /* the account stays; the user can delete it in the panel */
    }
  };

  const close = async () => {
    await discard();
    onClose();
  };

  const accountFields = () => ({
    ...(name.trim() ? { name: name.trim() } : {}),
    apiKey: keyless ? "" : apiKey.trim(),
    baseUrl: baseUrl.trim() || (keyless ? "" : (def?.defaultBaseUrl ?? "")),
    maxRequestsPerMinute: maxRpm ? Math.min(600, Math.max(1, Math.trunc(Number(maxRpm)))) : null,
    maxParallelJobs: maxJobs ? Math.min(16, Math.max(1, Math.trunc(Number(maxJobs)))) : null,
  });

  /** Creates the Connection with its empty first Model (or updates it on a retry), then tests it. */
  const saveAndTest = async () => {
    if (!provider) return;
    try {
      let current = target;
      if (current) {
        await updateAccount.mutateAsync({ id: current.accountId, ...accountFields() });
      } else {
        const created = await createAccount.mutateAsync({ provider, ...accountFields() });
        current = { accountId: created.account.id, connectionId: created.connectionId, fresh: true };
        setTarget(current);
      }
      if (!isChatProvider(provider)) {
        // Image/video/audio/decision Models are tuned in the editor, not picked from a list.
        onClose();
        openConnectionDetail(current.connectionId);
        return;
      }
      setTested(await testConnection.mutateAsync(current.connectionId));
    } catch (error) {
      setTested({ success: false, message: error instanceof Error ? error.message : String(error) });
    }
  };

  const chooseExisting = (accountId: string) => {
    const row = allRows.find((candidate) => candidate.accountId === accountId);
    if (!row) return;
    setProvider((row.provider as APIProvider) ?? null);
    setTarget({ accountId, connectionId: row.id, fresh: false });
    setStep(3);
  };

  // The first Model of a setup becomes Main and Agents default when none exists.
  const afterPick = (connectionId: string) => {
    const chat = allRows.filter((row) => isChatProvider(row.provider ?? ""));
    const patch: Record<string, boolean> = {};
    if (!chat.some((row) => isConnectionFlagTrue((row as Record<string, unknown>).isDefault))) patch.isDefault = true;
    if (!chat.some((row) => isConnectionFlagTrue((row as Record<string, unknown>).defaultForAgents)))
      patch.defaultForAgents = true;
    if (Object.keys(patch).length) updateRow.mutate({ id: connectionId, ...patch });
    setPicked((n) => n + 1);
  };

  const back = async () => {
    await discard();
    setTarget(null);
    setTested(null);
    setProvider(null);
    setStep(1);
  };

  const serviceName = (key: APIProvider) =>
    key === "decision" ? t("connections.decision.label") : (PROVIDERS[key]?.name ?? key);
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matches = (...texts: string[]) => !searching || texts.some((text) => text.toLowerCase().includes(needle));
  const filteredExisting = existing.filter((account) =>
    matches(account.name, serviceName(account.provider as APIProvider)),
  );
  const filteredGroups = SERVICE_GROUPS.map((group) => ({
    ...group,
    providers: group.providers.filter((key) => matches(serviceName(key), t(`connections.add.hint.${key}`))),
  })).filter((group) => group.providers.length > 0);

  const pickerRow = target ? allRows.find((row) => row.id === target.connectionId) : undefined;
  const inPlace = !!target?.fresh && picked === 0;
  const stepTitle = t(`connections.add.step${step}`);

  return (
    <Modal open={open} onClose={() => void close()} title={t("connections.add.title")} width="max-w-lg">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[var(--muted-foreground)]">{stepTitle}</p>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search
                size="0.8125rem"
                className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("connections.add.search")}
                aria-label={t("connections.add.search")}
                className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
              />
            </div>
            {filteredExisting.length > 0 && (
              <ServiceGroup
                title={t("connections.add.group.existing")}
                count={filteredExisting.length}
                collapsible={false}
                open
                onToggle={() => {}}
              >
                {filteredExisting.map((account) => (
                  <ServiceCard
                    key={account.id}
                    icon={Link}
                    name={account.name}
                    hint={t("connections.add.existingHint", {
                      service: serviceName(account.provider as APIProvider),
                      count: account.modelCount,
                    })}
                    onClick={() => chooseExisting(account.id)}
                  />
                ))}
              </ServiceGroup>
            )}
            {filteredGroups.map((group) => (
              <ServiceGroup
                key={group.id}
                title={t(`connections.add.group.${group.id}`)}
                count={group.providers.length}
                collapsible={!!group.collapsed && !searching}
                open={searching || openGroups.has(group.id)}
                onToggle={() =>
                  setOpenGroups((current) => {
                    const next = new Set(current);
                    if (next.has(group.id)) next.delete(group.id);
                    else next.add(group.id);
                    return next;
                  })
                }
              >
                {group.providers.map((key) => (
                  <ServiceCard
                    key={key}
                    icon={PROVIDER_ICONS[key] ?? GROUP_ICONS[group.id] ?? Link}
                    name={serviceName(key)}
                    hint={t(`connections.add.hint.${key}`)}
                    onClick={() => {
                      setProvider(key);
                      setStep(2);
                    }}
                  />
                ))}
              </ServiceGroup>
            ))}
            {searching && filteredExisting.length === 0 && filteredGroups.length === 0 && (
              <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">{t("connections.add.noMatch")}</p>
            )}
          </div>
        )}

        {step === 2 && provider && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="mari-panel-gradient-surface mari-panel-gradient--connections flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm">
                <Link size="1rem" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{serviceName(provider)}</span>
                <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t(`connections.add.hint.${provider}`)}
                </span>
              </span>
            </div>
            {needsUrl && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">
                  {t("connections.add.endpoint")}
                </span>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={LOCAL_URL_EXAMPLE}
                  className={cn(inputClass, "font-mono")}
                />
              </label>
            )}
            {!keyless && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">
                  {t("connections.add.apiKey")}
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoFocus
                  className={inputClass}
                />
              </label>
            )}
            {keyless && <p className="text-xs text-[var(--muted-foreground)]">{t("connections.add.keyless")}</p>}
            <button
              type="button"
              onClick={() => setMoreOpen((value) => !value)}
              aria-expanded={moreOpen}
              aria-controls="add-connection-more"
              className="flex min-h-11 items-center gap-1.5 self-start rounded-lg px-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] md:min-h-9"
            >
              <ChevronDown size="0.75rem" className={cn("transition-transform", moreOpen && "rotate-180")} />
              {t("connections.add.moreOptions")}
            </button>
            <SmoothFolderContent open={moreOpen}>
              <div id="add-connection-more" className="flex flex-col gap-2 pb-1">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--muted-foreground)]">{t("connections.add.name")}</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={def?.name}
                    className={inputClass}
                  />
                </label>
                {!needsUrl && !keyless && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">{t("connections.add.endpoint")}</span>
                    <input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={def?.defaultBaseUrl}
                      className={cn(inputClass, "font-mono")}
                    />
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {t("connections.add.maxRequestsPerMinute")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={maxRpm}
                      onChange={(e) => setMaxRpm(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {t("connections.add.maxParallelJobs")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={maxJobs}
                      onChange={(e) => setMaxJobs(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>
            </SmoothFolderContent>
            {tested && (
              <p
                role="status"
                className={cn("text-xs", tested.success ? "text-emerald-400" : "text-[var(--destructive)]")}
              >
                {tested.success
                  ? t("connections.add.testOk")
                  : t("connections.add.testFailed", { message: tested.message ?? "" })}
              </p>
            )}
          </div>
        )}

        {step === 3 && target && pickerRow && (
          <div className="flex flex-col gap-2">
            <div className="max-h-[50dvh] overflow-hidden rounded-lg ring-1 ring-[var(--border)]">
              <ConnectionModelPicker
                connection={pickerRow}
                accountName={accounts?.find((account) => account.id === target.accountId)?.name}
                onPicked={inPlace ? () => afterPick(target.connectionId) : undefined}
                applyPick={inPlace ? undefined : async (id) => afterPick(id)}
                autoFocusSearch
              />
            </div>
            {picked > 0 && (
              <p className="flex items-center gap-1 text-xs text-emerald-400">
                <Check size="0.75rem" />
                {t("connections.add.picked", { count: picked })}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={() => void (step === 1 || (step === 3 && target?.fresh) ? close() : back())}
            className={SECONDARY_CLASS}
          >
            {step === 1 || (step === 3 && target?.fresh) ? t("chat.delete.dialog.cancel") : t("connections.add.back")}
          </button>
          {step === 2 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveAndTest()}
                disabled={busy || (needsUrl && !baseUrl.trim()) || (!keyless && !needsUrl && !apiKey.trim())}
                // One primary per step: Save and test until the test passes, then Next.
                className={cn(tested?.success && target ? SECONDARY_CLASS : PRIMARY_CLASS, "disabled:opacity-50")}
              >
                {busy && <Loader2 size="0.75rem" className="animate-spin" />}
                {t("connections.add.test")}
              </button>
              {tested && target && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={tested.success ? PRIMARY_CLASS : SECONDARY_CLASS}
                >
                  {t("connections.add.next")}
                </button>
              )}
            </div>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={onClose}
              disabled={target?.fresh && picked === 0}
              className={cn(PRIMARY_CLASS, "disabled:opacity-50")}
            >
              {t("connections.add.done")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

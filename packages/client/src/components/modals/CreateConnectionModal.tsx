// ────────────────────────────────────────────────
// Modal: Add connection (service → key/URL with test → pick models)
// ────────────────────────────────────────────────
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PROVIDERS, isChatProvider, isLocalAuthProvider, type APIProvider } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
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

const SERVICE_GROUPS: Array<{ id: string; providers: APIProvider[] }> = [
  { id: "gateways", providers: ["openrouter", "nanogpt"] },
  {
    id: "vendors",
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
  { id: "local", providers: ["custom"] },
  { id: "subscription", providers: ["openai_chatgpt", "claude_subscription", "grok_subscription"] },
  { id: "media", providers: ["image_generation", "video_generation", "audio", "decision"] },
];

type Target = { accountId: string; connectionId: string; fresh: boolean };
type ConnectionRowLite = { id: string; name?: string; provider?: string; accountId?: string | null };

const LOCAL_URL_EXAMPLE = "http://localhost:11434/v1";
const inputClass =
  "w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]";

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

  const pickerRow = target ? allRows.find((row) => row.id === target.connectionId) : undefined;
  const inPlace = !!target?.fresh && picked === 0;
  const stepTitle = t(`connections.add.step${step}`);

  return (
    <Modal open={open} onClose={() => void close()} title={t("connections.add.title")} width="max-w-md">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[var(--muted-foreground)]">{stepTitle}</p>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            {existing.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">
                  {t("connections.add.group.existing")}
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {existing.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => chooseExisting(account.id)}
                      className="mari-chrome-control mari-chrome-control--card text-xs"
                    >
                      <span className="font-medium">{account.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {SERVICE_GROUPS.map((group) => (
              <div key={group.id} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">
                  {t(`connections.add.group.${group.id}`)}
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.providers.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setProvider(key);
                        setStep(2);
                      }}
                      className="mari-chrome-control mari-chrome-control--card text-xs"
                    >
                      <span className="font-medium">
                        {key === "decision" ? t("connections.decision.label") : PROVIDERS[key].name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && provider && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">
              {provider === "decision" ? t("connections.decision.label") : def?.name}
            </p>
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
            <details className="rounded-lg ring-1 ring-[var(--border)]">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                {t("connections.add.moreOptions")}
              </summary>
              <div className="flex flex-col gap-2 px-3 pb-3">
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
            </details>
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
            className="rounded-lg px-4 py-2 text-xs font-medium max-md:min-h-11 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            {step === 1 || (step === 3 && target?.fresh) ? t("chat.delete.dialog.cancel") : t("connections.add.back")}
          </button>
          {step === 2 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveAndTest()}
                disabled={busy || (needsUrl && !baseUrl.trim()) || (!keyless && !needsUrl && !apiKey.trim())}
                className="mari-chrome-control flex items-center gap-1.5 px-4 py-2 text-xs font-medium max-md:min-h-11 disabled:opacity-50"
              >
                {busy && <Loader2 size="0.75rem" className="animate-spin" />}
                {t("connections.add.test")}
              </button>
              {tested && target && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium max-md:min-h-11 text-[var(--primary-foreground)] transition-all hover:opacity-90"
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
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium max-md:min-h-11 text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
            >
              {t("connections.add.done")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

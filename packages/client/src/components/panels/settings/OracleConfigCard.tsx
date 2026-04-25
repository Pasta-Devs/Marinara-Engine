// ──────────────────────────────────────────────
// Oracle Configuration Card (Connections Panel)
// ──────────────────────────────────────────────
// Exposes the Oracle agent's web-search config: provider, API key, result
// count, summary token cap, and auto-persist toggle. Mirrors the TTSConfigCard
// layout — debounced auto-save, masked key, expand/collapse.
// ──────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import {
  Globe2,
  Key,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { toast } from "sonner";
import {
  useOracleConfig,
  useUpdateOracleConfig,
  useTestOracleConnection,
  ORACLE_API_KEY_MASK,
} from "../../../hooks/use-oracle";
import type { OracleConfig } from "@marinara-engine/shared";
import { ORACLE_PROVIDERS } from "@marinara-engine/shared";
import { HelpTooltip } from "../../ui/HelpTooltip";

// ── Sub-components ───────────────────────────────

function FieldRow({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-[var(--foreground)]">{label}</span>
        {help && <HelpTooltip text={help} />}
      </div>
      {children}
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

function ToggleRow({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-[var(--secondary)]/50">
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{label}</span>
        {help && <HelpTooltip text={help} />}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-[var(--border)] accent-sky-400"
      />
    </label>
  );
}

// ── Main card ─────────────────────────────────────

export function OracleConfigCard() {
  const { data: savedConfig, isLoading } = useOracleConfig();
  const updateConfig = useUpdateOracleConfig();
  const testConnection = useTestOracleConnection();

  // Local draft state
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<OracleConfig["provider"]>("tavily");
  const [apiKey, setApiKey] = useState("");
  const [maxResults, setMaxResults] = useState(3);
  const [summaryTokenCap, setSummaryTokenCap] = useState(400);
  const [timeoutMs, setTimeoutMs] = useState(8000);
  const [autoPersist, setAutoPersist] = useState(true);

  const [expanded, setExpanded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Populate draft from server on load
  useEffect(() => {
    if (!savedConfig) return;
    setEnabled(savedConfig.enabled);
    setProvider(savedConfig.provider);
    setApiKey(savedConfig.apiKey); // masked value from server
    setMaxResults(savedConfig.maxResults);
    setSummaryTokenCap(savedConfig.summaryTokenCap);
    setTimeoutMs(savedConfig.timeoutMs);
    setAutoPersist(savedConfig.autoPersist);
    setSaveStatus("idle");
  }, [savedConfig]);

  // Clear debounce timer on unmount
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const mark = (overrides?: Partial<OracleConfig>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("idle");
    const payload: OracleConfig = {
      enabled,
      provider,
      apiKey: apiKey === ORACLE_API_KEY_MASK ? ORACLE_API_KEY_MASK : apiKey,
      maxResults,
      summaryTokenCap,
      timeoutMs,
      autoPersist,
      ...overrides,
    };
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await updateConfig.mutateAsync(payload);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setSaveStatus("error");
        toast.error("Failed to save Oracle settings.");
      }
    }, 600);
  };

  const handleTest = async () => {
    try {
      const result = await testConnection.mutateAsync();
      if (result.ok) {
        toast.success(`Connection OK — got ${result.resultCount} result${result.resultCount === 1 ? "" : "s"}.`);
      } else {
        toast.error(`Test failed: ${result.error ?? "Unknown error"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test request failed";
      toast.error(msg);
    }
  };

  if (isLoading) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 p-3 transition-all",
        expanded && "border-sky-400/30",
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-sm">
          <Globe2 size="1rem" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Oracle (Web Search)</div>
          <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {enabled
              ? `${provider} · ${maxResults} result${maxResults === 1 ? "" : "s"} · summary ≤ ${summaryTokenCap} tok`
              : "Type <search>topic</search> in a message to trigger"}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Enable toggle */}
          <label className="flex cursor-pointer items-center gap-1.5" title={enabled ? "Disable Oracle" : "Enable Oracle"}>
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">{enabled ? "On" : "Off"}</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => {
                  setEnabled(e.target.checked);
                  mark({ enabled: e.target.checked });
                }}
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-sky-400/70" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </div>
          </label>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
          </button>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Provider */}
          <FieldRow
            label="Provider"
            help="Which web-search API to call. Tavily is designed for LLM agents and returns pre-summarized content, reducing token bloat."
          >
            <select
              value={provider}
              onChange={(e) => {
                const next = e.target.value as OracleConfig["provider"];
                setProvider(next);
                mark({ provider: next });
              }}
              className={cn(INPUT_CLS, "cursor-pointer appearance-none")}
            >
              {ORACLE_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FieldRow>

          {/* API Key */}
          <FieldRow
            label="API Key"
            help="Your Tavily API key (free tier: 1000 searches/month at tavily.com). Encrypted at rest. Keep the masked value to preserve the current key, or clear the field to remove it."
          >
            <div className="relative">
              <Key size="0.875rem" className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
              <input
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  mark({ apiKey: e.target.value === ORACLE_API_KEY_MASK ? ORACLE_API_KEY_MASK : e.target.value });
                }}
                type="password"
                className={cn(INPUT_CLS, "pl-8")}
                placeholder="Enter API key or clear to remove"
              />
            </div>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              Encrypted at rest · Keep the masked value to preserve the current key
            </p>
          </FieldRow>

          {/* Max results */}
          <FieldRow
            label={`Max results — ${maxResults}`}
            help="Number of raw search results fetched per query. More results = richer summary but higher token cost."
          >
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={maxResults}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10);
                setMaxResults(next);
                mark({ maxResults: next });
              }}
              className="w-full accent-sky-400"
            />
            <div className="flex justify-between text-[0.6rem] text-[var(--muted-foreground)]">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </FieldRow>

          {/* Summary token cap */}
          <FieldRow
            label={`Summary token cap — ${summaryTokenCap}`}
            help="Hard cap on the summary length injected into the character's prompt. Keeps context budget under control."
          >
            <input
              type="range"
              min={100}
              max={2000}
              step={50}
              value={summaryTokenCap}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10);
                setSummaryTokenCap(next);
                mark({ summaryTokenCap: next });
              }}
              className="w-full accent-sky-400"
            />
            <div className="flex justify-between text-[0.6rem] text-[var(--muted-foreground)]">
              <span>100</span>
              <span>1000</span>
              <span>2000</span>
            </div>
          </FieldRow>

          {/* Timeout */}
          <FieldRow
            label={`Timeout — ${(timeoutMs / 1000).toFixed(1)}s`}
            help="Max time to wait for the web-search API before giving up. If exceeded, generation proceeds without web results."
          >
            <input
              type="range"
              min={2000}
              max={30_000}
              step={500}
              value={timeoutMs}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10);
                setTimeoutMs(next);
                mark({ timeoutMs: next });
              }}
              className="w-full accent-sky-400"
            />
            <div className="flex justify-between text-[0.6rem] text-[var(--muted-foreground)]">
              <span>2s</span>
              <span>15s</span>
              <span>30s</span>
            </div>
          </FieldRow>

          {/* Auto-persist */}
          <div className="space-y-1">
            <span className="text-xs font-medium">Persistence</span>
            <ToggleRow
              label="Save summaries to lorebook"
              help="Each web-search summary is automatically stored as a lorebook entry tagged 'web-research', making it available to the character on later turns without re-searching."
              checked={autoPersist}
              onChange={(v) => {
                setAutoPersist(v);
                mark({ autoPersist: v });
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={!savedConfig?.enabled || testConnection.isPending}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs ring-1 transition-all",
                "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)] hover:text-[var(--foreground)] hover:ring-sky-400/60",
                (!savedConfig?.enabled || testConnection.isPending) && "cursor-not-allowed opacity-50",
              )}
              title="Run a quick 1-result search to verify the API key"
            >
              {testConnection.isPending ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : (
                <FlaskConical size="0.75rem" />
              )}
              {testConnection.isPending ? "Testing…" : "Test connection"}
            </button>

            <div className="flex-1" />

            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                <Loader2 size="0.625rem" className="animate-spin" />
                Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-emerald-400">
                <Check size="0.625rem" />
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-[0.6875rem] text-rose-400">Save failed</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

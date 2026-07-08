// ────────────────────────────────────────────────
// Modal: Create Connection (name only)
// ────────────────────────────────────────────────
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useCreateConnection } from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import { Loader2, Link } from "lucide-react";
import { MODEL_LISTS, PROVIDERS, type APIProvider } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateConnectionModal({ open, onClose }: Props) {
  const createConnection = useCreateConnection();
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<APIProvider>("openai");

  const reset = () => {
    setName("");
    setProvider("openai");
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const providerDef = PROVIDERS[provider];
    const defaultModel = MODEL_LISTS[provider]?.[0];
    try {
      const result = await createConnection.mutateAsync({
        name: name.trim(),
        provider,
        baseUrl: providerDef?.defaultBaseUrl ?? "",
        apiKey: "",
        model: defaultModel?.id ?? "",
        maxContext: defaultModel?.context || 128000,
      });
      const connId = (result as { id: string })?.id;
      onClose();
      reset();
      if (connId) openConnectionDetail(connId);
    } catch {
      // stay in modal on failure
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Connection" width="max-w-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 shadow-lg shadow-sky-400/20">
            <Link size="1.375rem" className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              Connections define API endpoints and credentials used to communicate with language model providers.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="My Connection..."
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Provider</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(PROVIDERS) as [APIProvider, (typeof PROVIDERS)[APIProvider]][]).map(([key, info]) => (
              <button
                key={key}
                type="button"
                onClick={() => setProvider(key)}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-left text-[0.6875rem] font-medium transition-all",
                  provider === key
                    ? "bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/30"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                )}
              >
                {info.name}
              </button>
            ))}
          </div>
          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
            {provider === "xai"
              ? "Creates an xAI connection prefilled with Grok 4.5 and https://api.x.ai/v1."
              : "You can adjust the endpoint, key, and model after creating the connection."}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            onClick={() => {
              onClose();
              reset();
            }}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || createConnection.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {createConnection.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <Link size="0.75rem" />}
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}

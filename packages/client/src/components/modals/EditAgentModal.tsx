// ──────────────────────────────────────────────
// Modal: Edit Agent
// ──────────────────────────────────────────────
import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useConnections } from "../../hooks/use-connections";
import { Loader2, Sparkles, Save } from "lucide-react";
import type { AgentPhase } from "@marinara-engine/shared";

export interface AgentData {
  id?: string;
  type: string;
  name: string;
  description: string;
  phase: AgentPhase;
  enabled?: string | boolean;
  connectionId?: string | null;
  promptTemplate?: string;
  settings?: string | Record<string, unknown>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  agent: AgentData | null;
}

const PHASE_OPTIONS: { value: AgentPhase; label: string }[] = [
  { value: "pre_generation", label: "Pre-Generation" },
  { value: "parallel", label: "Parallel" },
  { value: "post_processing", label: "Post-Processing" },
];

export function EditAgentModal({ open, onClose, agent }: Props) {
  const qc = useQueryClient();
  const { data: connections } = useConnections();

  const [form, setForm] = useState({
    name: "",
    description: "",
    phase: "post_processing" as AgentPhase,
    connectionId: "" as string,
    promptTemplate: "",
  });

  // Sync form state when agent changes
  useEffect(() => {
    if (agent) {
      const settings = typeof agent.settings === "string" ? JSON.parse(agent.settings || "{}") : (agent.settings ?? {});
      void settings; // available for future use

      setForm({
        name: agent.name ?? "",
        description: agent.description ?? "",
        phase: (agent.phase as AgentPhase) ?? "post_processing",
        connectionId: agent.connectionId ?? "",
        promptTemplate: agent.promptTemplate ?? "",
      });
    }
  }, [agent]);

  // Update existing config
  const updateAgent = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/agents/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      onClose();
    },
  });

  // Create config if agent has never been persisted
  const createAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/agents", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      onClose();
    },
  });

  const isPending = updateAgent.isPending || createAgent.isPending;

  const handleSave = () => {
    if (!agent || !form.name.trim()) return;

    const payload = {
      name: form.name,
      description: form.description,
      phase: form.phase,
      connectionId: form.connectionId || null,
      promptTemplate: form.promptTemplate,
    };

    if (agent.id) {
      // Agent config already exists in DB
      updateAgent.mutate({ id: agent.id, data: payload });
    } else {
      // First time editing — create a config for this built-in agent
      createAgent.mutate({
        ...payload,
        type: agent.type,
        enabled: true,
      });
    }
  };

  if (!agent) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Edit Agent — ${agent.name}`} width="max-w-lg">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--y2k-pink)] to-[var(--y2k-purple)] shadow-lg shadow-[var(--y2k-pink)]/20">
            <Sparkles size="1.375rem" className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              Customize this agent's behavior, prompt, and which connection it uses for inference.
            </p>
          </div>
        </div>

        {/* Name */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Agent name..."
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </label>

        {/* Description */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Description</span>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What does this agent do..."
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </label>

        {/* Phase */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Pipeline Phase</span>
          <select
            value={form.phase}
            onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value as AgentPhase }))}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          >
            {PHASE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Connection Override */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Connection Override</span>
          <select
            value={form.connectionId}
            onChange={(e) => setForm((f) => ({ ...f, connectionId: e.target.value }))}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          >
            <option value="">Use default connection</option>
            {(connections as Array<{ id: string; name: string; provider: string }> | undefined)?.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name} ({conn.provider})
              </option>
            ))}
          </select>
        </label>

        {/* Prompt Template */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Prompt Template</span>
          <textarea
            value={form.promptTemplate}
            onChange={(e) => setForm((f) => ({ ...f, promptTemplate: e.target.value }))}
            rows={6}
            placeholder="Custom instructions for this agent... Leave empty to use the built-in prompt."
            className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <Save size="0.75rem" />}
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

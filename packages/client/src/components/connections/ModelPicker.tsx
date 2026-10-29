// ModelPicker — the one window that picks a Model for a job (Main, Agents, a feature field…).
// The body is the chat switcher's, so every picker lists, stars and searches alike; only the title differs.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LOCAL_SIDECAR_CONNECTION_ID, type ChatModelChoice, type ConnectionPickerKind } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { usePickModel, useConnectionAccounts } from "../../hooks/use-connection-accounts";
import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
  useTestConnection,
  useUpdateConnection,
} from "../../hooks/use-connections";
import { api } from "../../lib/api-client";
import { useDecisionOptions } from "../../hooks/use-decision-model";
import { decisionConnectionTestMessage } from "../../lib/decision-test-message";
import type { ConnectionModelRow } from "../../lib/connection-groups";
import { openAddConnection } from "../../lib/add-connection";
import { ConnectionSwitcherBody } from "./ConnectionSwitcherBody";

type Extra = { value: string; label: string };

/** The catalogs do not mark embedding models, so the id decides ("text-embedding-3-small", "bge-m3-embed"…). */
/** A reason that fits on a row. */
const short = (text: string) => (text.length > 38 ? `${text.slice(0, 36)}…` : text);

const isEmbeddingModel = (model: string) => /embed/i.test(model);

function ModelPickerSlot({
  open,
  onClose,
  title,
  jobName,
  kind,
  value,
  onChange,
  defaultText,
  includeDefault,
  includeLocalSidecar,
  extraOptions,
  rowFilter,
  embedding = false,
  restoreFocusRef,
  header,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Names the job in the toast: "<job> now uses <model>". */
  jobName: string;
  kind: ConnectionPickerKind;
  /** A Model row id, `null` (follows the default) or one of `extraOptions`. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** What the first row says when the job follows its default. */
  defaultText: string;
  includeDefault: boolean;
  includeLocalSidecar: boolean;
  extraOptions: ReadonlyArray<Extra>;
  rowFilter?: (row: ConnectionModelRow) => boolean;
  /** Embeddings: lists the catalog's embedding models and tries a pick with one tiny embedding call. */
  embedding?: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** Above the list: the slot switch of a job with an "If it fails" Model. */
  header?: ReactNode;
}) {
  const { t } = useTranslation();
  const pickModel = usePickModel();
  const { data: rows } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const decision = kind === "decision";
  const createRow = useCreateConnection();
  const updateRow = useUpdateConnection();
  const deleteRow = useDeleteConnection();
  const testRow = useTestConnection();
  const decisionOptions = useDecisionOptions(decision && open);
  // A Decision row exists only for a model that passed its test, so the saved rows are the memory.
  const decisionRows = new Set(
    ((rows ?? []) as Array<{ provider?: string; accountId?: string | null; model?: string | null }>)
      .filter((row) => row.provider === "decision")
      .map((row) => `${row.accountId}|${row.model}`),
  );
  // `accountId|model` → what the Decision test said; a model being tried or turned down shows it on its row.
  const [tried, setTried] = useState<Record<string, { label: string; state: "off" | "needs_key" }>>({});
  const known = useRef<Set<string> | null>(null);
  // Undo runs later, so it must reach the host's latest setter, not the one this render saw.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [firstAccountId, setFirstAccountId] = useState<string | null>(null);

  // A provider added from this window comes back as the first group.
  useEffect(() => {
    if (!known.current || !accounts) return;
    const added = accounts.find((account) => !known.current!.has(account.id));
    if (added) {
      known.current = null;
      setFirstAccountId(added.id);
    }
  }, [accounts]);
  useEffect(() => {
    if (!open) {
      known.current = null;
      setFirstAccountId(null);
    }
  }, [open]);

  const nameOf = (id: string | null) => {
    const row = id
      ? (rows as Array<{ id: string; name?: string | null; model?: string | null }> | undefined)?.find(
          (r) => r.id === id,
        )
      : null;
    return row?.name || row?.model || id || defaultText;
  };

  const commit = (next: string | null, label?: string) => {
    const previous = value;
    onChange(next);
    toast.success(t("connections.picker.nowUses", { job: jobName, model: label ?? nameOf(next) }), {
      duration: 8000,
      action: { label: t("connections.switcher.undo"), onClick: () => onChangeRef.current(previous) },
    });
  };

  // A catalog model nobody saved yet is saved under its provider first, as the chat does.
  const apply = async (choice: ChatModelChoice) => {
    let id = choice.connectionId ?? null;
    if (choice.model) {
      const accountId = (rows as Array<{ id: string; accountId?: string | null }> | undefined)?.find(
        (r) => r.id === id,
      )?.accountId;
      if (!accountId) return;
      const saved = await pickModel.mutateAsync({
        accountId,
        model: choice.model,
        ...(choice.name ? { name: choice.name } : {}),
        ...(choice.maxContext ? { maxContext: choice.maxContext } : {}),
        ...(choice.maxTokensOverride ? { maxTokensOverride: choice.maxTokensOverride } : {}),
      });
      id = saved.connectionId;
    }
    if (id === value) return;
    commit(id, choice.name ?? choice.model);
  };

  // Decision: the model is tried before it is assigned; a rejected one stays unassigned and says why.
  const applyDecision = async (choice: ChatModelChoice) => {
    const anchor = (rows as Array<{ id: string; accountId?: string | null; model?: string | null }> | undefined)?.find(
      (row) => row.id === choice.connectionId,
    );
    const account = accounts?.find((item) => item.id === anchor?.accountId);
    const model = choice.model ?? anchor?.model;
    if (!account || !model) return false;
    const key = `${account.id}|${model}`;
    const mark = (next: { label: string; state: "off" | "needs_key" } | null) =>
      setTried((all) => {
        const { [key]: _drop, ...rest } = all;
        return next ? { ...rest, [key]: next } : rest;
      });
    mark({ label: t("connections.decision.testing"), state: "off" });
    const existing = (
      rows as Array<{ id: string; provider?: string; accountId?: string | null; model?: string | null }> | undefined
    )?.find((row) => row.provider === "decision" && row.accountId === account.id && row.model === model);
    let id = existing?.id;
    try {
      if (!id) {
        const created = (await createRow.mutateAsync({
          name: model,
          provider: "decision",
          apiKey: "",
          baseUrl: account.baseUrl ?? "",
          accountId: account.id,
          decisionSource: "openai_compatible",
          model,
        })) as { id?: string };
        id = created.id;
      }
      if (!id) throw new Error("no row");
      const result = await testRow.mutateAsync(id);
      const noLogprobs = result.success && result.logprobs === false;
      if (!result.success || noLogprobs) {
        if (!existing) await deleteRow.mutateAsync(id);
        mark({
          label: noLogprobs
            ? t("connections.decision.noLogprobs")
            : short(decisionConnectionTestMessage(t, result).message),
          state: "needs_key",
        });
        return false;
      }
      mark(null);
      commit(id, choice.name ?? model);
    } catch {
      if (!existing && id) await deleteRow.mutateAsync(id).catch(() => undefined);
      mark({ label: t("connections.decision.errors.network"), state: "needs_key" });
      return false;
    }
  };

  // Embeddings: the row keeps the embedding model; a pick that cannot embed leaves the old value in place.
  const applyEmbedding = async (choice: ChatModelChoice) => {
    type EmbeddingRow = {
      id: string;
      accountId?: string | null;
      model?: string | null;
      embeddingModel?: string | null;
    };
    const all = rows as EmbeddingRow[] | undefined;
    const row = all?.find((item) => item.id === choice.connectionId);
    const model = choice.model ?? row?.embeddingModel ?? row?.model;
    if (!row || !model) return false;
    const key = row.accountId ? `${row.accountId}|${model}` : model;
    const mark = (next: { label: string; state: "off" | "needs_key" } | null) =>
      setTried((tries) => {
        const { [key]: _drop, ...rest } = tries;
        return next ? { ...rest, [key]: next } : rest;
      });
    mark({ label: t("connections.decision.testing"), state: "off" });
    let id = row.id;
    let before: string | null = row.embeddingModel ?? null;
    try {
      if (choice.model && row.accountId) {
        const saved = await pickModel.mutateAsync({
          accountId: row.accountId,
          model: choice.model,
          ...(choice.name ? { name: choice.name } : {}),
        });
        id = saved.connectionId;
        before = all?.find((item) => item.id === id)?.embeddingModel ?? null;
      }
      await updateRow.mutateAsync({ id, embeddingModel: model });
      const result = await api.post<{ success: boolean; message: string }>(`/connections/${id}/test-embedding`, {});
      if (!result.success) {
        await updateRow.mutateAsync({ id, embeddingModel: before ?? "" });
        mark({ label: short(result.message) || t("connections.embeddingDefault.failed"), state: "needs_key" });
        return false;
      }
      mark(null);
      commit(id, choice.name ?? model);
    } catch {
      mark({ label: t("connections.embeddingDefault.failed"), state: "needs_key" });
      return false;
    }
  };

  const onAdd = () => {
    known.current = new Set((accounts ?? []).map((account) => account.id));
    openAddConnection();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      opaque
      panelClassName="connection-picker-dialog mari-connection-scope h-[min(36rem,calc(100dvh-1.5rem))]"
      closeButtonClassName="!min-h-11 !min-w-11"
      restoreFocusRef={restoreFocusRef}
      contentClassName="flex flex-col !overflow-hidden !p-0"
    >
      {header}
      <ConnectionSwitcherBody
        layout="steps"
        kind={decision ? "chat" : kind}
        rowFilter={rowFilter}
        catalogBrowse={decision || embedding || (kind === "chat" && !rowFilter)}
        current={
          !decision && value && !extraOptions.some((extra) => extra.value === value) ? { connectionId: value } : null
        }
        onApply={decision ? applyDecision : embedding ? applyEmbedding : apply}
        onDone={onClose}
        showLocalModel={includeLocalSidecar}
        followDefault={
          includeDefault
            ? {
                active: !value,
                own: kind !== "chat" || decision || embedding,
                label: defaultText,
                onSelect: async () => {
                  if (value) commit(null);
                },
              }
            : undefined
        }
        knownGood={
          decision
            ? {
                label: t("connections.decision.knownGood"),
                test: (accountId, model, facts) =>
                  !!facts?.capabilities?.logprobs || decisionRows.has(`${accountId}|${model}`),
              }
            : undefined
        }
        rowState={decision || embedding ? (accountId, model) => tried[`${accountId}|${model}`] ?? null : undefined}
        extras={[
          ...extraOptions,
          ...(decision
            ? (decisionOptions.data?.options ?? [])
                .filter((option) => option.group === "connection" && !option.unavailable)
                .map((option) => ({
                  value: option.id,
                  label:
                    (rows as Array<{ id: string; model?: string | null }> | undefined)
                      ?.find((row) => row.id === option.id)
                      ?.model?.trim() || option.label,
                }))
            : []),
        ].map((extra) => ({
          ...extra,
          active: value === extra.value,
          onSelect: async () => {
            if (value !== extra.value) commit(extra.value);
          },
        }))}
        modelFilter={embedding ? isEmbeddingModel : undefined}
        pickerFooter=""
        onAdd={onAdd}
        firstAccountId={firstAccountId}
        autoFocusSearch={typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches}
        className="flex min-h-0 flex-1 flex-col"
      />
    </Modal>
  );
}

type PickerProps = Parameters<typeof ModelPickerSlot>[0];

/** The job's picker. With an "If it fails" Model, two rows on top choose which of the two the list sets. */
export function ModelPicker({
  fallback,
  ...props
}: Omit<PickerProps, "header"> & { fallback?: { value: string | null; onChange: (value: string | null) => void } }) {
  const { t } = useTranslation();
  const { data: rows } = useConnections();
  const [slot, setSlot] = useState<"model" | "fallback">("model");
  useEffect(() => {
    if (!props.open) setSlot("model");
  }, [props.open]);
  if (!fallback) return <ModelPickerSlot {...props} />;
  const nameOf = (id: string | null, empty: string) => {
    if (!id) return empty;
    if (id === LOCAL_SIDECAR_CONNECTION_ID) return t("connections.select.localModel");
    const row = (rows as Array<{ id: string; name?: string | null; model?: string | null }> | undefined)?.find(
      (item) => item.id === id,
    );
    return row?.name?.trim() || row?.model?.trim() || empty;
  };
  const noFallback = t("connections.picker.noFallback");
  const slots = [
    { key: "model" as const, label: t("connections.picker.slotModel"), value: nameOf(props.value, props.defaultText) },
    {
      key: "fallback" as const,
      label: t("connections.picker.slotFallback"),
      value: nameOf(fallback.value, noFallback),
    },
  ];
  return (
    <ModelPickerSlot
      {...props}
      {...(slot === "fallback"
        ? {
            value: fallback.value,
            onChange: fallback.onChange,
            jobName: t("connections.picker.fallbackJob", { job: props.jobName }),
            defaultText: noFallback,
            includeDefault: true,
            includeLocalSidecar: false,
            extraOptions: [],
          }
        : {})}
      header={
        <div role="tablist" className="grid shrink-0 grid-cols-2 gap-1.5 border-b border-[var(--border)]/40 p-2">
          {slots.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={slot === entry.key}
              onClick={() => setSlot(entry.key)}
              className={cn(
                "flex min-h-11 min-w-0 flex-col items-start justify-center rounded-lg px-3 py-1 text-left transition-colors",
                slot === entry.key ? "bg-[var(--sidebar-accent)]" : "hover:bg-[var(--sidebar-accent)]/40",
              )}
            >
              <span className="text-[0.625rem] text-[var(--muted-foreground)]">{entry.label}</span>
              <span className="w-full truncate text-xs font-medium">{entry.value}</span>
            </button>
          ))}
        </div>
      }
    />
  );
}

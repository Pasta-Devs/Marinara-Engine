// ModelPicker — the one window that picks a Model for a job (Main, Agents, a feature field…).
// The body is the chat switcher's, so every picker lists, stars and searches alike; only the title differs.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ConnectionExtraOption } from "./ConnectionSelect";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  isChatProvider,
  speaksOpenAIChat,
  type ChatModelChoice,
  type ConnectionPickerKind,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { usePickModel, useConnectionAccounts } from "../../hooks/use-connection-accounts";
import {
  connectionKeys,
  type ConnectionModelList,
  useConnections,
  useCreateConnection,
  useDeleteConnection,
  useTestConnection,
  useTestEmbedding,
  useUpdateConnection,
} from "../../hooks/use-connections";
import { useDecisionOptions } from "../../hooks/use-decision-model";
import { decisionConnectionTestMessage } from "../../lib/decision-test-message";
import type { ConnectionModelRow } from "../../lib/connection-groups";
import { openAddConnection } from "../../lib/add-connection";
import type { JobKey } from "../../lib/connection-jobs";
import { mediaRowFor, mediaSources, type MediaKind } from "../../lib/media-source";
import { isDecisionCatalogModel } from "../../lib/connection-model-selection";
import { NATIVE_DECISION_SOURCE, type ServiceId } from "../modals/create-connection/shared";
import { ConnectionSwitcherBody } from "./ConnectionSwitcherBody";
import { Tabs } from "../ui/Tabs";
import { ProviderIcon } from "./ProviderIcon";

type Extra = ConnectionExtraOption;

/** The catalogs do not mark embedding models, so the id decides ("text-embedding-3-small", "bge-m3-embed"…). */
/** What a tried model's line shows: a short pill, with the full reason one tap away (`detail`). */
type TriedState = { label: string; state: "off" | "needs_key"; detail?: string };

const isEmbeddingModel = (model: string) => /embed/i.test(model);

function ModelPickerSlot({
  open,
  onClose,
  title,
  jobName,
  jobKey,
  kind,
  value,
  onChange,
  defaultText,
  includeDefault,
  includeLocalSidecar,
  extraOptions,
  rowFilter,
  embedding = false,
  unsetIsOwn = false,
  restoreFocusRef,
  header,
  confirmCurrent = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Names the job in the toast: "<job> now uses <model>". */
  jobName: string;
  jobKey?: JobKey;
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
  /** An empty value is its own "nothing" row, not "follows Main" (the "If it fails" slot). */
  unsetIsOwn?: boolean;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** Above the list: the slot switch of a job with an "If it fails" Model. */
  header?: ReactNode;
  /** Choosing the current value still calls onChange (a package's pickConnection, CONNECTION_PICKER.md). */
  confirmCurrent?: boolean;
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
  const testEmbedding = useTestEmbedding();
  const decisionOptions = useDecisionOptions(decision && open);
  const queryClient = useQueryClient();
  /** The provider's own decision model, asked at its decision API rather than through log-probabilities (#9317). */
  const nativeDecision = (provider: string, facts: { outputModalities?: readonly string[] } | undefined) =>
    !!NATIVE_DECISION_SOURCE[provider as ServiceId] && !!facts && isDecisionCatalogModel(facts);
  // A Decision row exists only for a model that passed its test, so the saved rows are the memory.
  const decisionRows = new Set(
    ((rows ?? []) as Array<{ provider?: string; accountId?: string | null; model?: string | null }>)
      .filter((row) => row.provider === "decision")
      .map((row) => `${row.accountId}|${row.model}`),
  );
  // `accountId|model` → what the Decision test said; a model being tried or turned down shows it on its row.
  const [tried, setTried] = useState<Record<string, TriedState>>({});
  // A failed try's pill: "Error 404" when the reason carries a status code; the whole reason opens from it.
  const failLabel = (message: string) => {
    const code = /\((\d{3})\)/.exec(message)?.[1];
    return { label: code ? t("connections.error.pillCode", { code }) : t("connections.error.pill") };
  };
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

  // The current value changes nothing (no toast), but a host that confirms it still hears the choice.
  const keep = (current: string | null) => {
    if (confirmCurrent) onChange(current);
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
    if (id === value) return keep(id);
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
    const mark = (next: TriedState | null) =>
      setTried((all) => {
        const { [key]: _drop, ...rest } = all;
        return next ? { ...rest, [key]: next } : rest;
      });
    mark({ label: t("connections.decision.testing"), state: "off" });
    const existing = (
      rows as Array<{ id: string; provider?: string; accountId?: string | null; model?: string | null }> | undefined
    )?.find((row) => row.provider === "decision" && row.accountId === account.id && row.model === model);
    // The account's list the picker browsed (shared query keys, one per saved Model of the account): a decision
    // model there takes its native source.
    const listed = (rows as Array<{ id: string; accountId?: string | null }> | undefined)
      ?.filter((row) => row.accountId === account.id)
      .map((row) =>
        queryClient
          .getQueryData<ConnectionModelList>(connectionKeys.models(row.id))
          ?.models.find((entry) => entry.id === model),
      )
      .find(Boolean);
    const native = nativeDecision(account.provider, listed)
      ? NATIVE_DECISION_SOURCE[account.provider as ServiceId]
      : undefined;
    let id = existing?.id;
    try {
      if (!id) {
        const created = (await createRow.mutateAsync({
          name: model,
          provider: "decision",
          apiKey: "",
          baseUrl: account.baseUrl ?? "",
          accountId: account.id,
          decisionSource: native ?? "openai_compatible",
          model,
        })) as { id?: string };
        id = created.id;
      }
      if (!id) throw new Error("no row");
      const result = await testRow.mutateAsync(id);
      const noLogprobs = result.success && result.logprobs === false;
      if (!result.success || noLogprobs) {
        if (!existing) await deleteRow.mutateAsync(id);
        const message = noLogprobs
          ? t("connections.decision.noLogprobs")
          : decisionConnectionTestMessage(t, result).message;
        mark({
          ...(noLogprobs ? { label: message } : failLabel(message)),
          state: "needs_key",
          detail: message,
        });
        return false;
      }
      mark(null);
      commit(id, choice.name ?? model);
    } catch (error) {
      if (!existing && id) await deleteRow.mutateAsync(id).catch(() => undefined);
      const message = error instanceof Error && error.message ? error.message : "";
      mark({
        label: t("connections.decision.errors.network"),
        state: "needs_key",
        ...(message ? { detail: message } : {}),
      });
      return false;
    }
  };

  const mediaKind = kind === "image" || kind === "video" || kind === "audio";
  const applyMedia = async (choice: ChatModelChoice) => {
    // A saved Model needs no new row: commit it, or the picker stays open on a row without an account.
    if (!choice.model) return apply(choice);
    const anchor = (rows as ConnectionModelRow[] | undefined)?.find(
      (row) => row.id === choice.connectionId || row.accountId === choice.connectionId,
    );
    const account = accounts?.find((item) => item.id === anchor?.accountId);
    const model = choice.model ?? anchor?.model;
    if (!account || !model || !mediaSources(account.provider, kind as MediaKind).length) return false;
    const id = await mediaRowFor(
      kind as MediaKind,
      account,
      model,
      choice.name,
      (rows ?? []) as Parameters<typeof mediaRowFor>[4],
      (data) => createRow.mutateAsync(data),
    );
    if (!id) throw new Error(t("connections.add.mediaCreateFailed"));
    if (id === value) return keep(id);
    commit(id, choice.name ?? model);
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
    // A saved Model keeps "" when it has no embedding model of its own: it then embeds with its own model id.
    const model = choice.model ?? (row?.embeddingModel?.trim() || row?.model?.trim());
    if (!row || !model) return false;
    // The row's line is keyed by the model it shows: the catalog pick, or the saved Model's own id.
    const shown = choice.model ?? row.model ?? model;
    const key = row.accountId ? `${row.accountId}|${shown}` : shown;
    const mark = (next: TriedState | null) =>
      setTried((tries) => {
        const { [key]: _drop, ...rest } = tries;
        return next ? { ...rest, [key]: next } : rest;
      });
    mark({ label: t("connections.decision.testing"), state: "off" });
    let id = row.id;
    let before: string | null = row.embeddingModel ?? null;
    // A catalog pick saves a new Model first; one that cannot embed is removed again, so a failed try adds nothing.
    let created = false;
    try {
      if (choice.model && row.accountId) {
        const saved = await pickModel.mutateAsync({
          accountId: row.accountId,
          model: choice.model,
          ...(choice.name ? { name: choice.name } : {}),
        });
        id = saved.connectionId;
        const existing = all?.find((item) => item.id === id);
        created = !existing;
        before = existing?.embeddingModel ?? null;
      }
      await updateRow.mutateAsync({ id, embeddingModel: model });
      const result = await testEmbedding.mutateAsync(id);
      if (!result.success) {
        if (created) await deleteRow.mutateAsync(id).catch(() => undefined);
        else await updateRow.mutateAsync({ id, embeddingModel: before ?? "" });
        const message = result.message?.trim() || t("connections.embeddingDefault.failed");
        mark({ ...failLabel(message), state: "needs_key", detail: message });
        return false;
      }
      mark(null);
      commit(id, choice.name ?? model);
    } catch (error) {
      if (created) await deleteRow.mutateAsync(id).catch(() => undefined);
      const message = error instanceof Error && error.message ? error.message : "";
      mark({
        label: t("connections.embeddingDefault.failed"),
        state: "needs_key",
        ...(message ? { detail: message } : {}),
      });
      return false;
    }
  };

  // Decision assignments use a separate tested row; highlight the matching provider model in the shared list.
  const assigned = (rows as ConnectionModelRow[] | undefined)?.find((row) => row.id === value);
  const decisionPeers =
    decision && assigned?.accountId
      ? (rows as ConnectionModelRow[] | undefined)?.filter(
          (row) => row.accountId === assigned.accountId && isChatProvider(row.provider),
        )
      : undefined;
  const decisionAnchor = decisionPeers?.find((row) => row.model === assigned?.model) ?? decisionPeers?.[0];
  const currentChoice =
    decisionAnchor && assigned?.model
      ? {
          connectionId: decisionAnchor.id,
          ...(decisionAnchor.model !== assigned.model
            ? { model: assigned.model, name: assigned.name || assigned.model }
            : {}),
        }
      : !decision && value && !extraOptions.some((extra) => extra.value === value)
        ? { connectionId: value }
        : null;

  const onAdd = () => {
    known.current = new Set((accounts ?? []).map((account) => account.id));
    openAddConnection(jobKey ? { job: jobKey, assign: onChangeRef.current, previous: value } : undefined);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-2xl"
      opaque
      panelClassName="connection-picker-dialog mari-connection-scope h-[min(36rem,calc(var(--mari-visual-viewport-height,100dvh)-1.5rem))]"
      closeButtonClassName="!min-h-11 !min-w-11"
      restoreFocusRef={restoreFocusRef}
      contentClassName="flex flex-col !overflow-hidden !p-0"
    >
      {header}
      <ConnectionSwitcherBody
        ownRole={jobName}
        kind={decision ? "chat" : kind}
        rowFilter={rowFilter}
        catalogBrowse
        showUnstarred
        accountFilter={
          mediaKind ? (account) => mediaSources(account.provider, kind as MediaKind).length > 0 : undefined
        }
        catalogAnchor={
          mediaKind
            ? (account, all) => all.find((row) => row.accountId === account.id && row.provider === account.provider)
            : undefined
        }
        current={currentChoice}
        onApply={decision ? applyDecision : embedding ? applyEmbedding : mediaKind ? applyMedia : apply}
        onDone={onClose}
        confirmCurrent={confirmCurrent || decision}
        showLocalModel={includeLocalSidecar}
        followDefault={
          includeDefault
            ? {
                active: !value,
                own: kind !== "chat" || decision || embedding || unsetIsOwn,
                label: defaultText,
                onSelect: async () => {
                  if (value) commit(null);
                  else keep(null);
                },
              }
            : undefined
        }
        knownGood={
          decision
            ? {
                label: t("connections.decision.knownGood"),
                test: (accountId, model, facts) =>
                  !!facts?.capabilities?.logprobs ||
                  decisionRows.has(`${accountId}|${model}`) ||
                  nativeDecision(accounts?.find((item) => item.id === accountId)?.provider ?? "", facts),
              }
            : undefined
        }
        leadCatalog={
          decision
            ? {
                label: t("connections.decision.nativeModels"),
                restLabel: t("connections.decision.chatModels"),
                test: (provider, _model, facts) => nativeDecision(provider, facts),
                // Gemini answers no chat model's log-probabilities: a chat pick there would save a row that cannot run.
                only: (provider) => !!NATIVE_DECISION_SOURCE[provider as ServiceId] && !speaksOpenAIChat(provider),
              }
            : undefined
        }
        rowState={decision || embedding ? (accountId, model) => tried[`${accountId}|${model}`] ?? null : undefined}
        extras={[
          ...extraOptions,
          ...(decision
            ? (decisionOptions.data?.options ?? [])
                .filter((option) => option.group === "connection" && !option.unavailable)
                .map((option) => {
                  const row = (
                    rows as
                      | Array<{
                          id: string;
                          model?: string | null;
                          accountId?: string | null;
                          decisionSource?: string | null;
                        }>
                      | undefined
                  )?.find((item) => item.id === option.id);
                  const account = row?.accountId ? accounts?.find((item) => item.id === row.accountId) : undefined;
                  // Line 2 says where the Model lives: its account, or its decision source when it has none (#9317).
                  return {
                    value: option.id,
                    icon: <ProviderIcon provider={account?.provider ?? "custom"} size="sm" />,
                    label: row?.model?.trim() || option.label,
                    subtitle:
                      account?.name ||
                      (row?.decisionSource ? t(`connections.decision.sources.${row.decisionSource}`) : undefined),
                  };
                })
            : []),
        ].map((extra) => ({
          ...extra,
          active: value === extra.value,
          onSelect: async () => {
            if (value !== extra.value) commit(extra.value);
          },
        }))}
        modelFilter={embedding ? isEmbeddingModel : undefined}
        catalogFilter={
          rowFilter
            ? (_model, facts) => !facts?.inputModalities?.length || facts.inputModalities.includes("image")
            : undefined
        }
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
            unsetIsOwn: true,
            includeLocalSidecar: false,
            extraOptions: [],
          }
        : {})}
      header={
        // The header bar pads a wrapper: the tab cells must touch the track's edge (ui/Tabs).
        <div className="border-b border-[var(--border)]/40 p-2">
          <Tabs
            items={slots.map((entry) => ({
              id: entry.key,
              label: (
                <>
                  <span className="block text-[0.625rem] text-[var(--muted-foreground)] max-sm:text-[13px]">
                    {entry.label}
                  </span>
                  <span className="block truncate text-xs font-medium">{entry.value}</span>
                </>
              ),
            }))}
            value={slot}
            onChange={setSlot}
            variant="pill"
            label={t("connections.picker.slots")}
          />
        </div>
      }
    />
  );
}

// ModelPicker — the one window that picks a Model for a job (Main, Agents, a feature field…).
// The body is the chat switcher's, so every picker lists, stars and searches alike; only the title differs.
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { type ChatModelChoice, type ConnectionPickerKind } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { usePickModel, useConnectionAccounts } from "../../hooks/use-connection-accounts";
import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
  useTestConnection,
} from "../../hooks/use-connections";
import { useDecisionOptions } from "../../hooks/use-decision-model";
import { decisionConnectionTestMessage } from "../../lib/decision-test-message";
import type { ConnectionModelRow } from "../../lib/connection-groups";
import { openAddConnection } from "../../lib/add-connection";
import { ConnectionSwitcherBody } from "./ConnectionSwitcherBody";

type Extra = { value: string; label: string };

const PASSED_KEY = "marinara-decision-passed";
const readDecisionPasses = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(PASSED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};
const rememberDecisionPass = (key: string) => {
  try {
    localStorage.setItem(PASSED_KEY, JSON.stringify([...readDecisionPasses().add(key)]));
  } catch {
    /* a private window keeps nothing; the catalog's own flag still marks models */
  }
};

export function ModelPicker({
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
  restoreFocusRef,
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
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const pickModel = usePickModel();
  const { data: rows } = useConnections();
  const { data: accounts } = useConnectionAccounts();
  const decision = kind === "decision";
  const createRow = useCreateConnection();
  const deleteRow = useDeleteConnection();
  const testRow = useTestConnection();
  const decisionOptions = useDecisionOptions(decision && open);
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
          label: noLogprobs ? t("connections.decision.noLogprobs") : decisionConnectionTestMessage(t, result).message,
          state: "needs_key",
        });
        return false;
      }
      rememberDecisionPass(key);
      mark(null);
      commit(id, choice.name ?? model);
    } catch {
      if (!existing && id) await deleteRow.mutateAsync(id).catch(() => undefined);
      mark({ label: t("connections.decision.errors.network"), state: "needs_key" });
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
      <ConnectionSwitcherBody
        layout="steps"
        kind={decision ? "chat" : kind}
        rowFilter={rowFilter}
        catalogBrowse={(kind === "chat" || decision) && !rowFilter}
        current={
          !decision && value && !extraOptions.some((extra) => extra.value === value) ? { connectionId: value } : null
        }
        onApply={decision ? applyDecision : apply}
        onDone={onClose}
        showLocalModel={includeLocalSidecar}
        followDefault={
          includeDefault
            ? {
                active: !value,
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
                  !!facts?.capabilities?.logprobs || readDecisionPasses().has(`${accountId}|${model}`),
              }
            : undefined
        }
        rowState={decision ? (accountId, model) => tried[`${accountId}|${model}`] ?? null : undefined}
        extras={[
          ...extraOptions,
          ...(decision
            ? (decisionOptions.data?.options ?? [])
                .filter((option) => option.group === "connection" && !option.unavailable)
                .map((option) => ({ value: option.id, label: option.label }))
            : []),
        ].map((extra) => ({
          ...extra,
          active: value === extra.value,
          onSelect: async () => {
            if (value !== extra.value) commit(extra.value);
          },
        }))}
        pickerFooter=""
        onAdd={onAdd}
        firstAccountId={firstAccountId}
        autoFocusSearch={typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches}
        className="flex min-h-0 flex-1 flex-col"
      />
    </Modal>
  );
}

// ModelPicker — the one window that picks a Model for a job (Main, Agents, a feature field…).
// The body is the chat switcher's, so every picker lists, stars and searches alike; only the title differs.
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { type ChatModelChoice, type ConnectionPickerKind } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { usePickModel, useConnectionAccounts } from "../../hooks/use-connection-accounts";
import { useConnections } from "../../hooks/use-connections";
import type { ConnectionModelRow } from "../../lib/connection-groups";
import { openAddConnection } from "../../lib/add-connection";
import { ConnectionSwitcherBody } from "./ConnectionSwitcherBody";

type Extra = { value: string; label: string };

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
  const known = useRef<Set<string> | null>(null);
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

  const commit = (next: string | null) => {
    const previous = value;
    onChange(next);
    toast.success(t("connections.picker.nowUses", { job: jobName, model: nameOf(next) }), {
      duration: 8000,
      action: { label: t("connections.switcher.undo"), onClick: () => onChange(previous) },
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
    commit(id);
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
        kind={kind}
        rowFilter={rowFilter}
        catalogBrowse={kind === "chat" && !rowFilter}
        current={value && !extraOptions.some((extra) => extra.value === value) ? { connectionId: value } : null}
        onApply={apply}
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
        extras={extraOptions.map((extra) => ({
          ...extra,
          active: value === extra.value,
          onSelect: async () => {
            if (value !== extra.value) commit(extra.value);
          },
        }))}
        onAdd={onAdd}
        firstAccountId={firstAccountId}
        autoFocusSearch={typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches}
        className="flex min-h-0 flex-1 flex-col"
      />
    </Modal>
  );
}

// Live address and key status for the account forms: the icon inside the field and the line under it.
import { AlertCircle, Check, Loader2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AccessCheck } from "../../hooks/use-connections";
import { cn } from "../../lib/utils";

export type FieldCheckState = "idle" | "checking" | "ok" | "warn" | "bad" | "busy";
export type FieldCheck = { state: FieldCheckState; text: string };

const IDLE: FieldCheck = { state: "idle", text: "" };

/** What one check answer means for the address field and the key field. */
export function accessCheckFields(
  check: { result?: AccessCheck; checking: boolean },
  input: { hasAddress: boolean; hasKey: boolean },
  t: (key: string, options?: Record<string, unknown>) => string,
): { address: FieldCheck; key: FieldCheck } {
  if (check.checking) {
    const busy: FieldCheck = { state: "checking", text: t("connections.check.checking") };
    return { address: input.hasAddress ? busy : IDLE, key: input.hasKey ? busy : IDLE };
  }
  const result = check.result;
  if (!result?.supported) return { address: IDLE, key: IDLE };
  const rejected = result.status === 401 || result.status === 403;

  let address = IDLE;
  if (input.hasAddress) {
    if (result.blocked) address = { state: "warn", text: t("connections.check.blocked") };
    else if (!result.reachable) address = { state: "warn", text: t("connections.check.noAnswer") };
    else if (result.transient)
      address = { state: "busy", text: t("connections.check.busy", { status: result.status ?? "" }) };
    else if (result.error && !rejected)
      address = { state: "warn", text: t("connections.check.wrongAddress", { status: result.status ?? "" }) };
    else if (rejected && !input.hasKey) address = { state: "ok", text: t("connections.check.needsKey") };
    else if (result.modelCount != null && !input.hasKey)
      address = { state: "ok", text: t("connections.check.serverModels", { count: result.modelCount }) };
    else address = { state: "ok", text: t("connections.check.serverAnswers") };
  }

  let key = IDLE;
  if (input.hasKey && result.keyOk === true)
    key = {
      state: "ok",
      text:
        result.modelCount != null
          ? t("connections.check.keyWorksModels", { count: result.modelCount })
          : t("connections.check.keyWorks"),
    };
  else if (input.hasKey && result.keyOk === false)
    key = { state: "bad", text: t("connections.check.keyRejected", { status: result.status ?? "" }) };
  return { address, key };
}

export const checkBorderClass = (state: FieldCheckState) =>
  state === "ok"
    ? "border-emerald-500/50"
    : state === "warn"
      ? "border-[var(--warning)]/60"
      : state === "bad"
        ? "border-[var(--destructive)]/60"
        : "";

/** Sits at the right end inside the field (the field needs `relative` and right padding), or in a row when `inline`. */
export function CheckIcon({ state, inline = false }: { state: FieldCheckState; inline?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none flex shrink-0 items-center",
        !inline && "absolute right-3 top-1/2 -translate-y-1/2",
      )}
    >
      {state === "checking" && <Loader2 size="1rem" className="animate-spin text-[var(--muted-foreground)]" />}
      {state === "ok" && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Check size="0.75rem" strokeWidth={3} />
        </span>
      )}
      {state === "warn" && <AlertCircle size="1rem" className="text-[var(--warning)]" />}
      {state === "bad" && <XCircle size="1rem" className="text-[var(--destructive)]" />}
    </span>
  );
}

/** The line under the field; a failed check offers to check again. */
export function CheckLine({ id, check, onRecheck }: { id: string; check: FieldCheck; onRecheck?: () => void }) {
  const { t } = useTranslation();
  if (check.state === "idle") return null;
  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      className={cn(
        "text-[0.6875rem]",
        check.state === "ok" && "text-emerald-500",
        check.state === "warn" && "text-[var(--warning)]",
        check.state === "bad" && "text-[var(--destructive)]",
        (check.state === "checking" || check.state === "busy") && "text-[var(--muted-foreground)]",
      )}
    >
      {check.text}
      {onRecheck && (check.state === "warn" || check.state === "bad" || check.state === "busy") && (
        <>
          {" · "}
          <button
            type="button"
            onClick={onRecheck}
            className="font-medium text-[var(--foreground)] underline decoration-[var(--muted-foreground)] underline-offset-2 hover:decoration-[var(--foreground)]"
          >
            {t("connections.check.again")}
          </button>
        </>
      )}
    </p>
  );
}

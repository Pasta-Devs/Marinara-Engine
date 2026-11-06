import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api, ApiError, getPrivilegedActionErrorMessage } from "../../../lib/api-client";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { toast } from "sonner";
import { useUIStore } from "../../../stores/ui.store";
import { useAccessStatus, visiblePasswordlessPeers } from "../../diagnostics/use-access-warning-banner";
import { useLoginSetupCode } from "../../../hooks/use-remote-login";
import { LOGIN_USER_INPUT_ID, RemoteLoginSettings, SetupCodeLoginForm } from "./RemoteLoginSettings";
import { SETTINGS_BUTTON_CLASS, SettingsSection } from "./SettingControls";

const LINK_BUTTON_CLASS =
  "inline-flex min-h-11 items-center text-left font-semibold text-[var(--foreground)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--ring)]";

function focusLoginForm() {
  const input = document.getElementById(LOGIN_USER_INPUT_ID);
  input?.scrollIntoView({ block: "center", behavior: "smooth" });
  input?.focus({ preventScroll: true });
}

/** Matches the privileged gate's refusals, so each one names its own next step. */
function refusalKey(error: Error) {
  if (!(error instanceof ApiError)) return "settings.accessStatus.loadFailed";
  if (error.status === 421) return "settings.accessStatus.hostRefused";
  if (error.status !== 403) return "settings.accessStatus.loadFailed";
  if (error.message.startsWith("ADMIN_SECRET is required")) return "settings.accessStatus.secretNotSet";
  if (error.message.includes("requires authenticated access")) return "settings.accessStatus.loginRequired";
  return "settings.accessStatus.ownerOnly";
}

/** Settings > Advanced > Access: owner-only summary of who gets in without a password. Others see one line. */
export function AccessStatusSettings({ anchorId }: { anchorId: string }) {
  const { t } = useTranslation();
  const { data, error } = useAccessStatus();
  const refused = error instanceof ApiError && error.status === 403 && !data;
  const setup = useLoginSetupCode(refused);
  if (error && !data) {
    return (
      <SettingsSection title={t("settings.accessStatus.title")} icon={<Shield size="0.875rem" />} anchorId={anchorId}>
        <div className="flex flex-col gap-3 text-xs">
          {/* No login yet: another device may set it with the setup code from the server log. */}
          {setup.data?.waiting ? (
            <SetupCodeLoginForm docker={setup.data.docker} />
          ) : (
            <p className="text-[var(--muted-foreground)]">{t(refusalKey(error))}</p>
          )}
        </div>
      </SettingsSection>
    );
  }
  if (!data) return null;

  const peers = visiblePasswordlessPeers(data.passwordlessPeers);
  const keptOpen = peers.filter((peer) => data.loginKeepsOpen.includes(peer));
  const open = peers.length > 0;
  const setOrNot = (value: boolean) => t(value ? "settings.accessStatus.set" : "settings.accessStatus.notSet");
  const rows = [
    [
      "listen",
      data.loopbackOnly
        ? t("settings.accessStatus.listen.loopback")
        : t("settings.accessStatus.listen.network", { host: data.host }),
    ],
    ["login", setOrNot(data.basicAuth)],
    ["adminSecret", setOrNot(data.adminSecret)],
    ["allowlist", setOrNot(data.allowlist)],
    ["authProxy", setOrNot(data.trustedAuthProxy)],
    [
      "connection",
      t(data.viaProxy ? "settings.accessStatus.connection.proxy" : "settings.accessStatus.connection.direct"),
    ],
  ];

  return (
    <SettingsSection
      title={t("settings.accessStatus.title")}
      description={t("settings.accessStatus.description")}
      icon={open ? <ShieldAlert size="0.875rem" /> : <ShieldCheck size="0.875rem" />}
      anchorId={anchorId}
    >
      <div className="flex flex-col gap-3 text-xs">
        {open ? (
          <div className="rounded-lg border border-[var(--marinara-chat-chrome-accent)]/40 bg-[var(--marinara-chat-chrome-accent)]/15 p-3">
            <p className="font-semibold text-[var(--foreground)]">{t("settings.accessStatus.peersIntro")}</p>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-[var(--foreground)]">
              {peers.map((peer) => (
                <li key={peer}>{t(`settings.accessStatus.peer.${peer}`)}</li>
              ))}
            </ul>
            {peers.includes("docker") && (
              <p className="mt-2 text-[var(--muted-foreground)]">{t("settings.accessStatus.dockerHint")}</p>
            )}
            {keptOpen.length < peers.length && (
              <>
                <p className="mt-2 text-[var(--muted-foreground)]">{t("settings.accessStatus.nextStep")}</p>
                <button type="button" onClick={focusLoginForm} className={LINK_BUTTON_CLASS}>
                  {t("settings.accessStatus.setBelow")}
                </button>
              </>
            )}
            {keptOpen.map((peer) => (
              <p key={peer} className="mt-2 text-[var(--muted-foreground)]">
                {t(`settings.accessStatus.fix.${peer}`)}
              </p>
            ))}
            {keptOpen.length > 0 && (
              <button
                type="button"
                onClick={() => useUIStore.getState().openModal("docs-viewer", { initialDoc: "REMOTE_ACCESS.md" })}
                className={LINK_BUTTON_CLASS}
              >
                {t("settings.accessStatus.guide")}
              </button>
            )}
          </div>
        ) : (
          <p className="text-[var(--muted-foreground)]">{t("settings.accessStatus.closed")}</p>
        )}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          {rows.map(([key, value]) => (
            <Fragment key={key}>
              <dt className="text-[var(--muted-foreground)]">{t(`settings.accessStatus.row.${key}`)}</dt>
              <dd className="min-w-0 break-words text-[var(--foreground)]">{value}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          {t("settings.accessStatus.unknown")}
        </p>
        <RemoteLoginSettings status={data} />
      </div>
    </SettingsSection>
  );
}

/**
 * Settings > Advanced > Admin Access: make or remove the admin secret in the
 * app. The server only lets this computer or a holder of the current secret do
 * it; `onSaved` keeps this browser's copy in step.
 */
export function AdminSecretMaker({ onSaved }: { onSaved: (secret: string) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useAccessStatus();
  const [shown, setShown] = useState<string | null>(null);
  const envWins = data?.adminSecretSource === "env";
  const done = (secret: string) => {
    onSaved(secret);
    setShown(secret || null);
    void qc.invalidateQueries({ queryKey: ["access-status"] });
  };
  const make = useMutation({
    mutationFn: () => api.post<{ secret: string }>("/access/admin-secret"),
    onSuccess: ({ secret }) => done(secret),
    onError: (error) =>
      toast.error(getPrivilegedActionErrorMessage(error, t("settings.sections.adminAccess.makeFailed"))),
  });
  const remove = useMutation({
    mutationFn: () => api.delete("/access/admin-secret"),
    // While .env wins, this browser keeps its copy: that is the .env secret.
    onSuccess: () => (envWins ? void qc.invalidateQueries({ queryKey: ["access-status"] }) : done("")),
    onError: (error) =>
      toast.error(getPrivilegedActionErrorMessage(error, t("settings.sections.adminAccess.removeFailed"))),
  });
  if (!data) return null;
  // Only this computer or a holder of the current secret may change it.
  const canChange = !data.needsCurrentPassword;
  if (envWins) {
    return (
      <div className="flex flex-col gap-2 text-xs text-[var(--muted-foreground)]">
        <p>{t("settings.sections.adminAccess.envManaged")}</p>
        {canChange && data.adminSecretStored && (
          <>
            <p>{t("settings.sections.adminAccess.storedUnused")}</p>
            <div>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
                className={SETTINGS_BUTTON_CLASS}
              >
                {t("settings.sections.adminAccess.remove")}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }
  if (!canChange) {
    return <p className="text-xs text-[var(--muted-foreground)]">{t("settings.sections.adminAccess.elsewhere")}</p>;
  }

  const fromApp = data.adminSecretSource === "app";
  const confirmThen = async (kind: "replace" | "remove", run: () => void) => {
    const confirmed = await showConfirmDialog({
      title: t(`settings.sections.adminAccess.${kind}Confirm.title`),
      message: t(`settings.sections.adminAccess.${kind}Confirm.message`),
      confirmLabel: t(`settings.sections.adminAccess.${kind}`),
      tone: "destructive",
    });
    if (confirmed) run();
  };
  const busy = make.isPending || remove.isPending;
  return (
    <div className="flex flex-col gap-2 text-xs">
      {!fromApp && <p className="text-[var(--muted-foreground)]">{t("settings.sections.adminAccess.none")}</p>}
      {shown && (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="font-mono text-sm text-[var(--foreground)] select-all break-all">{shown}</p>
          <p className="mt-1 text-[var(--muted-foreground)]">{t("settings.sections.adminAccess.madeHint")}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => (fromApp ? void confirmThen("replace", () => make.mutate()) : make.mutate())}
          className={SETTINGS_BUTTON_CLASS}
        >
          {t(fromApp ? "settings.sections.adminAccess.replace" : "settings.sections.adminAccess.make")}
        </button>
        {fromApp && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirmThen("remove", () => remove.mutate())}
            className={SETTINGS_BUTTON_CLASS}
          >
            {t("settings.sections.adminAccess.remove")}
          </button>
        )}
      </div>
    </div>
  );
}

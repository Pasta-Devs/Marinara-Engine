// ──────────────────────────────────────────────
// Settings > Advanced > Access: the app login, signed-in devices and "Add a device"
// ──────────────────────────────────────────────
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useCreatePairingCode,
  useEndOtherSessions,
  useEndSession,
  useRemoteSessions,
  useRemoveRemoteLogin,
  useSetRemoteLogin,
  type RemoteSession,
} from "../../../hooks/use-remote-login";
import { ApiError } from "../../../lib/api-client";
import { formatRelativeContact } from "../../../lib/relative-time";
import type { AccessStatus } from "../../diagnostics/use-access-warning-banner";
import { SETTINGS_BUTTON_CLASS, SETTINGS_PRIMARY_BUTTON_CLASS } from "./SettingControls";

/** Same as MIN_LOGIN_PASSWORD_LENGTH on the server, which checks it again. */
const MIN_PASSWORD_LENGTH = 10;
/** Same as PAIRING_CODE_TTL_MS on the server. */
const PAIRING_CODE_TTL_MS = 5 * 60_000;
/** "Set it below" focuses this field. */
// The placeholder stays in the copy: a literal "<container>" would read as markup in the catalog.
const CONTAINER = { container: "<container>" };
// The shape of the setup code, not words to translate.
const CODE_SHAPE = "XXXX-XXXX-XXXX-XXXX";
export const LOGIN_USER_INPUT_ID = "remote-login-user";

const BLOCK_CLASS = "flex flex-col gap-2 border-t border-[var(--border)] pt-3";
const HEADING_CLASS = "font-semibold text-[var(--foreground)]";
const HINT_CLASS = "text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]";
const ERROR_CLASS = "text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]";
const LABEL_CLASS = "flex flex-col gap-1 text-[0.625rem] font-semibold text-[var(--muted-foreground)]";
const INPUT_CLASS =
  "w-full min-w-0 rounded-lg bg-[var(--background)] px-3 py-2 text-xs font-normal text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]";

/** Owner controls; shown only after /api/access/status answered, so the caller is the owner. */
export function RemoteLoginSettings({ status }: { status: AccessStatus }) {
  const hasLogin = status.loginSource !== null;
  return (
    <>
      <LoginForm
        loginSource={status.loginSource}
        loginUser={status.loginUser}
        needsCurrentPassword={hasLogin && status.needsCurrentPassword}
      />
      {hasLogin && <SignedInDevices />}
      {hasLogin && <AddDevice />}
    </>
  );
}

/** A device that is not this computer, while no login is set: the setup code stands in for the owner. */
export function SetupCodeLoginForm({ docker }: { docker: boolean }) {
  return <LoginForm loginSource={null} loginUser={null} needsCurrentPassword={false} setupCode={{ docker }} />;
}

/** The server's reason, so a wrong current password or setup code says so. */
function loginErrorText(error: Error | null, t: ReturnType<typeof useTranslation>["t"]) {
  const payload = error instanceof ApiError ? (error.payload as { reason?: string; retryAfter?: number }) : null;
  if (payload?.retryAfter) {
    return t("settings.accessStatus.login.error.tooMany", { count: Math.ceil(payload.retryAfter / 60) });
  }
  if (payload?.reason === "currentPassword") return t("settings.accessStatus.login.error.currentPassword");
  if (payload?.reason === "setupCode") return t("settings.accessStatus.login.error.setupCode");
  return t("settings.accessStatus.login.failed");
}

function LoginForm({
  loginSource,
  loginUser,
  needsCurrentPassword,
  setupCode,
}: {
  loginSource: AccessStatus["loginSource"];
  loginUser: string | null;
  needsCurrentPassword: boolean;
  setupCode?: { docker: boolean };
}) {
  const { t } = useTranslation();
  const [user, setUser] = useState(loginUser ?? "");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const save = useSetRemoteLogin();
  const remove = useRemoveRemoteLogin();
  const hasLogin = loginSource !== null;

  if (loginSource === "env") {
    return (
      <div className={BLOCK_CLASS}>
        <p className={HEADING_CLASS}>{t("settings.accessStatus.login.title")}</p>
        <p className={HINT_CLASS}>{t("settings.accessStatus.login.fromEnv")}</p>
      </div>
    );
  }

  const valid =
    user.trim() !== "" &&
    !user.includes(":") &&
    password.length >= MIN_PASSWORD_LENGTH &&
    (!needsCurrentPassword || currentPassword !== "") &&
    (!setupCode || code.trim() !== "");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    try {
      await save.mutateAsync({
        user: user.trim(),
        password,
        ...(setupCode ? { setupCode: code } : {}),
        ...(needsCurrentPassword ? { currentPassword } : {}),
      });
      setPassword("");
      setCurrentPassword("");
      toast.success(t(hasLogin ? "settings.accessStatus.login.changed" : "settings.accessStatus.login.saved"));
    } catch {
      /* shown below the form */
    }
  };
  const removeLogin = () => {
    if (window.confirm(t("settings.accessStatus.login.removeConfirm"))) {
      remove.mutate(needsCurrentPassword ? currentPassword : undefined);
    }
  };
  const error = save.error ?? remove.error;

  return (
    <form onSubmit={submit} className={BLOCK_CLASS}>
      <p className={HEADING_CLASS}>{t("settings.accessStatus.login.title")}</p>
      <p className={HINT_CLASS}>
        {t(
          setupCode
            ? "settings.accessStatus.login.setupCodeHint"
            : hasLogin
              ? "settings.accessStatus.login.changeHint"
              : "settings.accessStatus.login.setHint",
        )}
      </p>
      {setupCode && (
        <>
          {setupCode.docker && (
            <p className={`${HINT_CLASS} break-words`}>{t("settings.accessStatus.login.setupCodeDocker", CONTAINER)}</p>
          )}
          <label className={LABEL_CLASS}>
            {t("settings.accessStatus.login.setupCode")}
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={CODE_SHAPE}
              required
              className={`${INPUT_CLASS} font-mono`}
            />
          </label>
        </>
      )}
      {needsCurrentPassword && (
        <>
          <label className={LABEL_CLASS}>
            {t("settings.accessStatus.login.currentPassword")}
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
              aria-describedby="remote-login-current-hint"
              className={INPUT_CLASS}
            />
          </label>
          <p id="remote-login-current-hint" className={HINT_CLASS}>
            {t("settings.accessStatus.login.currentPasswordHint")} {t("settings.accessStatus.login.forgot", CONTAINER)}
          </p>
        </>
      )}
      <label className={LABEL_CLASS}>
        {t("settings.accessStatus.login.user")}
        <input
          id={LOGIN_USER_INPUT_ID}
          value={user}
          onChange={(event) => setUser(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={128}
          required
          className={INPUT_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        {t(hasLogin ? "settings.accessStatus.login.newPassword" : "settings.accessStatus.login.password")}
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={1024}
          required
          aria-describedby="remote-login-password-hint"
          className={INPUT_CLASS}
        />
      </label>
      <p id="remote-login-password-hint" className={HINT_CLASS}>
        {t("settings.accessStatus.login.passwordHint", { count: MIN_PASSWORD_LENGTH })}
      </p>
      {error && (
        <p role="alert" className={ERROR_CLASS}>
          {loginErrorText(error, t)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!valid || save.isPending} className={SETTINGS_PRIMARY_BUTTON_CLASS}>
          {t(hasLogin ? "settings.accessStatus.login.change" : "settings.accessStatus.login.set")}
        </button>
        {hasLogin && (
          <button
            type="button"
            onClick={removeLogin}
            disabled={remove.isPending || (needsCurrentPassword && currentPassword === "")}
            className={SETTINGS_BUTTON_CLASS}
          >
            {t("settings.accessStatus.login.remove")}
          </button>
        )}
      </div>
    </form>
  );
}

function sessionDetails(session: RemoteSession, t: ReturnType<typeof useTranslation>["t"], language: string) {
  return [
    session.method && t(`settings.accessStatus.devices.method.${session.method}`),
    t("settings.accessStatus.devices.firstSeen", {
      date: new Date(session.createdAt).toLocaleDateString(language, { dateStyle: "medium" }),
    }),
    t("settings.accessStatus.devices.lastActive", {
      time: formatRelativeContact(new Date(session.lastSeenAt).toISOString()) ?? "",
    }),
  ]
    .filter(Boolean)
    .join(" · ");
}

function SignedInDevices() {
  const { t, i18n } = useTranslation();
  const { data: sessions, isError } = useRemoteSessions(true);
  const end = useEndSession();
  const endOthers = useEndOtherSessions();
  const hasOthers = sessions?.some((session) => !session.current) ?? false;
  const endAllOthers = () => {
    if (window.confirm(t("settings.accessStatus.devices.signOutOthersConfirm"))) endOthers.mutate();
  };

  return (
    <div className={BLOCK_CLASS}>
      <p className={HEADING_CLASS}>{t("settings.accessStatus.devices.title")}</p>
      {isError ? (
        <p className={ERROR_CLASS}>{t("settings.accessStatus.devices.loadFailed")}</p>
      ) : sessions?.length === 0 ? (
        <p className={HINT_CLASS}>{t("settings.accessStatus.devices.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {sessions?.map((session) => (
            <li
              key={session.id}
              className="flex min-h-11 items-center gap-2 rounded-lg py-1 pr-1 pl-3 ring-1 ring-[var(--border)]"
            >
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-2 text-[var(--foreground)]">
                  <span className="truncate">{session.label}</span>
                  {session.current && (
                    <span className="shrink-0 rounded-full bg-[var(--marinara-chat-chrome-accent)]/15 px-2 text-[0.625rem] font-semibold text-[var(--foreground)]">
                      {t("settings.accessStatus.devices.thisDevice")}
                    </span>
                  )}
                </p>
                <p className={HINT_CLASS}>{sessionDetails(session, t, i18n.language)}</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  // On a fast server the list updates between the two clicks of a double click, so
                  // the second one would land on the next row's button and sign that device out too.
                  if (event.detail > 1) return;
                  // Ending this browser's own session shows the sign-in page, but only once it ended.
                  end.mutate(session.id, {
                    onSuccess: () => {
                      if (session.current) window.location.assign("/login");
                    },
                  });
                }}
                disabled={end.isPending}
                aria-label={t("settings.accessStatus.devices.signOutNamed", { device: session.label })}
                className={SETTINGS_BUTTON_CLASS}
              >
                {t("settings.accessStatus.devices.signOut")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {(end.isError || endOthers.isError) && (
        <p role="alert" className={ERROR_CLASS}>
          {t("settings.accessStatus.devices.signOutFailed")}
        </p>
      )}
      {hasOthers && (
        <button
          type="button"
          onClick={endAllOthers}
          disabled={endOthers.isPending}
          className={`${SETTINGS_BUTTON_CLASS} self-start`}
        >
          {t("settings.accessStatus.devices.signOutOthers")}
        </button>
      )}
    </div>
  );
}

/** Shown to the owner: this computer or a signed-in device. */
function AddDevice() {
  const { t } = useTranslation();
  const create = useCreatePairingCode();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const timer = window.setTimeout(() => setCode(null), PAIRING_CODE_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [code]);

  const add = async () => {
    try {
      setCode((await create.mutateAsync()).code);
    } catch {
      /* shown below the button */
    }
  };
  const status = create.error instanceof ApiError ? create.error.status : 0;
  const failure = status === 403 ? "notAllowed" : status === 409 ? "needsLogin" : status === 429 ? "tooMany" : "failed";

  return (
    <div className={BLOCK_CLASS}>
      <p className={HEADING_CLASS}>{t("settings.accessStatus.pairing.title")}</p>
      <p className={HINT_CLASS}>{t("settings.accessStatus.pairing.hint")}</p>
      {code ? (
        <div className="flex flex-col items-start gap-2 rounded-lg bg-[var(--background)] p-3 ring-1 ring-[var(--border)]">
          <p
            aria-live="polite"
            className="font-mono text-2xl font-semibold tracking-[0.2em] text-[var(--foreground)] select-all"
          >
            {code}
          </p>
          <p className={HINT_CLASS}>{t("settings.accessStatus.pairing.validity")}</p>
          <button type="button" onClick={() => setCode(null)} className={SETTINGS_BUTTON_CLASS}>
            {t("settings.accessStatus.pairing.done")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={add}
          disabled={create.isPending}
          className={`${SETTINGS_PRIMARY_BUTTON_CLASS} self-start`}
        >
          {t("settings.accessStatus.pairing.add")}
        </button>
      )}
      {create.isError && !code && (
        <p role="alert" className={ERROR_CLASS}>
          {t(`settings.accessStatus.pairing.error.${failure}`)}
        </p>
      )}
    </div>
  );
}

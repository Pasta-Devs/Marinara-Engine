// ──────────────────────────────────────────────
// Theme credits and labels (theming round 5, batch 6)
//
// A theme file can say who made its pictures and fonts and on what terms (meta.credits,
// meta.fonts[].license/credit, meta.license), and carry a few short labels ("High legibility",
// "No motion"). The theme list and the import preview show the labels; the Credits window lists
// the rest, with the SIL Open Font License text the app ships for OFL fonts.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Info } from "lucide-react";
import type { ThemeMeta } from "@marinara-engine/shared";
import { Modal } from "../../ui/Modal";
import { SETTINGS_ICON_BUTTON_CLASS } from "./SettingControls";
import { isReservedThemeLabel } from "../../../lib/theme-package";

/** The real host of a credit link (round 6): the window shows "example.com", never the author's
 *  own link text, so "Marinara support" can't hide where the link goes. */
function creditHost(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Licence texts the app ships (public/licenses), by the short id a theme file uses. */
const BUNDLED_LICENSES: Record<string, { file: string; name: string }> = {
  "ofl-1.1": { file: "licenses/OFL-1.1.txt", name: "SIL Open Font License 1.1" },
};

function bundledLicense(id: string | undefined) {
  if (!id) return null;
  const key = id
    .trim()
    .toLowerCase()
    .replace(/^sil[\s-]*/, "")
    .replace(/\s+/g, "-");
  return BUNDLED_LICENSES[key] ?? BUNDLED_LICENSES[key.replace(/^open-font-license-/, "ofl-")] ?? null;
}

function licenseHref(file: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}${file}`;
}

/** Whether a theme has anything for the Credits window. */
export function themeHasCredits(meta: ThemeMeta | null | undefined) {
  return (
    !!meta && (!!meta.credits?.length || !!meta.license || !!meta.fonts?.some((font) => font.license || font.credit))
  );
}

export function ThemeLabels({ meta, className }: { meta: ThemeMeta | null | undefined; className?: string }) {
  const labels = meta?.labels?.filter((label) => label && !isReservedThemeLabel(label)) ?? [];
  if (labels.length === 0) return null;
  return (
    <span className={className ?? "flex flex-wrap gap-1"} data-theme-labels="">
      {labels.map((label) => (
        <span
          key={label}
          className="max-w-full truncate whitespace-nowrap rounded-full bg-[var(--muted)]/70 px-1.5 py-px text-[0.625rem] leading-4 text-[var(--muted-foreground)] ring-1 ring-[var(--border)]"
          title={label}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

function License({ id }: { id: string | undefined }) {
  if (!id) return null;
  const bundled = bundledLicense(id);
  if (!bundled) return <span className="text-[var(--muted-foreground)]">{id}</span>;
  return (
    <a
      href={licenseHref(bundled.file)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 text-[var(--primary)] underline-offset-2 hover:underline"
    >
      {bundled.name}
      <ExternalLink size="0.625rem" aria-hidden="true" />
    </a>
  );
}

function CreditsBody({ name, meta }: { name: string; meta: ThemeMeta }) {
  const { t } = useTranslation();
  const fonts = (meta.fonts ?? []).filter(
    (font, index, all) => (font.license || font.credit) && all.findIndex((f) => f.family === font.family) === index,
  );
  return (
    <div className="flex flex-col gap-3 text-xs" data-theme-credits="">
      {meta.author || meta.license ? (
        <p className="text-[var(--muted-foreground)]">
          {[meta.author ? t("theming.import.by", "by {{author}}", { author: meta.author }) : name]
            .filter(Boolean)
            .join(" ")}
          {meta.license ? (
            <>
              {" · "}
              <License id={meta.license} />
            </>
          ) : null}
        </p>
      ) : null}
      {meta.credits?.length ? (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("theming.credits.parts", "Pictures and art")}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {meta.credits.map((credit, index) => (
              <li key={`${credit.what}-${index}`} className="flex flex-col">
                <span className="font-medium text-[var(--foreground)]">{credit.what}</span>
                <span className="text-[var(--muted-foreground)]">
                  {credit.by}
                  {credit.url && creditHost(credit.url) ? (
                    <>
                      {" · "}
                      <a
                        href={credit.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        title={credit.url}
                        data-credit-host=""
                        className="inline-flex items-center gap-0.5 text-[var(--primary)] underline-offset-2 hover:underline"
                      >
                        {creditHost(credit.url)}
                        <ExternalLink
                          size="0.75rem"
                          aria-label={t("theming.credits.leaves", "opens outside Marinara")}
                        />
                      </a>
                    </>
                  ) : null}
                  {credit.license ? (
                    <>
                      {" · "}
                      <License id={credit.license} />
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {fonts.length ? (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("theming.credits.fonts", "Fonts")}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {fonts.map((font) => (
              <li key={font.family} className="flex flex-col">
                <span className="font-medium text-[var(--foreground)]">{font.family}</span>
                <span className="text-[var(--muted-foreground)]">
                  {font.credit}
                  {font.credit && font.license ? " · " : null}
                  <License id={font.license} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** The (i) button beside a theme in the list, and its Credits window. */
export function ThemeCreditsButton({ name, meta }: { name: string; meta: ThemeMeta | null | undefined }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!meta || !themeHasCredits(meta)) return null;
  const title = t("theming.credits.title", "Credits: {{name}}", { name });
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={SETTINGS_ICON_BUTTON_CLASS}
        title={t("theming.credits.button", "Credits and licences")}
        aria-label={t("ui.panels.settingspanel.value1Value2", {
          value1: t("theming.credits.button", "Credits and licences"),
          value2: name,
        })}
      >
        <Info size="0.75rem" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <CreditsBody name={name} meta={meta} />
      </Modal>
    </>
  );
}

/** A one-line credits summary for the import preview. */
export function ThemeCreditsSummary({ name, meta }: { name: string; meta: ThemeMeta }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!themeHasCredits(meta)) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 self-start text-[0.6875rem] font-medium text-[var(--primary)] underline-offset-2 hover:underline"
      >
        <Info size="0.6875rem" aria-hidden="true" />
        {t("theming.credits.button", "Credits and licences")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("theming.credits.title", "Credits: {{name}}", { name })}
      >
        <CreditsBody name={name} meta={meta} />
      </Modal>
    </>
  );
}

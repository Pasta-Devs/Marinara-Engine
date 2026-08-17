import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Puzzle } from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import type { PersonalExtensionHostContribution } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import {
  activatePersonalExtensionContribution,
  openPersonalExtensionPanel,
  usePersonalExtensionContributions,
} from "../../lib/personal-extension-contributions";
import { cn } from "../../lib/utils";
import { PersonalExtensionContributionIcon } from "../extensions/PersonalExtensionContributionIcon";

const TOPBAR_CONTRIBUTION_CLASS =
  "mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-95 max-sm:h-7 max-sm:w-7";

function ContributionAttribution({ contribution }: { contribution: PersonalExtensionHostContribution }) {
  const { t } = useTranslation();
  return (
    <span className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
      {t("extensions.contributions.by", { name: contribution.extensionName })}
    </span>
  );
}

export function PersonalExtensionTopbarButtons() {
  const { t: localizeUi } = useUiTranslation();
  const { contributions } = usePersonalExtensionContributions();
  const buttons = contributions
    .filter((contribution) => contribution.kind === "button" && (contribution.surface ?? "top-bar") === "top-bar")
    .slice(0, 2);

  return buttons.map((contribution) => (
    <button
      key={contribution.key}
      type="button"
      onClick={() => activatePersonalExtensionContribution(contribution.key)}
      className={TOPBAR_CONTRIBUTION_CLASS}
      title={localizeUi("ui.layout.personalextensiontopbarbuttons.value1Value2", {
        value1: contribution.label,
        value2: contribution.extensionName,
      })}
      aria-label={localizeUi("ui.layout.personalextensiontopbarbuttons.value1Value2", {
        value1: contribution.label,
        value2: contribution.extensionName,
      })}
    >
      <PersonalExtensionContributionIcon icon={contribution.icon} size={15} />
    </button>
  ));
}

function ContributionRow({
  contribution,
  onActivate,
  opensPanel = false,
}: {
  contribution: PersonalExtensionHostContribution;
  onActivate: () => void;
  opensPanel?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onActivate}
      className="group flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--foreground)] transition-colors group-hover:bg-[var(--card)]">
        <PersonalExtensionContributionIcon icon={contribution.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-[var(--foreground)]">{contribution.label}</span>
        {contribution.description ? (
          <span className="line-clamp-2 block text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
            {contribution.description}
          </span>
        ) : (
          <ContributionAttribution contribution={contribution} />
        )}
      </span>
      {opensPanel && <ChevronRight aria-hidden="true" className="shrink-0 text-[var(--muted-foreground)]" size={14} />}
    </button>
  );
}

export function PersonalExtensionContributionsMenu() {
  const { t } = useTranslation();
  const { contributions } = usePersonalExtensionContributions();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const menuItems = contributions.filter((contribution) => contribution.kind === "menu-item");
  const panels = contributions.filter((contribution) => contribution.kind === "panel");
  const menuContributionCount = menuItems.length + panels.length;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (menuContributionCount === 0) setOpen(false);
  }, [menuContributionCount]);

  if (menuContributionCount === 0) return null;

  const activate = (contribution: PersonalExtensionHostContribution) => {
    activatePersonalExtensionContribution(contribution.key);
    setOpen(false);
  };
  const openPanel = (contribution: PersonalExtensionHostContribution) => {
    if (!openPersonalExtensionPanel(contribution.key)) return;
    useUIStore.getState().openRightPanel("extensions");
    setOpen(false);
  };

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t("extensions.contributions.menuLabel")}
      className="mari-chrome-token-scope fixed right-2 top-[calc(env(safe-area-inset-top)+3rem)] z-[2147482000] max-h-[70vh] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 text-[var(--popover-foreground)] shadow-2xl"
    >
      <div className="flex items-center gap-2 px-2.5 pb-2 pt-1">
        <Puzzle aria-hidden="true" className="text-[var(--primary)]" size={15} />
        <h2 className="text-xs font-semibold">{t("extensions.contributions.title")}</h2>
        <span className="ml-auto rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
          {menuContributionCount}
        </span>
      </div>

      {menuItems.length > 0 && (
        <section aria-label={t("extensions.contributions.tools")}>
          <p className="px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("extensions.contributions.tools")}
          </p>
          {menuItems.map((contribution) => (
            <ContributionRow
              key={contribution.key}
              contribution={contribution}
              onActivate={() => activate(contribution)}
            />
          ))}
        </section>
      )}

      {panels.length > 0 && (
        <section
          aria-label={t("extensions.contributions.panels")}
          className={cn(menuItems.length > 0 && "mt-2 border-t border-[var(--border)] pt-2")}
        >
          <p className="px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("extensions.contributions.panels")}
          </p>
          {panels.map((contribution) => (
            <ContributionRow
              key={contribution.key}
              contribution={contribution}
              onActivate={() => openPanel(contribution)}
              opensPanel
            />
          ))}
        </section>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("extensions.contributions.openMenu")}
        title={t("extensions.contributions.title")}
        className={cn(
          "mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-all active:scale-95 max-sm:h-7 max-sm:w-7",
          open
            ? "bg-[var(--accent)] text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        )}
      >
        <Puzzle aria-hidden="true" size={15} />
        <span className="absolute -right-0.5 -top-0.5 min-w-3.5 rounded-full bg-[var(--primary)] px-1 text-center text-[0.5625rem] font-bold leading-3.5 text-[var(--primary-foreground)]">
          {Math.min(menuContributionCount, 99)}
        </span>
      </button>
      {typeof document === "undefined" ? null : createPortal(menu, document.body)}
    </>
  );
}

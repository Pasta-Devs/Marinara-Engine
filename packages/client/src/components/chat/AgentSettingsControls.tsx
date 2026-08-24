import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Settings2, Trash2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { AgentPromptTemplateOption } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { MacroTextarea } from "../ui/MacroTextarea";

export const AGENT_SETTINGS_SURFACE_CLASS = "border border-[var(--border)] bg-[var(--secondary)]/70";

export function AgentSettingsActionButton({
  variant = "default",
  iconOnly = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger";
  iconOnly?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      className={cn(
        "mari-agent-settings-action",
        variant === "primary" && "mari-agent-settings-action--primary",
        variant === "danger" && "mari-agent-settings-action--danger",
        iconOnly && "mari-agent-settings-action--icon",
        className,
      )}
    />
  );
}

export function AgentCategorySection({
  label,
  icon,
  description,
  count,
  openRequest = false,
  children,
}: {
  label: string;
  icon: ReactNode;
  description: string;
  count?: number;
  openRequest?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openRequest) setOpen(true);
  }, [openRequest]);
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)]/50"
      >
        <span className="text-[var(--muted-foreground)]">{icon}</span>
        <div className="min-w-0 flex-1">
          <span className="text-[0.6875rem] font-semibold">{label}</span>
          {!open && (
            <p className="truncate text-[0.5625rem] leading-tight text-[var(--muted-foreground)]">{description}</p>
          )}
        </div>
        {count != null && count > 0 && (
          <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]">
            {count}
          </span>
        )}
        <ChevronDown
          size="0.625rem"
          className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-1.5 px-3 pb-2.5 pt-2.5">
          <p className="text-[0.5625rem] leading-tight text-[var(--muted-foreground)]">{description}</p>
          {children}
        </div>
      )}
    </div>
  );
}

export function SpriteRangeSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-[var(--secondary)]/50 px-2.5 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--foreground)]">{label}</span>
        <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] tabular-nums text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 w-full cursor-pointer accent-[var(--primary)]"
      />
    </label>
  );
}

export function GenerationSettingsLink({
  onClick,
  title,
  label,
  description,
}: {
  onClick: () => void;
  title: string;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mari-chat-option-field flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--secondary)]/60"
      title={title}
    >
      <Settings2 size="0.8125rem" className="shrink-0 text-[var(--primary)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">{label}</span>
        <span className="mt-0.5 block text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
          {description}
        </span>
      </span>
      <ChevronRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
    </button>
  );
}

export function AgentSettingsSubsection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section data-agent-settings-subsection={id} className="space-y-2 border-t border-[var(--border)] pt-3">
      <div data-agent-settings-subsection-header className="space-y-0.5 px-0.5">
        <h4 className="text-[0.6875rem] font-semibold text-[var(--foreground)]">{title}</h4>
        <p className="text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function AgentSettingsCard({
  id,
  icon,
  title,
  description,
  initialOpen = true,
  badge,
  order,
  onRemove,
  children,
}: {
  id?: string;
  icon: ReactNode;
  title: string;
  description: string;
  initialOpen?: boolean;
  badge?: ReactNode;
  order?: number;
  onRemove?: () => void;
  children?: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const rememberedOpen = useUIStore((state) => (id ? state.chatSettingsExpandedSections[id] : undefined));
  const setSectionExpanded = useUIStore((state) => state.setChatSettingsSectionExpanded);
  const [localOpen, setLocalOpen] = useState(initialOpen);
  const open = id ? (rememberedOpen ?? initialOpen) : localOpen;
  const contentId = useId();
  const toggleLabel = localizeUi(
    open ? "ui.chat.agentsettingscard.collapseValue1" : "ui.chat.agentsettingscard.expandValue1",
    { value1: title },
  );
  const toggleOpen = () => {
    const next = !open;
    if (id) setSectionExpanded(id, next);
    else setLocalOpen(next);
  };

  return (
    <div
      id={id}
      tabIndex={id ? -1 : undefined}
      className={cn(
        "scroll-mt-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/45",
        AGENT_SETTINGS_SURFACE_CLASS,
      )}
      style={order == null ? undefined : { order }}
    >
      <div className="flex items-start p-3">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="-m-1 flex min-w-0 flex-1 items-start gap-2 rounded-lg p-1 text-left transition-colors hover:bg-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]/60"
        >
          {icon}
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] font-medium">
              <span className="min-w-0 truncate">{title}</span>
              {badge}
            </span>
            <span className="mt-1 block text-[0.625rem] text-[var(--muted-foreground)]">{description}</span>
          </span>
          <ChevronRight
            size="0.75rem"
            className={cn("mt-0.5 shrink-0 text-[var(--muted-foreground)] transition-transform", open && "rotate-90")}
          />
        </button>
      </div>
      {open && (
        <div id={contentId} className="space-y-2 px-3 pb-2">
          {children}
        </div>
      )}
      {onRemove && open && (
        <div className="flex justify-end px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/25 transition-colors hover:bg-[var(--primary)]/15 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/55 active:scale-95"
            title={localizeUi("ui.chat.agentsettingscard.removeValue1FromChat", { value1: title })}
            aria-label={localizeUi("ui.chat.agentsettingscard.removeValue1FromChat", { value1: title })}
          >
            <Trash2 size="0.75rem" />
          </button>
        </div>
      )}
    </div>
  );
}

export function AgentSettingsTextarea({
  label,
  value,
  placeholder,
  rows,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">{label}</span>
      <MacroTextarea
        value={value}
        placeholder={placeholder}
        rows={rows ?? 3}
        title={label}
        ariaLabel={label}
        onChange={onChange}
        onBlur={onBlur}
        onExpandedClose={onBlur}
        className="mari-chrome-field min-h-[3.25rem] w-full !rounded-md px-2.5 py-2 pr-8 text-xs leading-relaxed"
      />
    </div>
  );
}

export function AgentSettingsToggle({
  label,
  description,
  enabled,
  onToggle,
  overridden = false,
  onReset,
  surface = "card",
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  overridden?: boolean;
  onReset?: () => void;
  surface?: "card" | "secondary";
}) {
  return (
    <div className="flex h-full flex-col gap-1">
      <SettingsSwitch
        label={label}
        description={description}
        checked={enabled}
        onChange={() => onToggle()}
        labelPosition="start"
        className={cn(
          "flex-1 justify-between rounded-md px-3 py-2.5 text-left",
          enabled
            ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
            : surface === "secondary"
              ? "bg-[var(--secondary)] hover:bg-[var(--accent)]"
              : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
        )}
        labelClassName="text-[0.6875rem] font-medium"
      />
      {onReset ? <AgentDefaultStatus overridden={overridden} onReset={onReset} /> : null}
    </div>
  );
}

export function GamePromptTemplateSelect({
  label,
  description,
  options,
  selectedId,
  fallbackId,
  onChange,
}: {
  label: string;
  description: string;
  options: AgentPromptTemplateOption[];
  selectedId: string;
  fallbackId: string;
  onChange: (promptTemplateId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const activeOption = options.find((option) => option.id === selectedId) ?? options[0];
  return (
    <div className="rounded-lg bg-[var(--background)]/75 px-2.5 py-2 ring-1 ring-[var(--border)]">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.625rem] font-semibold text-[var(--foreground)]">{label}</span>
        <select
          value={activeOption?.id ?? fallbackId}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
        {description}
        {activeOption?.description
          ? localizeUi("ui.chat.gameprompttemplateselect.value1", { value1: activeOption.description })
          : ""}
      </p>
    </div>
  );
}

export function AgentDefaultStatus({ overridden, onReset }: { overridden: boolean; onReset: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex items-center justify-between gap-2 px-1 text-[0.625rem] text-[var(--muted-foreground)]">
      <span>
        {overridden
          ? localizeUi("ui.chat.agentdefaultstatus.chatOverride")
          : localizeUi("ui.chat.agentdefaultstatus.usingAgentDefault")}
      </span>
      {overridden ? (
        <button
          type="button"
          onClick={onReset}
          className="font-medium text-[var(--primary)] transition-opacity hover:opacity-80"
        >
          {localizeUi("ui.chat.agentdefaultstatus.useAgentDefault")}
        </button>
      ) : null}
    </div>
  );
}

export function AgentSettingsSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  columns = 2,
}: {
  value: T;
  options: Array<{ id: T; label: string; description?: string }>;
  onChange: (value: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)]/75 p-1",
        columns === 3 ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            "flex min-h-8 items-center justify-center rounded-md px-2.5 py-2 text-center transition-all",
            value === option.id
              ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-1 ring-[var(--primary)]/35"
              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
          )}
        >
          <span className="block text-[0.6875rem] font-semibold">{option.label}</span>
          {option.description ? <span className="mt-0.5 block text-[0.625rem]">{option.description}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// CharacterSelect — picks characters or personas. One component for every screen, like
// ConnectionSelect: a field (`picker`), a Settings label/value row (`menu`), or no trigger at
// all (`controlled`, the caller's button opens it). Desktop opens a popover at the trigger;
// a phone opens a bottom sheet. Multiple picks apply on each tap; Done only closes.
// ──────────────────────────────────────────────
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { Persona } from "@marinara-engine/shared";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { parseCharacterDisplayData } from "../../lib/character-display";
import type { CharacterIdentityChoice } from "../../lib/character-identity-groups";
import { Modal } from "../ui/Modal";
import { CharacterPickerList, type CharacterPickerListProps } from "./CharacterPickerList";

/** A persona pick: a persona, a character played as the persona, or `null` for None. */
export type PersonaChoice = { persona: string } | { character: string } | null;

type CommonProps = Pick<
  CharacterPickerListProps,
  "exclude" | "nonePicked" | "unavailable" | "badge" | "onCreate" | "withCharacters" | "busy" | "onPickGroup"
> & {
  /** `picker` (default): a field. `menu`: a Settings label/value row. `controlled`: no trigger. */
  variant?: "picker" | "menu" | "controlled";
  /** Left side of the `menu` row. */
  label?: ReactNode;
  /** The window's title. */
  title?: string;
  /** Field text when nothing is picked. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Extra classes for the desktop window, such as the chat surface it opens over. */
  windowClassName?: string;
  id?: string;
  "aria-label"?: string;
  /** Extra rows above the list, such as onboarding templates. */
  header?: ReactNode;
  /** `controlled`: open state, and the element the popover sits next to. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchorRef?: RefObject<HTMLElement | null>;
};

export type CharacterSelectProps = CommonProps &
  (
    | {
        kind: "character";
        multiple?: false;
        value: string | null;
        onChange: (id: string | null) => void;
        allowNone?: boolean;
      }
    | {
        kind: "character";
        multiple: true;
        value: readonly string[];
        onChange: (ids: string[]) => void;
        allowNone?: never;
      }
    | {
        kind: "persona";
        multiple?: false;
        value: PersonaChoice;
        onChange: (value: PersonaChoice) => void;
        allowNone?: boolean;
      }
    | {
        kind: "persona";
        multiple: true;
        value: readonly string[];
        onChange: (ids: string[]) => void;
        allowNone?: never;
      }
  );

const PHONE_QUERY = "(max-width: 767px)";

/** The one id a multiple pick added or removed. */
export const changedId = (prev: readonly string[], next: readonly string[]) =>
  next.find((id) => !prev.includes(id)) ?? prev.find((id) => !next.includes(id));

const toggleId = (ids: readonly string[], id: string) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

type Placement = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

/** Popover next to the anchor: below it, or above when there is more room there. */
function place(anchor: HTMLElement): Placement {
  const rect = anchor.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const width = Math.min(Math.max(rect.width, 352), window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const below = bottom - rect.bottom - 12;
  const above = rect.top - top - 12;
  const openAbove = below < 320 && above > below;
  const maxHeight = Math.max(160, Math.min(448, openAbove ? above : below));
  return openAbove
    ? { left, width, maxHeight, bottom: window.innerHeight - rect.top + 4 }
    : { left, width, maxHeight, top: rect.bottom + 4 };
}

function TriggerAvatars({
  items,
}: {
  items: Array<{ id: string; name: string; src?: string | null; crop?: unknown }>;
}) {
  if (items.length === 0) return null;
  return (
    <span className="flex shrink-0">
      {items.slice(0, 3).map((item, index) =>
        item.src ? (
          // A crop positions the image absolutely and wider than the circle, so the span clips it.
          <span
            key={item.id}
            className={cn(
              "relative h-6 w-6 overflow-hidden rounded-full ring-2 ring-[var(--background)]",
              index > 0 && "-ml-2",
            )}
          >
            <img
              src={item.src}
              alt=""
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(item.crop as Parameters<typeof getAvatarCropStyle>[0])}
            />
          </span>
        ) : (
          <span
            key={item.id}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full bg-foreground/15 text-[0.625rem] font-semibold ring-2 ring-[var(--background)]",
              index > 0 && "-ml-2",
            )}
          >
            {(item.name || "?")[0]?.toUpperCase()}
          </span>
        ),
      )}
    </span>
  );
}

export function CharacterSelect(props: CharacterSelectProps) {
  const {
    kind,
    variant = "picker",
    label,
    title,
    placeholder,
    disabled,
    className,
    open: controlledOpen,
    onOpenChange,
    anchorRef,
  } = props;
  const { t } = useUiTranslation();
  const [openState, setOpenState] = useState(false);
  const open = controlledOpen ?? openState;
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOpenState(next));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const valueId = useId();
  const isPersona = kind === "persona";

  // Picked ids, split by what they are.
  const personaIds: string[] = props.multiple
    ? props.kind === "persona"
      ? [...props.value]
      : []
    : props.kind === "persona" && props.value && "persona" in props.value
      ? [props.value.persona]
      : [];
  const characterIds: string[] = props.multiple
    ? props.kind === "character"
      ? [...props.value]
      : []
    : props.kind === "character"
      ? props.value
        ? [props.value]
        : []
      : props.value && "character" in props.value
        ? [props.value.character]
        : [];

  const { data: rawPersonas } = usePersonas(isPersona && variant !== "controlled");
  const { data: rawCharacters } = useCharacters(variant !== "controlled");
  const items = useMemo(() => {
    const personas = (rawPersonas ?? []) as Persona[];
    const characters = (rawCharacters ?? []) as CharacterIdentityChoice[];
    return [
      ...personaIds
        .map((id) => personas.find((p) => p.id === id))
        .filter((p): p is Persona => Boolean(p))
        .map((p) => ({ id: p.id, name: p.name, src: p.avatarPath, crop: p.avatarCrop })),
      ...characterIds
        .map((id) => characters.find((c) => c.id === id))
        .filter((c): c is CharacterIdentityChoice => Boolean(c))
        .map((c) => {
          const data = parseCharacterDisplayData(c);
          return { id: c.id, name: data.name, src: c.avatarPath, crop: data.avatarCrop };
        }),
    ];
    // personaIds/characterIds are rebuilt each render; their joined text is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPersonas, rawCharacters, personaIds.join(","), characterIds.join(",")]);
  const names = items.map((item) => item.name).join(", ");
  const emptyText =
    placeholder ??
    (props.allowNone || isPersona ? t("ui.game.gamesurfacecomponent.none") : t("ui.characterselect.choose"));
  const windowTitle =
    title ??
    (typeof label === "string" ? label : t(isPersona ? "navigation.topbar.personas" : "ui.characterselect.characters"));

  const close = () => {
    setOpen(false);
    (anchorRef?.current ?? triggerRef.current)?.focus();
  };
  const pickPersona = (id: string | null) => {
    if (props.kind !== "persona") return;
    if (props.multiple) {
      if (id) props.onChange(toggleId(props.value, id));
      return;
    }
    props.onChange(id ? { persona: id } : null);
    close();
  };
  const pickCharacter = (id: string) => {
    if (props.multiple) {
      props.onChange(toggleId(props.value, id));
      return;
    }
    if (props.kind === "persona") props.onChange({ character: id });
    else props.onChange(id);
    close();
  };
  const pickNone =
    props.allowNone && !props.multiple
      ? () => {
          if (props.kind === "persona") props.onChange(null);
          else props.onChange(null);
          close();
        }
      : undefined;

  const list = (
    <CharacterPickerList
      kind={kind}
      multiple={props.multiple}
      personaIds={personaIds}
      characterIds={characterIds}
      onPickPersona={pickPersona}
      onPickCharacter={pickCharacter}
      onPickNone={pickNone}
      onPickGroup={props.onPickGroup}
      withCharacters={props.withCharacters}
      busy={props.busy}
      exclude={props.exclude}
      nonePicked={props.nonePicked}
      unavailable={props.unavailable}
      badge={props.badge}
      onCreate={props.onCreate}
      autoFocusSearch={typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches}
    />
  );
  const footer = props.multiple ? (
    <div className="flex shrink-0 items-center gap-2 border-t border-foreground/10 p-2">
      <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-foreground/55">
        {t("ui.characterselect.picked", { count: items.length })}
      </span>
      <button
        type="button"
        onClick={close}
        className="h-9 rounded-lg bg-[var(--primary)] px-3.5 text-xs font-semibold text-[var(--primary-foreground)] max-md:h-11"
      >
        {t("ui.characterselect.done")}
      </button>
    </div>
  ) : null;

  const trigger = {
    ref: triggerRef,
    type: "button" as const,
    disabled,
    id: props.id,
    "aria-label": props["aria-label"],
    "aria-describedby": props["aria-label"] ? valueId : undefined,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": open,
    onClick: () => setOpen(true),
  };

  return (
    <>
      {variant === "menu" ? (
        <button
          {...trigger}
          className={cn(
            "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-[var(--sidebar-accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] md:min-h-9",
            className,
          )}
        >
          {label && <span className="flex shrink-0 items-center gap-2 text-[var(--foreground)]">{label}</span>}
          <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <TriggerAvatars items={items} />
            <span id={valueId} className={cn("truncate", items.length === 0 && "text-foreground/45")}>
              {items.length > 3 ? items.length : names || emptyText}
            </span>
          </span>
          <ChevronRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
        </button>
      ) : variant === "picker" ? (
        <button
          {...trigger}
          className={cn(
            "mari-chrome-field flex min-h-9 w-full min-w-0 items-center gap-2 px-2 py-1 text-left text-xs max-md:min-h-11",
            className,
          )}
        >
          <TriggerAvatars items={items} />
          <span
            id={valueId}
            title={names || undefined}
            className={cn("min-w-0 flex-1 truncate", items.length === 0 && "text-foreground/45")}
          >
            {names || emptyText}
          </span>
          {items.length > 3 && (
            <span className="shrink-0 rounded-full bg-foreground/10 px-1.5 text-[0.625rem] tabular-nums text-foreground/60">
              +{items.length - 3}
            </span>
          )}
          <ChevronDown size="0.75rem" className="shrink-0 opacity-60" aria-hidden="true" />
        </button>
      ) : null}
      {open && (
        <CharacterSelectWindow
          title={windowTitle}
          anchorRef={anchorRef ?? triggerRef}
          onClose={close}
          footer={footer}
          className={props.windowClassName}
        >
          {props.header}
          {list}
        </CharacterSelectWindow>
      )}
    </>
  );
}

function CharacterSelectWindow({
  title,
  anchorRef,
  onClose,
  footer,
  className,
  children,
}: {
  title: string;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  footer: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useUiTranslation();
  const [phone] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(PHONE_QUERY).matches);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    if (phone) return;
    const update = () => anchorRef.current && setPos(place(anchorRef.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [phone, anchorRef]);

  // Close on a click outside the popover or its trigger, and on Escape.
  useEffect(() => {
    if (phone) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [phone, anchorRef, onClose]);

  // autoFocus misses the search box while the popover is still hidden, so focus it once placed.
  const placed = pos !== null;
  useEffect(() => {
    const panel = panelRef.current;
    if (!placed || !panel || panel.contains(document.activeElement)) return;
    const search = window.matchMedia?.("(pointer: fine)").matches ? panel.querySelector("input") : null;
    (search ?? panel).focus();
  }, [placed]);

  if (phone) {
    return (
      <Modal
        open
        onClose={onClose}
        title={title}
        width="max-w-md"
        restoreFocusRef={anchorRef}
        panelClassName="max-md:mt-auto max-md:h-[85dvh] max-md:rounded-b-none"
        contentClassName="flex flex-col !overflow-hidden !p-0"
      >
        {children}
        {footer}
      </Modal>
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={title}
      data-chat-floating-panel
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        event.stopPropagation();
        onClose();
      }}
      className={cn(
        "fixed z-[10050] flex flex-col overflow-hidden outline-none rounded-xl border border-foreground/10 bg-[var(--background)] shadow-2xl",
        className,
      )}
      style={
        pos
          ? {
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
            }
          : { visibility: "hidden" }
      }
    >
      <div className="flex shrink-0 items-center gap-1 py-1 pl-3.5 pr-1">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/55 hover:bg-foreground/10 hover:text-foreground"
        >
          <X size="1rem" />
        </button>
      </div>
      {children}
      {footer}
    </div>,
    document.body,
  );
}

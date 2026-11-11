// ──────────────────────────────────────────────
// UI overhaul: the left rail of a Library editor (character, persona)
//
// Portrait, name, byline, tags and the main actions sit on the left; under
// them is the jump list of the sections this item actually uses, with
// a "+ Name" row for each section not in use yet. The editor's sections scroll on the right.
// ──────────────────────────────────────────────
import {
  useSyncExternalStore,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ChevronLeft, ChevronRight, Plus, X, type LucideIcon, Upload } from "lucide-react";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import { SPLIT_PANE } from "../../lib/split-view-env";
import { openLibraryPane } from "./library-navigation";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

export type RailSection = {
  id: string;
  label: string;
  /** Sub-entries (e.g. the card's fields), jumped to by element id. */
  children?: { id: string; label: string }[];
};

export type RailCrumb = { label: string; onClick?: () => void };

/** Phones: a bare ‹ that goes back to the Library section, in place of the breadcrumb trail. */
export function MobileBackCrumb({ label, onBack }: { label: string; onBack: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  return (
    <nav className="ovm-crumb-back" aria-label={localizeUi("ui.overhaul.oveditorhead.breadcrumb")}>
      <button
        type="button"
        className="ovm-drill-page__back"
        aria-label={localizeUi("ui.chat.scheduletimeline.value1Value2", { value1: localize("Back to"), value2: label })}
        title={label}
        onClick={onBack}
      >
        <ChevronLeft size={26} aria-hidden="true" />
      </button>
    </nav>
  );
}

/**
 * The second side of a split view in its tablet or phone layout keeps the crumb trail (it is still a
 * computer with a pointer), so an open item leads back to its section like on the main side.
 */
export function useSplitTouchCrumbs() {
  return useOverhaulMobile() && SPLIT_PANE !== null;
}

// The open item's trail (Library › Section › Item), published by its header on split view's narrow side, so
// a page opened inside the item (a drill page that hides the header) can show the trail at its own top.
let itemTrail: RailCrumb[] | null = null;
const trailListeners = new Set<() => void>();
export function publishSplitItemTrail(trail: RailCrumb[] | null) {
  if (itemTrail === trail) return;
  itemTrail = trail;
  trailListeners.forEach((listener) => listener());
}
export function useSplitItemTrail() {
  return useSyncExternalStore(
    (listener) => {
      trailListeners.add(listener);
      return () => trailListeners.delete(listener);
    },
    () => itemTrail,
  );
}

/**
 * Split view's narrow side: the trail at the top of a page inside an item. The item's own last crumb goes
 * back to the item (onItem); the page's title ends the trail. Nothing elsewhere.
 */
export function SplitPageCrumbs({ title, onItem }: { title: string; onItem: () => void }) {
  const splitTouch = useSplitTouchCrumbs();
  const trail = useSplitItemTrail();
  if (!splitTouch || !trail?.length) return null;
  const last = trail[trail.length - 1]!;
  return (
    <EditorCrumbs
      className="ov-subcrumbs"
      items={[...trail.slice(0, -1), { label: last.label, onClick: onItem }, { label: title }]}
    />
  );
}

export function EditorCrumbs({ items, className }: { items: RailCrumb[]; className?: string }) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const mobile = useOverhaulMobile();
  const splitTouch = mobile && SPLIT_PANE !== null;
  const back = [...items].reverse().find((item) => item.onClick);
  if (mobile && !splitTouch && back?.onClick)
    return <MobileBackCrumb label={localize(back.label)} onBack={back.onClick} />;
  return (
    <nav className={cn("ov-crumbs", className)} aria-label={localizeUi("ui.overhaul.oveditorhead.breadcrumb")}>
      {items.map((item, index) => {
        // The second side has no Library pane of its own (it stays on its page), so "Library" is a label there.
        const onClick = splitTouch && item.onClick === openLibraryPane ? undefined : item.onClick;
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="ov-crumbs__item">
            {index > 0 ? <ChevronRight size={12} aria-hidden="true" /> : null}
            {onClick ? (
              <button type="button" onClick={onClick}>
                {localize(item.label)}
              </button>
            ) : (
              <span aria-current={last ? "page" : undefined}>{localize(item.label)}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function EditorRail({
  crumbs,
  avatarUrl,
  avatarStyle,
  placeholderIcon: PlaceholderIcon,
  onReplaceAvatar,
  avatarActions,
  name,
  onNameChange,
  namePlaceholder,
  subtitle,
  onSubtitleChange,
  subtitlePlaceholder,
  byline,
  tags,
  onAddTag,
  onRemoveTag,
  actions,
  assist,
  sectionsTitle,
  sections,
  activeSection,
  onJump,
  addable,
  onAdd,
}: {
  crumbs?: ReactNode;
  avatarUrl: string | null;
  avatarStyle?: CSSProperties;
  placeholderIcon: LucideIcon;
  onReplaceAvatar: () => void;
  /** Extra buttons over the portrait (Crop, Generate…). */
  avatarActions?: ReactNode;
  /** Without onNameChange the name is edited in the editor's header instead. */
  name?: string;
  onNameChange?: (value: string) => void;
  namePlaceholder?: string;
  subtitle?: string;
  onSubtitleChange?: (value: string) => void;
  subtitlePlaceholder?: string;
  byline?: ReactNode;
  tags?: string[];
  onAddTag?: (value: string) => void;
  onRemoveTag?: (tag: string) => void;
  actions?: ReactNode;
  /** A helper under the action buttons (e.g. Professor Mari's "Help me fill this"). */
  assist?: ReactNode;
  sectionsTitle: string;
  sections: RailSection[];
  activeSection?: string | null;
  onJump: (id: string) => void;
  addable: { id: string; label: string }[];
  onAdd: (id: string) => void;
}) {
  const localize = useLocalizedUiText();
  const mobile = useOverhaulMobile();
  const [tagDraft, setTagDraft] = useState("");
  const [tagOpen, setTagOpen] = useState(false);

  const commitTag = () => {
    const value = tagDraft.trim();
    if (value && onAddTag) onAddTag(value);
    setTagDraft("");
    setTagOpen(false);
  };

  const jumpToElement = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <aside className="ov-rail" data-component="OverhaulEditorRail">
      {crumbs}
      <div className={cn("ov-rail__portrait", !avatarUrl && "is-empty")}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" style={avatarStyle} />
        ) : (
          <button type="button" className="ov-rail__portrait-empty" onClick={onReplaceAvatar}>
            <PlaceholderIcon size={36} aria-hidden="true" />
            <span>{localize("Add a picture")}</span>
          </button>
        )}
        <div className="ov-rail__portrait-actions">
          {avatarActions}
          <button type="button" className="ov-chip-btn" onClick={onReplaceAvatar}>
            <Upload size={12} aria-hidden="true" />
            {localize(avatarUrl ? "Replace" : "Upload")}
          </button>
        </div>
      </div>

      {/* Single-line values that wrap: textareas sized to their content, Enter does not add a line. */}
      {onNameChange ? (
        <textarea
          className="ov-rail__name ov-rail__wrap"
          rows={1}
          value={name}
          onChange={(event) => onNameChange(event.target.value.replace(/\n/g, " "))}
          onKeyDown={blockNewline}
          placeholder={namePlaceholder}
          aria-label={namePlaceholder}
        />
      ) : null}
      {onSubtitleChange ? (
        <textarea
          className="ov-rail__subtitle ov-rail__wrap"
          rows={1}
          value={subtitle ?? ""}
          onChange={(event) => onSubtitleChange(event.target.value.replace(/\n/g, " "))}
          onKeyDown={blockNewline}
          placeholder={subtitlePlaceholder}
          aria-label={subtitlePlaceholder}
        />
      ) : null}
      {byline ? <p className="ov-rail__byline">{byline}</p> : null}

      {tags && onAddTag ? (
        <div className="ov-rail__tags">
          {tags.map((tag) => (
            <span key={tag} className="ov-tag">
              {tag}
              {onRemoveTag ? (
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  aria-label={localize("Remove tag {{value1}}").replace("{{value1}}", tag)}
                >
                  <X size={10} />
                </button>
              ) : null}
            </span>
          ))}
          {tagOpen ? (
            <input
              autoFocus
              className="ov-tag ov-tag--input"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onBlur={commitTag}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitTag();
                } else if (event.key === "Escape") {
                  setTagDraft("");
                  setTagOpen(false);
                }
              }}
              placeholder={localize("tag")}
            />
          ) : (
            <button type="button" className="ov-tag ov-tag--add" onClick={() => setTagOpen(true)}>
              + {localize("tag")}
            </button>
          )}
        </div>
      ) : null}

      {/* Phones and tablets: the helper joins the action buttons as one row. */}
      {actions ? (
        <div className="ov-rail__actions">
          {actions}
          {mobile ? assist : null}
        </div>
      ) : null}
      {assist && !(mobile && actions) ? <div className="ov-rail__assist">{assist}</div> : null}

      <div className="ov-rail__rule" />
      <p className="ov-rail__eyebrow">{sectionsTitle}</p>
      <ul className="ov-rail__sections">
        {sections.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              className={cn("ov-rail__section", activeSection === section.id && "is-on")}
              onClick={() => onJump(section.id)}
            >
              <span className="ov-rail__dot" aria-hidden="true" />
              {localize(section.label)}
            </button>
            {section.children?.length ? (
              <ul className="ov-rail__children">
                {section.children.map((child) => (
                  <li key={child.id}>
                    <button type="button" onClick={() => jumpToElement(child.id)}>
                      {localize(child.label)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {addable.length > 0 ? (
        // Every section not in use yet gets its own "+ Name" row, so nothing hides behind a menu.
        <ul className="ov-rail__addlist" aria-label={localize("Add a section")}>
          {addable.map((item) => (
            <li key={item.id}>
              <button type="button" className="ov-rail__add-item" onClick={() => onAdd(item.id)}>
                <Plus size={12} aria-hidden="true" />
                {localize(item.label)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

function blockNewline(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.blur();
  }
}

/** "+ Backstory" style chips for fields that are not in use yet. */
export function AddFieldChips({
  items,
  onAdd,
}: {
  items: { id: string; label: string }[];
  onAdd: (id: string) => void;
}) {
  const localize = useLocalizedUiText();
  if (!items.length) return null;
  return (
    <div className="ov-addchips">
      {items.map((item) => (
        <button key={item.id} type="button" className="ov-addchip" onClick={() => onAdd(item.id)}>
          <Plus size={13} aria-hidden="true" />
          {localize(item.label)}
        </button>
      ))}
    </div>
  );
}

/** The rail's "⋯" overflow: the editor's header actions as a labelled menu list, like Message actions. */
export function RailMoreMenu({
  open,
  onClose,
  children,
  label = "More actions",
  className,
  trigger = "[data-ov-more-trigger]",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** English source text for the menu's small heading. */
  label?: string;
  className?: string;
  /** Selector of the button that toggles this menu (a press on it is not an outside click). */
  trigger?: string;
}) {
  const localize = useLocalizedUiText();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || ref.current?.contains(target) || target.closest(trigger)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, trigger]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={className ? `ov-rail__more ${className}` : "ov-rail__more"}
      role="menu"
      onClick={() => window.setTimeout(onClose, 0)}
    >
      <p className="ov-rail__more-label">{localize(label)}</p>
      <div className="mari-editor-actions">{children}</div>
    </div>
  );
}

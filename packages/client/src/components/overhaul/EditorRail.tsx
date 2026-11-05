// ──────────────────────────────────────────────
// UI overhaul: the left rail of a Library editor (character, persona)
//
// Portrait, name, byline, tags and the main actions sit on the left; under
// them is the jump list of the sections this item actually uses, with
// "+ Add a section" for the rest. The editor's sections scroll on the right.
// ──────────────────────────────────────────────
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ChevronRight, Plus, X, type LucideIcon, Upload } from "lucide-react";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";

export type RailSection = {
  id: string;
  label: string;
  /** Sub-entries (e.g. the card's fields), jumped to by element id. */
  children?: { id: string; label: string }[];
};

export type RailCrumb = { label: string; onClick?: () => void };

export function EditorCrumbs({ items }: { items: RailCrumb[] }) {
  return (
    <nav className="ov-crumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="ov-crumbs__item">
          {index > 0 ? <ChevronRight size={12} aria-hidden="true" /> : null}
          {item.onClick ? (
            <button type="button" onClick={item.onClick}>
              {item.label}
            </button>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
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
  name: string;
  onNameChange: (value: string) => void;
  namePlaceholder: string;
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
  const [tagDraft, setTagDraft] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

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
      <textarea
        className="ov-rail__name ov-rail__wrap"
        rows={1}
        value={name}
        onChange={(event) => onNameChange(event.target.value.replace(/\n/g, " "))}
        onKeyDown={blockNewline}
        placeholder={namePlaceholder}
        aria-label={namePlaceholder}
      />
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

      {actions ? <div className="ov-rail__actions">{actions}</div> : null}
      {assist ? <div className="ov-rail__assist">{assist}</div> : null}

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
        <div className="ov-rail__add">
          <button type="button" className="ov-rail__add-btn" onClick={() => setAddOpen((open) => !open)}>
            <Plus size={14} aria-hidden="true" />
            {localize("Add a section")}
          </button>
          {addOpen ? (
            <div className="ov-rail__add-menu" role="menu">
              {addable.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAddOpen(false);
                    onAdd(item.id);
                  }}
                >
                  <Plus size={12} aria-hidden="true" />
                  {localize(item.label)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
export function RailMoreMenu({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const localize = useLocalizedUiText();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || ref.current?.contains(target) || target.closest("[data-ov-more-trigger]")) return;
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
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className="ov-rail__more" role="menu" onClick={() => window.setTimeout(onClose, 0)}>
      <p className="ov-rail__more-label">{localize("More actions")}</p>
      <div className="mari-editor-actions">{children}</div>
    </div>
  );
}

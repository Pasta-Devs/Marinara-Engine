// ──────────────────────────────────────────────
// UI overhaul: Chat settings drawer chrome (v1 frames 04-07)
//
// The drawer docks on the right under the tab bar. Edit mode lists the
// sections: drag to reorder, the eye hides or shows one (hidden settings still
// apply), and the panel itself can be resized by its left edge or floated as a
// movable, resizable window. The arrangement is kept per chat mode.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ExternalLink, Eye, EyeOff, GripVertical, Pencil } from "lucide-react";
import { cn } from "../../lib/utils";
import { useOverhaulMobile, useOverhaulStore, type OverhaulChatSettingsLayout } from "../../stores/overhaul.store";
import { OvSeg } from "./LoreEntryParts";

const MODE_LABELS: Record<string, string> = {
  roleplay: "Roleplay",
  conversation: "Conversation",
  game: "Game Mode",
};

const EMPTY_LAYOUT: OverhaulChatSettingsLayout = { order: [], hidden: [] };
const MIN_WIDTH = 320;

function useLayout(mode: string) {
  return useOverhaulStore((state) => state.chatSettingsLayouts[mode]) ?? EMPTY_LAYOUT;
}

/** Pops a section out into its own window through the (hidden while editing) section's own pop-out control. */
function popOutSection(id: string) {
  const root = document.querySelector(`.ov-cs [data-chat-settings-section="${CSS.escape(id)}"]`);
  const button = root?.matches('[data-drawer-control="pop-out"]')
    ? root
    : root?.querySelector<HTMLButtonElement>('[data-drawer-control="pop-out"]');
  (button as HTMLButtonElement | null | undefined)?.click();
}

/** Order and visibility rules, plus the docked width, as one generated style sheet. */
export function OvChatSettingsStyle({ mode }: { mode: string }) {
  const layout = useLayout(mode);
  const width = useOverhaulStore((state) => state.chatSettingsWidth);
  const editing = useOverhaulStore((state) => state.chatSettingsEditing);
  const css = useMemo(() => {
    const scope = ':root[data-overhaul="on"] .ov-cs';
    const target = (id: string) => {
      const attr = `[data-chat-settings-section="${CSS.escape(id)}"]`;
      return `${scope} .ov-cs__scroll > :is(${attr}, :not([data-ov-contents]):has(${attr})), ${scope} .ov-cs__scroll > [data-ov-contents] > ${attr}`;
    };
    const rules: string[] = [];
    if (width) rules.push(`${scope} { --ov-cs-width: ${Math.round(width)}px; }`);
    layout.order.forEach((id, index) => {
      rules.push(`${target(id)} { order: ${index - 5000} !important; }`);
    });
    if (!editing) {
      for (const id of layout.hidden) {
        rules.push(`${target(id)} { display: none !important; }`);
      }
    }
    return rules.join("\n");
  }, [layout, width, editing]);
  return css ? <style data-ov-chat-settings>{css}</style> : null;
}

/** Header accessory: mode, hidden count, and the Edit / Done button. */
export function OvChatSettingsHeader({ mode }: { mode: string }) {
  const layout = useLayout(mode);
  const editing = useOverhaulStore((state) => state.chatSettingsEditing);
  const setEditing = useOverhaulStore((state) => state.setChatSettingsEditing);
  // Leaving the chat or closing the drawer should not leave Edit mode stuck on.
  useEffect(() => () => setEditing(false), [setEditing]);
  return (
    <span className="ov-cs__head" onPointerDown={(event) => event.stopPropagation()}>
      <span className="ov-cs__mode">{MODE_LABELS[mode] ?? mode}</span>
      {!editing && layout.hidden.length ? (
        <button type="button" className="ov-cs__hidden" onClick={() => setEditing(true)}>
          {layout.hidden.length} hidden
        </button>
      ) : null}
      <button
        type="button"
        className={cn("ov-edbtn", editing ? "ov-edbtn--accent" : "ov-edbtn--tint")}
        aria-pressed={editing}
        onClick={() => setEditing(!editing)}
      >
        {editing ? (
          "Done"
        ) : (
          <>
            <Pencil size={12} /> Edit
          </>
        )}
      </button>
    </span>
  );
}

type SectionInfo = { id: string; label: string; baseOrder: number; domIndex: number };

function readSections(container: HTMLElement | null): SectionInfo[] {
  if (!container) return [];
  const found: SectionInfo[] = [];
  // A display:contents slot (the game's tools) holds several sections of its own.
  const children = Array.from(container.children).flatMap((child) =>
    child instanceof HTMLElement && child.dataset.ovContents !== undefined ? Array.from(child.children) : [child],
  );
  children.forEach((child, domIndex) => {
    if (!(child instanceof HTMLElement)) return;
    // Some sections sit in a wrapper that carries the order; the id is on the section inside.
    const id =
      child.dataset.chatSettingsSection ??
      child.querySelector<HTMLElement>("[data-chat-settings-section]")?.dataset.chatSettingsSection;
    if (!id) return;
    const label =
      child.querySelector(".mari-drawer__title")?.textContent?.trim() || child.dataset.ovLabel || id.replace(/-/g, " ");
    const baseOrder = Number.parseFloat(child.style.order) || 0;
    found.push({ id, label, baseOrder, domIndex });
  });
  return found;
}

/** The Edit mode list, shown in place of the sections. */
/**
 * Switch rows show only their label (v1: one line per setting). The hidden
 * description becomes the row's hover title so the help is still there.
 */
export function OvChatSettingsHelpTitles({ container }: { container: HTMLElement | null }) {
  useEffect(() => {
    if (!container) return;
    const apply = () => {
      for (const row of container.querySelectorAll<HTMLElement>(".justify-between")) {
        if (!row.querySelector('input[type="checkbox"]')) continue;
        const help = row.querySelector<HTMLElement>(":scope > span:first-child > label.block");
        const text = help?.textContent?.trim();
        if (text && row.title !== text) row.title = text;
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [container]);
  return null;
}

export function OvChatSettingsEditor({
  mode,
  container,
  onProfileSlot,
}: {
  mode: string;
  container: HTMLElement | null;
  /** Where the drawer renders its settings-profile bar while editing. */
  onProfileSlot?: (element: HTMLDivElement | null) => void;
}) {
  const layout = useLayout(mode);
  const setLayout = useOverhaulStore((state) => state.setChatSettingsLayout);
  const floating = useOverhaulStore((state) => state.chatSettingsFloating);
  const setFloating = useOverhaulStore((state) => state.setChatSettingsFloating);
  const setWidth = useOverhaulStore((state) => state.setChatSettingsWidth);
  const overhaulMobile = useOverhaulMobile();
  const [sections, setSections] = useState<SectionInfo[]>(() => readSections(container));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    setSections(readSections(container));
    if (!container) return;
    const observer = new MutationObserver(() => setSections(readSections(container)));
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [container]);

  // The visible order: the saved order first, then anything new in its built-in place.
  const ordered = useMemo(() => {
    const rank = new Map(layout.order.map((id, index) => [id, index]));
    return [...sections].sort((a, b) => {
      const ra = rank.get(a.id);
      const rb = rank.get(b.id);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return a.baseOrder - b.baseOrder || a.domIndex - b.domIndex;
    });
  }, [sections, layout.order]);

  const save = (next: Partial<OverhaulChatSettingsLayout>) =>
    setLayout(mode, { order: next.order ?? layout.order, hidden: next.hidden ?? layout.hidden });

  const drop = (index: number) => {
    if (!dragId) return;
    const ids = ordered.map((section) => section.id);
    const from = ids.indexOf(dragId);
    if (from < 0) return;
    ids.splice(from, 1);
    ids.splice(index > from ? index - 1 : index, 0, dragId);
    save({ order: ids });
  };

  return (
    <div className="ov-cs-edit">
      <div className="ov-cs-edit__hint">
        <p>Drag a row to reorder it. Click the eye to hide or show a setting. Hidden settings still apply.</p>
        <button type="button" className="ov-ed__link" onClick={() => setLayout(mode, null)}>
          Reset
        </button>
      </div>
      {/* On phones and tablets the drawer is always a bottom sheet, so docking,
          floating and width don't apply. */}
      {overhaulMobile ? null : (
        <div className="ov-cs-edit__panel">
          <span>Panel</span>
          <OvSeg
            label="Panel placement"
            value={floating ? "float" : "dock"}
            options={[
              { value: "dock", label: "Docked" },
              { value: "float", label: "Floating" },
            ]}
            onChange={(next) => setFloating(next === "float")}
          />
          <small>
            {floating
              ? "Drag the title bar to move it and any edge to resize it."
              : "Drag the left edge to make it wider or narrower."}
          </small>
          {!floating ? (
            <button type="button" className="ov-ed__link" onClick={() => setWidth(0)}>
              Default width
            </button>
          ) : null}
        </div>
      )}
      {onProfileSlot ? (
        <div className="ov-cs-edit__profile">
          <span>Settings profile</span>
          <div ref={onProfileSlot} />
        </div>
      ) : null}
      <ul className="ov-cs-edit__list" onDragOver={(event) => event.preventDefault()}>
        {ordered.map((section, index) => {
          const hidden = layout.hidden.includes(section.id);
          return (
            <li
              key={section.id}
              draggable
              className={cn(
                "ov-cs-edit__row",
                hidden && "is-hidden",
                dragId === section.id && "is-dragging",
                dragId && dropIndex === index && "is-drop-before",
                dragId && dropIndex === ordered.length && index === ordered.length - 1 && "is-drop-after",
              )}
              onDragStart={(event) => {
                setDragId(section.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", section.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                setDropIndex(event.clientY > rect.top + rect.height / 2 ? index + 1 : index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dropIndex !== null) drop(dropIndex);
                setDragId(null);
                setDropIndex(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropIndex(null);
              }}
            >
              <GripVertical size={14} className="ov-cs-edit__grip" aria-hidden="true" />
              <button
                type="button"
                className="ov-cs-edit__eye"
                aria-pressed={!hidden}
                aria-label={hidden ? `Show ${section.label}` : `Hide ${section.label}`}
                onClick={() =>
                  save({
                    hidden: hidden ? layout.hidden.filter((id) => id !== section.id) : [...layout.hidden, section.id],
                  })
                }
              >
                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                type="button"
                className="ov-cs-edit__pop"
                title={`Open ${section.label} in its own window`}
                aria-label={`Open ${section.label} in its own window`}
                onClick={() => popOutSection(section.id)}
              >
                <ExternalLink size={13} />
              </button>
              <span className="ov-cs-edit__label">{section.label}</span>
              {hidden ? <small>Hidden</small> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Left-edge handle that resizes the docked drawer (shown in Edit mode). */
export function OvChatSettingsResizeHandle() {
  const setWidth = useOverhaulStore((state) => state.setChatSettingsWidth);
  const [dragging, setDragging] = useState(false);
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    [setDragging],
  );
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const max = Math.max(MIN_WIDTH, window.innerWidth - 360);
      setWidth(Math.min(max, Math.max(MIN_WIDTH, window.innerWidth - event.clientX)));
    },
    [dragging, setWidth],
  );
  return (
    <div
      className={cn("ov-cs__resize", dragging && "is-dragging")}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat settings"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    />
  );
}

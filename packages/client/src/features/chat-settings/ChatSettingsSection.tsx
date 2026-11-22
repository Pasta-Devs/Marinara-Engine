import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Drawer } from "../../components/ui/Drawer";
import { useUIStore } from "../../stores/ui.store";
import { isOverhaulActive } from "../../stores/overhaul.store";

/**
 * True where Chat settings shows every section expanded in one scrolling list (the new layout on desktop and iPad
 * landscape). Each section's body then mounts once it nears the visible part of the list, instead of all ~25 on
 * open: opening Chat settings fetched 23 things (galleries, backgrounds, tools, memories...) and drew every section
 * before the first frame. A body stays mounted once shown.
 */
export const ChatSettingsDeferBodiesContext = createContext(false);

/** How far past the visible list a section body starts loading, so it is usually ready before it scrolls in. */
const DEFER_MARGIN_PX = 900;

/** Whether the placeholder shows in the list's visible part (or the window, outside a list). */
function inView(placeholder: HTMLElement, root: HTMLElement | null) {
  const box = placeholder.getBoundingClientRect();
  const area = root ? root.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  return box.bottom > area.top && box.top < area.bottom;
}

function DeferredSectionBody({ defer, children }: { defer: boolean; children: ReactNode }) {
  const [reached, setReached] = useState(!defer);
  const show = reached || !defer;
  const placeholderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!defer) setReached(true);
  }, [defer]);
  // Before the first paint: a body already on screen (the top of the list, a section you just expanded) shows at
  // once, so no empty block flashes. The rest wait for the observer, which loads them ahead of the scroll.
  useLayoutEffect(() => {
    if (show) return;
    const placeholder = placeholderRef.current;
    if (!placeholder || typeof IntersectionObserver === "undefined") {
      setReached(true);
      return;
    }
    // The list's own scroller: a root margin on the window would stop at the scroller's clipped edge.
    const root = placeholder.closest<HTMLElement>(".ov-cs__scroll");
    if (inView(placeholder, root)) {
      setReached(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setReached(true);
      },
      { root, rootMargin: `${DEFER_MARGIN_PX}px 0px` },
    );
    observer.observe(placeholder);
    return () => observer.disconnect();
  }, [show]);
  if (show) return <>{children}</>;
  // A still block, never a shimmer (an endless animation off screen repaints the panel every frame).
  return <div ref={placeholderRef} className="ov-cs-deferred" aria-busy="true" style={{ minHeight: "6rem" }} />;
}

interface ChatSettingsSectionProps {
  /** Stable id used to remember this section's expand/collapse state across reopens. */
  id?: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  /** Short current value (a persona's name), shown on the section's row in the phone list. */
  summary?: string;
  /** Phones and tablets: the section's single control sits on its row in the list (see Drawer `mobileInline`). */
  mobileInline?: boolean;
  help?: string;
  style?: CSSProperties;
  initialOpen?: boolean;
  forceOpen?: boolean;
  contentClassName?: string;
  /** Popped out, the content fills its window (see Drawer `fill`). */
  fill?: boolean;
  /** Header buttons beside the help tip (see Drawer `actions`). */
  actions?: ReactNode;
  /** The same buttons in the title bar once the section is popped out (see Drawer `detachedHeaderControls`). */
  detachedHeaderControls?: ReactNode;
  children: ReactNode;
}

export function ChatSettingsSection({
  id,
  label,
  icon,
  count,
  summary,
  mobileInline,
  help,
  style,
  initialOpen = false,
  forceOpen = false,
  contentClassName,
  fill,
  actions,
  detachedHeaderControls,
  children,
}: ChatSettingsSectionProps) {
  const deferBodies = useContext(ChatSettingsDeferBodiesContext);
  const rememberedOpen = useUIStore((s) => (id ? s.chatSettingsExpandedSections[id] : undefined));
  const setSectionExpanded = useUIStore((s) => s.setChatSettingsSectionExpanded);
  // Remembered state wins once it exists; otherwise fall back to initialOpen.
  // The overhaul's Chat settings drawer (v1) shows sections expanded until the person collapses one.
  const defaultOpen = initialOpen || isOverhaulActive();
  const [open, setOpen] = useState(forceOpen || (rememberedOpen ?? defaultOpen));
  useEffect(() => {
    if (rememberedOpen !== undefined) setOpen(rememberedOpen);
    else if (defaultOpen) setOpen(true);
  }, [defaultOpen, rememberedOpen]);
  // Explicit navigation opens once; a later user collapse must still win.
  useEffect(() => {
    if (!forceOpen) return;
    setOpen(true);
    if (id) setSectionExpanded(id, true);
  }, [forceOpen, id, setSectionExpanded]);
  const setOpenRemembered = (next: boolean) => {
    setOpen(next);
    if (id) setSectionExpanded(id, next);
  };

  return (
    <Drawer
      id={id}
      title={label}
      icon={icon}
      count={count}
      rowValue={summary}
      mobileInline={mobileInline}
      help={help}
      open={open}
      onOpenChange={setOpenRemembered}
      style={style}
      bodyClassName={contentClassName}
      fill={fill}
      actions={actions}
      detachedHeaderControls={detachedHeaderControls}
      rootAttributes={{ "data-chat-settings-section": id }}
    >
      <DeferredSectionBody defer={deferBodies && !forceOpen}>{children}</DeferredSectionBody>
    </Drawer>
  );
}

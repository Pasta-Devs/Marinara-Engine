import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { useUIStore } from "../../stores/ui.store";
import { isOverhaulActive } from "../../stores/overhaul.store";

interface ChatSettingsSectionProps {
  /** Stable id used to remember this section's expand/collapse state across reopens. */
  id?: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  /** Short current value (a persona's name), shown on the section's row in the phone list. */
  summary?: string;
  help?: string;
  style?: CSSProperties;
  initialOpen?: boolean;
  forceOpen?: boolean;
  contentClassName?: string;
  /** Popped out, the content fills its window (see Drawer `fill`). */
  fill?: boolean;
  children: ReactNode;
}

export function ChatSettingsSection({
  id,
  label,
  icon,
  count,
  summary,
  help,
  style,
  initialOpen = false,
  forceOpen = false,
  contentClassName,
  fill,
  children,
}: ChatSettingsSectionProps) {
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
      help={help}
      open={open}
      onOpenChange={setOpenRemembered}
      style={style}
      bodyClassName={contentClassName}
      fill={fill}
      rootAttributes={{ "data-chat-settings-section": id }}
    >
      {children}
    </Drawer>
  );
}

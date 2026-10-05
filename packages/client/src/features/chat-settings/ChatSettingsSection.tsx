import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Drawer } from "../../components/ui/Drawer";
import { useUIStore } from "../../stores/ui.store";

interface ChatSettingsSectionProps {
  /** Stable id used to remember this section's expand/collapse state across reopens. */
  id?: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  help?: string;
  style?: CSSProperties;
  initialOpen?: boolean;
  forceOpen?: boolean;
  contentClassName?: string;
  children: ReactNode;
}

export function ChatSettingsSection({
  id,
  label,
  icon,
  count,
  help,
  style,
  initialOpen = false,
  forceOpen = false,
  contentClassName,
  children,
}: ChatSettingsSectionProps) {
  const rememberedOpen = useUIStore((s) => (id ? s.chatSettingsExpandedSections[id] : undefined));
  const setSectionExpanded = useUIStore((s) => s.setChatSettingsSectionExpanded);
  // Remembered state wins once it exists; otherwise fall back to initialOpen.
  const [open, setOpen] = useState(forceOpen || (rememberedOpen ?? initialOpen));
  useEffect(() => {
    if (rememberedOpen !== undefined) setOpen(rememberedOpen);
    else if (initialOpen) setOpen(true);
  }, [initialOpen, rememberedOpen]);
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
      help={help}
      open={open}
      onOpenChange={setOpenRemembered}
      style={style}
      bodyClassName={contentClassName}
      rootAttributes={{ "data-chat-settings-section": id }}
    >
      {children}
    </Drawer>
  );
}

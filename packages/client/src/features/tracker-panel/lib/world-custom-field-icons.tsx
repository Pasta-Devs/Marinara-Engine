import { DEFAULT_WORLD_CUSTOM_FIELD_ICON, normalizeWorldCustomFieldIcon } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { StatIcon } from "../../../components/ui/stat-icons";

export function WorldCustomFieldIcon({
  icon,
  size = "0.8125rem",
  className,
}: {
  icon: unknown;
  size?: string | number;
  className?: string;
}) {
  return (
    <StatIcon
      icon={normalizeWorldCustomFieldIcon(icon) ?? DEFAULT_WORLD_CUSTOM_FIELD_ICON}
      size={size}
      className={cn("text-[var(--muted-foreground)] drop-shadow-sm", className)}
    />
  );
}

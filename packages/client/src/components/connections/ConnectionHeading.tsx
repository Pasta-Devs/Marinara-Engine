import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { CONNECTION_HEADING_TITLE } from "./connection-row-layout";

/** Shared heading body; callers keep their own button, drag surface and sibling controls. */
export function ConnectionHeading({
  title,
  tooltip,
  children,
}: {
  title: ReactNode;
  tooltip?: string;
  children?: ReactNode;
}) {
  return (
    <span className="min-w-0 flex-1">
      <strong className={CONNECTION_HEADING_TITLE} title={tooltip}>
        {title}
      </strong>
      {children}
    </span>
  );
}

export function ConnectionHeadingMeta({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("mt-0.5 block min-w-0 truncate text-xs text-[var(--muted-foreground)]", className)}>
      {children}
    </span>
  );
}

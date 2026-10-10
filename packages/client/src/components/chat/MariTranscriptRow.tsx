import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

/**
 * One row of Professor Mari's transcript: a fixed marker column and the content
 * beside it. Shared by the transcript itself and by the approval cards, so it
 * lives outside both.
 */
export function TranscriptRow({
  marker,
  children,
  className,
  layout = "turn",
}: {
  marker: ReactNode;
  children: ReactNode;
  className?: string;
  layout?: "turn" | "document";
}) {
  if (layout === "document") return <div className={cn("min-w-0", className)}>{children}</div>;
  return (
    <div className={cn("grid grid-cols-[2rem_minmax(0,1fr)] gap-2.5", className)}>
      <div className="flex min-w-0 justify-start">{marker}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

import { cn } from "../../lib/utils";

type PendingTypingDotsProps = {
  className?: string;
  dotClassName?: string;
  small?: boolean;
};

// Decorative only (QC Nov 22 AX1): the typing line beside it, or the reply announcer, does the talking.
export function PendingTypingDots({ className, dotClassName, small = false }: PendingTypingDotsProps) {
  const sizeClass = small ? "h-1.5 w-1.5" : "h-2 w-2";

  return (
    <div className={cn("mari-pending-typing-dots flex items-center gap-1", className)} aria-hidden="true">
      <span className={cn(sizeClass, "rounded-full opacity-45", dotClassName)} />
      <span className={cn(sizeClass, "rounded-full opacity-65", dotClassName)} />
      <span className={cn(sizeClass, "rounded-full opacity-85", dotClassName)} />
    </div>
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const SIZES = { sm: ["14px", "h-3.5 w-3.5"], md: ["16px", "h-4 w-4"], lg: ["24px", "h-6 w-6"] } as const;

interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: keyof typeof SIZES;
  label?: string;
}

/** The shared loading ring: a comet arc that spins in the current text colour. */
export function Spinner({ size = "md", label, className, style, ...props }: SpinnerProps) {
  const hidden = label == null;
  return (
    <span
      role={hidden ? undefined : "status"}
      aria-label={label}
      className={cn("marinara-spinner inline-block shrink-0", SIZES[size][1], className)}
      style={{ "--s": SIZES[size][0], ...style } as React.CSSProperties}
      {...props}
    />
  );
}

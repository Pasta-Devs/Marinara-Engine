import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

/** The shared checkbox: a native input at 16 px with the theme accent. */
export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("h-4 w-4 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

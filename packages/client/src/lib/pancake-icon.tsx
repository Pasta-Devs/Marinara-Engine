// The Prompt viewer's icon: kolache's AIO extension has always been the pancake stack.
// Drawn as an SVG holding the emoji so it drops in wherever a lucide icon goes.
import { forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

export const PancakeIcon = forwardRef<SVGSVGElement, LucideProps>(function PancakeIcon(
  { size = 24, className, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absolute, color: _color, ...rest },
  ref,
) {
  return (
    <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      <text x="12" y="13" textAnchor="middle" dominantBaseline="central" fontSize="21">
        🥞
      </text>
    </svg>
  );
}) as unknown as LucideIcon;

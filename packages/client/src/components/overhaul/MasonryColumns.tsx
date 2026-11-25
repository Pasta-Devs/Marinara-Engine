// Cards in side-by-side columns that grow on their own (Nov 25, her call): opening one card's model list pushes down
// only what is under it in that column, never the card beside it. A shared CSS grid row could not do that, since every
// card in a row starts below the tallest card of the row above.
//
// The column count follows the old grid rule (as many 24rem-wide columns as fit), and cards go round-robin so the
// first cards still read across the top and a card never jumps to the other column when one beside it opens.
// Keyboard and reader order run down each column, which is the order the eye follows in a masonry layout.
import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";

const MIN_COLUMN_REM = 24;
const GAP_REM = 0.75;

function columnsFor(width: number): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const min = MIN_COLUMN_REM * rem;
  const gap = GAP_REM * rem;
  return Math.max(1, Math.floor((width + gap) / (min + gap)));
}

export function MasonryColumns({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(1);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setCount(columnsFor(node.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const items = Children.toArray(children);
  const columns: ReactNode[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => columns[index % count]!.push(item));

  return (
    <div ref={ref} className={cn("ov-masonry", className)} data-columns={count}>
      {columns.map((column, index) => (
        <div key={index} className="ov-masonry__column">
          {column}
        </div>
      ))}
    </div>
  );
}

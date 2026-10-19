import { Fragment } from "react";
import { Star } from "lucide-react";

/** Copy with "★" in it: each one becomes the Star icon, so it shows in every font. */
export function StarText({ text }: { text: string }) {
  const parts = text.split("★");
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <Star size="0.75em" role="img" aria-label="★" className="mb-[0.1em] inline-block fill-current align-middle" />
      )}
      {part}
    </Fragment>
  ));
}

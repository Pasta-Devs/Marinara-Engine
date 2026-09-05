import type { ImgHTMLAttributes } from "react";
import { CHAT_IMAGE_PREVIEW_WIDTH } from "@marinara-engine/shared";

/** Only local gallery images have cached previews. External/data URLs keep their existing behavior. */
export function ChatImagePreview({
  src,
  mobileWidth = CHAT_IMAGE_PREVIEW_WIDTH,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { mobileWidth?: number }) {
  const preview = src && /^\/api\/gallery\/file\/[^/?#]+\/[^/?#]+$/.test(src) ? `${src}?w=${mobileWidth}` : null;
  return (
    <picture className="contents">
      {preview && <source media="(max-width: 767px)" srcSet={preview} />}
      <img loading="lazy" decoding="async" {...props} src={src} />
    </picture>
  );
}

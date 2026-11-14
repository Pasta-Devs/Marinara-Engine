import { useState, type CSSProperties } from "react";
import { User } from "lucide-react";

/** Avatar image with a person-icon fallback for missing or unreadable files. */
export function AvatarImage({
  src,
  alt,
  className,
  style,
  loading,
  iconSize = "1rem",
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
  iconSize?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) {
    return (
      <span
        className="absolute inset-0 flex items-center justify-center"
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <User size={iconSize} aria-hidden="true" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      draggable={false}
      className={className}
      style={style}
      onError={() => setFailedSrc(src)}
    />
  );
}

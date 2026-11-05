import { useState, type ReactNode } from "react";

/** A fight token's picture. A picture that fails to load (a deleted gallery image, a moved avatar)
 *  draws `fallback` instead, so the token shows its initials rather than a broken image. */
export function TokenPicture({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} />;
}

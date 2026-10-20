// React side of click-to-load for images from other websites (see remote-image-policy.ts).
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { heldRemoteImageHref, loadRemoteImage, useRemoteImagePolicy } from "./remote-image-policy";
import { remoteImageHost } from "./remote-images";

function RemoteImagePlaceholder({ href }: { href: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const host = remoteImageHost(href);
  return (
    <span className="mari-remote-image" title={href}>
      <span className="mari-remote-image-host">{host}</span>
      <button
        type="button"
        className="mari-remote-image-load"
        disabled={status === "loading"}
        aria-label={t("chat.remoteImage.loadFrom", { host })}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setStatus("loading");
          void loadRemoteImage(href).then((loaded) => {
            if (!loaded) setStatus("failed");
          });
        }}
      >
        {t(
          status === "loading"
            ? "chat.remoteImage.loading"
            : status === "failed"
              ? "chat.remoteImage.failed"
              : "chat.remoteImage.load",
        )}
      </button>
    </span>
  );
}

/** Shows `children` (an image of `src`) directly, or a placeholder until the user loads it. */
export function RemoteImageGate({ src, children }: { src: string; children: ReactNode }) {
  const href = heldRemoteImageHref(src, useRemoteImagePolicy());
  return href ? <RemoteImagePlaceholder href={href} /> : children;
}

/** A Markdown image in message content. */
export function MessageImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  return (
    <RemoteImageGate src={src}>
      <img src={src} alt={alt} className={className} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
    </RemoteImageGate>
  );
}

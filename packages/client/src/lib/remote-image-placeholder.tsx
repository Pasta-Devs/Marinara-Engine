// React side of click-to-load for images from other websites (see remote-image-policy.ts).
import { createContext, useContext, useState, type ReactNode } from "react";
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

/**
 * Opens a Markdown image full size. A surface that provides it (Professor Mari's replies, #9387) makes its message
 * images buttons; everywhere else they stay plain images.
 */
export const MessageImageOpenContext = createContext<
  ((image: { src: string; alt: string; trigger: HTMLElement }) => void) | null
>(null);

/** A Markdown image in message content. */
export function MessageImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const { t } = useTranslation();
  const open = useContext(MessageImageOpenContext);
  const image = (
    <img src={src} alt={alt} className={className} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
  );
  return (
    <RemoteImageGate src={src}>
      {open ? (
        // Same title and label as a roleplay message's image attachment (ChatMessage.tsx).
        <button
          type="button"
          onClick={(event) => open({ src, alt, trigger: event.currentTarget })}
          className="inline-block max-w-full cursor-zoom-in rounded-lg align-bottom focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          title={t("ui.noodle.noodlepostcard.openImage")}
          aria-label={t("ui.chat.chatmessage.openValue1", { value1: alt || t("ui.ui.spritegenerationmodal.image") })}
        >
          {image}
        </button>
      ) : (
        image
      )}
    </RemoteImageGate>
  );
}

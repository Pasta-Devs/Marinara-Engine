// Click-to-load for images from other websites in message content. Until the
// user loads one (or turns on "Load images from other websites in messages"),
// it shows as a small placeholder, so a message cannot make the browser send
// anything to another site on its own. Approvals live in the synced UI settings.
import type { MouseEvent } from "react";
import { translate } from "../localization/i18n";
import { useUIStore } from "../stores/ui.store";
import { remoteImageHost, remoteImageHref, type RemoteImagePolicy } from "./remote-images";

const LOAD_TIMEOUT_MS = 30_000;

let cachedPolicy: { loadAll: boolean; approved: string[]; policy: RemoteImagePolicy } | null = null;

function remoteImagePolicyFor(state: { loadRemoteMessageImages: boolean; approvedRemoteImageUrls: string[] }) {
  const loadAll = state.loadRemoteMessageImages === true;
  if (cachedPolicy?.loadAll !== loadAll || cachedPolicy.approved !== state.approvedRemoteImageUrls) {
    const policy = { loadAll, approved: new Set(state.approvedRemoteImageUrls) };
    cachedPolicy = { loadAll, approved: state.approvedRemoteImageUrls, policy };
  }
  return cachedPolicy.policy;
}

/** The policy for render code; components re-render when it changes. */
export function useRemoteImagePolicy(): RemoteImagePolicy {
  return useUIStore(remoteImagePolicyFor);
}

export function currentRemoteImagePolicy(): RemoteImagePolicy {
  return remoteImagePolicyFor(useUIStore.getState());
}

/** The absolute URL to hold back, or null when the image may load now. */
export function heldRemoteImageHref(src: string, policy: RemoteImagePolicy): string | null {
  if (policy.loadAll) return null;
  const href = remoteImageHref(src);
  return href && !policy.approved.has(href) ? href : null;
}

const pendingLoads = new Map<string, Promise<boolean>>();

/** Loads exactly this image once; only an image that really loads is remembered. */
export function loadRemoteImage(href: string): Promise<boolean> {
  let pending = pendingLoads.get(href);
  if (!pending) {
    pending = new Promise<boolean>((resolve) => {
      const image = new Image();
      const finish = (loaded: boolean) => {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        pendingLoads.delete(href);
        if (loaded) useUIStore.getState().approveRemoteImageUrl(href);
        resolve(loaded);
      };
      const timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.referrerPolicy = "no-referrer";
      image.src = href;
    });
    pendingLoads.set(href, pending);
  }
  return pending;
}

/** Replace held images in sanitized HTML with placeholders. Handled by `handleRemoteImageClick`. */
export function holdRemoteImages(root: ParentNode, policy: RemoteImagePolicy): void {
  if (policy.loadAll) return;
  for (const image of root.querySelectorAll("img[src]")) {
    const href = heldRemoteImageHref(image.getAttribute("src") ?? "", policy);
    if (!href) continue;
    const document = image.ownerDocument;
    const host = remoteImageHost(href);
    const placeholder = document.createElement("span");
    placeholder.className = "mari-remote-image";
    placeholder.title = href;
    placeholder.setAttribute("data-mari-remote-image", href);
    const label = document.createElement("span");
    label.className = "mari-remote-image-host";
    label.textContent = host;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mari-remote-image-load";
    button.setAttribute("aria-label", translate("chat.remoteImage.loadFrom", { host }));
    button.textContent = translate("chat.remoteImage.load");
    placeholder.append(label, button);
    image.replaceWith(placeholder);
  }
}

/** Click handler for a container whose HTML went through `holdRemoteImages`. */
export function handleRemoteImageClick(event: MouseEvent<HTMLElement>): void {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest<HTMLButtonElement>("button.mari-remote-image-load");
  const href = button?.closest("[data-mari-remote-image]")?.getAttribute("data-mari-remote-image");
  if (!button || !href || !event.currentTarget.contains(button)) return;
  event.preventDefault();
  event.stopPropagation();
  button.disabled = true;
  button.textContent = translate("chat.remoteImage.loading");
  void loadRemoteImage(href).then((loaded) => {
    // On success the approval re-renders the message with the image in place.
    if (loaded) return;
    button.disabled = false;
    button.textContent = translate("chat.remoteImage.failed");
  });
}

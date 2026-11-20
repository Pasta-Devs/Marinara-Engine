// ──────────────────────────────────────────────
// Detached window: an app surface in its own OS window, beside the browser
//
// The Tracker panel (detach) and floating windows that opt in (pop out) render into a second window
// through a React portal: same JS realm, live state, no reload. Document Picture-in-Picture gives an
// always-on-top window with the slimmest frame the browser allows (Chromium 116+, Firefox 151+ desktop);
// a normal popup stands in where it is missing, or when a tab's one Picture-in-Picture window is
// already taken. The browser's frame (the site's address, its close button) is browser chrome: no
// page can style or hide it. The opener's stylesheets and <html> attributes (theme) are mirrored live.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect } from "react";

const DETACHED_STYLE_ATTRIBUTE = "data-mari-detached-style";

interface DocumentPictureInPictureController {
  requestWindow: (options: {
    disallowReturnToOpener?: boolean;
    height?: number;
    preferInitialWindowPlacement?: boolean;
    width?: number;
  }) => Promise<Window>;
  /** The tab's open Picture-in-Picture window, or null. A tab has at most one. */
  readonly window?: Window | null;
}

type WindowWithDocumentPictureInPicture = Window & {
  documentPictureInPicture?: DocumentPictureInPictureController;
};

export interface DetachedWindowTarget {
  popup: Window & typeof globalThis;
  removeOpenerPageHideListener: () => void;
  title: string;
}

function copyAttributes(source: HTMLElement, target: HTMLElement) {
  for (const attribute of Array.from(target.attributes)) {
    if (attribute.name === "lang") continue;
    target.removeAttribute(attribute.name);
  }
  for (const attribute of Array.from(source.attributes)) {
    target.setAttribute(attribute.name, attribute.value);
  }
}

type MirroredStyleNode = HTMLLinkElement | HTMLStyleElement;

function syncStyleNode(source: MirroredStyleNode, target: MirroredStyleNode) {
  for (const attribute of Array.from(target.attributes)) {
    if (attribute.name !== DETACHED_STYLE_ATTRIBUTE && !source.hasAttribute(attribute.name)) {
      target.removeAttribute(attribute.name);
    }
  }
  for (const attribute of Array.from(source.attributes)) {
    if (target.getAttribute(attribute.name) !== attribute.value) {
      target.setAttribute(attribute.name, attribute.value);
    }
  }
  target.setAttribute(DETACHED_STYLE_ATTRIBUTE, "");

  if (source.tagName === "STYLE" && target.textContent !== source.textContent) {
    target.textContent = source.textContent;
  }
}

function mirrorStyles(
  sourceDocument: Document,
  targetDocument: Document,
  mirroredStyles: Map<MirroredStyleNode, MirroredStyleNode>,
) {
  const sourceStyles = Array.from(
    sourceDocument.head.querySelectorAll<MirroredStyleNode>('link[rel="stylesheet"], style'),
  );
  const liveSourceStyles = new Set(sourceStyles);

  for (const [source, target] of mirroredStyles) {
    if (liveSourceStyles.has(source)) continue;
    target.remove();
    mirroredStyles.delete(source);
  }

  let previousTarget: MirroredStyleNode | null = null;
  for (const source of sourceStyles) {
    let target = mirroredStyles.get(source);
    if (!target) {
      target = source.cloneNode(true) as MirroredStyleNode;
      target.setAttribute(DETACHED_STYLE_ATTRIBUTE, "");
      mirroredStyles.set(source, target);
      targetDocument.head.appendChild(target);
    } else {
      syncStyleNode(source, target);
    }

    if (previousTarget) {
      if (previousTarget.nextElementSibling !== target) previousTarget.after(target);
    } else {
      const firstMirroredStyle = targetDocument.head.querySelector<MirroredStyleNode>(`[${DETACHED_STYLE_ATTRIBUTE}]`);
      if (firstMirroredStyle !== target) targetDocument.head.insertBefore(target, firstMirroredStyle);
    }
    previousTarget = target;
  }
}

function prepareDetachedWindow(popup: Window & typeof globalThis, title: string): DetachedWindowTarget {
  const popupDocument = popup.document;
  popupDocument.title = title;
  popupDocument.head.replaceChildren();
  popupDocument.body.replaceChildren();

  const base = popupDocument.createElement("base");
  base.href = document.baseURI;
  popupDocument.head.appendChild(base);

  const closeWithOpener = () => popup.close();
  window.addEventListener("pagehide", closeWithOpener, { once: true });

  return {
    popup,
    removeOpenerPageHideListener: () => window.removeEventListener("pagehide", closeWithOpener),
    title,
  };
}

/**
 * Opens the second window. Call it straight from a click: Picture-in-Picture needs the click's user
 * activation. Null when the browser blocked the popup.
 */
export async function openDetachedWindow({
  title,
  width,
  height = Math.min(900, Math.max(520, window.screen.availHeight - 96)),
}: {
  title: string;
  width: number;
  height?: number;
}): Promise<DetachedWindowTarget | null> {
  const documentPictureInPicture = (window as WindowWithDocumentPictureInPicture).documentPictureInPicture;

  // A second request would close the tab's open Picture-in-Picture window (another surface's), so that
  // one stays and this one takes a popup.
  if (documentPictureInPicture && !documentPictureInPicture.window) {
    const pictureInPictureWindow = await documentPictureInPicture
      .requestWindow({
        disallowReturnToOpener: true,
        height: Math.round(height),
        preferInitialWindowPlacement: true,
        width: Math.round(width),
      })
      .catch(() => null);
    if (pictureInPictureWindow) {
      return prepareDetachedWindow(pictureInPictureWindow as Window & typeof globalThis, title);
    }
  }

  const popup = window.open(
    "",
    "_blank",
    `popup=yes,width=${Math.round(width)},height=${Math.round(height)},resizable=yes,scrollbars=no`,
  ) as (Window & typeof globalThis) | null;
  if (!popup) return null;

  return prepareDetachedWindow(popup, title);
}

export function closeDetachedWindow(target: DetachedWindowTarget) {
  target.removeOpenerPageHideListener();
  if (!target.popup.closed) target.popup.close();
}

/**
 * Keeps the second window dressed like the app while it is open: moves `host` into its body, mirrors
 * the stylesheets and the theme, and calls `onClosed` when the user closes it.
 */
export function DetachedWindow({
  host,
  onClosed,
  target,
}: {
  host: HTMLElement;
  onClosed: (target: DetachedWindowTarget) => void;
  target: DetachedWindowTarget;
}) {
  useLayoutEffect(() => {
    target.popup.document.body.appendChild(host);
  }, [host, target]);

  useEffect(() => {
    const { popup } = target;
    const popupDocument = popup.document;
    const mirroredStyles = new Map<MirroredStyleNode, MirroredStyleNode>();

    const syncDocumentPresentation = () => {
      copyAttributes(document.documentElement, popupDocument.documentElement);
      popupDocument.title = document.title ? `${document.title} · ${target.title}` : target.title;
    };
    const syncStyles = () => mirrorStyles(document, popupDocument, mirroredStyles);
    const handlePopupClose = () => {
      target.removeOpenerPageHideListener();
      onClosed(target);
    };

    syncDocumentPresentation();
    syncStyles();

    const presentationObserver = new MutationObserver(syncDocumentPresentation);
    presentationObserver.observe(document.documentElement, { attributes: true });

    const styleObserver = new MutationObserver(syncStyles);
    styleObserver.observe(document.head, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });

    popup.addEventListener("pagehide", handlePopupClose);
    popup.focus();

    return () => {
      presentationObserver.disconnect();
      styleObserver.disconnect();
      popup.removeEventListener("pagehide", handlePopupClose);
    };
  }, [onClosed, target]);

  return null;
}

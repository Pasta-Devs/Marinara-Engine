import { useEffect, useLayoutEffect } from "react";

const DETACHED_STYLE_ATTRIBUTE = "data-mari-detached-style";

interface DocumentPictureInPictureController {
  requestWindow: (options: {
    disallowReturnToOpener?: boolean;
    height?: number;
    preferInitialWindowPlacement?: boolean;
    width?: number;
  }) => Promise<Window>;
}

type WindowWithDocumentPictureInPicture = Window & {
  documentPictureInPicture?: DocumentPictureInPictureController;
};

export interface TrackerPanelWindowTarget {
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
      const firstMirroredStyle = targetDocument.head.querySelector<MirroredStyleNode>(
        `[${DETACHED_STYLE_ATTRIBUTE}]`,
      );
      if (firstMirroredStyle !== target) targetDocument.head.insertBefore(target, firstMirroredStyle);
    }
    previousTarget = target;
  }
}

function prepareTrackerPanelWindow(
  popup: Window & typeof globalThis,
  title: string,
): TrackerPanelWindowTarget {
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

export async function openTrackerPanelWindow({
  title,
  width,
}: {
  title: string;
  width: number;
}): Promise<TrackerPanelWindowTarget | null> {
  const height = Math.min(900, Math.max(520, window.screen.availHeight - 96));
  const documentPictureInPicture = (window as WindowWithDocumentPictureInPicture).documentPictureInPicture;

  if (documentPictureInPicture) {
    const pictureInPictureWindow = await documentPictureInPicture
      .requestWindow({
        disallowReturnToOpener: true,
        height: Math.round(height),
        preferInitialWindowPlacement: true,
        width: Math.round(width),
      })
      .catch(() => null);
    if (pictureInPictureWindow) {
      return prepareTrackerPanelWindow(pictureInPictureWindow as Window & typeof globalThis, title);
    }
  }

  const popup = window.open(
    "",
    "_blank",
    `popup=yes,width=${Math.round(width)},height=${Math.round(height)},resizable=yes,scrollbars=no`,
  ) as (Window & typeof globalThis) | null;
  if (!popup) return null;

  return prepareTrackerPanelWindow(popup, title);
}

export function closeTrackerPanelWindow(target: TrackerPanelWindowTarget) {
  target.removeOpenerPageHideListener();
  if (!target.popup.closed) target.popup.close();
}

export function TrackerPanelDetachedWindow({
  host,
  onClosed,
  target,
}: {
  host: HTMLElement;
  onClosed: (target: TrackerPanelWindowTarget) => void;
  target: TrackerPanelWindowTarget;
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

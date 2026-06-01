import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import type { ImagePromptOverride, ImagePromptReviewItem } from "./ImagePromptReviewModal";

const ImagePromptReviewModal = lazy(() =>
  import("./ImagePromptReviewModal").then((module) => ({ default: module.ImagePromptReviewModal })),
);

type PromptReviewRequest = {
  id: string;
  items: ImagePromptReviewItem[];
  resolve: (overrides: ImagePromptOverride[] | null) => void;
};

type PromptReviewState = {
  request: PromptReviewRequest | null;
  setRequest: (request: PromptReviewRequest | null) => void;
};

const useImagePromptReviewStore = create<PromptReviewState>((set) => ({
  request: null,
  setRequest: (request) => set({ request }),
}));

export function requestImagePromptReview(items: ImagePromptReviewItem[]): Promise<ImagePromptOverride[] | null> {
  return new Promise((resolve) => {
    const store = useImagePromptReviewStore.getState();
    store.request?.resolve(null);
    store.setRequest({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      items,
      resolve,
    });
  });
}

export function ImagePromptReviewHost() {
  const request = useImagePromptReviewStore((state) => state.request);
  const setRequest = useImagePromptReviewStore((state) => state.setRequest);
  const [displayRequest, setDisplayRequest] = useState<PromptReviewRequest | null>(null);
  const [open, setOpen] = useState(false);
  const pendingCloseRef = useRef<{
    request: PromptReviewRequest;
    overrides: ImagePromptOverride[] | null;
  } | null>(null);

  useEffect(() => {
    if (!request) return;
    pendingCloseRef.current = null;
    setDisplayRequest(request);
    setOpen(true);
  }, [request]);

  const close = (overrides: ImagePromptOverride[] | null) => {
    const current = useImagePromptReviewStore.getState().request;
    if (!current) return;
    pendingCloseRef.current = { request: current, overrides };
    setOpen(false);
  };

  const handleExited = () => {
    const pendingClose = pendingCloseRef.current;
    if (pendingClose) {
      pendingCloseRef.current = null;
      if (useImagePromptReviewStore.getState().request?.id === pendingClose.request.id) {
        setRequest(null);
        setDisplayRequest(null);
        pendingClose.request.resolve(pendingClose.overrides);
        return;
      }
    }

    if (!useImagePromptReviewStore.getState().request) {
      setDisplayRequest(null);
    }
  };

  if (!displayRequest) return null;

  return (
    <Suspense fallback={null}>
      <ImagePromptReviewModal
        open={open}
        items={displayRequest.items}
        onCancel={() => close(null)}
        onConfirm={(overrides) => close(overrides)}
        onExited={handleExited}
      />
    </Suspense>
  );
}

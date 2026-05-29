export interface SpriteFrameAdjustments {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function percentToPixels(size: number, value: number): number {
  return Math.round((size * value) / 100);
}

function validateFrameAdjustments(frame: SpriteFrameAdjustments): Error | null {
  const edges = [frame.top, frame.bottom, frame.left, frame.right];
  if (edges.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    return new Error("Frame settings must use percentages between 0 and 100");
  }
  if (frame.left + frame.right >= 100 || frame.top + frame.bottom >= 100) {
    return new Error("Frame settings must use percentage ranges that leave a usable sprite area");
  }
  return null;
}

export function cropSpriteDataUrl(dataUrl: string, frame: SpriteFrameAdjustments): Promise<string> {
  return new Promise((resolve, reject) => {
    const frameError = validateFrameAdjustments(frame);
    if (frameError) {
      reject(frameError);
      return;
    }

    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const cropLeft = percentToPixels(width, frame.left);
      const cropRight = percentToPixels(width, frame.right);
      const cropTop = percentToPixels(height, frame.top);
      const cropBottom = percentToPixels(height, frame.bottom);
      const outputWidth = width - cropLeft - cropRight;
      const outputHeight = height - cropTop - cropBottom;

      if (outputWidth <= 0 || outputHeight <= 0) {
        reject(new Error("Frame settings leave no usable sprite area"));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas is unavailable"));
        return;
      }

      ctx.drawImage(image, cropLeft, cropTop, outputWidth, outputHeight, 0, 0, outputWidth, outputHeight);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Sprite image could not be loaded"));
    image.src = dataUrl;
  });
}

import { SpriteFrameEditor } from "../../../../../shared/components/ui/SpriteFrameEditor";
import { SpriteWandCleanupEditor } from "../../../../../shared/components/ui/sprite-wand-cleanup/SpriteWandCleanupEditor";
import type { SpriteInfo } from "../../../sprites/index";

interface PersonaSpriteEditorsProps {
  framingSprite: SpriteInfo | null;
  savingFrame: boolean;
  wandCleanupSprite: SpriteInfo | null;
  savingWandCleanup: boolean;
  displayExpression: (expression: string) => string;
  onApplySpriteFrame: (croppedDataUrl: string) => void;
  onCloseFrame: () => void;
  onApplyWandCleanup: (cleanedDataUrl: string) => void;
  onCloseWandCleanup: () => void;
}

export function PersonaSpriteEditors({
  framingSprite,
  savingFrame,
  wandCleanupSprite,
  savingWandCleanup,
  displayExpression,
  onApplySpriteFrame,
  onCloseFrame,
  onApplyWandCleanup,
  onCloseWandCleanup,
}: PersonaSpriteEditorsProps) {
  return (
    <>
      {framingSprite && (
        <SpriteFrameEditor
          imageUrl={framingSprite.url}
          label={displayExpression(framingSprite.expression)}
          applying={savingFrame}
          onApply={onApplySpriteFrame}
          onClose={onCloseFrame}
        />
      )}

      {wandCleanupSprite && (
        <SpriteWandCleanupEditor
          imageUrl={wandCleanupSprite.url}
          label={displayExpression(wandCleanupSprite.expression)}
          applying={savingWandCleanup}
          onApply={onApplyWandCleanup}
          onClose={onCloseWandCleanup}
        />
      )}
    </>
  );
}

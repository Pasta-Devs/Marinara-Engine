import type { SpriteInfo } from "../../sprites/index";
import { SpriteFrameEditor } from "../../../../shared/components/ui/SpriteFrameEditor";
import { SpriteWandCleanupEditor } from "../../../../shared/components/ui/sprite-wand-cleanup/SpriteWandCleanupEditor";

export function CharacterSpriteEditors({
  framingSprite,
  savingFrame,
  wandCleanupSprite,
  savingWandCleanup,
  displayExpression,
  onApplyFrame,
  onCloseFrame,
  onApplyWandCleanup,
  onCloseWandCleanup,
}: {
  framingSprite: SpriteInfo | null;
  savingFrame: boolean;
  wandCleanupSprite: SpriteInfo | null;
  savingWandCleanup: boolean;
  displayExpression: (stored: string) => string;
  onApplyFrame: (croppedDataUrl: string) => void;
  onCloseFrame: () => void;
  onApplyWandCleanup: (cleanedDataUrl: string) => void;
  onCloseWandCleanup: () => void;
}) {
  return (
    <>
      {framingSprite && (
        <SpriteFrameEditor
          imageUrl={framingSprite.url}
          label={displayExpression(framingSprite.expression)}
          applying={savingFrame}
          onApply={onApplyFrame}
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

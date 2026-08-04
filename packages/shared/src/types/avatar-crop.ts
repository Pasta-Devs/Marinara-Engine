// ──────────────────────────────────────────────
// Avatar Crop Types
// ──────────────────────────────────────────────

/** Avatar crop — current source-rectangle format. A square region of the source
 *  image (`srcWidth * sourceW === srcHeight * sourceH` in editor-enforced data),
 *  expressed in coordinates normalized to the source's intrinsic dimensions.
 *  Editors and crop widgets emit this shape. */
export interface SourceRectAvatarCrop {
  srcX: number;
  srcY: number;
  srcWidth: number;
  srcHeight: number;
}

/** Avatar crop — legacy zoom + offset format. Render-only compatibility path so
 *  previously saved crops display unchanged until the user re-edits them. */
export interface LegacyAvatarCrop {
  zoom: number;
  offsetX: number;
  offsetY: number;
  fullImage?: boolean;
}

/** Any avatar crop: the current source-rectangle shape or the legacy zoom+offset
 *  shape. Readers and renderers accept this; editors emit SourceRectAvatarCrop. */
export type AvatarCrop = SourceRectAvatarCrop | LegacyAvatarCrop;

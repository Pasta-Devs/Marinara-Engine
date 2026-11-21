// The size each kind of picture asks for, shared by the Image settings window and its Settings > Generations summary.
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "../../stores/ui.store";

/** Video templates stay in Settings > Generations > Video; the Image settings window lists every other template. */
export const VIDEO_PROMPT_TEMPLATE_KEYS = [
  "game.video",
  "roleplay.galleryVideoDirector",
  "roleplay.clipDirector",
  "conversation.video",
  "conversation.callVideo.idle",
  "conversation.callVideo.talking",
  "conversation.callVideo.laughing",
  "conversation.callVideo.angry",
  "conversation.callVideo.crying",
  "conversation.callVideo.sighing",
  "conversation.callVideo.custom",
  "sprites.animatedPortrait",
] as const;

export type ImageCanvas = {
  /** The settings search id, kept from when these rows lived in Settings > Generations. */
  id: string;
  labelKey: string;
  helpKey: string;
  width: number;
  height: number;
  set: (width: number, height: number) => void;
};

export function useImageCanvases(): ImageCanvas[] {
  const s = useUIStore(
    useShallow((state) => ({
      imageBackgroundWidth: state.imageBackgroundWidth,
      imageBackgroundHeight: state.imageBackgroundHeight,
      setImageBackgroundDimensions: state.setImageBackgroundDimensions,
      imageIllustrationWidth: state.imageIllustrationWidth,
      imageIllustrationHeight: state.imageIllustrationHeight,
      setImageIllustrationDimensions: state.setImageIllustrationDimensions,
      imageGameWidth: state.imageGameWidth,
      imageGameHeight: state.imageGameHeight,
      setImageGameDimensions: state.setImageGameDimensions,
      imagePortraitWidth: state.imagePortraitWidth,
      imagePortraitHeight: state.imagePortraitHeight,
      setImagePortraitDimensions: state.setImagePortraitDimensions,
      imageCharacterSheetWidth: state.imageCharacterSheetWidth,
      imageCharacterSheetHeight: state.imageCharacterSheetHeight,
      setImageCharacterSheetDimensions: state.setImageCharacterSheetDimensions,
      imageSelfieWidth: state.imageSelfieWidth,
      imageSelfieHeight: state.imageSelfieHeight,
      setImageSelfieDimensions: state.setImageSelfieDimensions,
    })),
  );
  return [
    {
      id: "image-background-size",
      labelKey: "settings.controls.backgroundGeneration.label",
      helpKey: "settings.controls.backgroundGeneration.help",
      width: s.imageBackgroundWidth,
      height: s.imageBackgroundHeight,
      set: s.setImageBackgroundDimensions,
    },
    {
      id: "image-illustration-size",
      labelKey: "settings.controls.illustrations.label",
      helpKey: "settings.controls.illustrations.help",
      width: s.imageIllustrationWidth,
      height: s.imageIllustrationHeight,
      set: s.setImageIllustrationDimensions,
    },
    {
      id: "image-game-size",
      labelKey: "settings.controls.gameGeneration.label",
      helpKey: "settings.controls.gameGeneration.help",
      width: s.imageGameWidth,
      height: s.imageGameHeight,
      set: s.setImageGameDimensions,
    },
    {
      id: "image-portrait-size",
      labelKey: "settings.controls.portraits.label",
      helpKey: "settings.controls.portraits.help",
      width: s.imagePortraitWidth,
      height: s.imagePortraitHeight,
      set: s.setImagePortraitDimensions,
    },
    {
      id: "image-character-sheet-size",
      labelKey: "settings.controls.characterSheets.label",
      helpKey: "settings.controls.characterSheets.help",
      width: s.imageCharacterSheetWidth,
      height: s.imageCharacterSheetHeight,
      set: s.setImageCharacterSheetDimensions,
    },
    {
      id: "image-selfie-size",
      labelKey: "settings.controls.selfies.label",
      helpKey: "settings.controls.selfies.help",
      width: s.imageSelfieWidth,
      height: s.imageSelfieHeight,
      set: s.setImageSelfieDimensions,
    },
  ];
}

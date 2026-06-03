import type { AvatarCropValue } from "../../../shared/lib/utils";

export type CharacterMap = Map<
  string,
  {
    name: string;
    description?: string;
    personality?: string;
    backstory?: string;
    appearance?: string;
    scenario?: string;
    example?: string;
    systemPrompt?: string;
    postHistoryInstructions?: string;
    avatarUrl: string | null;
    avatarFilePath?: string | null;
    avatarFilename?: string | null;
    nameColor?: string;
    dialogueColor?: string;
    boxColor?: string;
    avatarCrop?: AvatarCropValue | null;
    conversationStatus?: "online" | "idle" | "dnd" | "offline";
    conversationActivity?: string;
  }
>;

export type PersonaInfo = {
  name: string;
  description?: string;
  personality?: string;
  backstory?: string;
  appearance?: string;
  scenario?: string;
  avatarUrl?: string;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
  avatarCrop?: AvatarCropValue | null;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
};

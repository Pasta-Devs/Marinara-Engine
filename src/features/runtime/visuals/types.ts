import type { AvatarCropValue } from "../../../shared/lib/utils";
import type { ConversationAvatarOverride } from "../../../engine/contracts/types/character";

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
    /** Conversation-mode avatar override (raw reference; sprite/gallery resolved into conversationAvatarSrc) */
    conversationAvatar?: ConversationAvatarOverride;
    /** Resolved image src for sprite/gallery override modes (filled during map build); undefined otherwise */
    conversationAvatarSrc?: string | null;
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

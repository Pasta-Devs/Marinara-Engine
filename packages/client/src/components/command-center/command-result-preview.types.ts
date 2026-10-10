import type { CommandResult } from "../../lib/command-center";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import type { CommandCenterMediaKind } from "./CommandCenterMedia";

export type CommandCenterPreviewKind =
  "chat" | "character" | "persona" | "lorebook" | "preset" | "connection" | "agent" | "docs";

export interface CommandCenterPreviewFact {
  label: string;
  value: string | number;
}

export interface CommandCenterPreviewMedia {
  src: string;
  alt: string;
  kind?: CommandCenterMediaKind;
  avatarCropStyle?: CSSProperties;
}

export interface CommandCenterPreviewData {
  kind: CommandCenterPreviewKind;
  title?: string;
  categoryLabel?: string;
  eyebrow?: string;
  subtitle?: string;
  description?: string;
  media?: CommandCenterPreviewMedia;
  accent?: string;
  badges?: readonly string[];
  tags?: readonly string[];
  status?: { label: string; tone?: "neutral" | "success" | "warning" | "danger" };
  metadataLine?: string;
  supportingInfo?: string;
  facts?: readonly CommandCenterPreviewFact[];
  /** Short how-to steps (FAQ bullets), shown as a list rather than as facts. */
  steps?: readonly string[];
  /** A chat's characters (Q6): the first three, for the stacked faces, and how many there are. */
  participants?: readonly { src?: string | null; avatarCropStyle?: CSSProperties }[];
  participantCount?: number;
  /** Lorebooks attached to a chat. */
  lorebookCount?: number;
}

export interface RichCommandResult extends CommandResult {
  preview?: CommandCenterPreviewData;
}

export interface CommandResultPreviewAction {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  onSelect: (result: RichCommandResult) => void;
  disabled?: boolean;
  /** Removes something, so it renders with the danger tone. */
  danger?: boolean;
}

import {
  BookOpen,
  StickyNote,
  Feather,
  Clapperboard,
  ShieldCheck,
  FileText,
  Brain,
  ArrowRightLeft,
  VenetianMask,
  MessageCircle,
  Paintbrush,
  Image,
  Music2,
  Vibrate,
  Archive,
  MessageSquareQuote,
  Map as MapIcon,
  Bot,
  UserRound,
  Puzzle,
} from "lucide-react";
import { STORYBOARD_AGENT_ID } from "@marinara-engine/shared";

export function renderRoleplayAgentMenuIcon(agentId: string, variant: "card" | "chip" = "card"): React.ReactNode {
  const size = variant === "chip" ? "0.6875rem" : "0.75rem";
  const className = variant === "chip" ? "shrink-0 text-[var(--primary)]" : "mt-0.5 shrink-0 text-[var(--primary)]";
  switch (agentId) {
    case "lorebook-keeper":
      return <BookOpen size={size} className={className} />;
    case "card-evolution-auditor":
      return <StickyNote size={size} className={className} />;
    case "prose-guardian":
      return <Feather size={size} className={className} />;
    case "director":
      return <Clapperboard size={size} className={className} />;
    case "continuity":
      return <ShieldCheck size={size} className={className} />;
    case "html":
      return <FileText size={size} className={className} />;
    case "knowledge-retrieval":
      return <Brain size={size} className={className} />;
    case "knowledge-router":
      return <ArrowRightLeft size={size} className={className} />;
    case "expression":
      return <VenetianMask size={size} className={className} />;
    case "echo-chamber":
      return <MessageCircle size={size} className={className} />;
    case "illustrator":
      return <Paintbrush size={size} className={className} />;
    case STORYBOARD_AGENT_ID:
      return <Image size={size} className={className} />;
    case "spotify":
      return <Music2 size={size} className={className} />;
    case "haptic":
      return <Vibrate size={size} className={className} />;
    case "long-term-memory":
      return <Archive size={size} className={className} />;
    case "memory-nag":
      return <MessageSquareQuote size={size} className={className} />;
    case "hierarchical-maps":
      return <MapIcon size={size} className={className} />;
    case "custom-agents":
      return <Bot size={size} className={className} />;
    case "avatars":
      return <UserRound size={size} className={className} />;
    default:
      return <Puzzle size={size} className={className} />;
  }
}

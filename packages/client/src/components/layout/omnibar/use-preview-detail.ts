import { useEffect, useState } from "react";
import type { Character } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { useCharacter } from "../../../hooks/use-characters";
import { useChatMessageCount, useChatMessagePeek } from "../../../hooks/use-chats";
import { useLorebookEntries } from "../../../hooks/use-lorebooks";
import type { CommandCenterPreviewFact } from "../../command-center/command-result-preview.types";
import { type RankedOmnibarResult } from "./omnibar-result-view";

/**
 * Tier-2 preview data: fetched lazily only for the one focused result, gated by
 * a short focus dwell so arrow-key scrubbing does not fire a request per row.
 * React Query caches by id, so re-focusing a result is instant.
 */
export function usePreviewDetail(previewResult: RankedOmnibarResult | null): {
  extraFacts: CommandCenterPreviewFact[];
  note: string | null;
  detailLoading: boolean;
} {
  const { t } = useTranslation();
  const category = previewResult?.category;
  const resourceId = previewResult ? previewResult.id.slice(previewResult.id.indexOf(":") + 1) : "";

  const [settledId, setSettledId] = useState<string | null>(null);
  useEffect(() => {
    if (!previewResult) {
      setSettledId(null);
      return;
    }
    const id = previewResult.id;
    const timer = window.setTimeout(() => setSettledId(id), 160);
    return () => window.clearTimeout(timer);
  }, [previewResult]);
  const settled = !!previewResult && settledId === previewResult.id;

  const chatId = category === "chat" && settled ? resourceId : null;
  const lorebookId = category === "lorebook" && settled ? resourceId : null;
  // Characters are the most-used kind and had no lazy detail at all.
  const characterId = category === "character" && settled ? resourceId : null;

  const peek = useChatMessagePeek(chatId, 1, !!chatId);
  const messageCount = useChatMessageCount(chatId);
  const entries = useLorebookEntries(lorebookId);
  const character = useCharacter(characterId);

  if (chatId) {
    const extraFacts: CommandCenterPreviewFact[] =
      typeof messageCount.data?.count === "number"
        ? [{ label: t("commandCenter.preview.messages", "Messages"), value: messageCount.data.count }]
        : [];
    return { extraFacts, note: peek.data?.at(-1)?.content?.trim() || null, detailLoading: peek.isLoading };
  }

  if (characterId) {
    // The route sends the card as a JSON string, so reading `.first_mes` off it directly found nothing.
    const raw = (character.data as { data?: unknown } | undefined)?.data;
    let data: Character["data"] | undefined;
    try {
      data = typeof raw === "string" ? JSON.parse(raw) : (raw as Character["data"] | undefined);
    } catch {
      data = undefined;
    }
    const extraFacts: CommandCenterPreviewFact[] = data?.alternate_greetings?.length
      ? [{ label: t("commandCenter.preview.greetings", "Greetings"), value: data.alternate_greetings.length + 1 }]
      : [];
    // The greeting is what the character actually opens with, so it says more
    // about them than the description does.
    return { extraFacts, note: data?.first_mes?.trim() || null, detailLoading: character.isLoading };
  }

  if (lorebookId) {
    const first = entries.data?.[0];
    const note = entries.isLoading
      ? null
      : first
        ? t("commandCenter.preview.entryNote", "{{name}}: {{content}}", {
            name: first.name?.trim() || t("commandCenter.preview.untitledEntry", "Untitled entry"),
            content: first.content?.trim() ?? "",
          })
        : t("commandCenter.preview.noLorebookEntries", "No entries yet");
    return { extraFacts: [], note, detailLoading: entries.isLoading };
  }

  return { extraFacts: [], note: null, detailLoading: false };
}

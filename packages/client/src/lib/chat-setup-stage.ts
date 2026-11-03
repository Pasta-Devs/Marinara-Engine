/** Pure rules for the setup stage a new roleplay chat shows above its greeting. */

export function shouldShowSetupStage(input: {
  chatId: string | null | undefined;
  mode: string | null | undefined;
  stageChatId: string | null;
  setupComplete: unknown;
  messages: ReadonlyArray<{ role: string; chatId: string }> | undefined;
}): boolean {
  return (
    !!input.chatId &&
    input.chatId === input.stageChatId &&
    (input.mode === "roleplay" || input.mode === "conversation") &&
    input.setupComplete !== true &&
    !chatTurnTaken(input.messages, input.chatId, input.mode)
  );
}

/**
 * Setup ends with the first turn: a user message, or any message beyond the roleplay opening greeting
 * (conversation chats get no greeting, so an autonomous message counts too). Right after a chat switch the
 * list can still hold the previous chat's messages, so only this chat's count.
 */
export function chatTurnTaken(
  messages: ReadonlyArray<{ role: string; chatId: string }> | undefined,
  chatId: string | null | undefined,
  mode: string | null | undefined,
): boolean {
  if (!chatId) return false;
  const own = (messages ?? []).filter((message) => message.chatId === chatId);
  return own.some((message) => message.role === "user") || own.length > (mode === "roleplay" ? 1 : 0);
}

/** One short line from the character card, or nothing when the description is long or templated. */
export function stageTagline(description: string | null | undefined): string | null {
  const text = (description ?? "").trim();
  if (!text || text.includes("{{") || text.includes("<")) return null;
  const sentence = text.match(/^[^\n]*?[.!?](?=\s|$)/)?.[0] ?? text.split("\n")[0]!;
  return sentence.length <= 90 ? sentence : null;
}

/** The avatar's strongest colour as the stage accent, or null when it is grey (the stage keeps --primary). */
export function stageAccent(hex: string | null | undefined): string | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  if (!match) return null;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  const max = Math.max(r, g, b);
  return max === 0 || (max - Math.min(r, g, b)) / max < 0.25 ? null : match[0];
}

/** "Harbor at night" from ".../harbor-at-night.jpg". */
export function backgroundLabel(url: string | null | undefined): string | null {
  if (!url) return null;
  const file = decodeURIComponent(url.split(/[?#]/)[0]!.split("/").pop() ?? "");
  const name = file
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
}

/** Labels of the options chosen for a preset's variables, such as "An adventure, Third person". */
export function presetChoiceSummary(
  blocks: ReadonlyArray<{ variableName: string; options: unknown }>,
  choices: Record<string, unknown>,
): string | null {
  const labels = blocks.flatMap((block) => {
    const selected = choices[block.variableName];
    const picked = new Set((Array.isArray(selected) ? selected : [selected]).filter((v) => typeof v === "string"));
    if (picked.size === 0) return [];
    let options: unknown = block.options;
    try {
      if (typeof options === "string") options = JSON.parse(options);
    } catch {
      return [];
    }
    if (!Array.isArray(options)) return [];
    return options
      .filter((option) => option && (picked.has(option.id) || picked.has(option.value)))
      .map((option) => String(option.label ?? option.value));
  });
  return labels.length ? labels.join(", ") : null;
}

/**
 * What a World switch on the setup stage writes, the same as Chat Settings: a book pinned to the chat
 * leaves its list, an auto-activated one (character, global, persona) toggles the exclude list,
 * and any other book joins the chat's list.
 */
/** After a cast change on the stage: drop a greeting whose character left, and greet with the first character when none is left. */
export function stageGreetingSwap(first: { characterId?: string | null } | null, cast: readonly string[]) {
  const stale = !!first?.characterId && !cast.includes(first.characterId);
  return { drop: stale, greet: !first || stale ? (cast[0] ?? null) : null };
}

export function lorebookSwitchWrite(
  id: string,
  view: { isPinned: boolean; isExcluded: boolean; activeReasons: readonly string[] } | undefined,
  activeIds: readonly string[],
  excludedIds: readonly string[],
): { activeLorebookIds: string[] } | { excludedLorebookIds: string[] } {
  if (view?.isPinned) return { activeLorebookIds: activeIds.filter((x) => x !== id) };
  if (view?.activeReasons.some((reason) => reason !== "Chat"))
    return { excludedLorebookIds: view.isExcluded ? excludedIds.filter((x) => x !== id) : [...excludedIds, id] };
  return { activeLorebookIds: [...activeIds, id] };
}

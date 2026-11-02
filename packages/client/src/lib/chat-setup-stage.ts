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
    !userMessageSent(input.messages, input.chatId)
  );
}

/** Right after a chat switch the list can still hold the previous chat's messages, so only this chat's count. */
export function userMessageSent(
  messages: ReadonlyArray<{ role: string; chatId: string }> | undefined,
  chatId: string | null | undefined,
): boolean {
  return !!chatId && (messages ?? []).some((message) => message.chatId === chatId && message.role === "user");
}

/** One short line from the character card, or nothing when the description is long or templated. */
export function stageTagline(description: string | null | undefined): string | null {
  const text = (description ?? "").trim();
  if (!text || text.includes("{{") || text.includes("<")) return null;
  const sentence = text.match(/^[^\n]*?[.!?](?=\s|$)/)?.[0] ?? text.split("\n")[0]!;
  return sentence.length <= 90 ? sentence : null;
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

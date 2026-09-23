// Prompt inspection: the exact prompt the engine sent for a reply, cache statistics, and where two prompts diverge.
import { api, getMessages } from "./api.mjs";

/**
 * With a messageId: the exact saved request for that reply (404 when none was saved).
 * Without: the engine's live preview of what the NEXT turn would send, assembled without calling the model.
 */
export async function peekPrompt(chatId, messageId) {
  return api(`/chats/${encodeURIComponent(chatId)}/peek-prompt`, {
    method: "POST",
    body: messageId ? { messageId } : {},
    timeoutMs: 60_000,
  });
}

/** The newest replies that still have their exact saved request, newest first. */
export async function latestSavedPrompts(chatId, count = 1, lookBack = 15) {
  const replies = (await getMessages(chatId)).filter((m) => m.role === "assistant").reverse().slice(0, lookBack);
  const found = [];
  for (const reply of replies) {
    try {
      const peek = await peekPrompt(chatId, reply.id);
      if (Array.isArray(peek?.messages) && peek.messages.length) found.push({ messageId: reply.id, peek });
    } catch {
      /* no saved request for this reply */
    }
    if (found.length >= count) break;
  }
  return found;
}

const firstLine = (text) => String(text ?? "").split("\n").find((line) => line.trim())?.trim().slice(0, 140) ?? "";

/** Outline of a prompt: one row per message with role, size and its opening line (tags make sections obvious). */
export function outline(messages) {
  let offset = 0;
  return messages.map((message, index) => {
    const content = String(message.content ?? "");
    const row = { index, role: message.role, chars: content.length, startsAtChar: offset, opens: firstLine(content) };
    offset += content.length;
    return row;
  });
}

export function usageOf(message) {
  const info = message.extra?.generationInfo ?? {};
  const prompt = Number(info.tokensPrompt ?? 0);
  const cached = Number(info.tokensCachedPrompt ?? 0);
  return {
    messageId: message.id,
    at: message.createdAt,
    model: info.model ?? null,
    provider: info.provider ?? null,
    promptTokens: prompt || null,
    cachedTokens: cached || 0,
    cacheWriteTokens: Number(info.tokensCacheWritePrompt ?? 0),
    // Anthropic-style usage reports input tokens EXCLUDING cache reads/writes (cached > prompt, or writes present);
    // OpenAI-style prompt tokens already include the cached part.
    cacheHitPercent: (() => {
      const write = Number(info.tokensCacheWritePrompt ?? 0);
      const total = cached > prompt || write > 0 ? prompt + cached + write : prompt;
      return total ? Math.round((cached / total) * 1000) / 10 : null;
    })(),
    completionTokens: info.tokensCompletion ?? null,
    reasoningTokens: info.tokensReasoning ?? null,
    durationSeconds: info.durationMs ? Math.round(info.durationMs / 100) / 10 : null,
    effort: info.reasoningEffort ?? null,
  };
}

export async function cacheReport(chatId, last) {
  const messages = await getMessages(chatId);
  const rows = messages.filter((m) => m.role === "assistant" && m.extra?.generationInfo).slice(-last).map(usageOf);
  const withPrompt = rows.filter((row) => row.promptTokens);
  const avg = withPrompt.length
    ? Math.round((withPrompt.reduce((sum, row) => sum + row.cacheHitPercent, 0) / withPrompt.length) * 10) / 10
    : null;
  const drops = rows.filter((row, i) => i > 0 && row.cacheHitPercent !== null && row.cacheHitPercent < 70);
  return { averageCacheHitPercent: avg, lowCacheTurns: drops.map((row) => row.messageId), turns: rows };
}

/**
 * Where two prompts first differ. Prefix caching reuses everything before the first changed character, so this is
 * the cache-break location: which message, at what offset, and the text on each side.
 */
export function diffPrompts(a, b, context = 300) {
  const count = Math.min(a.length, b.length);
  let charsBefore = 0;
  for (let index = 0; index < count; index += 1) {
    const left = String(a[index].content ?? "");
    const right = String(b[index].content ?? "");
    if (a[index].role === b[index].role && left === right) {
      charsBefore += left.length;
      continue;
    }
    let offset = 0;
    while (offset < left.length && offset < right.length && left[offset] === right[offset]) offset += 1;
    const totalB = b.reduce((sum, message) => sum + String(message.content ?? "").length, 0);
    return {
      identical: false,
      firstDifferentMessage: index,
      roleA: a[index].role,
      roleB: b[index].role,
      offsetInMessage: offset,
      sharedPrefixChars: charsBefore + offset,
      sharedPrefixPercentOfB: totalB ? Math.round(((charsBefore + offset) / totalB) * 1000) / 10 : null,
      messageOpens: firstLine(right),
      before: left.slice(Math.max(0, offset - 80), offset + context),
      after: right.slice(Math.max(0, offset - 80), offset + context),
    };
  }
  if (a.length === b.length) return { identical: true };
  return { identical: false, firstDifferentMessage: count, note: `prompt A has ${a.length} messages, B has ${b.length}` };
}

import {
  getRoleplayArtifacts,
  getRoleplayDocuments,
  getRoleplayWhispers,
  type WrapFormat,
} from "@marinara-engine/shared";

import { isSentSelfieAttachment, type PromptAttachment } from "../../services/generation/prompt-attachments.js";
import { parseRoleplayUserCommands } from "../../services/generation/roleplay-commands.js";
import type { GenerationPromptMessage } from "../../services/generation/prompt-message-scope.js";
import { wrapContent } from "../../services/prompt/format-engine.js";
import { parseExtra } from "./generate-route-utils.js";

export const CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION = "Remember to prefix messages with `Name: message`!";
export const CONVERSATION_NO_REPEAT_INSTRUCTION =
  "Do not repeat a message you already sent in the recent conversation. If your first draft repeats one, write a genuinely different response.";

export function formatConversationGroupOutputFormat(args: {
  wrapFormat: WrapFormat;
  characterNames: string[];
  userName: string;
  turnCharacterName?: string | null;
}): string {
  const characterList = Array.from(new Set(args.characterNames.map((name) => name.trim()).filter(Boolean))).join(", ");
  const userName = args.userName.trim() || "the user";
  const responseBoundary = `Only respond for these characters: ${characterList || "the listed characters"}. Never respond for ${userName} or write ${userName}'s messages.`;
  const turnCharacterName = args.turnCharacterName?.trim();
  return wrapContent(
    turnCharacterName
      ? `Respond only as ${turnCharacterName}.`
      : [CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION, responseBoundary].join("\n"),
    "Output Format",
    args.wrapFormat,
  );
}

function presetStringField(preset: Record<string, unknown> | null | undefined, field: string): string {
  const value = preset?.[field];
  return typeof value === "string" ? value.trim() : "";
}

export function resolvePresetModePrompt(
  preset: Record<string, unknown> | null | undefined,
  mode: "conversation" | "game",
): string {
  return mode === "conversation"
    ? presetStringField(preset, "conversationPrompt")
    : presetStringField(preset, "gamePrompt");
}

export function formatConversationSummaryHistoryBlock(label: string, summary: string, wrapFormat: WrapFormat): string {
  if (wrapFormat === "xml") return `<summary ${label}>\n${summary}\n</summary>`;
  const displayLabel = label.replace(/="/g, ": ").replace(/"$/g, "");
  if (wrapFormat === "markdown") return `## Summary (${displayLabel})\n${summary}`;
  return `Summary (${displayLabel})\n${summary}`;
}

export function formatConversationDateHistoryMessages(
  messages: Array<{ role: "system" | "user" | "assistant"; author: string; content: string }>,
  date: string,
  wrapFormat: WrapFormat,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  if (messages.length === 0) return [];
  if (wrapFormat === "xml") {
    return messages.map((message, idx) => {
      let content = `${message.author}: ${message.content}`;
      if (idx === 0) content = `<date="${date}">\n${content}`;
      if (idx === messages.length - 1) content = `${content}\n</date>`;
      return { role: message.role, content };
    });
  }

  return messages.map((message, idx) => {
    const prefix = idx === 0 ? (wrapFormat === "markdown" ? `## Date: ${date}\n` : `Date: ${date}\n`) : "";
    return { role: message.role, content: `${prefix}${message.author}: ${message.content}` };
  });
}

export function appendToFirstSystemMessage(messages: GenerationPromptMessage[], content: string): void {
  const systemMessage = messages.find((message) => message.role === "system");
  if (systemMessage) {
    systemMessage.content = systemMessage.content ? `${systemMessage.content}\n\n${content}` : content;
    return;
  }
  messages.unshift({ role: "system", content });
}

export function latestHistoryUserContent(messages: GenerationPromptMessage[]): string {
  const historyTurn = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.contextKind === "history");
  if (historyTurn) return historyTurn.content;
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

export function conversationPromptHistoryContent(
  message: { role?: unknown; content?: unknown; extra?: unknown },
  chatMode: string,
): string {
  if (chatMode === "roleplay" && message.role === "user") {
    const content = parseRoleplayUserCommands(typeof message.content === "string" ? message.content : "").content;
    return content.trim() || !getRoleplayWhispers(parseExtra(message.extra)).length ? content : "[Private whisper]";
  }
  if (chatMode === "roleplay" && message.role === "assistant") {
    const extra = parseExtra(message.extra);
    const documents = getRoleplayDocuments(extra);
    const content = typeof message.content === "string" ? message.content : "";
    if (Array.isArray(documents))
      return [
        content.trim() || !getRoleplayWhispers(extra).length ? content : "[Private whisper]",
        ...documents
          .filter((document) => document && typeof document.title === "string" && typeof document.content === "string")
          .map((document) => `Document: ${document.title}\n${document.content}`),
        ...getRoleplayArtifacts(extra).map(({ artifact }) => `Artifact: ${artifact.memory}`),
      ].join("\n\n");
  }
  if (chatMode === "conversation" && message.role === "assistant") {
    const commandContent = parseExtra(message.extra).conversationCommandContent;
    if (typeof commandContent === "string" && commandContent.trim()) {
      return commandContent;
    }
  }
  return typeof message.content === "string" ? message.content : "";
}

const SENT_SELFIE_DESCRIPTION_MAX_CHARS = 600;

// A field label starts a line: a word and up to two more words or numbers, then a colon ("camera: …", "Shot_1: …",
// "Shot 1: …", "Aspect Ratio: …", "OVERALL_SOUNDSCAPE: …"). A link ("https://…") is not one.
const LINE_START_LABEL_RE =
  /^([ \t]*)([A-Za-z][A-Za-z0-9_]*(?: (?:[A-Za-z][A-Za-z0-9_]*|\d+)){0,2})[ \t]*:(?!\/\/)[ \t]*/gmu;
// A negative prompt lists what the clip must not show, so its line goes whole, as its JSON field does.
const NEGATIVE_PROMPT_LINE_RE = /^[ \t]*negative(?:[ _]prompt)?[ \t]*:.*$/gimu;
// Words a label never holds: articles, pronouns, prepositions, conjunctions and auxiliaries mark prose ("The camera:",
// "Her tone:", "Mara to lens:", "She smiles:").
const PROSE_WORDS = new Set(
  (
    "a an the this that these those i me my mine you your yours he him his she her hers it its we us our ours they " +
    "them their theirs who whom whose which what to of in on at by for with from into onto upon over under about " +
    "after before as and or but nor so yet if then than not no is are was were be been am do does did has have had " +
    "will would can could should may might must"
  ).split(" "),
);
// Before a quoted value, a head shaped like a name ("Guard", "Old Guard", "GUARD", "Guard 1": capitalised plain words,
// perhaps numbered) is a speaker outside the chat ('Guard: "Wait"'), unless a word in it names a prompt field
// ('Scene: "A rainy street."', 'Shot 1: "Close-up."'). Lowercase or underscored heads ("camera", "shot_1",
// "overall_soundscape") are never names.
const NAME_WORD_RE = /^(?:[A-Z][A-Za-z]*|\d+)$/u;
const FIELD_WORDS = new Set(
  (
    "action ambience angle aspect atmosphere audio background camera caption captions character characters " +
    "cinematography color colors composition continuity description dialog dialogue direction director duration " +
    "editing effects environment exposure focus format fps frame framing foreground genre lens lighting line " +
    "lines location mood motion movement music narration notes overall pacing palette prompt quote rate ratio " +
    "resolution scene setting shot shots sound soundscape sfx speech style subject subjects subtitle subtitles " +
    "text time timing title tone transition visual visuals voice voiceover vo weather"
  ).split(" "),
);

/** "lower", "upper" or "title", read from a word's letters before any `_` or digit. */
function wordCase(word: string): string {
  const letters = word.match(/^[A-Za-z]+/u)![0];
  if (letters === letters.toLowerCase()) return "lower";
  if (letters.length > 1 && letters === letters.toUpperCase()) return "upper";
  return "title";
}

/**
 * Removes line-start field labels. A label is judged by its shape: no prose word, and every word in one case
 * ("Aspect Ratio", "camera angle", "Shot 1"; numbers have none) or a field word last ("Camera angle"), so a sentence
 * ("Ana smiles:") stays. A speaker stays too: a head with any word of a chat member's name (`speakerNameParts`: "Ana:",
 * "ALICE:", "Ana Lee:"), or a name-shaped head before a quote (a speaker outside the chat: 'Guard: "Wait"'), is
 * dialogue, not a label.
 */
function stripFieldLabels(text: string, speakerNameParts: ReadonlySet<string>): string {
  return text
    .replace(NEGATIVE_PROMPT_LINE_RE, "")
    .replace(LINE_START_LABEL_RE, (label, indent: string, head: string, offset: number, all: string) => {
      const words = head.split(" ");
      const folded = words.map((word) => word.toLowerCase());
      if (folded.some((word) => PROSE_WORDS.has(word) || speakerNameParts.has(word))) return label;
      const quoted = /^["“]/u.test(all.slice(offset + label.length));
      if (quoted && words.every((word) => NAME_WORD_RE.test(word)) && !folded.some((word) => FIELD_WORDS.has(word)))
        return label;
      const lettered = words.filter((word) => /^[A-Za-z]/u.test(word));
      const isLabel = new Set(lettered.map(wordCase)).size === 1 || FIELD_WORDS.has(lettered.at(-1)!.toLowerCase());
      return isLabel ? `${indent} ` : label;
    });
}

/**
 * Bracketed cues ("[Shot 1: close-up]", "[cut to window]") would nest inside the note's own brackets, so every
 * bracketed span goes, nested ones too, and a cue that never closes runs to the end of its line. One pass, so a run of
 * brackets can't make it slow.
 */
function stripBracketedCues(text: string): string {
  let out = "";
  let depth = 0;
  for (const char of text) {
    if (char === "\n") {
      depth = 0;
      out += char;
    } else if (char === "[") {
      if (depth === 0) out += " ";
      depth += 1;
    } else if (char === "]") {
      if (depth === 0) out += " ";
      else depth -= 1;
    } else if (depth === 0) {
      out += char;
    }
  }
  return out;
}

/** The words of a video prompt in a technical format: no JSON, field labels or bracketed cues. */
function videoPromptWords(prompt: string, speakerNameParts: ReadonlySet<string>): string {
  let text = prompt;
  try {
    const parsed = JSON.parse(prompt) as unknown;
    // Every string in it, nested ones too ({"shots":[{"description":"…"}]}), and JSON kept inside a string. A negative
    // prompt lists what the clip must not show, so it is left out.
    const strings = (value: unknown): string[] =>
      typeof value === "string"
        ? [
            /^\s*[[{]/u.test(value)
              ? videoPromptWords(value, speakerNameParts)
              : stripFieldLabels(value, speakerNameParts),
          ]
        : value && typeof value === "object"
          ? Object.entries(value)
              .filter(([key]) => !/negative/iu.test(key))
              .flatMap(([, item]) => strings(item))
          : [];
    // One field per line, so an unclosed cue in one field can't take the next one with it.
    if (parsed && typeof parsed === "object") text = strings(parsed).join("\n");
  } catch {
    // Not JSON: plain text, perhaps with field labels.
  }
  return stripFieldLabels(stripBracketedCues(text), speakerNameParts);
}

/**
 * History notes for video messages a character sent, so the next reply knows a clip went out and
 * what it shows. Only Conversation video messages name a sender; Roleplay scene clips stay hidden
 * like Illustrator images. `speakerNames` are the chat's characters and persona, so a line such as "Alice: …" in
 * the prompt keeps its speaker; the sender always counts.
 */
/** A video message a character sent: it names its sender (Roleplay scene clips don't). */
export function isSentVideoAttachment(attachment: PromptAttachment): boolean {
  return attachment.type === "video" && !!attachment.characterName?.trim();
}

export function formatSentVideoNotes(
  attachments: PromptAttachment[] | undefined,
  speakerNames: readonly string[] = [],
): string {
  return (attachments ?? [])
    .filter(isSentVideoAttachment)
    .map((attachment) => {
      // The video model's prompt may follow a technical format (JSON, "overall_soundscape: …", "[Shot 1] …"); the
      // note keeps only its words, so characters don't copy that format into their own [video] tags.
      // videoPromptWords leaves no bracket, so the note holds exactly one pair.
      const nameParts = new Set(
        [...speakerNames, attachment.characterName!].flatMap((name) => name.toLowerCase().split(/[^\p{L}\p{N}_]+/u)),
      );
      nameParts.delete("");
      const description = videoPromptWords(attachment.prompt ?? "", nameParts)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, SENT_SELFIE_DESCRIPTION_MAX_CHARS);
      return `\n[${attachment.characterName!.trim()} sent a video message${description ? `: ${description}` : ""}]`;
    })
    .join("");
}

/**
 * History notes for selfies a character sent, so the next reply knows a photo went out and what it
 * shows. A saved caption describes the real image and wins, even after captioning is turned off;
 * otherwise the image prompt's first paragraph (later ones are appearance and reference notes).
 */
export function formatSentSelfieNotes(attachments: PromptAttachment[] | undefined): string {
  return (attachments ?? [])
    .filter(isSentSelfieAttachment)
    .map((attachment) => {
      const description = (attachment.imageCaption?.trim() || (attachment.prompt ?? "").split(/\n\s*\n/)[0]!)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, SENT_SELFIE_DESCRIPTION_MAX_CHARS);
      // Selfies saved before the sender was recorded have no name; their note stays unattributed.
      const sender = attachment.characterName?.trim();
      return `\n[${sender ? `${sender} sent` : "Sent"} a selfie${description ? `: ${description}` : ""}]`;
    })
    .join("");
}

/**
 * An assistant message's history text with notes for the media it sent: a photo the user uploaded under it, the
 * character's selfies (`selfieAttachments` may carry fresh captions) and video messages. Generation and Peek Prompt
 * both use it, so the preview shows what the model reads.
 */
export function appendSentMediaNotes(
  content: string,
  attachments: PromptAttachment[] | undefined,
  selfieAttachments: PromptAttachment[] | undefined = attachments,
  speakerNames: readonly string[] = [],
): string {
  const userUploadedImages = attachments?.filter((attachment) => attachment.type?.startsWith("image/"));
  if (userUploadedImages?.length) {
    const photoName = userUploadedImages[0]!.filename ?? userUploadedImages[0]!.name;
    content += `\n[Sent a photo${photoName ? `: ${photoName}` : ""}]`;
  }
  content += formatSentSelfieNotes(selfieAttachments);
  const videoNotes = formatSentVideoNotes(attachments, speakerNames);
  // A video-only message has no text of its own; its note then starts the turn without a blank line.
  return videoNotes ? (content.trim() ? content + videoNotes : videoNotes.trimStart()) : content;
}

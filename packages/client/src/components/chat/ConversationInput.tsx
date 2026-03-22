// ──────────────────────────────────────────────
// Chat: Conversation Input — Discord-style
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Smile, StopCircle, X, Plus, ImagePlay } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { useGenerate } from "../../hooks/use-generate";
import { useApplyRegex } from "../../hooks/use-apply-regex";
import { useCreateMessage, chatKeys } from "../../hooks/use-chats";
import {
  matchSlashCommand,
  getSlashCompletions,
  type SlashCommand,
  type SlashCommandContext,
} from "../../lib/slash-commands";
import { cn } from "../../lib/utils";
import { EmojiPicker } from "../ui/EmojiPicker";
import { GifPicker } from "../ui/GifPicker";

interface Attachment {
  type: string;
  data: string;
  name: string;
}

/** Convert a GIF (or any image) blob to PNG via canvas, returning a new Blob + data URL */
async function convertToPng(blob: Blob): Promise<{ blob: Blob; dataUrl: string }> {
  const bitmap = await createImageBitmap(blob);

  let pngBlob: Blob;

  // Prefer OffscreenCanvas when available, fall back to regular <canvas> for broader support (e.g., Safari/iOS).
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from OffscreenCanvas");
    }
    ctx.drawImage(bitmap, 0, 0);
    pngBlob = await canvas.convertToBlob({ type: "image/png" });
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from HTMLCanvasElement");
    }
    ctx.drawImage(bitmap, 0, 0);
    pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blobResult) => {
          if (blobResult) {
            resolve(blobResult);
          } else {
            reject(new Error("Failed to convert canvas to PNG blob"));
          }
        },
        "image/png",
      );
    });
  }

  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(pngBlob);
  });
  return { blob: pngBlob, dataUrl };
}

interface ConversationInputProps {
  characterNames?: string[];
}

export function ConversationInput({ characterNames = [] }: ConversationInputProps) {
  const [hasInput, setHasInput] = useState(false);
  const [completions, setCompletions] = useState<SlashCommand[]>([]);
  const [selectedCompletion, setSelectedCompletion] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const gifButtonRef = useRef<HTMLButtonElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreamingGlobal = useChatStore((s) => s.isStreaming);
  const isStreaming = isStreamingGlobal && streamingChatId === activeChatId;
  const delayedCharacterInfo = useChatStore((s) => s.delayedCharacterInfo);
  // Show stop button only during actual generation, not during busy delay
  const isActuallyGenerating = isStreaming && !delayedCharacterInfo;
  const setInputDraft = useChatStore((s) => s.setInputDraft);
  const clearInputDraft = useChatStore((s) => s.clearInputDraft);
  const { generate } = useGenerate();
  const { applyToUserInput } = useApplyRegex();
  const enterToSend = useUIStore((s) => s.enterToSendConvo);
  const createMessage = useCreateMessage(activeChatId);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore draft
  const prevChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevChatIdRef.current !== activeChatId) {
      if (prevChatIdRef.current && textareaRef.current?.value) {
        setInputDraft(prevChatIdRef.current, textareaRef.current.value);
      }
      prevChatIdRef.current = activeChatId;
      if (textareaRef.current) {
        const draft = activeChatId ? (useChatStore.getState().inputDrafts.get(activeChatId) ?? "") : "";
        textareaRef.current.value = draft;
        setHasInput(draft.length > 0);
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
      }
    }
  }, [activeChatId, setInputDraft]);

  // Save draft on unmount
  useEffect(() => {
    const el = textareaRef.current;
    return () => {
      const id = prevChatIdRef.current;
      if (id && el?.value) {
        useChatStore.getState().setInputDraft(id, el.value);
      }
    };
  }, []);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const MAX_SIZE = 20 * 1024 * 1024;
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} exceeds 20 MB limit`);
        continue;
      }
      // Convert GIFs to PNG (Gemini and some providers don't support image/gif)
      if (file.type === "image/gif") {
        try {
          const { dataUrl } = await convertToPng(file);
          setAttachments((prev) => [
            ...prev,
            { type: "image/png", data: dataUrl, name: file.name.replace(/\.gif$/i, ".png") },
          ]);
        } catch {
          toast.error(`Failed to convert ${file.name}`);
        }
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [...prev, { type: file.type, data: reader.result as string, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!activeChatId) return;
    const raw = textareaRef.current?.value.trim() ?? "";
    if (!raw && attachments.length === 0) {
      return;
    }
    // If already generating for this chat, just save the message without
    // triggering another generation — the in-progress generation will see
    // it (server re-reads messages after any busy delay).
    if (isStreaming) {
      const message = applyToUserInput(raw);
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      setHasInput(false);
      clearInputDraft(activeChatId);
      const currentAttachments = [...attachments];
      setAttachments([]);
      createMessage.mutate({
        role: "user",
        content: message,
        characterId: null,
        ...(currentAttachments.length > 0 && { attachments: currentAttachments }),
      });
      return;
    }

    // Slash command check
    const matched = matchSlashCommand(raw);
    if (matched) {
      const slashCtx: SlashCommandContext = {
        chatId: activeChatId,
        generate,
        createMessage: (data) => createMessage.mutate(data),
        invalidate: () => qc.invalidateQueries({ queryKey: chatKeys.all }),
        characterNames,
      };
      if (textareaRef.current) textareaRef.current.value = "";
      setHasInput(false);
      clearInputDraft(activeChatId);
      setAttachments([]);
      const result = await matched.command.execute(matched.args, slashCtx);
      if (result.feedback) {
        setFeedback(result.feedback);
        setTimeout(() => setFeedback(null), 5000);
      }
      return;
    }

    const message = applyToUserInput(raw);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
    setHasInput(false);
    clearInputDraft(activeChatId);

    const pendingAttachments = attachments.map((a) => ({ type: a.type, data: a.data }));
    setAttachments([]);

    await generate({
      chatId: activeChatId,
      connectionId: null,
      userMessage: message,
      ...(pendingAttachments.length ? { attachments: pendingAttachments } : {}),
    });
  }, [
    activeChatId,
    attachments,
    isStreaming,
    generate,
    applyToUserInput,
    clearInputDraft,
    createMessage,
    characterNames,
    qc,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Slash completions navigation
      if (completions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedCompletion((p) => (p + 1) % completions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedCompletion((p) => (p - 1 + completions.length) % completions.length);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          const cmd = completions[selectedCompletion];
          if (cmd && textareaRef.current) {
            textareaRef.current.value = `/${cmd.name} `;
            setHasInput(true);
            setCompletions([]);
          }
          return;
        }
        if (e.key === "Escape") {
          setCompletions([]);
          return;
        }
      }

      const shouldSend = enterToSend ? e.key === "Enter" && !e.shiftKey : e.key === "Enter" && (e.metaKey || e.ctrlKey);
      if (shouldSend) {
        e.preventDefault();
        handleSend();
      }
    },
    [completions, selectedCompletion, enterToSend, handleSend],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    setHasInput(el.value.length > 0);

    // Slash completions
    if (el.value.startsWith("/")) {
      const results = getSlashCompletions(el.value);
      setCompletions(results);
      setSelectedCompletion(0);
    } else {
      setCompletions([]);
    }
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    el.value = value.slice(0, start) + emoji + value.slice(end);
    el.selectionStart = el.selectionEnd = start + emoji.length;
    setHasInput(el.value.length > 0);
    el.focus();
  }, []);

  const handleGifSelect = useCallback(
    async (gifUrl: string) => {
      if (!activeChatId) return;

      // Fetch the GIF and convert to PNG so all providers can handle it
      let gifAttachments: Array<{ type: string; data: string }> | undefined;
      try {
        const resp = await fetch(gifUrl);
        const blob = await resp.blob();
        const { dataUrl } = await convertToPng(blob);
        gifAttachments = [{ type: "image/png", data: dataUrl }];
      } catch {
        // If fetch fails (CORS etc.), send without attachment — still shows as image in chat
      }

      // If already streaming for this chat, just save the message
      if (isStreaming) {
        createMessage.mutate({ role: "user", content: gifUrl, characterId: null });
        return;
      }

      await generate({
        chatId: activeChatId,
        connectionId: null,
        userMessage: gifUrl,
        ...(gifAttachments ? { attachments: gifAttachments } : {}),
      });
    },
    [activeChatId, isStreaming, generate, createMessage],
  );

  return (
    <div className="relative px-3 pb-3">
      {/* Slash command autocomplete */}
      {completions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
          {completions.map((cmd, i) => (
            <button
              key={cmd.name}
              onMouseDown={(e) => {
                e.preventDefault();
                if (textareaRef.current) {
                  textareaRef.current.value = `/${cmd.name} `;
                  setHasInput(true);
                  setCompletions([]);
                  textareaRef.current.focus();
                }
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                i === selectedCompletion ? "bg-white/10 text-white" : "hover:bg-[var(--accent)]",
              )}
            >
              <span className="font-mono text-xs">/{cmd.name}</span>
              {cmd.description && (
                <span className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">{cmd.description}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Feedback toast */}
      {feedback && (
        <div className="absolute bottom-full left-3 right-3 mb-2 flex justify-center">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white shadow-md">
            {feedback}
          </span>
        </div>
      )}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)]"
            >
              <span className="max-w-[120px] truncate">{att.name}</span>
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
              >
                <X size="0.625rem" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div
        ref={inputBarRef}
        className="relative flex items-center gap-1.5 rounded-2xl border-2 px-2.5 py-2.5 transition-all duration-200 sm:gap-2 sm:px-4 bg-black/40 border-white/25"
      >
        {/* Attach button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/10 hover:text-white/70 active:scale-90"
          title="Attach file"
        >
          <Plus size="1rem" />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          placeholder={characterNames.length > 0 ? `Message @${characterNames[0]}` : "Message..."}
          rows={1}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="max-h-[12.5rem] min-w-0 flex-1 resize-none bg-transparent py-0 text-[1rem] leading-normal text-white/90 outline-none placeholder:text-white/30"
        />

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          <div className="relative">
            <button
              ref={gifButtonRef}
              onClick={() => {
                setGifOpen((v) => !v);
                setEmojiOpen(false);
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                gifOpen ? "text-white bg-white/10" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
              title="GIF"
            >
              <ImagePlay size="1.25rem" />
            </button>
            <GifPicker
              open={gifOpen}
              onClose={() => setGifOpen(false)}
              onSelect={handleGifSelect}
              anchorRef={gifButtonRef}
              containerRef={inputBarRef}
            />
          </div>

          <div className="relative hidden sm:block">
            <button
              ref={emojiButtonRef}
              onClick={() => {
                setEmojiOpen((v) => !v);
                setGifOpen(false);
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                emojiOpen ? "text-white bg-white/10" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
              title="Emoji"
            >
              <Smile size="1.25rem" />
            </button>
            <EmojiPicker
              open={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              onSelect={handleEmojiSelect}
              anchorRef={emojiButtonRef}
              containerRef={inputBarRef}
            />
          </div>

          <button
            onClick={isActuallyGenerating ? () => useChatStore.getState().stopGeneration() : handleSend}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
              isActuallyGenerating
                ? "text-white hover:opacity-80"
                : hasInput || attachments.length > 0
                  ? "text-white hover:text-white/80 active:scale-90"
                  : "text-white/20",
            )}
            title={isActuallyGenerating ? "Stop generating" : "Send"}
          >
            {isActuallyGenerating ? <StopCircle size="1rem" /> : <Send size="0.9375rem" />}
          </button>
        </div>
      </div>
    </div>
  );
}

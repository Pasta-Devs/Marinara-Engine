// ──────────────────────────────────────────────
// React Query: Generation (streaming + agent pipeline)
// ──────────────────────────────────────────────
import { useCallback, useRef } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../lib/api-client";

/** Show a persistent, copyable error toast and log to console */
function showError(msg: string) {
  console.error("[Generation]", msg);
  toast.error(msg, { duration: 15000 });
}
import { useChatStore } from "../stores/chat.store";
import { useAgentStore } from "../stores/agent.store";
import { useGameStateStore } from "../stores/game-state.store";
import { useUIStore } from "../stores/ui.store";
import { chatKeys } from "./use-chats";
import { characterKeys } from "./use-characters";
import { playNotificationPing } from "../lib/notification-sound";
import type { Message } from "@marinara-engine/shared";

/**
 * Hook that handles streaming generation.
 * Returns a function to trigger generation which streams tokens
 * into the chat store, dispatches agent results to the agent store,
 * and invalidates messages on completion.
 */
export function useGenerate() {
  const qc = useQueryClient();
  const generatingRef = useRef(false);
  // Use individual selectors to avoid re-rendering on every store change
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setStreamBuffer = useChatStore((s) => s.setStreamBuffer);
  const clearStreamBuffer = useChatStore((s) => s.clearStreamBuffer);
  const setRegenerateMessageId = useChatStore((s) => s.setRegenerateMessageId);
  const setStreamingCharacterId = useChatStore((s) => s.setStreamingCharacterId);
  const setTypingCharacterName = useChatStore((s) => s.setTypingCharacterName);
  const setDelayedCharacterInfo = useChatStore((s) => s.setDelayedCharacterInfo);
  const setProcessing = useAgentStore((s) => s.setProcessing);
  const addResult = useAgentStore((s) => s.addResult);
  const addThoughtBubble = useAgentStore((s) => s.addThoughtBubble);
  const clearThoughtBubbles = useAgentStore((s) => s.clearThoughtBubbles);
  const addEchoMessage = useAgentStore((s) => s.addEchoMessage);
  const clearEchoMessages = useAgentStore((s) => s.clearEchoMessages);
  const setFailedAgentTypes = useAgentStore((s) => s.setFailedAgentTypes);
  const clearFailedAgentTypes = useAgentStore((s) => s.clearFailedAgentTypes);
  const addDebugEntry = useAgentStore((s) => s.addDebugEntry);
  const clearDebugLog = useAgentStore((s) => s.clearDebugLog);
  const setGameState = useGameStateStore((s) => s.setGameState);

  const generate = useCallback(
    async (params: {
      chatId: string;
      connectionId: string | null;
      presetId?: string;
      lorebookIds?: string[];
      userMessage?: string;
      regenerateMessageId?: string;
      impersonate?: boolean;
      attachments?: Array<{ type: string; data: string }>;
    }) => {
      // Prevent concurrent generations — if one is already in progress for
      // the SAME chat, skip. This stops race conditions where autonomous
      // messaging + user input both fire generate at once.
      if (generatingRef.current) {
        console.warn("[Generate] Skipped — generation already in progress");
        return false;
      }
      generatingRef.current = true;

      // Abort any in-progress generation before starting a new one.
      // This prevents corrupted state when the user sends in Chat B
      // while Chat A is still streaming (singleton streaming state).
      const prev = useChatStore.getState().abortController;
      if (prev) prev.abort();

      // Create an AbortController so the stop button can cancel this generation
      const abortController = new AbortController();
      useChatStore.getState().setAbortController(abortController);

      setStreaming(true, params.chatId);
      clearStreamBuffer();
      clearThoughtBubbles();
      clearEchoMessages();
      clearFailedAgentTypes();
      clearDebugLog();
      setRegenerateMessageId(params.regenerateMessageId ?? null);
      console.warn("[Generate] Starting generation for chat:", params.chatId);

      // Optimistically show the user message in the chat immediately
      if (params.userMessage && !params.impersonate) {
        const optimisticMsg: Message = {
          id: `__optimistic_${Date.now()}`,
          chatId: params.chatId,
          role: "user",
          characterId: null,
          content: params.userMessage,
          activeSwipeIndex: 0,
          extra: { displayText: null, isGenerated: false, tokenCount: null, generationInfo: null },
          createdAt: new Date().toISOString(),
        };
        qc.setQueryData<InfiniteData<Message[]>>(chatKeys.messages(params.chatId), (old) => {
          if (!old) return old;
          const pages = [...old.pages];
          // First page holds newest messages — append to it
          pages[0] = [...(pages[0] ?? []), optimisticMsg];
          return { ...old, pages };
        });
      }

      // ── SillyTavern-style smooth streaming ──
      // Tokens arrive in bursts from the server. Instead of dumping them
      // immediately, we feed them character-by-character from a queue
      // at a controlled rate so the text "types out" smoothly.
      // Speed is controlled by the user's streamingSpeed setting (1–100).
      // Conversation mode: always disable streaming — messages appear complete.
      const isConversationMode = useChatStore.getState().activeChat?.mode === "conversation";
      const streamingEnabled = isConversationMode ? false : useUIStore.getState().enableStreaming;
      const speed = useUIStore.getState().streamingSpeed; // 1 (very slow) – 100 (instant)
      let fullBuffer = ""; // What the user sees (or accumulates silently when streaming is off)
      let pendingText = ""; // Tokens waiting to be typed out
      let receivedContent = false; // Whether any actual message content was received
      let typingActive = false;
      let typewriterDone: (() => void) | null = null;
      let rafId = 0;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      // Derive typewriter parameters from speed (1–100)
      // speed 1  → 1 char every 80ms  (very slow, easy to read)
      // speed 50 → ~2 chars every 16ms (moderate, default)
      // speed 100 → flush instantly (no typewriter)
      const charsPerTick = speed >= 100 ? Infinity : Math.max(1, Math.round(speed / 20));
      // Delay between ticks in ms (0 = use rAF at ~60fps, >0 = use setTimeout)
      const tickDelay = speed >= 80 ? 0 : Math.round(80 - speed);

      // Adaptive catch-up: when the queue gets very long, temporarily increase
      // chars-per-tick to prevent the typewriter lagging far behind real completion.
      const CATCHUP_THRESHOLD = 300;
      const CATCHUP_MULTIPLIER = 4;

      const flushTypewriterBuffer = () => {
        cancelAnimationFrame(rafId);
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        fullBuffer += pendingText;
        pendingText = "";
        typingActive = false;
        if (fullBuffer) setStreamBuffer(fullBuffer);
      };

      const startTypewriter = () => {
        if (typingActive) return;
        typingActive = true;
        const tick = () => {
          if (pendingText.length === 0) {
            typingActive = false;
            if (typewriterDone) {
              typewriterDone();
              typewriterDone = null;
            }
            return;
          }
          // Catch-up: if the pending queue is very long, increase speed to avoid
          // the typewriter still running long after the model finished.
          const effective = pendingText.length > CATCHUP_THRESHOLD ? charsPerTick * CATCHUP_MULTIPLIER : charsPerTick;
          const n = Math.min(effective, pendingText.length);
          const batch = pendingText.slice(0, n);
          pendingText = pendingText.slice(n);
          fullBuffer += batch;
          setStreamBuffer(fullBuffer);
          if (tickDelay > 0) {
            timeoutId = setTimeout(tick, tickDelay);
          } else {
            rafId = requestAnimationFrame(tick);
          }
        };
        if (tickDelay > 0) {
          timeoutId = setTimeout(tick, tickDelay);
        } else {
          rafId = requestAnimationFrame(tick);
        }
      };

      try {
        const debugMode = useUIStore.getState().debugMode;
        const userStatus = useUIStore.getState().userStatus;

        // Flush any pending game-state widget edits so the server sees them before committing
        const flushPatch = useGameStateStore.getState().flushPatch;
        if (flushPatch) await flushPatch();

        for await (const event of api.streamEvents(
          "/generate",
          { ...params, debugMode, userStatus },
          abortController.signal,
        )) {
          switch (event.type) {
            case "token": {
              receivedContent = true;
              setTypingCharacterName(null); // Clear typing indicator once response starts
              setDelayedCharacterInfo(null); // Clear delayed indicator too
              if (streamingEnabled) {
                pendingText += event.data as string;
                startTypewriter();
              } else {
                // Accumulate silently — don't update the UI until done
                fullBuffer += event.data as string;
              }
              break;
            }

            case "agent_start": {
              setProcessing(true);
              break;
            }

            case "agent_debug": {
              const debug = event.data as {
                phase: string;
                agents?: Array<{ type: string; name: string; model: string; maxTokens: number }>;
                batchMaxTokens?: number;
                results?: Array<{
                  agentType: string;
                  success: boolean;
                  error: string | null;
                  durationMs: number;
                  tokensUsed: number;
                  resultType: string;
                }>;
              };
              addDebugEntry({ timestamp: Date.now(), ...debug });

              // Log to browser console (matches debug_prompt / debug_usage style)
              if (debug.agents) {
                const agentList = debug.agents.map((a) => `${a.name} (${a.model}, ${a.maxTokens}t)`).join(", ");
                console.log(
                  `%c[Debug] Agent ${debug.phase}: ${debug.agents.length} agent(s)` +
                    (debug.batchMaxTokens ? ` · batch max ${debug.batchMaxTokens.toLocaleString()}t` : ""),
                  "color: #f59e0b; font-weight: bold",
                );
                console.log(`  ${agentList}`);
              }
              if (debug.results) {
                const ok = debug.results.filter((r) => r.success).length;
                const fail = debug.results.length - ok;
                console.groupCollapsed(
                  `%c[Debug] Agent results: ${ok} succeeded, ${fail} failed`,
                  fail > 0 ? "color: #f87171; font-weight: bold" : "color: #34d399; font-weight: bold",
                );
                for (const r of debug.results) {
                  console.log(
                    `  ${r.success ? "✓" : "✗"} ${r.agentType} — ${(r.durationMs / 1000).toFixed(1)}s, ${r.tokensUsed}t` +
                      (r.error ? ` — ${r.error}` : ""),
                  );
                }
                console.groupEnd();
              }
              break;
            }

            case "agent_result": {
              const result = event.data as {
                agentType: string;
                agentName: string;
                resultType: string;
                data: unknown;
                success: boolean;
                error: string | null;
                durationMs: number;
              };

              // Store the result
              addResult(result.agentType, {
                agentId: result.agentType,
                agentType: result.agentType,
                type: result.resultType as any,
                data: result.data,
                tokensUsed: 0,
                durationMs: result.durationMs,
                success: result.success,
                error: result.error,
              });

              // Always log agent results to console for visibility (use warn so it shows even if Info is filtered)
              if (result.success) {
                console.warn(
                  `[Agent] ✓ ${result.agentName} (${result.agentType}) — ${(result.durationMs / 1000).toFixed(1)}s`,
                  result.data,
                );
              } else {
                console.warn(
                  `[Agent] ✗ ${result.agentName} (${result.agentType}) — ${result.error ?? "unknown error"}`,
                  result.data,
                );
              }

              // Display as thought bubble for informational agents
              if (result.success && result.data) {
                const bubble = formatAgentBubble(result.agentType, result.agentName, result.data);
                if (bubble) {
                  addThoughtBubble(result.agentType, result.agentName, bubble);
                }

                // Push echo-chamber reactions to the dedicated echo store
                if (result.agentType === "echo-chamber") {
                  const d = result.data as Record<string, unknown>;
                  const reactions = (d.reactions as Array<{ characterName: string; reaction: string }>) ?? [];
                  for (const r of reactions) {
                    addEchoMessage(r.characterName, r.reaction);
                  }
                }
              }

              // Apply background change — validate filename exists before applying
              if (result.success && result.resultType === "background_change" && result.data) {
                const bg = result.data as { chosen?: string | null; reason?: string };
                if (bg.chosen) {
                  // Validate background exists before setting it (prevents 404s from hallucinated filenames)
                  fetch(`/api/backgrounds/file/${encodeURIComponent(bg.chosen)}`, { method: "HEAD" })
                    .then((res) => {
                      if (res.ok) {
                        useUIStore
                          .getState()
                          .setChatBackground(`/api/backgrounds/file/${encodeURIComponent(bg.chosen!)}`);
                      } else {
                        console.warn(`[Agent] Background "${bg.chosen}" does not exist — skipping`);
                      }
                    })
                    .catch(() => {});
                }
              }

              // Apply quest updates directly so the widget updates immediately
              if (result.success && result.agentType === "quest" && result.data) {
                const qd = result.data as Record<string, unknown>;
                const updates = (qd.updates as any[]) ?? [];
                console.warn(`[Agent] Quest data:`, qd);
                console.warn(`[Agent] Quest updates: ${updates.length} update(s)`, updates);
                if (updates.length > 0) {
                  const cur = useGameStateStore.getState().current;
                  console.warn(`[Agent] Quest merge — current gameState:`, cur);
                  const existing = cur?.playerStats ?? {
                    stats: [],
                    attributes: null,
                    skills: {},
                    inventory: [],
                    activeQuests: [],
                    status: "",
                  };
                  const quests: any[] = [...(existing.activeQuests ?? [])];
                  for (const u of updates) {
                    const idx = quests.findIndex((q: any) => q.name === u.questName);
                    if (u.action === "create" && idx === -1) {
                      quests.push({
                        questEntryId: u.questName,
                        name: u.questName,
                        currentStage: 0,
                        objectives: u.objectives ?? [],
                        completed: false,
                      });
                    } else if (idx !== -1) {
                      if (u.action === "update" && u.objectives) quests[idx].objectives = u.objectives;
                      else if (u.action === "complete") {
                        quests[idx].completed = true;
                        if (u.objectives) quests[idx].objectives = u.objectives;
                      } else if (u.action === "fail") quests.splice(idx, 1);
                    }
                  }
                  const merged = cur
                    ? { ...cur, playerStats: { ...existing, activeQuests: quests } }
                    : { playerStats: { ...existing, activeQuests: quests } };
                  console.warn(`[Agent] Quest merge result — activeQuests:`, quests);
                  setGameState(merged as any);
                } else {
                  console.warn(`[Agent] Quest agent returned success but 0 updates — data shape:`, Object.keys(qd));
                }
              }
              break;
            }

            case "tool_result": {
              // Already handled by existing tool display — pass through
              break;
            }

            case "debug_prompt": {
              const payload = event.data as { messages?: unknown[]; parameters?: Record<string, unknown> } | unknown[];
              // Handle both old (messages array) and new (object with messages + parameters) formats
              const messages = Array.isArray(payload) ? payload : payload.messages;
              const params = Array.isArray(payload) ? null : payload.parameters;
              console.groupCollapsed(
                "%c[Debug] Prompt sent to model" + (params ? ` — ${params.model} (${params.provider})` : ""),
                "color: #f59e0b; font-weight: bold",
              );
              if (params) {
                console.log("%cParameters", "color: #60a5fa; font-weight: bold", params);
              }
              console.log(
                "%cMessages (%d)",
                "color: #60a5fa; font-weight: bold",
                Array.isArray(messages) ? messages.length : "?",
                messages,
              );
              console.groupEnd();
              break;
            }

            case "debug_usage": {
              const usage = event.data as {
                tokensPrompt: number | null;
                tokensCompletion: number | null;
                tokensTotal: number | null;
                durationMs: number | null;
                finishReason: string | null;
              };
              const parts: string[] = [];
              if (usage.tokensPrompt != null) parts.push(`prompt: ${usage.tokensPrompt.toLocaleString()}`);
              if (usage.tokensCompletion != null) parts.push(`completion: ${usage.tokensCompletion.toLocaleString()}`);
              if (usage.tokensTotal != null) parts.push(`total: ${usage.tokensTotal.toLocaleString()}`);
              if (usage.durationMs != null) parts.push(`${(usage.durationMs / 1000).toFixed(1)}s`);
              if (usage.finishReason) parts.push(`finish: ${usage.finishReason}`);
              const tokenInfo = parts.length > 0 ? parts.join(" · ") : "no usage data";
              console.log("%c[Debug] Token usage — %s", "color: #34d399; font-weight: bold", tokenInfo);
              break;
            }

            case "thinking": {
              // Thinking chunks are streamed from the server but persisted in message extra
              // — the UI picks them up after query invalidation on "done". Nothing to buffer here.
              break;
            }

            case "group_turn": {
              const turn = event.data as { characterId: string; characterName: string; index: number };

              // If this isn't the first character, flush the previous one's content
              if (turn.index > 0) {
                // Drain typewriter for the previous character (only if streaming)
                if (streamingEnabled && (pendingText.length > 0 || typingActive)) {
                  await new Promise<void>((resolve) => {
                    if (pendingText.length === 0 && !typingActive) {
                      resolve();
                      return;
                    }
                    typewriterDone = resolve;
                    startTypewriter();
                  });
                }
                // Pick up the just-saved message from the previous character
                await qc.invalidateQueries({ queryKey: chatKeys.messages(params.chatId) });
                // Increment unread if user navigated away during group generation
                const activeNow = useChatStore.getState().activeChatId;
                if (activeNow !== params.chatId) {
                  useChatStore.getState().incrementUnread(params.chatId);
                  if (useUIStore.getState().convoNotificationSound) {
                    playNotificationPing();
                  }
                }
                // Reset the stream buffer for the new character
                fullBuffer = "";
                pendingText = "";
                setStreamBuffer("");
              }

              setStreamingCharacterId(turn.characterId);
              break;
            }

            case "game_state":
            case "game_state_patch": {
              const patch = event.data as Record<string, unknown>;
              console.warn(`[Generate] ${event.type} received:`, patch);
              const current = useGameStateStore.getState().current;
              if (current) {
                const merged = { ...current, ...patch };
                // Deep-merge playerStats so partial updates don't clobber sibling fields
                if (patch.playerStats && typeof patch.playerStats === "object" && current.playerStats) {
                  const mergedPS = { ...current.playerStats, ...(patch.playerStats as object) };
                  // Don't let an empty activeQuests overwrite existing quests
                  const patchPS = patch.playerStats as Record<string, unknown>;
                  if (
                    Array.isArray(patchPS.activeQuests) &&
                    patchPS.activeQuests.length === 0 &&
                    current.playerStats.activeQuests?.length > 0
                  ) {
                    mergedPS.activeQuests = current.playerStats.activeQuests;
                  }
                  (merged as any).playerStats = mergedPS;
                }
                setGameState(merged as any);
              } else {
                // Agent data may arrive before the base game state is loaded —
                // seed a minimal state so data isn't lost.
                setGameState(patch as any);
              }
              break;
            }

            case "chat_summary": {
              // Refresh the chat detail so the summary popover picks up the new value
              const chatId = useChatStore.getState().activeChatId;
              if (chatId) qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
              break;
            }

            case "text_rewrite": {
              // Consistency Editor replaced the message — update displayed text
              const rw = event.data as { editedText?: string; changes?: Array<{ description: string }> };
              if (rw.editedText) {
                if (streamingEnabled) {
                  // Drain any pending typewriter first
                  if (pendingText.length > 0 || typingActive) {
                    cancelAnimationFrame(rafId);
                    if (timeoutId !== undefined) {
                      clearTimeout(timeoutId);
                      timeoutId = undefined;
                    }
                    pendingText = "";
                    typingActive = false;
                  }
                  setStreamBuffer(rw.editedText);
                }
                fullBuffer = rw.editedText;
              }
              break;
            }

            case "content_replace": {
              // Server stripped character commands — replace the displayed content
              const cleanContent = event.data as string;
              if (streamingEnabled) {
                cancelAnimationFrame(rafId);
                if (timeoutId !== undefined) {
                  clearTimeout(timeoutId);
                  timeoutId = undefined;
                }
                pendingText = "";
                typingActive = false;
                setStreamBuffer(cleanContent);
              }
              fullBuffer = cleanContent;
              break;
            }

            case "schedule_updated": {
              const schedData = event.data as { characterId: string; status?: string; activity?: string };
              const charName = schedData.activity || schedData.status || "schedule";
              console.log(`[commands] Schedule updated for ${schedData.characterId}: ${charName}`);
              break;
            }

            case "cross_post": {
              const cpData = event.data as { targetChatId: string; targetChatName: string; characterId: string };
              toast(`Message also sent to ${cpData.targetChatName}`, { icon: "↗️" });
              // Invalidate the target chat's messages so they refresh
              qc.invalidateQueries({ queryKey: ["chats", "messages", cpData.targetChatId] });
              break;
            }

            case "selfie": {
              setTypingCharacterName(null);
              const selfieData = event.data as {
                characterId: string;
                characterName: string;
                messageId: string;
                imageUrl: string;
              };
              toast(`${selfieData.characterName} sent a selfie 📸`);
              // Invalidate current chat messages to show the attachment
              qc.invalidateQueries({ queryKey: ["chats", "messages", params.chatId] });
              break;
            }

            case "selfie_error": {
              setTypingCharacterName(null);
              const errData = event.data as { characterId: string; error: string };
              console.warn("[selfie] Generation failed:", errData.error);
              toast.error(`Selfie generation failed: ${errData.error}`);
              break;
            }

            case "scene_created": {
              const sceneData = event.data as {
                sceneChatId: string;
                sceneChatName: string;
                description: string;
                background?: string | null;
                initiatorCharId: string;
                initiatorCharName: string;
              };
              toast(`${sceneData.initiatorCharName} started a scene: ${sceneData.sceneChatName}`, { icon: "🎬" });
              // Invalidate chat list so the new scene chat appears
              qc.invalidateQueries({ queryKey: ["chats"] });
              // Apply background if the scene chose one
              if (sceneData.background) {
                useUIStore
                  .getState()
                  .setChatBackground(`/api/backgrounds/file/${encodeURIComponent(sceneData.background)}`);
              }
              break;
            }

            case "assistant_action": {
              const actionData = event.data as { action: string; [key: string]: unknown };
              if (actionData.action === "persona_created") {
                toast(`Created persona: ${actionData.name}`, { icon: "🎭" });
                qc.invalidateQueries({ queryKey: ["personas"] });
              } else if (actionData.action === "character_created") {
                toast(`Created character: ${actionData.name}`, { icon: "✨" });
                qc.invalidateQueries({ queryKey: characterKeys.list() });
              } else if (actionData.action === "chat_created") {
                toast(`Started ${actionData.mode} chat with ${actionData.characterName}`, { icon: "💬" });
                qc.invalidateQueries({ queryKey: ["chats"] });
              } else if (actionData.action === "navigate") {
                const panel = actionData.panel as string;
                const tab = actionData.tab as string | null;
                useUIStore.getState().openRightPanel(panel as any);
                if (panel === "settings" && tab) {
                  useUIStore.getState().setSettingsTab(tab as any);
                }
              }
              break;
            }

            case "done": {
              setProcessing(false);
              break;
            }

            case "typing": {
              // Generation is about to start — show "X is typing..."
              const typingNames = (event as any).characters as string[] | undefined;
              const typingLabel = typingNames?.length === 1 ? typingNames[0] : (typingNames?.join(", ") ?? "Character");
              setTypingCharacterName(typingLabel);
              break;
            }

            case "delayed": {
              // Character is busy (DND/idle) — show waiting indicator
              const delayedNames = (event as any).characters as string[] | undefined;
              const delayedLabel =
                delayedNames?.length === 1 ? delayedNames[0] : (delayedNames?.join(", ") ?? "Character");
              const delayedStatus = ((event as any).status as string) ?? "idle";
              setDelayedCharacterInfo({ name: delayedLabel, status: delayedStatus });
              // Refresh character data so sidebar status dots update immediately
              qc.invalidateQueries({ queryKey: characterKeys.list() });
              break;
            }

            case "offline": {
              // Character is offline — message was saved but no generation
              const names = (event as any).characters as string[] | undefined;
              const label = names?.length === 1 ? names[0] : "Characters";
              toast(`${label} is offline. They'll respond when they're back online.`, { icon: "💤" });
              setProcessing(false);
              break;
            }

            case "ooc_posted": {
              // OOC messages were posted to the connected conversation — invalidate its messages
              const oocData = event.data as { chatId: string; count: number };
              if (oocData.chatId) {
                qc.invalidateQueries({ queryKey: chatKeys.messages(oocData.chatId) });
              }
              break;
            }

            case "error": {
              // Flush pending text so the user sees what arrived before the error
              flushTypewriterBuffer();
              setProcessing(false);
              showError((event.data as string) || "Generation failed");
              break;
            }

            case "agents_retry_failed": {
              const failedList = event.data as Array<{ agentType: string; error: string | null }>;
              const types = failedList.map((f) => f.agentType);
              setFailedAgentTypes(types);
              showError(
                `${types.length} agent${types.length > 1 ? "s" : ""} failed after retry. Use the retry button in the chat header to try again.`,
              );
              break;
            }
          }
        }

        // Wait for typewriter to finish draining pending text (streaming mode only)
        if (streamingEnabled && (pendingText.length > 0 || typingActive)) {
          await new Promise<void>((resolve) => {
            if (pendingText.length === 0 && !typingActive) {
              resolve();
              return;
            }
            typewriterDone = resolve;
            startTypewriter();
          });
        }
        // Final flush — ensure full content is set
        setStreamBuffer(fullBuffer + pendingText);
      } catch (error) {
        // Flush everything instantly on error so user sees what arrived
        flushTypewriterBuffer();
        // Abort is intentional — don't log or toast
        if (error instanceof DOMException && error.name === "AbortError") return receivedContent;
        const msg = error instanceof Error ? error.message : "Generation failed";
        showError(msg);
      } finally {
        // Cancel any pending animation frame / timeout to prevent leaks
        cancelAnimationFrame(rafId);
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        // Invalidate messages to pick up saved messages / new swipes from backend
        await qc.invalidateQueries({
          queryKey: chatKeys.messages(params.chatId),
        });
        // Re-sort sidebar so this chat floats to the top
        qc.invalidateQueries({ queryKey: chatKeys.list() });
        // If the user navigated away from this chat during generation,
        // increment unread badge + play notification sound so they know.
        // Only notify if actual content was produced (skip offline/error cases).
        const currentActive = useChatStore.getState().activeChatId;
        if (receivedContent && currentActive !== params.chatId) {
          useChatStore.getState().incrementUnread(params.chatId);
          if (useUIStore.getState().convoNotificationSound) {
            playNotificationPing();
          }
        }
        // Only clean up global streaming state if this generation still
        // "owns" it. If another generation started (different chatId),
        // that generation now owns the state — don't clobber it.
        const stillOwner = useChatStore.getState().streamingChatId === params.chatId;
        if (stillOwner) {
          // Wait one frame so React renders the fetched messages before
          // removing the streaming overlay — prevents a visible flash.
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          setStreaming(false);
          setProcessing(false);
          clearStreamBuffer();
          setRegenerateMessageId(null);
          setStreamingCharacterId(null);
          setTypingCharacterName(null);
          setDelayedCharacterInfo(null);
          useChatStore.getState().setAbortController(null);
        }
        generatingRef.current = false;
      }
      return receivedContent;
    },
    [
      qc,
      setStreaming,
      setStreamBuffer,
      clearStreamBuffer,
      setRegenerateMessageId,
      setStreamingCharacterId,
      setTypingCharacterName,
      setDelayedCharacterInfo,
      setProcessing,
      addResult,
      addThoughtBubble,
      clearThoughtBubbles,
      addEchoMessage,
      clearEchoMessages,
      clearFailedAgentTypes,
      setFailedAgentTypes,
      addDebugEntry,
      clearDebugLog,
      setGameState,
    ],
  );

  const retryAgents = useCallback(
    async (chatId: string, agentTypes: string[]) => {
      const abortController = new AbortController();
      useChatStore.getState().setAbortController(abortController);
      setProcessing(true);
      clearFailedAgentTypes();
      clearThoughtBubbles();
      clearEchoMessages();
      clearDebugLog();

      try {
        let hasError = false;
        for await (const event of api.streamEvents(
          "/generate/retry-agents",
          { chatId, agentTypes },
          abortController.signal,
        )) {
          switch (event.type) {
            case "agent_result": {
              const result = event.data as {
                agentType: string;
                agentName: string;
                resultType: string;
                data: unknown;
                success: boolean;
                error: string | null;
                durationMs: number;
              };

              // Log agent results (same as main generate handler)
              if (result.success) {
                console.warn(
                  `[Retry Agent] ✓ ${result.agentName} (${result.agentType}) — ${(result.durationMs / 1000).toFixed(1)}s`,
                  result.data,
                );
              } else {
                console.warn(
                  `[Retry Agent] ✗ ${result.agentName} (${result.agentType}) — ${result.error ?? "unknown error"}`,
                  result.data,
                );
              }

              addResult(result.agentType, {
                agentId: result.agentType,
                agentType: result.agentType,
                type: result.resultType as any,
                data: result.data,
                tokensUsed: 0,
                durationMs: result.durationMs,
                success: result.success,
                error: result.error,
              });
              if (result.success && result.data) {
                const bubble = formatAgentBubble(result.agentType, result.agentName, result.data);
                if (bubble) addThoughtBubble(result.agentType, result.agentName, bubble);
                if (result.agentType === "echo-chamber") {
                  const d = result.data as Record<string, unknown>;
                  const reactions = (d.reactions as Array<{ characterName: string; reaction: string }>) ?? [];
                  for (const r of reactions) addEchoMessage(r.characterName, r.reaction);
                }
                if (result.resultType === "background_change") {
                  const bg = result.data as { chosen?: string | null };
                  if (bg.chosen) {
                    fetch(`/api/backgrounds/file/${encodeURIComponent(bg.chosen)}`, { method: "HEAD" })
                      .then((res) => {
                        if (res.ok) {
                          useUIStore
                            .getState()
                            .setChatBackground(`/api/backgrounds/file/${encodeURIComponent(bg.chosen!)}`);
                        } else {
                          console.warn(`[Agent] Background "${bg.chosen}" does not exist — skipping`);
                        }
                      })
                      .catch(() => {});
                  }
                }
                // Apply quest updates directly so the widget updates immediately
                if (result.agentType === "quest") {
                  const qd = result.data as Record<string, unknown>;
                  const updates = (qd.updates as any[]) ?? [];
                  if (updates.length > 0) {
                    const cur = useGameStateStore.getState().current;
                    const existing = cur?.playerStats ?? {
                      stats: [],
                      attributes: null,
                      skills: {},
                      inventory: [],
                      activeQuests: [],
                      status: "",
                    };
                    const quests: any[] = [...(existing.activeQuests ?? [])];
                    for (const u of updates) {
                      const idx = quests.findIndex((q: any) => q.name === u.questName);
                      if (u.action === "create" && idx === -1) {
                        quests.push({
                          questEntryId: u.questName,
                          name: u.questName,
                          currentStage: 0,
                          objectives: u.objectives ?? [],
                          completed: false,
                        });
                      } else if (idx !== -1) {
                        if (u.action === "update" && u.objectives) quests[idx].objectives = u.objectives;
                        else if (u.action === "complete") {
                          quests[idx].completed = true;
                          if (u.objectives) quests[idx].objectives = u.objectives;
                        } else if (u.action === "fail") quests.splice(idx, 1);
                      }
                    }
                    const merged = cur
                      ? { ...cur, playerStats: { ...existing, activeQuests: quests } }
                      : { playerStats: { ...existing, activeQuests: quests } };
                    setGameState(merged as any);
                  }
                }
              }
              if (!result.success && result.error) {
                showError(`${result.agentName ?? result.agentType} failed: ${result.error}`);
              }
              break;
            }
            case "agents_retry_failed": {
              const failedList = event.data as Array<{ agentType: string; error: string | null }>;
              const types = failedList.map((f) => f.agentType);
              setFailedAgentTypes(types);
              showError(
                `${types.length} agent${types.length > 1 ? "s" : ""} failed after retry. Use the retry button in the chat header to try again.`,
              );
              break;
            }
            case "game_state":
            case "game_state_patch": {
              const patch = event.data as Record<string, unknown>;
              console.warn(`[Retry] ${event.type} received:`, patch);
              const current = useGameStateStore.getState().current;
              if (current) {
                const merged = { ...current, ...patch };
                if (patch.playerStats && typeof patch.playerStats === "object" && current.playerStats) {
                  const mergedPS = { ...current.playerStats, ...(patch.playerStats as object) };
                  // Don't let an empty activeQuests overwrite existing quests
                  const patchPS = patch.playerStats as Record<string, unknown>;
                  if (
                    Array.isArray(patchPS.activeQuests) &&
                    patchPS.activeQuests.length === 0 &&
                    current.playerStats.activeQuests?.length > 0
                  ) {
                    mergedPS.activeQuests = current.playerStats.activeQuests;
                  }
                  (merged as any).playerStats = mergedPS;
                }
                setGameState(merged as any);
              } else {
                setGameState(patch as any);
              }
              break;
            }
            case "error": {
              hasError = true;
              showError((event.data as string) || "Agent retry failed");
              break;
            }
            case "done": {
              break;
            }
          }
        }
        if (!hasError) toast.success("Agent retry completed");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const msg =
          error instanceof Error
            ? (error as { cause?: unknown }).cause instanceof Error
              ? `${error.message}: ${(error as { cause?: Error }).cause!.message}`
              : error.message
            : "Agent retry failed";
        showError(msg);
      } finally {
        setProcessing(false);
        useChatStore.getState().setAbortController(null);
      }
    },
    [
      addResult,
      addThoughtBubble,
      addEchoMessage,
      clearFailedAgentTypes,
      clearDebugLog,
      clearEchoMessages,
      clearThoughtBubbles,
      setFailedAgentTypes,
      setProcessing,
      setGameState,
    ],
  );

  return { generate, retryAgents };
}

/**
 * Format agent result data into a human-readable thought bubble string.
 * Returns null if the result shouldn't generate a bubble.
 */
function formatAgentBubble(agentType: string, agentName: string, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  switch (agentType) {
    case "continuity": {
      const issues = (d.issues as any[]) ?? [];
      if (!issues.length) return null;
      return issues.map((i: any) => `${i.severity === "error" ? "🔴" : "🟡"} ${i.description}`).join("\n");
    }

    case "prompt-reviewer": {
      const issues = (d.issues as any[]) ?? [];
      if (!issues.length) return `✅ ${d.summary ?? "Prompt looks good"}`;
      return issues
        .map((i: any) => `${i.severity === "error" ? "🔴" : i.severity === "warning" ? "🟡" : "💡"} ${i.description}`)
        .join("\n");
    }

    case "director": {
      const text = d.text as string;
      if (!text || text.includes("No intervention needed")) return null;
      return text;
    }

    case "quest": {
      const updates = (d.updates as any[]) ?? [];
      if (!updates.length) return null;
      return updates.map((u: any) => `${u.action === "complete" ? "✅" : "📜"} ${u.questName}`).join("\n");
    }

    case "expression": {
      const expressions = (d.expressions as any[]) ?? [];
      if (!expressions.length) return null;
      return expressions
        .map((e: any) => {
          const t = e.transition && e.transition !== "crossfade" ? ` (${e.transition})` : "";
          return `🎭 ${e.characterName}: ${e.expression}${t}`;
        })
        .join("\n");
    }

    case "world-state": {
      // Compact summary of what changed
      const parts: string[] = [];
      if (d.location) parts.push(`📍 ${d.location}`);
      if (d.time) parts.push(`🕐 ${d.time}`);
      if (d.weather) parts.push(`🌤 ${d.weather}`);
      if (parts.length === 0) return null;
      return parts.join(" · ");
    }

    case "character-tracker": {
      const chars = (d.presentCharacters as any[]) ?? [];
      if (!chars.length) return null;
      return chars
        .map((c: any) => {
          const emoji = c.emoji ? `${c.emoji} ` : "👤 ";
          return `${emoji}${c.name}`;
        })
        .join(", ");
    }

    case "background": {
      const reason = d.reason as string;
      const chosen = d.chosen as string | null;
      if (!chosen) return null;
      return `🖼️ ${reason || "Background changed"}`;
    }

    case "echo-chamber": {
      const reactions = (d.reactions as any[]) ?? [];
      if (!reactions.length) return null;
      return reactions.map((r: any) => `💬 ${r.characterName}: ${r.reaction}`).join("\n");
    }

    case "spotify": {
      const action = d.action as string;
      if (action === "none") return null;
      const reason = (d.reason as string) ?? "";
      if (action === "play") {
        // Support both array and singular formats
        const trackNames: string[] = Array.isArray(d.trackNames)
          ? (d.trackNames as string[])
          : d.trackName
            ? [d.trackName as string]
            : [];
        if (trackNames.length === 0) return reason ? `🎵 ${reason}` : null;
        if (trackNames.length === 1) {
          return `🎵 ${trackNames[0]}${reason ? ` — ${reason}` : ""}`;
        }
        const list = trackNames.map((t, i) => `${i + 1}. ${t}`).join("\n");
        return `🎵 Queued ${trackNames.length} tracks${reason ? ` — ${reason}` : ""}\n${list}`;
      }
      if (action === "volume") {
        return `🔊 Volume → ${d.volume}%${reason ? ` (${reason})` : ""}`;
      }
      return reason ? `🎵 ${reason}` : null;
    }

    case "prose-guardian": {
      const text = d.text as string;
      if (!text) return null;
      // Show a compact summary — first ~120 chars
      const trimmed = text.trim();
      const preview = trimmed.length > 120 ? trimmed.slice(0, 120) + "…" : trimmed;
      return `✍️ ${preview}`;
    }

    case "persona-stats": {
      const stats = (d.stats as any[]) ?? [];
      const status = d.status as string;
      if (!stats.length && !status) return null;
      const parts: string[] = [];
      if (status) parts.push(status);
      for (const s of stats) {
        parts.push(`${s.name}: ${s.value}/${s.max ?? 100}`);
      }
      return `📊 ${parts.join(" · ")}`;
    }

    case "illustrator": {
      const shouldGenerate = d.shouldGenerate as boolean;
      if (!shouldGenerate) return null;
      const style = d.style as string;
      const reason = d.reason as string;
      return `🎨 ${reason || "Generating scene illustration"}${style ? ` (${style})` : ""}`;
    }

    case "lorebook-keeper": {
      const updates = (d.updates as any[]) ?? [];
      if (!updates.length) return null;
      return updates.map((u: any) => `📖 ${u.action === "create" ? "New" : "Updated"}: ${u.entryName}`).join("\n");
    }

    case "editor": {
      const changes = (d.changes as any[]) ?? [];
      if (!changes.length) return `✅ No edits needed`;
      return changes.map((c: any) => `✏️ ${c.description}`).join("\n");
    }

    case "html": {
      const text = d.text as string;
      return `🎨 ${text || "HTML formatting active"}`;
    }

    case "chat-summary": {
      const text = d.text as string;
      return `📝 ${text || "Chat summary active"}`;
    }

    default:
      return null;
  }
}

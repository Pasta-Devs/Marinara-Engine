import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle, Search, Sparkles, TriangleAlert, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface HomeFaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  bullets?: string[];
}

const QUICK_FIXES = [
  "Raise max output tokens if agents, trackers, or Lorebook Keeper keep failing or returning broken JSON.",
  "Update before digging too deep. If you installed from Git, use the updater or the Advanced settings update check.",
  "If the installer or startup scripts vanished, check antivirus quarantine first and whitelist the Marinara folder.",
  "If Game Mode setup keeps failing, switch to a stronger model before changing prompts or presets.",
];

const HOME_FAQ_ITEMS: HomeFaqItem[] = [
  {
    id: "connect-model",
    category: "Top Issue",
    question: "How do I connect Marinara to a model?",
    answer: "Create a connection first, test it, then select it for the chat before you send a message.",
    bullets: [
      "Open Connections from the top bar, create a new connection, choose your provider, then fill in the API key, base URL if needed, and model name.",
      "Use Test Connection before saving. If the test fails, check the key, provider route, base URL, and model spelling before changing chat settings.",
      "After saving, pick that connection from the chains icon on the left side of the chat input, or set it in Chat Settings for that chat.",
      "For local models, make sure the local server or Marinara Local Model sidecar is running first. The bundled Local Model is best for helpers and trackers, not main roleplay generation.",
    ],
  },
  {
    id: "game-mode-model",
    category: "Top Issue",
    question: "What model should I use for Game Mode?",
    answer: "Game Mode is much pickier than regular chat, especially during first generation and session setup.",
    bullets: [
      "Use a strong structured-output model for setup and major GM turns: Claude Opus or Sonnet tier, Gemini Pro tier, GPT-5.x, or a similarly reliable frontier model.",
      "A strong local model can work too, but use enough context and output budget for setup JSON, session state, and trackers.",
      "Weaker models are more likely to produce malformed JSON, weak formatting, or low-quality GM output.",
    ],
  },
  {
    id: "agent-max-length",
    category: "Top Issue",
    question: "My trackers, Lorebook Keeper, or agents do nothing or fail with a max length error. What fixes that?",
    answer:
      "The most common fix is increasing max output tokens so the model can finish the tracker JSON instead of truncating it.",
    bullets: [
      "Open Chat Settings, then Advanced Parameters, or adjust the connection defaults and raise Max Output Tokens.",
      "Agent max output defaults higher now, but tracker-heavy chats can still need more headroom on weaker or local models.",
      "If an agent keeps breaking formatting, move it to a stronger structured-output model.",
      "If a bad cached turn keeps poisoning results, copy your last user message, delete that turn and anything after it, then resend.",
    ],
  },
  {
    id: "sidecar-cpu-fallback",
    category: "Top Issue",
    question: "I saw '[sidecar] Startup with max GPU offload failed, retrying with CPU fallback'. Is that normal?",
    answer:
      "Usually yes. Marinara's local sidecar is meant to live on CPU and RAM so your main RP model can keep the GPU and VRAM.",
    bullets: [
      "A fallback message does not automatically mean anything is broken.",
      "The sidecar is there for helpers and utility tasks, not to compete with your main model for VRAM.",
      "Treat it as a problem only if the sidecar never recovers or keeps crashing instead of settling on CPU fallback.",
    ],
  },
  {
    id: "antivirus-installer",
    category: "Setup",
    question: "My antivirus flagged the installer or deleted files. Is Marinara safe?",
    answer: "This is a very common false-positive path for installers and batch files that spawn local services.",
    bullets: [
      "Add the Marinara folder to your antivirus exclusions before reinstalling or restoring files.",
      "Bitdefender and Windows Defender are the most common sources of quarantines here.",
      "Restoring the quarantined files and rerunning usually fixes the issue.",
      "If you want a second opinion, compare the release files against a VirusTotal report rather than trusting a single AV popup.",
    ],
  },
  {
    id: "blank-page-localhost",
    category: "Setup",
    question: "I get a blank page or ERR_EMPTY_RESPONSE on localhost:7860. What should I try?",
    answer: "This is usually a browser state problem rather than a dead install.",
    bullets: [
      "Try localhost:7860 instead of 127.0.0.1, or the reverse if you already used localhost.",
      "Hard refresh with Ctrl+Shift+R and clear the site's local storage.",
      "Test in incognito or a different browser.",
      "Docker and Podman users hit the same symptom, so browser cleanup is still worth trying there too.",
    ],
  },
  {
    id: "update-without-installer",
    category: "Setup",
    question: "How do I update without the installer?",
    answer: "The updater expects a real Git checkout.",
    bullets: [
      "If you downloaded a ZIP, it does not contain the .git history the updater needs.",
      "Either reinstall from the supported path or initialize Git properly before trying to update in place.",
      "You can also use Settings > Advanced > Check for Updates when your install already has Git metadata.",
    ],
  },
  {
    id: "android-apk-termux",
    category: "Setup",
    question: "Is the Android APK standalone?",
    answer: "No. The APK is only a WebView shell for Marinara Engine running locally in Termux.",
    bullets: [
      "Install Termux from F-Droid and run Marinara with ./start-termux.sh first.",
      "The APK opens the same-device local server at 127.0.0.1, so it cannot work if Termux is closed.",
      "If it stays on the connection screen, go back to Termux and start the server.",
    ],
  },
  {
    id: "pnpm-install-bat",
    category: "Setup",
    question: "'pnpm: not found' or install.bat failed. What now?",
    answer: "Your system usually just does not have pnpm available yet.",
    bullets: [
      "Install pnpm globally with npm install -g pnpm, or use the EXE installer if you want the guided path.",
      "On Android or Termux, a long pause at Corepack alignment is a recurring pain point rather than a special Marinara-only error.",
      "If Termux hangs specifically on 'Aligning pnpm via Corepack', let it finish before assuming it is dead.",
    ],
  },
  {
    id: "google-cloud-credit",
    category: "Connections",
    question: "Can I use Google Cloud's free credit with Marinara?",
    answer: "Usually yes, but not every Google route behaves the same.",
    bullets: [
      "Newer AI Studio API accounts have tighter limitations, so Vertex is the safer route.",
      "If you prefer a relay, BYOK through OpenRouter is another common workaround.",
    ],
  },
  {
    id: "best-local-model",
    category: "Connections",
    question: "What kind of local model should I use?",
    answer: "Use the strongest local model your hardware can run at a practical speed.",
    bullets: [
      "Prioritize instruction following, long-context stability, and reliable structured output over raw benchmark hype.",
      "Q4 and better quants are usually the sweet spot when VRAM is tight.",
      "Very small E2B or E4B class models are fine for helpers and sidecars, but not ideal for serious RP.",
    ],
  },
  {
    id: "unknown-model-parameters",
    category: "Connections",
    question: "My custom or self-hosted model is not listed. Which parameters will Marinara send?",
    answer:
      "For unknown models, Marinara avoids guessing provider-specific parameters and only sends the custom parameters you define.",
    bullets: [
      "Use Custom Parameters on the connection when your runtime expects special flags.",
      "Known model profiles still get their supported defaults, but unknown model IDs stay conservative to avoid rejected requests.",
    ],
  },
  {
    id: "long-context-models",
    category: "Connections",
    question: "Can I use a long-context self-hosted model?",
    answer: "Yes. Set the context and output overrides to match what your runtime actually supports.",
    bullets: [
      "Use the connection overrides or Chat Settings Advanced Parameters instead of relying on a hard built-in ceiling.",
      "If the backend or model loader only exposes a smaller window, Marinara cannot make that runtime accept more context.",
    ],
  },
  {
    id: "bigger-agent-model",
    category: "Connections",
    question: "How do I use a bigger model for agents instead of the local sidecar?",
    answer:
      "Create a normal connection to your own Kobold, llama.cpp, or compatible endpoint and mark it for agent use.",
    bullets: [
      "The switch lives on the connection itself.",
      "Once enabled, agents can use that remote model instead of the local sidecar path.",
      "You can still override an individual agent from its own menu when a chat needs a stronger helper model.",
    ],
  },
  {
    id: "reverse-proxy",
    category: "Connections",
    question: "How do I use Claude Code or a reverse proxy?",
    answer: "There is no separate reverse-proxy field like SillyTavern uses.",
    bullets: [
      "Point a Custom or Anthropic-style connection directly at your local proxy URL, usually something like http://localhost:PORT/v1.",
      "If your proxy relies on account-based OAuth flows, expect them to be less stable than API-key setups.",
    ],
  },
  {
    id: "nanogpt-401",
    category: "Connections",
    question: "NanoGPT is throwing 401 errors. Why does recreating the connection help?",
    answer: "That has been one of the more reliable fixes for NanoGPT-specific auth weirdness.",
    bullets: [
      "Delete the broken connection and recreate it from scratch instead of endlessly editing the existing one.",
      "Some users only got rid of the 401 loop after remaking even the default NanoGPT connection.",
    ],
  },
  {
    id: "sampler-settings",
    category: "Core",
    question: "Where do I change temperature, top-p, and other sampler settings?",
    answer: "Open a chat, then use Chat Settings and the Advanced Parameters section.",
    bullets: [
      "That is where you adjust temperature, top-p, max output tokens, context/message limits, thinking tags, and custom parameters.",
      "Use Set Default if you want those values to become the saved defaults for that connection.",
    ],
  },
  {
    id: "chat-settings-location",
    category: "Core",
    question: "Where did Chat Settings, Gallery, and Active Context go?",
    answer: "Inside chats, those live in the top toolbar as expandable windows instead of sidebars.",
    bullets: [
      "Conversation, Roleplay, and Game Mode share the same compact button style for these windows.",
      "On mobile, the overflow menu groups buttons when the screen cannot fit them in one row.",
    ],
  },
  {
    id: "enable-agents",
    category: "Core",
    question: "How do I enable agents?",
    answer: "Open Chat Settings and use the Agents section for the current chat.",
    bullets: [
      "Roleplay supports the full agent stack plus custom agents.",
      "Conversation and Game Mode can also attach custom agents, while some built-in helpers stay hidden because they are part of the core pipeline.",
      "Each added agent has its own menu for connection, prompt options, and relevant setup.",
    ],
  },
  {
    id: "macro-list",
    category: "Core",
    question: "Where is the list of supported macros?",
    answer: "Use /macros in chat, or click the macro reference icon inside supported editors.",
    bullets: [
      "Preset fields, Character and Persona card fields, Lorebook entry fields, and Agent prompt fields expose the same macro guide.",
      "Use the in-field expand button when you need more room to edit long prompts or card text.",
    ],
  },
  {
    id: "same-character-chats",
    category: "Core",
    question: "How do I switch between different chats with the same character?",
    answer: "Use Recent Chats from the home screen or the Branches button inside the chat.",
    bullets: [
      "Chats with the same character are organized as branches rather than one giant flat thread.",
      "Conversation, Roleplay, and Game Mode all use branch tools now, and some modes can branch directly from user inputs.",
    ],
  },
  {
    id: "chat-ui-colors",
    category: "Core",
    question: "Can I customize the new chat buttons, windows, and tracker colors?",
    answer: "Yes. Open Settings, then Appearance.",
    bullets: [
      "Accent Color controls the shared chat chrome accents, including many button borders and icon states.",
      "Tracker Panel background and Chat Chrome Text Color control tracker and expandable-window surfaces separately.",
      "Light mode should swap chrome text and surfaces to readable light-theme colors automatically.",
    ],
  },
  {
    id: "where-data-lives",
    category: "Core",
    question: "Where are my chats, presets, and other data stored?",
    answer: "The main local database lives in packages/server/data/marinara-engine.db.",
    bullets: [
      "That is the file power users usually back up or inspect when they want direct access.",
      "Most of the 'where is X stored' questions end up there.",
    ],
  },
  {
    id: "hide-message-from-prompt",
    category: "Core",
    question: "How do I hide a message from the prompt without deleting it?",
    answer: "Open the message actions and use the eyeball icon.",
    bullets: ["That hides the message from prompt assembly without wiping it from the visible chat history."],
  },
  {
    id: "sillytavern-import",
    category: "Core",
    question: "How does SillyTavern import behave?",
    answer: "Most data imports cleanly, but there are a few recurring gotchas.",
    bullets: [
      "Regex scripts still need to be imported separately.",
      "Character chats can sometimes end up merged under one unused-style branch during messy imports.",
      "Editing older imported multi-line character messages can still feel quirky, so treat that path carefully.",
    ],
  },
  {
    id: "prose-guardian-user-voice",
    category: "Agents",
    question: "What does Prose Guardian do now?",
    answer: "Prose Guardian is a post-processing rewrite agent, not a normal pre-generation speaker.",
    bullets: [
      "It edits the last model reply for banned words, repetition, prose slop, and your writing instructions without changing events or meaning.",
      "If no edit is needed, it should leave the message alone.",
      "If it rewrites a message, use the shield action under that message to restore the original.",
      "Continuity Checker can share the same rewrite pass when both are enabled.",
    ],
  },
  {
    id: "attribute-scale",
    category: "Agents",
    question: "What counts as high or low for attribute stats?",
    answer:
      "The default expectation is basically DnD-style 1 to 20, but the model still interprets the fiction around it.",
    bullets: ["Think of 10-ish as ordinary and 18 to 20 as exceptional unless your setup says otherwise."],
  },
  {
    id: "narrative-director-captures-messages",
    category: "Agents",
    question: "How do I make Narrative Director push the story?",
    answer: "Add it to the Roleplay chat, then arm Push Story above the input box.",
    bullets: [
      "It only runs on the next character reply while the Push Story button is enabled.",
      "Choose whether it should push the plot naturally or introduce a random event from the agent menu.",
      "If the button is not armed, Narrative Director stays quiet.",
    ],
  },
  {
    id: "music-dj",
    category: "Agents",
    question: "Where did the separate Spotify and YouTube music agents go?",
    answer: "They are merged into Music DJ.",
    bullets: [
      "Configure Spotify, YouTube, or both from the Music DJ agent menu.",
      "The mini player can switch between Spotify and YouTube.",
      "Music commands follow whichever player is active.",
    ],
  },
  {
    id: "comfyui-illustrator-setup",
    category: "Images",
    question: "How do I get ComfyUI or Illustrator working?",
    answer: "The workflow template has to expose the placeholders Marinara expects.",
    bullets: [
      "Use %prompt%, %width%, %height%, %negative_prompt%, and %seed% in the workflow or request template.",
      "Use %reference_image_01% through %reference_image_04% or %reference_image_name_01% through %reference_image_name_04% for multiple ComfyUI reference slots.",
      'If your JSON parser complains, wrap width and height placeholders in quotes, like "%width%".',
      "The default timeout is 120 seconds, which is often too short for slower Flux or Chroma workflows.",
    ],
  },
  {
    id: "image-resolution",
    category: "Images",
    question: "How do I change image resolution?",
    answer: "Set it on the image-generation connection itself.",
    bullets: ["Newer versions expose width and height in the connection panel rather than hiding it in a prompt."],
  },
  {
    id: "temp-must-be-1",
    category: "Images",
    question: "I got a 'Temp must be 1' error while using Illustrate. Which temperature is wrong?",
    answer: "Usually the image connection, not your main chat model.",
    bullets: ["Check the image-generation connection's temperature field first."],
  },
  {
    id: "booru-prompts",
    category: "Images",
    question: "How do I steer Illustrator prompts?",
    answer:
      "Choose an Illustrator prompt mode from that chat's agent menu, or edit the agent prompt from the Agents tab.",
    bullets: [
      "Illustration, Comic Page, Colored Manga, B&W Manga, Background, and Selfie modes all tune the prompt differently.",
      "Use the default style from Style Profiles in Advanced settings when you want a shared image style.",
    ],
  },
  {
    id: "character-sprites",
    category: "Images",
    question: "How do I generate character sprites?",
    answer: "Open the character card and use the sprite generation flow from there.",
    bullets: ["You still need a working image-generation connection before the button becomes useful."],
  },
  {
    id: "game-invalid-json",
    category: "Game Mode",
    question: "Game Mode first generation failed with invalid JSON. How do I stabilize it?",
    answer: "Start by upgrading the model before changing anything else.",
    bullets: [
      "A strong GM model is the main fix here.",
      "Use Game Chat Settings Prompt when you want to replace the GM prompt.",
      "Use Extra instructions under the GM prompt for style or handling notes that should be appended as SPECIAL INSTRUCTIONS.",
    ],
  },
  {
    id: "game-editability",
    category: "Game Mode",
    question: "Can I edit widgets, scenes, or journal-like Game Mode data after the fact?",
    answer: "A lot more Game Mode state is editable from the in-chat boxes now.",
    bullets: [
      "Use Session for Session History, Journal, tutorial access, spoilers, and ending the current session.",
      "Use Game Assets for generated assets and scene resources.",
      "Use branch actions on user inputs in the logs when you want to redo a turn from that point.",
    ],
  },
  {
    id: "game-party-members",
    category: "Game Mode",
    question: "Can I add new party members mid-game?",
    answer: "Yes. Marinara can recruit party members during an active game now.",
    bullets: [
      "If some portraits or tracker details lag behind after recruiting someone new, refresh or regenerate the related asset rather than assuming the recruit failed.",
    ],
  },
  {
    id: "game-background",
    category: "Game Mode",
    question: "How do I change the Game Mode background?",
    answer: "Use Game Assets or rerun the scene and image pass for that beat.",
    bullets: [
      "Game backgrounds are tied to scene analysis and asset generation, so background changes follow that pipeline rather than one permanent toggle.",
      "If you need direct out-of-scene help, switch into GM chat mode and ask the GM to adjust the scene.",
    ],
  },
  {
    id: "talk-to-gm",
    category: "Game Mode",
    question: "Can I talk to the GM directly instead of playing in-character?",
    answer: "Yes. Switch into GM chat mode when you need direct out-of-scene help.",
    bullets: [
      "That is the easiest way to ask for lorebook updates, map changes, UI adjustments, or scene-management help without pretending it is an in-world action.",
    ],
  },
  {
    id: "session-summary",
    category: "Game Mode",
    question: "Does ending a session summarize it and let me continue later?",
    answer: "Yes. Ending a session generates continuity data and the next session can resume from that state later.",
    bullets: ["The session-end flow is meant to preserve a usable recap, not just close the chat."],
  },
  {
    id: "content-filtering",
    category: "Misc",
    question: "Is there built-in content filtering?",
    answer:
      "Not as a separate Marinara safety layer. Filtering behavior mostly depends on the model or provider you connect.",
  },
  {
    id: "shared-gpu",
    category: "Misc",
    question: "Can I run RP and image generation on the same GPU?",
    answer: "Sometimes, but VRAM is the hard limit.",
    bullets: [
      "It is possible on tighter setups, but image generation plus a big RP model is one of the fastest ways to hit a wall.",
    ],
  },
  {
    id: "mobile-app",
    category: "Misc",
    question: "Is there a mobile app?",
    answer:
      "Not as a standalone app yet. You can install Marinara as a PWA from the browser on phones and tablets while the server runs on your computer, Docker host, or Termux device.",
  },
  {
    id: "tts-support",
    category: "Misc",
    question: "Does Marinara support TTS?",
    answer: "Yes. There is built-in support for OpenAI-compatible TTS providers now.",
    bullets: [
      "Set it up from the Connections area and the TTS settings card.",
      "If you expected older advice saying TTS was extension-only, that is out of date now.",
    ],
  },
  {
    id: "translations",
    category: "Misc",
    question: "Can I chat in languages other than English? What about the UI?",
    answer: "Chat content works in other languages, but the UI itself is still English-first.",
    bullets: ["Non-English chats are fine.", "UI translations are still limited, though contributions are welcome."],
  },
  {
    id: "bug-reports",
    category: "Misc",
    question: "Where should I report bugs or request features?",
    answer: "Use the dedicated bug and feedback channel in Discord rather than dropping reports into general chat.",
    bullets: [
      "The home screen already links you to the Discord server.",
      "Using the proper report channel makes it much easier for maintainers to tag and follow up on problems.",
    ],
  },
];

const CATEGORY_STYLES: Record<string, string> = {
  "Top Issue": "border-[var(--destructive)]/30 bg-[var(--destructive)]/12 text-[var(--destructive)]",
  Setup: "border-amber-400/30 bg-amber-500/12 text-amber-700 dark:text-amber-200",
  Connections: "border-cyan-400/30 bg-cyan-500/12 text-cyan-700 dark:text-cyan-200",
  Core: "border-emerald-400/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200",
  Agents:
    "border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-text)]",
  Images:
    "border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-text)]",
  "Game Mode": "border-orange-400/30 bg-orange-500/12 text-orange-700 dark:text-orange-200",
  Misc: "border-[var(--border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)]",
};

function getFaqSearchText(item: HomeFaqItem) {
  return [item.category, item.question, item.answer, ...(item.bullets ?? [])].join(" ").toLowerCase();
}

export function HomeFaq({
  defaultExpanded = false,
  className,
  compact = false,
  expanded: expandedProp,
  onExpandedChange,
  openItemId: openItemIdProp,
  onOpenItemIdChange,
}: {
  defaultExpanded?: boolean;
  className?: string;
  compact?: boolean;
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
  openItemId?: string | null;
  onOpenItemIdChange?: (v: string | null) => void;
} = {}) {
  const [expandedInternal, setExpandedInternal] = useState(defaultExpanded);
  const [openItemIdInternal, setOpenItemIdInternal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const expanded = expandedProp ?? expandedInternal;
  const setExpanded = (v: boolean) => {
    setExpandedInternal(v);
    onExpandedChange?.(v);
  };
  const openItemId = openItemIdProp !== undefined ? openItemIdProp : openItemIdInternal;
  const setOpenItemId = (v: string | null) => {
    setOpenItemIdInternal(v);
    onOpenItemIdChange?.(v);
  };
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const visibleFaqItems = useMemo(
    () =>
      trimmedSearch ? HOME_FAQ_ITEMS.filter((item) => getFaqSearchText(item).includes(trimmedSearch)) : HOME_FAQ_ITEMS,
    [trimmedSearch],
  );

  if (compact) {
    return (
      <section className={cn("w-full", className)}>
        <div className="overflow-hidden rounded-lg border border-[var(--border)]/60 bg-[var(--card)]/70">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            aria-expanded={expanded}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--primary)]/25 bg-[linear-gradient(135deg,rgba(235,137,81,0.18),rgba(77,229,221,0.14))] text-[var(--primary)]">
              <HelpCircle size="0.875rem" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-semibold text-[var(--foreground)]">FAQ</p>
                <span className="rounded-full border border-[var(--border)]/60 bg-black/5 px-1.5 py-0.5 text-[0.5rem] uppercase tracking-[0.12em] text-[var(--muted-foreground)]/80 dark:bg-white/6">
                  {HOME_FAQ_ITEMS.length}
                </span>
              </div>
            </div>
            <ChevronDown
              size="0.875rem"
              className={cn(
                "shrink-0 text-[var(--muted-foreground)] transition-transform duration-200",
                expanded && "rotate-180 text-[var(--primary)]",
              )}
            />
          </button>

          {expanded && (
            <div className="border-t border-[var(--border)]/60 p-2">
              <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-[var(--border)]/60 bg-[var(--background)]/70 px-2 py-1.5">
                <Search size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search FAQ"
                  aria-label="Search FAQ"
                  className="min-w-0 flex-1 bg-transparent text-[0.6875rem] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/65"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    aria-label="Clear FAQ search"
                  >
                    <X size="0.6875rem" />
                  </button>
                ) : null}
              </div>
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {visibleFaqItems.map((item) => {
                  const isOpen = openItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "overflow-hidden rounded-lg border border-[var(--border)]/55 bg-[var(--card)]/45 transition-colors",
                        isOpen && "border-[var(--primary)]/30 bg-[var(--card)]/70",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenItemId(openItemId === item.id ? null : item.id)}
                        className="flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-1.5">
                            <span
                              className={cn(
                                "mt-[0.0625rem] shrink-0 rounded-full border px-1.5 py-0.5 text-[0.5rem] font-medium uppercase tracking-[0.12em]",
                                CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.Misc,
                              )}
                            >
                              {item.category}
                            </span>
                            <span className="min-w-0 flex-1 break-words text-[0.6875rem] font-medium leading-snug text-[var(--foreground)]">
                              {item.question}
                            </span>
                          </div>
                        </div>
                        {isOpen ? (
                          <ChevronDown size="0.8125rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                        ) : (
                          <ChevronRight size="0.8125rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="border-t border-[var(--border)]/55 bg-[var(--muted)]/30 px-2.5 py-2 dark:bg-black/10">
                          <p className="text-[0.6875rem] leading-relaxed text-[var(--foreground)]/92">{item.answer}</p>
                          {item.bullets?.length ? (
                            <ul className="mt-2 space-y-1.5 text-[0.65625rem] leading-relaxed text-[var(--muted-foreground)]/85">
                              {item.bullets.map((bullet) => (
                                <li key={bullet} className="flex gap-1.5">
                                  <span className="mt-[0.18rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]/70" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
                {visibleFaqItems.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border)]/55 bg-[var(--muted)]/30 px-3 py-3 text-center text-[0.6875rem] text-[var(--muted-foreground)]">
                    No FAQ matches.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("w-full max-w-md", className)}>
      <div className="overflow-hidden rounded-[1rem] border border-[var(--border)]/60 bg-[var(--card)] shadow-[0_14px_38px_rgba(0,0,0,0.24)] backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(18,14,23,0.92),rgba(11,10,16,0.86))]">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 sm:items-center sm:gap-3 sm:px-4"
          aria-expanded={expanded}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--primary)]/25 bg-[linear-gradient(135deg,rgba(235,137,81,0.18),rgba(77,229,221,0.14))] text-[var(--primary)] shadow-[0_0_20px_rgba(235,137,81,0.1)]">
            <HelpCircle size="1rem" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Professor Mari&apos;s FAQ</p>
              <span className="rounded-full border border-[var(--border)]/60 bg-black/5 px-2 py-0.5 text-[0.5625rem] uppercase tracking-[0.16em] text-[var(--muted-foreground)]/80 dark:bg-white/6">
                {HOME_FAQ_ITEMS.length} answers
              </span>
            </div>
            <p className="mt-0.5 text-[0.6875rem] leading-snug text-[var(--muted-foreground)]/80">
              The recurring setup, model, Game Mode, image, and agent questions people keep asking.
            </p>
          </div>
          <ChevronDown
            size="1rem"
            className={cn(
              "shrink-0 text-[var(--muted-foreground)] transition-transform duration-200",
              expanded && "rotate-180 text-[var(--primary)]",
            )}
          />
        </button>

        {expanded && (
          <div className="border-t border-[var(--border)]/60 px-4 pb-4 pt-3">
            <div className="rounded-[1.1rem] border border-[var(--primary)]/20 bg-[linear-gradient(135deg,rgba(235,137,81,0.12),rgba(77,229,221,0.08))] p-3.5 shadow-[0_10px_26px_rgba(0,0,0,0.18)] sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="mx-auto flex h-28 w-20 shrink-0 items-start justify-center overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--card)]/80 shadow-[0_10px_24px_rgba(0,0,0,0.22)] sm:mx-0 sm:h-32 sm:w-24">
                  <img
                    src="/sprites/mari/Mari_explaining.png"
                    alt="Professor Mari"
                    className="h-full w-full object-cover object-[center_14%]"
                  />
                </div>
                <div className="min-w-0 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)]/50 px-2.5 py-1 text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--muted-foreground)]/85 dark:border-white/10 dark:bg-black/20">
                    <Sparkles size="0.6875rem" />
                    Professor Mari
                  </div>
                  <p className="mt-2 text-sm font-semibold tracking-tight text-[var(--foreground)]">
                    Start here before you go hunting through Discord logs.
                  </p>
                  <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]/85">
                    The biggest repeat problems are Game Mode model choice, silent agent failures from low max output
                    tokens, and confusion about the local sidecar using CPU instead of the GPU.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-[1.1rem] border border-amber-400/20 bg-amber-500/8 p-3">
              <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200/90">
                <TriangleAlert size="0.875rem" />
                Before You Post A Bug
              </div>
              <ul className="mt-2 space-y-1.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]/88">
                {QUICK_FIXES.map((fix) => (
                  <li key={fix} className="flex gap-2">
                    <span className="mt-[0.18rem] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/75 dark:bg-amber-300/75" />
                    <span>{fix}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3">
              <div className="mb-2 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]/65">
                  Frequently Asked Questions
                </p>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]/50">
                  Tap a question to reveal the answer.
                </p>
              </div>
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--background)]/70 px-3 py-2">
                <Search size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search FAQ"
                  aria-label="Search FAQ"
                  className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/65"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    aria-label="Clear FAQ search"
                  >
                    <X size="0.75rem" />
                  </button>
                ) : null}
              </div>

              <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-0.5 sm:max-h-[28rem] sm:pr-1">
                {visibleFaqItems.map((item) => {
                  const isOpen = openItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "overflow-hidden rounded-[1rem] border border-[var(--border)]/55 bg-[var(--card)]/45 transition-colors",
                        isOpen && "border-[var(--primary)]/30 bg-[var(--card)]/70 shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenItemId(openItemId === item.id ? null : item.id)}
                        className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-[0.0625rem] shrink-0 rounded-full border px-2 py-0.5 text-[0.5625rem] font-medium uppercase tracking-[0.16em]",
                                CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.Misc,
                              )}
                            >
                              {item.category}
                            </span>
                            <span className="min-w-0 flex-1 break-words text-[0.75rem] font-medium leading-relaxed text-[var(--foreground)]">
                              {item.question}
                            </span>
                          </div>
                        </div>
                        {isOpen ? (
                          <ChevronDown size="0.9375rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                        ) : (
                          <ChevronRight size="0.9375rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="border-t border-[var(--border)]/55 bg-[var(--muted)]/30 px-3 py-3 dark:bg-black/10">
                          <p className="text-[0.72rem] leading-relaxed text-[var(--foreground)]/92">{item.answer}</p>
                          {item.bullets?.length ? (
                            <ul className="mt-2 space-y-1.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]/85">
                              {item.bullets.map((bullet) => (
                                <li key={bullet} className="flex gap-2">
                                  <span className="mt-[0.18rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]/70" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
                {visibleFaqItems.length === 0 ? (
                  <div className="rounded-[1rem] border border-[var(--border)]/55 bg-[var(--muted)]/30 px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
                    No FAQ matches.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

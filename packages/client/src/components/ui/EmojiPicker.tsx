// ──────────────────────────────────────────────
// UI: Emoji Picker — lightweight popover
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { rememberRecentMedia, useRecentMedia } from "../../hooks/use-recent-media";
import { EMOJI_CATEGORIES, EMOJI_SEARCH_NAMES } from "../../lib/emoji-catalog.generated";
import { EMOJI_KEYWORDS, matchesEmojiQuery } from "../../lib/emoji-search";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Search } from "lucide-react";

const CURATED_CATEGORIES = [
  {
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😚",
      "😙",
      "🥲",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🫢",
      "🤫",
      "🤔",
      "🫡",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "🫥",
      "😏",
      "😒",
      "🙄",
      "😬",
      "🤥",
      "😌",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤮",
      "🥴",
      "😵",
      "🤯",
      "🥳",
      "🥺",
      "😢",
      "😭",
      "😤",
      "😠",
      "😡",
      "🤬",
      "😈",
      "👿",
      "💀",
      "☠️",
      "💩",
      "🤡",
      "👹",
      "👺",
      "👻",
      "👽",
      "🤖",
      "😺",
      "😸",
      "😹",
      "😻",
      "😼",
      "😽",
      "🙀",
      "😿",
      "😾",
    ],
  },
  {
    label: "Gestures",
    icon: "👋",
    emojis: [
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "🫱",
      "🫲",
      "🫳",
      "🫴",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🫰",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "🖕",
      "👇",
      "☝️",
      "🫵",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "🫶",
      "👐",
      "🤲",
      "🤝",
      "🙏",
      "✍️",
      "💪",
      "🦾",
      "🦿",
      "🦵",
      "🦶",
      "👂",
      "🦻",
      "👃",
      "🧠",
      "🫀",
      "🫁",
      "🦷",
      "🦴",
      "👀",
      "👁️",
      "👅",
      "👄",
    ],
  },
  {
    label: "People",
    icon: "👤",
    emojis: [
      "👶",
      "🧒",
      "👦",
      "👧",
      "🧑",
      "👱",
      "👨",
      "🧔",
      "👩",
      "🧓",
      "👴",
      "👵",
      "💂",
      "👷",
      "🫅",
      "🤴",
      "👸",
      "👳",
      "🧕",
      "🤵",
      "👰",
      "🤰",
      "🫃",
      "🤱",
      "👼",
      "🎅",
      "🤶",
      "🦸",
      "🦹",
      "🧙",
      "🧚",
      "🧛",
      "🧜",
      "🧝",
      "🧞",
      "🧟",
      "🧌",
      "💆",
      "💇",
      "🚶",
      "🧍",
      "🧎",
      "🏃",
      "💃",
      "🕺",
      "🕴️",
      "👯",
      "🧖",
      "🧗",
      "🏌️",
      "🏄",
      "🚣",
      "🏊",
      "⛹️",
      "🏋️",
      "🚴",
      "🚵",
      "🤸",
      "🤼",
      "🤽",
      "🤾",
      "🤺",
      "⛷️",
      "🏂",
      "🏇",
    ],
  },
  {
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❤️‍🔥",
      "❤️‍🩹",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "♥️",
      "🫶",
      "💑",
      "💏",
      "👪",
      "👨‍👩‍👦",
      "👨‍👩‍👧",
    ],
  },
  {
    label: "Nature",
    icon: "🌸",
    emojis: [
      "🌸",
      "💐",
      "🌷",
      "🌹",
      "🥀",
      "🌺",
      "🌻",
      "🌼",
      "🌱",
      "🪴",
      "🌲",
      "🌳",
      "🌴",
      "🌵",
      "🌾",
      "🌿",
      "☘️",
      "🍀",
      "🍁",
      "🍂",
      "🍃",
      "🍄",
      "🪹",
      "🪺",
      "🐾",
      "🐵",
      "🐒",
      "🦍",
      "🦧",
      "🐶",
      "🐕",
      "🦮",
      "🐩",
      "🐺",
      "🦊",
      "🦝",
      "🐱",
      "🐈",
      "🦁",
      "🐯",
      "🐅",
      "🐆",
      "🐴",
      "🫎",
      "🫏",
      "🦄",
      "🦓",
      "🐮",
      "🐂",
      "🐃",
      "🐄",
      "🐷",
      "🐖",
      "🐗",
      "🐽",
      "🐏",
      "🐑",
      "🐐",
      "🐪",
      "🐫",
      "🦙",
      "🦒",
      "🐘",
      "🦣",
      "🦏",
      "🦛",
      "🐭",
      "🐁",
      "🐀",
      "🐹",
      "🐰",
      "🐇",
      "🐿️",
      "🦫",
      "🦔",
      "🦇",
      "🐻",
      "🐨",
      "🐼",
      "🦥",
      "🦦",
      "🦨",
      "🦘",
      "🦡",
      "🐾",
    ],
  },
  {
    label: "Food",
    icon: "🍕",
    emojis: [
      "🍏",
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶️",
      "🫑",
      "🌽",
      "🥕",
      "🫒",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🫘",
      "🥐",
      "🥯",
      "🍞",
      "🥖",
      "🥨",
      "🧀",
      "🥚",
      "🍳",
      "🧈",
      "🥞",
      "🧇",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🌭",
      "🍔",
      "🍟",
      "🍕",
      "🫓",
      "🥪",
      "🥙",
      "🧆",
      "🌮",
      "🌯",
      "🫔",
      "🥗",
      "🥘",
      "🫕",
      "🥫",
      "🍝",
      "🍜",
      "🍲",
      "🍛",
      "🍣",
      "🍱",
      "🥟",
      "🦪",
      "🍤",
      "🍙",
      "🍚",
      "🍘",
      "🍥",
      "🥠",
      "🥮",
      "🍢",
      "🍡",
      "🍧",
      "🍨",
      "🍦",
      "🥧",
      "🧁",
      "🍰",
      "🎂",
      "🍮",
      "🍭",
      "🍬",
      "🍫",
      "🍿",
      "🧂",
      "🥤",
      "🧋",
      "🫙",
      "🧃",
      "🥛",
      "🍼",
      "☕",
      "🫖",
      "🍵",
      "🍶",
      "🍺",
      "🍻",
      "🥂",
      "🍷",
      "🫗",
      "🥃",
      "🍸",
      "🍹",
      "🍾",
      "🧊",
    ],
  },
  {
    label: "Objects",
    icon: "💡",
    emojis: [
      "⌚",
      "📱",
      "💻",
      "⌨️",
      "🖥️",
      "🖨️",
      "🖱️",
      "🖲️",
      "💽",
      "💾",
      "💿",
      "📀",
      "🧮",
      "📷",
      "📸",
      "📹",
      "🎥",
      "📞",
      "☎️",
      "📺",
      "📻",
      "🎙️",
      "⏱️",
      "⏲️",
      "⏰",
      "🕰️",
      "🔮",
      "🧿",
      "🪬",
      "💎",
      "⚖️",
      "🔧",
      "🔨",
      "⚒️",
      "🛠️",
      "🗡️",
      "⚔️",
      "🔫",
      "🏹",
      "🛡️",
      "🪃",
      "🪚",
      "🔩",
      "🪝",
      "🧲",
      "💡",
      "🔦",
      "🕯️",
      "📔",
      "📕",
      "📖",
      "📗",
      "📘",
      "📙",
      "📚",
      "📓",
      "📒",
      "📃",
      "📜",
      "📄",
      "📰",
      "🗞️",
      "✂️",
      "📌",
      "📍",
      "🖊️",
      "🖋️",
      "✒️",
      "📝",
      "✏️",
      "🔎",
      "🔏",
      "🔐",
      "🔑",
      "🗝️",
    ],
  },
  {
    label: "Symbols",
    icon: "💯",
    emojis: [
      "❤️",
      "💯",
      "💢",
      "💥",
      "💫",
      "💦",
      "💨",
      "🕳️",
      "💣",
      "💬",
      "👁️‍🗨️",
      "🗨️",
      "🗯️",
      "💭",
      "💤",
      "🔥",
      "✨",
      "🌟",
      "💫",
      "⭐",
      "🌈",
      "☀️",
      "🌤️",
      "⛅",
      "🌥️",
      "☁️",
      "🌦️",
      "🌧️",
      "⛈️",
      "🌩️",
      "🌪️",
      "🌫️",
      "🌬️",
      "❄️",
      "☃️",
      "⛄",
      "💧",
      "💦",
      "🌊",
      "♠️",
      "♥️",
      "♦️",
      "♣️",
      "🎯",
      "🎵",
      "🎶",
      "🔴",
      "🟠",
      "🟡",
      "🟢",
      "🔵",
      "🟣",
      "⚫",
      "⚪",
      "🟤",
      "✅",
      "❌",
      "⭕",
      "❓",
      "❗",
      "‼️",
      "⁉️",
      "0️⃣",
      "1️⃣",
      "2️⃣",
      "3️⃣",
      "4️⃣",
      "5️⃣",
      "6️⃣",
      "7️⃣",
      "8️⃣",
      "9️⃣",
      "🔟",
      "🔢",
      "#️⃣",
      "*️⃣",
      "🔤",
      "🔡",
      "🔠",
      "🔣",
      "🅰️",
      "🅱️",
      "🆎",
      "🆑",
      "🆒",
      "🆓",
      "🆔",
      "🆕",
      "🆖",
      "🆗",
      "🆘",
      "🆙",
      "🆚",
      "🈁",
      "🈂️",
      "㊗️",
      "㊙️",
      "🈲",
      "🈳",
      "🈴",
      "🈵",
      "🈶",
      "🈷️",
      "🈸",
      "🈹",
      "🈺",
      "🉐",
      "🉑",
      "✔️",
      "☑️",
      "⬛",
      "⬜",
      "◼️",
      "◻️",
      "◾",
      "◽",
      "▪️",
      "▫️",
      "🔶",
      "🔷",
      "🔸",
      "🔹",
      "🔺",
      "🔻",
    ],
  },
] as const;

const CURATED_CATEGORY_LABELS: Readonly<Record<string, readonly string[]>> = {
  "Smileys & Emotion": ["Smileys", "Hearts"],
  "People & Body": ["Gestures", "People"],
  "Animals & Nature": ["Nature"],
  "Food & Drink": ["Food"],
  Objects: ["Objects"],
  Symbols: ["Symbols"],
};

const CATEGORIES = EMOJI_CATEGORIES.map((category) => {
  const curated = CURATED_CATEGORY_LABELS[category.label] ?? [];
  const familiarEmoji = CURATED_CATEGORIES.filter((item) => curated.includes(item.label)).flatMap((item) => [
    ...item.emojis,
  ]);
  return {
    ...category,
    emojis: Array.from(new Set([...familiarEmoji, ...category.emojis])),
  };
});

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  /** Position anchor — the button that triggered it (horizontal alignment) */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Container (e.g. input bar) whose top edge determines vertical placement */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Optional extra tab (e.g. custom emojis) shown after the standard categories. */
  customTab?: {
    icon: React.ReactNode;
    label?: string;
    render: (query: string) => React.ReactNode;
    renderSearch?: (query: string) => React.ReactNode;
  };
  /** Render inline to fill a parent (no portal/positioning) — e.g. inside the mobile composer sheet. */
  embedded?: boolean;
  /** Styling for the standalone popup; embedded pickers use their parent's surface. */
  popupClassName?: string;
}

export function EmojiPicker({
  open,
  onClose,
  onSelect,
  anchorRef,
  containerRef,
  customTab,
  embedded,
  popupClassName,
}: EmojiPickerProps) {
  const { t: localizeUi } = useUiTranslation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | "custom">(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const recentEmojis = useRecentMedia("emoji");

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Position state for portal
  const [pos, setPos] = useState<{
    top?: number;
    left?: number;
    right?: number;
    maxHeight?: number;
  }>({});

  const updatePosition = useCallback(() => {
    if (!anchorRef?.current) return;
    const btnRect = anchorRef.current.getBoundingClientRect();
    const pad = 8;
    const pickerWidth = 336; // 21rem
    const pickerHeight = 352; // 22rem
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const vw = viewport?.width ?? window.innerWidth;
    const vh = viewport?.height ?? window.innerHeight;
    const visibleLeft = viewportLeft;
    const visibleTop = viewportTop;
    const visibleRight = viewportLeft + vw;
    const visibleBottom = viewportTop + vh;
    const panelWidth = Math.min(pickerWidth, Math.max(0, vw - 2 * pad));
    const btnRight = btnRect.right + viewportLeft;
    const btnBottom = btnRect.bottom + viewportTop;
    const btnTop = btnRect.top + viewportTop;

    // Composer mode (anchored to an input bar): pin the bottom edge above the bar's
    // top and grow upward. The bar sits at the bottom of the screen, so this fits.
    if (containerRef?.current) {
      const barRect = containerRef.current.getBoundingClientRect();
      const barTop = barRect.top + viewportTop;
      const maxHeight = Math.min(pickerHeight, Math.max(0, barTop - visibleTop - 2 * pad));
      const top = Math.max(visibleTop + pad, barTop - maxHeight - pad);
      if (vw < 480) {
        // Center horizontally on mobile
        const left = visibleLeft + Math.max(pad, (vw - panelWidth) / 2);
        setPos({ top, left, maxHeight });
      } else {
        const alignedLeft = btnRight - panelWidth;
        if (alignedLeft < visibleLeft + pad) {
          setPos({ top, left: visibleLeft + pad, maxHeight });
        } else {
          setPos({ top, right: Math.max(pad, visibleRight - btnRight), maxHeight });
        }
      }
      return;
    }

    // Anchored mode (e.g. a message's reaction button, which can sit anywhere on
    // screen): open BELOW the anchor; flip above only when there isn't room below;
    // and clamp to the viewport so the panel never crosses an edge.
    const maxHeight = Math.min(pickerHeight, Math.max(0, vh - 2 * pad));
    const spaceBelow = visibleBottom - btnBottom;
    const openBelow = spaceBelow >= maxHeight + pad || spaceBelow >= btnTop - visibleTop;
    let top = openBelow ? btnBottom + pad : btnTop - pad - maxHeight;
    top = Math.max(visibleTop + pad, Math.min(top, visibleBottom - maxHeight - pad));
    // Align the panel's right edge to the button, then clamp into view.
    let left = btnRight - panelWidth;
    left = Math.max(visibleLeft + pad, Math.min(left, visibleRight - panelWidth - pad));
    setPos({ top, left, maxHeight });
  }, [anchorRef, containerRef]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        updatePosition();
      });
    };
    window.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [open, updatePosition]);

  const handleSelect = useCallback(
    (emoji: string) => {
      rememberRecentMedia("emoji", {
        value: emoji,
        label: EMOJI_SEARCH_NAMES[emoji] ?? EMOJI_KEYWORDS[emoji] ?? emoji,
      });
      onSelect(emoji);
    },
    [onSelect],
  );

  if (!open) return null;

  const searching = search.trim().length > 0;
  const filteredCategories = searching
    ? CATEGORIES.map((cat) => ({
        ...cat,
        emojis: cat.emojis.filter((emoji) => matchesEmojiQuery(search, emoji)),
      })).filter((cat) => cat.emojis.length > 0)
    : CATEGORIES;
  const visibleStandardCategories = searching
    ? filteredCategories
    : [CATEGORIES[typeof activeCategory === "number" ? activeCategory : 0]];

  const content = (
    <>
      {/* Search spans every standard category and custom emojis, regardless of the selected tab. */}
      <div className="border-b border-foreground/10 px-3 py-2">
        <div
          data-emoji-search-shell
          className="flex items-center gap-2 rounded-md bg-foreground/5 px-2.5 py-1.5 ring-1 ring-foreground/10 transition-shadow focus-within:ring-foreground/20"
        >
          <Search aria-hidden="true" size="0.875rem" className="shrink-0 text-foreground/45" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={localizeUi("ui.ui.emojipicker.searchEmojis")}
            aria-label={localizeUi("ui.ui.emojipicker.searchEmojis_ecbfa28")}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-foreground/35"
            autoFocus={!embedded}
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-0.5 border-b border-foreground/10 px-2 py-1">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setActiveCategory(i)}
            aria-label={cat.label}
            aria-pressed={activeCategory === i}
            className={cn(
              "rounded-md p-1.5 text-sm transition-colors",
              activeCategory === i
                ? "bg-foreground/10 text-foreground/80 ring-1 ring-foreground/15"
                : "text-foreground/45 hover:bg-foreground/10 hover:text-foreground/70",
            )}
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
        {customTab && (
          <button
            type="button"
            onClick={() => setActiveCategory("custom")}
            aria-label={customTab.label ?? "Custom emojis"}
            aria-pressed={activeCategory === "custom"}
            className={cn(
              "ml-auto flex items-center rounded-md p-1.5 text-sm transition-colors",
              activeCategory === "custom"
                ? "bg-foreground/10 text-foreground/80 ring-1 ring-foreground/15"
                : "text-foreground/45 hover:bg-foreground/10 hover:text-foreground/70",
            )}
            title={customTab.label ?? "Custom"}
          >
            {customTab.icon}
          </button>
        )}
      </div>

      {/* Emoji grid (or the custom-emoji tab content) */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!searching && recentEmojis.length > 0 && (
          <section data-recent-media="emoji" className="mb-2 border-b border-foreground/10 pb-2">
            <p className="mb-1 px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-foreground/45">
              {localizeUi("ui.mediaPicker.recentlyUsed")}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {recentEmojis.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSelect(item.value)}
                  aria-label={item.label ?? item.value}
                  title={item.label ?? item.value}
                  className="min-w-0 truncate rounded-md p-1 text-xl transition-transform hover:scale-125 hover:bg-foreground/10 active:scale-100"
                >
                  {item.value}
                </button>
              ))}
            </div>
          </section>
        )}
        {!searching && activeCategory === "custom" && customTab ? (
          customTab.render(search)
        ) : (
          <>
            {visibleStandardCategories.map((cat) => (
              <div key={cat.label}>
                <p className="mb-1 px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-foreground/45">
                  {cat.label}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSelect(emoji)}
                      aria-label={EMOJI_SEARCH_NAMES[emoji] ?? EMOJI_KEYWORDS[emoji] ?? emoji}
                      title={EMOJI_SEARCH_NAMES[emoji] ?? EMOJI_KEYWORDS[emoji] ?? emoji}
                      className="rounded-md p-1 text-xl transition-transform hover:scale-125 hover:bg-foreground/10 active:scale-100"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {searching && customTab && (customTab.renderSearch?.(search) ?? customTab.render(search))}
          </>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 flex-col overflow-hidden">{content}</div>;
  }

  return createPortal(
    <div
      ref={panelRef}
      data-emoji-picker
      className={cn(
        "fixed z-[9999] flex h-[22rem] w-[21rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] shadow-xl",
        popupClassName,
      )}
      style={{
        ...(pos.top != null ? { top: pos.top } : {}),
        ...(pos.left != null ? { left: pos.left } : {}),
        ...(pos.right != null ? { right: pos.right } : {}),
        ...(pos.maxHeight != null ? { maxHeight: pos.maxHeight } : {}),
      }}
    >
      {content}
    </div>,
    document.body,
  );
}

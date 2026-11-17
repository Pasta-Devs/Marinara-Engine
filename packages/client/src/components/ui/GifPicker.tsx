// ──────────────────────────────────────────────
// UI: GIF Picker — GIPHY-powered search popover
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, ImageOff, ExternalLink } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { rememberRecentMedia, useRecentMedia } from "../../hooks/use-recent-media";
import { Spinner } from "./Spinner";

interface GifResult {
  id: string;
  title: string;
  preview: string;
  url: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Container (e.g. input bar) whose top edge determines vertical placement */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Render inline to fill a parent (no portal/positioning) — e.g. inside the mobile composer sheet. */
  embedded?: boolean;
}

type GifErrorCode = "missing_giphy_api_key";
type GifFetchError = Error & { code?: GifErrorCode };

export function GifPicker({ open, onClose, onSelect, anchorRef, containerRef, embedded }: GifPickerProps) {
  const { t: localizeUi } = useUiTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<GifErrorCode | null>(null);
  const [nextPos, setNextPos] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef(false);
  const recentGifs = useRecentMedia("gif");

  // Position state for portal
  const [pos, setPos] = useState<{ bottom: number; right?: number; left?: number; maxHeight?: number }>({ bottom: 0 });

  const updatePosition = useCallback(() => {
    if (!anchorRef?.current) return;
    const btnRect = anchorRef.current.getBoundingClientRect();
    const barRect = containerRef?.current?.getBoundingClientRect();
    const pad = 8;
    const pickerWidth = 384; // w-96 = 24rem
    const pickerHeight = 416; // h-[26rem]
    const viewport = window.visualViewport;
    const vw = viewport?.width ?? window.innerWidth;
    const vh = viewport?.height ?? window.innerHeight;

    // Vertical: pin bottom edge above the input bar's top edge
    const refTop = barRect ? barRect.top : btnRect.top;
    const bottom = vh - refTop + pad;
    const maxHeight = Math.min(pickerHeight, Math.max(0, refTop - 2 * pad));
    // Horizontal: on small screens center it, on larger screens align right edge to button
    if (vw < 480) {
      const left = Math.max(8, (vw - Math.min(pickerWidth, vw - 16)) / 2);
      setPos({ bottom, left, maxHeight });
    } else {
      const right = Math.max(8, vw - btnRect.right);
      setPos({ bottom, right, maxHeight });
    }
  }, [anchorRef, containerRef]);

  useLayoutEffect(() => {
    if (!open || embedded) return;
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
  }, [embedded, open, updatePosition]);

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

  const fetchGifs = useCallback(async (q: string, pos?: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (q.trim()) params.set("q", q.trim());
      if (pos) params.set("pos", pos);
      const res = await fetch(`/api/gifs/search?${params}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        const requestError = new Error(body.error ?? "Failed to fetch GIFs") as GifFetchError;
        if (body.code === "missing_giphy_api_key") requestError.code = "missing_giphy_api_key";
        throw requestError;
      }
      const data: { results: GifResult[]; next: string } = await res.json();
      if (pos) {
        setResults((prev) => [...prev, ...data.results]);
      } else {
        setResults(data.results);
      }
      setNextPos(data.next);
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? (err as GifFetchError).code : null;
      setError(err instanceof Error ? err.message : "Failed to fetch GIFs");
      setErrorCode(code ?? null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Load trending on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setNextPos("");
      setError(null);
      setErrorCode(null);
      fetchGifs("");
    }
  }, [open, fetchGifs]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setResults([]);
      setNextPos("");
      fetchGifs(query);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, fetchGifs]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loading || !nextPos) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      fetchGifs(query, nextPos);
    }
  }, [loading, nextPos, query, fetchGifs]);

  const handleSelect = useCallback(
    (gif: GifResult) => {
      rememberRecentMedia("gif", {
        value: gif.url,
        label: gif.title,
        previewUrl: gif.preview || gif.url,
      });
      onSelect(gif.url);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleRecentSelect = useCallback(
    (value: string) => {
      const item = recentGifs.find((entry) => entry.value === value);
      if (item) rememberRecentMedia("gif", item);
      onSelect(value);
      onClose();
    },
    [onSelect, onClose, recentGifs],
  );

  if (!open) return null;

  const missingGiphyKey = errorCode === "missing_giphy_api_key";
  const setupCodeClass = "rounded bg-foreground/10 px-1 py-0.5 text-foreground/75";

  const content = (
    <>
      {/* Search */}
      <div className="border-b border-foreground/10 px-3 py-2">
        <div className="flex items-center gap-2 rounded-md bg-foreground/5 px-2.5 py-1.5 ring-1 ring-foreground/10 transition-shadow focus-within:ring-foreground/20">
          <Search size="0.875rem" className="shrink-0 text-foreground/45" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={localizeUi("ui.ui.gifpicker.searchForGifs")}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-foreground/35"
            autoFocus={!embedded}
          />
        </div>
      </div>

      {!query.trim() && recentGifs.length > 0 && (
        <section
          data-recent-media="gif"
          className="max-h-40 shrink-0 overflow-y-auto border-b border-foreground/10 px-2 py-2"
        >
          <p className="mb-1 px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-foreground/45">
            {localizeUi("ui.mediaPicker.recentlyUsed")}
          </p>
          <div className="columns-2 gap-1.5">
            {recentGifs.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => handleRecentSelect(item.value)}
                className="mb-1.5 block w-full overflow-hidden rounded-lg transition-transform hover:scale-[1.02] active:scale-100 break-inside-avoid"
                title={item.label ?? localizeUi("ui.noodle.media.tabs.gifs")}
              >
                <img
                  src={item.previewUrl ?? item.value}
                  alt={item.label ?? localizeUi("ui.noodle.media.tabs.gifs")}
                  className="w-full rounded-lg object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
          <ImageOff size="1.5rem" className="text-foreground/45" />
          {missingGiphyKey ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground/85">
                  {localizeUi("ui.ui.gifpicker.gifSearchNeedsAGiphyApiKey")}
                </p>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-foreground/55">
                  {localizeUi("ui.ui.gifpicker.createAFreeKeyPasteItInto")}{" "}
                  <code className={setupCodeClass}>GIPHY_API_KEY</code> {localizeUi("ui.ui.gifpicker.inYour")}{" "}
                  <code className={setupCodeClass}>.env</code> {localizeUi("ui.ui.gifpicker.fileThenRestartMarinara")}
                </p>
              </div>
              <ol className="space-y-1 text-left text-[0.6875rem] leading-relaxed text-foreground/55">
                <li>{localizeUi("ui.ui.gifpicker.text1OpenTheGiphyDeveloperDashboard")}</li>
                <li>{localizeUi("ui.ui.gifpicker.text2CreateAnApiKeyForAWebApp")}</li>
                <li>
                  {localizeUi("ui.ui.gifpicker.text3Add")}{" "}
                  <code className={setupCodeClass}>GIPHY_API_KEY=your_key_here</code>{" "}
                  {localizeUi("ui.noodle.wizardfooter.to")} <code className={setupCodeClass}>.env</code>.
                </li>
              </ol>
              <a
                href="https://developers.giphy.com/dashboard/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1.5 text-[0.6875rem] font-semibold text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                {localizeUi("ui.ui.gifpicker.openGiphyDashboard")}
                <ExternalLink size="0.75rem" />
              </a>
            </div>
          ) : (
            <p className="text-xs text-foreground/55">{error}</p>
          )}
        </div>
      )}

      {/* GIF grid */}
      {!error && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2" onScroll={handleScroll}>
          {results.length === 0 && !loading && (
            <p className="py-8 text-center text-xs text-foreground/45">
              {query ? localizeUi("ui.ui.gifpicker.noGifsFound") : localizeUi("ui.ui.gifpicker.loadingTrending")}
            </p>
          )}

          {/* Masonry-ish 2-column layout */}
          <div className="columns-2 gap-1.5">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => handleSelect(gif)}
                className="mb-1.5 block w-full overflow-hidden rounded-lg transition-transform hover:scale-[1.02] active:scale-100 break-inside-avoid"
                title={gif.title}
              >
                <img
                  src={gif.preview || gif.url}
                  alt={gif.title}
                  className="w-full rounded-lg object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Spinner size="lg" className="text-foreground/45" />
            </div>
          )}
        </div>
      )}

      {/* GIPHY attribution */}
      <div className="flex items-center justify-center border-t border-foreground/10 px-3 py-1.5">
        <span className="text-[0.5625rem] text-foreground/45">{localizeUi("ui.ui.gifpicker.poweredByGiphy")}</span>
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 flex-col overflow-hidden">{content}</div>;
  }

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] flex h-[26rem] w-96 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] shadow-xl"
      style={{
        bottom: pos.bottom,
        ...(pos.right != null ? { right: pos.right } : {}),
        ...(pos.left != null ? { left: pos.left } : {}),
        ...(pos.maxHeight != null ? { maxHeight: pos.maxHeight } : {}),
      }}
    >
      {content}
    </div>,
    document.body,
  );
}

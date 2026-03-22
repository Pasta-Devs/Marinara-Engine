// ──────────────────────────────────────────────
// UI: GIF Picker — GIPHY-powered search popover
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Loader2, ImageOff } from "lucide-react";

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
}

export function GifPicker({ open, onClose, onSelect, anchorRef, containerRef }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPos, setNextPos] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef(false);

  // Position state for portal
  const [pos, setPos] = useState<{ bottom: number; right?: number; left?: number }>({ bottom: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return;
    const btnRect = anchorRef.current.getBoundingClientRect();
    const barRect = containerRef?.current?.getBoundingClientRect();
    const pad = 8;
    const pickerWidth = 384; // w-96 = 24rem

    // Vertical: pin bottom edge above the input bar's top edge
    const refTop = barRect ? barRect.top : btnRect.top;
    const bottom = window.innerHeight - refTop + pad;
    // Horizontal: on small screens center it, on larger screens align right edge to button
    const vw = window.innerWidth;
    if (vw < 480) {
      const left = Math.max(8, (vw - Math.min(pickerWidth, vw - 16)) / 2);
      setPos({ bottom, left });
    } else {
      const right = Math.max(8, window.innerWidth - btnRect.right);
      setPos({ bottom, right });
    }
  }, [open, anchorRef, containerRef]);

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
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (q.trim()) params.set("q", q.trim());
      if (pos) params.set("pos", pos);
      const res = await fetch(`/api/gifs/search?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to fetch GIFs");
      }
      const data: { results: GifResult[]; next: string } = await res.json();
      if (pos) {
        setResults((prev) => [...prev, ...data.results]);
      } else {
        setResults(data.results);
      }
      setNextPos(data.next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch GIFs");
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
      onSelect(gif.url);
      onClose();
    },
    [onSelect, onClose],
  );

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] flex h-[26rem] w-96 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl"
      style={{
        bottom: pos.bottom,
        ...(pos.right != null ? { right: pos.right } : {}),
        ...(pos.left != null ? { left: pos.left } : {}),
      }}
    >
      {/* Search */}
      <div className="border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-2 rounded-md bg-[var(--secondary)] px-2.5 py-1.5">
          <Search size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for GIFs"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]/50"
            autoFocus
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <ImageOff size="1.5rem" className="text-[var(--muted-foreground)]" />
          <p className="text-xs text-[var(--muted-foreground)]">{error}</p>
        </div>
      )}

      {/* GIF grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2" onScroll={handleScroll}>
        {results.length === 0 && !loading && !error && (
          <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
            {query ? "No GIFs found" : "Loading trending..."}
          </p>
        )}

        {/* Masonry-ish 2-column layout */}
        <div className="columns-2 gap-1.5">
          {results.map((gif) => (
            <button
              key={gif.id}
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
            <Loader2 size="1.25rem" className="animate-spin text-[var(--muted-foreground)]" />
          </div>
        )}
      </div>

      {/* GIPHY attribution */}
      <div className="flex items-center justify-center border-t border-[var(--border)] px-3 py-1.5">
        <span className="text-[0.5625rem] text-[var(--muted-foreground)]/60">Powered by GIPHY</span>
      </div>
    </div>,
    document.body,
  );
}

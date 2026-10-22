// ──────────────────────────────────────────────
// PictureMenu — the picture tile's menu of a Connection or Model:
// Upload image · Choose provider logo · Use letters · Reset to default
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ImageUp, LayoutGrid, RotateCcw, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { parseConnectionIcon } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { ContextMenu } from "../ui/ContextMenu";
import { ListSearch } from "./ListFrame";
import { BRAND_MARKS, brandMarkProps } from "./ProviderIcon";
import {
  useUpdateConnection,
  useUploadConnectionAccountImage,
  useUploadConnectionImage,
} from "../../hooks/use-connections";
import { useUpdateConnectionAccount } from "../../hooks/use-connection-accounts";

/** The first letters of a name's first two words ("Open Router" → "OR"), for the letters input. */
export function defaultLetters(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words
    .slice(0, 2)
    .map((word) => [...word][0]!.toLocaleUpperCase())
    .join("");
}

/** The menu and its panels, portalled outside a dialog: a dialog lists them as its own for the focus trap. */
export const PICTURE_MENU_SELECTOR = '[role="menu"], [data-picture-menu-panel]';

type Mode = "menu" | "brands" | "letters" | "upload" | "closed";

export interface PictureMenuProps {
  /** A Connection (account) or a Model (api_connections row). */
  target: { kind: "account" | "model"; id: string };
  /** The Connection's or Model's name: the letters default to its initials. */
  name: string;
  icon?: string | null;
  imagePath?: string | null;
  /** Where to open, e.g. `menuAt(event)` from ConnectionRow. */
  at: { x: number; y: number; keyboard: boolean };
  onClose: () => void;
}

export function PictureMenu({ target, name, icon, imagePath, at, onClose }: PictureMenuProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("menu");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const updateModel = useUpdateConnection();
  const updateAccount = useUpdateConnectionAccount();
  const uploadModel = useUploadConnectionImage();
  const uploadAccount = useUploadConnectionAccountImage();
  const current = parseConnectionIcon(icon);

  useEffect(() => {
    if (mode === "closed") onClose();
  }, [mode, onClose]);

  // A dismissed file dialog fires the native "cancel" event, which React does not wire on inputs.
  useEffect(() => {
    const input = inputRef.current;
    const onCancel = () => setMode("closed");
    input?.addEventListener("cancel", onCancel);
    return () => input?.removeEventListener("cancel", onCancel);
  }, []);

  // Wait for the save before closing, so its success handlers still run; a failed save closes with a toast.
  const save = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      toast.error(t("connections.picture.failed", { error: error instanceof Error ? error.message : String(error) }));
    }
    setMode("closed");
  };
  const setIcon = (next: string | null) =>
    save(() =>
      target.kind === "model"
        ? updateModel.mutateAsync({ id: target.id, icon: next })
        : updateAccount.mutateAsync({ id: target.id, icon: next }),
    );

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return setMode("closed");
    if (!file.type.startsWith("image/")) {
      toast.error(t("connections.picture.notAnImage"));
      return setMode("closed");
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = typeof reader.result === "string" ? reader.result : "";
      if (!image) {
        toast.error(t("connections.picture.readFailed"));
        return setMode("closed");
      }
      void save(() => (target.kind === "model" ? uploadModel : uploadAccount).mutateAsync({ id: target.id, image }));
    };
    reader.onerror = () => {
      toast.error(t("connections.picture.readFailed"));
      setMode("closed");
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
      {mode === "menu" && (
        <ContextMenu
          x={at.x}
          y={at.y}
          autoFocus={at.keyboard}
          // A choice that opens a panel or the file dialog keeps the menu's owner open.
          onClose={() => setMode((value) => (value === "menu" ? "closed" : value))}
          items={[
            {
              label: t("connections.picture.upload"),
              icon: <ImageUp size="0.875rem" />,
              onSelect: () => {
                setMode("upload");
                inputRef.current?.click();
              },
            },
            {
              label: t("connections.picture.chooseLogo"),
              icon: <LayoutGrid size="0.875rem" />,
              onSelect: () => setMode("brands"),
            },
            {
              label: t("connections.picture.useLetters"),
              icon: <Type size="0.875rem" />,
              onSelect: () => setMode("letters"),
            },
            {
              label: t("connections.picture.reset"),
              icon: <RotateCcw size="0.875rem" />,
              disabled: !icon && !imagePath,
              onSelect: () => void setIcon(null),
            },
          ]}
        />
      )}
      {mode === "brands" && (
        <Panel at={at} onClose={() => setMode("closed")}>
          <BrandGrid
            selected={current?.kind === "brand" ? current.key : null}
            onPick={(key) => setIcon(`brand:${key}`)}
          />
        </Panel>
      )}
      {mode === "letters" && (
        <Panel at={at} onClose={() => setMode("closed")}>
          <LettersForm
            initial={current?.kind === "letters" ? current.text : defaultLetters(name)}
            onSave={(text) => setIcon(`letters:${text}`)}
          />
        </Panel>
      )}
    </>
  );
}

/** A small portalled panel at (x, y), kept inside the viewport; closes on outside click and Escape. */
function Panel({ at, onClose, children }: { at: PictureMenuProps["at"]; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [pos, setPos] = useState({ left: at.x, top: at.y });

  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      left: Math.max(4, Math.min(at.x, window.innerWidth - rect.width - 4)),
      top: Math.max(4, Math.min(at.y, window.innerHeight - rect.height - 4)),
    });
  }, [at.x, at.y]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) closeRef.current();
    };
    // Captured before React's listeners, so Escape closes only this menu, not the panel under it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // A logo search with text clears first; ListSearch takes that Escape.
      if (event.target instanceof HTMLInputElement && event.target.type === "search" && event.target.value) return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
    };
    const raf = requestAnimationFrame(() => document.addEventListener("mousedown", onDown));
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      previous?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      data-picture-menu-panel
      // Above a modal (z 10000): the menu also opens from the connection editor.
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 10001 }}
      className="w-[min(16rem,calc(100vw-0.5rem))] rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 shadow-xl animate-fade-in-up"
      // The panel is portalled, but React events still bubble to the row under it.
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

function BrandGrid({ selected, onPick }: { selected: string | null; onPick: (key: string) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const keys = Object.keys(BRAND_MARKS).filter((key) => key.includes(q));
  return (
    <>
      <ListSearch
        autoFocus
        className="mb-2"
        value={query}
        onChange={setQuery}
        label={t("connections.picture.searchLogos")}
        placeholder={t("connections.picture.searchLogos")}
      />
      {keys.length ? (
        <div className="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              title={key}
              aria-label={key}
              aria-pressed={key === selected}
              onClick={() => onPick(key)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-[var(--foreground)] outline-none hover:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                key === selected && "bg-[var(--accent)] ring-1 ring-[var(--primary)]",
              )}
            >
              <span aria-hidden className="brand-mark h-5 w-5" {...brandMarkProps(key, BRAND_MARKS[key]!)} />
            </button>
          ))}
        </div>
      ) : (
        <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">{t("connections.picture.noLogos")}</p>
      )}
    </>
  );
}

function LettersForm({ initial, onSave }: { initial: string; onSave: (text: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const valid = parseConnectionIcon(`letters:${text}`) !== null;
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave(text.trim());
      }}
    >
      <label className="sr-only" htmlFor="picture-menu-letters">
        {t("connections.picture.letters")}
      </label>
      <input
        id="picture-menu-letters"
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={16}
        aria-describedby="picture-menu-letters-hint"
        aria-invalid={!valid}
        className="mari-chrome-field h-9 w-14 px-2 text-center text-sm font-semibold"
      />
      <span id="picture-menu-letters-hint" className="min-w-0 flex-1 text-[0.6875rem] text-[var(--muted-foreground)]">
        {t("connections.picture.lettersHint")}
      </span>
      <button type="submit" disabled={!valid} className="mari-connection-btn mari-connection-btn--primary">
        {t("connections.picture.saveLetters")}
      </button>
    </form>
  );
}

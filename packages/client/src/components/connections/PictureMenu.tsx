// ──────────────────────────────────────────────
// PictureMenu — the picture tile's menu of a Connection or Model:
// Upload image · Choose provider logo · Use letters · Reset to default
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImageUp, LayoutGrid, RotateCcw, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { parseConnectionIcon } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { ContextMenu } from "../ui/ContextMenu";
import { Modal } from "../ui/Modal";
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
        <Modal
          open
          title={t("connections.picture.chooseLogo")}
          onClose={() => setMode("closed")}
          width="max-w-sm"
          opaque
        >
          <div data-picture-menu-panel onClick={(event) => event.stopPropagation()}>
            <BrandGrid
              selected={current?.kind === "brand" ? current.key : null}
              onPick={(key) => setIcon(`brand:${key}`)}
            />
          </div>
        </Modal>
      )}
      {mode === "letters" && (
        <Modal
          open
          title={t("connections.picture.useLetters")}
          onClose={() => setMode("closed")}
          width="max-w-sm"
          opaque
        >
          <div data-picture-menu-panel onClick={(event) => event.stopPropagation()}>
            <LettersForm
              initial={current?.kind === "letters" ? current.text : defaultLetters(name)}
              onSave={(text) => setIcon(`letters:${text}`)}
            />
          </div>
        </Modal>
      )}
    </>
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
        aria-invalid={!valid}
        className="mari-chrome-field h-9 w-14 px-2 text-center text-sm font-semibold"
      />
      <button type="submit" disabled={!valid} className="mari-chrome-control mari-chrome-control--primary">
        {t("connections.picture.saveLetters")}
      </button>
    </form>
  );
}

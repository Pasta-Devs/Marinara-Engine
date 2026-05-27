import { useEffect } from "react";
import { Toaster } from "sonner";
import { AppShell } from "./shell/AppShell";
import { ModalRenderer } from "./shell/ModalRenderer";
import { CustomThemeInjector } from "./providers/CustomThemeInjector";
import { AppDialogRenderer } from "../shared/components/ui/AppDialogRenderer";
import { ChibiProfessorMariEasterEgg } from "../shared/components/ui/ChibiProfessorMariEasterEgg";
import { fontsApi } from "../shared/api/settings-assets-api";
import { fontFileUrlFromPath } from "../shared/api/local-file-api";
import { useUIStore } from "../shared/stores/ui.store";
import { useChatSwitchEffects } from "./startup/chat-switch-effects";
import { installRangeSliderSync } from "./startup/range-slider-sync";

function stripFontFamilyQuotes(family: string): string {
  const trimmed = family.trim();
  if (trimmed.length < 2) return trimmed;

  const quote = trimmed[0];
  if ((quote !== `"` && quote !== `'`) || trimmed[trimmed.length - 1] !== quote) {
    return trimmed;
  }

  return trimmed.slice(1, -1).trim();
}

function toCssFontFamilyValue(family: string): string {
  const cleanFamily = stripFontFamilyQuotes(family);
  return `"${cleanFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

type CustomFontFace = {
  filename: string;
  family: string;
  url?: string;
  absolutePath?: string;
  weight?: string;
  style?: string;
  unicodeRange?: string | null;
};

export function App() {
  const theme = useUIStore((s) => s.theme);
  const fontSize = useUIStore((s) => s.fontSize);
  const language = useUIStore((s) => s.language);
  const visualTheme = useUIStore((s) => s.visualTheme);
  const fontFamily = useUIStore((s) => s.fontFamily);

  useChatSwitchEffects();

  useEffect(() => installRangeSliderSync(), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (visualTheme && visualTheme !== "default") {
      document.documentElement.dataset.visualTheme = visualTheme;
    } else {
      delete document.documentElement.dataset.visualTheme;
    }
  }, [visualTheme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const family = fontFamily ? stripFontFamilyQuotes(fontFamily) : "";
    if (family) {
      document.documentElement.style.setProperty("--font-user", toCssFontFamilyValue(family));
    } else {
      document.documentElement.style.removeProperty("--font-user");
    }
  }, [fontFamily]);

  useEffect(() => {
    let cancelled = false;

    const loadFonts = () => {
      fontsApi
        .list<CustomFontFace[]>()
        .then((fonts) => {
        if (cancelled) return;
        const css = fonts
          .map((font) => {
            const source = fontFileUrlFromPath(font.filename, font.absolutePath) || font.url;
            if (!source || !font.family) return "";
            const unicodeRange = font.unicodeRange ? `  unicode-range: ${font.unicodeRange};\n` : "";
            return `@font-face {\n  font-family: "${font.family.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}";\n  src: url("${source}") format("${font.filename.endsWith(".woff2") ? "woff2" : font.filename.endsWith(".woff") ? "woff" : font.filename.endsWith(".otf") ? "opentype" : "truetype"}");\n  font-weight: ${font.weight ?? "400"};\n  font-style: ${font.style ?? "normal"};\n  font-display: swap;\n${unicodeRange}}`;
          })
          .filter(Boolean)
          .join("\n");
        let style = document.getElementById("marinara-custom-fonts") as HTMLStyleElement | null;
        if (!style) {
          style = document.createElement("style");
          style.id = "marinara-custom-fonts";
          document.head.appendChild(style);
        }
        style.textContent = css;
        })
        .catch(() => {});
    };

    loadFonts();
    window.addEventListener("marinara-fonts-updated", loadFonts);
    return () => {
      cancelled = true;
      window.removeEventListener("marinara-fonts-updated", loadFonts);
    };
  }, []);

  return (
    <>
      <CustomThemeInjector />
      <AppShell />
      <ModalRenderer />
      <AppDialogRenderer />
      <ChibiProfessorMariEasterEgg />
      <Toaster
        position="bottom-right"
        theme={theme}
        closeButton
        toastOptions={{
          style: {
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            userSelect: "text",
            WebkitUserSelect: "text",
          },
        }}
      />
    </>
  );
}

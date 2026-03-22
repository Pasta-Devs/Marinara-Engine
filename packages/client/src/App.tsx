// ──────────────────────────────────────────────
// App: Root component with layout
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "./components/layout/AppShell";
import { ModalRenderer } from "./components/layout/ModalRenderer";
import { CustomThemeInjector } from "./components/layout/CustomThemeInjector";
import { Toaster } from "sonner";
import { useUIStore } from "./stores/ui.store";
import { api } from "./lib/api-client";

export function App() {
  const theme = useUIStore((s) => s.theme);
  const fontSize = useUIStore((s) => s.fontSize);
  const visualTheme = useUIStore((s) => s.visualTheme);
  const fontFamily = useUIStore((s) => s.fontFamily);

  // Apply theme + font size to the document root whenever they change
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // Apply visual theme (default / sillytavern) to the document root
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

  // Apply custom font family via CSS variable
  useEffect(() => {
    if (fontFamily) {
      document.documentElement.style.setProperty("--font-user", `"${fontFamily}"`);
    } else {
      document.documentElement.style.removeProperty("--font-user");
    }
  }, [fontFamily]);

  // Pre-load custom fonts at startup so switching to Appearance tab doesn't cause a flash
  const { data: customFonts } = useQuery<{ filename: string; family: string; url: string }[]>({
    queryKey: ["custom-fonts"],
    queryFn: () => api.get("/fonts"),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!customFonts?.length) return;

    // Prefer FontFace API over injecting CSS into a <style> tag to avoid CSS injection
    if (typeof FontFace === "undefined" || !document.fonts) {
      return;
    }

    customFonts.forEach((f) => {
      if (!f.family || !f.url) {
        return;
      }

      try {
        const fontFace = new FontFace(f.family, `url("${f.url}")`, {
          display: "swap",
        });

        fontFace
          .load()
          .then((loadedFace) => {
            document.fonts.add(loadedFace);
          })
          .catch(() => {
            // Ignore individual font load errors to avoid breaking others
          });
      } catch {
        // Ignore construction errors for invalid font definitions
      }
    });
  }, [customFonts]);

  return (
    <>
      <CustomThemeInjector />
      <AppShell />
      <ModalRenderer />
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

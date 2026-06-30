// ──────────────────────────────────────────────
// Hooks: Synced Custom Themes
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import type { CreateThemeInput, Theme, UpdateThemeInput } from "@marinara-engine/shared";

export const themeKeys = {
  all: ["themes"] as const,
  list: () => [...themeKeys.all, "list"] as const,
};

export function findDuplicateTheme(themes: Theme[], name: string, css: string) {
  return themes.find((theme) => theme.name === name && theme.css === css) ?? null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isPermanentThemeMigrationError(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  );
}

function isTransientThemeMigrationError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 408 || error.status === 429 || error.status >= 500)
  );
}

/**
 * POST one legacy theme with the same bounded retry behavior used by extension
 * migration, so rate limits and temporary server errors do not make migration
 * fail immediately.
 */
async function postThemeWithBackoff(input: CreateThemeInput): Promise<Theme> {
  const MAX_ATTEMPTS = 6;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await api.post<Theme>("/themes", input);
    } catch (err) {
      lastError = err;
      if (!isTransientThemeMigrationError(err)) throw err;
      const delay = Math.min(60_000, 2 ** attempt * 1_000);
      await sleep(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Theme migration failed after retries");
}

export function useThemes() {
  return useQuery({
    queryKey: themeKeys.list(),
    queryFn: () => api.get<Theme[]>("/themes"),
    staleTime: 5 * 60_000,
    refetchOnReconnect: true,
  });
}

export function useCreateTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateThemeInput) => api.post<Theme>("/themes", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.all });
    },
  });
}

export function useUpdateTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateThemeInput) => api.patch<Theme>(`/themes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.all });
    },
  });
}

export function useDeleteTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/themes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.all });
    },
  });
}

export function useSetActiveTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | null) => api.put<Theme | null>("/themes/active", { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: themeKeys.all });
    },
  });
}

export function useLegacyThemeMigration() {
  const legacyThemes = useUIStore((s) => s.customThemes);
  const legacyActiveCustomTheme = useUIStore((s) => s.activeCustomTheme);
  const hasMigratedCustomThemesToServer = useUIStore((s) => s.hasMigratedCustomThemesToServer);
  const clearLegacyCustomThemes = useUIStore((s) => s.clearLegacyCustomThemes);
  const setHasMigratedCustomThemesToServer = useUIStore((s) => s.setHasMigratedCustomThemesToServer);
  const qc = useQueryClient();
  const inFlightRef = useRef(false);
  const { data: serverThemes, isSuccess } = useThemes();

  useEffect(() => {
    if (hasMigratedCustomThemesToServer || !isSuccess || inFlightRef.current) {
      return;
    }
    if (legacyThemes.length === 0) {
      setHasMigratedCustomThemesToServer(true);
      return;
    }

    inFlightRef.current = true;
    void (async () => {
      try {
        const serverAlreadyHasActiveTheme = (serverThemes ?? []).some((theme) => theme.isActive);
        let workingThemes = [...(serverThemes ?? [])];
        let migratedActiveThemeId: string | null = null;
        const skippedThemes: string[] = [];

        for (const legacyTheme of legacyThemes) {
          const legacyName = legacyTheme.name.trim();
          if (!legacyName) {
            skippedThemes.push("(unnamed theme)");
            console.warn("[Themes] Skipping legacy custom theme with an empty name during migration.", legacyTheme);
            continue;
          }

          let syncedTheme = findDuplicateTheme(workingThemes, legacyName, legacyTheme.css);
          if (!syncedTheme) {
            try {
              syncedTheme = await postThemeWithBackoff({
                name: legacyName,
                css: legacyTheme.css,
                installedAt: legacyTheme.installedAt,
              });
            } catch (err) {
              if (!isPermanentThemeMigrationError(err)) throw err;
              skippedThemes.push(legacyName);
              console.warn("[Themes] Skipping rejected legacy custom theme during migration:", legacyName, err);
              continue;
            }
            workingThemes = [syncedTheme, ...workingThemes];
          }

          if (!serverAlreadyHasActiveTheme && legacyActiveCustomTheme === legacyTheme.id) {
            migratedActiveThemeId = syncedTheme.id;
          }
        }

        if (migratedActiveThemeId) {
          await api.put<Theme | null>("/themes/active", { id: migratedActiveThemeId });
        }

        clearLegacyCustomThemes();
        setHasMigratedCustomThemesToServer(true);
        if (skippedThemes.length > 0) {
          toast.warning(
            `Skipped ${skippedThemes.length} legacy custom theme${skippedThemes.length === 1 ? "" : "s"} during migration. Check the browser console for details.`,
          );
        }
        await qc.invalidateQueries({ queryKey: themeKeys.all });
      } catch (err) {
        console.warn("[Themes] Legacy custom theme migration failed; will retry on the next app start.", err);
        toast.warning("Legacy theme migration paused. It will retry the next time Marinara starts.");
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [
    clearLegacyCustomThemes,
    hasMigratedCustomThemesToServer,
    isSuccess,
    legacyActiveCustomTheme,
    legacyThemes,
    qc,
    serverThemes,
    setHasMigratedCustomThemesToServer,
  ]);
}

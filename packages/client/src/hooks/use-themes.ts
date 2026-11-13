// ──────────────────────────────────────────────
// Hooks: Synced Custom Themes
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api-client";
import { useUIStore } from "../stores/ui.store";
import { useDeviceLookStore } from "../stores/device-look.store";
import { useThemeSafetyStore } from "../lib/theme-safety";
import type { CreateThemeInput, Theme, ThemeSettings, UpdateThemeInput } from "@marinara-engine/shared";
import {
  applyThemeSettings,
  putBackOwnLook,
  snapshotThemeSettings,
  themeSettingKeys,
  type ThemeSettingKey,
} from "../lib/theme-package";

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
  return error instanceof ApiError && (error.status === 408 || error.status === 429 || error.status >= 500);
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
  // A device with its own look marks its own pick as the active theme (see device-look.store).
  const deviceLook = useDeviceLookStore((s) => s.enabled);
  const deviceThemeId = useDeviceLookStore((s) => s.customThemeId);
  const select = useCallback(
    (themes: Theme[]) =>
      deviceLook && deviceThemeId !== undefined
        ? themes.map((theme) => ({ ...theme, isActive: theme.id === deviceThemeId }))
        : themes,
    [deviceLook, deviceThemeId],
  );
  return useQuery({
    queryKey: themeKeys.list(),
    queryFn: () => api.get<Theme[]>("/themes"),
    staleTime: 5 * 60_000,
    refetchOnReconnect: true,
    select,
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
    mutationFn: async (id: string | null) => {
      // This device has its own look: pick the theme here only, and leave every other device alone.
      if (useDeviceLookStore.getState().enabled) {
        useDeviceLookStore.getState().setCustomThemeId(id);
        return null;
      }
      return api.put<Theme | null>("/themes/active", { id });
    },
    onSuccess: (_result, id) => {
      // Mark the new pick active in the cached list straight away. Without this, pressing Keep
      // ends the try while the list still names the old theme as active, so the old theme flashes
      // back for a moment until the refetch lands (the device-look path already updates in place).
      if (!useDeviceLookStore.getState().enabled) {
        qc.setQueryData<Theme[]>(themeKeys.list(), (themes) =>
          themes?.map((theme) =>
            theme.isActive === (theme.id === id) ? theme : { ...theme, isActive: theme.id === id },
          ),
        );
      }
      qc.invalidateQueries({ queryKey: themeKeys.all });
    },
  });
}

/**
 * Switch to a theme the way the Theme Library does: on success, ask "Keep this theme?" and go back
 * to the previous one after 15 seconds unless the person keeps it (lib/theme-safety.ts).
 * Switching to Default (null) never asks.
 */
export function useActivateTheme() {
  const setActiveTheme = useSetActiveTheme();
  const qc = useQueryClient();
  return useCallback(
    /**
     * Switches to `theme` (null = Default Theme). `apply` holds the Appearance settings the theme
     * brings (a starter theme's suggestions, or the ones picked when installing).
     *
     * Consistency audit batch 1: the theme being replaced comes off cleanly first. Its settings go
     * back to the person's own (lib/theme-package.ts putBackOwnLook), then the new theme's go on,
     * and the person's own values for those are saved so switching this one off later puts them back.
     */
    async (
      theme: Pick<Theme, "id" | "name"> | null,
      apply?: { settings: ThemeSettings; keys: ThemeSettingKey[] } | null,
    ) => {
      const themes = qc.getQueryData<Theme[]>(themeKeys.list()) ?? [];
      const device = useDeviceLookStore.getState();
      const previousId =
        device.enabled && device.customThemeId !== undefined
          ? device.customThemeId
          : (themes.find((item) => item.isActive)?.id ?? null);
      // Round 6: trying another theme while the last one still asks "Keep this theme?" chains the
      // tries. Going back then returns to the theme and settings from before the first try (the
      // last ones the person kept), not to the untried theme in between.
      const waiting = useThemeSafetyStore.getState().pendingKeep;
      const chained = waiting && waiting.themeId !== previousId ? waiting : null;
      const showing = chained ? chained.themeId : previousId;
      if ((theme?.id ?? null) === showing) return;
      const backTo = chained ? chained.previousId : previousId;
      // Security audit: trying a theme happens in this tab only. Other devices (and anyone else on
      // the network) only get it once the person presses Keep (ThemeSafetyHost); closing the tab
      // before that leaves every other device as it was. Default (null) applies at once.
      if (!theme) await setActiveTheme.mutateAsync(null);
      const ui = useUIStore.getState();
      // Undo the untried theme first, so everything below starts from the look the person kept.
      if (chained) {
        if (chained.restoreSettings?.keys.length)
          applyThemeSettings(
            chained.restoreSettings.settings as ThemeSettings,
            chained.restoreSettings.keys as ThemeSettingKey[],
          );
        if (chained.previousOwnLook !== undefined) ui.setThemeOwnLook(chained.previousOwnLook);
      }
      const safetyNow = useThemeSafetyStore.getState();
      // Picking the kept theme again while another is being tried is the same as Go back.
      if (chained && theme && theme.id === backTo) {
        safetyNow.settleKeep();
        return;
      }
      const keptTheme = backTo ? (themes.find((item) => item.id === backTo) ?? null) : null;
      const ownBefore = useUIStore.getState().themeOwnLook;
      const applyKeys = theme && apply ? apply.keys : [];
      // What Go back puts back: the kept look as it is right now.
      const touched = new Set<ThemeSettingKey>([...((ownBefore?.keys ?? []) as ThemeSettingKey[]), ...applyKeys]);
      if (keptTheme?.builtIn) for (const key of themeSettingKeys(keptTheme.meta?.settings)) touched.add(key);
      const restore = theme && touched.size ? snapshotThemeSettings([...touched]) : null;
      putBackOwnLook(keptTheme);
      if (theme && apply && applyKeys.length) {
        const own = snapshotThemeSettings(applyKeys);
        applyThemeSettings(apply.settings, applyKeys);
        useUIStore.getState().setThemeOwnLook(own as { settings: Record<string, unknown>; keys: string[] });
      }
      const safety = useThemeSafetyStore.getState();
      if (theme && safety.blockedThemeId === theme.id) safety.clearBlockedTheme();
      if (theme && safety.safeMode) safety.leaveSafeMode();
      if (theme)
        safety.askToKeep({
          themeId: theme.id,
          themeName: theme.name,
          previousId: backTo,
          restoreSettings: restore as { settings: Record<string, unknown>; keys: string[] } | null,
          previousOwnLook: ownBefore,
        });
      else safety.settleKeep();
    },
    [qc, setActiveTheme],
  );
}

/**
 * Professor Mari turned a theme on (theme.setActive, or a create with activate). Her change lands on the
 * server, so every device would get it with no "Keep this theme?". Put the server back to the theme from
 * before, then try hers in this tab the way the Theme Library does: Keep makes it real everywhere, and no
 * answer goes back after 15 seconds. Switching to Default never asks. A device with its own look ignores
 * server picks, so there is nothing to undo there.
 */
export function useTryThemeSwitchedByMari() {
  const qc = useQueryClient();
  const activate = useActivateTheme();
  return useCallback(
    async (previousId: string | null) => {
      if (useDeviceLookStore.getState().enabled) return;
      const themes = await qc.fetchQuery({
        queryKey: themeKeys.list(),
        queryFn: () => api.get<Theme[]>("/themes"),
        staleTime: 0,
      });
      const now = themes.find((theme) => theme.isActive) ?? null;
      if (!now || now.id === previousId) return;
      await api.put<Theme | null>("/themes/active", { id: previousId });
      qc.setQueryData<Theme[]>(themeKeys.list(), (list) =>
        list?.map((theme) => ({ ...theme, isActive: theme.id === previousId })),
      );
      await activate(now);
    },
    [activate, qc],
  );
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

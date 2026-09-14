// Forward-compatibility path for a game-surface package whose manifest declares NO
// `contributions.gameSurface.setup`. Such a package still owns its whole setup form, so the host hands the
// wizard body over to it exactly as it did before the setup seam: this is the pre-seam behaviour, kept
// verbatim so an installed pre-seam package (Pixelforge 0.16.6) still gets its own setup form and launches
// the same world as before, instead of silently starting a game whose config the wizard never collected.
//
// Deletable, whole, once every installed game-surface package declares `setup`. Nothing else depends on it:
// the seam path never mounts this file. No package is named here — the fallback keys off the ABSENCE of a
// declared `setup` block, never off a package id or version.
import { useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_CLOSE_ICON_SIZE,
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import { useCreateGame, useGameSetup } from "../../hooks/use-game";
import { selectGameExperiencePackages, useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { type InstalledCapabilityPackage } from "@marinara-engine/shared";
import { characterKeys } from "../../hooks/use-characters";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { useTranslation as useUiTranslation } from "react-i18next";

export function LegacyExperienceSetupDialog({
  experience,
  activeChatId,
  onCancelSetup,
  onDeselect,
  onSetupError,
}: {
  /** The activated experience, resolved by the wizard from the installed list. */
  experience: InstalledCapabilityPackage;
  activeChatId: string;
  /** Same dismissal the built-in wizard uses, so closing this setup behaves identically. */
  onCancelSetup: () => void;
  /** Turns the experience back off, which returns the player to the built-in wizard. */
  onDeselect: () => void;
  /** Offered a launch failure before it reaches the package. Returns true when the host took it over —
   *  a malformed-JSON response the player can repair, which the built-in wizard also surfaces. */
  onSetupError: (error: unknown) => boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();

  const { data: installed } = useInstalledCapabilityPackages(true);
  const createGame = useCreateGame();
  const gameSetup = useGameSetup();

  // The same helper the wizard offers the experience by, so this dialog can never mount a surface the
  // wizard would not have offered. Undefined while the list has not arrived, which is NOT the same as an
  // empty list: the wizard already read this query to offer the toggle, so an undefined read here means a
  // cache that has not settled, not a package that went away.
  const experiences = useMemo(() => (installed ? selectGameExperiencePackages(installed) : null), [installed]);
  const activeExperience = experiences?.find((e) => e.id === experience.id) ?? null;
  // Freezes every control that could tear down the run mid-launch: flipping the experience off here
  // would create a game under one mode and set it up as another. The wizard's `isLoading` equivalent.
  const launching = createGame.isPending || gameSetup.isPending;
  // Resolved, not remembered: the package can be uninstalled while this panel is open, and a stale id
  // would mount a surface that no longer exists. Pinned while launching, so a refetch of the installed
  // list cannot unmount the setup that is currently running, and pinned until the list arrives, so a
  // pending read cannot close the dialog the frame it opens.
  const selectedId = activeExperience?.id ?? (launching || !experiences ? experience.id : null);

  // Uninstalled mid-setup: hand the player back to the built-in wizard rather than leaving an empty
  // dialog up. Pre-seam this fell out of the chooser's early return; the dialog now lives above the
  // wizard instead of inside it, so the same recovery has to be asked for.
  useEffect(() => {
    if (!selectedId) onDeselect();
  }, [selectedId, onDeselect]);

  // Escape closes the package's setup, matching the backdrop click and the wizard this panel replaces.
  useEffect(() => {
    if (!selectedId || launching) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancelSetup();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, launching, onCancelSetup]);

  // The package prepares the config; the host creates the game and runs the opening, since it owns
  // navigation and the query cache. The experience must supply the connection — guessing one here would
  // duplicate the eligibility rules that live in the setup wizard.
  const onLaunch = useCallback(
    async (
      setupConfig: unknown,
      gameName: string,
      _config?: unknown,
      connections?: { gmConnectionId?: string | null },
    ) => {
      const connectionId = connections?.gmConnectionId;
      if (!connectionId) throw new Error("The experience must provide a gmConnectionId to launch a game");
      // The config is built by the package, so it is read defensively: a null or non-object return would
      // otherwise throw on property access here instead of failing validation with a usable message.
      const cfg: Record<string, unknown> =
        typeof setupConfig === "object" && setupConfig !== null ? (setupConfig as Record<string, unknown>) : {};
      const promptPresetId = typeof cfg.promptPresetId === "string" ? cfg.promptPresetId : undefined;
      if (!selectedId) throw new Error("Choose an installed experience before launching the game");
      try {
        // Stamps which experience owns this game; /game/create copies it to the chat metadata.
        const res = await createGame.mutateAsync({
          name: gameName,
          setupConfig: {
            ...cfg,
            gameExperienceId: selectedId,
            // The host validates the fields it needs above and preserves the package-owned payload here.
            // Keeping the opaque config nested prevents Zod from stripping unknown experience fields.
            experienceConfig: cfg.experienceConfig ?? cfg,
          } as unknown,
          preferences: "",
          chatId: activeChatId,
          connectionId,
          promptPresetId,
        } as Parameters<typeof createGame.mutateAsync>[0]);
        const chatId = res.sessionChat.id;
        try {
          await gameSetup.mutateAsync({
            chatId,
            connectionId,
            preferences: "",
            promptPresetId: promptPresetId ?? null,
          } as Parameters<typeof gameSetup.mutateAsync>[0]);
        } catch (error) {
          // The opening generation can come back as malformed JSON the player is able to repair, and the
          // built-in wizard offers that repair — so an experience's setup has to reach it too, or the
          // same failure is recoverable in one path and a dead end in the other. Rethrown either way:
          // the launch did fail, and the package still has to unwind its own setup.
          onSetupError(error);
          throw error;
        }
        // An experience that keeps its own state needs the chat id to seed itself.
        return chatId;
      } finally {
        // Wraps BOTH steps: the package may have written the player persona and a lorebook before it
        // ever called us, so a failure at either one still leaves records the client knows nothing
        // about. `.all`, since the lists are also cached per category.
        queryClient.invalidateQueries({ queryKey: characterKeys.personas });
        queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
      }
    },
    [activeChatId, selectedId, createGame, gameSetup, onSetupError, queryClient],
  );

  if (!selectedId) return null;

  // The package draws the wizard body inside the same shell the built-in one uses.
  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/45 backdrop-blur-[2px]"
        onClick={launching ? undefined : onCancelSetup}
      />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3 pointer-events-none max-md:pt-[max(0.75rem,env(safe-area-inset-top))] max-md:pb-[max(0.75rem,var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] sm:p-4">
        {/* NEUTRAL_PANEL_SHELL remaps the theme tokens to the chrome palette inside the panel, the same
            way the built-in wizard does. Without it the package's setup comes out tinted. */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-experience-setup-title"
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            NEUTRAL_PANEL_SHELL,
            "pointer-events-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden sm:max-h-[min(90dvh,44rem)]",
          )}
        >
          <div className={cn(NEUTRAL_PANEL_HEADER, "flex shrink-0 items-center justify-between")}>
            <h3 id="game-experience-setup-title" className={NEUTRAL_PANEL_TITLE}>
              {(activeExperience ?? experience).manifest.name || localizeUi("navigation.chatSidebar.new.game")}
            </h3>
            <button
              type="button"
              onClick={onCancelSetup}
              disabled={launching}
              className={cn(NEUTRAL_PANEL_CLOSE_BUTTON, "disabled:cursor-wait disabled:opacity-40")}
              aria-label={localizeUi("ui.game.gamesetupwizard.closeSetup")}
            >
              <X size={NEUTRAL_PANEL_CLOSE_ICON_SIZE} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <CapabilityElement
              packageId={selectedId}
              view="setup"
              capabilityProps={{
                chatId: activeChatId,
                onLaunch,
                onCancel: () => {
                  if (!launching) onDeselect();
                },
              }}
            />
          </div>
        </motion.div>
      </div>
    </>
  );
}

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { isModalOverlayOpen } from "../../lib/modal-overlay-registry";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_CLOSE_ICON_SIZE,
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import { useCreateGame, useGameSetup } from "../../hooks/use-game";
import type { InstalledCapabilityPackage } from "@marinara-engine/shared";
import { characterKeys } from "../../hooks/use-characters";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { useTranslation as useUiTranslation } from "react-i18next";

// Same treatment the wizard gives its own "import setup" button, so the block reads as part of the step.
const SECONDARY_BUTTON =
  "flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:cursor-wait disabled:opacity-50";

/** Compatibility path for packages that still own their complete setup form. */
export function LegacyExperienceSetupDialog({
  activeChatId,
  experience,
  onCancelSetup,
  onSetupError,
  onBack,
  restoreFocusRef,
}: {
  activeChatId: string;
  experience: InstalledCapabilityPackage;
  onCancelSetup: () => void;
  onSetupError: (error: unknown) => boolean;
  onBack: () => void;
  restoreFocusRef: RefObject<HTMLElement | null>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocusScope(true, panelRef, undefined, restoreFocusRef);
  const queryClient = useQueryClient();
  const createGame = useCreateGame();
  const gameSetup = useGameSetup();
  const launching = createGame.isPending || gameSetup.isPending;
  const selectedId = experience.id;
  // Escape closes the package's setup, matching the backdrop click and the wizard this panel replaces.
  // A stacked `Modal` — the malformed-JSON repair dialog `GameSurface` mounts beside setup — takes the
  // press first from its own `document` listener without stopping propagation, so stand down while one
  // is open or a single press would dismiss both it and the setup behind it.
  useEffect(() => {
    if (!selectedId || launching) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isModalOverlayOpen()) return;
      onCancelSetup();
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
      try {
        const connectionId = connections?.gmConnectionId;
        if (!connectionId) throw new Error("The experience must provide a gmConnectionId to launch a game");
        // The config is built by the package, so it is read defensively: a null or non-object return would
        // otherwise throw on property access here instead of failing validation with a usable message.
        const cfg: Record<string, unknown> =
          typeof setupConfig === "object" && setupConfig !== null ? (setupConfig as Record<string, unknown>) : {};
        const promptPresetId = typeof cfg.promptPresetId === "string" ? cfg.promptPresetId : undefined;
        if (!selectedId) throw new Error("Choose an installed experience before launching the game");
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

  // Activated → the package draws the wizard body inside the same shell the built-in one uses, with the
  // block kept above it so the player can switch back.
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
          ref={panelRef}
          tabIndex={-1}
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
              {experience.manifest.name ?? localizeUi("navigation.chatSidebar.new.game")}
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
            <button type="button" className={SECONDARY_BUTTON} disabled={launching} onClick={onBack}>
              {localizeUi("navigation.common.back")}
            </button>
            <CapabilityElement
              packageId={selectedId}
              view="setup"
              capabilityProps={{
                chatId: activeChatId,
                onLaunch,
                onCancel: () => {
                  if (!launching) onBack();
                },
              }}
            />
          </div>
        </motion.div>
      </div>
    </>
  );
}

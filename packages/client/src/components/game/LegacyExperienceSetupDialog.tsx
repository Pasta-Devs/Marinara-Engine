import { useCallback, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../ui/Modal";
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
  const queryClient = useQueryClient();
  const createGame = useCreateGame();
  const gameSetup = useGameSetup();
  const launching = createGame.isPending || gameSetup.isPending;
  const selectedId = experience.id;
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
    <Modal
      open
      onClose={onCancelSetup}
      title={experience.manifest.name ?? localizeUi("navigation.chatSidebar.new.game")}
      width="max-w-lg"
      restoreFocusRef={restoreFocusRef}
      closeDisabled={launching}
    >
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
    </Modal>
  );
}

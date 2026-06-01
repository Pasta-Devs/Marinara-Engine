import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { runGenerationWithUi, useGenerate, type GenerateArgs } from "../../../runtime/generation/index";
import { startGameTurnGeneration, type StartGameTurnInput } from "../../../../engine/modes/game/turn/game-turn.service";
import { llmApi } from "../../../../shared/api/llm-api";
import { storageApi } from "../../../../shared/api/storage-api";
import { integrationGateway } from "../../../../shared/api/integration-gateway";

type StreamEvent = { type: string; data?: unknown };

export type GenerateGameTurnArgs = GenerateArgs & StartGameTurnInput;

export function useGameGeneration() {
  const queryClient = useQueryClient();
  const { retryAgents } = useGenerate();

  const generateGameTurn = useCallback(
    (args: GenerateGameTurnArgs): Promise<boolean> =>
      runGenerationWithUi(
        queryClient,
        args,
        (streamArgs, signal) =>
          startGameTurnGeneration(
            { storage: storageApi, llm: llmApi, integrations: integrationGateway },
            streamArgs as GenerateGameTurnArgs,
            signal,
          ) as AsyncGenerator<StreamEvent>,
      ),
    [queryClient],
  );

  return { generateGameTurn, retryAgents };
}

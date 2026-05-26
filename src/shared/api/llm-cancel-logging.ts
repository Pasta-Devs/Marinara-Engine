type LlmStreamCancelTransport = "remote" | "tauri";

type CancelErrorDetails = {
  name?: string;
  message: string;
  status?: number;
};

type CancelFailureLog = {
  area: "llm-stream-cancel";
  transport: LlmStreamCancelTransport;
  streamId: string;
  error: CancelErrorDetails;
};

function statusFrom(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && Number.isFinite(status) ? status : undefined;
}

function describeCancelError(error: unknown): CancelErrorDetails {
  const status = statusFrom(error);

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(status === undefined ? {} : { status }),
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
      ...(status === undefined ? {} : { status }),
    };
  }

  return {
    message: "Unknown LLM stream cancel failure",
    ...(status === undefined ? {} : { status }),
  };
}

export function reportLlmStreamCancelFailure(
  transport: LlmStreamCancelTransport,
  streamId: string,
  error: unknown,
): void {
  const payload: CancelFailureLog = {
    area: "llm-stream-cancel",
    transport,
    streamId,
    error: describeCancelError(error),
  };

  console.warn("[llm] Stream cancel failed", payload);
}

export async function ignoreLlmStreamCancelFailure(
  transport: LlmStreamCancelTransport,
  streamId: string,
  cancel: Promise<unknown>,
): Promise<void> {
  try {
    await cancel;
  } catch (error) {
    reportLlmStreamCancelFailure(transport, streamId, error);
  }
}

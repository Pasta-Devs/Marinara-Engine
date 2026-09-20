import type { DiagnosticContext } from "./diagnostics.js";
import { createDiagnostic, diagnosticDetails, getDiagnosticContext, withDiagnosticContext } from "./diagnostics.js";
import { logger } from "./logger.js";
import { randomUUID } from "node:crypto";

export function reportDiagnosticError(error: unknown, context?: DiagnosticContext, code?: string) {
  const reference = createDiagnostic(error, context, code);
  logger.error(
    { ...getDiagnosticContext(), ...context, ...reference, diagnostic: reference, error: diagnosticDetails(error) },
    "Diagnostic failure",
  );
  return reference;
}

export async function runDiagnosticOperation<T>(context: DiagnosticContext, work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const operationId = context.operationId ?? getDiagnosticContext().operationId ?? randomUUID();
  return withDiagnosticContext({ ...context, operationId }, async () => {
    logger.info({ operationId, operation: context.operation, stage: context.stage }, "Diagnostic operation started");
    try {
      const result = await work();
      logger.info(
        { operationId, operation: context.operation, stage: context.stage, elapsedMs: Date.now() - started },
        "Diagnostic operation succeeded",
      );
      return result;
    } catch (error) {
      const reference = reportDiagnosticError(error, context);
      logger.error(
        { ...reference, diagnostic: reference, elapsedMs: Date.now() - started },
        "Diagnostic operation failed",
      );
      throw error;
    }
  });
}

/** Stable reference returned with an error and used to find its durable log record. */
export interface DiagnosticReference {
  code: string;
  errorId: string;
  requestId?: string;
  operation?: string;
  stage?: string;
}

// ──────────────────────────────────────────────
// Tool argument validation — shared by built-in, custom, and package-contributed tools.
//
// Lives apart from the executor so the capability tool registry can compile a package's schema at
// registration time without importing the executor back.
// ──────────────────────────────────────────────
import Ajv from "ajv";
import addFormats from "ajv-formats";

export type ToolArgumentsValidator = (args: Record<string, unknown>) => string | null;

export function createToolArgumentsAjv(): Ajv {
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  return ajv;
}

export function createToolArgumentsValidator(
  parametersSchema: Record<string, unknown>,
  ajv = createToolArgumentsAjv(),
): ToolArgumentsValidator {
  const validate = ajv.compile(parametersSchema);
  if ("$async" in validate && validate.$async === true) {
    throw new Error("Async tool parameter schemas are not supported");
  }
  return (args) => {
    if (validate(args)) return null;
    const errors = validate.errors ?? [];
    const text = ajv.errorsText(errors, { dataVar: "arguments" });
    // "must be equal to one of the allowed values" does not say which, and the model has to
    // guess. Name them, so a refusal is something it can act on in the next round.
    const allowed = errors
      .filter((error) => error.keyword === "enum")
      .map((error) => (error.params as { allowedValues?: unknown[] }).allowedValues)
      .find((values): values is unknown[] => Array.isArray(values) && values.length > 0);
    return allowed ? `${text} (${allowed.join(", ")})` : text;
  };
}

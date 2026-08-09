// ──────────────────────────────────────────────
// File-Native Query Expressions
// ──────────────────────────────────────────────
// Query operands deliberately accept both columns and literal runtime values.
type QueryValue = unknown;

export type FileCondition =
  | {
      readonly kind: "file-comparison";
      readonly operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
      left: QueryValue;
      right: QueryValue;
    }
  | { readonly kind: "file-membership"; readonly operator: "in" | "not-in"; value: QueryValue; values: QueryValue[] }
  | { readonly kind: "file-null-check"; readonly operator: "is-null" | "is-not-null"; value: QueryValue }
  | { readonly kind: "file-pattern"; readonly value: QueryValue; readonly pattern: QueryValue }
  | { readonly kind: "file-string-nonblank"; readonly value: QueryValue }
  | { readonly kind: "file-json-flags-not-true"; readonly value: QueryValue; readonly flags: string[] }
  | { readonly kind: "file-logical"; readonly operator: "and" | "or"; conditions: FileCondition[] };

export type FileOrdering = {
  readonly kind: "file-ordering";
  readonly direction: "asc" | "desc";
  readonly value: QueryValue;
};

function comparison(
  operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte",
  left: QueryValue,
  right: QueryValue,
): FileCondition {
  return { kind: "file-comparison", operator, left, right };
}

export const eq = (left: QueryValue, right: QueryValue) => comparison("eq", left, right);
export const ne = (left: QueryValue, right: QueryValue) => comparison("ne", left, right);
export const lt = (left: QueryValue, right: QueryValue) => comparison("lt", left, right);
export const lte = (left: QueryValue, right: QueryValue) => comparison("lte", left, right);
export const gt = (left: QueryValue, right: QueryValue) => comparison("gt", left, right);
export const gte = (left: QueryValue, right: QueryValue) => comparison("gte", left, right);

export function inArray(value: QueryValue, values: QueryValue[]): FileCondition {
  return { kind: "file-membership", operator: "in", value, values };
}

export function notInArray(value: QueryValue, values: QueryValue[]): FileCondition {
  return { kind: "file-membership", operator: "not-in", value, values };
}

export function isNull(value: QueryValue): FileCondition {
  return { kind: "file-null-check", operator: "is-null", value };
}

export function isNotNull(value: QueryValue): FileCondition {
  return { kind: "file-null-check", operator: "is-not-null", value };
}

export function like(value: QueryValue, pattern: QueryValue): FileCondition {
  return { kind: "file-pattern", value, pattern };
}

export function stringIsNonBlank(value: QueryValue): FileCondition {
  return { kind: "file-string-nonblank", value };
}

export function jsonFlagsNotTrue(value: QueryValue, flags: string[]): FileCondition {
  return { kind: "file-json-flags-not-true", value, flags };
}

function logical(operator: "and" | "or", conditions: Array<FileCondition | undefined>): FileCondition {
  return {
    kind: "file-logical",
    operator,
    conditions: conditions.filter((entry): entry is FileCondition => Boolean(entry)),
  };
}

export const and = (...conditions: Array<FileCondition | undefined>) => logical("and", conditions);
export const or = (...conditions: Array<FileCondition | undefined>) => logical("or", conditions);

export const asc = (value: QueryValue): FileOrdering => ({ kind: "file-ordering", direction: "asc", value });
export const desc = (value: QueryValue): FileOrdering => ({ kind: "file-ordering", direction: "desc", value });

export function isFileCondition(value: unknown): value is FileCondition {
  if (!value || typeof value !== "object") return false;
  return [
    "file-comparison",
    "file-membership",
    "file-null-check",
    "file-pattern",
    "file-string-nonblank",
    "file-json-flags-not-true",
    "file-logical",
  ].includes(
    String((value as { kind?: unknown }).kind),
  );
}

export function isFileOrdering(value: unknown): value is FileOrdering {
  return Boolean(value && typeof value === "object" && (value as { kind?: unknown }).kind === "file-ordering");
}

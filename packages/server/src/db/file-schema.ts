// ──────────────────────────────────────────────
// File-Native Table Definitions
// ──────────────────────────────────────────────

export type FileColumn<TData = unknown, TNotNull extends boolean = boolean, THasDefault extends boolean = boolean> = {
  readonly kind: "file-column";
  key: string;
  readonly name: string;
  table: AnyFileTable | null;
  primary: boolean;
  hasDefault: boolean;
  defaultValue: unknown;
  isNotNull: boolean;
  primaryKey: () => FileColumn<TData, true, THasDefault>;
  notNull: () => FileColumn<TData, true, THasDefault>;
  default: (value: TData | (() => TData)) => FileColumn<TData, TNotNull, true>;
  references: (
    target: () => AnyFileColumn,
    options?: { onDelete?: string },
  ) => FileColumn<TData, TNotNull, THasDefault>;
};

export type AnyFileColumn = FileColumn<any, any, any>;
type FileColumns = Record<string, AnyFileColumn>;
// Capability packages bundle their own table declarations. A global symbol keeps
// those verified declarations recognizable without exposing the Engine database
// schema or requiring packages to import a private module instance.
const FILE_TABLE_META = Symbol.for("marinara:file-table");

type ColumnValue<TColumn> =
  TColumn extends FileColumn<infer TData, infer TNotNull, boolean>
    ? TNotNull extends true
      ? TData
      : TData | null
    : never;

export type FileColumnValue<TColumn> = ColumnValue<TColumn>;

type RequiredInsertKeys<TColumns extends FileColumns> = {
  [TKey in keyof TColumns]: TColumns[TKey] extends FileColumn<any, infer TNotNull, infer THasDefault>
    ? TNotNull extends true
      ? THasDefault extends false
        ? TKey
        : never
      : never
    : never;
}[keyof TColumns];

type OptionalInsertKeys<TColumns extends FileColumns> = Exclude<keyof TColumns, RequiredInsertKeys<TColumns>>;

export type FileRow<TColumns extends FileColumns> = {
  [TKey in keyof TColumns]: ColumnValue<TColumns[TKey]>;
};

export type FileInsert<TColumns extends FileColumns> = {
  [TKey in RequiredInsertKeys<TColumns>]: ColumnValue<TColumns[TKey]>;
} & {
  [TKey in OptionalInsertKeys<TColumns>]?: ColumnValue<TColumns[TKey]>;
};

export type FileUniqueRule<TColumns extends FileColumns> = {
  keys: readonly (keyof TColumns & string)[];
  when?: (row: FileRow<TColumns>) => boolean;
};

export type FileTableOptions<TColumns extends FileColumns> = {
  uniqueBy?: readonly (readonly (keyof TColumns & string)[] | FileUniqueRule<TColumns>)[];
};

export type FileUniqueConstraint = {
  keys: readonly string[];
  when?: (row: Record<string, unknown>) => boolean;
};

type FileTableMetadata<TColumns extends FileColumns = FileColumns> = {
  name: string;
  columns: TColumns;
  uniqueConstraints: readonly FileUniqueConstraint[];
};

export type FileTable<TColumns extends FileColumns = FileColumns> = TColumns & {
  readonly [FILE_TABLE_META]: FileTableMetadata<TColumns>;
  readonly $inferSelect: FileRow<TColumns>;
  readonly $inferInsert: FileInsert<TColumns>;
};

export type AnyFileTable = {
  readonly [FILE_TABLE_META]: FileTableMetadata;
  readonly $inferSelect: any;
  readonly $inferInsert: any;
};

function column<TData>(name: string): FileColumn<TData, false, false> {
  const definition: {
    kind: "file-column";
    key: string;
    name: string;
    table: AnyFileTable | null;
    primary: boolean;
    hasDefault: boolean;
    defaultValue: unknown;
    isNotNull: boolean;
    primaryKey: () => unknown;
    notNull: () => unknown;
    default: (value: TData | (() => TData)) => unknown;
    references: (target: () => AnyFileColumn, options?: { onDelete?: string }) => unknown;
  } = {
    kind: "file-column" as const,
    key: "",
    name,
    table: null,
    primary: false,
    hasDefault: false,
    defaultValue: undefined,
    isNotNull: false,
    primaryKey() {
      definition.primary = true;
      definition.isNotNull = true;
      return definition;
    },
    notNull() {
      definition.isNotNull = true;
      return definition;
    },
    default(value: TData | (() => TData)) {
      definition.hasDefault = true;
      definition.defaultValue = value;
      return definition;
    },
    references(_target: () => AnyFileColumn, _options?: { onDelete?: string }) {
      // Relationship behavior is centralized in file-backed-store.ts. Do not
      // evaluate the callback here: table definitions can reference each other
      // before module initialization has completed.
      return definition;
    },
  };
  return definition as FileColumn<TData, false, false>;
}

export function text<const TValues extends readonly string[] = readonly string[]>(
  name: string,
  _options?: { enum?: TValues },
): FileColumn<TValues extends readonly [] ? string : TValues[number], false, false> {
  return column<TValues extends readonly [] ? string : TValues[number]>(name);
}

/**
 * A text column holding a JSON-serialized float vector that the store may keep
 * in memory as a parsed Float64Array (#5592 Phase 1). On disk the value is a
 * plain JSON string, identical to text(); only the resident representation
 * differs. Consumers must accept both shapes: unprojected selects return the
 * original string, projected selects return the packed Float64Array. Packed
 * values are shared by reference and must never be mutated.
 */
export function vectorText(name: string): FileColumn<string | Float64Array, false, false> {
  return column<string | Float64Array>(name);
}

export function integer(name: string): FileColumn<number, false, false> {
  return column<number>(name);
}

export function real(name: string): FileColumn<number, false, false> {
  return column<number>(name);
}

export function fileTable<TColumns extends FileColumns>(
  name: string,
  columns: TColumns,
  options: FileTableOptions<TColumns> = {},
): FileTable<TColumns> {
  const table = { ...columns } as FileTable<TColumns>;
  const uniqueConstraints = (options.uniqueBy ?? []).map((constraint): FileUniqueConstraint => {
    if (Array.isArray(constraint)) return { keys: [...constraint] };
    const rule = constraint as FileUniqueRule<TColumns>;
    return {
      keys: [...rule.keys],
      when: rule.when as ((row: Record<string, unknown>) => boolean) | undefined,
    };
  });
  Object.defineProperty(table, FILE_TABLE_META, {
    value: { name, columns, uniqueConstraints },
    enumerable: false,
  });

  for (const [key, definition] of Object.entries(columns)) {
    definition.key = key;
    definition.table = table;
  }
  return table;
}

export function isFileTable(value: unknown): value is AnyFileTable {
  return Boolean(value && typeof value === "object" && FILE_TABLE_META in value);
}

export function isFileColumn(value: unknown): value is AnyFileColumn {
  return Boolean(value && typeof value === "object" && (value as { kind?: unknown }).kind === "file-column");
}

export function getFileTableConfig(table: AnyFileTable) {
  const metadata = table[FILE_TABLE_META];
  return {
    name: metadata.name,
    columns: Object.values(metadata.columns) as AnyFileColumn[],
    uniqueConstraints: metadata.uniqueConstraints ?? [],
  };
}

export class FileUniqueConstraintError extends Error {
  readonly code = "FILE_UNIQUE_CONSTRAINT";

  constructor(
    readonly table: string,
    readonly keys: readonly string[],
  ) {
    super(`[file-storage] Unique value already exists for ${table}.${keys.join("+")}`);
    this.name = "FileUniqueConstraintError";
  }
}

export function isFileUniqueConstraintError(
  error: unknown,
  table?: string,
  keys?: readonly string[],
): error is FileUniqueConstraintError {
  if (!(error instanceof FileUniqueConstraintError)) return false;
  if (table !== undefined && error.table !== table) return false;
  return (
    keys === undefined || (keys.length === error.keys.length && keys.every((key, index) => error.keys[index] === key))
  );
}

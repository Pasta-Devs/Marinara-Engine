declare module "sql.js" {
  interface SqlJsDatabase {
    run(sql: string): void;
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
    export(): Uint8Array;
    close(): void;
  }
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
  }
  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}

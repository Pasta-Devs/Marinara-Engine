declare module "better-sqlite3" {
  interface Database {
    pragma(pragma: string): unknown;
    close(): void;
  }
  interface DatabaseConstructor {
    new (filename: string, options?: Record<string, unknown>): Database;
  }
  const Database: DatabaseConstructor;
  export default Database;
}

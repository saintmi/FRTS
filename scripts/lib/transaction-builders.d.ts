export type SqlQueryFactory = {
  (strings: TemplateStringsArray, ...values: unknown[]): unknown;
  query(statement: string): unknown;
  transaction(queries: unknown[]): Promise<unknown[]>;
};
export function buildMigrationTransaction(sql: SqlQueryFactory, statements: string[], version: string): unknown[];
export function applyMigrationAtomically(sql: SqlQueryFactory, statements: string[], version: string): Promise<unknown[]>;
export function getFinalizedResultIndex(resultCount: number): number;
export function withRequiredAudit<T>(operation: () => Promise<T>, audit: () => Promise<unknown>): Promise<T>;

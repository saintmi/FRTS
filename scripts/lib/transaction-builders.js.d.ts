export function buildMigrationTransaction(sql: any, statements: string[], version: string): any[];
export function applyMigrationAtomically(sql: any, statements: string[], version: string): Promise<any[]>;
export function getFinalizedResultIndex(resultCount: number): number;
export function withRequiredAudit<T>(operation: () => Promise<T>, audit: () => Promise<unknown>): Promise<T>;

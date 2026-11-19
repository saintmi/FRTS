export function buildMigrationTransaction(sql, statements, version) {
  const queries = statements.map((statement) => sql.query(statement));
  queries.push(sql`INSERT INTO schema_migrations (version) VALUES (${version}) ON CONFLICT (version) DO NOTHING`);
  return queries;
}

export function getFinalizedResultIndex(resultCount) {
  // Final statements are: finalize attempt, insert receipt, insert audit.
  return resultCount - 3;
}

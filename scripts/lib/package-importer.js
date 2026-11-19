import crypto from 'node:crypto';
import { makePackageImportQueryPlan } from './package-import-plan.js';

export async function importPackageAtomically(sql, bankId, norm, pkg) {
  const plan = makePackageImportQueryPlan(bankId, norm, pkg);
  return sql.transaction(async (tx) => {
    const rows = [];
    for (const query of plan) rows.push(await tx(query.strings, ...query.values));
    return rows[rows.length - 3]?.[0] || { bank_id: bankId, sessions: norm.sessions.length, questions: norm.questions.length };
  });
}

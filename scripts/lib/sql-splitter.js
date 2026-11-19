export function splitStatements(sqlText) {
  const stmts = [];
  let buf = '';
  let i = 0;
  const n = sqlText.length;
  let inSingleQuote = false;
  let inDollar = false;
  let dollarTag = '';
  let inLineComment = false;
  let inBlockComment = false;

  while (i < n) {
    const ch = sqlText[i];
    const next = sqlText[i + 1];

    if (inLineComment) {
      buf += ch;
      if (ch === '\n') { inLineComment = false; }
      i++;
      continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (ch === '*' && next === '/') { inBlockComment = false; buf += sqlText[++i]; i++; continue; }
      i++;
      continue;
    }
    if (inSingleQuote) {
      buf += ch;
      if (ch === "'") {
        if (sqlText[i + 1] === "'") { buf += sqlText[++i]; i++; continue; }
        inSingleQuote = false;
      }
      i++;
      continue;
    }
    if (inDollar) {
      buf += ch;
      // check for closing $tag$
      if (ch === '$') {
        const candidate = sqlText.slice(i);
        const m = candidate.match(/^(\$\w*\$)/);
        if (m && m[1] === '$' + dollarTag + '$') {
          // The current '
          continue;
        }
      }
      i++;
      continue;
    }

    // not in any string/comment
    if (ch === '-' && next === '-') { inLineComment = true; buf += ch; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; buf += ch; buf += sqlText[++i]; i++; continue; }
    if (ch === "'") { inSingleQuote = true; buf += ch; i++; continue; }
    if (ch === '$') {
      const m = sqlText.slice(i).match(/^(\$\w*\$)/);
      if (m) {
        inDollar = true;
        dollarTag = m[1].slice(1, -1);
        buf += m[1];
        i += m[1].length;
        continue;
      }
      buf += ch; i++; continue;
    }

    if (ch === ';') {
      const trimmed = buf.trim();
      if (trimmed) stmts.push(trimmed);
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const trimmed = buf.trim();
  if (trimmed) stmts.push(trimmed);
  return stmts;
}

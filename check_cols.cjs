const fs = require('fs');
const raw = fs.readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const { neon } = require('@neondatabase/serverless');
const sql = neon(env.DATABASE_URL);

(async () => {
  try {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'learning_sessions' ORDER BY ordinal_position`;
    console.log('learning_sessions columns:');
    for (const c of cols) console.log('  ' + c.column_name);
    
    // Also check questions columns
    const qcols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'questions' ORDER BY ordinal_position`;
    console.log('\nquestions columns:');
    for (const c of qcols) console.log('  ' + c.column_name);

    process.exit(0);
  } catch (e) { console.error('ERR:', e.message); process.exit(1); }
})();

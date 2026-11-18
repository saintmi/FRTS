const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
(async () => {
  try {
    const test = await sql`SELECT source_session_id FROM learning_sessions LIMIT 1`;
    console.log('OK:', test[0].source_session_id);
    process.exit(0);
  } catch (e) { console.error('ERR:', e.message); process.exit(1); }
})();

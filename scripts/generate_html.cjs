const fs = require('fs');
const crypto = require('crypto');

const raw = fs.readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const { neon } = require('@neondatabase/serverless');
const sql = neon(env.DATABASE_URL);

function htmlEscape(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateHTML(session) {
  const { title, week, session_no, questions, stimuli } = session;

  let html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${htmlEscape(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f3f4f6; color: #111827; line-height: 1.6; padding: 1rem; }
    .container { max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; padding: 1.5rem; }
    header { margin-bottom: 1.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 700; color: #1d4ed8; margin-bottom: 0.25rem; }
    .subtitle { font-size: 0.875rem; color: #6b7280; }
    .instructions { margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.95rem; }
    .stimulus { margin-bottom: 1.5rem; padding: 1rem; background: #f0f9ff; border-left: 4px solid #1d4ed8; border-radius: 8px; }
    .stimulus-content { font-size: 0.95rem; color: #1f2937; }
    .question { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; }
    .question-label { font-weight: 600; color: #111827; margin-bottom: 0.5rem; font-size: 0.95rem; }
    .options { list-style: none; padding: 0; margin: 0; }
    .options li { margin-bottom: 0.5rem; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; background: #fafafa; cursor: pointer; transition: all 0.15s; }
    .options li:hover { border-color: #1d4ed8; background: #eff6ff; }
    .options li.selected { border-color: #1d4ed8; background: #dbeafe; }
    input[type="radio"] { margin-right: 0.5rem; accent-color: #1d4ed8; }
    .btn-submit { background: #1d4ed8; color: #ffffff; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; margin-top: 1rem; }
    .btn-submit:hover { background: #1e40af; }
    .btn-submit:disabled { background: #9ca3af; cursor: not-allowed; }
    .result { margin-top: 1.5rem; padding: 1rem; border-radius: 8px; display: none; }
    .result.success { background: #dcfce7; border: 1px solid #bbf7d0; color: #166534; }
    .result.error { background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; }
    .result h3 { margin-bottom: 0.5rem; font-size: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${htmlEscape(title)}</h1>
      <div class="subtitle">Pekan ${week} · Sesi ${session_no} · FRTS English</div>
    </header>

    <div class="instructions">
      <strong>Petunjuk Pengerjaan:</strong><br>
      1. Baca setiap soal dengan teliti.<br>
      2. Pilih salah satu jawaban yang paling tepat untuk setiap soal.<br>
      3. Klik tombol "Kirim Jawaban" setelah selesai.<br>
      4. Skor akan dihitung secara otomatis oleh sistem setelah Anda mengirim.
    </div>
`;

  for (const s of stimuli || []) {
    html += `
    <div class="stimulus">
      <div class="stimulus-content">${htmlEscape(s.content)}</div>
    </div>`;
  }

  for (const q of questions || []) {
    html += `
    <div class="question" data-qid="${q.id}">
      <div class="question-label">${htmlEscape(q.prompt)}</div>
      <ul class="options">`;

    const options = q.options || [];
    for (const opt of options) {
      html += `
        <li>
          <label style="cursor: pointer; display: flex; align-items: center; font-weight: normal;">
            <input type="radio" name="q_${q.id}" value="${htmlEscape(opt.label || opt.text)}" style="margin-right: 0.5rem;">
            ${htmlEscape(opt.label ? opt.label + '. ' + opt.text : opt.text)}
          </label>
        </li>`;
    }

    html += `      </ul>
    </div>`;
  }

  html += `
    <button id="submit-btn" class="btn-submit">Kirim Jawaban</button>
    <div id="result" class="result"></div>
  </div>

  <script>
    (function() {
      const attemptId = new URLSearchParams(window.location.search).get('attempt_id');
      const submitBtn = document.getElementById('submit-btn');
      const resultDiv = document.getElementById('result');
      const options = document.querySelectorAll('input[type="radio"]');

      const answers = {};
      options.forEach(opt => {
        opt.addEventListener('change', () => {
          const qid = opt.name.replace('q_', '');
          answers[qid] = opt.value;
          document.querySelectorAll('input[name="' + opt.name + '"]').forEach(r => {
            r.parentElement.parentElement.classList.toggle('selected', r === opt);
          });
        });
      });

      submitBtn.addEventListener('click', async () => {
        if (!attemptId) {
          resultDiv.className = 'result error';
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = '<h3>Error</h3><p>Attempt ID tidak ditemukan.</p>';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengirim...';

        const payload = {
          answers: Object.keys(answers).map(qid => ({
            question_id: qid,
            answer: answers[qid]
          })),
          idempotency_key: attemptId
        };

        try {
          const res = await fetch('/api/attempts/' + attemptId + '/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });

          const data = await res.json();

          if (res.ok && data.attempt) {
            resultDiv.className = 'result success';
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<h3>Selesai!</h3><p>Skor: <strong>' + data.attempt.score + '</strong> / ' + data.attempt.max_score + '</p><p>Status: ' + data.attempt.status + '</p>';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sudah Dikirim';
          } else {
            resultDiv.className = 'result error';
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<h3>Gagal</h3><p>' + (data.error || 'Terjadi kesalahan') + '</p>';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Kirim Jawaban';
          }
        } catch (err) {
          resultDiv.className = 'result error';
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = '<h3>Error Jaringan</h3><p>Tidak dapat terhubung ke server.</p>';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Kirim Jawaban';
        }
      });
    })();
  </script>
</body>
</html>`;

  return html;
}

(async () => {
  try {
    const sessions = await sql`SELECT id, bank_id, source_session_id, week, session_no, title, total_questions FROM learning_sessions ORDER BY week, session_no`;
    console.log('Found ' + sessions.length + ' sessions');

    const admin = await sql`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`;
    if (!admin[0]) {
      console.error('No admin user found!');
      process.exit(1);
    }
    const adminId = admin[0].id;

    const existing = await sql`SELECT source_session_id FROM html_modules`;
    const existingSet = new Set(existing.map(r => r.source_session_id));

    let created = 0, skipped = 0;

    for (const s of sessions) {
      if (existingSet.has(s.source_session_id)) {
        console.log('SKIP Week=' + s.week + ' Session=' + s.session_no);
        skipped++;
        continue;
      }

      const questions = await sql`
        SELECT q.id, q.source_question_id, q.type, q.prompt, q.points, q.status
        FROM questions q
        WHERE q.session_id = ${s.id}
        ORDER BY q.created_at
      `;

      for (const q of questions) {
        const opts = await sql`SELECT id, label, text, is_correct, sort_order FROM question_options WHERE question_id = ${q.id} ORDER BY sort_order`;
        q.options = opts.map(o => ({ label: o.label, text: o.text, is_correct: o.is_correct, sort_order: o.sort_order }));
        const key = await sql`SELECT answer, explanation FROM question_answer_keys WHERE question_id = ${q.id}`;
        q.answer_key = key[0] || null;
      }

      const stims = await sql`SELECT id, source_stimulus_id, content, content_type FROM stimuli WHERE session_id = ${s.id}`;
      s.stimuli = stims;
      s.questions = questions;

      const htmlContent = generateHTML(s);
      const checksum = crypto.createHash('sha256').update(htmlContent).digest('hex');

      const moduleRes = await sql`
        INSERT INTO html_modules (id, title, description, source_session_id, version, content, checksum, uploaded_by, status, is_published, created_at, updated_at)
        VALUES (gen_random_uuid(), ${s.title}, ${s.title || null}, ${s.source_session_id}, 1, ${htmlContent}, ${checksum}, ${adminId}, 'REVIEW_REQUIRED', false, now(), now())
        RETURNING id, title, version, checksum
      `;

      const module = moduleRes[0];

      await sql`
        INSERT INTO html_module_versions (id, module_id, version, content, checksum, uploaded_by, created_at)
        VALUES (gen_random_uuid(), ${module.id}, 1, ${htmlContent}, ${checksum}, ${adminId}, now())
      `;

      console.log('CREATED Week=' + s.week + ' Session=' + s.session_no + ' Title=' + s.title + ' Questions=' + questions.length + ' ModuleID=' + module.id);
      created++;
    }

    console.log('\n=== SUMMARY ===');
    console.log('Created: ' + created);
    console.log('Skipped: ' + skipped);
    console.log('Total: ' + sessions.length);
    process.exit(0);
  } catch (e) { console.error('ERR:', e.message); process.exit(1); }
})();

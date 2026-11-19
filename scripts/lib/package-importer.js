import crypto from 'node:crypto';

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function equal(a,b) { return stable(a) === stable(b); }

export async function importPackageAtomically(sql, bankId, norm, pkg) {
  return sql.transaction(async (tx) => {
    const bankRows = await tx`SELECT id FROM question_banks WHERE id = ${bankId} FOR UPDATE`;
    if (!bankRows[0]) throw new Error('Import target bank not found');
    const sessions = new Map();
    for (const item of norm.sessions) {
      const rows = await tx`SELECT id, week, session_no, title, total_questions FROM learning_sessions WHERE bank_id = ${bankId} AND source_session_id = ${item.source_session_id} FOR UPDATE`;
      if (rows[0]) {
        const row = rows[0];
        if (Number(row.week ?? -1)!==Number(item.week ?? -1) || Number(row.session_no ?? -1)!==Number(item.session_no ?? -1) || String(row.title ?? '')!==String(item.title ?? '') || Number(row.total_questions)!==Number(item.total_questions)) throw new Error('Import conflict: existing session differs: '+item.source_session_id);
        sessions.set(item.source_session_id,row.id);
      } else {
        const id=crypto.randomUUID();
        await tx`INSERT INTO learning_sessions (id,bank_id,source_session_id,week,session_no,title,total_questions,created_at) VALUES (${id},${bankId},${item.source_session_id},${item.week},${item.session_no},${item.title},${item.total_questions},now())`;
        sessions.set(item.source_session_id,id);
      }
    }
    const stimuli=new Map();
    for(const item of norm.stimuli){
      const sid=sessions.get(item.session_id);
      if(!sid) throw new Error('Unknown session for stimulus '+item.source_stimulus_id);
      const rows=await tx`SELECT id,content,content_type FROM stimuli WHERE session_id=${sid} AND source_stimulus_id=${item.source_stimulus_id} FOR UPDATE`;
      if(rows[0]){
        if(String(rows[0].content??'')!==String(item.content??'') || String(rows[0].content_type??'')!==String(item.content_type??'')) throw new Error('Import conflict: existing stimulus differs: '+item.source_stimulus_id);
        stimuli.set(item.source_stimulus_id,rows[0].id);
      } else {
        const id=crypto.randomUUID();
        await tx`INSERT INTO stimuli (id,session_id,source_stimulus_id,content,content_type,created_at) VALUES (${id},${sid},${item.source_stimulus_id},${item.content},${item.content_type},now())`;
        stimuli.set(item.source_stimulus_id,id);
      }
    }
    const questions=new Map();
    for(const item of norm.questions){
      const sid=sessions.get(item.session_id);
      const stid=item.stimulus_id?stimuli.get(item.stimulus_id):null;
      if(!sid || (item.stimulus_id && !stid)) throw new Error('Question has unresolved session/stimulus: '+item.source_question_id);
      const rows=await tx`SELECT id,session_id,stimulus_id,type,prompt,points,status FROM questions WHERE bank_id=${bankId} AND source_question_id=${item.source_question_id} FOR UPDATE`;
      let qid;
      if(rows[0]){
        const row=rows[0];
        if(String(row.session_id)!==String(sid) || String(row.stimulus_id??'')!==String(stid??'') || String(row.type)!==String(item.type) || String(row.prompt??'')!==String(item.prompt??'') || Number(row.points)!==Number(item.points) || String(row.status)!==String(item.status)) throw new Error('Import conflict: existing question differs: '+item.source_question_id);
        qid=row.id;
      } else {
        qid=crypto.randomUUID();
        await tx`INSERT INTO questions (id,bank_id,session_id,stimulus_id,source_question_id,type,prompt,points,status,created_at) VALUES (${qid},${bankId},${sid},${stid},${item.source_question_id},${item.type},${item.prompt},${item.points},${item.status},now())`;
      }
      questions.set(item.source_question_id,qid);
      const expected=norm.options.filter(o=>o.question_source_id===item.source_question_id).map(o=>({label:o.label,text:o.text,is_correct:o.is_correct,sort_order:Number(o.sort_order)}));
      const actual=(await tx`SELECT label,text,is_correct,sort_order FROM question_options WHERE question_id=${qid} ORDER BY sort_order FOR UPDATE`).map(o=>({label:o.label,text:o.text,is_correct:o.is_correct,sort_order:Number(o.sort_order)}));
      if(actual.length && !equal(actual,expected)) throw new Error('Import conflict: existing options differ: '+item.source_question_id);
      if(!actual.length) for(const option of norm.options.filter(o=>o.question_source_id===item.source_question_id)) await tx`INSERT INTO question_options (id,question_id,label,text,is_correct,sort_order,created_at) VALUES (${crypto.randomUUID()},${qid},${option.label},${option.text},${option.is_correct},${option.sort_order},now())`;
      const key=norm.answerKeys.find(k=>k.question_source_id===item.source_question_id);
      const keyRows=await tx`SELECT answer,explanation FROM question_answer_keys WHERE question_id=${qid} FOR UPDATE`;
      if(keyRows[0]){
        const ans=typeof keyRows[0].answer==='string'?JSON.parse(keyRows[0].answer):keyRows[0].answer;
        if(!key || !equal(ans,key.answer) || String(keyRows[0].explanation??'')!==String(key.explanation??'')) throw new Error('Import conflict: existing answer key differs: '+item.source_question_id);
      } else if(key) await tx`INSERT INTO question_answer_keys (id,question_id,answer,explanation,created_at) VALUES (${crypto.randomUUID()},${qid},${JSON.stringify(key.answer)},${key.explanation},now())`;
    }
    await tx`UPDATE question_banks SET total_sessions=${sessions.size},total_questions=${questions.size} WHERE id=${bankId}`;
    await tx`INSERT INTO content_imports (id,package_name,package_version,status,total_questions,total_sessions,imported_questions,report,created_at) VALUES (${crypto.randomUUID()},${pkg.file},${norm.bank.package_version},'COMPLETED',${norm.totalQuestions},${sessions.size},${questions.size},${JSON.stringify({bank_id:norm.bank.source_bank_id,source_sha256:pkg.sha256})},now())`;
    return {bank_id:bankId,sessions:sessions.size,questions:questions.size};
  });
}

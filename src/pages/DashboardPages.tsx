import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getJSON, postJSON, postForm, putJSON } from '../lib/apiClient';

type Row = Record<string, any>;

function ErrorNotice({ value }: { value: string }) {
  return value ? <div className="alert error" role="alert">{value}</div> : null;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="muted empty-state">{children}</p>;
}

function Metric({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return <div className="card metric-card"><span className="muted small">{label}</span><strong>{value}</strong>{helper && <span className="muted small">{helper}</span>}</div>;
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="table-wrap"><table className="table">{children}</table></div>;
}

export function AdminDashboardPage() {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setData(await getJSON('/api/reports')); }
    catch (e: any) { setError(e.message || 'Laporan platform gagal dimuat.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const summary = data?.summary || {};
  const roleCount = (role: string) => Number((summary.users || []).find((u: Row) => u.role === role)?.count || 0);
  const moduleCount = (status: string) => Number((summary.html_modules_by_status || []).find((m: Row) => m.status === status)?.count || 0);
  return <div className="page dashboard-page">
    <div className="page-heading"><div><h1 className="h1">Dashboard Admin</h1><p className="muted">Ikhtisar pengguna, kelas, materi, penugasan, dan aktivitas belajar.</p></div><button className="secondary" type="button" onClick={load} disabled={busy}>{busy ? 'Memuat…' : 'Muat ulang'}</button></div>
    <ErrorNotice value={error} />
    {busy && !data ? <div className="spinner" /> : <>
      <div className="dashboard-grid">
        <Metric label="Administrator" value={roleCount('ADMIN')} />
        <Metric label="Guru" value={roleCount('TEACHER')} />
        <Metric label="Siswa" value={roleCount('STUDENT')} />
        <Metric label="Kelas aktif" value={summary.classes?.active ?? 0} helper={'Total ' + (summary.classes?.count ?? 0) + ' kelas'} />
        <Metric label="Penugasan aktif" value={summary.assignments?.active ?? 0} helper={'Total ' + (summary.assignments?.count ?? 0) + ' penugasan'} />
        <Metric label="Percobaan siswa" value={(summary.attempts_by_status || []).reduce((n: number, x: Row) => n + Number(x.count || 0), 0)} />
      </div>
      <div className="card">
        <h2 className="section-title">Status Bank HTML</h2>
        <div className="dashboard-grid compact">
          <Metric label="Menunggu review" value={moduleCount('REVIEW_REQUIRED')} />
          <Metric label="Draft" value={moduleCount('DRAFT')} />
          <Metric label="Disetujui" value={moduleCount('APPROVED')} />
          <Metric label="Diarsipkan" value={moduleCount('ARCHIVED')} />
        </div>
        <div className="toolbar">
          <Link to="/admin/users">Kelola pengguna</Link>
          <Link to="/admin/content">Bank materi</Link>
          <Link to="/admin/review">Review akademik</Link>
          <Link to="/admin/reports">Laporan platform</Link>
        </div>
      </div>
      <div className="card">
        <h2 className="section-title">Percobaan terbaru</h2>
        {(data?.recent_attempts || []).length === 0 ? <Empty>Belum ada aktivitas pengerjaan.</Empty> :
          <TableWrap><thead><tr><th>Siswa</th><th>Kelas</th><th>Latihan</th><th>Status</th><th>Skor</th><th>Dikirim</th></tr></thead><tbody>
            {(data.recent_attempts || []).map((a: Row) => <tr key={a.attempt_id}><td>{a.student_name || a.student_email}</td><td>{a.class_name}</td><td>{a.assignment_title}</td><td>{a.status}</td><td>{a.score ?? '—'} / {a.max_score ?? '—'}</td><td>{a.submitted_at || 'Belum dikirim'}</td></tr>)}
          </tbody></TableWrap>}
      </div>
    </>}
  </div>;
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'STUDENT' });
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { const d = await getJSON('/api/users'); setUsers(d.users || []); }
    catch (e: any) { setError(e.message || 'Data pengguna gagal dimuat.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function createUser(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await postJSON('/api/users', form);
      setForm({ full_name: '', email: '', password: '', role: 'STUDENT' });
      setNotice('Akun berhasil dibuat. Bagikan kredensial secara aman kepada pengguna.');
      await load();
    } catch (e: any) { setError(e.message || 'Pembuatan akun gagal.'); }
    finally { setSaving(false); }
  }
  async function updateUser(user: Row, patch: Row) {
    setError(''); setNotice('');
    try { await putJSON('/api/users/' + user.id, patch); setNotice('Data pengguna diperbarui.'); await load(); }
    catch (e: any) { setError(e.message || 'Perubahan pengguna gagal.'); }
  }
  return <div className="page dashboard-page">
    <div className="page-heading"><div><h1 className="h1">Manajemen Pengguna</h1><p className="muted">Buat akun, ubah peran, dan kelola status akun.</p></div><button className="secondary" onClick={load} disabled={busy}>Muat ulang</button></div>
    <ErrorNotice value={error} />{notice && <div className="alert success">{notice}</div>}
    <form className="card form-grid" onSubmit={createUser}>
      <h2 className="section-title full-row">Buat akun baru</h2>
      <div className="field"><label>Nama lengkap</label><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
      <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
      <div className="field"><label>Password sementara (min. 10 karakter)</label><input type="password" minLength={10} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div>
      <div className="field"><label>Peran</label><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="STUDENT">Siswa</option><option value="TEACHER">Guru</option><option value="ADMIN">Admin</option></select></div>
      <div className="full-row"><button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Buat akun'}</button></div>
    </form>
    <div className="card"><h2 className="section-title">Daftar akun</h2>{busy ? <div className="spinner" /> : users.length === 0 ? <Empty>Belum ada pengguna.</Empty> :
      <TableWrap><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
        {users.map(u => <tr key={u.id}><td>{u.full_name || '—'}</td><td>{u.email}</td><td><select aria-label={'Role ' + u.email} value={u.role} onChange={e => void updateUser(u, { role: e.target.value })}><option value="ADMIN">ADMIN</option><option value="TEACHER">TEACHER</option><option value="STUDENT">STUDENT</option></select></td><td>{u.is_active ? 'Aktif' : 'Nonaktif'}</td><td><button className={u.is_active ? 'danger' : 'secondary'} onClick={() => void updateUser(u, { is_active: !u.is_active })}>{u.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></td></tr>)}
      </tbody></TableWrap>}
    </div>
  </div>;
}

export function AdminClassesPage() {
  const [classes, setClasses] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setBusy(true); setError(''); try { const d = await getJSON('/api/classes'); setClasses(d.classes || []); } catch (e: any) { setError(e.message || 'Kelas gagal dimuat.'); } finally { setBusy(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="page dashboard-page">
    <div className="page-heading"><div><h1 className="h1">Manajemen Kelas</h1><p className="muted">Pantau kelas seluruh guru dan jumlah siswa.</p></div><button className="secondary" onClick={load}>Muat ulang</button></div>
    <ErrorNotice value={error} />
    <div className="card">{busy ? <div className="spinner" /> : classes.length === 0 ? <Empty>Belum ada kelas.</Empty> :
      <TableWrap><thead><tr><th>Kelas</th><th>Guru</th><th>Siswa</th><th>Status</th><th></th></tr></thead><tbody>{classes.map(c => <tr key={c.id}><td>{c.name}<div className="muted small">{c.description || ''}</div></td><td>{c.teacher_email || '—'}</td><td>{c.student_count || 0}</td><td>{c.is_active ? 'Aktif' : 'Nonaktif'}</td><td><Link to={'/teacher/classes/' + c.id}>Lihat</Link></td></tr>)}</tbody></TableWrap>}</div>
  </div>;
}

export function AdminContentPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [importing, setImporting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { const d = await getJSON('/api/html'); setItems(d.html_modules || []); }
    catch (e: any) { setError(e.message || 'Bank HTML gagal dimuat.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function importBatchOne() {
    setError(''); setNotice('');
    if (files.length !== 8) { setError('Pilih tepat 8 file HTML dari folder sessions pada paket Batch 1 v0.6.'); return; }
    const prepared: Array<{ file: File; sessionId: string; bankId: string; title: string; week: string }> = [];
    const seen = new Set<string>();
    for (const file of files) {
      const html = await file.text();
      const sessionMatch = html.match(/"session_id"\s*:\s*"([^"]+)"/);
      const weekMatch = html.match(/"week"\s*:\s*(\d+)/);
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const sessionId = sessionMatch?.[1] || '';
      const bankId = 'FRTS-B1-W1-4';
      if (!/^W[1-4]-ONLINE-0[12]$/.test(sessionId)) { setError('File ' + file.name + ' tidak memiliki session_id Batch 1 yang valid.'); return; }
      if (seen.has(sessionId)) { setError('Ada file duplikat untuk sesi ' + sessionId + '.'); return; }
      seen.add(sessionId);
      prepared.push({ file, sessionId, bankId, title: (titleMatch?.[1] || file.name).replace(/&amp;/g,'&'), week: weekMatch?.[1] || '' });
    }
    if (prepared.length !== 8) { setError('Paket tidak lengkap. Batch 1 memerlukan delapan sesi.'); return; }
    setImporting(true);
    let imported = 0, skipped = 0, failed = 0;
    const existingIds = new Set(items.filter(m => m.source_bank_id === 'FRTS-B1-W1-4').map(m => m.source_session_id).filter(Boolean));
    try {
      for (const item of prepared) {
        if (existingIds.has(item.sessionId)) { skipped++; continue; }
        setProgress('Mengimpor ' + item.sessionId + '…');
        try {
          const form = new FormData();
          form.append('file', item.file, item.file.name);
          form.append('title', item.title);
          form.append('description', 'FRTS Batch 1 v0.6 · Week ' + item.week + ' · generated vocabulary-first · REVIEW_REQUIRED');
          form.append('source_bank_id', item.bankId);
          form.append('source_session_id', item.sessionId);
          await postForm('/api/html', form);
          imported++;
          existingIds.add(item.sessionId);
        } catch (e: any) {
          failed++;
          setError(old => old ? old + '\n' + item.sessionId + ': ' + (e.message || 'gagal') : item.sessionId + ': ' + (e.message || 'gagal'));
        }
      }
      setNotice(imported + ' sesi diimpor sebagai REVIEW_REQUIRED; ' + skipped + ' sudah ada; ' + failed + ' gagal.');
      await load();
    } finally { setImporting(false); setProgress(''); }
  }
  async function setPublish(module: Row, next: boolean) {
    setError(''); setNotice('');
    try { await postJSON('/api/html/' + module.id, { is_published: next }); setNotice(next ? 'Materi berhasil diterbitkan.' : 'Publikasi materi dinonaktifkan.'); await load(); }
    catch (e: any) { setError(e.message || 'Status publikasi gagal diperbarui.'); }
  }
  async function openHtml(id: string) { window.open('/api/html/' + id, '_blank', 'noopener,noreferrer'); }
  return <div className="page dashboard-page">
    <div className="page-heading"><div><h1 className="h1">Bank Konten HTML</h1><p className="muted">Pusat materi. Konten impor tetap menunggu review sebelum dapat dipublikasikan.</p></div><button className="secondary" onClick={load}>Muat ulang</button></div>
    <ErrorNotice value={error} />{notice && <div className="alert success">{notice}</div>}
    <div className="card import-card"><div><h2 className="section-title">Batch 1 · Vocabulary-First v0.6</h2><p className="muted small">Ekstrak paket ZIP terlebih dahulu, lalu pilih delapan file HTML dalam folder sessions/week-01 sampai week-04. Sistem memverifikasi bank_id FRTS-B1-W1-4 dan session_id dari metadata setiap file. Setiap file akan diimpor ke bank HTML sebagai REVIEW_REQUIRED. Kunci jawaban tidak dikirim dari HTML siswa.</p></div>
      <div className="field"><label>Delapan file HTML Batch 1</label><input type="file" accept=".html,text/html" multiple onChange={e => setFiles(Array.from(e.target.files || []))} /></div>
      <p className="muted small">{files.length} dari 8 file dipilih.</p>
      <button onClick={importBatchOne} disabled={importing || files.length !== 8}>{importing ? 'Mengimpor…' : 'Impor Batch 1 v0.6'}</button>{progress && <p className="muted small">{progress}</p>}
    </div>
    <div className="card">{busy ? <div className="spinner" /> : items.length === 0 ? <Empty>Bank HTML masih kosong.</Empty> :
      <TableWrap><thead><tr><th>Materi</th><th>Sesi sumber</th><th>Versi</th><th>Status</th><th>Publish</th><th></th></tr></thead><tbody>
        {items.map(m => <tr key={m.id}><td>{m.title}</td><td>{m.source_session_id || 'Upload umum'}</td><td>v{m.version}</td><td><span className="badge">{m.status}</span></td><td>{m.is_published ? 'Ya' : 'Tidak'}</td><td className="action-cell"><button className="secondary" onClick={() => void openHtml(m.id)}>Pratinjau</button>{m.status === 'APPROVED' && <button onClick={() => void setPublish(m, !m.is_published)}>{m.is_published ? 'Nonaktifkan' : 'Terbitkan'}</button>}</td></tr>)}
      </tbody></TableWrap>}</div>
  </div>;
}
export function AdminReviewPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => { setBusy(true); setError(''); try { const d = await getJSON('/api/html'); setItems((d.html_modules || []).filter((x: Row) => x.status === 'REVIEW_REQUIRED' || x.status === 'DRAFT')); } catch (e: any) { setError(e.message || 'Daftar review gagal dimuat.'); } finally { setBusy(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function setStatus(id: string, status: string) {
    setSavingId(id); setError(''); setNotice('');
    try { await putJSON('/api/html/' + id, { status }); setNotice(status === 'APPROVED' ? 'Konten disetujui. Publikasi tetap dilakukan terpisah.' : 'Status konten diperbarui.'); await load(); }
    catch (e: any) { setError(e.message || 'Perubahan status gagal.'); }
    finally { setSavingId(''); }
  }
  return <div className="page dashboard-page"><h1 className="h1">Review Konten</h1><p className="muted">Periksa isi akademik, keterkaitan stimulus, soal, dan kosakata sebelum menyetujui materi.</p>
    <ErrorNotice value={error} />{notice && <div className="alert success">{notice}</div>}
    <div className="card">{busy ? <div className="spinner" /> : items.length === 0 ? <Empty>Tidak ada konten yang menunggu review.</Empty> :
      <TableWrap><thead><tr><th>Materi</th><th>Sesi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{items.map(m => <tr key={m.id}><td>{m.title}</td><td>{m.source_session_id || '—'}</td><td>{m.status}</td><td className="action-cell"><button className="secondary" onClick={() => window.open('/api/html/' + m.id, '_blank', 'noopener,noreferrer')}>Pratinjau</button><button disabled={savingId === m.id} onClick={() => void setStatus(m.id, 'APPROVED')}>Setujui</button><button className="secondary" disabled={savingId === m.id} onClick={() => void setStatus(m.id, 'ARCHIVED')}>Arsip</button></td></tr>)}</tbody></TableWrap>}</div>
  </div>;
}

export function AdminAuditPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => { setBusy(true); setError(''); try { const d = await getJSON('/api/audit?limit=100'); setItems(d.audit_logs || []); } catch (e: any) { setError(e.message || 'Audit log gagal dimuat.'); } finally { setBusy(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="page dashboard-page"><div className="page-heading"><div><h1 className="h1">Audit Log</h1><p className="muted">Riwayat aktivitas administratif dan perubahan penting.</p></div><button className="secondary" onClick={load}>Muat ulang</button></div>
    <ErrorNotice value={error} />
    <div className="card">{busy ? <div className="spinner" /> : items.length === 0 ? <Empty>Belum ada log aktivitas atau audit log kosong.</Empty> :
      <TableWrap><thead><tr><th>Waktu</th><th>Pelaku</th><th>Aksi</th><th>Entitas</th><th>Metadata</th></tr></thead><tbody>{items.map(x => <tr key={x.id}><td>{x.created_at}</td><td>{x.actor_email || x.actor_id || 'System'}</td><td>{x.action}</td><td>{x.entity_type} {x.entity_id}</td><td><code className="metadata">{JSON.stringify(x.metadata || {})}</code></td></tr>)}</tbody></TableWrap>}</div>
  </div>;
}

export function AdminReportsPage() {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => { setBusy(true); setError(''); try { setData(await getJSON('/api/reports')); } catch (e: any) { setError(e.message || 'Laporan gagal dimuat.'); } finally { setBusy(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="page dashboard-page"><div className="page-heading"><div><h1 className="h1">Laporan Platform</h1><p className="muted">Ringkasan aktivitas dan hasil semua kelas.</p></div><button className="secondary" onClick={load}>Muat ulang</button></div><ErrorNotice value={error} />
    {busy && !data ? <div className="spinner" /> : <>
      <div className="dashboard-grid">{(data?.summary?.users || []).map((u: Row) => <Metric key={u.role} label={'Pengguna ' + u.role} value={u.count} />)}<Metric label="Jumlah kelas" value={data?.summary?.classes?.count || 0} /><Metric label="Penugasan" value={data?.summary?.assignments?.count || 0} /></div>
      <div className="card"><h2 className="section-title">Import bank soal terbaru</h2><TableWrap><thead><tr><th>Paket</th><th>Versi</th><th>Status</th><th>Sesi</th><th>Soal</th><th>Waktu</th></tr></thead><tbody>{(data?.recent_imports || []).map((x: Row, i: number) => <tr key={i}><td>{x.package_name}</td><td>{x.package_version}</td><td>{x.status}</td><td>{x.total_sessions}</td><td>{x.imported_questions || x.total_questions}</td><td>{x.created_at}</td></tr>)}</tbody></TableWrap></div>
      <div className="card"><h2 className="section-title">Percobaan terbaru</h2><TableWrap><thead><tr><th>Siswa</th><th>Kelas</th><th>Latihan</th><th>Status</th><th>Skor</th><th>Maks</th></tr></thead><tbody>{(data?.recent_attempts || []).map((x: Row) => <tr key={x.attempt_id}><td>{x.student_name || x.student_email}</td><td>{x.class_name}</td><td>{x.assignment_title}</td><td>{x.status}</td><td>{x.score ?? '—'}</td><td>{x.max_score ?? '—'}</td></tr>)}</tbody></TableWrap></div>
    </>}
  </div>;
}

export function TeacherDashboardPage() {
  const [classes, setClasses] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [attempts, setAttempts] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setBusy(true); setError(''); try { const [c,a,t] = await Promise.all([getJSON('/api/classes'),getJSON('/api/assignments'),getJSON('/api/attempts')]); setClasses(c.classes || []); setAssignments(a.assignments || []); setAttempts(t.attempts || []); } catch (e: any) { setError(e.message || 'Dashboard guru gagal dimuat.'); } finally { setBusy(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const submitted = attempts.filter(x => x.status === 'submitted').length;
  return <div className="page dashboard-page"><div className="page-heading"><div><h1 className="h1">Dashboard Guru</h1><p className="muted">Pantau kelas, distribusi latihan, dan hasil siswa.</p></div><button className="secondary" onClick={load}>Muat ulang</button></div><ErrorNotice value={error} />
    <div className="dashboard-grid"><Metric label="Kelas" value={classes.length} /><Metric label="Siswa" value={classes.reduce((n,c) => n + Number(c.student_count || 0),0)} /><Metric label="Penugasan" value={assignments.length} /><Metric label="Submission" value={submitted} helper={attempts.length - submitted + ' masih berjalan'} /></div>
    <div className="toolbar"><Link to="/teacher/classes/new">+ Buat kelas</Link><Link to="/teacher/html-bank">Pilih materi dari bank HTML</Link><Link to="/teacher/reports">Laporan kelas</Link></div>
    {busy ? <div className="spinner" /> : <div className="card"><h2 className="section-title">Kelas Saya</h2>{classes.length === 0 ? <Empty>Anda belum memiliki kelas. Buat kelas pertama untuk mulai mengajar.</Empty> :
      <div className="class-grid">{classes.map(c => <div className="card mini-card" key={c.id}><strong>{c.name}</strong><p className="muted small">{c.description || 'Tidak ada deskripsi'}</p><p>{c.student_count || 0} siswa</p><Link to={'/teacher/classes/' + c.id}>Kelola kelas</Link></div>)}</div>}</div>}
    <div className="card"><h2 className="section-title">Penugasan terbaru</h2>{assignments.length === 0 ? <Empty>Belum ada penugasan. Pilih materi HTML dan tetapkan ke salah satu kelas.</Empty> : <TableWrap><thead><tr><th>Judul</th><th>Kelas</th><th>Status materi</th><th>Percobaan</th><th>Batas</th></tr></thead><tbody>{assignments.slice(0,12).map(a => <tr key={a.id}><td>{a.title}</td><td>{a.class_name}</td><td>{a.status}</td><td>{a.attempt_count ?? 0}</td><td>{a.due_at || '—'}</td></tr>)}</tbody></TableWrap>}</div>
  </div>;
}

export function TeacherHtmlBankPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Row[]>([]);
  const [week, setWeek] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [module, setModule] = useState<Row | null>(null);
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => { setBusy(true); setError(''); try { const [h,c] = await Promise.all([getJSON('/api/html'),getJSON('/api/classes')]); setItems(h.html_modules || []); setClasses(c.classes || []); } catch (e: any) { setError(e.message || 'Bank HTML gagal dimuat.'); } finally { setBusy(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => items.filter(m => (!week || String(m.week) === week) && (!status || m.status === status) && (!search || String(m.title || '').toLowerCase().includes(search.toLowerCase()))), [items,week,status,search]);
  function beginAssign(m: Row) { setModule(m); setTitle('Latihan ' + m.title); setClassId(classes[0]?.id || ''); setDueAt(''); setError(''); setNotice(''); }
  async function submitAssignment(e: React.FormEvent) {
    e.preventDefault(); if (!module) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await postJSON('/api/assignments',{ class_id:classId,html_module_id:module.id,title,due_at:dueAt ? new Date(dueAt).toISOString() : null });
      setNotice('Latihan berhasil ditetapkan ke kelas.'); setModule(null);
    } catch (e: any) { setError(e.message || 'Penugasan gagal dibuat.'); }
    finally { setSaving(false); }
  }
  return <div className="page dashboard-page"><h1 className="h1">Bank HTML</h1><p className="muted">Pilih materi yang sudah disetujui dan diterbitkan admin. Materi yang masih review tidak dapat ditugaskan.</p><ErrorNotice value={error} />{notice && <div className="alert success">{notice}</div>}
    <div className="card form-grid"><div className="field"><label>Cari materi</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Judul materi…" /></div><div className="field"><label>Week</label><select value={week} onChange={e => setWeek(e.target.value)}><option value="">Semua minggu</option>{Array.from({length:19},(_,i) => <option key={i+1} value={String(i+1)}>Week {i+1}</option>)}</select></div><div className="field"><label>Status</label><select value={status} onChange={e => setStatus(e.target.value)}><option value="">Semua status</option><option value="REVIEW_REQUIRED">Review diperlukan</option><option value="APPROVED">Approved</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select></div></div>
    {busy ? <div className="spinner" /> : <div className="card">{filtered.length === 0 ? <Empty>Tidak ada materi sesuai filter.</Empty> : <TableWrap><thead><tr><th>Materi</th><th>Sumber</th><th>Bank</th><th>Status</th><th>Terbit</th><th>Aksi</th></tr></thead><tbody>{filtered.map(m => <tr key={m.id}><td>{m.title}<div className="muted small">v{m.version}</div></td><td>{m.source_session_id || 'Upload guru'}</td><td>{m.linked_question_count ?? '—'} soal tertaut</td><td>{m.status}</td><td>{m.is_published ? 'Ya' : 'Tidak'}</td><td><button className="secondary" onClick={() => window.open('/api/html/' + m.id,'_blank','noopener,noreferrer')}>Preview</button><button onClick={() => beginAssign(m)} disabled={m.status !== 'APPROVED' || !m.is_published}>Tetapkan</button></td></tr>)}</tbody></TableWrap>}</div>}
    {module && <div className="modal-backdrop"><form className="card modal-card" onSubmit={submitAssignment}><div className="page-heading"><h2 className="section-title">Tetapkan materi</h2><button className="secondary" type="button" onClick={() => setModule(null)}>Tutup</button></div><p><strong>{module.title}</strong></p><div className="field"><label>Kelas</label><select value={classId} onChange={e => setClassId(e.target.value)} required>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="field"><label>Judul latihan</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div><div className="field"><label>Batas pengerjaan (opsional)</label><input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} /></div><button type="submit" disabled={saving || !classId}>{saving ? 'Menyimpan…' : 'Buat penugasan'}</button></form></div>}
  </div>;
}

export function TeacherReportsPage() {
  const [classes, setClasses] = useState<Row[]>([]);
  const [classId, setClassId] = useState('');
  const [results, setResults] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { getJSON('/api/classes').then(d => { setClasses(d.classes || []); setClassId(d.classes?.[0]?.id || ''); }).catch(e => setError(e.message || 'Daftar kelas gagal dimuat.')); }, []);
  async function load() { if (!classId) return; setBusy(true); setError(''); try { const d = await getJSON('/api/reports?class_id=' + encodeURIComponent(classId)); setResults(d.results || []); } catch (e: any) { setError(e.message || 'Laporan gagal dimuat.'); } finally { setBusy(false); } }
  function exportCsv() { if (classId) window.location.href = '/api/reports?class_id=' + encodeURIComponent(classId) + '&export=csv'; }
  return <div className="page dashboard-page"><h1 className="h1">Laporan Kelas</h1><ErrorNotice value={error} />
    <div className="card row align-end"><div className="field grow"><label>Pilih kelas</label><select value={classId} onChange={e => setClassId(e.target.value)}><option value="">Pilih kelas</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><button onClick={load} disabled={!classId || busy}>Muat hasil</button><button className="secondary" onClick={exportCsv} disabled={!classId || results.length===0}>Ekspor CSV</button></div>
    <div className="card">{busy ? <div className="spinner" /> : results.length===0 ? <Empty>Pilih kelas lalu muat hasil. Hasil akan tampil setelah siswa mengirim latihan.</Empty> : <TableWrap><thead><tr><th>Siswa</th><th>Email</th><th>Penugasan</th><th>Status</th><th>Skor</th><th>Maks</th><th>Dikirim</th></tr></thead><tbody>{results.map(r => <tr key={r.attempt_id}><td>{r.student_name || '—'}</td><td>{r.student_email}</td><td>{r.assignment_title}</td><td>{r.status}</td><td>{r.score ?? '—'}</td><td>{r.max_score ?? '—'}</td><td>{r.submitted_at || '—'}</td></tr>)}</tbody></TableWrap>}</div>
  </div>;
}

export function StudentDashboardPage() {
  const [classes, setClasses] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [attempts, setAttempts] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setBusy(true); setError(''); try { const [c,a,t] = await Promise.all([getJSON('/api/classes'),getJSON('/api/assignments'),getJSON('/api/attempts')]); setClasses(c.classes || []); setAssignments(a.assignments || []); setAttempts(t.attempts || []); } catch (e: any) { setError(e.message || 'Progres siswa gagal dimuat.'); } finally { setBusy(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const completed = attempts.filter(a => a.status === 'submitted');
  return <div className="page dashboard-page"><div className="page-heading"><div><h1 className="h1">Dashboard Siswa</h1><p className="muted">Kelas, latihan yang harus dikerjakan, dan riwayat hasil belajar.</p></div><button className="secondary" onClick={load}>Muat ulang</button></div><ErrorNotice value={error} />
    <div className="dashboard-grid"><Metric label="Kelas diikuti" value={classes.length} /><Metric label="Latihan tersedia" value={assignments.length} /><Metric label="Latihan selesai" value={completed.length} /><Metric label="Sedang dikerjakan" value={attempts.filter(a => a.status === 'in_progress').length} /></div>
    <div className="card"><h2 className="section-title">Latihan yang tersedia</h2>{busy ? <div className="spinner" /> : assignments.length === 0 ? <Empty>Belum ada latihan yang diberikan guru. Gabung kelas atau hubungi guru.</Empty> : <div className="class-grid">{assignments.slice(0,6).map(a => <div className="card mini-card" key={a.id}><strong>{a.title}</strong><p className="muted small">{a.class_name} · {a.html_title}</p><p className="muted small">{a.due_at ? 'Batas: ' + a.due_at : 'Tanpa batas waktu'}</p><Link to={'/assessment/' + a.id}>Buka latihan</Link></div>)}</div>}</div>
    <div className="card"><h2 className="section-title">Riwayat pengerjaan</h2>{attempts.length===0 ? <Empty>Belum ada pengerjaan.</Empty> : <TableWrap><thead><tr><th>Latihan</th><th>Status</th><th>Skor reading</th><th>Waktu</th></tr></thead><tbody>{attempts.slice(0,10).map(a => <tr key={a.id}><td>{a.assignment_title}</td><td>{a.status}</td><td>{a.score ?? '—'} / {a.max_score ?? '—'}</td><td>{a.submitted_at || a.started_at}</td></tr>)}</tbody></TableWrap>}</div>
  </div>;
}

export function AssessmentViewerPage() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState<Row | null>(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const lockRef = useRef(false);
  useEffect(() => { if (!id) return; setBusy(true); getJSON('/api/assignments').then(d => setAssignment((d.assignments || []).find((a: Row) => a.id === id) || null)).catch(e => setError(e.message || 'Latihan gagal dimuat.')).finally(() => setBusy(false)); }, [id]);
  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.type !== 'FRTS_ATTEMPT_REPORT' || !message.payload || lockRef.current) return;
      const report = message.payload as Row;
      if (!assignment || report.session_id !== assignment.source_session_id) { setError('ID sesi pada laporan tidak cocok dengan penugasan ini.'); return; }
      const answerMap = report.answers && typeof report.answers === 'object' ? report.answers : {};
      if (Object.keys(answerMap).length === 0) { setError('Belum ada jawaban reading yang dapat dikirim.'); return; }
      lockRef.current = true; setError(''); setStatus('Mengirim jawaban dan memeriksa kunci…');
      try {
        const created = await postJSON('/api/attempts', { assignment_id: id });
        const attempt = created.attempt;
        const answers = Object.entries(answerMap).map(([question_id, answer]) => ({ question_id, answer }));
        const submitted = await postJSON('/api/attempts/' + attempt.id + '/submit', {
          answers,
          idempotency_key: attempt.idempotency_key,
          vocabulary_responses: report.vocabulary_responses || {},
          vocabulary_self_assessment: report.vocabulary_self_assessment || {}
        });
        setResult(submitted.attempt); setStatus('Jawaban berhasil diverifikasi server.');
      } catch (e: any) {
        setError(e.message || 'Pengiriman gagal. Unduh laporan offline untuk diserahkan kepada guru.');
        setStatus('Belum terverifikasi');
      } finally { lockRef.current = false; }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [assignment, id]);
  if (busy) return <div className="page"><div className="spinner" /></div>;
  if (!assignment) return <div className="page"><h1 className="h1">Latihan tidak ditemukan</h1><ErrorNotice value={error} /></div>;
  return <div className="page dashboard-page"><h1 className="h1">{assignment.title}</h1><p className="muted">{assignment.class_name} · {assignment.html_title || 'Materi HTML'}</p>
    {assignment.due_at && <p className="muted small">Batas: {assignment.due_at}</p>}
    <div className="notice-card"><strong>Cara mengirim hasil:</strong> selesaikan latihan sampai tahap “Memory Review”, lalu tekan tombol “Kirim hasil ke portal / unduh salinan”. Hasil kosakata dicatat sebagai latihan formatif, terpisah dari skor reading.</div>
    <div className="card preview-wrap"><iframe ref={frameRef} className="viewer" src={'/api/html/' + assignment.html_module_id} title="Latihan FRTS" sandbox="allow-scripts allow-forms" /></div>
    {status && <div className="alert success" aria-live="polite">{status}</div>}<ErrorNotice value={error} />
    {result && <div className="card"><h2 className="section-title">Hasil reading terverifikasi</h2><p><strong>{result.score}</strong> / {result.max_score}</p><p>Status: {result.status}</p><p className="muted small">Jawaban vocabulary disimpan sebagai laporan formatif dan tidak digabung ke skor reading.</p></div>}
  </div>;
}

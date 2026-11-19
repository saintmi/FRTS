import { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getJSON, postJSON, postForm } from './lib/apiClient';
import { AdminDashboardPage, AdminUsersPage, AdminClassesPage, AdminContentPage, AdminReviewPage, AdminAuditPage, AdminReportsPage, TeacherDashboardPage, TeacherHtmlBankPage, TeacherReportsPage, StudentDashboardPage, AssessmentViewerPage, LlmAssistantPage } from './pages/DashboardPages';

function Nav() {
  const { user, logout, loading } = useAuth();
  if (loading || !user) return null;
  return (
    <nav className="nav">
      <span className="brand">FRTS</span>
      <div className="nav-links">
        {user.role === 'ADMIN' && <>
          <Link to="/admin">Dashboard</Link><Link to="/admin/users">Pengguna</Link><Link to="/admin/classes">Kelas</Link><Link to="/admin/content">Bank HTML</Link><Link to="/admin/review">Review</Link><Link to="/admin/audit">Audit Log</Link><Link to="/admin/reports">Laporan</Link><Link to="/ai">AI Workspace</Link>
        </>}
        {user.role === 'TEACHER' && <>
          <Link to="/teacher">Dashboard</Link><Link to="/teacher/classes">Kelas</Link><Link to="/teacher/html-library">Materi</Link><Link to="/teacher/html-bank">Bank HTML</Link><Link to="/teacher/reports">Laporan</Link><Link to="/ai">AI Workspace</Link>
        </>}
        {user.role === 'STUDENT' && <>
          <Link to="/student">Dashboard</Link><Link to="/student/classes">Kelas Saya</Link><Link to="/student/assignments">Latihan</Link><Link to="/student/progress">Progres</Link><Link to="/ai">AI Tutor</Link>
        </>}
      </div>
      <div className="spacer"></div><span className="muted small">{user.email}</span>
      <button className="ghost" onClick={logout}>Keluar</button>
    </nav>
  );
}

// Helper functions
function htmlPreviewUrl(id: string) { return '/api/html/' + id; }

function htmlClassRow(c: any) {
  return (
    <tr key={c.id}>
      <td><Link to={"/teacher/classes/" + c.id}>{c.name}</Link></td>
      <td>{c.description || '-'}</td>
      <td>{c.teacher_email || '-'}</td>
      <td>{c.student_count}</td>
      <td>{c.is_active ? 'Aktif' : 'Nonaktif'}</td>
    </tr>
  );
}

function classMemberRow(m: any) {
  return (
    <tr key={m.user_id}><td>{m.full_name || '-'}</td><td>{m.email}</td><td>{m.joined_at}</td></tr>
  );
}

function htmlLibraryRow(m: any) {
  return (
    <tr key={m.id}>
      <td>{m.title}</td>
      <td>v{m.version}</td>
      <td><span className="badge">{m.status}</span></td>
      <td>{m.is_published ? 'Ya' : 'Tidak'}</td>
      <td><a href={htmlPreviewUrl(m.id)} target="_blank" rel="noopener noreferrer"><button className="secondary ghost" type="button">Preview</button></a></td>
    </tr>
  );
}

function resultAnswerRow(a: any) {
  return (
    <tr key={a.question_id}>
      <td>{a.question_id}</td>
      <td>{a.is_correct ? 'Ya' : 'Tidak'}</td>
      <td>{a.points_earned}</td>
    </tr>
  );
}

function RoleGate({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <div className="page"><div className="alert error">Anda tidak memiliki akses ke halaman ini.</div><Link to="/">Kembali ke dashboard</Link></div>;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <div style={{ minHeight: '100vh' }}>
        <Nav />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/ai" element={<RoleGate roles={['ADMIN','TEACHER','STUDENT']}><LlmAssistantPage /></RoleGate>} />
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<RoleGate roles={['ADMIN']}><AdminDashboardPage /></RoleGate>} />
          <Route path="/admin/users" element={<RoleGate roles={['ADMIN']}><AdminUsersPage /></RoleGate>} />
          <Route path="/admin/classes" element={<RoleGate roles={['ADMIN']}><AdminClassesPage /></RoleGate>} />
          <Route path="/admin/content" element={<RoleGate roles={['ADMIN']}><AdminContentPage /></RoleGate>} />
          <Route path="/admin/review" element={<RoleGate roles={['ADMIN']}><AdminReviewPage /></RoleGate>} />
          <Route path="/admin/audit" element={<RoleGate roles={['ADMIN']}><AdminAuditPage /></RoleGate>} />
          <Route path="/admin/reports" element={<RoleGate roles={['ADMIN']}><AdminReportsPage /></RoleGate>} />
          <Route path="/teacher" element={<RoleGate roles={['TEACHER','ADMIN']}><TeacherDashboardPage /></RoleGate>} />
          <Route path="/teacher/classes" element={<RoleGate roles={['TEACHER','ADMIN']}><TeacherClasses /></RoleGate>} />
          <Route path="/teacher/classes/new" element={<RoleGate roles={['TEACHER','ADMIN']}><ClassCreate /></RoleGate>} />
          <Route path="/teacher/classes/:id" element={<RoleGate roles={['TEACHER','ADMIN','STUDENT']}><ClassDetail /></RoleGate>} />
          <Route path="/teacher/html-library" element={<RoleGate roles={['TEACHER','ADMIN']}><HtmlLibrary /></RoleGate>} />
          <Route path="/teacher/html-bank" element={<RoleGate roles={['TEACHER','ADMIN']}><TeacherHtmlBankPage /></RoleGate>} />
          <Route path="/teacher/html/upload" element={<RoleGate roles={['TEACHER','ADMIN']}><HtmlUpload /></RoleGate>} />
          <Route path="/teacher/html/:id/publish" element={<RoleGate roles={['ADMIN','TEACHER']}><HtmlPublish /></RoleGate>} />
          <Route path="/teacher/reports" element={<RoleGate roles={['TEACHER','ADMIN']}><TeacherReportsPage /></RoleGate>} />
          <Route path="/student" element={<RoleGate roles={['STUDENT']}><StudentDashboardPage /></RoleGate>} />
          <Route path="/student/classes" element={<RoleGate roles={['STUDENT']}><StudentClasses /></RoleGate>} />
          <Route path="/student/assignments" element={<RoleGate roles={['STUDENT']}><StudentAssignments /></RoleGate>} />
          <Route path="/student/progress" element={<RoleGate roles={['STUDENT']}><StudentProgress /></RoleGate>} />
          <Route path="/assessment/:id" element={<RoleGate roles={['STUDENT']}><AssessmentViewerPage /></RoleGate>} />
          <Route path="/results/:id" element={<RoleGate roles={['ADMIN','TEACHER','STUDENT']}><ResultPage /></RoleGate>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

function Home() {
  const { loading, user, isAuthenticated } = useAuth();
  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!isAuthenticated() || !user) return <Login />;
  if (user.role === 'ADMIN') return <AdminDashboardPage />;
  if (user.role === 'TEACHER') return <TeacherDashboardPage />;
  return <StudentDashboardPage />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) { setErr(err.message || 'Login gagal'); }
    finally { setBusy(false); }
  }
  return (
    <div className="page center">
      <div className="card" style={{ maxWidth: 400, margin: '2rem auto' }}>
        <h2 className="h1">Masuk</h2>
        {err && <div className="alert error">{err}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Email</label><input value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button type="submit" disabled={busy}>{busy ? 'Memproses...' : 'Masuk'}</button>
        </form>
      </div>
    </div>
  );
}

function TeacherClasses() {
  const [classes, setClasses] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(true); getJSON('/api/classes').then((d: any) => setClasses(d.classes || [])).finally(() => setBusy(false)); }, []);
  return (
    <div className="page">
      <div className="page-heading"><div><h1 className="h1">Kelas Saya</h1><p className="muted">Kelola kelas, anggota, dan kode undangan.</p></div><Link to="/teacher/classes/new"><button>+ Buat kelas</button></Link></div>
      {busy && <div className="spinner" />}
      {classes.length === 0 && <p className="muted">Belum ada kelas.</p>}
      <table className="table"><thead><tr><th>Nama Kelas</th><th>Deskripsi</th><th>Siswa</th><th>Aksi</th></tr></thead>
        <tbody>{classes.map((c: any) => htmlClassRow(c))}</tbody>
      </table>
    </div>
  );
}

function ClassCreate() {
  const { isRole } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (isRole('STUDENT')) return <div className="page"><p className="muted">Siswa tidak dapat membuat kelas.</p></div>;
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await postJSON('/api/classes', { name, description });
      navigate('/teacher/classes');
    } catch (err: any) { setErr(err.message || 'Gagal membuat kelas'); }
    finally { setBusy(false); }
  }
  return (
    <div className="page">
      <h1 className="h1">Buat Kelas</h1>
      {err && <div className="alert error">{err}</div>}
      <form onSubmit={handleSubmit} className="card">
        <div className="field"><label>Nama Kelas</label><input value={name} onChange={e => setName(e.target.value)} required /></div>
        <div className="field"><label>Deskripsi</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
        <button type="submit" disabled={busy}>{busy ? 'Membuat...' : 'Buat Kelas'}</button>
      </form>
      <Link to="/teacher/classes"><button className="secondary ghost" type="button">Batal</button></Link>
    </div>
  );
}

function studentAttemptRow(a: any) {
  return (
    <tr key={a.id}>
      <td>{a.assignment_title}</td>
      <td>{a.score}</td>
      <td>{a.max_score}</td>
      <td>{a.status}</td>
      <td>{a.submitted_at}</td>
    </tr>
  );
}

function ClassDetail() {
  const { user, isRole } = useAuth();
  const { id } = useParams();
  const [cls, setCls] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invite, setInvite] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [htmlModules, setHtmlModules] = useState<any[]>([]);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [selectedHtml, setSelectedHtml] = useState('');
  const [startAt, setStartAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  useEffect(() => {
    if (!id) return;
    setBusy(true);
    getJSON(`/api/classes/${id}`).then((a: any) => { setCls(a.class); setInvite(a.invite || null); setMembers(a.members || []); }).catch((e: any) => setErr(e.message || 'Detail kelas gagal dimuat.')).finally(() => setBusy(false));
  }, [id]);
  useEffect(() => {
    if (!id || !user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return;
    Promise.all([getJSON('/api/assignments'), getJSON('/api/html')])
      .then(([a, h]: any[]) => {
        setAssignments((a.assignments || []).filter((item: any) => String(item.class_id) === String(id)));
        setHtmlModules((h.html_modules || []).filter((item: any) => item.status === 'APPROVED' && item.is_published));
      })
      .catch((e: any) => setErr(e.message || 'Data penugasan gagal dimuat.'));
  }, [id, user]);
  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedHtml) { setErr('Pilih materi HTML yang sudah disetujui dan diterbitkan.'); return; }
    setErr(''); setBusy(true);
    try {
      await postJSON('/api/assignments', {
        class_id: id, html_module_id: selectedHtml,
        title: assignmentTitle.trim() || htmlModules.find((m: any) => String(m.id) === String(selectedHtml))?.title || 'Latihan',
        start_at: startAt || undefined, due_at: dueAt || undefined
      });
      const data: any = await getJSON('/api/assignments');
      setAssignments((data.assignments || []).filter((item: any) => String(item.class_id) === String(id)));
      setAssignmentTitle(''); setSelectedHtml(''); setStartAt(''); setDueAt('');
    } catch (e: any) { setErr(e.message || 'Gagal membuat penugasan.'); }
    finally { setBusy(false); }
  }
  async function deactivateInvite() {
    setErr(''); setBusy(true);
    try {
      await postJSON(`/api/classes/${id}`, { action: 'deactivate_invite' });
      setInvite(null);
    } catch (err: any) { setErr(err.message || 'Gagal menonaktifkan kode undangan'); }
    finally { setBusy(false); }
  }
  async function genInvite() {
    setErr(''); setBusy(true);
    try {
      const d = await postJSON(`/api/classes/${id}`, { action: 'invite', code: newCode || undefined, max_uses: newMaxUses ? Number(newMaxUses) : undefined, expires_in_days: newExpiry ? Number(newExpiry) : undefined });
      setInvite(d.invite); setNewCode(''); setNewMaxUses(''); setNewExpiry('');
    } catch (err: any) { setErr(err.message || 'Gagal buat kode undangan'); }
    finally { setBusy(false); }
  }
  if (!cls) return <div className="page">{busy ? <div className="spinner" /> : <p className="muted">Memuat...</p>}</div>;
  const canManage = isRole('ADMIN') || (user && cls.teacher_id === user.id);
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h1 className="h1">{cls.name}</h1><Link to="/teacher/classes"><button className="secondary ghost" type="button">Kembali</button></Link>
      </div>
      <p className="muted">{cls.description || '-'}</p>
      {canManage && (
        <>
          <div className="card"><h2 className="h1" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Kode Undangan</h2>
            {invite ? (
              <div className="row"><div className="col"><strong>{invite.code}</strong></div><div className="muted small">Aktif: {invite.is_active ? 'Ya' : 'Tidak'} | Digunakan: {invite.used_count}{invite.max_uses !== null ? `/${invite.max_uses}` : ''} | Expired: {invite.expires_at || '-'}</div><button className="secondary" type="button" onClick={() => setInvite(null)}>Buat kode baru</button>{invite.is_active && <button className="danger" type="button" onClick={deactivateInvite} disabled={busy}>Nonaktifkan kode</button>}</div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); genInvite(); }} className="row" style={{ gap: '0.5rem' }}>
                <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Kode (kosongkan untuk otomatis)" />
                <input value={newMaxUses} onChange={e => setNewMaxUses(e.target.value)} placeholder="Maks penggunaan" type="number" />
                <input value={newExpiry} onChange={e => setNewExpiry(e.target.value)} placeholder="Hari berlaku" type="number" />
                <button type="submit" disabled={busy}>{busy ? '...' : 'Buat Kode'}</button>
              </form>
            )}
            {err && <div className="alert error">{err}</div>}
          </div>
          <div className="card">
            <h2 className="h1" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Buat Penugasan</h2>
            <p className="muted small">Hanya materi HTML berstatus disetujui dan sudah diterbitkan yang dapat diberikan kepada siswa.</p>
            {htmlModules.length === 0 ? <p className="muted">Belum ada materi yang memenuhi syarat. Upload, ajukan review, dan terbitkan materi terlebih dahulu.</p> : (
              <form onSubmit={createAssignment}>
                <div className="field"><label>Materi HTML</label><select value={selectedHtml} onChange={e => setSelectedHtml(e.target.value)} required><option value="">Pilih materi</option>{htmlModules.map((m: any) => <option key={m.id} value={m.id}>{m.title} · v{m.version}</option>)}</select></div>
                <div className="field"><label>Judul penugasan</label><input value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} placeholder="Gunakan judul materi jika dikosongkan" /></div>
                <div className="row">
                  <div className="field"><label>Mulai (opsional)</label><input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} /></div>
                  <div className="field"><label>Tenggat (opsional)</label><input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} /></div>
                </div>
                <button type="submit" disabled={busy || !selectedHtml}>{busy ? 'Menyimpan...' : 'Berikan ke kelas'}</button>
              </form>
            )}
          </div>
          <div className="card">
            <h2 className="h1" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Penugasan Kelas</h2>
            {assignments.length === 0 ? <p className="muted">Belum ada penugasan untuk kelas ini.</p> : (
              <table className="table"><thead><tr><th>Judul</th><th>Materi</th><th>Status</th><th>Mulai</th><th>Tenggat</th></tr></thead><tbody>
                {assignments.map((a: any) => <tr key={a.id}><td>{a.title}</td><td>{a.html_title || a.module_title || a.version || 'Materi HTML'}</td><td>{a.is_active ? 'Aktif' : 'Nonaktif'}</td><td>{a.start_at || 'Segera'}</td><td>{a.due_at || '—'}</td></tr>)}
              </tbody></table>
            )}
          </div>
          <div className="card"><h2 className="h1" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Daftar Siswa</h2>
            {members.length === 0 && <p className="muted">Belum ada siswa.</p>}
            <table className="table"><thead><tr><th>Nama</th><th>Email</th><th>Bergabung</th></tr></thead>
              <tbody>{members.map((m: any) => classMemberRow(m))}</tbody>
            </table>
          </div>
        </>
      )}
      {!canManage && (
        <div className="card"><h2 className="h1" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Detail Kelas</h2>
          <p className="muted">Anda adalah anggota kelas ini.</p><div className="field"><label>Kode undangan</label><input readOnly value={invite?.code || '-'} /></div></div>
      )}
    </div>
  );
}

function HtmlLibrary() {
  const { isRole } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(true); getJSON('/api/html').then((d: any) => setItems(d.html_modules || [])).finally(() => setBusy(false)); }, []);
  if (isRole('STUDENT')) return <div className="page"><p className="muted">Fitur ini untuk guru.</p></div>;
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h1 className="h1">Pustaka Materi HTML</h1><Link to="/teacher/html/upload"><button>Upload HTML</button></Link>
      </div>
      {busy && <div className="spinner" />}
      {!busy && items.length === 0 && <p className="muted">Belum ada materi HTML.</p>}
      {!busy && items.length > 0 && (
        <table className="table"><thead><tr><th>Judul</th><th>Versi</th><th>Status</th><th>Terbitkan</th><th>Aksi</th></tr></thead>
          <tbody>{items.map((m: any) => htmlLibraryRow(m))}</tbody>
        </table>
      )}
    </div>
  );
}

function HtmlUpload() {
  const { isRole } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (isRole('STUDENT')) return <div className="page"><p className="muted">Fitur ini untuk guru.</p></div>;
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!file) return setErr('Pilih file HTML');
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('description', description);
    try { await postForm('/api/html', form); navigate('/teacher/html-library'); }
    catch (err: any) { setErr(err.message || 'Upload gagal'); }
    finally { setBusy(false); }
  }
  return (
    <div className="page">
      <h1 className="h1">Upload Materi HTML</h1>
      {err && <div className="alert error">{err}</div>}
      <form onSubmit={handleSubmit} className="card">
        <div className="field"><label>Judul</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div>
        <div className="field"><label>Deskripsi</label><input value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="field"><label>File HTML</label><input type="file" accept=".html" onChange={e => setFile(e.target.files?.[0] || null)} required /></div>
        <p className="muted small">Maks 2MB, ekstensi .html.</p>
        <button type="submit" disabled={busy}>{busy ? 'Mengunggah...' : 'Upload'}</button>
      </form>
      <Link to="/teacher/html-library"><button className="secondary ghost" type="button">Batal</button></Link>
    </div>
  );
}

function HtmlPublish() {
  const { isRole } = useAuth();
  const { id } = useParams();
  const [meta, setMeta] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!id) return; getJSON(`/api/html/${id}?format=json`).then((d: any) => setMeta(d)).catch(() => {}); }, [id]);
  if (isRole('STUDENT')) return <div className="page"><p className="muted">Fitur ini untuk guru.</p></div>;
  async function togglePublish() {
    setBusy(true);
    try { const next = !meta?.is_published; await postJSON(`/api/html/${id}`, { is_published: next }); setMeta((prev: any) => ({ ...prev, is_published: next })); } catch { void null; }
    finally { setBusy(false); }
  }
  if (!meta) return <div className="page">{busy ? <div className="spinner" /> : <p className="muted">Memuat...</p>}</div>;
  return (
    <div className="page">
      <h1 className="h1">Publikasi Materi</h1>
      <div className="card">
        <p>{meta.title} (v{meta.version})</p>
        <p>Status: {meta.status} | Terbitkan: {meta.is_published ? 'Ya' : 'Tidak'}</p>
        <button type="button" onClick={togglePublish} disabled={busy}>{busy ? 'Memproses...' : meta.is_published ? 'Nonaktifkan' : 'Terbitkan'}</button>
      </div>
      <Link to="/teacher/html-library"><button className="secondary ghost" type="button">Kembali</button></Link>
    </div>
  );
}

function StudentClasses() {
  const { isRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (isRole('STUDENT')) { getJSON('/api/classes').then((d: any) => setClasses(d.classes || [])).catch(() => {}); } }, [isRole]);
  async function joinClass() {
    setErr(''); setBusy(true);
    try { await postJSON('/api/classes/join-by-code', { code }); setClasses([]); getJSON('/api/classes').then((d: any) => setClasses(d.classes || [])).catch(() => {}); }
    catch (err: any) { setErr(err.message || 'Gagal bergabung'); }
    finally { setBusy(false); }
  }
  return (
    <div className="page">
      <h1 className="h1">Kelas Saya</h1>
      <div className="card"><div className="field"><label>Masukkan Kode Undangan</label><input value={code} onChange={e => setCode(e.target.value)} /></div>
        <button type="button" onClick={joinClass} disabled={busy}>{busy ? 'Memproses...' : 'Gabung Kelas'}</button>{err && <div className="alert error">{err}</div>}</div>
      <h2 className="h1" style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Kelas yang Diikuti</h2>
      {classes.length === 0 && <p className="muted">Belum bergabung kelas.</p>}
      <table className="table"><thead><tr><th>Nama Kelas</th><th>Deskripsi</th></tr></thead>
        <tbody>{classes.map((c: any) => <tr key={c.id}><td>{c.name}</td><td>{c.description || '-'}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function StudentAssignments() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    setBusy(true);
    Promise.all([getJSON('/api/assignments'), getJSON('/api/attempts')])
      .then(([a, t]: any[]) => { setAssignments(a.assignments || []); setAttempts(t.attempts || []); })
      .catch(() => {})
      .finally(() => setBusy(false));
  }, []);
  const attemptsByAssignment = new Map(attempts.map(a => [a.assignment_id, a]));
  return (
    <div className="page">
      <h1 className="h1">Latihan Saya</h1>
      {busy && <div className="spinner" />}
      {!busy && assignments.length === 0 && <p className="muted">Belum ada latihan.</p>}
      {!busy && assignments.length > 0 && (
        <div className="row" style={{ flexDirection: 'column', gap: '0.75rem' }}>
          {assignments.map((a: any) => {
            const prior: any = attemptsByAssignment.get(a.id);
            return <div key={a.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                <div><div className="h1" style={{ fontSize: '1.05rem' }}>{a.title}</div><div className="muted small">{a.class_name} · v{a.version} · {a.status}</div>{a.due_at && <div className="muted small">Batas pengerjaan: {a.due_at}</div>}</div>
                {prior?.status === 'submitted' ? <span className="badge">Selesai · {prior.score ?? '—'}/{prior.max_score ?? '—'}</span> : <button onClick={() => navigate('/assessment/' + a.id)}>{prior?.status === 'in_progress' ? 'Lanjutkan' : 'Buka Latihan'}</button>}
              </div>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

function StudentProgress() {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [vocabularyReports, setVocabularyReports] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setBusy(true);
    Promise.all([getJSON('/api/attempts'), getJSON('/api/vocabulary-progress')])
      .then(([a, v]: any[]) => { setAttempts(a.attempts || []); setVocabularyReports(v.vocabulary_reports || []); })
      .catch((e: any) => setError(e.message || 'Progres gagal dimuat.'))
      .finally(() => setBusy(false));
  }, []);
  const stats = (payload: any) => {
    const ratings = Object.values(payload?.vocabulary_self_assessment || {}).filter((x: any) => ['remembered', 'unsure', 'review'].includes(x));
    return {
      remembered: ratings.filter(x => x === 'remembered').length,
      unsure: ratings.filter(x => x === 'unsure').length,
      review: ratings.filter(x => x === 'review').length
    };
  };
  return (
    <div className="page">
      <h1 className="h1">Progres Saya</h1>
      <p className="muted">Skor reading dan refleksi kosakata ditampilkan secara terpisah.</p>
      {error && <div className="alert error">{error}</div>}
      {busy && <div className="spinner" />}
      <div className="card"><h2 className="section-title">Reading Comprehension</h2>
        {attempts.length === 0 ? <p className="muted">Belum ada pengerjaan.</p> :
          <table className="table"><thead><tr><th>Assignment</th><th>Skor</th><th>Maks</th><th>Status</th><th>Waktu</th></tr></thead>
            <tbody>{attempts.map((a: any) => studentAttemptRow(a))}</tbody>
          </table>}
      </div>
      <div className="card"><h2 className="section-title">Vocabulary Recall — formatif</h2><p className="muted small">Pilihan “ingat”, “ragu”, dan “perlu diulang” adalah refleksi pada sesi tertentu, bukan status mastery permanen.</p>
        {vocabularyReports.length === 0 ? <p className="muted">Belum ada laporan latihan kosakata.</p> :
          <table className="table"><thead><tr><th>Sesi</th><th>Latihan</th><th>Ingat</th><th>Ragu</th><th>Perlu diulang</th><th>Waktu</th></tr></thead><tbody>
            {vocabularyReports.map((v: any) => { const x = stats(v.payload); return <tr key={v.report_id}><td>{v.source_session_id || '—'}</td><td>{v.assignment_title}</td><td>{x.remembered}</td><td>{x.unsure}</td><td>{x.review}</td><td>{v.created_at}</td></tr>; })}
          </tbody></table>}
      </div>
    </div>
  );
}

function ResultPage() {
  const { user, isRole } = useAuth();
  const { id } = useParams();
  const [attempt, setAttempt] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  useEffect(() => { getJSON(`/api/attempts/${id}`).then((d: any) => { setAttempt(d.attempt); setAnswers(d.answers || []); }).catch(() => {}); }, [id]);
  if (!attempt) return <div className="page"><div className="spinner" /></div>;
  const canView = isRole('ADMIN') || (user && attempt.student_id === user.id) || isRole('TEACHER');
  if (!canView) return <div className="page"><p className="muted">Forbidden</p></div>;
  return (
    <div className="page">
      <h1 className="h1">Hasil Pengerjaan</h1>
      <div className="card"><p>Assignment: {attempt.assignment_title}</p><p>Skor: <strong>{attempt.score}</strong> / {attempt.max_score}</p><p>Status: {attempt.status}</p><p>Mulai: {attempt.started_at} · Dikirim: {attempt.submitted_at}</p></div>
      <h2 className="h1" style={{ fontSize: '1.1rem', marginTop: '1rem' }}>Jawaban</h2>
      <table className="table"><thead><tr><th>Soal</th><th>Benar</th><th>Poin</th></tr></thead>
        <tbody>{answers.map((a: any) => resultAnswerRow(a))}</tbody>
      </table>
    </div>
  );
}

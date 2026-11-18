import { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getJSON, postJSON, postForm } from './lib/apiClient';
import { AdminDashboardPage, AdminUsersPage, AdminClassesPage, AdminContentPage, AdminReviewPage, AdminAuditPage, AdminReportsPage, TeacherDashboardPage, TeacherHtmlBankPage, TeacherReportsPage, StudentDashboardPage, AssessmentViewerPage } from './pages/DashboardPages';

function Nav() {
  const { user, logout, loading } = useAuth();
  if (loading || !user) return null;
  return (
    <nav className="nav">
      <span className="brand">FRTS</span>
      <div className="nav-links">
        {user.role === 'ADMIN' && <>
          <Link to="/admin">Dashboard</Link><Link to="/admin/users">Pengguna</Link><Link to="/admin/classes">Kelas</Link><Link to="/admin/content">Bank HTML</Link><Link to="/admin/review">Review</Link><Link to="/admin/audit">Audit Log</Link><Link to="/admin/reports">Laporan</Link>
        </>}
        {user.role === 'TEACHER' && <>
          <Link to="/teacher">Dashboard</Link><Link to="/teacher/classes">Kelas</Link><Link to="/teacher/html-library">Materi</Link><Link to="/teacher/html-bank">Bank HTML</Link><Link to="/teacher/reports">Laporan</Link>
        </>}
        {user.role === 'STUDENT' && <>
          <Link to="/student">Dashboard</Link><Link to="/student/classes">Kelas Saya</Link><Link to="/student/assignments">Latihan</Link><Link to="/student/progress">Progres</Link>
        </>}
      </div>
      <div className="spacer"></div><span className="muted small">{user.email}</span>
      <button className="ghost" onClick={logout}>Keluar</button>
    </nav>
  );
}

// Helper functions
function htmlPreviewUrl(id: string) { return '/api/html/' + id; }

function htmlUserRow(u: any) {
  return (
    <tr key={u.id}>
      <td>{u.email}</td>
      <td><span className="badge">{u.role}</span></td>
      <td>{u.is_active ? 'Aktif' : 'Nonaktif'}</td>
      <td>{u.full_name || '-'}</td>
    </tr>
  );
}

function htmlClassRow(c: any) {
  return (
    <tr key={c.id}>
      <td>{c.name}</td>
      <td>{c.description || '-'}</td>
      <td>{c.teacher_email || '-'}</td>
      <td>{c.student_count}</td>
      <td>{c.is_active ? 'Aktif' : 'Nonaktif'}</td>
    </tr>
  );
}

function htmlContentRow(m: any) {
  return (
    <tr key={m.id}>
      <td>{m.title}</td>
      <td>v{m.version}</td>
      <td><span className="badge">{m.status}</span></td>
      <td>{m.is_published ? 'Ya' : 'Tidak'}</td>
      <td>{m.uploaded_by || '-'}</td>
      <td><a href={htmlPreviewUrl(m.id)} target="_blank" rel="noopener noreferrer"><button className="secondary ghost" type="button">Preview</button></a></td>
    </tr>
  );
}

function htmlReviewRow(m: any, setStatus: (id: string, status: string) => void) {
  return (
    <tr key={m.id}>
      <td>{m.title}</td>
      <td>v{m.version}</td>
      <td><span className="badge">{m.status}</span></td>
      <td>
        <button className="secondary" type="button" onClick={() => setStatus(m.id, 'APPROVED')}>Setujui</button>
        <button className="secondary ghost" type="button" onClick={() => setStatus(m.id, 'ARCHIVED')}>Arsipkan</button>
      </td>
    </tr>
  );
}

function htmlBankRow(m: any, assignToClass: (id: string) => void) {
  return (
    <tr key={m.id}>
      <td>{m.title}</td>
      <td>Week {m.week} · Sesi {m.session_no}</td>
      <td>-</td>
      <td><span className="badge">{m.status}</span></td>
      <td>
        <a href={htmlPreviewUrl(m.id)} target="_blank" rel="noopener noreferrer"><button className="secondary ghost" type="button">Preview</button></a>
        <button className="secondary" type="button" onClick={() => assignToClass(m.id)}>Tambah ke Kelas</button>
      </td>
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

function reportRow(r: any) {
  return (
    <tr key={r.attempt_id}>
      <td>{r.student_name}</td>
      <td>{r.student_email}</td>
      <td>{r.assignment_title}</td>
      <td>{r.status}</td>
      <td>{r.score}</td>
      <td>{r.max_score}</td>
      <td>{r.submitted_at}</td>
    </tr>
  );
}

function studentAssignmentRow(a: any) {
  return (
    <div key={a.id} className="card" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div><div className="h1" style={{ fontSize: '1.05rem' }}>{a.title}</div><div className="muted small">{a.class_name} · v{a.version} · {a.html_status}</div>{a.due_at && <div className="muted small">Batas pengerjaan: {a.due_at}</div>}</div>
        <button onClick={() => window.location.href = `/assessment/${a.id}`}>Buka Latihan</button>
      </div>
    </div>
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
        </Routes>/Routes>
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

function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(true);
    Promise.all([
      getJSON('/api/users').catch(() => ({ users: [] })),
      getJSON('/api/classes').catch(() => ({ classes: [] })),
      getJSON('/api/html').catch(() => ({ html_modules: [] })),
      getJSON('/api/attempts').catch(() => ({ attempts: [] }))
    ]).then(([u, c, h, a]) => {
      setStats({ users: u.users?.length || 0, classes: c.classes?.length || 0, html: h.html_modules?.length || 0, attempts: a.attempts?.length || 0 });
    }).finally(() => setBusy(false));
  }, []);
  if (!stats) return <div className="page"><div className="spinner" /></div>;
  return (
    <div className="page">
      <h1 className="h1">Dashboard Admin</h1>
      <div className="row" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="card" style={{ flex: 1 }}><div className="muted small">Pengguna</div><div className="h1" style={{ fontSize: '1.5rem' }}>{stats.users}</div></div>
        <div className="card" style={{ flex: 1 }}><div className="muted small">Kelas</div><div className="h1" style={{ fontSize: '1.5rem' }}>{stats.classes}</div></div>
        <div className="card" style={{ flex: 1 }}><div className="muted small">Materi HTML</div><div className="h1" style={{ fontSize: '1.5rem' }}>{stats.html}</div></div>
        <div className="card" style={{ flex: 1 }}><div className="muted small">Attempts</div><div className="h1" style={{ fontSize: '1.5rem' }}>{stats.attempts}</div></div>
      </div>
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(true); getJSON('/api/users').then((d: any) => setUsers(d.users || [])).finally(() => setBusy(false)); }, []);
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}><h1 className="h1">Manajemen Pengguna</h1></div>
      {busy && <div className="spinner" />}
      <table className="table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Profil</th></tr></thead>
        <tbody>{users.map((u: any) => htmlUserRow(u))}</tbody>
      </table>
    </div>
  );
}

function AdminClasses() {
  const [classes, setClasses] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(true); getJSON('/api/classes').then((d: any) => setClasses(d.classes || [])).finally(() => setBusy(false)); }, []);
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}><h1 className="h1">Manajemen Kelas</h1></div>
      {busy && <div className="spinner" />}
      <table className="table"><thead><tr><th>Nama</th><th>Deskripsi</th><th>Guru</th><th>Siswa</th><th>Status</th></tr></thead>
        <tbody>{classes.map((c: any) => htmlClassRow2(c))}</tbody>
      </table>
    </div>
  );
}

function AdminContent() {
  const [htmls, setHtmls] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(true); getJSON('/api/html').then((d: any) => setHtmls(d.html_modules || [])).finally(() => setBusy(false)); }, []);
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}><h1 className="h1">Manajemen Konten HTML</h1></div>
      {busy && <div className="spinner" />}
      <table className="table"><thead><tr><th>Judul</th><th>Versi</th><th>Status</th><th>Terbitkan</th><th>Uploader</th><th>Aksi</th></tr></thead>
        <tbody>{htmls.map((m: any) => htmlContentRow(m))}</tbody>
      </table>
    </div>
  );
}

function AdminReview() {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(true); getJSON('/api/html').then((d: any) => { const pending = (d.html_modules || []).filter((h: any) => h.status !== 'APPROVED'); setItems(pending); }).finally(() => setBusy(false)); }, []);
  async function setStatus(id: string, status: string) { await postJSON(`/api/html/${id}`, { status }); setItems(items.filter((i: any) => i.id !== id)); }
  return (
    <div className="page">
      <h1 className="h1">Review Konten</h1>
      {busy && <div className="spinner" />}
      {items.length === 0 && <p className="muted">Tidak ada konten yang perlu review.</p>}
      <table className="table"><thead><tr><th>Judul</th><th>Versi</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>{items.map((m: any) => htmlReviewRow(m, setStatus))}</tbody>
      </table>
    </div>
  );
}

function AdminAudit() { return <div className="page"><h1 className="h1">Audit Log</h1><div className="card"><p className="muted">Log aktivitas sistem akan ditampilkan di sini.</p></div></div>; }
function AdminReports() { return <div className="page"><h1 className="h1">Laporan Platform</h1><div className="card"><p className="muted">Laporan keseluruhan platform akan ditampilkan di sini.</p></div></div>; }

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

function TeacherDashboard() {
  const [classes, setClasses] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(true); getJSON('/api/classes').then((d: any) => setClasses(d.classes || [])).finally(() => setBusy(false)); }, []);
  return (
    <div className="page">
      <h1 className="h1">Dashboard Guru</h1>
      <div className="row" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="card" style={{ flex: 1 }}><div className="muted small">Total Kelas</div><div className="h1" style={{ fontSize: '1.5rem' }}>{classes.length}</div></div>
        <div className="card" style={{ flex: 1 }}><div className="muted small">Total Siswa</div><div className="h1" style={{ fontSize: '1.5rem' }}>{classes.reduce((sum, c) => sum + (c.student_count || 0), 0)}</div></div>
      </div>
      <h2 className="h1" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Kelas Saya</h2>
      {busy && <div className="spinner" />}
      {classes.length === 0 && <p className="muted">Belum ada kelas.</p>}
      <table className="table"><thead><tr><th>Nama Kelas</th><th>Deskripsi</th><th>Siswa</th><th>Aksi</th></tr></thead>
        <tbody>{classes.map((c: any) => htmlClassRow2(c))}</tbody>
      </table>
    </div>
  );
}

function htmlClassRow2(c: any) {
  return (
    <tr key={c.id}>
      <td>{c.name}</td>
      <td>{c.description || '-'}</td>
      <td>{c.student_count}</td>
      <td><Link to={`/teacher/classes/${c.id}`}><button className="secondary">Kelola</button></Link></td>
    </tr>
  );
}

function StudentDashboard() {
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(true); Promise.all([getJSON('/api/classes').catch(() => ({ classes: [] })), getJSON('/api/assignments').catch(() => ({ assignments: [] }))]).then(([c, a]) => { setClasses(c.classes || []); setAssignments(a.assignments || []); }).finally(() => setBusy(false)); }, []);
  function navigateTo(path: string) { window.location.href = path; }
  return (
    <div className="page">
      <h1 className="h1">Dashboard Siswa</h1>
      <div className="row" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="card" style={{ flex: 1 }}><div className="muted small">Kelas</div><div className="h1" style={{ fontSize: '1.5rem' }}>{classes.length}</div></div>
        <div className="card" style={{ flex: 1 }}><div className="muted small">Latihan</div><div className="h1" style={{ fontSize: '1.5rem' }}>{assignments.length}</div></div>
      </div>
      <h2 className="h1" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Kelas Saya</h2>
      {busy && <div className="spinner" />}
      {classes.length === 0 && <p className="muted">Belum bergabung kelas.</p>}
      <table className="table"><thead><tr><th>Nama Kelas</th><th>Deskripsi</th></tr></thead>
        <tbody>{classes.map((c: any) => (<tr key={c.id}><td>{c.name}</td><td>{c.description || '-'}</td></tr>))}</tbody>
      </table>
      <h2 className="h1" style={{ fontSize: '1rem', marginTop: '1.5rem' }}>Latihan Saya</h2>
      {assignments.length === 0 && <p className="muted">Belum ada latihan.</p>}
      {assignments.map((a: any) => (
        <div key={a.id} className="card" style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div><div className="h1" style={{ fontSize: '1.05rem' }}>{a.title}</div><div className="muted small">{a.class_name} · {a.due_at ? 'Batas: ' + a.due_at : ''}</div></div>
            <button onClick={() => navigateTo(`/assessment/${a.id}`)}>Buka</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function HtmlBank() {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [week, setWeek] = useState('');
  const [session, setSession] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => { setBusy(true); getJSON('/api/html').then((d: any) => setItems(d.html_modules || [])).finally(() => setBusy(false)); }, []);
  const filtered = items.filter((m: any) => {
    if (week && String(m.week) !== week) return false;
    if (session && String(m.session_no) !== session) return false;
    if (status && m.status !== status) return false;
    if (search && !(m.title || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  async function assignToClass(moduleId: string) {
    const classId = prompt('Masukkan ID kelas:');
    if (!classId) return;
    const title = prompt('Judul assignment:') || 'Tugas ' + (items.find((m: any) => m.id === moduleId)?.title || '');
    const due_at = prompt('Batas pengerjaan (ISO format, kosongkan jika tidak ada):') || null;
    try { await postJSON('/api/assignments', { class_id: classId, html_module_id: moduleId, title, due_at }); alert('Assignment berhasil dibuat!'); }
    catch (e: any) { alert('Gagal: ' + (e.message || 'Terjadi kesalahan')); }
  }
  return (
    <div className="page">
      <h1 className="h1">Bank HTML</h1>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1 }}><label>Minggu</label><input value={week} onChange={e => setWeek(e.target.value)} placeholder="Minggu" /></div>
          <div className="field" style={{ flex: 1 }}><label>Sesi</label><input value={session} onChange={e => setSession(e.target.value)} placeholder="Sesi" /></div>
          <div className="field" style={{ flex: 1 }}><label>Status</label><input value={status} onChange={e => setStatus(e.target.value)} placeholder="Status" /></div>
          <div className="field" style={{ flex: 1 }}><label>Cari</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari judul..." /></div>
        </div>
      </div>
      {busy && <div className="spinner" />}
      <table className="table"><thead><tr><th>Judul</th><th>Sesi</th><th>Jumlah Soal</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>{filtered.map((m: any) => htmlBankRow(m, assignToClass))}</tbody>
      </table>
    </div>
  );
}

function StudentProgress() {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(true); getJSON('/api/attempts').then((d: any) => setAttempts(d.attempts || [])).finally(() => setBusy(false)); }, []);
  return (
    <div className="page">
      <h1 className="h1">Progres Saya</h1>
      {busy && <div className="spinner" />}
      {attempts.length === 0 && <p className="muted">Belum ada pengerjaan.</p>}
      <table className="table"><thead><tr><th>Assignment</th><th>Skor</th><th>Maks</th><th>Status</th><th>Waktu</th></tr></thead>
        <tbody>{attempts.map((a: any) => studentAttemptRow(a))}</tbody>
      </table>
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
  useEffect(() => {
    if (!id) return;
    setBusy(true);
    getJSON(`/api/classes/${id}`).then((a: any) => { setCls(a.class); setInvite(a.invite || null); setMembers(a.members || []); }).catch((e: any) => setErr(e.message || 'Detail kelas gagal dimuat.')).finally(() => setBusy(false));
  }, [id]);
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
              <div className="row"><div className="col"><strong>{invite.code}</strong></div><div className="muted small">Aktif: {invite.is_active ? 'Ya' : 'Tidak'} | Digunakan: {invite.used_count}{invite.max_uses !== null ? `/${invite.max_uses}` : ''} | Expired: {invite.expires_at || '-'}</div></div>
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

function Reports() {
  const { isRole } = useAuth();
  const [classId, setClassId] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  if (isRole('STUDENT')) return <div className="page"><p className="muted">Fitur ini untuk guru.</p></div>;
  async function load() {
    if (!classId) return;
    setBusy(true);
    try { const d = await getJSON(`/api/reports?class_id=${classId}`); setResults(d.results || []); }
    finally { setBusy(false); }
  }
  function exportCsv() { window.location.href = `/api/reports?class_id=${classId}&export=csv`; }
  return (
    <div className="page">
      <h1 className="h1">Laporan Kelas</h1>
      <div className="card">
        <div className="field"><label>Pilih Kelas (masukkan ID kelas)</label><input value={classId} onChange={e => setClassId(e.target.value)} /></div>
        <button type="button" onClick={load} disabled={!classId || busy}>{busy ? 'Memuat...' : 'Muat Hasil'}</button>
        {results.length > 0 && <button type="button" onClick={exportCsv} className="secondary">Ekspor CSV</button>}
      </div>
      {busy && <div className="spinner" />}
      <table className="table"><thead><tr><th>Siswa</th><th>Email</th><th>Assignment</th><th>Status</th><th>Skor</th><th>Maks</th><th>Dikirim</th></tr></thead>
        <tbody>{results.map((r: any) => reportRow(r))}</tbody>
      </table>
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
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { setBusy(true); getJSON('/api/assignments').then((d: any) => setAssignments(d.assignments || [])).finally(() => setBusy(false)); }, []);
  return (
    <div className="page">
      <h1 className="h1">Latihan Saya</h1>
      {busy && <div className="spinner" />}
      {!busy && assignments.length === 0 && <p className="muted">Belum ada latihan.</p>}
      {!busy && assignments.length > 0 && (
        <div className="row" style={{ flexDirection: 'column', gap: '0.75rem' }}>
          {assignments.map((a: any) => (
            <div key={a.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div><div className="h1" style={{ fontSize: '1.05rem' }}>{a.title}</div><div className="muted small">{a.class_name} · v{a.version} · {a.html_status}</div>{a.due_at && <div className="muted small">Batas pengerjaan: {a.due_at}</div>}</div>
                <button onClick={() => navigate(`/assessment/${a.id}`)}>Buka Latihan</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssessmentViewer() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle'|'working'|'submitted'|'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const navigate = useNavigate();
  useEffect(() => { if (!id) return; setBusy(true); getJSON('/api/assignments').then((d: any) => setAssignment((d.assignments || []).find((a: any) => a.id === id))).finally(() => setBusy(false)); }, [id]);
  async function loadHtml() { setBusy(true); try { await (await fetch(`/api/html/${assignment?.html_module_id}`)).text(); } catch { setStatus('error'); } finally { setBusy(false); } }
  async function submitAnswers() {
    setBusy(true);
    try {
      const created = await postJSON('/api/attempts', { assignment_id: id });
      const attempt = created.attempt;
      const submitted = await postJSON(`/api/attempts/${attempt.id}/submit`, { answers: [], idempotency_key: attempt.idempotency_key });
      setResult(submitted.attempt); setStatus('submitted'); navigate(`/results/${attempt.id}`);
    } catch { setStatus('error'); }
    finally { setBusy(false); }
  }
  if (!assignment) return <div className="page">{busy ? <div className="spinner" /> : <p className="muted">Memuat...</p>}</div>;
  return (
    <div className="page">
      <h1 className="h1">{assignment.title}</h1>
      <div className="muted small">{assignment.class_name} · {assignment.html_title} (v{assignment.version})</div>
      {assignment.due_at && <div className="muted small">Batas pengerjaan: {assignment.due_at}</div>}
      <div className="card preview-wrap"><iframe className="viewer" src={`/api/html/${assignment.html_module_id}`} title="Latihan HTML" sandbox="allow-scripts allow-forms" /></div>
      <div className="row" style={{ marginTop: '0.75rem', gap: '0.5rem' }}>
        <button type="button" onClick={submitAnswers} disabled={busy || status === 'submitted'}>{status === 'submitted' ? 'Sudah Dikirim' : 'Kirim Jawaban'}</button>
        {status === 'error' && <button className="secondary" type="button" onClick={loadHtml}>Coba Lagi</button>}
      </div>
      {result && (
        <div className="card"><h2 className="h1" style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>Hasil Pengerjaan</h2>
          <p>Skor: <strong>{result.score}</strong> / {result.max_score}</p>
          <p>Status: {result.status}</p><p>Dikirim: {result.submitted_at}</p>
        </div>
      )}
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

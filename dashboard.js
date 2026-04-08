/* ══════════════════════════════════════════
   CONFIG — Supabase
══════════════════════════════════════════ */
const SB_URL = 'https://oytfhgqhibbcsqbnvwyv.supabase.co/rest/v1';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95dGZoZ3FoaWJiY3NxYm52d3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjgwNDgsImV4cCI6MjA5MDgwNDA0OH0.oX2f-gCIBn8cHvNbgYIrnFc5JeUXtQ_i0AreSqgBWJs';

const TB = {
  STUDENTS      : 'students',
  SUBSCRIPTIONS : 'subscriptions',
  PAYMENTS      : 'payments',
  PROGRAMS      : 'programs',
  ATTENDANCE    : 'attendance',
  SETTINGS      : 'settings',
  LOGS          : 'logs'
};

/* ── Supabase Helpers ── */
function _h(extra = {}) {
  return { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal', ...extra };
}

async function sbRead(table, qs = '') {
  const r = await fetch(`${SB_URL}/${table}?select=*&order=id.asc${qs ? '&' + qs : ''}`, { headers: _h() });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `HTTP ${r.status}`); }
  return r.json();
}

async function sbInsert(table, data) {
  const r = await fetch(`${SB_URL}/${table}`, { method: 'POST', headers: _h(), body: JSON.stringify(data) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `HTTP ${r.status}`); }
}

async function sbInsertReturn(table, data) {
  const r = await fetch(`${SB_URL}/${table}`, { method: 'POST', headers: _h({ 'Prefer': 'return=representation' }), body: JSON.stringify(data) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `HTTP ${r.status}`); }
  const arr = await r.json(); return arr[0] || null;
}

async function sbUpdate(table, id, data) {
  const r = await fetch(`${SB_URL}/${table}?id=eq.${id}`, { method: 'PATCH', headers: _h(), body: JSON.stringify(data) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `HTTP ${r.status}`); }
}

async function sbDelete(table, id) {
  const r = await fetch(`${SB_URL}/${table}?id=eq.${id}`, { method: 'DELETE', headers: _h() });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `HTTP ${r.status}`); }
}

async function sbReadKey(table, key, val) {
  const r = await fetch(`${SB_URL}/${table}?${key}=eq.${encodeURIComponent(val)}&select=*`, { headers: _h() });
  if (!r.ok) return null;
  const arr = await r.json(); return arr[0] || null;
}

async function sbUpsert(table, data) {
  const r = await fetch(`${SB_URL}/${table}`, { method: 'POST', headers: _h({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(data) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `HTTP ${r.status}`); }
}

/* ── Activity Log ── */
async function addLog(action, label) {
  try {
    await fetch(`${SB_URL}/logs`, {
      method: 'POST',
      headers: _h(),
      body: JSON.stringify({ action, label })
    });
    // Keep only last 150 — delete anything beyond
    const r = await fetch(`${SB_URL}/logs?select=id&order=id.desc&offset=150&limit=1`, { headers: _h() });
    const old = await r.json().catch(() => []);
    if (old?.length) {
      await fetch(`${SB_URL}/logs?id=lte.${old[0].id}`, { method: 'DELETE', headers: _h() });
    }
  } catch(e) { /* silent — don't break main flow */ }
}

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let _students    = [];
let _progs       = [];
let _allSubs     = [];   // all subscriptions (for student card + sub counts on programs page)
let _allPayments = [];   // all payments (for student card)
let _progSubs    = [];   // subscriptions for current program
let _progPays    = [];   // payments for current program
let _context     = 'academy';
let _currentProg = null;
let _currentView = 'cards';
let _sidebarOpen = true;
let _activeSection = 'students';
let _subStudentId  = null; // selected student in m-sub modal
let _subMode       = 'single';          // 'single' | 'multi'
let _subMultiSel   = new Set();         // IDs المحددة في وضع التحديد المتعدد
let _deleteProgId         = null;        // ID البرنامج المراد حذفه
let _bulkSelected         = new Set();  // IDs المحددة في الاشتراك الجماعي
let _bulkFilteredStudents = [];         // الطلاب المعروضون بعد الفلتر
let _waSubId              = null;       // ID الاشتراك المفتوح في modal الواتساب
let _commTab       = 'send';     // 'send' | 'templates'
let _commSelected  = new Set();  // IDs المشتركين المحددين في التواصل
let _commQueue     = [];         // قائمة الإرسال الجماعي [{sub, msg}]
let _commQueueIdx  = 0;
let _commTimer     = null;
let _commPaused    = false;
let _commCountdown = 0;

/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */
function renderSidebar() {
  const el = document.getElementById('sidebar-content');
  if (_context === 'academy') {
    el.innerHTML = `
      <div class="nav-section">
        <div class="nav-label">الأكاديمية</div>
        <div class="nav-item ${_activeSection === 'students' ? 'active' : ''}" onclick="switchSection('students')">
          <span class="nav-icon">👥</span><span>سجل الطلاب</span>
        </div>
        <div class="nav-item ${_activeSection === 'programs' ? 'active' : ''}" onclick="switchSection('programs')">
          <span class="nav-icon">📋</span><span>البرامج</span>
        </div>
        <div class="nav-item ${_activeSection === 'logs' ? 'active' : ''}" onclick="switchSection('logs')">
          <span class="nav-icon">🕑</span><span>سجل العمليات</span>
        </div>
        <div class="nav-divider"></div>
        <div class="nav-item" onclick="handleLogout()">
          <span class="nav-icon">🚪</span><span>خروج</span>
        </div>
      </div>`;
  } else {
    const pname = _currentProg ? esc(_currentProg.name) : '';
    el.innerHTML = `
      <div class="nav-section">
        <div class="nav-back" onclick="exitProgram()">← رجوع للأكاديمية</div>
        <div class="prog-context-label">📋 ${pname}</div>
        <div class="nav-item ${_activeSection === 'subscribers' ? 'active' : ''}" onclick="switchSection('subscribers')">
          <span class="nav-icon">👥</span><span>المشتركون</span>
        </div>
        <div class="nav-item ${_activeSection === 'groups' ? 'active' : ''}" onclick="switchSection('groups')">
          <span class="nav-icon">👪</span><span>المجموعات</span>
        </div>
        <div class="nav-item ${_activeSection === 'fees' ? 'active' : ''}" onclick="switchSection('fees')">
          <span class="nav-icon">💰</span><span>الرسوم</span>
        </div>
        <div class="nav-item ${_activeSection === 'attendance' ? 'active' : ''}" onclick="switchSection('attendance')">
          <span class="nav-icon">✅</span><span>التحضير</span>
        </div>
        <div class="nav-item ${_activeSection === 'comm' ? 'active' : ''}" onclick="switchSection('comm')">
          <span class="nav-icon">💬</span><span>التواصل</span>
        </div>
        <div class="nav-item ${_activeSection === 'prog-stats' ? 'active' : ''}" onclick="switchSection('prog-stats')">
          <span class="nav-icon">📊</span><span>الإحصائيات</span>
        </div>
        <div class="nav-divider"></div>
        <div class="nav-item" onclick="handleLogout()">
          <span class="nav-icon">🚪</span><span>خروج</span>
        </div>
      </div>`;
  }
}

function switchSection(name) {
  _activeSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  renderSidebar();
  if (name === 'students')    renderStudents();
  if (name === 'programs')    renderProgs();
  if (name === 'subscribers') renderSubscribers();
  if (name === 'groups')      renderGroups();
  if (name === 'fees')        renderFees();
  if (name === 'attendance')  loadAttStats();
  if (name === 'comm')        { _commSelected.clear(); renderComm(); }
  if (name === 'prog-stats')  renderProgStats();
  if (name === 'logs')        loadLogs();
  if (window.innerWidth <= 760) document.getElementById('sidebar').classList.remove('open');
}

async function enterProgram(prog) {
  _currentProg = prog;
  _context = 'program';
  // Topbar
  const tp = document.getElementById('topbar-prog');
  tp.style.display = '';
  tp.textContent = `← ${prog.name}`;
  // Update title
  document.getElementById('subs-title').textContent = `المشتركون — ${prog.name}`;
  await reloadProgramData();
  switchSection('subscribers');
}

function exitProgram() {
  _context = 'academy';
  _currentProg = null;
  _progSubs = [];
  _progPays = [];
  document.getElementById('topbar-prog').style.display = 'none';
  renderSidebar();
  switchSection('students');
}

async function reloadProgramData() {
  if (!_currentProg) return;
  try {
    const rows = await sbRead(TB.SUBSCRIPTIONS, `programId=eq.${_currentProg.id}`);
    _progSubs = rows.map(mapSub);
  } catch(e) { console.error(e); _progSubs = []; }

  if (_progSubs.length) {
    const ids = _progSubs.map(s => s.id);
    try {
      const rows = await sbRead(TB.PAYMENTS, `subscriptionId=in.(${ids.join(',')})`);
      _progPays = rows.map(mapPay);
    } catch(e) { _progPays = []; }
  } else { _progPays = []; }
}

function mapSub(r) {
  return {
    id:           parseInt(r.id) || 0,
    studentId:    parseInt(r.studentId) || 0,
    studentName:  r.studentName || '',
    phone:        r.phone || '',
    category:     r.category || '',
    programId:    parseInt(r.programId) || 0,
    programName:  r.programName || '',
    groupName:    r.groupName || '',
    subType:      r.subType || r.paymentType || 'كامل',
    startDate:    r.startDate || '',
    endDate:      r.endDate || '',
    sessionCount: parseInt(r.sessionCount) || 0,
    amountDue:    parseFloat(r.amountDue) || 0,
    notes:        r.notes || '',
    status:       subStatus(r.endDate)
  };
}

function mapPay(r) {
  return {
    id:             r.id,
    subscriptionId: parseInt(r.subscriptionId) || 0,
    studentId:      parseInt(r.studentId) || 0,
    amount:         parseFloat(r.amount) || parseFloat(r.paid) || 0,
    paidAt:         r.paidAt || r.date || '',
    method:         r.method || 'نقداً',
    note:           r.note || r.notes || ''
  };
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
async function init() {
  renderSidebar();
  try { await Promise.all([loadStudents(), loadPrograms()]); } catch(e) { console.error(e); }
  // Load all subs and payments for student card / program sub-counts
  try {
    const rows = await sbRead(TB.SUBSCRIPTIONS);
    _allSubs = rows.map(mapSub);
  } catch(e) { _allSubs = []; }
  try {
    const rows = await sbRead(TB.PAYMENTS);
    _allPayments = rows.map(mapPay);
  } catch(e) { _allPayments = []; }
  renderStudents();
}

/* ══════════════════════════════════════════
   STUDENTS
══════════════════════════════════════════ */
async function loadStudents() {
  try {
    const rows = await sbRead(TB.STUDENTS);
    _students = rows.map(r => ({
      id:               parseInt(r.id) || 0,
      fullName:         r.fullName || '',
      phone:            r.phone || '',
      phone2:           r.phone2 || '',
      category:         r.category || '',
      source:           r.source || 'مباشر',
      firstContactDate: r.firstContactDate || '',
      notes:            r.notes || '',
      isArchived:       !!r.isArchived,
      createdAt:        r.createdAt || ''
    })).filter(s => s.id > 0);
  } catch(e) { console.error('[STUDENTS]', e); toast('تعذر تحميل الطلاب', 'error'); }
  renderStudents();
  renderStudentStats();
}

function renderStudentStats() {
  const active  = _students.filter(s => !s.isArchived);
  const arch    = _students.filter(s => s.isArchived).length;
  const subscribed = active.filter(s => _allSubs.some(sub => sub.studentId === s.id && subStatus(sub.endDate) === 'نشط')).length;
  document.getElementById('st-stats').innerHTML = `
    <div class="stat-card"><div class="stat-lbl">إجمالي الطلاب</div><div class="stat-val">${active.length}</div></div>
    <div class="stat-card"><div class="stat-lbl">مشترك حالياً</div><div class="stat-val">${subscribed}</div></div>
    <div class="stat-card"><div class="stat-lbl">غير مشترك</div><div class="stat-val">${active.length - subscribed}</div></div>
    <div class="stat-card"><div class="stat-lbl">مؤرشف</div><div class="stat-val">${arch}</div></div>`;
}

function renderStudents() {
  const q   = (document.getElementById('st-search')?.value || '').toLowerCase();
  const src = document.getElementById('st-source-filter')?.value || '';
  const st  = document.getElementById('st-status-filter')?.value || '';

  let d = st === 'مؤرشف' ? [..._students.filter(s => s.isArchived)]
                          : [..._students.filter(s => !s.isArchived)];

  if (st === 'مشترك')    d = d.filter(s => _allSubs.some(sub => sub.studentId === s.id && subStatus(sub.endDate) === 'نشط'));
  if (st === 'غير مشترك') d = d.filter(s => !_allSubs.some(sub => sub.studentId === s.id && subStatus(sub.endDate) === 'نشط'));
  if (src) d = d.filter(s => s.source === src);
  if (q)   d = d.filter(s => s.fullName.toLowerCase().includes(q) || s.phone.includes(q));

  const tbody = document.getElementById('students-tbody');
  document.getElementById('st-count').textContent = `${d.length} طالب`;

  if (!d.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty"><div class="ei">👥</div><p>لا يوجد طلاب</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = d.map((s, i) => {
    const subs    = _allSubs.filter(sub => sub.studentId === s.id);
    const progs   = [...new Set(subs.map(sub => sub.programName).filter(Boolean))].join('، ') || '—';
    const isActive = subs.some(sub => subStatus(sub.endDate) === 'نشط');
    const badge   = s.isArchived ? `<span class="badge b-archived">مؤرشف</span>`
                  : isActive    ? `<span class="badge b-active">مشترك</span>`
                  :               `<span class="badge b-visitor">غير مشترك</span>`;
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(s.fullName)}</strong></td>
      <td dir="ltr">${s.phone}</td>
      <td dir="ltr">${s.phone2 || '—'}</td>
      <td>${s.category || '—'}</td>
      <td>${s.source}</td>
      <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${progs}">${progs}</td>
      <td>${fmtDate(s.firstContactDate) || '—'}</td>
      <td>
        <div class="actions">
          <button class="abt abt-view"    title="بطاقة الطالب"  onclick="openStudentCard(${s.id})">👁️</button>
          <button class="abt abt-edit"    title="تعديل"          onclick="openEditStudent(${s.id})">✏️</button>
          <button class="abt abt-archive" title="${s.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}" onclick="archiveStudent(${s.id},${s.isArchived})">🗃️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAddStudent() {
  document.getElementById('m-student-title').textContent = 'إضافة طالب';
  ['st-id','st-name','st-phone','st-phone2','st-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('st-cat').value          = '';
  document.getElementById('st-source').value       = 'مباشر';
  document.getElementById('st-contact-date').value = today();
  openM('m-student');
}

function openEditStudent(id) {
  const s = _students.find(x => x.id === id); if (!s) return;
  document.getElementById('m-student-title').textContent = '✏️ تعديل بيانات الطالب';
  document.getElementById('st-id').value           = s.id;
  document.getElementById('st-name').value         = s.fullName;
  document.getElementById('st-phone').value        = s.phone;
  document.getElementById('st-phone2').value       = s.phone2;
  document.getElementById('st-cat').value          = s.category;
  document.getElementById('st-source').value       = s.source;
  document.getElementById('st-contact-date').value = s.firstContactDate;
  document.getElementById('st-notes').value        = s.notes;
  openM('m-student');
}

async function saveStudent() {
  const id       = parseInt(document.getElementById('st-id').value) || 0;
  const fullName = document.getElementById('st-name').value.trim();
  const phone    = document.getElementById('st-phone').value.trim();
  if (!fullName || !phone) { toast('يرجى إدخال الاسم ورقم الجوال', 'error'); return; }

  const data = {
    fullName, phone,
    phone2:           document.getElementById('st-phone2').value.trim(),
    category:         document.getElementById('st-cat').value,
    source:           document.getElementById('st-source').value,
    firstContactDate: document.getElementById('st-contact-date').value || null,
    notes:            document.getElementById('st-notes').value.trim()
  };

  try {
    if (id) {
      const i = _students.findIndex(s => s.id === id);
      if (i !== -1) Object.assign(_students[i], data);
      await sbUpdate(TB.STUDENTS, id, data);
      toast('تم تعديل بيانات الطالب ✅');
      addLog('edit_student', `عدّل بيانات الطالب: ${data.fullName}`);
    } else {
      const created = await sbInsertReturn(TB.STUDENTS, { ...data, isArchived: false });
      if (created) _students.push({ id: parseInt(created.id), ...data, isArchived: false, createdAt: created.createdAt || '' });
      toast('تم إضافة الطالب ✅');
      addLog('add_student', `أضاف طالباً جديداً: ${data.fullName}`);
    }
    closeM('m-student');
    renderStudents();
    renderStudentStats();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

async function archiveStudent(id, isArchived) {
  if (!confirm(isArchived ? 'إلغاء أرشفة هذا الطالب؟' : 'أرشفة هذا الطالب؟')) return;
  const i = _students.findIndex(s => s.id === id); if (i === -1) return;
  _students[i].isArchived = !isArchived;
  sbUpdate(TB.STUDENTS, id, { isArchived: !isArchived }).catch(console.error);
  const stName = _students.find(s => s.id === id)?.fullName || '';
  addLog(isArchived ? 'unarchive_student' : 'archive_student', `${isArchived ? 'أعاد' : 'أرشف'} الطالب: ${stName}`);
  toast(isArchived ? 'تم إلغاء الأرشفة ✅' : 'تم الأرشفة ✅');
  renderStudents(); renderStudentStats();
}

function openStudentCard(id) {
  const s = _students.find(x => x.id === id); if (!s) return;
  const subs = _allSubs.filter(sub => sub.studentId === id);

  const subsHtml = subs.length ? subs.map(sub => {
    const pays  = _allPayments.filter(p => p.subscriptionId === sub.id);
    const paid  = pays.reduce((a, p) => a + p.amount, 0);
    const prog  = _progs.find(p => p.id === sub.programId);
    const due   = sub.amountDue || prog?.fullFee || 0;
    const rem   = Math.max(0, due - paid);
    return `<div class="sub-entry">
      <div class="sub-entry-hdr">
        <strong>${esc(sub.programName || '—')}</strong>
        ${sub.groupName ? `<span style="font-size:.78rem;color:var(--muted)">${esc(sub.groupName)}</span>` : ''}
        <span class="badge b-${sub.status === 'نشط' ? 'active' : 'expired'}">${sub.status}</span>
      </div>
      <div class="sub-entry-meta">
        <span>النوع: ${sub.subType}</span>
        <span>البداية: ${fmtDate(sub.startDate)}</span>
        <span>النهاية: ${fmtDate(sub.endDate)}</span>
        <span>المدفوع: ${paid.toLocaleString()} ر.س | المتبقي: <strong style="color:${rem > 0 ? 'var(--danger)' : 'var(--success)'}">${rem.toLocaleString()} ر.س</strong></span>
      </div>
    </div>`;
  }).join('') : `<div style="color:var(--muted);text-align:center;padding:16px">لا توجد اشتراكات مسجلة</div>`;

  document.getElementById('m-sc-title').textContent = `بطاقة: ${s.fullName}`;
  document.getElementById('m-sc-body').innerHTML = `
    <div class="sc-grid">
      <div class="sc-item"><b>الاسم:</b> ${esc(s.fullName)}</div>
      <div class="sc-item"><b>الجوال:</b> <span dir="ltr">${s.phone}</span></div>
      ${s.phone2 ? `<div class="sc-item"><b>جوال 2:</b> <span dir="ltr">${s.phone2}</span></div>` : ''}
      <div class="sc-item"><b>المرحلة:</b> ${s.category || '—'}</div>
      <div class="sc-item"><b>المصدر:</b> ${s.source}</div>
      <div class="sc-item"><b>أول تواصل:</b> ${fmtDate(s.firstContactDate) || '—'}</div>
      ${s.notes ? `<div class="sc-item" style="grid-column:1/-1"><b>ملاحظات:</b> ${esc(s.notes)}</div>` : ''}
    </div>
    <h4 style="color:var(--primary);margin-bottom:10px;font-size:.9rem">الاشتراكات (${subs.length})</h4>
    ${subsHtml}`;
  openM('m-sc');
}

/* ══════════════════════════════════════════
   PROGRAMS
══════════════════════════════════════════ */
async function loadPrograms() {
  try {
    const rows = await sbRead(TB.PROGRAMS);
    _progs = rows.map(r => ({
      id:         parseInt(r.id) || 0,
      name:       r.name || '',
      startDate:  r.startDate || '',
      endDate:    r.endDate || '',
      fullFee:    parseFloat(r.fullFee) || 0,
      groupCount: parseInt(r.groupCount) || 2,
      groups:     r.groups || '',
      days:       parseDays(r.days),
      status:     r.status || 'نشط',
      notes:      r.notes || ''
    })).filter(p => p.id > 0);
  } catch(e) { console.error('[PROGS]', e); toast('تعذر تحميل البرامج', 'error'); }
  renderProgs();
}

function parseDays(raw) {
  if (!raw) return ['الأحد','الاثنين','الثلاثاء','الأربعاء'];
  try { const d = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(d) && d.length ? d : ['الأحد','الاثنين','الثلاثاء','الأربعاء']; }
  catch { return ['الأحد','الاثنين','الثلاثاء','الأربعاء']; }
}

function progSubCount(progId) {
  return new Set(_allSubs.filter(s => s.programId === progId).map(s => s.studentId)).size;
}

function renderProgs() {
  const q  = (document.getElementById('prog-search')?.value || '').toLowerCase();
  const st = document.getElementById('prog-status-filter')?.value || '';
  let d = [..._progs];
  if (st) d = d.filter(p => p.status === st);
  if (q)  d = d.filter(p => p.name.toLowerCase().includes(q));
  d.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  renderProgTable(d);
}

function renderProgTable(d) {
  const tbody = document.getElementById('prog-tbody');
  if (!d.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="ei">📊</div><p>لا توجد برامج</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = d.map(p => {
    const days    = calcDaysBetween(p.startDate, p.endDate);
    const cnt     = progSubCount(p.id);
    const daysStr = p.days.length ? p.days.join('، ') : '—';
    const statusCls = p.status === 'نشط' ? 'active' : p.status === 'موقوف' ? 'paused' : 'expired';
    return `<tr class="prog-row" onclick="enterProg(${p.id})" title="اضغط للدخول إلى البرنامج">
      <td>
        <div style="font-weight:700;margin-bottom:3px">${esc(p.name)}</div>
        <span class="badge b-${statusCls}">${p.status}</span>
      </td>
      <td style="text-align:center">
        <strong style="font-size:1.05rem">${days}</strong><br>
        <span style="font-size:.7rem;color:var(--muted)">يوم</span>
      </td>
      <td>${p.fullFee.toLocaleString()} <span style="font-size:.75rem;color:var(--muted)">ر.س</span></td>
      <td style="text-align:center"><strong>${p.groupCount}</strong></td>
      <td style="text-align:center"><strong style="font-size:1.05rem">${cnt}</strong></td>
      <td>
        <div class="actions" onclick="event.stopPropagation()">
          <button class="abt abt-edit"   title="تعديل"     onclick="openEditProg(${p.id})">✏️</button>
          <button class="abt"            title="تمديد"     onclick="openExtend(${p.id})" style="background:#e0f2fe;color:#0284c7">📅</button>
          <button class="abt abt-delete" title="حذف نهائي" onclick="openDeleteProg(${p.id})">🗑️</button>
        </div>
      </td>
      <td>
        <span style="font-size:.76rem;color:var(--muted);line-height:1.6">
          📅 ${fmtDate(p.startDate)} — ${fmtDate(p.endDate)}<br>
          🗓️ ${daysStr}
        </span>
      </td>
    </tr>`;
  }).join('');
}

function enterProg(id) {
  const p = _progs.find(x => x.id === id); if (!p) return;
  enterProgram(p);
}


function renderGroupInputs() {
  const n = parseInt(document.getElementById('p-group-count').value) || 2;
  let html = '<div class="fg" style="margin-bottom:12px"><label>أسماء المجموعات</label><div style="display:flex;flex-direction:column;gap:6px">';
  for (let i = 1; i <= n; i++)
    html += `<input type="text" id="g-${i}" placeholder="اسم المجموعة ${i}" style="border:1px solid var(--border);border-radius:7px;padding:8px 11px;font-family:inherit;font-size:.88rem;background:var(--bg)">`;
  html += '</div></div>';
  document.getElementById('p-groups-wrap').innerHTML = html;
}

function openAddProg() {
  document.getElementById('m-prog-title').textContent = '➕ برنامج جديد';
  ['p-id','p-name','p-start','p-end','p-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('p-fee').value         = '600';
  document.getElementById('p-group-count').value = '2';
  document.getElementById('p-status').value      = 'نشط';
  // Default days: Sun-Wed
  document.querySelectorAll('input[name="prog-day"]').forEach(cb => {
    cb.checked = ['الأحد','الاثنين','الثلاثاء','الأربعاء'].includes(cb.value);
  });
  renderGroupInputs();
  openM('m-prog');
}

function openEditProg(id) {
  const p = _progs.find(x => x.id === id); if (!p) return;
  document.getElementById('m-prog-title').textContent = '✏️ تعديل البرنامج';
  document.getElementById('p-id').value          = p.id;
  document.getElementById('p-name').value        = p.name;
  document.getElementById('p-start').value       = p.startDate;
  document.getElementById('p-end').value         = p.endDate;
  document.getElementById('p-fee').value         = p.fullFee;
  document.getElementById('p-group-count').value = p.groupCount;
  document.getElementById('p-status').value      = p.status;
  document.getElementById('p-notes').value       = p.notes;
  document.querySelectorAll('input[name="prog-day"]').forEach(cb => { cb.checked = p.days.includes(cb.value); });
  renderGroupInputs();
  if (p.groups) {
    p.groups.split('،').map(s => s.trim()).forEach((name, i) => {
      const el = document.getElementById(`g-${i + 1}`); if (el) el.value = name;
    });
  }
  openM('m-prog');
}

async function saveProg() {
  const id      = parseInt(document.getElementById('p-id').value) || 0;
  const name    = document.getElementById('p-name').value.trim();
  const startDate = document.getElementById('p-start').value;
  const endDate   = document.getElementById('p-end').value;
  const fullFee   = parseFloat(document.getElementById('p-fee').value) || 0;
  const groupCnt  = parseInt(document.getElementById('p-group-count').value) || 2;
  const status    = document.getElementById('p-status').value;
  const notes     = document.getElementById('p-notes').value.trim();
  if (!name || !startDate || !endDate) { toast('يرجى ملء الحقول الإجبارية', 'error'); return; }

  const days = [...document.querySelectorAll('input[name="prog-day"]:checked')].map(cb => cb.value);
  const groupNames = [];
  for (let i = 1; i <= groupCnt; i++) {
    const el = document.getElementById(`g-${i}`); if (el?.value.trim()) groupNames.push(el.value.trim());
  }
  const groups = groupNames.join('، ');

  const data = { name, startDate, endDate, fullFee, groupCount: groupCnt, groups, days: JSON.stringify(days), status, notes };

  try {
    if (id) {
      const i = _progs.findIndex(p => p.id === id);
      if (i !== -1) Object.assign(_progs[i], { ...data, days });
      await sbUpdate(TB.PROGRAMS, id, data);
      toast('تم تعديل البرنامج ✅');
      addLog('edit_program', `عدّل البرنامج: ${name}`);
    } else {
      const created = await sbInsertReturn(TB.PROGRAMS, data);
      if (created) _progs.push({ id: parseInt(created.id), ...data, days });
      toast('تم إضافة البرنامج ✅');
      addLog('add_program', `أضاف برنامجاً جديداً: ${name}`);
    }
    closeM('m-prog'); renderProgs();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

function openExtend(id) {
  const p = _progs.find(x => x.id === id); if (!p) return;
  document.getElementById('ext-id').value  = p.id;
  document.getElementById('ext-name').value = p.name;
  document.getElementById('ext-cur').value  = fmtDate(p.endDate);
  document.getElementById('ext-days').value = '';
  document.getElementById('ext-new').value  = p.endDate;
  openM('m-extend');
}

function calcExtend() {
  const pid  = parseInt(document.getElementById('ext-id').value);
  const p    = _progs.find(x => x.id === pid); if (!p) return;
  const days = parseInt(document.getElementById('ext-days').value) || 0;
  if (!days) return;
  const d = new Date(p.endDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  document.getElementById('ext-new').value = d.toISOString().split('T')[0];
}

async function saveExtend() {
  const pid    = parseInt(document.getElementById('ext-id').value);
  const newEnd = document.getElementById('ext-new').value;
  if (!newEnd) { toast('يرجى تحديد تاريخ النهاية', 'error'); return; }
  const i = _progs.findIndex(p => p.id === pid); if (i === -1) return;
  _progs[i].endDate = newEnd;
  await sbUpdate(TB.PROGRAMS, pid, { endDate: newEnd }).catch(console.error);
  addLog('extend_program', `مدّد البرنامج: ${_progs[i].name} حتى ${fmtDate(newEnd)}`);
  toast('تم تمديد البرنامج ✅'); closeM('m-extend'); renderProgs();
}

/* ══════════════════════════════════════════
   SUBSCRIBERS (Program Level)
══════════════════════════════════════════ */
function getSubPayInfo(sub) {
  const pays = _progPays.filter(p => p.subscriptionId === sub.id);
  const paid = pays.reduce((a, p) => a + p.amount, 0);
  const due  = sub.amountDue || _currentProg?.fullFee || 0;
  const rem  = Math.max(0, due - paid);
  let payStatus = 'لم يدفع';
  if (due > 0 && paid >= due) payStatus = 'مسدد';
  else if (paid > 0) payStatus = 'جزئي';
  return { paid, due, rem, payStatus };
}

function renderSubscriberStats() {
  const totalDue  = _progSubs.reduce((a, s) => a + (s.amountDue || _currentProg?.fullFee || 0), 0);
  const totalPaid = _progSubs.reduce((a, s) => a + getSubPayInfo(s).paid, 0);
  document.getElementById('subs-stats').innerHTML = `
    <div class="stat-card"><div class="stat-lbl">عدد المشتركين</div><div class="stat-val">${_progSubs.length}</div></div>
    <div class="stat-card"><div class="stat-lbl">إجمالي المستحق</div><div class="stat-val">${totalDue.toLocaleString()}</div></div>
    <div class="stat-card"><div class="stat-lbl">إجمالي المدفوع</div><div class="stat-val">${totalPaid.toLocaleString()}</div></div>
    <div class="stat-card"><div class="stat-lbl">المتبقي</div><div class="stat-val">${Math.max(0, totalDue - totalPaid).toLocaleString()}</div></div>`;
}

function renderSubscribers() {
  if (!_currentProg) return;
  renderSubscriberStats();

  const q    = (document.getElementById('subs-search')?.value || '').toLowerCase();
  const pst  = document.getElementById('subs-pay-filter')?.value || '';
  const durF = document.getElementById('subs-dur-filter')?.value || '';
  const sort = document.getElementById('subs-sort')?.value || 'alpha';
  const now  = new Date(); now.setHours(0, 0, 0, 0);

  let d = [..._progSubs];

  if (pst) d = d.filter(s => getSubPayInfo(s).payStatus === pst);
  if (durF) {
    d = d.filter(s => {
      if (!s.endDate) return false;
      const diff = Math.ceil((new Date(s.endDate + 'T00:00:00') - now) / 86400000);
      if (durF === 'منتهي') return diff < 0;
      return diff >= 0 && diff <= parseInt(durF);
    });
  }
  if (q) d = d.filter(s => s.studentName.toLowerCase().includes(q) || s.phone.includes(q));
  if (sort === 'alpha') d.sort((a, b) => a.studentName.localeCompare(b.studentName));
  if (sort === 'group') d.sort((a, b) => (a.groupName || '').localeCompare(b.groupName || ''));

  document.getElementById('subs-count').textContent = `${d.length} مشترك`;
  const tbody = document.getElementById('subs-tbody');
  if (!d.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty"><div class="ei">👥</div><p>لا يوجد مشتركون</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = d.map((s, i) => {
    const { paid, rem, payStatus } = getSubPayInfo(s);
    const payIcon = payStatus === 'مسدد' ? '🟢' : payStatus === 'جزئي' ? '🟡' : '🔴';
    const statusBadge = `<span class="badge b-${s.status === 'نشط' ? 'active' : 'expired'}">${s.status}</span>`;
    return `<tr>
      <td>${i + 1}</td>
      <td>
        <strong>${esc(s.studentName)}</strong><br>
        <small style="color:var(--muted)" dir="ltr">${s.phone}</small>
      </td>
      <td>${s.groupName || '—'}</td>
      <td>${s.subType}</td>
      <td>${fmtDate(s.startDate)}</td>
      <td>${fmtDate(s.endDate)} ${statusBadge}</td>
      <td style="text-align:center">${s.sessionCount || '—'}</td>
      <td>${paid.toLocaleString()} ر.س</td>
      <td>${rem > 0 ? `<strong style="color:var(--danger)">${rem.toLocaleString()} ر.س</strong>` : '<span style="color:var(--success)">✅</span>'}</td>
      <td>
        <div class="actions">
          <button class="abt abt-wa"    title="إرسال واتساب" onclick="openWhatsApp(${s.id})">📱</button>
          <button class="abt abt-pay"   title="الدفعات"  onclick="openSubPayments(${s.id})">💰</button>
          <button class="abt abt-edit"  title="تعديل"    onclick="openEditSub(${s.id})">✏️</button>
          <button class="abt abt-delete" title="حذف"     onclick="deleteProgSub(${s.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── Add Subscriber Modal ── */
function openAddSub() {
  if (!_currentProg) return;
  _subStudentId = null;
  _subMode = 'single';
  _subMultiSel.clear();
  document.getElementById('sub-edit-id').value      = '';
  document.getElementById('sub-student-id').value   = '';
  document.getElementById('sub-student-search').value = '';
  document.getElementById('sub-student-results').style.display = 'none';
  document.getElementById('sub-selected-student').style.display = 'none';
  document.getElementById('sub-new-wrap').style.display = 'none';
  document.getElementById('sub-new-btn').textContent = '➕ طالب جديد غير موجود؟';
  document.getElementById('sub-single-wrap').style.display = '';
  document.getElementById('sub-multi-wrap').style.display  = 'none';
  document.getElementById('sub-mode-single-btn').classList.add('active');
  document.getElementById('sub-mode-multi-btn').classList.remove('active');

  const groups = (_currentProg.groups || '').split('،').map(s => s.trim()).filter(Boolean);
  document.getElementById('sub-group').innerHTML =
    '<option value="">اختر المجموعة</option>' + groups.map(g => `<option>${g}</option>`).join('');

  document.getElementById('sub-type').value        = 'كامل';
  document.getElementById('sub-start').value       = todayDate();
  document.getElementById('sub-end').value         = _currentProg.endDate || '';
  document.getElementById('sub-amount-due').value  = _currentProg.fullFee || '';
  document.getElementById('sub-pay-date').value    = todayDate();
  document.getElementById('sub-pay-amount').value  = '';
  document.getElementById('sub-pay-note').value    = '';
  document.getElementById('sub-notes').value       = '';

  const sessions = calcSessions(todayDate(), _currentProg.endDate || '', _currentProg.days);
  document.getElementById('sub-sessions').value = sessions || '';

  document.getElementById('m-sub-title').textContent = '➕ إضافة مشترك';
  openM('m-sub');
}

/* ── وضع الاختيار: فردي / متعدد ── */
function setSubMode(mode) {
  _subMode = mode;
  document.getElementById('sub-mode-single-btn').classList.toggle('active', mode === 'single');
  document.getElementById('sub-mode-multi-btn').classList.toggle('active', mode === 'multi');
  document.getElementById('sub-single-wrap').style.display   = mode === 'single' ? '' : 'none';
  document.getElementById('sub-multi-wrap').style.display    = mode === 'multi'  ? '' : 'none';
  document.getElementById('sub-new-wrap').style.display      = 'none';
  document.getElementById('sub-new-btn').textContent         = '➕ طالب جديد غير موجود؟';
  document.getElementById('m-sub-title').textContent =
    mode === 'multi' ? '➕ إضافة مشتركين (متعدد)' : '➕ إضافة مشترك';
  if (mode === 'multi') { _subMultiSel.clear(); renderSubMultiList(); }
}

function renderSubMultiList() {
  const q    = (document.getElementById('sub-multi-search')?.value || '').toLowerCase();
  const list = document.getElementById('sub-multi-list');
  // استبعاد المشتركين الحاليين في البرنامج
  const currentIds = new Set(_progSubs.map(s => s.studentId));
  let filtered = _students.filter(s => !s.isArchived && !currentIds.has(s.id));
  if (q) filtered = filtered.filter(s => s.fullName.toLowerCase().includes(q) || s.phone.includes(q));

  document.getElementById('sub-multi-count').textContent =
    _subMultiSel.size ? `✅ ${_subMultiSel.size} محدد` : `${filtered.length} طالب`;

  if (!filtered.length) {
    list.innerHTML = '<div class="bulk-empty">لا يوجد طلاب غير مشتركين</div>'; return;
  }
  list.innerHTML = filtered.map(s => `
    <div class="bulk-student-item ${_subMultiSel.has(s.id) ? 'selected' : ''}" onclick="toggleSubMultiStudent(${s.id})">
      <input type="checkbox" ${_subMultiSel.has(s.id) ? 'checked' : ''} onclick="event.stopPropagation();toggleSubMultiStudent(${s.id})" style="accent-color:var(--primary);width:14px;height:14px;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div class="bulk-st-name">${esc(s.fullName)}</div>
        <div class="bulk-st-meta" dir="ltr">${s.phone}</div>
      </div>
    </div>`).join('');
}

function toggleSubMultiStudent(id) {
  if (_subMultiSel.has(id)) _subMultiSel.delete(id);
  else _subMultiSel.add(id);
  renderSubMultiList();
}

function toggleSubMultiAll(cb) {
  const q = (document.getElementById('sub-multi-search')?.value || '').toLowerCase();
  const currentIds = new Set(_progSubs.map(s => s.studentId));
  let filtered = _students.filter(s => !s.isArchived && !currentIds.has(s.id));
  if (q) filtered = filtered.filter(s => s.fullName.toLowerCase().includes(q) || s.phone.includes(q));
  if (cb.checked) filtered.forEach(s => _subMultiSel.add(s.id));
  else _subMultiSel.clear();
  renderSubMultiList();
}

function searchStudentsForSub() {
  const q   = document.getElementById('sub-student-search').value.toLowerCase();
  const res = document.getElementById('sub-student-results');
  if (!q || q.length < 2) { res.style.display = 'none'; return; }
  const matches = _students.filter(s => !s.isArchived && (s.fullName.toLowerCase().includes(q) || s.phone.includes(q))).slice(0, 8);
  if (!matches.length) {
    res.innerHTML = '<div class="search-item" style="color:var(--muted)">لا نتائج</div>';
  } else {
    res.innerHTML = matches.map(s =>
      `<div class="search-item" onclick="selectStudentForSub(${s.id})">
        <span><strong>${esc(s.fullName)}</strong></span>
        <span dir="ltr" style="color:var(--muted);font-size:.8rem">${s.phone}</span>
      </div>`
    ).join('');
  }
  res.style.display = '';
}

function selectStudentForSub(id) {
  const s = _students.find(x => x.id === id); if (!s) return;
  _subStudentId = id;
  document.getElementById('sub-student-id').value     = id;
  document.getElementById('sub-student-search').value = '';
  document.getElementById('sub-student-results').style.display = 'none';
  document.getElementById('sub-selected-student').style.display = '';
  document.getElementById('sub-selected-student').innerHTML = `
    <div class="selected-student">
      <span>👤 <strong>${esc(s.fullName)}</strong> — <span dir="ltr">${s.phone}</span></span>
      <button onclick="clearSelectedStudent()" title="إلغاء">✕</button>
    </div>`;
  document.getElementById('sub-new-wrap').style.display   = 'none';
  document.getElementById('sub-new-btn').style.display    = 'none';
}

function clearSelectedStudent() {
  _subStudentId = null;
  document.getElementById('sub-student-id').value = '';
  document.getElementById('sub-selected-student').style.display = 'none';
  document.getElementById('sub-new-btn').style.display = '';
}

function toggleNewStudent() {
  const wrap = document.getElementById('sub-new-wrap');
  const btn  = document.getElementById('sub-new-btn');
  if (wrap.style.display === 'none') {
    wrap.style.display = '';
    btn.textContent = '✕ إلغاء';
    clearSelectedStudent();
    document.getElementById('sub-selected-student').style.display = 'none';
  } else {
    wrap.style.display = 'none';
    btn.textContent = '➕ طالب جديد غير موجود؟';
  }
}

function onSubTypeChange() {
  if (document.getElementById('sub-type').value === 'كامل' && _currentProg?.endDate) {
    document.getElementById('sub-end').value = _currentProg.endDate;
    onSubDatesChange();
  }
}

function onSubDatesChange() {
  const start = document.getElementById('sub-start').value;
  const end   = document.getElementById('sub-end').value;
  if (start && end && _currentProg) {
    const sessions = calcSessions(start, end, _currentProg.days);
    document.getElementById('sub-sessions').value = sessions || '';
  }
}

function onSessionsChange() {
  const start    = document.getElementById('sub-start').value;
  const sessions = parseInt(document.getElementById('sub-sessions').value) || 0;
  if (start && sessions > 0 && _currentProg) {
    const endDate = calcEndFromSessions(start, sessions, _currentProg.days);
    if (endDate) document.getElementById('sub-end').value = endDate;
  }
}

async function saveSub() {
  if (!_currentProg) return;

  // ── وضع التحديد المتعدد ──
  if (_subMode === 'multi') {
    if (!_subMultiSel.size) { toast('يرجى تحديد طالب واحد على الأقل', 'error'); return; }
    const groupName = document.getElementById('sub-group').value;
    const subType   = document.getElementById('sub-type').value;
    const startDate = document.getElementById('sub-start').value;
    const endDate   = document.getElementById('sub-end').value;
    const sessions  = parseInt(document.getElementById('sub-sessions').value) || 0;
    const amountDue = parseFloat(document.getElementById('sub-amount-due').value) || 0;
    const notes     = document.getElementById('sub-notes').value.trim();
    const payAmt    = parseFloat(document.getElementById('sub-pay-amount').value) || 0;
    const payDate   = document.getElementById('sub-pay-date').value;
    const payMethod = document.getElementById('sub-pay-method').value;
    const payNote   = document.getElementById('sub-pay-note').value;
    if (!startDate || !endDate) { toast('يرجى تحديد تواريخ الاشتراك', 'error'); return; }

    const ids = [..._subMultiSel];
    let done = 0;
    try {
      for (const sid of ids) {
        const st = _students.find(s => s.id === sid); if (!st) continue;
        const subData = {
          studentId: sid, studentName: st.fullName, phone: st.phone, category: st.category || '',
          programId: _currentProg.id, programName: _currentProg.name,
          groupName, subType, paymentType: subType,
          startDate, endDate, sessionCount: sessions, amountDue,
          status: subStatus(endDate)
        };
        const created = await sbInsertReturn(TB.SUBSCRIPTIONS, subData);
        const subId = created ? parseInt(created.id) : Date.now() + done;
        _progSubs.push({ id: subId, ...subData });
        _allSubs.push({ id: subId, ...subData });
        if (payAmt > 0) {
          const payData = {
            subscriptionId: subId,
            amount: payAmt, paidAt: payDate,
            method: payMethod, note: payNote
          };
          await sbInsert(TB.PAYMENTS, payData);
          _progPays.push({ id: Date.now() + done, subscriptionId: subId, studentId: sid, amount: payAmt, paidAt: payDate, method: payMethod, note: payNote });
          _allPayments.push({ id: Date.now() + done + 1, subscriptionId: subId, studentId: sid, amount: payAmt, paidAt: payDate, method: payMethod, note: payNote });
        }
        done++;
      }
      addLog('bulk_subscribe', `اشتراك جماعي: ${done} طالب ← ${_currentProg.name}`);
      toast(`تم إضافة ${done} مشترك بنجاح ✅`);
      closeM('m-sub');
      renderSubscribers();
      renderStudentStats();
    } catch(e) { toast('خطأ: ' + e.message, 'error'); }
    return;
  }

  // ── وضع الطالب الفردي ──
  let studentId = parseInt(document.getElementById('sub-student-id').value) || 0;
  let studentName = '', studentPhone = '', studentCat = '';

  const newWrap = document.getElementById('sub-new-wrap');
  if (newWrap.style.display !== 'none' && !studentId) {
    const nsName  = document.getElementById('ns-name').value.trim();
    const nsPhone = document.getElementById('ns-phone').value.trim();
    const nsCat   = document.getElementById('ns-cat').value;
    const nsSrc   = document.getElementById('ns-source').value;
    if (!nsName || !nsPhone) { toast('يرجى إدخال اسم وجوال الطالب', 'error'); return; }
    try {
      const created = await sbInsertReturn(TB.STUDENTS, { fullName: nsName, phone: nsPhone, phone2: '', category: nsCat, source: nsSrc, firstContactDate: todayDate(), notes: '', isArchived: false });
      if (created) {
        studentId   = parseInt(created.id);
        const newSt = { id: studentId, fullName: nsName, phone: nsPhone, phone2: '', category: nsCat, source: nsSrc, firstContactDate: todayDate(), notes: '', isArchived: false, createdAt: created.createdAt || '' };
        _students.push(newSt);
        studentName = nsName; studentPhone = nsPhone; studentCat = nsCat;
      }
    } catch(e) { toast('خطأ في إنشاء الطالب: ' + e.message, 'error'); return; }
  } else if (studentId) {
    const st = _students.find(s => s.id === studentId);
    studentName = st?.fullName || ''; studentPhone = st?.phone || ''; studentCat = st?.category || '';
  }

  if (!studentId) { toast('يرجى اختيار طالب أو إضافة طالب جديد', 'error'); return; }

  const editId     = parseInt(document.getElementById('sub-edit-id').value) || 0;
  const subType    = document.getElementById('sub-type').value;
  const groupName  = document.getElementById('sub-group').value;
  const startDate  = document.getElementById('sub-start').value;
  const endDate    = document.getElementById('sub-end').value;
  const sessions   = parseInt(document.getElementById('sub-sessions').value) || 0;
  const amountDue  = parseFloat(document.getElementById('sub-amount-due').value) || 0;
  const notes      = document.getElementById('sub-notes').value.trim();

  if (!startDate || !endDate) { toast('يرجى تحديد تواريخ الاشتراك', 'error'); return; }

  try {
    let subId = editId;
    if (!editId) {
      const subData = {
        studentId, studentName, phone: studentPhone, category: studentCat,
        programId: _currentProg.id, programName: _currentProg.name,
        groupName, subType, paymentType: subType,
        startDate, endDate, sessionCount: sessions, amountDue,
        status: subStatus(endDate)
      };
      const created = await sbInsertReturn(TB.SUBSCRIPTIONS, subData);
      subId = created ? parseInt(created.id) : Date.now();
      _progSubs.push({ id: subId, ...subData });
      _allSubs.push({ id: subId, ...subData });
    } else {
      const upd = { groupName, subType, paymentType: subType, startDate, endDate, sessionCount: sessions, amountDue };
      const i = _progSubs.findIndex(s => s.id === editId);
      if (i !== -1) Object.assign(_progSubs[i], upd);
      const ai = _allSubs.findIndex(s => s.id === editId);
      if (ai !== -1) Object.assign(_allSubs[ai], upd);
      await sbUpdate(TB.SUBSCRIPTIONS, editId, upd);
    }

    // First payment
    const payAmt = parseFloat(document.getElementById('sub-pay-amount').value) || 0;
    if (!editId && payAmt > 0) {
      const payData = {
        subscriptionId: subId,
        amount: payAmt,
        paidAt: document.getElementById('sub-pay-date').value,
        method: document.getElementById('sub-pay-method').value,
        note:   document.getElementById('sub-pay-note').value
      };
      await sbInsert(TB.PAYMENTS, payData);
      _progPays.push({ id: Date.now(), subscriptionId: subId, studentId, amount: payAmt, paidAt: payData.date, method: payData.method, note: payData.note });
      _allPayments.push({ id: Date.now() + 1, subscriptionId: subId, studentId, amount: payAmt, paidAt: payData.date, method: payData.method, note: payData.note });
    }

    const subStName = _students.find(s => s.id === studentId)?.fullName || studentName;
    if (editId) {
      addLog('edit_sub', `عدّل اشتراك ${subStName} في ${_currentProg?.name || ''}`);
    } else {
      addLog('add_sub', `أضاف اشتراكاً: ${subStName} ← ${_currentProg?.name || ''}`);
    }
    toast(editId ? 'تم تعديل الاشتراك ✅' : 'تم إضافة الاشتراك ✅');
    closeM('m-sub');
    renderSubscribers();
    renderStudentStats();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

function openEditSub(subId) {
  const s = _progSubs.find(x => x.id === subId); if (!s) return;
  document.getElementById('m-sub-title').textContent  = '✏️ تعديل الاشتراك';
  document.getElementById('sub-edit-id').value        = s.id;
  document.getElementById('sub-student-id').value     = s.studentId;
  _subStudentId = s.studentId;
  document.getElementById('sub-selected-student').style.display = '';
  document.getElementById('sub-selected-student').innerHTML = `
    <div class="selected-student">
      <span>👤 <strong>${esc(s.studentName)}</strong> — <span dir="ltr">${s.phone}</span></span>
    </div>`;
  document.getElementById('sub-student-search').value = '';
  document.getElementById('sub-new-wrap').style.display  = 'none';
  document.getElementById('sub-new-btn').style.display   = 'none';

  const groups = (_currentProg?.groups || '').split('،').map(g => g.trim()).filter(Boolean);
  document.getElementById('sub-group').innerHTML =
    '<option value="">اختر المجموعة</option>' + groups.map(g => `<option ${g === s.groupName ? 'selected' : ''}>${g}</option>`).join('');
  document.getElementById('sub-type').value       = s.subType || 'كامل';
  document.getElementById('sub-start').value      = s.startDate;
  document.getElementById('sub-end').value        = s.endDate;
  document.getElementById('sub-sessions').value   = s.sessionCount || '';
  document.getElementById('sub-amount-due').value = s.amountDue || '';
  document.getElementById('sub-notes').value      = s.notes || '';
  openM('m-sub');
}

async function deleteProgSub(subId) {
  if (!confirm('حذف هذا الاشتراك؟')) return;
  const i = _progSubs.findIndex(s => s.id === subId); if (i === -1) return;
  _progSubs.splice(i, 1);
  const ai = _allSubs.findIndex(s => s.id === subId);
  if (ai !== -1) _allSubs.splice(ai, 1);
  const delSubName = _progSubs.find(s => s.id === subId)?.studentName || '';
  sbDelete(TB.SUBSCRIPTIONS, subId).catch(console.error);
  addLog('delete_sub', `حذف اشتراك ${delSubName} من ${_currentProg?.name || ''}`);
  toast('تم حذف الاشتراك ✅');
  renderSubscribers();
}

/* ── Payment History ── */
function openSubPayments(subId) {
  const sub = _progSubs.find(s => s.id === subId); if (!sub) return;
  document.getElementById('m-pay-sub-id').value = subId;
  document.getElementById('m-payments-title').textContent = `دفعات: ${sub.studentName}`;
  document.getElementById('new-pay-date').value   = todayDate();
  document.getElementById('new-pay-amount').value = '';
  document.getElementById('new-pay-note').value   = '';
  renderPaymentsList(subId);
  openM('m-payments');
}

function renderPaymentsList(subId) {
  const sub  = _progSubs.find(s => s.id === subId); if (!sub) return;
  const pays = _progPays.filter(p => p.subscriptionId === subId);
  const paid = pays.reduce((a, p) => a + p.amount, 0);
  const due  = sub.amountDue || _currentProg?.fullFee || 0;
  const rem  = Math.max(0, due - paid);

  const body = document.getElementById('m-payments-body');
  body.innerHTML = `
    <div class="pay-summary">
      <span>المستحق: <b>${due.toLocaleString()} ر.س</b></span>
      <span>المدفوع: <b style="color:var(--success)">${paid.toLocaleString()} ر.س</b></span>
      <span>المتبقي: <b style="color:${rem > 0 ? 'var(--danger)' : 'var(--success)'}">${rem.toLocaleString()} ر.س</b></span>
    </div>
    ${pays.length ? pays.map((p, i) => `
      <div class="pay-entry">
        <div>
          <span class="pay-entry-amount">${p.amount.toLocaleString()} ر.س</span>
          <span class="pay-entry-meta" style="margin-right:8px">${p.method}</span>
          ${p.note ? `<span class="pay-entry-meta">— ${p.note}</span>` : ''}
        </div>
        <div class="pay-entry-meta">${fmtDate(p.paidAt)}</div>
      </div>`).join('')
    : `<div style="color:var(--muted);text-align:center;padding:12px;font-size:.85rem">لا توجد دفعات مسجلة بعد</div>`}`;
}

async function saveNewPayment() {
  const subId  = parseInt(document.getElementById('m-pay-sub-id').value) || 0;
  const amount = parseFloat(document.getElementById('new-pay-amount').value) || 0;
  const paidAt = document.getElementById('new-pay-date').value;
  const method = document.getElementById('new-pay-method').value;
  const note   = document.getElementById('new-pay-note').value.trim();
  if (!subId)    { toast('خطأ: لا يوجد اشتراك', 'error'); return; }
  if (amount <= 0) { toast('يرجى إدخال مبلغ صحيح', 'error'); return; }

  const sub = _progSubs.find(s => s.id === subId);
  try {
    await sbInsert(TB.PAYMENTS, {
      subscriptionId: subId,
      amount, paidAt, method, note
    });
    const newPay = { id: Date.now(), subscriptionId: subId, studentId: sub?.studentId || 0, amount, paidAt, method, note };
    _progPays.push(newPay);
    _allPayments.push({ ...newPay });
    addLog('add_payment', `دفعة ${amount.toLocaleString()} ر.س — ${sub?.studentName || ''} (${_currentProg?.name || ''})`);
    toast('تم تسجيل الدفعة ✅');
    document.getElementById('new-pay-amount').value = '';
    document.getElementById('new-pay-note').value   = '';
    renderPaymentsList(subId);
    renderSubscribers();
    renderFees();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

/* ══════════════════════════════════════════
   GROUPS (Program Level)
══════════════════════════════════════════ */
function renderGroups() {
  if (!_currentProg) return;
  const groups = (_currentProg.groups || '').split('،').map(s => s.trim()).filter(Boolean);
  const tbody = document.getElementById('groups-tbody');
  if (!groups.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty"><div class="ei">👪</div><p>لا توجد مجموعات — أضف مجموعة للبدء</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = groups.map((g, i) => {
    const cnt = _progSubs.filter(s => s.groupName === g).length;
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(g)}</strong></td>
      <td>${cnt}</td>
      <td>
        <div class="actions">
          <button class="abt abt-edit"   onclick="editGroupName(${i},'${esc(g)}')" title="تعديل">✏️</button>
          <button class="abt abt-delete" onclick="deleteGroup(${i})"               title="حذف">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function saveGroupsToDb() {
  if (!_currentProg) return;
  await sbUpdate(TB.PROGRAMS, _currentProg.id, { groups: _currentProg.groups }).catch(console.error);
  const i = _progs.findIndex(p => p.id === _currentProg.id);
  if (i !== -1) _progs[i].groups = _currentProg.groups;
}

async function addGroup() {
  const name = prompt('اسم المجموعة الجديدة:'); if (!name?.trim()) return;
  const groups = (_currentProg.groups || '').split('،').map(s => s.trim()).filter(Boolean);
  groups.push(name.trim());
  _currentProg.groups = groups.join('، ');
  await saveGroupsToDb();
  toast('تم إضافة المجموعة ✅'); renderGroups();
}

async function editGroupName(idx, oldName) {
  const newName = prompt('الاسم الجديد:', oldName);
  if (!newName?.trim() || newName.trim() === oldName) return;
  const groups = (_currentProg.groups || '').split('،').map(s => s.trim()).filter(Boolean);
  groups[idx] = newName.trim();
  _currentProg.groups = groups.join('، ');
  // Update subscriptions that have old group name
  const toUpdate = _progSubs.filter(s => s.groupName === oldName);
  toUpdate.forEach(s => {
    s.groupName = newName.trim();
    sbUpdate(TB.SUBSCRIPTIONS, s.id, { groupName: newName.trim() }).catch(console.error);
    const ai = _allSubs.findIndex(x => x.id === s.id);
    if (ai !== -1) _allSubs[ai].groupName = newName.trim();
  });
  await saveGroupsToDb();
  toast('تم تعديل اسم المجموعة ✅'); renderGroups();
}

async function deleteGroup(idx) {
  const groups = (_currentProg.groups || '').split('،').map(s => s.trim()).filter(Boolean);
  if (!confirm(`حذف المجموعة "${groups[idx]}"؟`)) return;
  groups.splice(idx, 1);
  _currentProg.groups = groups.join('، ');
  await saveGroupsToDb();
  toast('تم حذف المجموعة ✅'); renderGroups();
}

/* ══════════════════════════════════════════
   FEES (Program Level)
══════════════════════════════════════════ */
function renderFees() {
  if (!_currentProg) return;
  const q  = (document.getElementById('fees-search')?.value || '').toLowerCase();
  const st = document.getElementById('fees-status-filter')?.value || '';

  let d = _progSubs.map(s => {
    const { paid, due, rem, payStatus } = getSubPayInfo(s);
    return { ...s, paid, due, rem, payStatus };
  });
  if (st) d = d.filter(x => x.payStatus === st);
  if (q)  d = d.filter(x => x.studentName.toLowerCase().includes(q));

  const req  = d.reduce((a, x) => a + x.due, 0);
  const paid = d.reduce((a, x) => a + x.paid, 0);
  const rem  = d.reduce((a, x) => a + x.rem, 0);
  const rate = req > 0 ? Math.round(paid / req * 100) : 0;

  document.getElementById('fees-kpi').innerHTML = `
    <div class="kpi-card kpi-blue"><div class="kpi-lbl">إجمالي المستحق</div><div class="kpi-val">${req.toLocaleString()}</div><div class="kpi-sub">ريال</div></div>
    <div class="kpi-card kpi-green"><div class="kpi-lbl">إجمالي المحصّل</div><div class="kpi-val">${paid.toLocaleString()}</div><div class="kpi-sub">ريال</div></div>
    <div class="kpi-card kpi-red"><div class="kpi-lbl">إجمالي المتبقي</div><div class="kpi-val">${rem.toLocaleString()}</div><div class="kpi-sub">ريال</div></div>
    <div class="kpi-card kpi-gold"><div class="kpi-lbl">نسبة التحصيل</div><div class="kpi-val">${rate}%</div></div>`;

  const tbody = document.getElementById('fees-tbody');
  if (!d.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="ei">💰</div><p>لا توجد بيانات</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = d.map((x, i) => {
    const icon = x.payStatus === 'مسدد' ? '🟢' : x.payStatus === 'جزئي' ? '🟡' : '🔴';
    const bc   = x.payStatus === 'مسدد' ? 'b-paid' : x.payStatus === 'جزئي' ? 'b-part-pay' : 'b-unpaid';
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(x.studentName)}</strong><br><small dir="ltr" style="color:var(--muted)">${x.phone}</small></td>
      <td>${x.due.toLocaleString()} ر.س</td>
      <td>${x.paid.toLocaleString()} ر.س</td>
      <td>${x.rem > 0 ? `<strong style="color:var(--danger)">${x.rem.toLocaleString()} ر.س</strong>` : '<span style="color:var(--success)">—</span>'}</td>
      <td>${icon} <span class="badge ${bc}">${x.payStatus}</span></td>
      <td>
        <div class="actions">
          <button class="abt abt-pay"  title="إضافة دفعة"  onclick="openSubPayments(${x.id})">💰</button>
          <button class="abt abt-view" title="سجل الدفعات" onclick="openSubPayments(${x.id})">📋</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════
   ATTENDANCE STATS (Program Level - Read Only)
══════════════════════════════════════════ */
async function loadAttStats() {
  if (!_currentProg) {
    document.getElementById('att-stats-body').innerHTML = `<div class="empty"><div class="ei">✅</div><p>ادخل برنامجاً لعرض إحصائيات التحضير</p></div>`;
    return;
  }
  document.getElementById('att-stats-body').innerHTML = `<div class="empty"><div class="ei">⏳</div><p>جاري التحميل…</p></div>`;
  try {
    const allAtt = await sbRead(TB.ATTENDANCE, `programId=eq.${_currentProg.id}`);
    if (!allAtt.length) {
      document.getElementById('att-stats-body').innerHTML = `<div class="empty"><div class="ei">✅</div><p>لا توجد بيانات تحضير بعد لهذا البرنامج</p></div>`;
      return;
    }
    const total   = new Set(_progSubs.map(s => s.studentId)).size || 1;
    const present = allAtt.filter(a => a.status === 'حاضر').length;
    const absent  = allAtt.filter(a => a.status === 'غائب').length;
    const late    = allAtt.filter(a => a.status === 'متأخر').length;
    const sessions = [...new Set(allAtt.map(a => a.date))].length || 1;
    const avgPct  = Math.round((present + late) / (sessions * total) * 100) || 0;
    const dates   = [...new Set(allAtt.map(a => a.date))].sort().slice(-4).reverse();

    document.getElementById('att-stats-body').innerHTML = `
      <div class="att-stat-row">
        <div class="att-stat-card"><div class="asv">${avgPct}%</div><div class="asl">متوسط الحضور</div></div>
        <div class="att-stat-card"><div class="asv">${sessions}</div><div class="asl">جلسات مسجلة</div></div>
        <div class="att-stat-card"><div class="asv">${present}</div><div class="asl">حاضر</div></div>
        <div class="att-stat-card"><div class="asv">${absent}</div><div class="asl">غائب</div></div>
        <div class="att-stat-card"><div class="asv">${late}</div><div class="asl">متأخر</div></div>
      </div>
      ${dates.length ? `
      <div class="table-card"><div class="tbl-wrap"><table>
        <thead><tr><th>التاريخ</th><th>حاضر</th><th>غائب</th><th>متأخر</th><th>نسبة الحضور</th></tr></thead>
        <tbody>${dates.map(date => {
          const da = allAtt.filter(a => a.date === date);
          const dp = da.filter(a => a.status === 'حاضر').length;
          const dab= da.filter(a => a.status === 'غائب').length;
          const dl = da.filter(a => a.status === 'متأخر').length;
          const pct= total > 0 ? Math.round((dp + dl) / total * 100) : 0;
          return `<tr>
            <td>${fmtDate(date)}</td><td>${dp}</td><td>${dab}</td><td>${dl}</td>
            <td>
              <div style="display:flex;align-items:center;gap:6px">
                <div class="bar-track" style="width:80px;height:10px">
                  <div class="bar-fill" style="width:${pct}%;background:${pct>=80?'var(--success)':pct>=50?'var(--warning)':'var(--danger)'}"></div>
                </div>
                <span style="font-size:.8rem">${pct}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div></div>` : ''}`;
  } catch(e) {
    document.getElementById('att-stats-body').innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>تعذر تحميل بيانات التحضير</p></div>`;
  }
}

async function saveAttPwd() {
  const pwd = document.getElementById('att-pwd-input').value.trim();
  if (!pwd) { toast('يرجى إدخال كلمة المرور', 'error'); return; }
  try {
    await sbUpsert(TB.SETTINGS, { key: 'attendance_password', value: pwd });
    toast('تم حفظ كلمة مرور التحضير ✅');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

/* ══════════════════════════════════════════
   PROGRAM STATISTICS
══════════════════════════════════════════ */
function renderProgStats() {
  if (!_currentProg) return;
  const subs   = _progSubs;
  const active = subs.filter(s => s.status === 'نشط').length;
  const expired= subs.filter(s => s.status === 'منتهي').length;
  const totalDue = subs.reduce((a, s) => a + (s.amountDue || _currentProg.fullFee || 0), 0);
  const totalPaid= subs.reduce((a, s) => a + getSubPayInfo(s).paid, 0);
  const rate   = totalDue > 0 ? Math.round(totalPaid / totalDue * 100) : 0;

  document.getElementById('prog-stats-kpi').innerHTML = `
    <div class="kpi-card kpi-blue"><div class="kpi-lbl">إجمالي المشتركين</div><div class="kpi-val">${subs.length}</div></div>
    <div class="kpi-card kpi-green"><div class="kpi-lbl">نشط</div><div class="kpi-val">${active}</div></div>
    <div class="kpi-card kpi-purple"><div class="kpi-lbl">منتهي</div><div class="kpi-val">${expired}</div></div>
    <div class="kpi-card kpi-gold"><div class="kpi-lbl">المستحق</div><div class="kpi-val">${totalDue.toLocaleString()}</div><div class="kpi-sub">ريال</div></div>
    <div class="kpi-card kpi-green"><div class="kpi-lbl">المحصّل</div><div class="kpi-val">${totalPaid.toLocaleString()}</div><div class="kpi-sub">ريال</div></div>
    <div class="kpi-card kpi-red"><div class="kpi-lbl">نسبة التحصيل</div><div class="kpi-val">${rate}%</div></div>`;

  // Chart: by group
  const grpMap = {};
  subs.forEach(s => { const g = s.groupName || 'غير محدد'; grpMap[g] = (grpMap[g] || 0) + 1; });
  const grpItems = Object.entries(grpMap).sort((a, b) => b[1] - a[1]);
  const maxG = grpItems[0]?.[1] || 1;
  document.getElementById('chart-groups').innerHTML = grpItems.length
    ? grpItems.map(([g, n]) => `<div class="bar-item"><span class="bar-lbl" title="${esc(g)}">${esc(g)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/maxG*100)}%"></div></div><span class="bar-num">${n}</span></div>`).join('')
    : '<p style="color:var(--muted);font-size:.85rem;text-align:center;padding:16px">لا بيانات</p>';

  // Chart: payment status
  const paidC   = subs.filter(s => getSubPayInfo(s).payStatus === 'مسدد').length;
  const partC   = subs.filter(s => getSubPayInfo(s).payStatus === 'جزئي').length;
  const unpaidC = subs.filter(s => getSubPayInfo(s).payStatus === 'لم يدفع').length;
  document.getElementById('chart-payment').innerHTML = `
    <div class="legend-row"><span class="l-dot" style="background:#10b981"></span><span class="l-lbl">مسدد بالكامل</span><span class="l-val">${paidC}</span></div>
    <div class="legend-row"><span class="l-dot" style="background:#f59e0b"></span><span class="l-lbl">جزئي</span><span class="l-val">${partC}</span></div>
    <div class="legend-row"><span class="l-dot" style="background:#ef4444"></span><span class="l-lbl">لم يدفع</span><span class="l-val">${unpaidC}</span></div>`;
  document.getElementById('chart-collection-bar').innerHTML = `
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:4px">نسبة التحصيل الكلية</div>
    <div class="progress-bar-full"><div class="bar-fill" style="width:${rate}%;background:${rate>=80?'var(--success)':rate>=50?'var(--warning)':'var(--danger)'}"></div></div>
    <div style="text-align:center;font-weight:700;color:var(--primary);margin-top:4px">${rate}%</div>`;

  // Chart: sub status
  document.getElementById('chart-sub-status').innerHTML = `
    <div class="legend-row"><span class="l-dot" style="background:#10b981"></span><span class="l-lbl">نشط</span><span class="l-val">${active}</span></div>
    <div class="legend-row"><span class="l-dot" style="background:#94a3b8"></span><span class="l-lbl">منتهي</span><span class="l-val">${expired}</span></div>`;

  // Chart: by category
  const catMap = {};
  subs.forEach(s => {
    const st = _students.find(x => x.id === s.studentId);
    const c  = st?.category || s.category || 'غير محدد';
    catMap[c] = (catMap[c] || 0) + 1;
  });
  const catItems  = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const maxC      = catItems[0]?.[1] || 1;
  const catColors = ['var(--gold)','#3b82f6','#10b981','#ef4444','#8b5cf6','#f59e0b'];
  document.getElementById('chart-category').innerHTML = catItems.length
    ? catItems.map(([n, c], i) => `<div class="bar-item"><span class="bar-lbl" title="${esc(n)}">${esc(n)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(c/maxC*100)}%;background:${catColors[i%catColors.length]}"></div></div><span class="bar-num">${c}</span></div>`).join('')
    : '<p style="color:var(--muted);font-size:.85rem;text-align:center;padding:16px">لا بيانات</p>';
}

/* ══════════════════════════════════════════
   SESSION CALCULATORS
══════════════════════════════════════════ */
const DAY_NUM = { 'الأحد':0,'الاثنين':1,'الثلاثاء':2,'الأربعاء':3,'الخميس':4,'الجمعة':5,'السبت':6 };

function calcSessions(startDate, endDate, progDays) {
  if (!startDate || !endDate || !progDays?.length) return 0;
  const dayNums = progDays.map(d => DAY_NUM[d]).filter(n => n !== undefined);
  let count = 0, d = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (d <= end) { if (dayNums.includes(d.getDay())) count++; d.setDate(d.getDate() + 1); }
  return count;
}

function calcEndFromSessions(startDate, sessionCount, progDays) {
  if (!startDate || !sessionCount || !progDays?.length) return '';
  const dayNums = progDays.map(d => DAY_NUM[d]).filter(n => n !== undefined);
  let count = 0, d = new Date(startDate + 'T00:00:00');
  while (count < sessionCount) {
    if (dayNums.includes(d.getDay())) count++;
    if (count < sessionCount) d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split('T')[0];
}

/* ══════════════════════════════════════════
   COMMUNICATION
══════════════════════════════════════════ */
const COMM_VARS = [
  '{الاسم}', '{الجوال}', '{المبلغ_الكلي}', '{المدفوع}',
  '{المتبقي}', '{بداية_الاشتراك}', '{نهاية_الاشتراك}', '{المجموعة}'
];

const COMM_DEFAULT_TEMPLATES = [
  { name: '✅ تم السداد',              key: 'paid'       },
  { name: '📋 تم الاشتراك',            key: 'subscribed' },
  { name: '⏰ تذكير بالسداد',          key: 'reminder'   },
  { name: '🔔 إعلام بقرب الانتهاء',    key: 'expiring'   },
  { name: '🔄 إعلام بانتهاء الاشتراك', key: 'expired'    },
];

function renderComm() {
  if (_currentProg) {
    const el = document.getElementById('comm-prog-name');
    if (el) el.textContent = _currentProg.name;
  }
  const body = document.getElementById('comm-body');
  if (!body) return;

  // تمييز التبويب النشط
  document.getElementById('comm-tab-send-btn')?.classList.toggle('btn-primary', _commTab === 'send');
  document.getElementById('comm-tab-tpl-btn')?.classList.toggle('btn-primary', _commTab === 'templates');
  document.getElementById('comm-tab-send-btn')?.classList.toggle('btn-outline', _commTab !== 'send');
  document.getElementById('comm-tab-tpl-btn')?.classList.toggle('btn-outline', _commTab !== 'templates');

  if (_commTab === 'templates') { renderCommTemplates(); return; }

  // بناء الفلاتر
  const groups = (_currentProg?.groups || '').split('،').map(s => s.trim()).filter(Boolean);
  const groupOpts = '<option value="">كل المجموعات</option>' + groups.map(g => `<option>${esc(g)}</option>`).join('');

  // القوالب المخصصة من localStorage
  const saved = JSON.parse(localStorage.getItem('wa_templates') || '[]');
  const tplOpts = `<option value="">— اختر قالباً —</option>
    <optgroup label="القوالب الافتراضية">
      ${COMM_DEFAULT_TEMPLATES.map(t => `<option value="default:${t.key}">${t.name}</option>`).join('')}
    </optgroup>
    ${saved.length ? `<optgroup label="قوالبي المخصصة">
      ${saved.map((t, i) => `<option value="custom:${i}">${esc(t.name)}</option>`).join('')}
    </optgroup>` : ''}`;

  body.innerHTML = `
    <div class="filter-bar" style="margin-bottom:14px">
      <select id="comm-filter-group" onchange="renderCommTable()">${groupOpts}</select>
      <select id="comm-filter-pay" onchange="renderCommTable()">
        <option value="">كل حالات الدفع</option>
        <option>مسدد</option><option>جزئي</option><option>لم يدفع</option>
      </select>
      <select id="comm-filter-status" onchange="renderCommTable()">
        <option value="">كل الحالات</option>
        <option>نشط</option><option>منتهي</option>
      </select>
      <span id="comm-selected-badge" class="comm-count-badge" style="display:none">المحدد: 0</span>
    </div>

    <div class="comm-table-wrap">
      <table class="tbl">
        <thead><tr>
          <th style="width:36px"><input type="checkbox" id="comm-check-all" onchange="toggleCommAll(this.checked)"></th>
          <th>الاسم</th><th>الجوال</th><th>المجموعة</th><th>حالة الدفع</th><th>المتبقي</th>
        </tr></thead>
        <tbody id="comm-tbody"></tbody>
      </table>
    </div>

    <div class="comm-msg-wrap">
      <div class="fg" style="margin-bottom:12px">
        <label>محتوى الرسالة</label>
        <select id="comm-tpl-select" onchange="onCommTplChange()">${tplOpts}</select>
      </div>

      <div class="comm-vars-panel">
        <span class="vars-label">إدراج متغير:</span>
        ${COMM_VARS.map(v => `<button class="comm-var-btn" onclick="insertCommVar('${v}')">${v}</button>`).join('')}
      </div>

      <div class="fg">
        <label>نص الرسالة <small style="color:var(--muted)">(المتغيرات تُستبدل تلقائياً عند الإرسال)</small></label>
        <div class="comm-editor-wrap">
          <textarea id="comm-msg" rows="8" style="font-family:inherit;font-size:.86rem;line-height:1.7;direction:rtl;width:100%"
            oninput="updateCommCounter();updateCommPreview()"></textarea>
          <div class="comm-char-counter"><span id="comm-char-count">0</span> / 1000</div>
        </div>
      </div>

      <div class="comm-preview-wrap" id="comm-preview-wrap" style="display:none">
        <div class="comm-preview-label">👁 معاينة — بيانات أول مشترك محدد</div>
        <div class="comm-preview-body" id="comm-preview-body"></div>
      </div>

      <details class="comm-attach-wrap">
        <summary>📎 إرفاق ملف (اختياري)</summary>
        <div class="comm-attach-body">
          <input type="file" id="comm-attach-file" accept="image/*,.pdf,.doc,.docx" style="display:none" onchange="onCommFileSelect()">
          <button class="btn btn-outline" style="font-size:.82rem" onclick="document.getElementById('comm-attach-file').click()">📁 اختر ملف</button>
          <span id="comm-attach-name" style="font-size:.8rem;color:var(--muted)">لم يُختر ملف</span>
          <div style="width:100%;font-size:.74rem;color:var(--muted)">⚠️ الملف لن يُرسل مباشرةً — سيُضاف اسمه في نص الرسالة فقط</div>
        </div>
      </details>
    </div>

    <div style="display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap">
      <label style="font-size:.85rem">التأخير بين الرسائل:</label>
      <input type="number" id="comm-delay" value="15" min="5" max="120" style="width:70px;text-align:center;border:1px solid var(--border);border-radius:8px;padding:6px">
      <span style="font-size:.82rem;color:var(--muted)">ثانية</span>
      <button class="btn btn-primary" onclick="startBulkSend()" style="background:#25d366;margin-right:auto">
        📱 إرسال للمحددين
      </button>
    </div>

    <div class="comm-progress" id="comm-progress-wrap" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-weight:700;font-size:.9rem">جارٍ الإرسال...</span>
        <span id="comm-progress-count" style="font-size:.82rem;color:var(--muted)"></span>
      </div>
      <div style="font-size:.85rem;margin-bottom:4px">المشترك الحالي: <strong id="comm-current-name"></strong></div>
      <div class="progress-bar-bg"><div class="progress-bar-fill" id="comm-progress-bar" style="width:0%"></div></div>
      <div id="comm-countdown" style="font-size:.82rem;color:var(--muted);margin-bottom:12px"></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-outline" id="comm-pause-btn" onclick="pauseBulkSend()">⏸ إيقاف مؤقت</button>
        <button class="btn" style="background:#fee2e2;color:#dc2626;border:none" onclick="cancelBulkSend()">✕ إلغاء</button>
      </div>
    </div>`;

  renderCommTable();
}

function renderCommTable() {
  const grp = document.getElementById('comm-filter-group')?.value || '';
  const pay = document.getElementById('comm-filter-pay')?.value   || '';
  const sta = document.getElementById('comm-filter-status')?.value || '';
  const tbody = document.getElementById('comm-tbody');
  if (!tbody) return;

  let d = [..._progSubs];
  if (grp) d = d.filter(s => s.groupName === grp);
  if (pay) d = d.filter(s => getSubPayInfo(s).payStatus === pay);
  if (sta) d = d.filter(s => s.status === sta);

  if (!d.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty" style="padding:20px"><p>لا يوجد مشتركون</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = d.map(s => {
    const { rem, payStatus } = getSubPayInfo(s);
    const checked = _commSelected.has(s.id) ? 'checked' : '';
    const payIcon = payStatus === 'مسدد' ? '🟢' : payStatus === 'جزئي' ? '🟡' : '🔴';
    return `<tr>
      <td><input type="checkbox" ${checked} onchange="toggleCommStudent(${s.id}, this.checked)"></td>
      <td><strong>${esc(s.studentName)}</strong></td>
      <td dir="ltr">${s.phone}</td>
      <td>${s.groupName || '—'}</td>
      <td>${payIcon} ${payStatus}</td>
      <td>${rem > 0 ? `<strong style="color:var(--danger)">${rem.toLocaleString()} ر.س</strong>` : '✅'}</td>
    </tr>`;
  }).join('');

  // تحديث الـ badge
  updateCommBadge();
  // مزامنة checkbox "تحديد الكل"
  const allChk = document.getElementById('comm-check-all');
  if (allChk) allChk.checked = d.length > 0 && d.every(s => _commSelected.has(s.id));
}

function toggleCommStudent(id, checked) {
  if (checked) _commSelected.add(id); else _commSelected.delete(id);
  updateCommBadge();
}

function toggleCommAll(checked) {
  const grp = document.getElementById('comm-filter-group')?.value || '';
  const pay = document.getElementById('comm-filter-pay')?.value   || '';
  const sta = document.getElementById('comm-filter-status')?.value || '';
  let d = [..._progSubs];
  if (grp) d = d.filter(s => s.groupName === grp);
  if (pay) d = d.filter(s => getSubPayInfo(s).payStatus === pay);
  if (sta) d = d.filter(s => s.status === sta);
  d.forEach(s => checked ? _commSelected.add(s.id) : _commSelected.delete(s.id));
  renderCommTable();
}

function updateCommBadge() {
  const badge = document.getElementById('comm-selected-badge');
  if (!badge) return;
  if (_commSelected.size > 0) {
    badge.style.display = '';
    badge.textContent = `المحدد: ${_commSelected.size}`;
  } else {
    badge.style.display = 'none';
  }
}

function onCommTplChange() {
  const val = document.getElementById('comm-tpl-select')?.value;
  if (!val) return;
  const sub = _commSelected.size
    ? _progSubs.find(s => _commSelected.has(s.id))
    : _progSubs[0];

  if (val.startsWith('default:')) {
    const key = val.split(':')[1];
    document.getElementById('comm-msg').value = sub ? buildWhatsAppMsg(key, sub) : '';
  } else if (val.startsWith('custom:')) {
    const idx = parseInt(val.split(':')[1]);
    const saved = JSON.parse(localStorage.getItem('wa_templates') || '[]');
    const tpl = saved[idx];
    if (tpl) document.getElementById('comm-msg').value = sub ? buildCommMsg(tpl.body, sub) : tpl.body;
  }
  updateCommCounter();
  updateCommPreview();
}

function insertCommVar(v) {
  const ta = document.getElementById('comm-msg');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + v + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + v.length;
  ta.focus();
  updateCommCounter();
  updateCommPreview();
}

function updateCommCounter() {
  const len = document.getElementById('comm-msg')?.value.length || 0;
  const el  = document.getElementById('comm-char-count');
  if (!el) return;
  el.textContent = len;
  el.style.color = len > 900 ? 'var(--danger)' : len > 700 ? 'var(--warning)' : 'var(--muted)';
}

function updateCommPreview() {
  const body = document.getElementById('comm-msg')?.value || '';
  const wrap = document.getElementById('comm-preview-wrap');
  const prev = document.getElementById('comm-preview-body');
  if (!wrap || !prev) return;
  const sub = _commSelected.size
    ? _progSubs.find(s => _commSelected.has(s.id))
    : _progSubs[0];
  if (!body.trim() || !sub) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  prev.textContent = buildCommMsg(body, sub);
}

function onCommFileSelect() {
  const file = document.getElementById('comm-attach-file')?.files[0];
  const nameEl = document.getElementById('comm-attach-name');
  if (!file || !nameEl) return;
  nameEl.textContent = file.name;
  // أضف اسم الملف كتذكير في نهاية الرسالة
  const ta = document.getElementById('comm-msg');
  if (ta && !ta.value.includes(file.name)) {
    ta.value = ta.value.trimEnd() + (ta.value ? '\n\n📎 ' : '📎 ') + file.name;
    updateCommCounter();
    updateCommPreview();
  }
}

function buildCommMsg(body, sub) {
  const { paid, due, rem } = getSubPayInfo(sub);
  return body
    .replace(/{الاسم}/g,           sub.studentName || '')
    .replace(/{الجوال}/g,          sub.phone || '')
    .replace(/{المبلغ_الكلي}/g,    due.toLocaleString()  + ' ريال')
    .replace(/{المدفوع}/g,         paid.toLocaleString() + ' ريال')
    .replace(/{المتبقي}/g,         rem.toLocaleString()  + ' ريال')
    .replace(/{بداية_الاشتراك}/g,  fmtDate(sub.startDate))
    .replace(/{نهاية_الاشتراك}/g,  fmtDate(sub.endDate))
    .replace(/{المجموعة}/g,        sub.groupName || '');
}

function startBulkSend() {
  const delay = parseInt(document.getElementById('comm-delay')?.value) || 15;
  const templateBody = document.getElementById('comm-msg')?.value || '';
  if (!templateBody.trim()) { toast('اكتب نص الرسالة أولاً', 'warning'); return; }
  if (!_commSelected.size)  { toast('حدد مشتركاً واحداً على الأقل', 'warning'); return; }

  _commQueue = [..._commSelected]
    .map(id => _progSubs.find(s => s.id === id))
    .filter(Boolean)
    .map(sub => ({ sub, msg: buildCommMsg(templateBody, sub) }));

  _commQueueIdx = 0;
  _commPaused   = false;
  const wrap = document.getElementById('comm-progress-wrap');
  if (wrap) wrap.style.display = '';
  sendNextInQueue(delay);
}

function sendNextInQueue(delay) {
  if (_commPaused) return;
  if (_commQueueIdx >= _commQueue.length) {
    toast(`✅ تم فتح ${_commQueue.length} رسالة واتساب`, 'success');
    resetCommSending();
    return;
  }
  const { sub, msg } = _commQueue[_commQueueIdx];
  const phone = (sub.phone || '').replace(/\D/g, '');
  const intlPhone = phone.startsWith('0') ? '966' + phone.slice(1) : phone;
  window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');

  const nameEl  = document.getElementById('comm-current-name');
  const barEl   = document.getElementById('comm-progress-bar');
  const countEl = document.getElementById('comm-progress-count');
  if (nameEl)  nameEl.textContent  = sub.studentName;
  if (barEl)   barEl.style.width   = `${(_commQueueIdx + 1) / _commQueue.length * 100}%`;
  if (countEl) countEl.textContent = `${_commQueueIdx + 1} / ${_commQueue.length}`;

  _commQueueIdx++;

  if (_commQueueIdx >= _commQueue.length) {
    // آخر رسالة — لا عداد تنازلي
    setTimeout(() => {
      toast(`✅ تم فتح ${_commQueue.length} رسالة واتساب`, 'success');
      resetCommSending();
    }, 800);
    return;
  }

  _commCountdown = delay;
  updateCommCountdown(delay);
}

function updateCommCountdown(delay) {
  const el = document.getElementById('comm-countdown');
  if (el) el.textContent = `الرسالة التالية خلال ${_commCountdown} ثانية...`;
  if (_commPaused) return;
  if (_commCountdown > 0) {
    _commCountdown--;
    _commTimer = setTimeout(() => updateCommCountdown(delay), 1000);
  } else {
    sendNextInQueue(delay);
  }
}

function pauseBulkSend() {
  _commPaused = !_commPaused;
  const btn = document.getElementById('comm-pause-btn');
  if (btn) btn.textContent = _commPaused ? '▶ استئناف' : '⏸ إيقاف مؤقت';
  if (!_commPaused) {
    const delay = parseInt(document.getElementById('comm-delay')?.value) || 15;
    sendNextInQueue(delay);
  }
}

function cancelBulkSend() {
  clearTimeout(_commTimer);
  resetCommSending();
}

function resetCommSending() {
  _commQueue = []; _commQueueIdx = 0; _commPaused = false;
  clearTimeout(_commTimer);
  const wrap = document.getElementById('comm-progress-wrap');
  if (wrap) wrap.style.display = 'none';
}

function renderCommTemplates() {
  const body = document.getElementById('comm-body');
  if (!body) return;
  const saved = JSON.parse(localStorage.getItem('wa_templates') || '[]');

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-weight:700;font-size:.95rem">القوالب الافتراضية</div>
    </div>
    ${COMM_DEFAULT_TEMPLATES.map(t => {
      const sample = _progSubs[0] ? buildWhatsAppMsg(t.key, _progSubs[0]) : '(لا يوجد مشتركون لعرض النموذج)';
      return `<div class="tpl-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="tpl-card-name">${t.name}</div>
          <button class="btn btn-outline" style="font-size:.76rem;padding:4px 10px" onclick="useTplInSend('default:${t.key}')">استخدام ←</button>
        </div>
        <div class="tpl-card-body">${esc(sample)}</div>
      </div>`;
    }).join('')}

    <div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 12px">
      <div style="font-weight:700;font-size:.95rem">قوالبي المخصصة ${saved.length ? `<span class="comm-count-badge">${saved.length}</span>` : ''}</div>
      <button class="btn btn-primary" onclick="openM('m-add-template')">➕ قالب جديد</button>
    </div>
    ${saved.length ? saved.map((t, i) => `
      <div class="tpl-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="tpl-card-name">${esc(t.name)}</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline" style="font-size:.76rem;padding:4px 10px" onclick="useTplInSend('custom:${i}')">استخدام ←</button>
            <button class="abt abt-delete" onclick="deleteCommTemplate(${i})">🗑️</button>
          </div>
        </div>
        <div class="tpl-card-body">${esc(t.body)}</div>
      </div>`).join('')
    : `<div class="empty" style="padding:30px"><div class="ei">📝</div><p>لا توجد قوالب مخصصة بعد</p></div>`}`;
}

function useTplInSend(val) {
  _commTab = 'send';
  renderComm();
  // تعيين القالب وتحديث النص
  const sel = document.getElementById('comm-tpl-select');
  if (sel) { sel.value = val; onCommTplChange(); }
}

function saveCommTemplate() {
  const name = document.getElementById('tpl-name')?.value.trim();
  const body = document.getElementById('tpl-body')?.value.trim();
  if (!name || !body) { toast('اكتب الاسم والنص', 'warning'); return; }
  const templates = JSON.parse(localStorage.getItem('wa_templates') || '[]');
  templates.push({ name, body });
  localStorage.setItem('wa_templates', JSON.stringify(templates));
  toast('تم حفظ القالب ✅', 'success');
  closeM('m-add-template');
  renderCommTemplates();
}

function deleteCommTemplate(idx) {
  const templates = JSON.parse(localStorage.getItem('wa_templates') || '[]');
  templates.splice(idx, 1);
  localStorage.setItem('wa_templates', JSON.stringify(templates));
  toast('تم حذف القالب', 'info');
  renderCommTemplates();
}

/* ══════════════════════════════════════════
   WHATSAPP
══════════════════════════════════════════ */
function openWhatsApp(subId) {
  const s = _progSubs.find(x => x.id === subId); if (!s) return;
  _waSubId = subId;

  const { paid, due, rem, payStatus } = getSubPayInfo(s);
  document.getElementById('wa-student-info').innerHTML =
    `<span>👤 <strong>${esc(s.studentName)}</strong></span>
     <span style="margin:0 12px;color:var(--muted)">|</span>
     <span dir="ltr">📞 ${s.phone}</span>
     <span style="margin:0 12px;color:var(--muted)">|</span>
     <span>💰 المتبقي: <strong style="color:var(--danger)">${rem.toLocaleString()} ر.س</strong></span>`;

  const typeEl = document.getElementById('wa-type');
  if (payStatus === 'مسدد')      typeEl.value = 'paid';
  else if (payStatus === 'جزئي') typeEl.value = 'reminder';
  else                           typeEl.value = 'subscribed';

  onWaTypeChange();
  openM('m-whatsapp');
}

function onWaTypeChange() {
  const s = _progSubs.find(x => x.id === _waSubId); if (!s) return;
  document.getElementById('wa-msg').value = buildWhatsAppMsg(document.getElementById('wa-type').value, s);
}

function buildWhatsAppMsg(type, s) {
  const { paid, due, rem } = getSubPayInfo(s);
  const name     = s.studentName;
  const start    = fmtDate(s.startDate);
  const end      = fmtDate(s.endDate);
  const paidFmt  = paid.toLocaleString() + ' ريال';
  const dueFmt   = due.toLocaleString()  + ' ريال';

  switch (type) {
    case 'paid':
      return `مساء الخير 🌿\nتم استلام رسوم الاشتراك 💳\n👤 الطالب: ${name}\n💰 المبلغ: ${paidFmt}\n\n⏳ مدة الاشتراك:\nمن ${start} إلى ${end}\n\nشكرًا لتعاونكم، وفي حال وجود أي استفسار يسعدنا تواصلكم معنا 🤝`;
    case 'subscribed':
      return `مساء الخير 🌿\nنود إفادتكم بأنه تم تسجيل ابنكم في البرنامج بنجاح، على أن يتم استكمال سداد رسوم الاشتراك لاحقًا بإذن الله.\n\n👤 الطالب: ${name}\n💰 قيمة الرسوم: ${dueFmt}\n\n⏳ مدة الاشتراك:\nمن ${start} إلى ${end}\n\nنسعد بانضمام ابنكم معنا، ويسعدنا تواصلكم معنا في حال الرغبة في السداد أو وجود أي استفسار 🤝`;
    case 'reminder':
      return `مساء الخير 🌿\nتذكير بسداد رسوم الاشتراك ⏰\n\n👤 ${name} — 💰 ${dueFmt}\n⏳ من ${start} إلى ${end}\n\nشكرًا لتعاونكم، وللاستفسار تواصلوا معنا 📞`;
    case 'expiring':
      return `مساء الخير 🌿\nنود إفادتكم بقرب انتهاء اشتراك ابنكم في البرنامج، حيث يتبقى على نهاية الاشتراك أيام قليلة.\n\n👤 الطالب: ${name}\n⏳ تاريخ نهاية الاشتراك: ${end}\n\nوللتجديد، نأمل إرسال كلمة «تجديد»، وسيتم التواصل معكم مباشرة بإذن الله 🔔\n\nشاكرين تعاونكم، ويسعدنا استمرار ابنكم معنا 🌱`;
    case 'expired':
      return `مساء الخير 🌿\nنود إفادتكم بانتهاء اشتراك ابنكم في البرنامج.\n\n👤 الطالب: ${name}\n📅 انتهى الاشتراك بتاريخ: ${end}\n\nوللتجديد، نأمل إرسال كلمة «تجديد»، وسيتم التواصل معكم مباشرة بإذن الله 🔄\n\nشكرًا لتعاونكم، ويسعدنا استمرار ابنكم معنا 🤝`;
    default: return '';
  }
}

function sendWhatsApp() {
  const s = _progSubs.find(x => x.id === _waSubId); if (!s) return;
  const phone = (s.phone || '').replace(/\D/g, '');
  const intlPhone = phone.startsWith('0') ? '966' + phone.slice(1) : phone;
  const msg = document.getElementById('wa-msg').value;
  window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  closeM('m-whatsapp');
}

/* ══════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════ */
function today()     { return new Date().toISOString(); }
function todayDate() { return new Date().toISOString().split('T')[0]; }

function fmtDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d.includes('T') ? d : d + 'T00:00:00');
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return d; }
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function subStatus(endDate) {
  if (!endDate) return 'نشط';
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return new Date(endDate + 'T00:00:00') < t ? 'منتهي' : 'نشط';
}

function calcDaysBetween(s, e) {
  if (!s || !e) return 0;
  return Math.max(0, Math.ceil((new Date(e + 'T00:00:00') - new Date(s + 'T00:00:00')) / 86400000));
}

let _toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show t-${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3400);
}

function openM(id)  { document.getElementById(id).classList.add('open'); }
function closeM(id) { document.getElementById(id).classList.remove('open'); }

/* ══════════════════════════════════════════
   IMPORT STUDENTS
══════════════════════════════════════════ */

// أعمدة القالب: [اسم العمود في الملف, مفتاح الـ DB, إجباري]
const IMPORT_COLS = [
  ['الاسم الثلاثي',    'fullName',         true ],
  ['رقم الجوال',       'phone',            true ],
  ['جوال إضافي',       'phone2',           false],
  ['المرحلة الدراسية', 'category',         false],
  ['المصدر',           'source',           false],
  ['تاريخ أول تواصل', 'firstContactDate', false],
  ['ملاحظات',          'notes',            false],
];

let _importRows = []; // parsed rows ready to import

function downloadStudentTemplate() {
  if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محملة بعد، انتظر ثانية', 'warning'); return; }
  const headers = IMPORT_COLS.map(c => c[0]);
  const sample  = ['محمد أحمد العتيبي', '0501234567', '', 'أول متوسط', 'مباشر', '2025-01-15', ''];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);

  // Column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 2, 18) }));

  XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
  XLSX.writeFile(wb, 'قالب_استيراد_الطلاب.xlsx');
}

function openImportModal() {
  resetImport();
  openM('m-import');
}

function resetImport() {
  _importRows = [];
  document.getElementById('import-file').value = '';
  document.getElementById('import-step-upload').style.display  = '';
  document.getElementById('import-step-preview').style.display = 'none';
  document.getElementById('import-step-result').style.display  = 'none';
  document.getElementById('import-confirm-btn').style.display  = 'none';
  closeM('m-import');
}

function previewImport(input) {
  const file = input.files[0]; if (!file) return;
  if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محملة', 'error'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb   = XLSX.read(data, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

      if (!raw.length) { toast('الملف فارغ أو لا يحتوي بيانات', 'error'); return; }

      // Map columns (flexible — matches by header name)
      const colMap = {};
      IMPORT_COLS.forEach(([colName, key]) => { colMap[colName] = key; });

      _importRows = [];
      const errors = [];

      raw.forEach((row, i) => {
        const mapped = { source: 'استيراد', isArchived: false };
        let hasName = false, hasPhone = false;

        Object.keys(row).forEach(header => {
          const key = colMap[header.trim()];
          if (key) {
            let val = String(row[header] || '').trim();
            // Format date if needed
            if (key === 'firstContactDate' && val) {
              // Try to normalize date to YYYY-MM-DD
              const d = new Date(val);
              if (!isNaN(d)) val = d.toISOString().split('T')[0];
            }
            mapped[key] = val;
            if (key === 'fullName' && val.length >= 3) hasName = true;
            if (key === 'phone' && val.length >= 9)   hasPhone = true;
          }
        });

        if (!hasName)  { errors.push(`صف ${i+2}: الاسم مفقود أو قصير`); return; }
        if (!hasPhone) { errors.push(`صف ${i+2}: رقم الجوال مفقود`); return; }
        if (!mapped.phone2)           mapped.phone2 = '';
        if (!mapped.category)         mapped.category = '';
        if (!mapped.source)           mapped.source = 'استيراد';
        if (!mapped.firstContactDate) mapped.firstContactDate = null;
        if (!mapped.notes)            mapped.notes = '';

        _importRows.push(mapped);
      });

      // Show preview
      document.getElementById('import-step-upload').style.display  = 'none';
      document.getElementById('import-step-preview').style.display = '';

      const summaryEl = document.getElementById('import-summary');
      summaryEl.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:12px;font-size:.82rem;font-weight:600">✅ صالح للاستيراد: ${_importRows.length}</span>
          ${errors.length ? `<span style="background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:12px;font-size:.82rem;font-weight:600">⚠️ مُستبعد: ${errors.length}</span>` : ''}
        </div>
        ${errors.length ? `<div style="background:#fef3c7;border-radius:6px;padding:8px 12px;font-size:.78rem;color:#92400e;max-height:80px;overflow-y:auto">${errors.join('<br>')}</div>` : ''}`;

      // Preview table
      document.getElementById('import-preview-head').innerHTML =
        '<th>#</th>' + IMPORT_COLS.map(c => `<th style="font-size:.78rem">${c[0]}</th>`).join('');

      document.getElementById('import-preview-body').innerHTML =
        _importRows.slice(0, 10).map((r, i) => `<tr>
          <td style="color:var(--muted);font-size:.75rem">${i+1}</td>
          ${IMPORT_COLS.map(([,key]) => `<td style="font-size:.78rem;white-space:nowrap">${esc(r[key]||'')}</td>`).join('')}
        </tr>`).join('') +
        (_importRows.length > 10 ? `<tr><td colspan="${IMPORT_COLS.length+1}" style="text-align:center;color:var(--muted);font-size:.78rem;padding:8px">… و${_importRows.length - 10} صف إضافي</td></tr>` : '');

      document.getElementById('import-count').textContent = _importRows.length;
      document.getElementById('import-confirm-btn').style.display = _importRows.length ? '' : 'none';

    } catch(err) {
      toast('خطأ في قراءة الملف: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function confirmImport() {
  if (!_importRows.length) return;
  const btn = document.getElementById('import-confirm-btn');
  btn.disabled = true;
  btn.textContent = '⏳ جاري الاستيراد…';

  let success = 0, skipped = 0;
  const skippedNames = [];

  for (const row of _importRows) {
    try {
      await sbInsert(TB.STUDENTS, row);
      success++;
    } catch(e) {
      // Likely duplicate phone
      skipped++;
      skippedNames.push(row.fullName);
    }
  }

  // Show result
  document.getElementById('import-step-preview').style.display = 'none';
  document.getElementById('import-step-result').style.display  = '';
  btn.style.display = 'none';

  document.getElementById('import-result-body').innerHTML = `
    <div style="font-size:2.5rem;margin-bottom:12px">${success > 0 ? '🎉' : '⚠️'}</div>
    <div style="font-size:1.1rem;font-weight:bold;margin-bottom:8px">اكتمل الاستيراد</div>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:14px">
      <span style="background:#dcfce7;color:#166534;padding:6px 16px;border-radius:12px;font-weight:600">✅ تم استيراد: ${success}</span>
      ${skipped ? `<span style="background:#fee2e2;color:#991b1b;padding:6px 16px;border-radius:12px;font-weight:600">⏭️ تم تخطي: ${skipped}</span>` : ''}
    </div>
    ${skipped ? `<div style="font-size:.78rem;color:var(--muted)">المتخطون (جوال مكرر): ${skippedNames.slice(0,5).join('، ')}${skippedNames.length>5?'…':''}</div>` : ''}
    <button class="btn btn-primary" style="margin-top:16px" onclick="finishImport()">إغلاق وتحديث القائمة</button>`;

  if (success > 0) addLog('import_students', `استيراد ${success} طالب من Excel`);
}

async function finishImport() {
  closeM('m-import');
  _importRows = [];
  await loadStudents();
  renderStudents();
  toast('تم تحديث قائمة الطلاب ✅');
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mn = document.getElementById('main');
  if (window.innerWidth <= 760) {
    sb.classList.toggle('open');
  } else {
    _sidebarOpen = !_sidebarOpen;
    sb.classList.toggle('hidden', !_sidebarOpen);
    mn.classList.toggle('full', !_sidebarOpen);
  }
}

function handleLogout() {
  if (confirm('تسجيل الخروج؟')) window.location.reload();
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) e.target.classList.remove('open');
});

// Close student search dropdown on outside click
document.addEventListener('click', e => {
  const res = document.getElementById('sub-student-results');
  const inp = document.getElementById('sub-student-search');
  if (res && !res.contains(e.target) && e.target !== inp) res.style.display = 'none';
});

/* ══════════════════════════════════════════
   ACTIVITY LOGS
══════════════════════════════════════════ */
const LOG_ICONS = {
  import_students  : '📥',
  add_student      : '👤➕',
  edit_student     : '👤✏️',
  archive_student  : '📦',
  unarchive_student: '📤',
  add_program      : '📋➕',
  edit_program     : '📋✏️',
  extend_program   : '📅',
  add_sub          : '🔗➕',
  edit_sub         : '🔗✏️',
  delete_sub       : '🗑️',
  add_payment      : '💰',
  bulk_subscribe   : '📋✅',
  delete_program   : '🗑️📋',
};

async function loadLogs() {
  const el = document.getElementById('logs-body');
  if (!el) return;
  el.innerHTML = `<div class="empty"><div class="ei">⏳</div><p>جاري التحميل…</p></div>`;
  try {
    const r = await fetch(`${SB_URL}/logs?select=*&order=id.desc&limit=150`, { headers: _h() });
    if (!r.ok) throw new Error();
    const rows = await r.json();
    renderLogs(rows);
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>تعذر تحميل السجل</p></div>`;
  }
}

function renderLogs(rows) {
  const el = document.getElementById('logs-body');
  if (!rows.length) {
    el.innerHTML = `<div class="empty"><div class="ei">🕑</div><p>لا توجد عمليات مسجلة بعد</p></div>`;
    return;
  }
  el.innerHTML = `
    <div class="table-card">
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>#</th><th>العملية</th><th>التفاصيل</th><th>الوقت</th></tr></thead>
          <tbody>
            ${rows.map((row, i) => {
              const icon = LOG_ICONS[row.action] || '📌';
              const dt   = row.createdAt ? new Date(row.createdAt) : null;
              const time = dt ? dt.toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
              return `<tr>
                <td style="color:var(--muted);font-size:.8rem">${i + 1}</td>
                <td style="font-size:1.1rem">${icon}</td>
                <td style="font-size:.88rem">${esc(row.label || '')}</td>
                <td style="font-size:.78rem;color:var(--muted);white-space:nowrap">${time}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   DELETE PROGRAM (CASCADE)
══════════════════════════════════════════ */

function openDeleteProg(id) {
  const p = _progs.find(x => x.id === id);
  if (!p) return;
  _deleteProgId = id;

  const progSubs = _allSubs.filter(s => s.programId === id);
  const subIds   = progSubs.map(s => s.id);
  const progPays = _allPayments.filter(pay => subIds.includes(pay.subscriptionId));

  document.getElementById('del-prog-name').textContent = p.name;
  document.getElementById('del-prog-subs').textContent = progSubs.length;
  document.getElementById('del-prog-pays').textContent = progPays.length;

  openM('m-delete-prog');
}

async function confirmDeleteProg() {
  if (!_deleteProgId) return;
  const id   = _deleteProgId;
  const prog = _progs.find(x => x.id === id);
  const name = prog?.name || '';

  const progSubs = _allSubs.filter(s => s.programId === id);
  const subIds   = progSubs.map(s => s.id);

  try {
    // 1. حذف الدفعات المرتبطة بالاشتراكات
    if (subIds.length) {
      await fetch(`${SB_URL}/payments?subscriptionId=in.(${subIds.join(',')})`,
        { method: 'DELETE', headers: _h() });
    }
    // 2. حذف الاشتراكات المرتبطة بالبرنامج
    await fetch(`${SB_URL}/subscriptions?programId=eq.${id}`,
      { method: 'DELETE', headers: _h() });
    // 3. حذف سجلات الحضور المرتبطة
    await fetch(`${SB_URL}/attendance?programId=eq.${id}`,
      { method: 'DELETE', headers: _h() });
    // 4. حذف البطولات الرياضية المرتبطة (فرق + مباريات + البطولة)
    const tournsRes = await fetch(`${SB_URL}/sports_tournaments?select=id&programId=eq.${id}`,
      { headers: _h() });
    const tourns = tournsRes.ok ? await tournsRes.json() : [];
    for (const t of tourns) {
      await fetch(`${SB_URL}/sports_matches?tournamentId=eq.${t.id}`,  { method: 'DELETE', headers: _h() });
      await fetch(`${SB_URL}/sports_teams?tournamentId=eq.${t.id}`,    { method: 'DELETE', headers: _h() });
      await fetch(`${SB_URL}/sports_tournaments?id=eq.${t.id}`,        { method: 'DELETE', headers: _h() });
    }
    // 5. حذف البرنامج نفسه
    await sbDelete(TB.PROGRAMS, id);

    // تحديث الـ state المحلي
    _progs       = _progs.filter(x => x.id !== id);
    _allSubs     = _allSubs.filter(s => s.programId !== id);
    _allPayments = _allPayments.filter(pay => !subIds.includes(pay.subscriptionId));
    if (_currentProg?.id === id) {
      _currentProg = null;
      _progSubs    = [];
      _progPays    = [];
      switchSection('programs');
    }

    addLog('delete_program', `حذف برنامج: ${name}`);
    closeM('m-delete-prog');
    toast(`تم حذف برنامج "${name}" نهائياً ✅`);
    renderProgs();
  } catch(e) {
    toast('خطأ في الحذف: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════
   BULK SUBSCRIBE FROM STUDENTS REGISTRY
══════════════════════════════════════════ */

function openBulkSubModal() {
  if (!_currentProg) return;

  // مسح التحديد السابق
  _bulkSelected.clear();

  // تعبئة قائمة المجموعات
  const groups = (_currentProg.groups || '').split('،').map(s => s.trim()).filter(Boolean);
  document.getElementById('bulk-group').innerHTML =
    '<option value="">اختر المجموعة</option>' + groups.map(g => `<option>${g}</option>`).join('');

  // القيم الافتراضية
  document.getElementById('bulk-type').value       = 'كامل';
  document.getElementById('bulk-start').value      = todayDate();
  document.getElementById('bulk-end').value        = _currentProg.endDate || '';
  document.getElementById('bulk-amount-due').value = _currentProg.fullFee || '';
  document.getElementById('bulk-notes').value      = '';
  document.getElementById('bulk-search').value     = '';

  const sessions = calcSessions(todayDate(), _currentProg.endDate || '', _currentProg.days);
  document.getElementById('bulk-sessions').value = sessions || '';

  renderBulkStudentList();
  openM('m-bulk-sub');
}

function renderBulkStudentList() {
  const q = (document.getElementById('bulk-search').value || '').toLowerCase().trim();
  const alreadySubIds = new Set(_progSubs.map(s => s.studentId));

  _bulkFilteredStudents = _students.filter(s => {
    if (s.isArchived) return false;
    if (alreadySubIds.has(s.id)) return false;
    if (q) {
      const matchName  = (s.fullName || '').toLowerCase().includes(q);
      const matchPhone = (s.phone || '').includes(q);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  });

  const list = document.getElementById('bulk-student-list');
  const count = document.getElementById('bulk-filtered-count');
  count.textContent = `(${_bulkFilteredStudents.length} طالب)`;

  if (!_bulkFilteredStudents.length) {
    list.innerHTML = `<div class="bulk-empty">${q ? 'لا نتائج للبحث' : 'جميع الطلاب مشتركون بالفعل في هذا البرنامج'}</div>`;
    updateBulkSelectedCount();
    return;
  }

  list.innerHTML = _bulkFilteredStudents.map(s => {
    const checked = _bulkSelected.has(s.id) ? 'checked' : '';
    const selCls  = _bulkSelected.has(s.id) ? ' selected' : '';
    return `<div class="bulk-student-item${selCls}" onclick="toggleBulkStudent(${s.id})">
      <input type="checkbox" ${checked} onclick="event.stopPropagation();toggleBulkStudent(${s.id})">
      <span class="bulk-st-name">${esc(s.fullName)}</span>
      <span class="bulk-st-meta" dir="ltr">${esc(s.phone)}</span>
      ${s.category ? `<span class="bulk-st-meta" style="margin-right:4px">${esc(s.category)}</span>` : ''}
    </div>`;
  }).join('');

  updateBulkSelectedCount();
}

function toggleBulkStudent(id) {
  if (_bulkSelected.has(id)) {
    _bulkSelected.delete(id);
  } else {
    _bulkSelected.add(id);
  }
  renderBulkStudentList();
}

function toggleBulkSelectAll(cb) {
  if (cb.checked) {
    _bulkFilteredStudents.forEach(s => _bulkSelected.add(s.id));
  } else {
    _bulkFilteredStudents.forEach(s => _bulkSelected.delete(s.id));
  }
  renderBulkStudentList();
}

function updateBulkSelectedCount() {
  const n = _bulkSelected.size;
  const countEl = document.getElementById('bulk-selected-count');
  if (countEl) {
    countEl.textContent = n > 0 ? `✅ تم اختيار ${n} طالب` : 'لم يتم اختيار أي طالب';
  }
  // ضبط حالة checkbox "تحديد الكل"
  const allCb = document.getElementById('bulk-select-all');
  if (allCb && _bulkFilteredStudents.length > 0) {
    const allSelected = _bulkFilteredStudents.every(s => _bulkSelected.has(s.id));
    const someSelected = _bulkFilteredStudents.some(s => _bulkSelected.has(s.id));
    allCb.checked       = allSelected;
    allCb.indeterminate = !allSelected && someSelected;
  }
}

function onBulkDatesChange() {
  const start = document.getElementById('bulk-start').value;
  const end   = document.getElementById('bulk-end').value;
  if (start && end && _currentProg) {
    const sessions = calcSessions(start, end, _currentProg.days);
    document.getElementById('bulk-sessions').value = sessions || '';
  }
}

async function saveBulkSub() {
  if (!_currentProg) return;

  if (_bulkSelected.size === 0) {
    toast('يرجى اختيار طالب واحد على الأقل', 'error'); return;
  }

  const startDate = document.getElementById('bulk-start').value;
  const endDate   = document.getElementById('bulk-end').value;
  if (!startDate || !endDate) {
    toast('يرجى تحديد تاريخي البداية والنهاية', 'error'); return;
  }

  const subType   = document.getElementById('bulk-type').value;
  const groupName = document.getElementById('bulk-group').value;
  const sessions  = parseInt(document.getElementById('bulk-sessions').value) || 0;
  const amountDue = parseFloat(document.getElementById('bulk-amount-due').value) || 0;
  const notes     = document.getElementById('bulk-notes').value.trim();

  const selectedIds = [..._bulkSelected];
  let successCount = 0;
  const errors = [];

  for (const studentId of selectedIds) {
    const st = _students.find(s => s.id === studentId);
    if (!st) continue;
    try {
      const subData = {
        studentId,
        studentName: st.fullName,
        phone: st.phone,
        category: st.category || '',
        programId: _currentProg.id,
        programName: _currentProg.name,
        groupName, subType, paymentType: subType,
        startDate, endDate,
        sessionCount: sessions,
        amountDue,
        status: subStatus(endDate)
      };
      const created = await sbInsertReturn(TB.SUBSCRIPTIONS, subData);
      const newId   = created ? parseInt(created.id) : Date.now() + successCount;
      _progSubs.push({ id: newId, ...subData });
      _allSubs.push({ id: newId, ...subData });
      successCount++;
    } catch(e) {
      errors.push(st.fullName);
    }
  }

  addLog('bulk_subscribe', `اشتراك جماعي في ${_currentProg.name}: ${successCount} طالب`);

  if (errors.length) {
    toast(`تم اشتراك ${successCount} طالب — فشل ${errors.length}`, 'warning');
  } else {
    toast(`تم اشتراك ${successCount} طالب بنجاح ✅`);
  }

  closeM('m-bulk-sub');
  renderSubscribers();
  renderSubscriberStats();
}

/* ── Start ── */
document.addEventListener('DOMContentLoaded', init);

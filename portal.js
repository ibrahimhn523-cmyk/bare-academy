/* ══════════════════════════════════════════
   portal.js — بوابة بارع الشاملة
══════════════════════════════════════════ */

const SB_URL = 'https://oytfhgqhibbcsqbnvwyv.supabase.co/rest/v1';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95dGZoZ3FoaWJiY3NxYm52d3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjgwNDgsImV4cCI6MjA5MDgwNDA0OH0.oX2f-gCIBn8cHvNbgYIrnFc5JeUXtQ_i0AreSqgBWJs';

const TB = {
  STUDENTS    : 'students',
  PROGRAMS    : 'programs',
  SUBSCRIPTIONS:'subscriptions',
  ATTENDANCE  : 'attendance',
  POINTS      : 'points',
  POINT_REASONS:'point_reasons',
  USERS       : 'users',
  LOGS        : 'logs',
  CULTURAL    : 'cultural_competitions',
  CULT_PARTS  : 'cultural_participants',
  SPORTS      : 'sports_tournaments',
  TEAMS       : 'sports_teams',
  MATCHES     : 'sports_matches',
  STATS       : 'sports_stats',
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
async function sbUpsert(table, data) {
  const r = await fetch(`${SB_URL}/${table}`, { method: 'POST', headers: _h({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(data) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `HTTP ${r.status}`); }
}

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let _user     = null;   // logged-in user
let _students = [];
let _progs    = [];
let _reasons  = [];
let _users    = [];     // admin only
let _activeSection = 'home';

// attendance state
let _attSubs  = [];     // subscriptions for selected program+group
let _attData  = {};     // { studentId: status }
let _attSelProg = null;
let _attSelGroup = '';
let _attDate  = '';

// points state
let _ptsSubs   = [];    // subscriptions for selected program
let _ptsPoints = [];    // points for selected program
let _ptsSelProg = null;

// cultural state
let _cultComps  = [];
let _cultParts  = [];
let _cultSelComp = null;
let _cultSelProg = null;

// sports state
let _sportsT    = [];   // tournaments
let _sportsSel  = null; // selected tournament
let _sportsTeams= [];
let _sportsMatches= [];
let _sportsSProg = null;

/* ══════════════════════════════════════════
   AUTHENTICATION
══════════════════════════════════════════ */
async function login() {
  const username = document.getElementById('l-user').value.trim();
  const password = document.getElementById('l-pass').value.trim();
  const errEl    = document.getElementById('l-err');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور'; return; }

  try {
    const rows = await sbRead(TB.USERS, `username=eq.${encodeURIComponent(username)}&isActive=eq.true`);
    if (!rows.length) { errEl.textContent = 'اسم المستخدم غير موجود أو الحساب موقوف'; return; }
    const u = rows[0];
    if (u.password !== password) { errEl.textContent = 'كلمة المرور غير صحيحة'; return; }
    _user = { id: u.id, username: u.username, role: u.role, permissions: u.permissions || {}, dailyQuota: u.dailyQuota || 100 };
    localStorage.setItem('portal_user', JSON.stringify(_user));
    startApp();
  } catch(e) {
    errEl.textContent = 'خطأ في الاتصال: ' + e.message;
  }
}

function logout() {
  if (!confirm('تسجيل الخروج؟')) return;
  localStorage.removeItem('portal_user');
  location.reload();
}

function checkAuth() {
  const saved = localStorage.getItem('portal_user');
  if (saved) { try { _user = JSON.parse(saved); startApp(); return; } catch(e) {} }
  document.getElementById('login-screen').style.display = 'flex';
}

function hasPermission(key) {
  if (_user?.role === 'super_admin') return true;
  return !!(_user?.permissions?.[key]);
}

/* ══════════════════════════════════════════
   APP START
══════════════════════════════════════════ */
async function startApp() {
  document.getElementById('login-screen').style.display = 'none';
  const app = document.getElementById('app');
  app.style.display = 'flex';
  app.style.flexDirection = 'column';

  // Topbar
  document.getElementById('tb-user').textContent = _user.username;
  document.getElementById('tb-role').textContent = _user.role === 'super_admin' ? 'مسؤول أعلى' : 'مشرف';

  // Show/hide nav items
  const isSA = _user.role === 'super_admin';
  ['nav-admin','nav-admin-div'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = isSA ? '' : 'none';
  });
  if (!hasPermission('cultural')) {
    ['nav-cultural','nav-cultural-label'].forEach(id => { const e = document.getElementById(id); if(e) e.style.display='none'; });
  }
  if (!hasPermission('sports')) {
    ['nav-sports','nav-sports-label'].forEach(id => { const e = document.getElementById(id); if(e) e.style.display='none'; });
  }

  // Load base data
  try { await Promise.all([loadStudents(), loadPrograms(), loadReasons()]); } catch(e) {}
  if (isSA) { try { await loadUsers(); } catch(e) {} }

  // Populate program selects
  populateProgSelects();

  loadHome();
  // Set today's date for attendance
  document.getElementById('att-date').value = todayDate();
}

async function loadStudents() {
  const rows = await sbRead(TB.STUDENTS, 'isArchived=eq.false');
  _students = rows.map(r => ({ id: parseInt(r.id), fullName: r.fullName || '', phone: r.phone || '', category: r.category || '', phone2: r.phone2 || '' }));
}

async function loadPrograms() {
  const rows = await sbRead(TB.PROGRAMS);
  _progs = rows.map(r => ({
    id: parseInt(r.id), name: r.name || '', startDate: r.startDate || '',
    endDate: r.endDate || '', fullFee: parseFloat(r.fullFee) || 0,
    groups: r.groups || '', days: parseDays(r.days), status: r.status || 'نشط'
  }));
}

async function loadReasons() {
  const rows = await sbRead(TB.POINT_REASONS, 'isActive=eq.true');
  _reasons = rows.map(r => ({ id: parseInt(r.id), label: r.label, defaultValue: parseInt(r.defaultValue) || 10 }));
}

async function loadUsers() {
  const rows = await sbRead(TB.USERS);
  _users = rows;
}

function parseDays(d) {
  if (Array.isArray(d)) return d;
  try { const p = JSON.parse(d); return Array.isArray(p) ? p : ['الأحد','الاثنين','الثلاثاء','الأربعاء']; } catch { return ['الأحد','الاثنين','الثلاثاء','الأربعاء']; }
}

function populateProgSelects() {
  const ids = ['att-prog-sel','pts-prog-sel','cult-prog-sel','sports-prog-sel','lb-prog-sel','cult-modal-prog','sports-modal-prog'];
  ids.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">-- اختر --</option>' + _progs.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if (cur) el.value = cur;
  });
}

/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */
const SECTION_LABELS = {
  home:'الرئيسية', attendance:'التحضير', points:'النقاط',
  cultural:'الثقافي', sports:'الرياضي', leaderboard:'الصدارة', admin:'الإدارة'
};

function switchSection(name) {
  _activeSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');

  // Update nav active states
  document.querySelectorAll('.nav-item,.nav-sub-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');

  document.getElementById('tb-section').textContent = SECTION_LABELS[name] || name;

  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ══════════════════════════════════════════
   HOME
══════════════════════════════════════════ */
async function loadHome() {
  const kpi = document.getElementById('home-kpi');
  const rec = document.getElementById('home-recent');
  kpi.innerHTML = `<div class="kpi-card"><div class="kv">⏳</div><div class="kl">جاري التحميل…</div></div>`;

  try {
    // Quick stats
    const [ptRows, attRows] = await Promise.all([
      fetch(`${SB_URL}/points?select=id,amount,addedAt&order=id.desc&limit=200`, { headers: _h() }).then(r=>r.json()).catch(()=>[]),
      fetch(`${SB_URL}/attendance?select=id,date&order=id.desc&limit=10`, { headers: _h() }).then(r=>r.json()).catch(()=>[])
    ]);

    const today = todayDate();
    const todayPts = ptRows.filter(p => p.addedAt?.startsWith(today)).reduce((a,p) => a + (parseInt(p.amount)||0), 0);
    const totalPts = ptRows.reduce((a,p) => a + (parseInt(p.amount)||0), 0);

    kpi.innerHTML = `
      <div class="kpi-card"><div class="kv">${_students.length}</div><div class="kl">إجمالي الطلاب</div></div>
      <div class="kpi-card"><div class="kv">${_progs.length}</div><div class="kl">البرامج</div></div>
      <div class="kpi-card k-success"><div class="kv">${todayPts}</div><div class="kl">نقاط اليوم</div></div>
      <div class="kpi-card k-info"><div class="kv">${totalPts}</div><div class="kl">إجمالي النقاط الممنوحة</div></div>
    `;

    // Recent points
    const recent = ptRows.slice(0, 8);
    if (recent.length) {
      rec.innerHTML = recent.map(p => `
        <div class="card" style="padding:14px 16px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="pts-badge">+${p.amount} نقطة</span>
            <span style="font-size:.75rem;color:var(--muted)">${fmtDatetime(p.addedAt)}</span>
          </div>
        </div>`).join('');
    } else {
      rec.innerHTML = `<div class="empty"><div class="ei">⭐</div><p>لم تُمنح أي نقاط بعد</p></div>`;
    }
  } catch(e) {
    kpi.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>تعذر التحميل</p></div>`;
  }
}

/* ══════════════════════════════════════════
   ATTENDANCE SECTION
══════════════════════════════════════════ */
function onAttProgChange() {
  const progId = parseInt(document.getElementById('att-prog-sel').value) || 0;
  _attSelProg = _progs.find(p => p.id === progId) || null;
  const groupSel = document.getElementById('att-group-sel');
  groupSel.innerHTML = '<option value="">-- اختر --</option>';
  groupSel.disabled = true;
  document.getElementById('att-bulk-bar').style.display = 'none';
  document.getElementById('att-body').innerHTML = `<div class="empty"><div class="ei">✅</div><p>اختر المجموعة والتاريخ</p></div>`;
  if (!_attSelProg) return;

  const groups = _attSelProg.groups.split('،').map(g => g.trim()).filter(Boolean);
  if (!groups.length) {
    groupSel.innerHTML = '<option value="الكل">الكل</option>';
  } else {
    groupSel.innerHTML = '<option value="">-- اختر --</option>' + groups.map(g => `<option value="${g}">${esc(g)}</option>`).join('');
  }
  groupSel.disabled = false;
}

async function loadAttTable() {
  const progId  = parseInt(document.getElementById('att-prog-sel').value) || 0;
  const group   = document.getElementById('att-group-sel').value;
  const date    = document.getElementById('att-date').value;
  if (!progId || !group || !date) return;

  _attSelGroup = group; _attDate = date;
  const body = document.getElementById('att-body');
  body.innerHTML = `<div class="empty"><div class="ei">⏳</div><p>جاري التحميل…</p></div>`;

  try {
    // Load subscriptions
    let subsRows;
    if (group === 'الكل') {
      subsRows = await sbRead(TB.SUBSCRIPTIONS, `programId=eq.${progId}`);
    } else {
      subsRows = await sbRead(TB.SUBSCRIPTIONS, `programId=eq.${progId}&groupName=eq.${encodeURIComponent(group)}`);
      if (!subsRows.length) subsRows = await sbRead(TB.SUBSCRIPTIONS, `programId=eq.${progId}&groupName=eq.${encodeURIComponent(group)}`);
    }
    _attSubs = subsRows.map(r => ({ id: parseInt(r.id), studentId: parseInt(r.studentId), studentName: r.studentName || '' }));

    // Load existing attendance for this date
    const attRows = await sbRead(TB.ATTENDANCE, `programId=eq.${progId}&date=eq.${date}`);
    _attData = {};
    attRows.forEach(a => { _attData[parseInt(a.studentId)] = a.status; });

    renderAttTable();
    document.getElementById('att-bulk-bar').style.display = 'flex';
  } catch(e) {
    body.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>خطأ: ${e.message}</p></div>`;
  }
}

const ATT_STATUSES = ['حاضر','متأخر بعذر','متأخر بغير عذر','غائب بعذر','غائب بغير عذر'];

function renderAttTable() {
  const body = document.getElementById('att-body');
  if (!_attSubs.length) {
    body.innerHTML = `<div class="empty"><div class="ei">👥</div><p>لا يوجد طلاب في هذه المجموعة</p></div>`;
    return;
  }
  const search = document.getElementById('att-search')?.value?.toLowerCase() || '';
  const filtered = _attSubs.filter(s => s.studentName.toLowerCase().includes(search));

  const opts = ATT_STATUSES.map(s => `<option>${s}</option>`).join('');
  body.innerHTML = `
    <div class="table-card">
      <div class="att-wrapper">
        <table class="att-table">
          <thead><tr>
            <th><input type="checkbox" id="att-all-chk" onchange="toggleAllAtt(this)"></th>
            <th>الطالب</th><th>الحالة</th>
          </tr></thead>
          <tbody>
            ${filtered.map(s => {
              const status = _attData[s.studentId] || 'حاضر';
              return `<tr id="att-row-${s.studentId}">
                <td><input type="checkbox" class="att-chk" data-id="${s.studentId}"></td>
                <td class="name-cell">${esc(s.studentName)}</td>
                <td>
                  <select onchange="_attData[${s.studentId}]=this.value" id="att-sel-${s.studentId}">
                    ${ATT_STATUSES.map(st => `<option ${st===status?'selected':''}>${st}</option>`).join('')}
                  </select>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function filterAttTable() { renderAttTable(); }

function toggleAllAtt(chk) {
  document.querySelectorAll('.att-chk').forEach(c => c.checked = chk.checked);
}

function applyBulkAtt() {
  const status = document.getElementById('att-bulk-status').value;
  const checked = [...document.querySelectorAll('.att-chk:checked')];
  if (!checked.length) { toast('حدد طلاباً أولاً', 'warning'); return; }
  checked.forEach(c => {
    const id = parseInt(c.dataset.id);
    _attData[id] = status;
    const sel = document.getElementById(`att-sel-${id}`);
    if (sel) sel.value = status;
  });
  toast(`تم تطبيق "${status}" على ${checked.length} طالب`);
}

async function saveAttendance() {
  if (!_attSelProg || !_attSelGroup || !_attDate) { toast('بيانات التحضير غير مكتملة', 'error'); return; }
  try {
    const records = _attSubs.map(s => ({
      programId: _attSelProg.id, groupName: _attSelGroup,
      studentId: s.studentId, studentName: s.studentName,
      date: _attDate, status: _attData[s.studentId] || 'حاضر'
    }));
    // Upsert using delete + insert
    await fetch(`${SB_URL}/attendance?programId=eq.${_attSelProg.id}&date=eq.${_attDate}&groupName=eq.${encodeURIComponent(_attSelGroup)}`, { method: 'DELETE', headers: _h() });
    for (const rec of records) { await sbInsert(TB.ATTENDANCE, rec); }
    toast('تم حفظ التحضير ✅');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

/* ══════════════════════════════════════════
   POINTS SECTION
══════════════════════════════════════════ */
async function loadPointsSection() {
  const progId = parseInt(document.getElementById('pts-prog-sel').value) || 0;
  _ptsSelProg = _progs.find(p => p.id === progId) || null;
  const body = document.getElementById('pts-body');
  const quotaWrap = document.getElementById('pts-quota-wrap');
  quotaWrap.style.display = 'none';

  if (!_ptsSelProg) {
    body.innerHTML = `<div class="empty"><div class="ei">⭐</div><p>اختر البرنامج</p></div>`; return;
  }

  body.innerHTML = `<div class="empty"><div class="ei">⏳</div><p>جاري التحميل…</p></div>`;
  try {
    const [subs, pts] = await Promise.all([
      sbRead(TB.SUBSCRIPTIONS, `programId=eq.${progId}`),
      sbRead(TB.POINTS, `programId=eq.${progId}`)
    ]);
    _ptsSubs   = subs;
    _ptsPoints = pts.map(p => ({ ...p, amount: parseInt(p.amount) || 0, studentId: parseInt(p.studentId) }));

    // Quota bar
    const todayUsed = await getTodayUsage(_user.username, progId);
    const quota = _user.dailyQuota || 100;
    const pct = Math.min(100, Math.round(todayUsed / quota * 100));
    document.getElementById('pts-quota-used').textContent = todayUsed;
    document.getElementById('pts-quota-max').textContent  = quota;
    const bar = document.getElementById('pts-quota-bar');
    bar.style.width = pct + '%';
    bar.className = 'quota-bar' + (pct >= 100 ? ' over' : pct >= 80 ? ' warn' : '');
    quotaWrap.style.display = '';

    renderPointsTable();
  } catch(e) {
    body.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>خطأ: ${e.message}</p></div>`;
  }
}

function renderPointsTable() {
  const body = document.getElementById('pts-body');
  if (!_ptsSubs.length) {
    body.innerHTML = `<div class="empty"><div class="ei">👥</div><p>لا يوجد مشتركون في هذا البرنامج</p></div>`; return;
  }
  // Aggregate points per student
  const ptMap = {};
  _ptsPoints.forEach(p => { ptMap[p.studentId] = (ptMap[p.studentId] || 0) + p.amount; });

  // Sort by points desc
  const sorted = [..._ptsSubs].sort((a,b) => (ptMap[parseInt(b.studentId)]||0) - (ptMap[parseInt(a.studentId)]||0));

  body.innerHTML = `
    <div class="table-card">
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>#</th><th>الطالب</th><th>المجموعة</th><th>النقاط</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${sorted.map((s, i) => {
              const pts = ptMap[parseInt(s.studentId)] || 0;
              return `<tr>
                <td style="color:var(--muted);font-size:.8rem">${i+1}</td>
                <td style="font-weight:600">${esc(s.studentName)}</td>
                <td style="font-size:.8rem;color:var(--muted)">${esc(s.groupName||'—')}</td>
                <td><span class="pts-badge">${pts}</span></td>
                <td class="td-actions">
                  <button class="btn btn-sm btn-gold" onclick="openAddPoints(${s.studentId},'${esc(s.studentName)}')">➕</button>
                  <button class="btn btn-sm btn-outline" onclick="openPtsHistory(${s.studentId},'${esc(s.studentName)}')">📋</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function getTodayUsage(username, programId) {
  try {
    const today = todayDate();
    const r = await fetch(`${SB_URL}/points?addedBy=eq.${encodeURIComponent(username)}&programId=eq.${programId}&addedAt=gte.${today}T00:00:00&select=amount`, { headers: _h() });
    const rows = await r.json().catch(() => []);
    return rows.reduce((a, p) => a + (parseInt(p.amount) || 0), 0);
  } catch { return 0; }
}

function openAddPoints(studentId, studentName) {
  document.getElementById('addpts-student-id').value   = studentId;
  document.getElementById('addpts-student-name').value = studentName;
  document.getElementById('addpts-amount').value = '';
  document.getElementById('addpts-note').value   = '';
  document.getElementById('addpts-custom-wrap').style.display = 'none';
  document.getElementById('addpts-custom-reason').value = '';

  // Populate reasons
  const sel = document.getElementById('addpts-reason');
  sel.innerHTML = '<option value="">-- اختر سبباً --</option>' +
    _reasons.map(r => `<option value="${r.id}" data-val="${r.defaultValue}">${esc(r.label)} (${r.defaultValue})</option>`).join('') +
    '<option value="__custom__">✏️ إدخال يدوي</option>';

  // Quota info
  const quota = _user.dailyQuota || 100;
  getTodayUsage(_user.username, _ptsSelProg?.id || 0).then(used => {
    const rem = quota - used;
    document.getElementById('addpts-quota-info').textContent = `رصيدك المتبقي اليوم: ${rem} نقطة`;
  });

  openM('m-addpts');
}

function onReasonChange() {
  const sel = document.getElementById('addpts-reason');
  const opt = sel.options[sel.selectedIndex];
  const isCustom = sel.value === '__custom__';
  document.getElementById('addpts-custom-wrap').style.display = isCustom ? '' : 'none';
  if (!isCustom && opt?.dataset?.val) {
    document.getElementById('addpts-amount').value = opt.dataset.val;
  }
}

async function savePoints() {
  const studentId = parseInt(document.getElementById('addpts-student-id').value) || 0;
  const amount    = parseInt(document.getElementById('addpts-amount').value) || 0;
  const note      = document.getElementById('addpts-note').value.trim();
  const isCustom  = document.getElementById('addpts-reason').value === '__custom__';
  const reason    = isCustom
    ? document.getElementById('addpts-custom-reason').value.trim()
    : document.getElementById('addpts-reason').options[document.getElementById('addpts-reason').selectedIndex]?.text || '';

  if (!studentId || amount <= 0) { toast('يرجى إدخال مبلغ صحيح', 'error'); return; }
  if (!reason) { toast('يرجى اختيار سبب أو إدخاله', 'error'); return; }
  if (!_ptsSelProg) { toast('لم يتم اختيار البرنامج', 'error'); return; }

  // Check quota
  const used = await getTodayUsage(_user.username, _ptsSelProg.id);
  if (used + amount > _user.dailyQuota) {
    toast(`تجاوزت رصيدك اليومي (${_user.dailyQuota} نقطة) — متبقي: ${_user.dailyQuota - used}`, 'error');
    return;
  }

  try {
    await sbInsert(TB.POINTS, {
      studentId, programId: _ptsSelProg.id, amount,
      reason: reason.replace(/\s*\(\d+\)$/,''), notes: note,
      addedBy: _user.username, source: 'manual'
    });
    _ptsPoints.push({ studentId, programId: _ptsSelProg.id, amount, reason, addedBy: _user.username });
    toast('تم تسجيل النقاط ✅');
    closeM('m-addpts');
    renderPointsTable();
    // Update quota bar
    document.getElementById('pts-quota-used').textContent = used + amount;
    const pct = Math.min(100, Math.round((used + amount) / _user.dailyQuota * 100));
    const bar = document.getElementById('pts-quota-bar');
    bar.style.width = pct + '%';
    bar.className = 'quota-bar' + (pct >= 100 ? ' over' : pct >= 80 ? ' warn' : '');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

async function openPtsHistory(studentId, studentName) {
  document.getElementById('m-ptshistory-title').textContent = `نقاط: ${studentName}`;
  document.getElementById('m-ptshistory-body').innerHTML = `<div class="empty"><div class="ei">⏳</div></div>`;
  openM('m-ptshistory');
  try {
    const pts = _ptsPoints.filter(p => parseInt(p.studentId) === studentId);
    if (!pts.length) {
      document.getElementById('m-ptshistory-body').innerHTML = `<div class="empty"><div class="ei">⭐</div><p>لا توجد نقاط مسجلة</p></div>`;
      return;
    }
    const total = pts.reduce((a,p) => a + p.amount, 0);
    document.getElementById('m-ptshistory-body').innerHTML = `
      <div style="background:var(--bg);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.85rem;color:var(--muted)">إجمالي النقاط</span>
        <span class="pts-badge" style="font-size:1rem">${total}</span>
      </div>
      <div class="table-card" style="margin:0">
        <div class="tbl-wrap"><table>
          <thead><tr><th>السبب</th><th>النقاط</th><th>المصدر</th><th>المضيف</th><th>التاريخ</th></tr></thead>
          <tbody>
            ${pts.map(p => `<tr>
              <td>${esc(p.reason||'')}</td>
              <td><span class="pts-badge">+${p.amount}</span></td>
              <td><span class="badge b-${p.source||'manual'}">${p.source === 'cultural' ? '🏆 ثقافي' : p.source === 'sports' ? '⚽ رياضي' : '👤 يدوي'}</span></td>
              <td style="font-size:.78rem;color:var(--muted)">${esc(p.addedBy||'')}</td>
              <td style="font-size:.78rem;color:var(--muted)">${fmtDatetime(p.addedAt)}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
  } catch(e) {
    document.getElementById('m-ptshistory-body').innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

/* ══════════════════════════════════════════
   CULTURAL SECTION
══════════════════════════════════════════ */
async function loadCultural() {
  const progId = parseInt(document.getElementById('cult-prog-sel').value) || 0;
  _cultSelProg = _progs.find(p => p.id === progId) || null;
  const body = document.getElementById('cult-body');
  if (!_cultSelProg) { body.innerHTML = `<div class="empty"><div class="ei">🏆</div><p>اختر البرنامج</p></div>`; return; }

  body.innerHTML = `<div class="empty"><div class="ei">⏳</div><p>جاري التحميل…</p></div>`;
  try {
    const rows = await sbRead(TB.CULTURAL, `programId=eq.${progId}`);
    _cultComps = rows;
    renderCulturalList();
  } catch(e) {
    body.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

function renderCulturalList() {
  const body = document.getElementById('cult-body');
  if (!_cultComps.length) {
    body.innerHTML = `<div class="empty"><div class="ei">🏆</div><p>لا توجد مسابقات بعد — أضف مسابقة جديدة</p></div>`; return;
  }
  const statusLabel = { draft:'مسودة', active:'نشطة', approved:'معتمدة' };
  body.innerHTML = `<div class="cards-grid">` + _cultComps.map(c => `
    <div class="comp-card">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
        <div class="comp-title">🏆 ${esc(c.name)}</div>
        <span class="badge b-${c.status}">${statusLabel[c.status]||c.status}</span>
      </div>
      <div class="comp-meta">${esc(_cultSelProg?.name||'')} • ${c.type||''}</div>
      <div class="comp-actions">
        ${c.status !== 'approved' ? `<button class="btn btn-sm btn-primary" onclick="openCultParticipants(${c.id})">👥 المشاركون</button>` : ''}
        ${c.status !== 'approved' ? `<button class="btn btn-sm btn-outline" onclick="openCulturalModal(${c.id})">✏️</button>` : ''}
        ${c.status === 'approved' ? `<span style="font-size:.78rem;color:var(--success)">✅ تم اعتماد النتائج وترحيل النقاط</span>` : ''}
      </div>
    </div>`).join('') + `</div>`;
}

function openCulturalModal(id = 0) {
  const c = id ? _cultComps.find(x => x.id === id) : null;
  document.getElementById('m-cultural-title').textContent = c ? '✏️ تعديل المسابقة' : '➕ مسابقة جديدة';
  document.getElementById('cult-edit-id').value   = c?.id || '';
  document.getElementById('cult-name').value      = c?.name || '';
  document.getElementById('cult-type').value      = c?.type || 'general';
  document.getElementById('cult-modal-prog').value = c?.programId || (document.getElementById('cult-prog-sel').value || '');
  openM('m-cultural');
}

async function saveCultural() {
  const id     = parseInt(document.getElementById('cult-edit-id').value) || 0;
  const progId = parseInt(document.getElementById('cult-modal-prog').value) || 0;
  const name   = document.getElementById('cult-name').value.trim();
  const type   = document.getElementById('cult-type').value;
  if (!name || !progId) { toast('يرجى إدخال الاسم واختيار البرنامج', 'error'); return; }
  try {
    if (id) {
      await sbUpdate(TB.CULTURAL, id, { name, type });
      const i = _cultComps.findIndex(c => c.id === id);
      if (i !== -1) Object.assign(_cultComps[i], { name, type });
    } else {
      const created = await sbInsertReturn(TB.CULTURAL, { programId: progId, name, type, status: 'draft' });
      if (created) _cultComps.push(created);
    }
    toast('تم الحفظ ✅'); closeM('m-cultural'); renderCulturalList();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

async function openCultParticipants(compId) {
  _cultSelComp = _cultComps.find(c => c.id === compId);
  if (!_cultSelComp) return;
  document.getElementById('m-cult-part-title').textContent = `مشاركو: ${_cultSelComp.name}`;
  document.getElementById('cult-part-comp-id').value = compId;
  document.getElementById('cult-part-search').value = '';
  document.getElementById('cult-part-results').style.display = 'none';
  document.getElementById('cult-part-rank').value = '';
  document.getElementById('cult-part-pts').value = '';

  const approveBtn = document.getElementById('cult-approve-btn');
  approveBtn.style.display = _cultSelComp.status === 'approved' ? 'none' : '';

  try {
    const rows = await sbRead(TB.CULT_PARTS, `competitionId=eq.${compId}`);
    _cultParts = rows;
    renderCultParts();
    openM('m-cult-participants');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

function renderCultParts() {
  const body = document.getElementById('cult-part-body');
  if (!_cultParts.length) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">لا يوجد مشاركون بعد</td></tr>`; return;
  }
  const sorted = [..._cultParts].sort((a,b) => (a.rank||99) - (b.rank||99));
  body.innerHTML = sorted.map(p => `
    <tr>
      <td>${p.rank || '—'}</td>
      <td>${esc(p.studentName || '')}</td>
      <td><span class="pts-badge">${p.points || 0}</span></td>
      <td><button class="btn btn-sm btn-danger" onclick="removeCultPart(${p.id})">🗑️</button></td>
    </tr>`).join('');
}

function searchCultPart() {
  const q   = document.getElementById('cult-part-search').value.toLowerCase();
  const res = document.getElementById('cult-part-results');
  if (!q) { res.style.display = 'none'; return; }
  const matches = _students.filter(s => s.fullName.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { res.style.display = 'none'; return; }
  res.innerHTML = matches.map(s => `<div class="search-item" onclick="selectCultPart(${s.id},'${esc(s.fullName)}')">${esc(s.fullName)}</div>`).join('');
  res.style.display = '';
}

function selectCultPart(id, name) {
  document.getElementById('cult-part-search').value = name;
  document.getElementById('cult-part-search').dataset.sid = id;
  document.getElementById('cult-part-results').style.display = 'none';
}

async function addCultParticipant() {
  const compId = parseInt(document.getElementById('cult-part-comp-id').value) || 0;
  const sid    = parseInt(document.getElementById('cult-part-search').dataset.sid) || 0;
  const sname  = document.getElementById('cult-part-search').value.trim();
  const rank   = parseInt(document.getElementById('cult-part-rank').value) || null;
  const pts    = parseInt(document.getElementById('cult-part-pts').value) || 0;
  if (!sid || !sname) { toast('يرجى اختيار طالب من القائمة', 'error'); return; }
  try {
    const created = await sbInsertReturn(TB.CULT_PARTS, { competitionId: compId, studentId: sid, studentName: sname, rank, points: pts });
    if (created) _cultParts.push(created);
    document.getElementById('cult-part-search').value = '';
    document.getElementById('cult-part-search').dataset.sid = '';
    document.getElementById('cult-part-rank').value = '';
    document.getElementById('cult-part-pts').value = '';
    renderCultParts();
    toast('تمت الإضافة ✅');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

async function removeCultPart(id) {
  if (!confirm('حذف هذا المشارك؟')) return;
  await sbDelete(TB.CULT_PARTS, id).catch(console.error);
  _cultParts = _cultParts.filter(p => p.id !== id);
  renderCultParts();
}

async function approveCultural() {
  if (!_cultSelComp) return;
  if (!confirm('اعتماد النتائج وترحيل النقاط؟ لا يمكن التراجع.')) return;
  const parts = _cultParts.filter(p => p.points > 0);
  if (!parts.length) { toast('لا توجد نقاط لترحيلها', 'error'); return; }
  try {
    for (const p of parts) {
      await sbInsert(TB.POINTS, {
        studentId: p.studentId, programId: _cultSelComp.programId,
        amount: p.points, reason: `مسابقة: ${_cultSelComp.name} (المركز ${p.rank || '—'})`,
        addedBy: _user.username, source: 'cultural'
      });
    }
    await sbUpdate(TB.CULTURAL, _cultSelComp.id, { status: 'approved' });
    _cultSelComp.status = 'approved';
    const i = _cultComps.findIndex(c => c.id === _cultSelComp.id);
    if (i !== -1) _cultComps[i].status = 'approved';
    toast('تم الاعتماد وترحيل النقاط ✅');
    closeM('m-cult-participants');
    renderCulturalList();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

/* ══════════════════════════════════════════
   SPORTS SECTION
══════════════════════════════════════════ */
async function loadSports() {
  const progId = parseInt(document.getElementById('sports-prog-sel').value) || 0;
  _sportsSProg = _progs.find(p => p.id === progId) || null;
  const body = document.getElementById('sports-body');
  if (!_sportsSProg) { body.innerHTML = `<div class="empty"><div class="ei">⚽</div><p>اختر البرنامج</p></div>`; return; }

  body.innerHTML = `<div class="empty"><div class="ei">⏳</div><p>جاري التحميل…</p></div>`;
  try {
    const rows = await sbRead(TB.SPORTS, `programId=eq.${progId}`);
    _sportsT = rows;
    renderSportsList();
  } catch(e) {
    body.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

function renderSportsList() {
  const body = document.getElementById('sports-body');
  if (!_sportsT.length) {
    body.innerHTML = `<div class="empty"><div class="ei">⚽</div><p>لا توجد بطولات بعد</p></div>`; return;
  }
  const typeLabel = { league:'دوري', knockout:'خروج مغلوب' };
  const statusLabel = { draft:'مسودة', active:'نشطة', approved:'معتمدة' };
  body.innerHTML = `<div class="cards-grid">` + _sportsT.map(t => `
    <div class="comp-card">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
        <div class="comp-title">⚽ ${esc(t.name)}</div>
        <span class="badge b-${t.status}">${statusLabel[t.status]||t.status}</span>
      </div>
      <div class="comp-meta">${typeLabel[t.type]||t.type}</div>
      <div class="comp-actions">
        ${t.status !== 'approved' ? `<button class="btn btn-sm btn-primary" onclick="openTournament(${t.id})">⚽ إدارة</button>` : ''}
        ${t.status !== 'approved' ? `<button class="btn btn-sm btn-outline" onclick="openSportsModal(${t.id})">✏️</button>` : ''}
        ${t.status === 'approved' ? `<span style="font-size:.78rem;color:var(--success)">✅ تم اعتماد النتائج</span>` : ''}
      </div>
    </div>`).join('') + `</div>`;
}

function openSportsModal(id = 0) {
  const t = id ? _sportsT.find(x => x.id === id) : null;
  document.getElementById('m-sports-title').textContent = t ? '✏️ تعديل البطولة' : '➕ بطولة جديدة';
  document.getElementById('sports-edit-id').value  = t?.id || '';
  document.getElementById('sports-name').value     = t?.name || '';
  document.getElementById('sports-type').value     = t?.type || 'league';
  document.getElementById('sports-modal-prog').value = t?.programId || (document.getElementById('sports-prog-sel').value || '');
  openM('m-sports');
}

async function saveSports() {
  const id     = parseInt(document.getElementById('sports-edit-id').value) || 0;
  const progId = parseInt(document.getElementById('sports-modal-prog').value) || 0;
  const name   = document.getElementById('sports-name').value.trim();
  const type   = document.getElementById('sports-type').value;
  if (!name || !progId) { toast('يرجى إدخال الاسم واختيار البرنامج', 'error'); return; }
  try {
    if (id) {
      await sbUpdate(TB.SPORTS, id, { name, type });
      const i = _sportsT.findIndex(t => t.id === id);
      if (i !== -1) Object.assign(_sportsT[i], { name, type });
    } else {
      const created = await sbInsertReturn(TB.SPORTS, { programId: progId, name, type, status: 'draft' });
      if (created) _sportsT.push(created);
    }
    toast('تم الحفظ ✅'); closeM('m-sports'); renderSportsList();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

async function openTournament(tournId) {
  _sportsSel = _sportsT.find(t => t.id === tournId);
  if (!_sportsSel) return;
  document.getElementById('m-tournament-title').textContent = _sportsSel.name;
  document.getElementById('m-tournament-body').innerHTML = `<div class="empty"><div class="ei">⏳</div></div>`;
  document.getElementById('sports-approve-btn').style.display = _sportsSel.status === 'approved' ? 'none' : '';
  openM('m-tournament');
  try {
    const [teams, matches] = await Promise.all([
      sbRead(TB.TEAMS,   `tournamentId=eq.${tournId}`),
      sbRead(TB.MATCHES, `tournamentId=eq.${tournId}`)
    ]);
    _sportsTeams   = teams;
    _sportsMatches = matches;
    renderTournamentBody();
  } catch(e) {
    document.getElementById('m-tournament-body').innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

function renderTournamentBody() {
  const body = document.getElementById('m-tournament-body');
  const isLeague = _sportsSel?.type === 'league';

  // Teams section
  let teamsHtml = `
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <strong>الفرق (${_sportsTeams.length})</strong>
        <button class="btn btn-sm btn-gold" onclick="addSportsTeam()">➕ فريق</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${_sportsTeams.map(t => `<span style="background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:5px 12px;font-size:.82rem;display:flex;align-items:center;gap:6px">
          ${esc(t.name)} <button style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:.8rem" onclick="deleteSportsTeam(${t.id})">✕</button>
        </span>`).join('') || '<span style="color:var(--muted);font-size:.83rem">لا توجد فرق بعد</span>'}
      </div>
    </div>`;

  // Generate matches for league if needed
  let matchesHtml = '';
  if (isLeague) {
    matchesHtml = renderLeagueTable();
  } else {
    matchesHtml = renderKnockoutBracket();
  }

  // Matches list
  let matchListHtml = '';
  if (_sportsTeams.length >= 2) {
    matchListHtml = `
      <div style="margin-top:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <strong>المباريات</strong>
          <button class="btn btn-sm btn-primary" onclick="addMatch()">➕ مباراة</button>
        </div>
        <div class="table-card" style="margin:0">
          <div class="tbl-wrap"><table>
            <thead><tr><th>الفريق الأول</th><th>النتيجة</th><th>الفريق الثاني</th><th>الجولة</th><th>إجراء</th></tr></thead>
            <tbody>
              ${_sportsMatches.map(m => `<tr>
                <td style="font-weight:600">${esc(m.team1Name||'')}</td>
                <td style="text-align:center;font-weight:bold;font-size:1.1rem">${m.status==='played'?`${m.team1Score}—${m.team2Score}`:'—'}</td>
                <td style="font-weight:600">${esc(m.team2Name||'')}</td>
                <td style="font-size:.78rem;color:var(--muted)">${esc(m.round||'')}</td>
                <td><button class="btn btn-sm btn-outline" onclick="openMatch(${m.id})">✏️ نتيجة</button></td>
              </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:16px">لا توجد مباريات بعد</td></tr>'}
            </tbody>
          </table></div>
        </div>
      </div>`;
  }

  body.innerHTML = teamsHtml + matchesHtml + matchListHtml;
}

function renderLeagueTable() {
  if (!_sportsTeams.length) return '';
  // Calculate standings
  const standings = _sportsTeams.map(t => ({
    id: t.id, name: t.name, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0
  }));
  const getTeam = id => standings.find(s => s.id === id);
  _sportsMatches.filter(m => m.status === 'played').forEach(m => {
    const t1 = getTeam(m.team1Id), t2 = getTeam(m.team2Id);
    if (!t1 || !t2) return;
    t1.p++; t2.p++;
    t1.gf += m.team1Score; t1.ga += m.team2Score;
    t2.gf += m.team2Score; t2.ga += m.team1Score;
    if (m.team1Score > m.team2Score)  { t1.w++; t1.pts+=3; t2.l++; }
    else if (m.team1Score < m.team2Score) { t2.w++; t2.pts+=3; t1.l++; }
    else { t1.d++; t2.d++; t1.pts++; t2.pts++; }
  });
  standings.sort((a,b) => b.pts - a.pts || (b.gf-b.ga) - (a.gf-a.ga));
  return `
    <div style="margin-bottom:16px">
      <strong style="display:block;margin-bottom:8px">جدول الترتيب</strong>
      <div class="table-card" style="margin:0"><div class="tbl-wrap"><table>
        <thead><tr><th>#</th><th>الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>نتيجة</th><th>نقاط</th></tr></thead>
        <tbody>${standings.map((t,i) => `<tr class="${i<3?`league-rank-${i+1}`:''}">
          <td style="font-weight:700;color:var(--muted)">${i+1}</td>
          <td style="font-weight:700">${esc(t.name)}</td>
          <td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
          <td>${t.gf}:${t.ga}</td>
          <td><span class="pts-badge">${t.pts}</span></td>
        </tr>`).join('')}</tbody>
      </table></div></div>
    </div>`;
}

function renderKnockoutBracket() {
  if (!_sportsMatches.length) return '';
  const rounds = [...new Set(_sportsMatches.map(m => m.round || 'الجولة 1'))];
  return `
    <div style="margin-bottom:16px">
      <strong style="display:block;margin-bottom:8px">شجرة البطولة</strong>
      <div class="bracket-wrap"><div class="bracket">
        ${rounds.map(r => `
          <div class="bracket-round">
            <div class="bracket-round-title">${esc(r)}</div>
            ${_sportsMatches.filter(m => (m.round||'الجولة 1')===r).map(m => {
              const t1Win = m.status==='played' && m.team1Score > m.team2Score;
              const t2Win = m.status==='played' && m.team2Score > m.team1Score;
              return `<div class="bracket-match">
                <div class="bracket-team ${t1Win?'winner':''}">
                  <span>${esc(m.team1Name||'—')}</span>
                  <span class="bracket-score">${m.status==='played'?m.team1Score:'—'}</span>
                </div>
                <div class="bracket-team ${t2Win?'winner':''}">
                  <span>${esc(m.team2Name||'—')}</span>
                  <span class="bracket-score">${m.status==='played'?m.team2Score:'—'}</span>
                </div>
              </div>`;
            }).join('')}
          </div>`).join('')}
      </div></div>
    </div>`;
}

async function addSportsTeam() {
  const name = prompt('اسم الفريق:'); if (!name?.trim()) return;
  try {
    const created = await sbInsertReturn(TB.TEAMS, { tournamentId: _sportsSel.id, name: name.trim(), players: '[]' });
    if (created) _sportsTeams.push(created);
    renderTournamentBody();
    toast('تمت الإضافة ✅');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

async function deleteSportsTeam(id) {
  if (!confirm('حذف هذا الفريق؟')) return;
  await sbDelete(TB.TEAMS, id).catch(console.error);
  _sportsTeams = _sportsTeams.filter(t => t.id !== id);
  renderTournamentBody();
}

async function addMatch() {
  if (_sportsTeams.length < 2) { toast('يجب إضافة فريقين على الأقل', 'error'); return; }
  // Show quick match adder
  const t1 = _sportsTeams[0], t2 = _sportsTeams[1];
  const opts = _sportsTeams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  const sel1 = `<select id="nm-t1">${opts}</select>`;
  const sel2 = `<select id="nm-t2">${opts}</select>`;
  // Open match modal pre-filled
  document.getElementById('match-id').value = '';
  document.getElementById('match-t1-name').innerHTML = sel1;
  document.getElementById('match-t2-name').innerHTML = sel2;
  if (_sportsTeams.length >= 2) document.getElementById('nm-t2').value = _sportsTeams[1].id;
  document.getElementById('match-t1-score').value = 0;
  document.getElementById('match-t2-score').value = 0;
  document.getElementById('match-round').value = '';
  document.getElementById('match-date').value = todayDate();
  openM('m-match');
}

function openMatch(matchId) {
  const m = _sportsMatches.find(x => x.id === matchId);
  if (!m) return;
  document.getElementById('match-id').value = matchId;
  document.getElementById('match-t1-name').textContent = m.team1Name || '';
  document.getElementById('match-t2-name').textContent = m.team2Name || '';
  document.getElementById('match-t1-score').value = m.team1Score || 0;
  document.getElementById('match-t2-score').value = m.team2Score || 0;
  document.getElementById('match-round').value  = m.round || '';
  document.getElementById('match-date').value   = m.matchDate || todayDate();
  openM('m-match');
}

async function saveMatch() {
  const id = parseInt(document.getElementById('match-id').value) || 0;
  const s1 = parseInt(document.getElementById('match-t1-score').value) || 0;
  const s2 = parseInt(document.getElementById('match-t2-score').value) || 0;
  const round = document.getElementById('match-round').value.trim();
  const date  = document.getElementById('match-date').value;

  try {
    if (id) {
      await sbUpdate(TB.MATCHES, id, { team1Score: s1, team2Score: s2, round, matchDate: date, status: 'played' });
      const i = _sportsMatches.findIndex(m => m.id === id);
      if (i !== -1) Object.assign(_sportsMatches[i], { team1Score: s1, team2Score: s2, round, matchDate: date, status: 'played' });
    } else {
      // New match
      const t1Id = parseInt(document.getElementById('nm-t1')?.value) || _sportsTeams[0]?.id;
      const t2Id = parseInt(document.getElementById('nm-t2')?.value) || _sportsTeams[1]?.id;
      const t1 = _sportsTeams.find(t => t.id === t1Id);
      const t2 = _sportsTeams.find(t => t.id === t2Id);
      const created = await sbInsertReturn(TB.MATCHES, {
        tournamentId: _sportsSel.id, team1Id: t1Id, team2Id: t2Id,
        team1Name: t1?.name, team2Name: t2?.name,
        team1Score: s1, team2Score: s2, round, matchDate: date, status: 'played'
      });
      if (created) _sportsMatches.push(created);
    }
    toast('تم الحفظ ✅'); closeM('m-match'); renderTournamentBody();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

async function approveSports() {
  if (!_sportsSel) return;
  if (!confirm('اعتماد نتائج البطولة؟ لا يمكن التراجع.')) return;
  // Calculate winners and assign points
  const isLeague = _sportsSel.type === 'league';
  let toAward = [];

  if (isLeague) {
    // Points for top 3 teams (aggregate student points)
    const standings = _sportsTeams.map(t => {
      let pts = 0;
      _sportsMatches.filter(m => m.status === 'played').forEach(m => {
        if (m.team1Id === t.id) { if (m.team1Score > m.team2Score) pts+=3; else if (m.team1Score === m.team2Score) pts+=1; }
        if (m.team2Id === t.id) { if (m.team2Score > m.team1Score) pts+=3; else if (m.team1Score === m.team2Score) pts+=1; }
      });
      return { ...t, leaguePts: pts };
    }).sort((a,b) => b.leaguePts - a.leaguePts);
    const rewards = [50, 30, 20];
    standings.slice(0,3).forEach((team, i) => {
      try {
        const players = JSON.parse(team.players || '[]');
        players.forEach(p => { if (p.studentId) toAward.push({ studentId: p.studentId, pts: rewards[i], reason: `دوري ${_sportsSel.name} - المركز ${i+1}` }); });
      } catch {}
    });
  }

  try {
    for (const a of toAward) {
      await sbInsert(TB.POINTS, { studentId: a.studentId, programId: _sportsSel.programId, amount: a.pts, reason: a.reason, addedBy: _user.username, source: 'sports' });
    }
    await sbUpdate(TB.SPORTS, _sportsSel.id, { status: 'approved' });
    _sportsSel.status = 'approved';
    const i = _sportsT.findIndex(t => t.id === _sportsSel.id);
    if (i !== -1) _sportsT[i].status = 'approved';
    toast('تم الاعتماد ✅');
    closeM('m-tournament');
    renderSportsList();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

/* ══════════════════════════════════════════
   LEADERBOARD SECTION
══════════════════════════════════════════ */
async function loadLeaderboard() {
  const progId = parseInt(document.getElementById('lb-prog-sel').value) || 0;
  const body   = document.getElementById('lb-body');
  const extBtn = document.getElementById('lb-ext-btn');
  if (!progId) { body.innerHTML = `<div class="empty"><div class="ei">📊</div><p>اختر البرنامج</p></div>`; extBtn.style.display='none'; return; }
  extBtn.style.display = '';
  extBtn.onclick = () => window.open(`leaderboard.html?prog=${progId}`, '_blank');

  body.innerHTML = `<div class="empty"><div class="ei">⏳</div><p>جاري التحميل…</p></div>`;
  try {
    const [subs, pts] = await Promise.all([
      sbRead(TB.SUBSCRIPTIONS, `programId=eq.${progId}`),
      sbRead(TB.POINTS, `programId=eq.${progId}`)
    ]);
    body.innerHTML = renderLeaderboardHTML(subs, pts);
  } catch(e) {
    body.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

function renderLeaderboardHTML(subs, pts) {
  const ptMap = {};
  pts.forEach(p => { ptMap[parseInt(p.studentId)] = (ptMap[parseInt(p.studentId)]||0) + (parseInt(p.amount)||0); });

  const ranked = subs
    .map(s => ({ id: parseInt(s.studentId), name: s.studentName || '', group: s.groupName || '', pts: ptMap[parseInt(s.studentId)] || 0 }))
    .filter((v,i,a) => a.findIndex(x=>x.id===v.id)===i)  // unique by studentId
    .sort((a,b) => b.pts - a.pts);

  if (!ranked.length) return `<div class="empty"><div class="ei">📊</div><p>لا يوجد مشتركون في هذا البرنامج</p></div>`;

  const top3 = ranked.slice(0,3);
  const rest = ranked.slice(3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const medals = ['🥈','🥇','🥉'];
  const podiumClass = ['lb-pod-2','lb-pod-1','lb-pod-3'];

  const podiumHtml = `
    <div class="lb-podium">
      ${podiumOrder.map((p, i) => {
        const origIdx = podiumOrder.indexOf(p);
        const medal = p === top3[0] ? '🥇' : p === top3[1] ? '🥈' : '🥉';
        const cls   = p === top3[0] ? 'lb-pod-1' : p === top3[1] ? 'lb-pod-2' : 'lb-pod-3';
        return `<div class="lb-pod-item ${cls}">
          <div class="lb-bar"></div>
          <div class="lb-pod-card">
            <div class="lb-pod-rank">${medal}</div>
            <div class="lb-pod-name" title="${esc(p.name)}">${esc(p.name)}</div>
            <div class="lb-pod-pts">${p.pts} نقطة</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  const listHtml = `
    <div class="table-card">
      ${rest.map((p, i) => `
        <div class="lb-list-item">
          <span class="lb-num">${i+4}</span>
          <span class="lb-name">${esc(p.name)}</span>
          <span class="lb-grp">${esc(p.group)}</span>
          <span class="lb-pts">${p.pts}</span>
        </div>`).join('')}
    </div>`;

  return podiumHtml + (rest.length ? listHtml : '');
}

function openLeaderboardExternal() {
  const progId = document.getElementById('lb-prog-sel').value;
  if (progId) window.open(`leaderboard.html?prog=${progId}`, '_blank');
}

/* ══════════════════════════════════════════
   ADMIN SECTION
══════════════════════════════════════════ */
function admTab(tab) {
  ['users','reasons','log'].forEach(t => {
    document.getElementById(`adm-${t}`).style.display = t === tab ? '' : 'none';
    document.getElementById(`adm-tab-${t}`).className = `btn ${t === tab ? 'btn-primary' : 'btn-outline'}`;
  });
  if (tab === 'users')   renderAdmUsers();
  if (tab === 'reasons') renderAdmReasons();
  if (tab === 'log')     loadAdmLog();
}

function renderAdmUsers() {
  const body = document.getElementById('adm-users-body');
  if (!_users.length) { body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">لا يوجد مستخدمون</td></tr>`; return; }
  const permLabels = { attendance:'التحضير', points:'النقاط', cultural:'الثقافي', sports:'الرياضي' };
  body.innerHTML = _users.map(u => {
    const perms = u.permissions || {};
    const permStr = Object.entries(permLabels).filter(([k]) => perms[k]).map(([,v])=>v).join(' • ') || '—';
    return `<tr>
      <td style="font-weight:700">${esc(u.username)}</td>
      <td><span class="badge ${u.role==='super_admin'?'b-active':'b-draft'}">${u.role==='super_admin'?'مسؤول أعلى':'مشرف'}</span></td>
      <td style="font-size:.78rem;color:var(--muted)">${permStr}</td>
      <td>${u.dailyQuota || 100}</td>
      <td><span class="badge ${u.isActive?'b-active':'b-inactive'}">${u.isActive?'نشط':'موقوف'}</span></td>
      <td class="td-actions">
        <button class="btn btn-sm btn-outline" onclick="openUserModal(${u.id})">✏️</button>
        ${u.id !== _user.id ? `<button class="btn btn-sm ${u.isActive?'btn-danger':'btn-success'}" onclick="toggleUser(${u.id},${u.isActive})">${u.isActive?'⛔':'✅'}</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function openUserModal(id = 0) {
  const u = id ? _users.find(x => x.id === id) : null;
  document.getElementById('m-user-title').textContent = u ? '✏️ تعديل مستخدم' : '➕ مستخدم جديد';
  document.getElementById('u-edit-id').value  = u?.id || '';
  document.getElementById('u-username').value = u?.username || '';
  document.getElementById('u-password').value = u?.password || '';
  document.getElementById('u-role').value     = u?.role || 'moderator';
  document.getElementById('u-quota').value    = u?.dailyQuota || 100;
  const perms = u?.permissions || { attendance: true, points: true, cultural: false, sports: false };
  document.querySelectorAll('#u-perms-wrap .perm-chip').forEach(chip => {
    chip.classList.toggle('on', !!perms[chip.dataset.key]);
  });
  onRoleChange();
  openM('m-user');
}

function onRoleChange() {
  const isSA = document.getElementById('u-role').value === 'super_admin';
  document.getElementById('u-perms-wrap').style.display = isSA ? 'none' : '';
}

function togglePerm(chip) { chip.classList.toggle('on'); }

async function saveUser() {
  const id       = parseInt(document.getElementById('u-edit-id').value) || 0;
  const username = document.getElementById('u-username').value.trim();
  const password = document.getElementById('u-password').value.trim();
  const role     = document.getElementById('u-role').value;
  const quota    = parseInt(document.getElementById('u-quota').value) || 100;
  if (!username || !password) { toast('يرجى إدخال اسم المستخدم وكلمة المرور', 'error'); return; }

  const permissions = {};
  document.querySelectorAll('#u-perms-wrap .perm-chip').forEach(chip => {
    permissions[chip.dataset.key] = chip.classList.contains('on');
  });
  if (role === 'super_admin') { ['attendance','points','cultural','sports'].forEach(k => permissions[k] = true); }

  const data = { username, password, role, dailyQuota: quota, permissions, isActive: true };
  try {
    if (id) {
      await sbUpdate(TB.USERS, id, data);
      const i = _users.findIndex(u => u.id === id);
      if (i !== -1) Object.assign(_users[i], data);
    } else {
      const created = await sbInsertReturn(TB.USERS, data);
      if (created) _users.push(created);
    }
    toast('تم الحفظ ✅'); closeM('m-user'); renderAdmUsers();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

async function toggleUser(id, isActive) {
  await sbUpdate(TB.USERS, id, { isActive: !isActive }).catch(console.error);
  const i = _users.findIndex(u => u.id === id);
  if (i !== -1) _users[i].isActive = !isActive;
  renderAdmUsers();
  toast(isActive ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب');
}

function renderAdmReasons() {
  const body = document.getElementById('adm-reasons-body');
  const allReasons = _reasons;
  if (!allReasons.length) { body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">لا توجد بنود</td></tr>`; return; }
  body.innerHTML = allReasons.map(r => `
    <tr>
      <td style="font-weight:600">${esc(r.label)}</td>
      <td><span class="pts-badge">${r.defaultValue}</span></td>
      <td><span class="badge b-active">فعّال</span></td>
      <td class="td-actions">
        <button class="btn btn-sm btn-outline" onclick="openReasonModal(${r.id})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteReason(${r.id})">🗑️</button>
      </td>
    </tr>`).join('');
}

function openReasonModal(id = 0) {
  const r = id ? _reasons.find(x => x.id === id) : null;
  document.getElementById('m-reason-title').textContent = r ? '✏️ تعديل سبب' : '➕ سبب جديد';
  document.getElementById('r-edit-id').value = r?.id || '';
  document.getElementById('r-label').value   = r?.label || '';
  document.getElementById('r-value').value   = r?.defaultValue || 10;
  openM('m-reason');
}

async function saveReason() {
  const id    = parseInt(document.getElementById('r-edit-id').value) || 0;
  const label = document.getElementById('r-label').value.trim();
  const val   = parseInt(document.getElementById('r-value').value) || 10;
  if (!label) { toast('يرجى إدخال اسم السبب', 'error'); return; }
  try {
    if (id) {
      await sbUpdate(TB.POINT_REASONS, id, { label, defaultValue: val });
      const i = _reasons.findIndex(r => r.id === id);
      if (i !== -1) Object.assign(_reasons[i], { label, defaultValue: val });
    } else {
      const created = await sbInsertReturn(TB.POINT_REASONS, { label, defaultValue: val, isActive: true });
      if (created) _reasons.push({ id: parseInt(created.id), label, defaultValue: val });
    }
    toast('تم الحفظ ✅'); closeM('m-reason'); renderAdmReasons();
    // Update reason selects
    populateReasonSelect();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

async function deleteReason(id) {
  if (!confirm('حذف هذا السبب؟')) return;
  await sbDelete(TB.POINT_REASONS, id).catch(console.error);
  _reasons = _reasons.filter(r => r.id !== id);
  renderAdmReasons();
}

function populateReasonSelect() {
  const sel = document.getElementById('addpts-reason');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- اختر سبباً --</option>' +
    _reasons.map(r => `<option value="${r.id}" data-val="${r.defaultValue}">${esc(r.label)} (${r.defaultValue})</option>`).join('') +
    '<option value="__custom__">✏️ إدخال يدوي</option>';
}

async function loadAdmLog() {
  const body = document.getElementById('adm-log-body');
  body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">⏳ جاري التحميل…</td></tr>`;
  try {
    const r = await fetch(`${SB_URL}/logs?select=*&order=id.desc&limit=150`, { headers: _h() });
    const rows = await r.json().catch(() => []);
    if (!rows.length) { body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">لا توجد عمليات</td></tr>`; return; }
    const LOG_ICONS = { add_student:'👤➕', edit_student:'👤✏️', archive_student:'📦', add_program:'📋➕', edit_program:'📋✏️', extend_program:'📅', add_sub:'🔗➕', edit_sub:'🔗✏️', delete_sub:'🗑️', add_payment:'💰' };
    body.innerHTML = rows.map((row, i) => {
      const icon = LOG_ICONS[row.action] || '📌';
      const dt = row.createdAt ? new Date(row.createdAt) : null;
      const time = dt ? dt.toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
      return `<tr>
        <td style="color:var(--muted);font-size:.8rem">${i+1}</td>
        <td style="font-size:1.1rem">${icon}</td>
        <td style="font-size:.85rem">${esc(row.label||'')}</td>
        <td style="font-size:.78rem;color:var(--muted);white-space:nowrap">${time}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);padding:20px">خطأ: ${e.message}</td></tr>`;
  }
}

/* ══════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════ */
function todayDate() { return new Date().toISOString().split('T')[0]; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(d) {
  if (!d) return '';
  try { const dt = new Date(d.includes('T') ? d : d + 'T00:00:00'); if (isNaN(dt)) return d; return dt.toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' }); } catch { return d; }
}
function fmtDatetime(d) {
  if (!d) return '';
  try { const dt = new Date(d); if (isNaN(dt)) return ''; return dt.toLocaleString('ar-SA', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); } catch { return ''; }
}

let _toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show t-${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3500);
}

function openM(id)  { document.getElementById(id).classList.add('open'); }
function closeM(id) { document.getElementById(id).classList.remove('open'); }

// Close overlay on outside click
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) e.target.classList.remove('open');
});

// Login on Enter
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') login();
});

// Close search dropdowns on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    document.querySelectorAll('.search-dropdown').forEach(d => d.style.display = 'none');
  }
});

/* ── Start ── */
document.addEventListener('DOMContentLoaded', checkAuth);

/* ══════════════════════════════════════════
   portal.js — بوابة بارع الشاملة
══════════════════════════════════════════ */

const SB_URL = 'https://oytfhgqhibbcsqbnvwyv.supabase.co/rest/v1';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95dGZoZ3FoaWJiY3NxYm52d3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjgwNDgsImV4cCI6MjA5MDgwNDA0OH0.oX2f-gCIBn8cHvNbgYIrnFc5JeUXtQ_i0AreSqgBWJs';

const TB = {
  STUDENTS       : 'students',
  PROGRAMS       : 'programs',
  SUBSCRIPTIONS  : 'subscriptions',
  POINTS         : 'points',
  POINT_REASONS  : 'point_reasons',
  USERS          : 'users',
  LOGS           : 'logs',
  CULTURAL       : 'cultural_competitions',
  CULT_PARTS     : 'cultural_participants',
  SPORTS         : 'sports_tournaments',
  TEAMS          : 'sports_teams',
  MATCHES        : 'sports_matches',
  STATS          : 'sports_stats',
  SETTINGS       : 'settings',
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

/* ── Attendance state (ADR-007) — mock-only, persisted in localStorage ── */
let _attScreen   = 'programs';                          // 'programs' | 'groups' | 'attend'
let _attProg     = null;                                // selected program object
let _attGroup    = null;                                // selected group name
let _attSubs     = [];                                  // subscriptions for selected program
let _attView     = 'day';                               // 'day' | 'week'
let _attDayKey   = null;                                // active day, Gregorian YYYY-MM-DD
let _attData     = (() => {
  try { return JSON.parse(localStorage.getItem('bare_att_mock') || '{}'); } catch { return {}; }
})();                                                   // { studentId: { 'YYYY-MM-DD': status } }
let _attSelected = new Set();
let _attSearch   = '';
let _attProgCounts = {};                                // { progId: subCount } — جلب مرة واحدة لشاشة البرامج
let _attWeekStart = null;                               // أحد الأسبوع المعروض، YYYY-MM-DD ميلادي
let _attDragId    = null;                               // studentId المسحوب حالياً (drag & drop)

const ATT_STATUS = {
  present: { label: 'حاضر',   icon: 'ح', cls: 'present' },
  late:    { label: 'متأخر',  icon: 'ت', cls: 'late'    },
  excused: { label: 'مستأذن', icon: 'م', cls: 'excused' },
  absent:  { label: 'غائب',   icon: 'غ', cls: 'absent'  }
};

// points state
let _ptsSubs    = [];    // subscriptions for selected program
let _ptsPoints  = [];    // points for selected program
let _ptsSelProg = null;
let _pointsStep = 1;     // وحدة القسمة للتحقق من صحة قيم النقاط
// bulk selection state
let _ptsBulkSel  = new Set(); // Set of selected studentIds (integers)
let _ptsBulkMode = 'add';     // 'add' | 'deduct'
// leaderboard state
let _lbSubs = [];        // بيانات خام للصدارة
let _lbPts  = [];        // نقاط خام للصدارة

// cultural state
let _cultComps  = [];
let _cultParts  = [];
let _cultSelComp = null;
let _cultSelProg = null;

// sports state
let _sportsT      = [];   // tournaments
let _sportsSel    = null; // selected tournament
let _sportsTeams  = [];
let _sportsMatches= [];
let _sportsSProg  = null;

// wizard state
let _wz = { step:1, progId:0, name:'', icon:'⚽', sportType:'كرة قدم', type:'league',
            teams:[], pointsConfig:{rank1:100,rank2:70,rank3:50,topScorer:50,topAssist:30,bestKeeper:30},
            schedule:[], wzStudents:[] };

// match events
let _matchEvents = [];   // [{name, teamId, teamName, type}]

// stats state
let _ssT = [];           // tournaments for stats selector

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
  if (!hasPermission('attendance')) {
    const e = document.getElementById('nav-attendance'); if (e) e.style.display = 'none';
  }
  if (!hasPermission('points')) {
    const e = document.getElementById('nav-points'); if (e) e.style.display = 'none';
  }
  if (!hasPermission('cultural')) {
    ['nav-cultural','nav-cultural-label'].forEach(id => { const e = document.getElementById(id); if(e) e.style.display='none'; });
  }
  if (!hasPermission('sports')) {
    ['nav-sports','nav-sports-label','nav-sport-stats'].forEach(id => { const e = document.getElementById(id); if(e) e.style.display='none'; });
  }

  // Load base data
  try { await Promise.all([loadStudents(), loadPrograms(), loadReasons(), loadPointsStep()]); } catch(e) {}
  if (isSA) { try { await loadUsers(); } catch(e) {} }

  // Populate program selects
  populateProgSelects();

  loadHome();
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
    groups: r.groups || '', days: parseDays(r.days), status: r.status || 'نشط',
    numWeeks: parseInt(r.num_weeks) || 0
  }));
}

async function loadReasons() {
  const rows = await sbRead(TB.POINT_REASONS, 'isActive=eq.true');
  _reasons = rows.map(r => ({ id: parseInt(r.id), label: r.label, defaultValue: parseInt(r.defaultValue) || 10 }));
}

async function loadPointsStep() {
  try {
    const rows = await sbRead(TB.SETTINGS, 'key=eq.points_step');
    if (rows.length) _pointsStep = Math.max(1, parseInt(rows[0].value) || 1);
  } catch(e) { /* يبقى الافتراضي 1 */ }
}

/* مساعدا عرض مصدر النقاط */
function srcLabel(s) {
  if (s === 'cultural') return '\uD83C\uDFC6 \u062B\u0642\u0627\u0641\u064A';
  if (s === 'sports')   return '\u26BD \u0631\u064A\u0627\u0636\u064A';
  return '\uD83C\uDF1F \u0639\u0627\u0645';
}
function srcBadgeClass(s) {
  if (s === 'cultural') return 'b-cultural';
  if (s === 'sports')   return 'b-sports';
  return 'b-manual';
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
  const ids = ['pts-prog-sel','cult-prog-sel','sports-prog-sel','lb-prog-sel','cult-modal-prog','sports-modal-prog','ss-prog-sel'];
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
  home:'الرئيسية',
  attendance:'التحضير',
  points:'النقاط',
  cultural:'الثقافي', sports:'الرياضي', 'sport-stats':'إحصائيات البطولة',
  leaderboard:'الصدارة', admin:'الإدارة'
};

function switchSection(name) {
  // ── حارس الصلاحيات ──
  const _SECTION_PERMS = {
    attendance   : 'attendance',
    points       : 'points',
    cultural     : 'cultural',
    sports       : 'sports',
    'sport-stats': 'sports',
    admin        : '__admin__'
  };
  const req = _SECTION_PERMS[name];
  if (req === '__admin__' && _user?.role !== 'super_admin') {
    toast('ليس لديك صلاحية للوصول إلى هذا القسم', 'error'); return;
  }
  if (req && req !== '__admin__' && !hasPermission(req)) {
    toast('ليس لديك صلاحية للوصول إلى هذا القسم', 'error'); return;
  }

  _activeSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');

  // Update nav active states
  document.querySelectorAll('.nav-item,.nav-sub-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');

  document.getElementById('tb-section').textContent = SECTION_LABELS[name] || name;

  if (name === 'sport-stats') loadSportStats();
  if (name === 'admin') admTab('users');
  if (name === 'attendance') loadAttendance();
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
}

/* ══════════════════════════════════════════
   ATTENDANCE — drill-down (programs → groups → attend)
   ADR-007: واجهة جديدة، بيانات mock في localStorage
══════════════════════════════════════════ */

/** entry point — يُستدعى من switchSection */
async function loadAttendance() {
  // عودة لشاشة البرامج كل مرة (UX متّسق)
  _attScreen = 'programs';
  _attProg = null;
  _attGroup = null;
  _attSelected.clear();
  _attSearch = '';
  _attWeekStart = null;
  renderAttScreen();   // أرسم فوراً — البطاقات ستظهر بدون عدّ، ثم نُحدّث

  // اجلب عدد المشتركين لكل برنامج نشط (مرة واحدة، مع cache)
  const active = _progs.filter(p => p.status === 'نشط');
  const toFetch = active.filter(p => _attProgCounts[p.id] === undefined);
  if (!toFetch.length) return;

  await Promise.all(toFetch.map(async p => {
    try {
      const rows = await sbRead(TB.SUBSCRIPTIONS, `programId=eq.${p.id}&select=id`);
      _attProgCounts[p.id] = rows.length;
    } catch { _attProgCounts[p.id] = 0; }
  }));

  // أعد الرسم لو ما زلنا في شاشة البرامج
  if (_attScreen === 'programs' && _activeSection === 'attendance') {
    renderAttScreen();
  }
}

/** dispatcher */
function renderAttScreen() {
  if (_attScreen === 'programs')      renderAttPrograms();
  else if (_attScreen === 'groups')   renderAttGroups();
  else if (_attScreen === 'attend')   renderAttAttend();
}

/* ── شاشة ١: البرامج النشطة ── */
function renderAttPrograms() {
  const body = document.getElementById('att-body');
  const active = _progs.filter(p => p.status === 'نشط');

  let html = `
    <div class="att-header">
      <div class="att-page-title">التحضير</div>
      <div class="att-page-sub">اختر البرنامج</div>
    </div>`;

  if (!active.length) {
    html += `<div class="empty"><div class="ei">📚</div><p>لا توجد برامج نشطة حالياً</p></div>`;
  } else {
    html += `<div class="att-card-grid">`;
    active.forEach(p => {
      const subCount = _attProgCounts[p.id];
      const countLabel = subCount === undefined ? '⏳ …' : `👥 ${subCount} مشترك`;
      html += `
        <div class="att-card" onclick="selectAttProg(${p.id})">
          <div class="att-card-icon">📚</div>
          <div class="att-card-body">
            <div class="att-card-title">${esc(p.name)}</div>
            <div class="att-card-meta">
              <span>${fmtHijriShort(p.startDate)} → ${fmtHijriShort(p.endDate)}</span>
            </div>
            <div class="att-card-foot">
              <span class="att-card-badge">${countLabel}</span>
            </div>
          </div>
        </div>`;
    });
    html += `</div>`;
  }

  body.innerHTML = html;
}

/* ── شاشة ٢: المجموعات ── */
async function renderAttGroups() {
  const body = document.getElementById('att-body');
  const p = _attProg;
  if (!p) { _attScreen = 'programs'; return renderAttScreen(); }

  body.innerHTML = `
    <div class="att-breadcrumb">
      <button class="att-back-btn" onclick="attBack('programs')">← البرامج</button>
      <span class="att-bc-sep">›</span>
      <span class="att-bc-cur">${esc(p.name)}</span>
    </div>
    <div class="att-header">
      <div class="att-page-title">اختر المجموعة</div>
    </div>
    <div class="empty"><div class="ei">⏳</div><p>جاري تحميل المجموعات…</p></div>`;

  // حمّل subscriptions للبرنامج (مرة واحدة)
  try {
    _attSubs = await sbRead(TB.SUBSCRIPTIONS, `programId=eq.${p.id}`);
  } catch(e) { _attSubs = []; }

  // المجموعات: من حقل البرنامج (مفصول بـ ،) أو فريدة من الاشتراكات
  let groups = (p.groups || '').split('،').map(g => g.trim()).filter(Boolean);
  if (!groups.length) {
    groups = [...new Set(_attSubs.map(s => s.groupName).filter(Boolean))];
  }

  let html = `
    <div class="att-breadcrumb">
      <button class="att-back-btn" onclick="attBack('programs')">← البرامج</button>
      <span class="att-bc-sep">›</span>
      <span class="att-bc-cur">${esc(p.name)}</span>
    </div>
    <div class="att-header">
      <div class="att-page-title">اختر المجموعة</div>
    </div>`;

  if (!groups.length) {
    html += `<div class="empty"><div class="ei">👥</div><p>لا توجد مجموعات في هذا البرنامج</p></div>`;
  } else {
    html += `<div class="att-card-grid">`;
    groups.forEach(g => {
      const count = _attSubs.filter(s => s.groupName === g).length;
      html += `
        <div class="att-card" onclick="selectAttGroup('${esc(g).replace(/'/g, "\\'")}')">
          <div class="att-card-icon">👥</div>
          <div class="att-card-body">
            <div class="att-card-title">المجموعة ${esc(g)}</div>
            <div class="att-card-foot">
              <span class="att-card-badge">${count} طالب</span>
            </div>
          </div>
        </div>`;
    });
    html += `</div>`;
  }

  body.innerHTML = html;
}

/* ── شاشة ٣: التحضير الكامل ── */
function renderAttAttend() {
  const body = document.getElementById('att-body');
  const p = _attProg, g = _attGroup;
  if (!p || !g) { _attScreen = 'programs'; return renderAttScreen(); }

  // تهيئة الأسبوع لو لم يُحسب بعد
  if (!_attWeekStart) _attWeekStart = _attComputeInitialWeek();

  // أيام البرنامج للأسبوع الحالي
  const days = getAttDays();
  if (!_attDayKey || !days.find(d => d.dateGreg === _attDayKey)) {
    // اختر اليوم الحالي إن كان من أيام البرنامج لهذا الأسبوع، وإلا أول يوم
    const today = todayDate();
    _attDayKey = (days.find(d => d.dateGreg === today) || days[0])?.dateGreg || null;
  }

  const nav = _attWeekNavDisabled();
  const rangeLabel = getAttWeekRangeLabel();

  let html = `
    <div class="att-breadcrumb">
      <button class="att-back-btn" onclick="attBack('groups')">← المجموعات</button>
      <span class="att-bc-sep">›</span>
      <span class="att-bc-link" onclick="attBack('programs')">${esc(p.name)}</span>
      <span class="att-bc-sep">›</span>
      <span class="att-bc-cur">المجموعة ${esc(g)}</span>
    </div>

    <div class="att-view-row">
      <div class="att-view-toggle">
        <button class="att-vbtn ${_attView==='day'?'active':''}" onclick="setAttView('day')">عرض يومي</button>
        <button class="att-vbtn ${_attView==='week'?'active':''}" onclick="setAttView('week')">عرض أسبوعي</button>
      </div>
      <div class="att-toolbar">
        <input class="att-search-inp" placeholder="🔍 بحث..." value="${esc(_attSearch)}" oninput="attSearch(this.value)">
      </div>
    </div>

    <div class="att-week-nav">
      <button class="att-week-nav-btn" ${nav.prev ? 'disabled' : ''} onclick="setAttWeek('prev')">← السابق</button>
      <span class="att-week-range">${rangeLabel}</span>
      <button class="att-week-nav-btn" ${nav.next ? 'disabled' : ''} onclick="setAttWeek('next')">التالي →</button>
    </div>

    <div class="att-days-bar" id="att-days-bar"></div>

    <div id="att-view-body"></div>`;

  body.innerHTML = html;

  renderAttDaysBar();
  if (_attView === 'day') renderAttDayView();
  else                     renderAttWeekView();
}

/* ── شريط الأيام ── */
function renderAttDaysBar() {
  const bar = document.getElementById('att-days-bar');
  if (!bar) return;
  const days = getAttDays();
  bar.innerHTML = days.map(d => `
    <button class="att-day-btn ${d.dateGreg===_attDayKey?'active':''}" onclick="setAttDay('${d.dateGreg}')">
      ${d.label}
      <span class="att-day-date">${d.hijri}</span>
    </button>`).join('');
}

/* ── العرض اليومي: stats + bulk + قائمة الطلاب ── */
function renderAttDayView() {
  const view = document.getElementById('att-view-body');
  if (!view) return;
  const students = getAttStudents();

  // إحصائيات لليوم النشط
  const c = { present:0, late:0, excused:0, absent:0 };
  students.forEach(s => {
    const v = (_attData[s.studentId] || {})[_attDayKey];
    if (v && c[v] !== undefined) c[v]++;
  });

  const selN = _attSelected.size;
  const allSel = students.length > 0 && students.every(s => _attSelected.has(s.studentId));
  const someSel = selN > 0 && !allSel;
  const done = students.filter(s => (_attData[s.studentId] || {})[_attDayKey]).length;

  view.innerHTML = `
    <div class="att-stats-row">
      <div class="att-stat"><div class="att-stat-num">${students.length}</div><div class="att-stat-lbl">الإجمالي</div></div>
      <div class="att-stat s-present"><div class="att-stat-num">${c.present}</div><div class="att-stat-lbl">حاضر</div></div>
      <div class="att-stat s-late"><div class="att-stat-num">${c.late}</div><div class="att-stat-lbl">متأخر</div></div>
      <div class="att-stat s-excused"><div class="att-stat-num">${c.excused}</div><div class="att-stat-lbl">مستأذن</div></div>
      <div class="att-stat s-absent"><div class="att-stat-num">${c.absent}</div><div class="att-stat-lbl">غائب</div></div>
    </div>

    <div class="att-bulk-bar ${selN>0?'visible':''}">
      <span class="att-bulk-label">${selN} طالب محدد</span>
      <div class="att-bulk-btns">
        <button class="att-bbtn b-present" onclick="attBulkSet('present')">✓ حاضر</button>
        <button class="att-bbtn b-late"    onclick="attBulkSet('late')">⏱ متأخر</button>
        <button class="att-bbtn b-excused" onclick="attBulkSet('excused')">✎ مستأذن</button>
        <button class="att-bbtn b-absent"  onclick="attBulkSet('absent')">✕ غائب</button>
        <button class="att-bbtn b-clear"   onclick="attBulkSet('')">مسح</button>
      </div>
      <button class="att-deselect-btn" onclick="attDeselectAll()" title="إلغاء التحديد">×</button>
    </div>

    ${students.length ? `
    <div class="att-select-all-row" onclick="attToggleSelectAll()">
      <input type="checkbox" class="att-cb ${someSel?'indeterminate':''}" ${allSel?'checked':''} onclick="event.stopPropagation();attToggleSelectAll()">
      <label>تحديد الكل</label>
    </div>

    <div class="att-students">
      ${students.map((s, i) => {
        const cur = (_attData[s.studentId] || {})[_attDayKey] || '';
        const isSel = _attSelected.has(s.studentId);
        return `
          <div class="att-srow ${isSel?'selected':''}"
               draggable="true"
               ondragstart="attDragStart(event, ${s.studentId})"
               ondragend="attDragEnd(event)"
               ondragover="attDragOver(event)"
               ondragleave="attDragLeave(event)"
               ondrop="attDrop(event, ${s.studentId})"
               onclick="attToggleSelect(${s.studentId})">
            <span class="att-drag-handle" title="اسحب لإعادة الترتيب" aria-hidden="true">⋮⋮</span>
            <input type="checkbox" class="att-cb" ${isSel?'checked':''} onclick="event.stopPropagation();attToggleSelect(${s.studentId})">
            <span class="att-snum">${i+1}</span>
            <span class="att-sname">${esc(s.studentName)}</span>
            <div class="att-sbtns" onclick="event.stopPropagation()">
              ${Object.entries(ATT_STATUS).map(([k, v]) => `
                <button class="att-sbtn ${cur===k?k:''}" title="${v.label}" onclick="attSetStatus(${s.studentId}, '${k}')">${v.icon}</button>
              `).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>

    <div class="att-summary-bar">
      <span>${done} من ${students.length} طالب سُجّل حضورهم</span>
      <button class="att-save-btn" onclick="saveAttendanceMock()">حفظ التحضير</button>
    </div>
    ` : `<div class="empty"><div class="ei">👥</div><p>لا يوجد طلاب مطابقون</p></div>`}
  `;
}

/* ── العرض الأسبوعي: جدول طلاب × أيام ── */
function renderAttWeekView() {
  const view = document.getElementById('att-view-body');
  if (!view) return;
  const students = getAttStudents();
  const days = getAttDays();

  if (!students.length) {
    view.innerHTML = `<div class="empty"><div class="ei">👥</div><p>لا يوجد طلاب مطابقون</p></div>`;
    return;
  }

  const head = `<thead><tr>
    <th>الطالب</th>
    ${days.map(d => `<th>${d.label}</th>`).join('')}
    <th>النسبة</th>
  </tr></thead>`;

  const rows = students.map(s => {
    const stats = days.map(d => {
      const v = (_attData[s.studentId] || {})[d.dateGreg];
      if (!v) return `<td><span class="att-wbadge unset">—</span></td>`;
      return `<td><span class="att-wbadge ${v}">${ATT_STATUS[v].label.charAt(0)}</span></td>`;
    }).join('');
    const present = days.filter(d => {
      const v = (_attData[s.studentId] || {})[d.dateGreg];
      return v === 'present' || v === 'late';
    }).length;
    const pct = days.length ? Math.round(present / days.length * 100) : 0;
    return `<tr>
      <td class="att-week-name">${esc(s.studentName)}</td>
      ${stats}
      <td>
        <div class="att-pct-bar">
          <div class="att-pct-track"><div class="att-pct-fill" style="width:${pct}%"></div></div>
          <span class="att-pct-num">${pct}٪</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  view.innerHTML = `
    <div class="att-week-wrap">
      <table class="att-week-table">
        ${head}
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ══════ Helpers ══════ */

/** أيام البرنامج لأسبوع _attWeekStart: [{dateGreg, label, hijri}]
 *  ملاحظة: نستخدم UTC طوال العمليات لتجنّب انزياح يوم في توقيت السعودية (UTC+3).
 *  السبب: parse-as-local + read-as-UTC كان يُنتج تاريخاً يسبق المطلوب بيوم. */
function getAttDays() {
  const programDays = _attProg?.days || ['الأحد','الاثنين','الثلاثاء','الأربعاء'];
  const DAY_MAP = { 'الأحد':0, 'الاثنين':1, 'الثلاثاء':2, 'الأربعاء':3, 'الخميس':4, 'الجمعة':5, 'السبت':6 };
  let sunday;
  if (_attWeekStart) {
    sunday = new Date(_attWeekStart + 'T12:00:00Z');   // UTC noon
  } else {
    const t = new Date();
    sunday = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), 12, 0, 0));
    sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  }
  return programDays.map(name => {
    const dow = DAY_MAP[name];
    if (dow === undefined) return null;
    const d = new Date(sunday);
    d.setUTCDate(sunday.getUTCDate() + dow);
    const dateGreg = d.toISOString().slice(0, 10);
    return {
      dateGreg,
      label: name,
      hijri: fmtHijriShort(dateGreg)
    };
  }).filter(Boolean);
}

/** الأسبوع الافتراضي عند الدخول: اليوم لو ضمن البرنامج، وإلا حافة البرنامج */
function _attComputeInitialWeek() {
  if (!_attProg) return todayDate();
  const today = new Date(todayDate()        + 'T12:00:00Z');
  const start = new Date(_attProg.startDate + 'T12:00:00Z');
  const end   = new Date(_attProg.endDate   + 'T12:00:00Z');
  let pick;
  if (today < start)      pick = start;
  else if (today > end)   pick = end;
  else                    pick = today;
  const sun = new Date(pick);
  sun.setUTCDate(pick.getUTCDate() - pick.getUTCDay());
  return sun.toISOString().slice(0, 10);
}

/** تصنيف تعطيل أزرار التنقل بناءً على مدى البرنامج */
function _attWeekNavDisabled() {
  if (!_attProg || !_attWeekStart) return { prev: true, next: true };
  const wsObj = new Date(_attWeekStart + 'T12:00:00Z');
  const weObj = new Date(wsObj); weObj.setUTCDate(wsObj.getUTCDate() + 6);
  const weekStart = wsObj.toISOString().slice(0, 10);
  const weekEnd   = weObj.toISOString().slice(0, 10);
  return {
    prev: weekStart <= _attProg.startDate,
    next: weekEnd   >= _attProg.endDate
  };
}

/** تسمية مدى الأسبوع بالهجري ("١٠–١٣ شوال ١٤٤٧" أو متغير حسب الشهر/السنة) */
function getAttWeekRangeLabel() {
  const days = getAttDays();
  if (!days.length) return '';
  const f = parseHijriInput(toHijri(days[0].dateGreg));
  const l = parseHijriInput(toHijri(days[days.length - 1].dateGreg));
  if (!f || !l) return '';
  const HM = ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
  const ar = n => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  if (f.y === l.y && f.m === l.m) {
    return `${ar(f.d)}–${ar(l.d)} ${HM[f.m-1]} ${ar(f.y)}`;
  }
  if (f.y === l.y) {
    return `${ar(f.d)} ${HM[f.m-1]} – ${ar(l.d)} ${HM[l.m-1]} ${ar(f.y)}`;
  }
  return `${ar(f.d)} ${HM[f.m-1]} ${ar(f.y)} – ${ar(l.d)} ${HM[l.m-1]} ${ar(l.y)}`;
}

/** التنقل أسبوعاً للأمام/الخلف — مع guard دفاعي */
function setAttWeek(dir) {
  if (!_attWeekStart) return;
  const nav = _attWeekNavDisabled();
  if (dir === 'prev' && nav.prev) return;
  if (dir === 'next' && nav.next) return;
  const cur = new Date(_attWeekStart + 'T12:00:00Z');
  cur.setUTCDate(cur.getUTCDate() + (dir === 'prev' ? -7 : 7));
  _attWeekStart = cur.toISOString().slice(0, 10);
  // لو اليوم النشط لم يعد ضمن الأسبوع الجديد، اختر أول يوم من البرنامج فيه
  const days = getAttDays();
  if (!days.find(d => d.dateGreg === _attDayKey)) {
    _attDayKey = days[0]?.dateGreg || null;
  }
  _attSelected.clear();
  renderAttAttend();
}

/** الطلاب في المجموعة الحالية بعد فلترة البحث + ترتيب مخصّص */
function getAttStudents() {
  let list = _attSubs.filter(s => s.groupName === _attGroup);
  if (_attSearch) {
    const q = _attSearch.toLowerCase();
    list = list.filter(s => (s.studentName || '').toLowerCase().includes(q));
  }
  // dedupe بـ studentId (لو فيه اشتراكات مكررة لنفس الطالب)
  const seen = new Set();
  list = list.filter(s => {
    if (seen.has(s.studentId)) return false;
    seen.add(s.studentId);
    return true;
  });
  // تطبيق الترتيب المحفوظ — الطلاب الجدد (غير موجودين في الترتيب) يُلحقون بالنهاية
  const savedOrder = _attLoadOrder()[_attGroup] || [];
  if (savedOrder.length) {
    list.sort((a, b) => {
      const ai = savedOrder.indexOf(a.studentId);
      const bi = savedOrder.indexOf(b.studentId);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
  return list;
}

/** تخزين mock في localStorage */
function _attPersist() {
  try { localStorage.setItem('bare_att_mock', JSON.stringify(_attData)); } catch(e) {}
}

/* ── ترتيب الطلاب المخصّص لكل مجموعة (drag & drop) ── */
function _attLoadOrder() {
  try { return JSON.parse(localStorage.getItem('bare_att_order') || '{}'); }
  catch { return {}; }
}
function _attSaveOrder(order) {
  try { localStorage.setItem('bare_att_order', JSON.stringify(order)); } catch(e) {}
}

function attDragStart(e, sid) {
  _attDragId = sid;
  e.dataTransfer.effectAllowed = 'move';
  // setData مطلوب على Firefox لكي يبدأ الـ drag
  try { e.dataTransfer.setData('text/plain', String(sid)); } catch(e) {}
  e.currentTarget.classList.add('dragging');
}
function attDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.att-srow.drop-target').forEach(r => r.classList.remove('drop-target'));
}
function attDragOver(e) {
  if (_attDragId === null) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drop-target');
}
function attDragLeave(e) {
  e.currentTarget.classList.remove('drop-target');
}
function attDrop(e, targetSid) {
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  if (_attDragId === null || _attDragId === targetSid) { _attDragId = null; return; }

  const ids = getAttStudents().map(s => s.studentId);
  const fromIdx = ids.indexOf(_attDragId);
  const toIdx   = ids.indexOf(targetSid);
  if (fromIdx === -1 || toIdx === -1) { _attDragId = null; return; }

  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, _attDragId);

  const order = _attLoadOrder();
  order[_attGroup] = ids;
  _attSaveOrder(order);
  _attDragId = null;
  renderAttDayView();
}

/* ══════ Navigation handlers ══════ */
function selectAttProg(progId) {
  _attProg = _progs.find(p => p.id === progId);
  if (!_attProg) return;
  _attScreen = 'groups';
  _attSelected.clear();
  _attWeekStart = null;   // برنامج جديد → أعد حساب الأسبوع الافتراضي
  renderAttScreen();
}

function selectAttGroup(name) {
  _attGroup = name;
  _attScreen = 'attend';
  _attSelected.clear();
  _attSearch = '';
  _attDayKey = null;  // re-pick on render
  renderAttScreen();
}

function attBack(to) {
  _attSelected.clear();
  if (to === 'programs') {
    _attProg = null;
    _attGroup = null;
    _attScreen = 'programs';
  } else if (to === 'groups') {
    _attGroup = null;
    _attScreen = 'groups';
  }
  renderAttScreen();
}

function setAttDay(key) {
  _attDayKey = key;
  _attSelected.clear();
  if (_attView === 'day') renderAttDayView();
  renderAttDaysBar();
}

function setAttView(v) {
  _attView = v;
  _attSelected.clear();
  renderAttAttend();
}

function attSearch(q) {
  _attSearch = q || '';
  _attSelected.clear();
  if (_attView === 'day') renderAttDayView();
  else                     renderAttWeekView();
}

/* ══════ Selection / Status handlers ══════ */
function attToggleSelect(sid) {
  if (_attSelected.has(sid)) _attSelected.delete(sid);
  else                       _attSelected.add(sid);
  renderAttDayView();
}

function attToggleSelectAll() {
  const students = getAttStudents();
  const allSel = students.length > 0 && students.every(s => _attSelected.has(s.studentId));
  if (allSel) students.forEach(s => _attSelected.delete(s.studentId));
  else        students.forEach(s => _attSelected.add(s.studentId));
  renderAttDayView();
}

function attDeselectAll() {
  _attSelected.clear();
  renderAttDayView();
}

function attBulkSet(status) {
  const sids = [..._attSelected];
  if (!sids.length) return;
  sids.forEach(sid => {
    if (!_attData[sid]) _attData[sid] = {};
    if (status) _attData[sid][_attDayKey] = status;
    else        delete _attData[sid][_attDayKey];
  });
  _attPersist();
  const lbl = status ? ATT_STATUS[status].label : 'مسح';
  toast(`تم تطبيق "${lbl}" على ${sids.length} طالب`, 'success');
  _attSelected.clear();
  renderAttDayView();
}

function attSetStatus(sid, status) {
  if (!_attData[sid]) _attData[sid] = {};
  const cur = _attData[sid][_attDayKey];
  if (cur === status) delete _attData[sid][_attDayKey];
  else                _attData[sid][_attDayKey] = status;
  _attPersist();
  renderAttDayView();
}

function saveAttendanceMock() {
  toast('✅ تم الحفظ محلياً (mock — لا اتصال بالخادم بعد)', 'success');
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

  // امسح التحديد الجماعي عند تغيير البرنامج
  _ptsBulkSel.clear();
  updateBulkBar();

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

  const allChecked = _ptsBulkSel.size === sorted.length && sorted.length > 0;
  body.innerHTML = `
    <div class="table-card">
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th style="width:36px"><input type="checkbox" id="pts-chk-all" ${allChecked ? 'checked' : ''} onchange="toggleBulkAll(this.checked)" title="تحديد الكل"></th>
            <th>#</th><th>الطالب</th><th>المجموعة</th><th>النقاط</th><th>إجراءات</th>
          </tr></thead>
          <tbody>
            ${sorted.map((s, i) => {
              const sid = parseInt(s.studentId);
              const pts = ptMap[sid] || 0;
              const checked = _ptsBulkSel.has(sid);
              return `<tr class="${checked ? 'row-selected' : ''}">
                <td><input type="checkbox" class="pts-chk" data-id="${sid}" ${checked ? 'checked' : ''} onchange="toggleBulkSel(${sid}, this.checked)"></td>
                <td style="color:var(--muted);font-size:.8rem">${i+1}</td>
                <td style="font-weight:600">${esc(s.studentName)}</td>
                <td style="font-size:.8rem;color:var(--muted)">${esc(s.groupName||'—')}</td>
                <td><span class="pts-badge ${pts < 0 ? 'pts-deduct' : ''}">${pts >= 0 ? '' : ''}${pts}</span></td>
                <td class="td-actions">
                  <button class="btn btn-sm btn-gold" onclick="openAddPoints(${sid},'${esc(s.studentName)}')">➕</button>
                  <button class="btn btn-sm btn-outline" onclick="openPtsHistory(${sid},'${esc(s.studentName)}')">📋</button>
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

  // Reset section dropdown
  const secSel = document.getElementById('addpts-section');
  if (secSel) secSel.value = 'general';
  // Step hint
  const hint = document.getElementById('addpts-step-hint');
  if (hint) hint.textContent = _pointsStep > 1 ? `يجب أن يكون مضاعفاً لـ ${_pointsStep}` : '';

  // Quota info
  const quota = _user.dailyQuota || 100;
  getTodayUsage(_user.username, _ptsSelProg?.id || 0).then(used => {
    const rem = quota - used;
    document.getElementById('addpts-quota-info').textContent = `رصيدك المتبقي اليوم: ${rem} نقطة`;
  });

  openM('m-addpts');
}

/* ── Bulk Selection ── */
function toggleBulkSel(id, checked) {
  if (checked) _ptsBulkSel.add(id);
  else _ptsBulkSel.delete(id);
  updateBulkBar();
  // مزامنة checkbox الكل
  const allChk = document.getElementById('pts-chk-all');
  if (allChk) allChk.checked = _ptsBulkSel.size === _ptsSubs.length && _ptsSubs.length > 0;
  // تحديث لون الصف
  const row = document.querySelector(`.pts-chk[data-id="${id}"]`)?.closest('tr');
  if (row) row.className = checked ? 'row-selected' : '';
}

function toggleBulkAll(checked) {
  _ptsBulkSel.clear();
  if (checked) _ptsSubs.forEach(s => _ptsBulkSel.add(parseInt(s.studentId)));
  updateBulkBar();
  document.querySelectorAll('.pts-chk').forEach(c => {
    c.checked = checked;
    const row = c.closest('tr');
    if (row) row.className = checked ? 'row-selected' : '';
  });
}

function updateBulkBar() {
  const bar   = document.getElementById('pts-bulk-bar');
  const count = document.getElementById('pts-bulk-count');
  if (!bar) return;
  if (_ptsBulkSel.size > 0) {
    bar.style.display = 'flex';
    count.textContent = `${_ptsBulkSel.size} طالب محدد`;
  } else {
    bar.style.display = 'none';
  }
}

function clearBulkSel() {
  _ptsBulkSel.clear();
  updateBulkBar();
  document.querySelectorAll('.pts-chk').forEach(c => {
    c.checked = false;
    const row = c.closest('tr');
    if (row) row.className = '';
  });
  const allChk = document.getElementById('pts-chk-all');
  if (allChk) allChk.checked = false;
}

function openBulkPoints(mode) {
  if (_ptsBulkSel.size === 0) { toast('لم تحدد أي طالب', 'error'); return; }
  _ptsBulkMode = mode;
  const isAdd = mode === 'add';

  document.getElementById('bulk-modal-title').textContent = isAdd ? '➕ إضافة جماعية' : '➖ خصم جماعي';
  const badge = document.getElementById('bulk-mode-badge');
  badge.textContent = isAdd ? '➕ إضافة نقاط' : '➖ خصم نقاط';
  badge.className = `bulk-mode-badge ${isAdd ? 'add' : 'deduct'}`;
  document.getElementById('bulk-save-btn').textContent = isAdd ? '✅ إضافة للجميع' : '✅ خصم من الجميع';

  // قائمة الطلاب المحددين
  const selected = _ptsSubs.filter(s => _ptsBulkSel.has(parseInt(s.studentId)));
  document.getElementById('bulk-students-count').textContent = selected.length;
  document.getElementById('bulk-students-list').innerHTML = selected
    .map(s => `<span class="bulk-chip">${esc(s.studentName)}</span>`).join('');

  // تعبئة الأسباب
  const sel = document.getElementById('bulk-reason');
  sel.innerHTML = '<option value="">-- اختر سبباً --</option>' +
    _reasons.map(r => `<option value="${r.id}" data-val="${r.defaultValue}">${esc(r.label)} (${r.defaultValue})</option>`).join('') +
    '<option value="__custom__">✏️ إدخال يدوي</option>';

  // إعادة ضبط الحقول
  document.getElementById('bulk-amount').value = '';
  document.getElementById('bulk-note').value = '';
  document.getElementById('bulk-section').value = 'general';
  document.getElementById('bulk-custom-wrap').style.display = 'none';
  document.getElementById('bulk-custom-reason').value = '';
  document.getElementById('bulk-step-hint').textContent = _pointsStep > 1 ? `يجب أن يكون مضاعفاً لـ ${_pointsStep}` : '';

  // معلومات الكوتا (للإضافة فقط)
  const quotaInfo = document.getElementById('bulk-quota-info');
  if (isAdd) {
    getTodayUsage(_user.username, _ptsSelProg?.id || 0).then(used => {
      const rem = (_user.dailyQuota || 100) - used;
      quotaInfo.textContent = `رصيدك المتبقي اليوم: ${rem} نقطة`;
    });
  } else {
    quotaInfo.textContent = 'الخصم لا يستهلك من الرصيد اليومي';
  }

  openM('m-bulkpts');
}

function onBulkReasonChange() {
  const sel = document.getElementById('bulk-reason');
  const isCustom = sel.value === '__custom__';
  document.getElementById('bulk-custom-wrap').style.display = isCustom ? '' : 'none';
  if (!isCustom && sel.options[sel.selectedIndex]?.dataset?.val) {
    document.getElementById('bulk-amount').value = sel.options[sel.selectedIndex].dataset.val;
  }
}

async function saveBulkPoints() {
  const amountRaw = parseInt(document.getElementById('bulk-amount').value) || 0;
  const note      = document.getElementById('bulk-note').value.trim();
  const isCustom  = document.getElementById('bulk-reason').value === '__custom__';
  const reason    = isCustom
    ? document.getElementById('bulk-custom-reason').value.trim()
    : document.getElementById('bulk-reason').options[document.getElementById('bulk-reason').selectedIndex]?.text || '';
  const section   = document.getElementById('bulk-section').value || 'general';

  if (amountRaw <= 0) { toast('يرجى إدخال مبلغ صحيح', 'error'); return; }
  if (!reason)        { toast('يرجى اختيار سبب أو إدخاله', 'error'); return; }
  if (_pointsStep > 1 && amountRaw % _pointsStep !== 0) {
    toast(`يجب أن يكون المبلغ مضاعفاً لـ ${_pointsStep}`, 'error'); return;
  }

  const isAdd      = _ptsBulkMode === 'add';
  const finalAmt   = isAdd ? amountRaw : -amountRaw;
  const selected   = _ptsSubs.filter(s => _ptsBulkSel.has(parseInt(s.studentId)));

  // فحص الكوتا فقط عند الإضافة
  if (isAdd) {
    const used     = await getTodayUsage(_user.username, _ptsSelProg.id);
    const totalAdd = amountRaw * selected.length;
    const quota    = _user.dailyQuota || 100;
    if (used + totalAdd > quota) {
      toast(`تجاوزت الرصيد اليومي — مطلوب: ${totalAdd} نقطة | متبقي: ${quota - used}`, 'error');
      return;
    }
  }

  // حفظ تسلسلي مع إظهار التقدم
  const btn = document.getElementById('bulk-save-btn');
  btn.disabled = true;
  btn.textContent = 'جاري الحفظ…';

  let successCount = 0;
  const failedNames = [];
  const cleanReason = reason.replace(/\s*\(\d+\)$/, '');

  for (const sub of selected) {
    try {
      const created = await sbInsertReturn(TB.POINTS, {
        studentId : parseInt(sub.studentId),
        programId : _ptsSelProg.id,
        amount    : finalAmt,
        reason    : cleanReason,
        notes     : note,
        addedBy   : _user.username,
        source    : section
      });
      _ptsPoints.push(created || {
        studentId: parseInt(sub.studentId),
        programId: _ptsSelProg.id,
        amount   : finalAmt,
        reason   : cleanReason,
        notes    : note,
        addedBy  : _user.username,
        source   : section
      });
      successCount++;
      // تحديث زر التقدم
      btn.textContent = `${successCount} / ${selected.length}…`;
    } catch(e) {
      failedNames.push(sub.studentName);
    }
  }

  btn.disabled = false;
  btn.textContent = isAdd ? '✅ إضافة للجميع' : '✅ خصم من الجميع';

  if (failedNames.length) {
    toast(`تم ${successCount} بنجاح — فشل: ${failedNames.join('، ')}`, 'warn');
  } else {
    toast(`تم ${isAdd ? 'إضافة' : 'خصم'} النقاط لـ ${successCount} طالب ✅`);
  }

  closeM('m-bulkpts');
  _ptsBulkSel.clear();
  updateBulkBar();
  renderPointsTable();

  // تحديث شريط الكوتا
  if (isAdd) {
    const newUsed = await getTodayUsage(_user.username, _ptsSelProg.id);
    const quota   = _user.dailyQuota || 100;
    const pct     = Math.min(100, Math.round(newUsed / quota * 100));
    document.getElementById('pts-quota-used').textContent = newUsed;
    const bar = document.getElementById('pts-quota-bar');
    bar.style.width = pct + '%';
    bar.className = 'quota-bar' + (pct >= 100 ? ' over' : pct >= 80 ? ' warn' : '');
  }
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
  // التحقق من المضاعف
  if (_pointsStep > 1 && amount % _pointsStep !== 0) {
    toast(`\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0627\u0644\u0645\u0628\u0644\u063A \u0645\u0636\u0627\u0639\u0641\u0627\u064B \u0644\u0640 ${_pointsStep}`, 'error'); return;
  }

  // Check quota
  const used = await getTodayUsage(_user.username, _ptsSelProg.id);
  if (used + amount > _user.dailyQuota) {
    toast(`تجاوزت رصيدك اليومي (${_user.dailyQuota} نقطة) — متبقي: ${_user.dailyQuota - used}`, 'error');
    return;
  }

  const section = document.getElementById('addpts-section')?.value || 'general';
  try {
    const created = await sbInsertReturn(TB.POINTS, {
      studentId, programId: _ptsSelProg.id, amount,
      reason: reason.replace(/\s*\(\d+\)$/,''), notes: note,
      addedBy: _user.username, source: section
    });
    _ptsPoints.push(created || { studentId, programId: _ptsSelProg.id, amount, reason, addedBy: _user.username, source: section });
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
          <thead><tr><th>السبب</th><th>النقاط</th><th>القسم</th><th>المضيف</th><th>التاريخ</th><th>إجراء</th></tr></thead>
          <tbody>
            ${pts.map(p => {
              const canEdit = _user?.role === 'super_admin' || p.addedBy === _user?.username;
              const actions = canEdit
                ? `<td class="td-actions">
                     <button class="btn btn-sm btn-outline" onclick="openEditPtsEntry('${p.id}',${p.amount},'${esc(p.notes||'')}')">✏️</button>
                     <button class="btn btn-sm btn-danger"  onclick="deletePtsEntry('${p.id}',${studentId})">🗑️</button>
                   </td>`
                : `<td style="color:var(--muted);font-size:.8rem">—</td>`;
              return `<tr>
                <td>${esc(p.reason||'')}</td>
                <td><span class="pts-badge ${p.amount < 0 ? 'pts-deduct' : ''}">${p.amount >= 0 ? '+' : ''}${p.amount}</span></td>
                <td><span class="badge ${srcBadgeClass(p.source)}">${srcLabel(p.source)}</span></td>
                <td style="font-size:.78rem;color:var(--muted)">${esc(p.addedBy||'')}</td>
                <td style="font-size:.78rem;color:var(--muted)">${fmtHijriDatetime(p.addedAt)}</td>
                ${actions}
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>`;
  } catch(e) {
    document.getElementById('m-ptshistory-body').innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

async function deletePtsEntry(id, studentId) {
  if (!confirm('حذف هذه النقاط؟ لا يمكن التراجع.')) return;
  try {
    await fetch(`${SB_URL}/points?id=eq.${id}`, { method: 'DELETE', headers: _h() });
    _ptsPoints = _ptsPoints.filter(p => String(p.id) !== String(id));
    toast('تم الحذف ✅');
    closeM('m-ptshistory');
    renderPointsTable();
    // إعادة فتح السجل مع البيانات المحدثة
    const sub = _ptsSubs.find(s => parseInt(s.studentId) === studentId);
    if (sub) setTimeout(() => openPtsHistory(studentId, sub.studentName), 100);
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

function openEditPtsEntry(id, currentAmount, currentNotes) {
  document.getElementById('editpts-id').value     = id;
  document.getElementById('editpts-amount').value = currentAmount;
  document.getElementById('editpts-notes').value  = currentNotes;
  openM('m-editpts');
}

async function saveEditPtsEntry() {
  const id     = document.getElementById('editpts-id').value;
  const amount = parseInt(document.getElementById('editpts-amount').value) || 0;
  const notes  = document.getElementById('editpts-notes').value.trim();
  if (!id || amount <= 0) { toast('يرجى إدخال مبلغ صحيح', 'error'); return; }
  if (_pointsStep > 1 && amount % _pointsStep !== 0) {
    toast(`يجب أن يكون المبلغ مضاعفاً لـ ${_pointsStep}`, 'error'); return;
  }
  try {
    await sbUpdate(TB.POINTS, id, { amount, notes });
    const idx = _ptsPoints.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) { _ptsPoints[idx].amount = amount; _ptsPoints[idx].notes = notes; }
    toast('تم التعديل ✅');
    closeM('m-editpts');
    renderPointsTable();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
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
    // إظهار nav إحصائيات إذا يوجد بطولات
    const navSS = document.getElementById('nav-sport-stats');
    if (navSS && hasPermission('sports')) navSS.style.display = rows.length ? '' : 'none';
  } catch(e) {
    body.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

function renderSportsList() {
  const body = document.getElementById('sports-body');
  if (!_sportsT.length) {
    body.innerHTML = `<div class="empty"><div class="ei">⚽</div><p>لا توجد بطولات بعد — اضغط "بطولة جديدة" لإنشاء أول بطولة</p></div>`; return;
  }
  const typeLabel   = { league:'دوري', knockout:'خروج مغلوب' };
  const sportIcons  = { 'كرة قدم':'⚽', 'كرة طائرة':'🏐', 'كرة سلة':'🏀', 'تنس طاولة':'🏓', 'تنس':'🎾', 'سباحة':'🏊', 'ملاكمة':'🥊' };
  const statusLabel = { draft:'مسودة', active:'نشطة', approved:'معتمدة' };
  const statusCls   = { draft:'b-draft', active:'b-active', approved:'b-approved' };
  body.innerHTML = `<div class="cards-grid">` + _sportsT.map(t => {
    const icon = t.icon || sportIcons[t.sportType] || '⚽';
    return `<div class="comp-card">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <div class="comp-title">${icon} ${esc(t.name)}</div>
        <span class="badge ${statusCls[t.status]||'b-draft'}">${statusLabel[t.status]||t.status}</span>
      </div>
      <div class="comp-meta">${typeLabel[t.type]||t.type}${t.sportType ? ' · '+esc(t.sportType) : ''}</div>
      <div class="comp-actions" style="margin-top:10px">
        ${t.status !== 'approved' ? `<button class="btn btn-sm btn-primary" onclick="openTournament(${t.id})">⚽ إدارة</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="openSportStatsFor(${t.id})">📊 إحصائيات</button>
        ${t.status !== 'approved' ? `<button class="btn btn-sm btn-outline" onclick="openSportsModal(${t.id})">✏️ تعديل</button>` : ''}
        ${t.status === 'approved' ? `<span style="font-size:.78rem;color:var(--success)">✅ تم الاعتماد</span>` : ''}
      </div>
    </div>`;
  }).join('') + `</div>`;
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
  writeDateInput('match-date', todayDate());
  openM('m-match');
}

function openMatch(matchId) {
  const m = _sportsMatches.find(x => x.id === matchId);
  if (!m) return;
  _matchEvents = [];
  try { _matchEvents = JSON.parse(m.scorers || '[]'); } catch {}
  document.getElementById('match-id').value = matchId;
  document.getElementById('match-t1-name').textContent = m.team1Name || '';
  document.getElementById('match-t2-name').textContent = m.team2Name || '';
  document.getElementById('match-t1-score').value = m.team1Score || 0;
  document.getElementById('match-t2-score').value = m.team2Score || 0;
  document.getElementById('match-round').value  = m.round || '';
  writeDateInput('match-date', m.matchDate || todayDate());
  // populate team selector
  const teamSel = document.getElementById('event-team-sel');
  if (teamSel) {
    teamSel.innerHTML = _sportsTeams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  }
  renderMatchEvents();
  openM('m-match');
}

function addMatchEvent() {
  const name   = (document.getElementById('event-player-name')?.value || '').trim();
  const teamId = parseInt(document.getElementById('event-team-sel')?.value) || 0;
  const type   = document.getElementById('event-type-sel')?.value || 'goal';
  if (!name) { toast('يرجى إدخال اسم اللاعب', 'error'); return; }
  const team = _sportsTeams.find(t => t.id === teamId);
  _matchEvents.push({ name, teamId, teamName: team?.name || '', type });
  document.getElementById('event-player-name').value = '';
  renderMatchEvents();
}

function renderMatchEvents() {
  const el = document.getElementById('match-events-list');
  if (!el) return;
  const typeIcons = { goal:'⚽', assist:'🎯', yellow:'🟨', red:'🟥' };
  el.innerHTML = _matchEvents.map((ev, i) => `
    <span class="event-chip ${ev.type}">
      ${typeIcons[ev.type]||'⚽'} ${esc(ev.name)} <span style="opacity:.6;font-size:.7rem">(${esc(ev.teamName)})</span>
      <button onclick="removeMatchEvent(${i})">✕</button>
    </span>`).join('') || `<span style="font-size:.78rem;color:var(--muted)">لا توجد أحداث بعد</span>`;
}

function removeMatchEvent(index) {
  _matchEvents.splice(index, 1);
  renderMatchEvents();
}

async function saveMatch() {
  const id = parseInt(document.getElementById('match-id').value) || 0;
  const s1 = parseInt(document.getElementById('match-t1-score').value) || 0;
  const s2 = parseInt(document.getElementById('match-t2-score').value) || 0;
  const round = document.getElementById('match-round').value.trim();
  const date  = readDateInput('match-date');
  const scorersJson = JSON.stringify(_matchEvents);

  try {
    if (id) {
      await sbUpdate(TB.MATCHES, id, { team1Score: s1, team2Score: s2, round, matchDate: date, status: 'played', scorers: scorersJson });
      const i = _sportsMatches.findIndex(m => m.id === id);
      if (i !== -1) Object.assign(_sportsMatches[i], { team1Score: s1, team2Score: s2, round, matchDate: date, status: 'played', scorers: scorersJson });
    } else {
      const t1Id = parseInt(document.getElementById('nm-t1')?.value) || _sportsTeams[0]?.id;
      const t2Id = parseInt(document.getElementById('nm-t2')?.value) || _sportsTeams[1]?.id;
      const t1 = _sportsTeams.find(t => t.id === t1Id);
      const t2 = _sportsTeams.find(t => t.id === t2Id);
      const created = await sbInsertReturn(TB.MATCHES, {
        tournamentId: _sportsSel.id, team1Id: t1Id, team2Id: t2Id,
        team1Name: t1?.name, team2Name: t2?.name,
        team1Score: s1, team2Score: s2, round, matchDate: date, status: 'played', scorers: scorersJson
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
    let cfg = { rank1:100, rank2:70, rank3:50 };
    try { if (_sportsSel.pointsConfig) cfg = { ...cfg, ...JSON.parse(_sportsSel.pointsConfig) }; } catch {}
    const rewards = [cfg.rank1, cfg.rank2, cfg.rank3];
    standings.slice(0,3).forEach((team, i) => {
      try {
        const players = JSON.parse(team.players || '[]');
        players.forEach(p => { if (p.studentId) toAward.push({ studentId: p.studentId, pts: rewards[i], reason: `${_sportsSel.name} - المركز ${i+1}` }); });
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
   WIZARD — CREATE TOURNAMENT
══════════════════════════════════════════ */
const SPORT_ICONS = ['⚽','🏀','🏐','🎾','🏓','🥊','🏊','🏋️','🏃','🎱'];
const SPORT_TYPES = ['كرة قدم','كرة سلة','كرة طائرة','تنس طاولة','تنس','سباحة','ملاكمة','أخرى'];

function openWizard() {
  _wz = { step:1, progId: parseInt(document.getElementById('sports-prog-sel')?.value) || 0,
          name:'', icon:'⚽', sportType:'كرة قدم', type:'league',
          teams:[{name:'الفريق الأول', players:[]},{name:'الفريق الثاني', players:[]}],
          pointsConfig:{rank1:100,rank2:70,rank3:50,topScorer:50,topAssist:30,bestKeeper:30},
          schedule:[], wzStudents:[] };
  renderWizardStep(1);
  openM('m-wizard');
}

function renderWizardStep(n) {
  _wz.step = n;
  // تحديث شريط الخطوات
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('wz-s' + i);
    if (!el) continue;
    el.className = 'wz-step' + (i < n ? ' done' : i === n ? ' active' : '');
  }
  document.getElementById('wz-back-btn').style.display = n > 1 ? '' : 'none';
  document.getElementById('wz-next-btn').textContent   = n === 4 ? '💾 إنشاء البطولة' : 'التالي →';

  const body = document.getElementById('wz-body');
  if (n === 1) body.innerHTML = renderWizStep1();
  if (n === 2) body.innerHTML = renderWizStep2();
  if (n === 3) body.innerHTML = renderWizStep3();
  if (n === 4) body.innerHTML = renderWizStep4();
}

function renderWizStep1() {
  const progOpts = _progs.map(p => `<option value="${p.id}" ${p.id===_wz.progId?'selected':''}>${esc(p.name)}</option>`).join('');
  const iconOpts = SPORT_ICONS.map(ic => `<span class="icon-opt${ic===_wz.icon?' sel':''}" onclick="wzPickIcon('${ic}')" id="ico-${ic}">${ic}</span>`).join('');
  const typeOpts = SPORT_TYPES.map(t => `<option value="${t}" ${t===_wz.sportType?'selected':''}>${t}</option>`).join('');
  return `
    <div class="form-group">
      <label>اسم البطولة <span style="color:var(--danger)">*</span></label>
      <input type="text" id="wz-name" placeholder="مثال: دوري بارع الرمضاني" value="${esc(_wz.name)}"
        oninput="_wz.name=this.value" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.9rem">
    </div>
    <div class="form-group">
      <label>البرنامج <span style="color:var(--danger)">*</span></label>
      <select id="wz-prog" onchange="_wz.progId=parseInt(this.value)"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.88rem">
        <option value="">-- اختر --</option>${progOpts}
      </select>
    </div>
    <div class="form-group">
      <label>أيقونة البطولة</label>
      <div class="icon-picker">${iconOpts}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="form-group">
        <label>نوع الرياضة</label>
        <select id="wz-sport-type" onchange="_wz.sportType=this.value"
          style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.88rem">
          ${typeOpts}
        </select>
      </div>
      <div class="form-group">
        <label>نظام البطولة</label>
        <select id="wz-type" onchange="_wz.type=this.value"
          style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.88rem">
          <option value="league" ${_wz.type==='league'?'selected':''}>دوري (كل فريق يلعب مع الآخر)</option>
          <option value="knockout" ${_wz.type==='knockout'?'selected':''}>خروج مغلوب (bracket)</option>
        </select>
      </div>
    </div>`;
}

function wzPickIcon(ic) {
  _wz.icon = ic;
  document.querySelectorAll('.icon-opt').forEach(el => el.classList.remove('sel'));
  const el = document.getElementById('ico-' + ic);
  if (el) el.classList.add('sel');
}

function renderWizStep2() {
  // جمع الطلاب من البرنامج المختار
  if (_wz.progId) {
    _wz.wzStudents = _wz.wzStudents.length ? _wz.wzStudents : getProgStudents(_wz.progId);
  }
  const allAssigned = new Set(_wz.teams.flatMap(t => t.players.map(p => p.studentId)));

  const studentsHtml = _wz.wzStudents.length
    ? _wz.wzStudents.map(s => {
        const assigned = allAssigned.has(s.id);
        const teamIdx  = _wz.teams.findIndex(t => t.players.some(p => p.studentId === s.id));
        return `<div class="tb-student-row ${assigned?'assigned':''}">
          <span>${esc(s.fullName)}</span>
          ${assigned
            ? `<button class="tb-assign-btn" style="background:#fee2e2;color:var(--danger)" onclick="removeFromTeam(${s.id})">↩ إزالة</button>`
            : `<select id="ts-${s.id}" style="font-size:.72rem;padding:2px 4px;border:1px solid var(--border);border-radius:5px;font-family:inherit">
                ${_wz.teams.map((t,i) => `<option value="${i}">${esc(t.name)}</option>`).join('')}
              </select>
              <button class="tb-assign-btn" onclick="assignToTeam(${s.id})">إضافة</button>`
          }
        </div>`;
      }).join('')
    : `<div style="color:var(--muted);font-size:.83rem;padding:16px;text-align:center">لا توجد بيانات طلاب للبرنامج المختار</div>`;

  const groupOpts = _wz.progId
    ? ((_progs.find(p => p.id===_wz.progId)?.groups || '').split('،').map(g => g.trim()).filter(Boolean)
        .map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('') || '')
    : '';

  const teamsHtml = _wz.teams.map((t, i) => `
    <div class="tb-team-card">
      <div class="tb-team-hdr">
        <input type="text" class="tb-team-name-lbl" value="${esc(t.name)}"
          onchange="_wz.teams[${i}].name=this.value"
          style="border:none;border-bottom:1.5px solid var(--border);background:transparent;font-weight:700;font-size:.85rem;color:var(--primary);width:100%;font-family:inherit;outline:none;padding:2px 0">
        ${_wz.teams.length > 2 ? `<button onclick="removeWizTeam(${i})" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:.85rem">✕</button>` : ''}
      </div>
      <div class="tb-team-players">
        ${t.players.length
          ? t.players.map(p => `<span class="tb-player-chip" onclick="removeFromTeam(${p.studentId})">👤 ${esc(p.name)} ✕</span>`).join('')
          : `<span style="font-size:.75rem;color:var(--muted)">لا يوجد لاعبون بعد</span>`}
      </div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:4px">${t.players.length} لاعب</div>
    </div>`).join('');

  return `
    ${groupOpts ? `<div class="form-group" style="margin-bottom:12px">
      <label>سحب الطلاب من مجموعة (اختياري)</label>
      <div style="display:flex;gap:8px">
        <select id="wz-group-sel" style="flex:1;padding:7px 10px;border:1.5px solid var(--border);border-radius:7px;font-family:inherit;font-size:.85rem">
          <option value="">جميع المشتركين</option>${groupOpts}
        </select>
        <button class="btn btn-sm btn-outline" onclick="filterWizByGroup()">🔄 تحديث</button>
      </div>
    </div>` : ''}
    <div class="team-builder">
      <div>
        <div style="font-weight:700;font-size:.85rem;margin-bottom:8px;color:var(--primary)">قائمة الطلاب (${_wz.wzStudents.length})</div>
        <div class="tb-students">${studentsHtml}</div>
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-weight:700;font-size:.85rem;color:var(--primary)">الفرق (${_wz.teams.length})</span>
          <button class="btn btn-sm btn-gold" onclick="addWizTeam()">➕ فريق</button>
        </div>
        <div class="tb-teams">${teamsHtml}</div>
      </div>
    </div>`;
}

function getProgStudents(progId) {
  // يحضر المشتركين في البرنامج من _students
  const progSubs = window._allSubs ? window._allSubs.filter(s => s.programId === progId) : [];
  if (progSubs.length) {
    return progSubs.map(s => ({ id: s.studentId, fullName: s.studentName || '' }))
                   .filter((v,i,a) => a.findIndex(x=>x.id===v.id)===i);
  }
  return _students.slice(0, 30); // fallback
}

function filterWizByGroup() {
  const g = document.getElementById('wz-group-sel')?.value;
  if (!g) { _wz.wzStudents = getProgStudents(_wz.progId); }
  else {
    // نبحث في _allSubs عن طلاب هذه المجموعة
    const subs = window._allSubs
      ? window._allSubs.filter(s => s.programId === _wz.progId && s.groupName === g)
      : [];
    _wz.wzStudents = subs.length
      ? subs.map(s => ({ id: s.studentId, fullName: s.studentName || '' })).filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i)
      : getProgStudents(_wz.progId);
  }
  renderWizardStep(2);
}

function assignToTeam(studentId) {
  const sel = document.getElementById('ts-' + studentId);
  const teamIdx = parseInt(sel?.value) || 0;
  const s = _wz.wzStudents.find(x => x.id === studentId);
  if (!s) return;
  if (!_wz.teams[teamIdx]) return;
  // إزالة من أي فريق آخر أولاً
  _wz.teams.forEach(t => { t.players = t.players.filter(p => p.studentId !== studentId); });
  _wz.teams[teamIdx].players.push({ studentId: s.id, name: s.fullName });
  renderWizardStep(2);
}

function removeFromTeam(studentId) {
  _wz.teams.forEach(t => { t.players = t.players.filter(p => p.studentId !== studentId); });
  renderWizardStep(2);
}

function addWizTeam() {
  _wz.teams.push({ name: `الفريق ${_wz.teams.length + 1}`, players: [] });
  renderWizardStep(2);
}

function removeWizTeam(idx) {
  if (_wz.teams.length <= 2) { toast('البطولة تحتاج فريقين على الأقل', 'error'); return; }
  _wz.teams.splice(idx, 1);
  renderWizardStep(2);
}

function renderWizStep3() {
  const c = _wz.pointsConfig;
  const field = (label, key, val) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
      <label style="font-size:.87rem">${label}</label>
      <input type="number" min="0" value="${val}"
        onchange="_wz.pointsConfig.${key}=parseInt(this.value)||0"
        style="width:80px;padding:6px 8px;border:1.5px solid var(--border);border-radius:7px;font-family:inherit;font-size:.9rem;text-align:center">
    </div>`;
  return `
    <div style="background:var(--bg);border-radius:10px;padding:14px 16px;margin-bottom:12px;font-size:.82rem;color:var(--muted)">
      🏆 النقاط ستُمنح تلقائياً عند الاعتماد النهائي بناءً على المراكز. يمكنك تعديلها أو إبقاؤها كما هي.
    </div>
    <div style="background:var(--white);border-radius:10px;padding:4px 16px;box-shadow:var(--shadow)">
      <div style="font-weight:700;font-size:.85rem;padding:12px 0;color:var(--primary)">🥇 جوائز المراكز (لكل لاعب في الفريق)</div>
      ${field('🥇 المركز الأول', 'rank1', c.rank1)}
      ${field('🥈 المركز الثاني', 'rank2', c.rank2)}
      ${field('🥉 المركز الثالث', 'rank3', c.rank3)}
      <div style="font-weight:700;font-size:.85rem;padding:12px 0 4px;color:var(--primary);margin-top:8px">🌟 جوائز فردية</div>
      ${field('👟 الهداف (Golden Boot)', 'topScorer', c.topScorer)}
      ${field('🎯 صانع الأهداف', 'topAssist', c.topAssist)}
      ${field('🧤 أفضل حارس', 'bestKeeper', c.bestKeeper)}
    </div>`;
}

function renderWizStep4() {
  const scheduleHtml = _wz.schedule.length
    ? `<div class="schedule-preview">
        ${_wz.schedule.map((m,i) => `
          <div class="match-preview-row">
            <span class="mp-team">${esc(m.t1.name)}</span>
            <span class="mp-vs">⚽</span>
            <span class="mp-team" style="text-align:left">${esc(m.t2.name)}</span>
            <span class="mp-round">${esc(m.round||'')}</span>
          </div>`).join('')}
      </div>
      <div style="text-align:center;margin-top:10px;font-size:.83rem;color:var(--muted)">${_wz.schedule.length} مباراة</div>`
    : `<div style="text-align:center;padding:28px;color:var(--muted)">
        <div style="font-size:2rem;margin-bottom:8px">📅</div>
        <p style="font-size:.85rem">اضغط "توليد الجدول" لتوليد المباريات تلقائياً</p>
      </div>`;
  return `
    <div style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:.82rem;color:var(--muted)">
      الفرق: <strong>${_wz.teams.map(t=>esc(t.name)).join(' · ')}</strong>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:14px">
      <button class="btn btn-primary" style="flex:1" onclick="wizardGenerateSchedule()">⚡ توليد الجدول تلقائياً</button>
      ${_wz.schedule.length ? `<button class="btn btn-outline" onclick="_wz.schedule=[];renderWizardStep(4)">🗑️ مسح</button>` : ''}
    </div>
    ${scheduleHtml}`;
}

function wizardGenerateSchedule() {
  const teams = _wz.teams.filter(t => t.name.trim());
  if (teams.length < 2) { toast('يجب وجود فريقين على الأقل', 'error'); return; }
  _wz.schedule = _wz.type === 'league' ? generateRoundRobin(teams) : generateKnockout(teams);
  renderWizardStep(4);
}

function generateRoundRobin(teams) {
  const t = [...teams.map((x,i) => ({ ...x, _idx: i }))];
  if (t.length % 2 !== 0) t.push({ name: 'استراحة', _idx: -1 });
  const rounds = t.length - 1;
  const half   = t.length / 2;
  const matches = [];
  const arr = [...t];
  for (let r = 0; r < rounds; r++) {
    const roundName = `الجولة ${r + 1}`;
    for (let i = 0; i < half; i++) {
      const t1 = arr[i], t2 = arr[arr.length - 1 - i];
      if (t1._idx !== -1 && t2._idx !== -1) matches.push({ t1, t2, round: roundName });
    }
    // تدوير: ثبّت الأول، حرّك البقية
    arr.splice(1, 0, arr.pop());
  }
  return matches;
}

function generateKnockout(teams) {
  const matches = [];
  const roundName = teams.length <= 4 ? 'نصف النهائي' : teams.length <= 8 ? 'ربع النهائي' : 'دور 16';
  for (let i = 0; i + 1 < teams.length; i += 2) {
    matches.push({ t1: teams[i], t2: teams[i + 1], round: roundName });
  }
  if (teams.length % 2 !== 0) {
    matches.push({ t1: teams[teams.length - 1], t2: { name: 'منتصف تلقائي', _idx: -1 }, round: roundName });
  }
  return matches;
}

function wizardNext() {
  const step = _wz.step;
  if (step === 1) {
    _wz.name = document.getElementById('wz-name')?.value.trim() || _wz.name;
    _wz.progId = parseInt(document.getElementById('wz-prog')?.value) || _wz.progId;
    if (!_wz.name) { toast('يرجى إدخال اسم البطولة', 'error'); return; }
    if (!_wz.progId) { toast('يرجى اختيار البرنامج', 'error'); return; }
    // جلب الطلاب
    if (!_wz.wzStudents.length) _wz.wzStudents = getProgStudents(_wz.progId);
    renderWizardStep(2);
  } else if (step === 2) {
    const hasPlayers = _wz.teams.some(t => t.players.length > 0);
    if (!hasPlayers) {
      if (!confirm('لم تضف لاعبين للفرق بعد. هل تريد المتابعة؟')) return;
    }
    renderWizardStep(3);
  } else if (step === 3) {
    renderWizardStep(4);
  } else if (step === 4) {
    saveWizard();
  }
}

function wizardBack() {
  if (_wz.step > 1) renderWizardStep(_wz.step - 1);
}

async function saveWizard() {
  const btn = document.getElementById('wz-next-btn');
  btn.disabled = true;
  btn.textContent = '⏳ جاري الحفظ…';
  try {
    // 1. إنشاء البطولة
    const tourn = await sbInsertReturn(TB.SPORTS, {
      programId: _wz.progId, name: _wz.name, icon: _wz.icon,
      sportType: _wz.sportType, type: _wz.type, status: 'draft',
      pointsConfig: JSON.stringify(_wz.pointsConfig)
    });
    if (!tourn) throw new Error('فشل في إنشاء البطولة');
    const tournId = parseInt(tourn.id);

    // 2. إنشاء الفرق
    const createdTeams = [];
    for (const team of _wz.teams) {
      const ct = await sbInsertReturn(TB.TEAMS, {
        tournamentId: tournId, name: team.name,
        players: JSON.stringify(team.players)
      });
      if (ct) createdTeams.push({ ...ct, players: team.players });
    }

    // 3. إنشاء المباريات المولّدة
    if (_wz.schedule.length) {
      for (const m of _wz.schedule) {
        // ابحث عن الفرق الفعلية المُنشأة
        const ct1 = createdTeams.find(t => t.name === m.t1.name);
        const ct2 = createdTeams.find(t => t.name === m.t2.name);
        if (ct1 && ct2) {
          await sbInsert(TB.MATCHES, {
            tournamentId: tournId,
            team1Id: parseInt(ct1.id), team2Id: parseInt(ct2.id),
            team1Name: ct1.name, team2Name: ct2.name,
            team1Score: 0, team2Score: 0, round: m.round,
            status: 'pending', scorers: '[]'
          });
        }
      }
    }

    // 4. تحديث الـ state
    _sportsT.push({ ...tourn, icon: _wz.icon, sportType: _wz.sportType, pointsConfig: JSON.stringify(_wz.pointsConfig) });
    toast(`✅ تم إنشاء بطولة "${_wz.name}" بنجاح!`);
    closeM('m-wizard');
    renderSportsList();
    const navSS = document.getElementById('nav-sport-stats');
    if (navSS && hasPermission('sports')) navSS.style.display = '';
  } catch(e) {
    toast('خطأ: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 إنشاء البطولة';
  }
}

/* ══════════════════════════════════════════
   SPORT STATS SECTION
══════════════════════════════════════════ */
async function loadSportStats() {
  const progId = parseInt(document.getElementById('ss-prog-sel')?.value) || 0;
  const body   = document.getElementById('sport-stats-body');
  const sel    = document.getElementById('ss-tourn-sel');
  if (!progId) { body.innerHTML = `<div class="empty"><div class="ei">📊</div><p>اختر البرنامج</p></div>`; return; }

  try {
    const rows = await sbRead(TB.SPORTS, `programId=eq.${progId}`);
    _ssT = rows;
    sel.innerHTML = '<option value="">-- اختر بطولة --</option>' + rows.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    body.innerHTML = `<div class="empty"><div class="ei">📊</div><p>اختر البطولة من القائمة</p></div>`;
    document.getElementById('ss-view-btn').style.display = 'none';
  } catch(e) {
    body.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

async function renderSportStatsBody() {
  const tournId = parseInt(document.getElementById('ss-tourn-sel')?.value) || 0;
  const body = document.getElementById('sport-stats-body');
  if (!tournId) { body.innerHTML = `<div class="empty"><div class="ei">📊</div><p>اختر البطولة</p></div>`; return; }

  body.innerHTML = `<div class="empty"><div class="ei">⏳</div><p>جاري التحميل…</p></div>`;
  try {
    const [teams, matches] = await Promise.all([
      sbRead(TB.TEAMS,   `tournamentId=eq.${tournId}`),
      sbRead(TB.MATCHES, `tournamentId=eq.${tournId}`)
    ]);
    const tourn = _ssT.find(t => t.id === tournId);
    document.getElementById('ss-view-btn').style.display = '';

    const isLeague = tourn?.type === 'league';
    const scorers  = buildScorerList(matches);

    // جدول ترتيب الدوري
    let standingHtml = '';
    if (isLeague) {
      const standings = teams.map(t => ({
        id:t.id, name:t.name, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0
      }));
      matches.filter(m => m.status==='played').forEach(m => {
        const t1 = standings.find(s => s.id === parseInt(m.team1Id));
        const t2 = standings.find(s => s.id === parseInt(m.team2Id));
        if (!t1||!t2) return;
        t1.p++; t2.p++;
        t1.gf += parseInt(m.team1Score)||0; t1.ga += parseInt(m.team2Score)||0;
        t2.gf += parseInt(m.team2Score)||0; t2.ga += parseInt(m.team1Score)||0;
        if (m.team1Score > m.team2Score)  { t1.w++; t1.pts+=3; t2.l++; }
        else if (m.team1Score < m.team2Score) { t2.w++; t2.pts+=3; t1.l++; }
        else { t1.d++; t2.d++; t1.pts++; t2.pts++; }
      });
      standings.sort((a,b) => b.pts-a.pts || (b.gf-b.ga)-(a.gf-a.ga));
      standingHtml = `
        <div class="sport-stat-card" style="grid-column:1/-1">
          <div class="sport-stat-title">📋 جدول الترتيب</div>
          <div class="table-card" style="margin:0"><div class="tbl-wrap"><table>
            <thead><tr><th>#</th><th>الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>أهداف</th><th>نقاط</th></tr></thead>
            <tbody>${standings.map((t,i) => `<tr class="${i<3?'league-rank-'+(i+1):''}">
              <td style="font-weight:700;color:var(--muted)">${i+1}</td>
              <td style="font-weight:700">${esc(t.name)}</td>
              <td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
              <td>${t.gf}:${t.ga}</td>
              <td><span class="pts-badge">${t.pts}</span></td>
            </tr>`).join('')}</tbody>
          </table></div></div>
        </div>`;
    } else {
      // شجرة خروج مغلوب
      const rounds = [...new Set(matches.map(m => m.round||'الدور الأول'))];
      standingHtml = `
        <div class="sport-stat-card" style="grid-column:1/-1">
          <div class="sport-stat-title">🏆 شجرة البطولة</div>
          <div class="bracket-wrap"><div class="bracket">
            ${rounds.map(r => `
              <div class="bracket-round">
                <div class="bracket-round-title">${esc(r)}</div>
                ${matches.filter(m=>(m.round||'الدور الأول')===r).map(m => {
                  const t1w = m.status==='played' && parseInt(m.team1Score)>parseInt(m.team2Score);
                  const t2w = m.status==='played' && parseInt(m.team2Score)>parseInt(m.team1Score);
                  return `<div class="bracket-match">
                    <div class="bracket-team ${t1w?'winner':''}"><span>${esc(m.team1Name||'—')}</span><span class="bracket-score">${m.status==='played'?m.team1Score:'—'}</span></div>
                    <div class="bracket-team ${t2w?'winner':''}"><span>${esc(m.team2Name||'—')}</span><span class="bracket-score">${m.status==='played'?m.team2Score:'—'}</span></div>
                  </div>`;
                }).join('')}
              </div>`).join('')}
          </div></div>
        </div>`;
    }

    // قائمة الهدافين
    const scorerHtml = scorers.length ? `
      <div class="sport-stat-card">
        <div class="sport-stat-title">👟 قائمة الهدافين</div>
        <div class="scorer-list">
          ${scorers.map((s,i) => `
            <div class="scorer-row">
              <span class="scorer-rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
              <div style="flex:1"><span class="scorer-name">${esc(s.name)}</span><br><span class="scorer-team">${esc(s.team)}</span></div>
              <div><span class="scorer-goals">${s.goals}</span><span class="scorer-lbl">هدف</span></div>
            </div>`).join('')}
        </div>
      </div>` : '';

    // آخر النتائج
    const playedMatches = matches.filter(m => m.status==='played').reverse().slice(0, 8);
    const resultsHtml = `
      <div class="sport-stat-card">
        <div class="sport-stat-title">📋 آخر النتائج</div>
        ${playedMatches.length ? playedMatches.map(m => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:.84rem">
            <span style="flex:1;font-weight:600">${esc(m.team1Name||'')}</span>
            <span style="font-weight:bold;font-size:1rem;padding:0 12px;color:var(--primary)">${m.team1Score} — ${m.team2Score}</span>
            <span style="flex:1;font-weight:600;text-align:left">${esc(m.team2Name||'')}</span>
          </div>`).join('')
        : `<p style="color:var(--muted);font-size:.83rem;text-align:center;padding:16px">لا توجد نتائج بعد</p>`}
      </div>`;

    body.innerHTML = `<div class="sport-stat-grid">${standingHtml}${scorerHtml}${resultsHtml}</div>`;
  } catch(e) {
    body.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

function buildScorerList(matches) {
  const map = {};
  matches.filter(m => m.status === 'played').forEach(m => {
    let evts = [];
    try { evts = JSON.parse(m.scorers || '[]'); } catch {}
    evts.filter(e => e.type === 'goal').forEach(e => {
      const key = e.name + '__' + (e.teamName || '');
      if (!map[key]) map[key] = { name: e.name, team: e.teamName || '', goals: 0 };
      map[key].goals++;
    });
  });
  return Object.values(map).sort((a,b) => b.goals - a.goals);
}

function openSportStatsFor(tournId) {
  // تبديل لصفحة الإحصائيات مع تحديد البطولة تلقائياً
  const progId = _sportsSProg?.id;
  switchSection('sport-stats');
  if (progId) {
    setTimeout(async () => {
      const sel = document.getElementById('ss-prog-sel');
      if (sel) { sel.value = progId; await loadSportStats(); }
      const tsel = document.getElementById('ss-tourn-sel');
      if (tsel) { tsel.value = tournId; renderSportStatsBody(); }
    }, 100);
  }
}

function openTournamentView() {
  const tournId = document.getElementById('ss-tourn-sel')?.value;
  if (tournId) window.open(`tournament-view.html?id=${tournId}`, '_blank');
}

/* ══════════════════════════════════════════
   LEADERBOARD SECTION
══════════════════════════════════════════ */
async function loadLeaderboard() {
  const progId = parseInt(document.getElementById('lb-prog-sel').value) || 0;
  const body      = document.getElementById('lb-body');
  const extBtn    = document.getElementById('lb-ext-btn');
  const filterBar = document.getElementById('lb-section-filter');
  if (!progId) {
    body.innerHTML = `<div class="empty"><div class="ei">📊</div><p>اختر البرنامج</p></div>`;
    extBtn.style.display = 'none';
    if (filterBar) filterBar.style.display = 'none';
    return;
  }
  extBtn.style.display = '';
  extBtn.onclick = () => window.open(`leaderboard.html?prog=${progId}`, '_blank');
  if (filterBar) filterBar.style.display = 'flex';

  body.innerHTML = `<div class="empty"><div class="ei">⏳</div><p>جاري التحميل…</p></div>`;
  try {
    const [subs, pts] = await Promise.all([
      sbRead(TB.SUBSCRIPTIONS, `programId=eq.${progId}`),
      sbRead(TB.POINTS, `programId=eq.${progId}`)
    ]);
    _lbSubs = subs;
    _lbPts  = pts;
    applyLeaderboardFilter();
  } catch(e) {
    body.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

function applyLeaderboardFilter() {
  const sel = [];
  if (document.getElementById('lb-filter-general')?.checked)  sel.push('general', 'manual');
  if (document.getElementById('lb-filter-cultural')?.checked) sel.push('cultural');
  if (document.getElementById('lb-filter-sports')?.checked)   sel.push('sports');
  // إذا لم يُحدد شيء → اعرض الكل
  const filtered = sel.length ? _lbPts.filter(p => sel.includes(p.source || 'manual')) : _lbPts;
  document.getElementById('lb-body').innerHTML = renderLeaderboardHTML(_lbSubs, filtered);
}

function renderLeaderboardHTML(subs, pts) {
  const ptMap = {};
  pts.forEach(p => { ptMap[parseInt(p.studentId)] = (ptMap[parseInt(p.studentId)]||0) + (parseInt(p.amount)||0); });

  const ranked = subs
    .map(s => ({ id: parseInt(s.studentId), name: s.studentName || '', group: s.groupName || '', pts: ptMap[parseInt(s.studentId)] || 0 }))
    .filter((v,i,a) => a.findIndex(x=>x.id===v.id)===i)
    .sort((a,b) => b.pts - a.pts);

  if (!ranked.length) return `<div class="empty"><div class="ei">📊</div><p>لا يوجد مشتركون في هذا البرنامج</p></div>`;

  const top3  = ranked.slice(0, 3);
  const tier2 = ranked.slice(3, 13);   // المراتب 4-13 قائمة ثابتة
  const tier3 = ranked.slice(13);      // المراتب 14+ تمرير تلقائي

  // المنصة — الترتيب: 2، 1، 3
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumHtml = `
    <div class="lb-podium">
      ${podiumOrder.map(p => {
        const medal = p === top3[0] ? '\uD83E\uDD47' : p === top3[1] ? '\uD83E\uDD48' : '\uD83E\uDD49';
        const cls   = p === top3[0] ? 'lb-pod-1' : p === top3[1] ? 'lb-pod-2' : 'lb-pod-3';
        return `<div class="lb-pod-item ${cls}">
          <div class="lb-bar"></div>
          <div class="lb-pod-card">
            <div class="lb-pod-rank">${medal}</div>
            <div class="lb-pod-name" title="${esc(p.name)}">${esc(p.name)}</div>
            <div class="lb-pod-pts">${p.pts} \u0646\u0642\u0637\u0629</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // المراتب 4-13: قائمة ثابتة
  const tier2Html = tier2.length ? `
    <div class="table-card lb-tier2">
      ${tier2.map((p, i) => `
        <div class="lb-list-item">
          <span class="lb-num">${i+4}</span>
          <span class="lb-name">${esc(p.name)}</span>
          <span class="lb-grp">${esc(p.group)}</span>
          <span class="lb-pts">${p.pts}</span>
        </div>`).join('')}
    </div>` : '';

  // المراتب 14+: تمرير تلقائي لانهائي
  const scrollDur = Math.max(10, tier3.length * 1.5);
  const tier3ItemsHtml = tier3.map((p, i) => `
    <div class="lb-list-item">
      <span class="lb-num">${i+14}</span>
      <span class="lb-name">${esc(p.name)}</span>
      <span class="lb-grp">${esc(p.group)}</span>
      <span class="lb-pts">${p.pts}</span>
    </div>`).join('');
  const tier3Html = tier3.length ? `
    <div class="table-card lb-tier3">
      <div class="lb-scroll-label">\u0627\u0644\u0645\u0631\u0627\u062A\u0628 14+</div>
      <div class="lb-scroll-wrap">
        <div class="lb-scroll-inner" style="animation-duration:${scrollDur}s">
          ${tier3ItemsHtml}${tier3ItemsHtml}
        </div>
      </div>
    </div>` : '';

  return podiumHtml + tier2Html + tier3Html;
}

function openLeaderboardExternal() {
  const progId = document.getElementById('lb-prog-sel').value;
  if (progId) window.open(`leaderboard.html?prog=${progId}`, '_blank');
}

/* ══════════════════════════════════════════
   ADMIN SECTION
══════════════════════════════════════════ */
async function admTab(tab) {
  ['users','reasons','log','settings'].forEach(t => {
    const panel = document.getElementById(`adm-${t}`);
    const btn   = document.getElementById(`adm-tab-${t}`);
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn)   btn.className = `btn ${t === tab ? 'btn-primary' : 'btn-outline'}`;
  });
  if (tab === 'users')    { await loadUsers(); renderAdmUsers(); }
  if (tab === 'reasons')  renderAdmReasons();
  if (tab === 'log')      loadAdmLog();
  if (tab === 'settings') loadAdmSettings();
}

function loadAdmSettings() {
  const el = document.getElementById('adm-step-val');
  if (el) el.value = _pointsStep;
  const st = document.getElementById('adm-settings-status');
  if (st) st.textContent = '';
}

async function savePointsSettings() {
  const val = Math.max(1, parseInt(document.getElementById('adm-step-val').value) || 1);
  try {
    await sbUpsert(TB.SETTINGS, { key: 'points_step', value: String(val) });
    _pointsStep = val;
    document.getElementById('adm-settings-status').textContent = '\u2705 \u062A\u0645 \u0627\u0644\u062D\u0641\u0638';
    const hint = document.getElementById('addpts-step-hint');
    if (hint) hint.textContent = _pointsStep > 1 ? `\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0636\u0627\u0639\u0641\u0627\u064B \u0644\u0640 ${_pointsStep}` : '';
    toast('\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u2705');
  } catch(e) { toast('\u062E\u0637\u0623: ' + e.message, 'error'); }
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
// ملاحظة: fmtDate/fmtDatetime/fmtDateShort الميلادية حُذفت — استُبدلت
// كلياً بـ fmtHijri/fmtHijriDatetime/fmtHijriShort في المرحلة ٢ (ADR-005).

/* ══════════════════════════════════════════
   تحويل التواريخ هجري ↔ ميلادي  (ADR-005)
   - DB ميلادي YYYY-MM-DD، الواجهة هجري YYYY/MM/DD.
   - دوال متطابقة مع dashboard.js — تحديثات لازم تتم بالتوازي.
══════════════════════════════════════════ */

/** ميلادي "YYYY-MM-DD" → هجري "YYYY/MM/DD" */
function toHijri(greg) {
  if (!greg) return '';
  try {
    const s = String(greg).slice(0, 10);
    const dt = new Date(s + 'T12:00:00Z');
    if (isNaN(dt)) return '';
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC'
    });
    const parts = fmt.formatToParts(dt);
    const y = parts.find(p => p.type === 'year')?.value || '';
    const m = parts.find(p => p.type === 'month')?.value || '';
    const d = parts.find(p => p.type === 'day')?.value || '';
    return y && m && d ? `${y}/${m}/${d}` : '';
  } catch { return ''; }
}

/** هجري "YYYY/MM/DD" → ميلادي "YYYY-MM-DD" — بحث على Intl */
function toGregorian(hijri) {
  const parsed = parseHijriInput(hijri);
  if (!parsed) return '';
  const target = `${String(parsed.y).padStart(4,'0')}/${String(parsed.m).padStart(2,'0')}/${String(parsed.d).padStart(2,'0')}`;
  const epoch = Date.UTC(622, 6, 16);
  const estDays = (parsed.y - 1) * 354.367 + (parsed.m - 1) * 29.53 + (parsed.d - 1);
  let dt = new Date(epoch + estDays * 86400000);
  for (let i = 0; i < 30; i++) {
    const iso = dt.toISOString().slice(0, 10);
    const back = toHijri(iso);
    if (back === target) return iso;
    const bm = parseHijriInput(back);
    if (!bm) return iso;
    // ترتيب أحادي صحيح يحفظ تسلسل الأيام عبر حدود السنة
    const diff = ((parsed.y * 12 + parsed.m) * 32 + parsed.d) - ((bm.y * 12 + bm.m) * 32 + bm.d);
    if (diff === 0) return iso;
    const jump = i < 3 ? Math.max(1, Math.floor(Math.abs(diff) / 31)) : 1;
    dt = new Date(dt.getTime() + Math.sign(diff) * jump * 86400000);
  }
  return dt.toISOString().slice(0, 10);
}

/** عرض هجري طويل: "12 شوال 1447 هـ" */
function fmtHijri(greg) {
  if (!greg) return '';
  try {
    const s = String(greg).slice(0, 10);
    const dt = new Date(s + 'T12:00:00Z');
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'long', day: 'numeric',
      calendar: 'islamic-umalqura', timeZone: 'UTC'
    });
  } catch { return ''; }
}

/** عرض هجري مختصر: "12 شوال" — بدون سنة */
function fmtHijriShort(greg) {
  if (!greg) return '';
  try {
    const s = String(greg).slice(0, 10);
    const dt = new Date(s + 'T12:00:00Z');
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString('ar-SA', {
      day: 'numeric', month: 'long',
      calendar: 'islamic-umalqura', timeZone: 'UTC'
    });
  } catch { return ''; }
}

/** عرض هجري + وقت */
function fmtHijriDatetime(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return '';
    const datePart = dt.toLocaleDateString('ar-SA', {
      day: 'numeric', month: 'long', calendar: 'islamic-umalqura'
    });
    const timePart = dt.toLocaleTimeString('ar-SA', {
      hour: '2-digit', minute: '2-digit'
    });
    return `${datePart} · ${timePart}`;
  } catch { return ''; }
}

/** فحص صحة إدخال هجري */
function parseHijriInput(text) {
  if (!text) return null;
  const m = String(text).trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) return null;
  const y  = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d  = parseInt(m[3], 10);
  if (mo < 1 || mo > 12) return null;
  if (d  < 1 || d  > 30) return null;
  if (y  < 1300 || y > 1600) return null;
  return { y, m: mo, d };
}

function dateInputToHijri(greg) { return toHijri(greg); }

/* ══════════════════════════════════════════
   منتقي تاريخ هجري (popup picker) — ADR-005 phase 3
   نسخة طبق الأصل من dashboard.js — حدّث الاثنين معاً.
══════════════════════════════════════════ */

const HIJRI_MONTH_NAMES = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];
const HIJRI_WEEKDAYS = ['أحد', 'إث', 'ثل', 'أرب', 'خم', 'جم', 'سب'];

let _hpInput = null;
let _hpYear  = null;
let _hpMonth = null;

function readDateInput(idOrEl) {
  const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  return (el && el.dataset && el.dataset.greg) || '';
}

function writeDateInput(idOrEl, gregYYYYMMDD) {
  const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!el) return;
  if (!gregYYYYMMDD) {
    el.value = '';
    el.dataset.greg = '';
    return;
  }
  // قبول ISO timestamp أو YYYY-MM-DD أو Date — تطبيع لـ YYYY-MM-DD
  const dateStr = String(gregYYYYMMDD).slice(0, 10);
  el.dataset.greg = dateStr;
  el.value = toHijri(dateStr);
}

function attachHijriPicker(input) {
  if (!input || input.dataset.hpAttached) return;
  input.dataset.hpAttached = '1';
  input.readOnly = true;
  if (!input.placeholder) input.placeholder = 'اضغط للاختيار…';
  input.style.cursor = 'pointer';
  input.addEventListener('click', () => openHijriPicker(input));
  input.addEventListener('focus', () => openHijriPicker(input));
}

function openHijriPicker(input) {
  ensureHijriPickerDom();
  _hpInput = input;
  const cur = input.dataset.greg ? toHijri(input.dataset.greg) : toHijri(todayDate());
  const parsed = parseHijriInput(cur);
  _hpYear  = parsed ? parsed.y : 1447;
  _hpMonth = parsed ? parsed.m : 1;
  document.getElementById('hijri-picker-overlay').classList.add('open');
  positionHijriPicker(input);
  renderHijriPicker();
}

function closeHijriPicker() {
  const overlay = document.getElementById('hijri-picker-overlay');
  if (overlay) overlay.classList.remove('open');
  _hpInput = null;
}

function positionHijriPicker(input) {
  const picker = document.getElementById('hijri-picker');
  const rect = input.getBoundingClientRect();
  picker.style.left = Math.max(8, rect.left) + 'px';
  picker.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  setTimeout(() => {
    const pRect = picker.getBoundingClientRect();
    if (pRect.bottom > window.innerHeight) {
      picker.style.top = (rect.top + window.scrollY - pRect.height - 4) + 'px';
    }
    if (pRect.right > window.innerWidth) {
      picker.style.left = (window.innerWidth - pRect.width - 8) + 'px';
    }
  }, 0);
}

function renderHijriPicker() {
  const picker = document.getElementById('hijri-picker');
  if (!picker) return;
  const monthDays = getHijriMonthDays(_hpYear, _hpMonth);
  const firstGreg = toGregorian(`${_hpYear}/${String(_hpMonth).padStart(2,'0')}/01`);
  const firstWeekday = new Date(firstGreg + 'T12:00:00Z').getUTCDay();
  const todayH = parseHijriInput(toHijri(todayDate()));
  const selected = _hpInput && _hpInput.dataset.greg ? parseHijriInput(toHijri(_hpInput.dataset.greg)) : null;

  let html = `
    <div class="hp-header">
      <button type="button" class="hp-nav" onclick="hpNav(-1)">›</button>
      <div class="hp-title">${HIJRI_MONTH_NAMES[_hpMonth - 1]} ${_hpYear}</div>
      <button type="button" class="hp-nav" onclick="hpNav(1)">‹</button>
    </div>
    <div class="hp-weekdays">${HIJRI_WEEKDAYS.map(w => `<div>${w}</div>`).join('')}</div>
    <div class="hp-days">`;
  for (let i = 0; i < firstWeekday; i++) html += '<div class="hp-day empty"></div>';
  for (let d = 1; d <= monthDays; d++) {
    const isToday    = todayH    && todayH.y    === _hpYear && todayH.m    === _hpMonth && todayH.d    === d;
    const isSelected = selected  && selected.y === _hpYear && selected.m === _hpMonth && selected.d === d;
    const cls = ['hp-day', isToday && 'today', isSelected && 'selected'].filter(Boolean).join(' ');
    html += `<div class="${cls}" onclick="hpPick(${d})">${d}</div>`;
  }
  html += '</div>';
  html += `<div class="hp-footer">
    <button type="button" class="hp-foot-btn" onclick="hpToday()">اليوم</button>
    <button type="button" class="hp-foot-btn" onclick="hpClear()">مسح</button>
  </div>`;
  picker.innerHTML = html;
}

function hpNav(delta) {
  _hpMonth += delta;
  if (_hpMonth > 12) { _hpMonth = 1;  _hpYear++; }
  if (_hpMonth < 1)  { _hpMonth = 12; _hpYear--; }
  renderHijriPicker();
}

function hpPick(day) {
  if (!_hpInput) return;
  const hijri = `${_hpYear}/${String(_hpMonth).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
  const greg = toGregorian(hijri);
  writeDateInput(_hpInput, greg);
  _hpInput.dispatchEvent(new Event('input',  { bubbles: true }));
  _hpInput.dispatchEvent(new Event('change', { bubbles: true }));
  closeHijriPicker();
}

function hpToday() {
  if (!_hpInput) return;
  writeDateInput(_hpInput, todayDate());
  _hpInput.dispatchEvent(new Event('input',  { bubbles: true }));
  _hpInput.dispatchEvent(new Event('change', { bubbles: true }));
  closeHijriPicker();
}

function hpClear() {
  if (!_hpInput) return;
  writeDateInput(_hpInput, '');
  _hpInput.dispatchEvent(new Event('input',  { bubbles: true }));
  _hpInput.dispatchEvent(new Event('change', { bubbles: true }));
  closeHijriPicker();
}

function getHijriMonthDays(y, m) {
  const cur  = toGregorian(`${y}/${String(m).padStart(2,'0')}/01`);
  let nY = y, nM = m + 1;
  if (nM > 12) { nM = 1; nY++; }
  const next = toGregorian(`${nY}/${String(nM).padStart(2,'0')}/01`);
  return Math.round((new Date(next + 'T12:00:00Z') - new Date(cur + 'T12:00:00Z')) / 86400000);
}

function ensureHijriPickerDom() {
  if (document.getElementById('hijri-picker-overlay')) return;
  const style = document.createElement('style');
  style.id = 'hijri-picker-styles';
  style.textContent = `
    .hijri-picker-overlay { position:fixed; inset:0; background:transparent; z-index:9998; display:none; }
    .hijri-picker-overlay.open { display:block; }
    .hijri-picker { position:absolute; background:#fff; border:1px solid #e0e0e0; border-radius:12px;
      box-shadow:0 8px 24px rgba(0,0,0,0.12); padding:12px; width:280px; font-family:inherit; direction:rtl;
      z-index:9999; }
    .hp-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
    .hp-title { flex:1; text-align:center; font-weight:700; color:var(--primary, #2D3651); }
    .hp-nav { width:30px; height:30px; border:none; border-radius:6px; cursor:pointer;
      background:var(--primary, #2D3651); color:#fff; font-size:1rem; font-family:inherit; }
    .hp-nav:hover { opacity:.85; }
    .hp-weekdays { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:6px; }
    .hp-weekdays > div { text-align:center; font-size:.7rem; color:#888; padding:4px 0; }
    .hp-days { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
    .hp-day { text-align:center; padding:7px 0; cursor:pointer; border-radius:6px; font-size:.85rem;
      border:1px solid transparent; user-select:none; }
    .hp-day:hover { background:#f3f3f3; }
    .hp-day.empty { cursor:default; }
    .hp-day.empty:hover { background:transparent; }
    .hp-day.today { border-color:var(--gold2, #D4AF37); font-weight:700; }
    .hp-day.selected { background:var(--primary, #2D3651); color:#fff; }
    .hp-day.selected.today { border-color:#fff; }
    .hp-footer { display:flex; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid #eee; }
    .hp-foot-btn { flex:1; padding:6px; border:1px solid #ddd; background:#fafafa; border-radius:6px;
      cursor:pointer; font-family:inherit; font-size:.8rem; }
    .hp-foot-btn:hover { background:#f0f0f0; }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'hijri-picker-overlay';
  overlay.className = 'hijri-picker-overlay';
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeHijriPicker();
  });
  const picker = document.createElement('div');
  picker.id = 'hijri-picker';
  picker.className = 'hijri-picker';
  picker.addEventListener('click', e => e.stopPropagation());
  overlay.appendChild(picker);
  document.body.appendChild(overlay);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeHijriPicker();
  });
}

function initHijriInputs() {
  document.querySelectorAll('input.hijri-input').forEach(attachHijriPicker);
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
document.addEventListener('DOMContentLoaded', () => {
  initHijriInputs();
  checkAuth();
});

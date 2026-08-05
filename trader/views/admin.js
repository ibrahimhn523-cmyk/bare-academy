/* trader/views/admin.js — لوحة الإدارة: معايير / مستخدمون / متاجر (Trader Event Evaluation)
   CRUD كامل عبر lib/supabase-client.js. حقل كلمة المرور نوعه text عمداً (ليس
   password) وظاهر بالنص الصريح — مطلوب صراحة في Section K.2/N.4/Anti-M من
   التعليمات المعتمدة (القرار ج، Phase 1)، وليس سهواً. */

import { TABLES, sbSelect, sbInsert, sbUpdate, sbDelete } from '../lib/supabase-client.js';
import { logout } from '../lib/session.js';
import { showToast, openModal, closeModal, confirmAction, escapeHtml } from '../lib/ui.js';
import { num, toArabic } from '../lib/ar.js';

const state = {
  tab: 'criteria',
  criteria: [],
  users: [],
  stores: [],
  evaluations: [],
  loading: true,
  session: null,
};

let rootEl = null;

export async function renderAdmin(container, session) {
  rootEl = container;
  state.session = session;
  state.loading = true;
  paint();
  await loadAll();
  state.loading = false;
  paint();
}

async function loadAll() {
  try {
    const [criteria, users, stores, evaluations] = await Promise.all([
      sbSelect(TABLES.CRITERIA, 'order=sort_order.asc'),
      sbSelect(TABLES.USERS, 'order=full_name.asc'),
      sbSelect(TABLES.STORES, 'order=created_at.asc'),
      sbSelect(TABLES.EVALUATIONS),
    ]);
    state.criteria = criteria || [];
    state.users = users || [];
    state.stores = stores || [];
    state.evaluations = evaluations || [];
  } catch {
    showToast('تعذّر تحميل بيانات اللوحة', 'error');
  }
}

/* ── تجميع الدرجات لكل متجر (J.1) ── */
function aggregateForStore(storeId) {
  const active = state.criteria.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const evs = state.evaluations.filter((e) => e.store_id === storeId);
  const count = evs.length;
  let total = 0;
  active.forEach((c) => {
    const sum = evs.reduce((a, e) => a + (Number(e.scores && e.scores[c.id]) || 0), 0);
    total += count ? sum / count : 0;
  });
  return { count, total };
}

/* ── الهيكل العام + التبويبات ── */

function setTab(tab) {
  state.tab = tab;
  paint();
}

function paint() {
  if (!rootEl) return;
  rootEl.innerHTML = shellHtml();
  wireShell();
  const body = document.getElementById('admin-body');
  if (state.loading) {
    body.innerHTML = `<div class="trader-loading">جارٍ التحميل...</div>`;
    return;
  }
  if (state.tab === 'criteria') paintCriteria();
  else if (state.tab === 'users') paintUsers();
  else paintStores();
}

function shellHtml() {
  const s = state.session;
  return `
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <div style="background:var(--navy);padding:14px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;position:sticky;top:0;z-index:20;box-shadow:0 4px 18px rgba(29,29,27,.18)">
        <div style="width:40px;height:40px;border-radius:11px;background:var(--gold);display:flex;align-items:center;justify-content:center;font:900 18px 'Noto Kufi Arabic',Cairo,sans-serif;color:var(--navy);flex:0 0 auto">ب</div>
        <div style="flex:1;min-width:160px">
          <div class="trader-heading" style="font-size:16px;color:#fff">لوحة الإدارة</div>
          <div style="font:600 12px Cairo,sans-serif;color:var(--beige);opacity:.65">${escapeHtml(s.fullName)}</div>
        </div>
        <a href="/view" style="background:rgba(245,230,211,.12);border:1px solid rgba(212,175,55,.55);color:var(--gold);font:700 13px Cairo,sans-serif;padding:9px 14px;border-radius:11px;min-height:44px;display:inline-flex;align-items:center;white-space:nowrap;text-decoration:none">الليدربورد</a>
        <button type="button" id="admin-logout-btn" style="background:rgba(143,26,29,.16);border:1px solid rgba(143,26,29,.5);color:#F3B4B4;font:700 13px Cairo,sans-serif;padding:9px 14px;border-radius:11px;min-height:44px;white-space:nowrap;cursor:pointer">خروج</button>
      </div>

      <div style="max-width:980px;width:100%;margin:0 auto;padding:18px 18px 60px;flex:1">
        <div style="display:flex;gap:8px;background:#fff;border-radius:14px;padding:6px;box-shadow:0 2px 10px rgba(45,54,81,.08);margin-block-end:20px;flex-wrap:wrap">
          ${tabBtn('criteria', 'المعايير')}
          ${tabBtn('users', 'المستخدمون')}
          ${tabBtn('stores', 'المتاجر')}
        </div>
        <div id="admin-body"></div>
      </div>
    </div>
  `;
}

function tabBtn(key, label) {
  const active = state.tab === key;
  const style = active
    ? 'flex:1;min-width:100px;min-height:44px;border-radius:11px;background:var(--navy);color:#fff;font:700 14px Cairo,sans-serif;cursor:pointer'
    : 'flex:1;min-width:100px;min-height:44px;border-radius:11px;background:transparent;color:var(--navy);font:700 14px Cairo,sans-serif;cursor:pointer';
  return `<button type="button" data-tab="${key}" class="admin-tab-btn" style="${style}">${label}</button>`;
}

function wireShell() {
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => logout());
  document.querySelectorAll('.admin-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.getAttribute('data-tab')));
  });
}

function emptyHtml(text) {
  return `<div class="trader-empty">${escapeHtml(text)}</div>`;
}

function modalCancelWire() {
  const cancelBtn = document.querySelector('#trader-modal-overlay [data-act="cancel"]');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
}

/* ══════════════════════════ تبويب المعايير ══════════════════════════ */

function paintCriteria() {
  const body = document.getElementById('admin-body');
  const rows = state.criteria
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => criterionRowHtml(c))
    .join('');
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:14px">
      <div class="trader-heading" style="font-size:18px">معايير التقييم</div>
      <button type="button" id="admin-add-criterion-btn" class="trader-btn trader-btn--cta">+ إضافة معيار</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${rows || emptyHtml('لا معايير بعد')}
    </div>
  `;
  document.getElementById('admin-add-criterion-btn').addEventListener('click', () => openCriterionModal(null));
  state.criteria.forEach((c) => {
    const editBtn = document.getElementById(`crit-edit-${c.id}`);
    const delBtn = document.getElementById(`crit-del-${c.id}`);
    const toggleBtn = document.getElementById(`crit-toggle-${c.id}`);
    if (editBtn) editBtn.addEventListener('click', () => openCriterionModal(c));
    if (delBtn) delBtn.addEventListener('click', () => deleteCriterion(c));
    if (toggleBtn) toggleBtn.addEventListener('click', () => toggleCriterionActive(c));
  });
}

function criterionRowHtml(c) {
  const activeStyle = c.is_active ? 'background:#E5F5EC;color:var(--success)' : 'background:#EFEFEF;color:var(--gray)';
  return `
    <div class="trader-card" style="display:flex;flex-wrap:wrap;align-items:center;gap:14px">
      <div style="flex:1;min-width:160px;font:700 16px Cairo,sans-serif;color:var(--black)">${escapeHtml(c.name)}</div>
      <div style="font:600 13px Cairo,sans-serif;color:var(--gray)">الحد الأقصى: <span style="color:var(--navy);font-weight:800">${toArabic(c.max_score)}</span></div>
      <div style="font:600 13px Cairo,sans-serif;color:var(--gray)">الترتيب: <span style="color:var(--navy);font-weight:800">${toArabic(c.sort_order)}</span></div>
      <button type="button" id="crit-toggle-${c.id}" class="trader-badge" style="${activeStyle};border:0;cursor:pointer">${c.is_active ? 'مفعّل' : 'معطّل'}</button>
      <div style="display:flex;gap:8px">
        <button type="button" id="crit-edit-${c.id}" class="trader-btn trader-btn--ghost">تعديل</button>
        <button type="button" id="crit-del-${c.id}" class="trader-btn" style="background:#FDE8E8;color:var(--maroon)">حذف</button>
      </div>
    </div>
  `;
}

function openCriterionModal(existing) {
  openModal(`
    <div class="trader-modal-title">${existing ? 'تعديل معيار' : 'إضافة معيار'}</div>
    <label class="trader-field-label">اسم المعيار</label>
    <input id="crit-form-name" class="trader-input" style="margin-block-end:12px" value="${escapeHtml(existing ? existing.name : '')}">
    <label class="trader-field-label">الحد الأقصى (١-١٠)</label>
    <input id="crit-form-max" type="number" min="1" max="10" class="trader-input" style="margin-block-end:12px" value="${existing ? existing.max_score : 5}">
    <label class="trader-field-label">الترتيب</label>
    <input id="crit-form-sort" type="number" min="1" class="trader-input" style="margin-block-end:18px" value="${existing ? existing.sort_order : state.criteria.length + 1}">
    <div class="trader-modal-actions">
      <button type="button" data-act="cancel" class="trader-btn trader-btn--ghost">إلغاء</button>
      <button type="button" id="crit-save-btn" class="trader-btn trader-btn--primary">حفظ</button>
    </div>
  `);
  modalCancelWire();
  document.getElementById('crit-save-btn').addEventListener('click', () => saveCriterion(existing));
}

async function saveCriterion(existing) {
  const name = document.getElementById('crit-form-name').value.trim();
  if (!name) { showToast('اكتب اسم المعيار', 'error'); return; }
  const max = Math.max(1, Math.min(10, Number(document.getElementById('crit-form-max').value) || 5));
  const sort = Math.max(1, Number(document.getElementById('crit-form-sort').value) || 1);
  try {
    if (existing) {
      await sbUpdate(TABLES.CRITERIA, existing.id, { name, max_score: max, sort_order: sort });
      showToast('تم تحديث المعيار', 'success');
    } else {
      await sbInsert(TABLES.CRITERIA, { name, max_score: max, sort_order: sort, is_active: true });
      showToast('تمت إضافة المعيار', 'success');
    }
    closeModal();
    await loadAll();
    paint();
  } catch {
    showToast('تعذّر الحفظ', 'error');
  }
}

async function toggleCriterionActive(c) {
  try {
    await sbUpdate(TABLES.CRITERIA, c.id, { is_active: !c.is_active });
    await loadAll();
    paint();
  } catch {
    showToast('تعذّر التحديث', 'error');
  }
}

async function deleteCriterion(c) {
  const ok = await confirmAction({ title: 'حذف معيار', body: `هل تريد حذف "${escapeHtml(c.name)}"؟` });
  if (!ok) return;
  try {
    await sbDelete(TABLES.CRITERIA, c.id);
    showToast('تم الحذف', 'success');
    await loadAll();
    paint();
  } catch {
    showToast('تعذّر الحذف', 'error');
  }
}

/* ══════════════════════════ تبويب المستخدمين ══════════════════════════ */

function paintUsers() {
  const body = document.getElementById('admin-body');
  const rows = state.users.map((u) => userRowHtml(u)).join('');
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:6px;flex-wrap:wrap;gap:8px">
      <div class="trader-heading" style="font-size:18px">المستخدمون</div>
      <button type="button" id="admin-add-user-btn" class="trader-btn trader-btn--cta">+ إضافة مقيّم</button>
    </div>
    <div class="trader-badge" style="background:#FFF7E0;color:#8a6d1a;display:inline-flex;margin-block-end:14px">🔓 كلمة المرور ظاهرة عمداً لسهولة الإدارة</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${rows || emptyHtml('لا مستخدمون بعد')}
    </div>
  `;
  document.getElementById('admin-add-user-btn').addEventListener('click', () => openUserModal(null));
  state.users.forEach((u) => {
    const editBtn = document.getElementById(`user-edit-${u.id}`);
    const delBtn = document.getElementById(`user-del-${u.id}`);
    if (editBtn) editBtn.addEventListener('click', () => openUserModal(u));
    if (delBtn) delBtn.addEventListener('click', () => deleteUser(u));
  });
}

function userRowHtml(u) {
  const roleStyle = u.role === 'admin' ? 'background:var(--navy);color:#fff' : 'background:#EFEFEF;color:var(--navy)';
  const roleLabel = u.role === 'admin' ? 'مدير' : 'مقيّم';
  return `
    <div class="trader-card" style="display:flex;flex-wrap:wrap;align-items:center;gap:14px">
      <div style="flex:1;min-width:140px">
        <div style="font:700 16px Cairo,sans-serif;color:var(--black)">${escapeHtml(u.full_name)}</div>
        <div style="font:600 12px Cairo,sans-serif;color:var(--gray)">${escapeHtml(u.username)}</div>
      </div>
      <div style="font:700 14px 'Courier New',monospace;color:var(--navy);background:var(--beige);border-radius:8px;padding:6px 10px">${escapeHtml(u.password)}</div>
      <div class="trader-badge" style="${roleStyle}">${roleLabel}</div>
      <div style="display:flex;gap:8px">
        <button type="button" id="user-edit-${u.id}" class="trader-btn trader-btn--ghost">تعديل</button>
        <button type="button" id="user-del-${u.id}" class="trader-btn" style="background:#FDE8E8;color:var(--maroon)">حذف</button>
      </div>
    </div>
  `;
}

/* توليد كلمة مرور مؤقتة (J.4) — bare + 4 أرقام. تُخزَّن وتُعرض كما هي بأرقام
   غربية عمداً (بلا toArabic) — استثناء متعمَّد من قاعدة "لا أرقام غربية":
   session.js يقارن كلمة المرور نصياً بلا أي تحويل toWestern()، فلو عُرضت
   بأرقام عربية-هندية وكتبها المقيّم حرفياً كما يراها، سيفشل تسجيل الدخول.
   (صُحِّح هذا التعليق بعد ملاحظة من review-2026-08-05-phase-4.html). */
function genPassword() {
  return 'bare' + (1000 + Math.floor(Math.random() * 9000));
}

function openUserModal(existing) {
  openModal(`
    <div class="trader-modal-title">${existing ? 'تعديل مستخدم' : 'إضافة مقيّم'}</div>
    <label class="trader-field-label">اسم المستخدم</label>
    <input id="user-form-username" class="trader-input" style="margin-block-end:12px" value="${escapeHtml(existing ? existing.username : '')}" ${existing ? 'disabled' : ''}>
    <label class="trader-field-label">الاسم الكامل</label>
    <input id="user-form-fullname" class="trader-input" style="margin-block-end:12px" value="${escapeHtml(existing ? existing.full_name : '')}">
    <label class="trader-field-label">كلمة المرور</label>
    <div style="display:flex;gap:8px;margin-block-end:12px">
      <input id="user-form-password" class="trader-input" type="text" value="${escapeHtml(existing ? existing.password : genPassword())}">
      <button type="button" id="user-gen-password-btn" class="trader-btn trader-btn--ghost" style="white-space:nowrap">توليد</button>
    </div>
    <label class="trader-field-label">الدور</label>
    <select id="user-form-role" class="trader-input" style="margin-block-end:18px">
      <option value="evaluator" ${(!existing || existing.role === 'evaluator') ? 'selected' : ''}>مقيّم</option>
      <option value="admin" ${(existing && existing.role === 'admin') ? 'selected' : ''}>مدير</option>
    </select>
    <div class="trader-modal-actions">
      <button type="button" data-act="cancel" class="trader-btn trader-btn--ghost">إلغاء</button>
      <button type="button" id="user-save-btn" class="trader-btn trader-btn--primary">حفظ</button>
    </div>
  `);
  modalCancelWire();
  document.getElementById('user-gen-password-btn').addEventListener('click', () => {
    document.getElementById('user-form-password').value = genPassword();
  });
  document.getElementById('user-save-btn').addEventListener('click', () => saveUser(existing));
}

async function saveUser(existing) {
  const username = document.getElementById('user-form-username').value.trim();
  const fullName = document.getElementById('user-form-fullname').value.trim();
  const password = document.getElementById('user-form-password').value;
  const role = document.getElementById('user-form-role').value;

  if (!username || !fullName || !password) {
    showToast('أكمل كل الحقول', 'error');
    return;
  }
  // منع تكرار اسم المستخدم محلياً قبل الإرسال (فحص إضافي فوق UNIQUE في DB)
  if (!existing && state.users.some((u) => u.username === username)) {
    showToast('اسم المستخدم موجود مسبقاً', 'error');
    return;
  }

  try {
    if (existing) {
      await sbUpdate(TABLES.USERS, existing.id, { full_name: fullName, password, role });
      showToast('تم تحديث المستخدم', 'success');
    } else {
      await sbInsert(TABLES.USERS, { username, full_name: fullName, password, role, is_active: true });
      showToast('تمت إضافة المقيّم', 'success');
    }
    closeModal();
    await loadAll();
    paint();
  } catch {
    // يغطي أيضاً فشل UNIQUE(username) على الخادم لو حدث سباق نادر بعد الفحص المحلي
    showToast('تعذّر الحفظ — تأكد أن اسم المستخدم غير مكرر', 'error');
  }
}

async function deleteUser(u) {
  // حراسة ضد حذف الحساب الحالي أو آخر admin متبقٍ (ملاحظة ⚠️ من
  // review-2026-08-05-phase-4.html) — لا مسار استرجاع من داخل الواجهة لو
  // انحذف آخر admin (لا Supabase Auth ولا تسجيل ذاتي)، فيُمنع من الأساس.
  if (u.username === state.session.username) {
    showToast('لا يمكنك حذف حسابك الحالي', 'error');
    return;
  }
  if (u.role === 'admin' && state.users.filter((x) => x.role === 'admin').length <= 1) {
    showToast('لا يمكن حذف آخر مدير في النظام', 'error');
    return;
  }

  const ok = await confirmAction({ title: 'حذف مستخدم', body: `هل تريد حذف "${escapeHtml(u.full_name)}"؟` });
  if (!ok) return;
  try {
    await sbDelete(TABLES.USERS, u.id);
    showToast('تم الحذف', 'success');
    await loadAll();
    paint();
  } catch {
    // trader_stores.created_by وtrader_evaluations.evaluator_username تشير لهذا
    // المستخدم بلا ON DELETE (فجوة موثّقة في review-2026-08-05-phase-1.html، W1)
    // — الحذف يفشل بقيد مفتاح أجنبي إن كانت له متاجر/تقييمات مرتبطة. رسالة
    // عربية واضحة بدل ترك الخطأ الخام يصل للمستخدم (security-check، Phase 4).
    showToast('لا يمكن حذف هذا المستخدم لوجود متاجر أو تقييمات مرتبطة به', 'error');
  }
}

/* ══════════════════════════ تبويب المتاجر ══════════════════════════ */

function paintStores() {
  const body = document.getElementById('admin-body');
  const rows = state.stores.map((s, i) => storeRowHtml(s, i + 1)).join('');
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:14px">
      <div class="trader-heading" style="font-size:18px">المتاجر</div>
      <button type="button" id="admin-add-store-btn" class="trader-btn trader-btn--cta">+ إضافة متجر</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${rows || emptyHtml('لا متاجر بعد')}
    </div>
  `;
  document.getElementById('admin-add-store-btn').addEventListener('click', () => openStoreModal(null));
  state.stores.forEach((s) => {
    const editBtn = document.getElementById(`store-edit-${s.id}`);
    const delBtn = document.getElementById(`store-del-${s.id}`);
    if (editBtn) editBtn.addEventListener('click', () => openStoreModal(s));
    if (delBtn) delBtn.addEventListener('click', () => deleteStore(s));
  });
}

function storeRowHtml(s, index) {
  const agg = aggregateForStore(s.id);
  const avgLabel = agg.count ? num(agg.total) : '—';
  return `
    <div class="trader-card" style="display:flex;flex-wrap:wrap;align-items:center;gap:14px">
      <div style="font:700 13px Cairo,sans-serif;color:var(--gray);min-width:24px">${toArabic(index)}</div>
      <div style="flex:1;min-width:140px">
        <div style="font:700 16px Cairo,sans-serif;color:var(--black)">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</div>
        ${s.store_type ? `<div style="font:600 12px Cairo,sans-serif;color:var(--gray)">${escapeHtml(s.store_type)}</div>` : ''}
      </div>
      <div class="trader-badge trader-badge--gold">${avgLabel}</div>
      <div style="font:600 13px Cairo,sans-serif;color:var(--gray)">عدد المقيّمين: <span style="color:var(--navy);font-weight:800">${toArabic(agg.count)}</span></div>
      <div style="display:flex;gap:8px">
        <button type="button" id="store-edit-${s.id}" class="trader-btn trader-btn--ghost">تعديل</button>
        <button type="button" id="store-del-${s.id}" class="trader-btn" style="background:#FDE8E8;color:var(--maroon)">حذف</button>
      </div>
    </div>
  `;
}

function openStoreModal(existing) {
  openModal(`
    <div class="trader-modal-title">${existing ? 'تعديل متجر' : 'إضافة متجر'}</div>
    <label class="trader-field-label">الاسم الأول</label>
    <input id="store-form-first" class="trader-input" style="margin-block-end:12px" value="${escapeHtml(existing ? existing.first_name : '')}">
    <label class="trader-field-label">اسم العائلة</label>
    <input id="store-form-last" class="trader-input" style="margin-block-end:12px" value="${escapeHtml(existing ? existing.last_name : '')}">
    <label class="trader-field-label">نوع المتجر (اختياري)</label>
    <input id="store-form-type" class="trader-input" style="margin-block-end:18px" value="${escapeHtml(existing && existing.store_type ? existing.store_type : '')}">
    <div class="trader-modal-actions">
      <button type="button" data-act="cancel" class="trader-btn trader-btn--ghost">إلغاء</button>
      <button type="button" id="store-save-btn" class="trader-btn trader-btn--primary">حفظ</button>
    </div>
  `);
  modalCancelWire();
  document.getElementById('store-save-btn').addEventListener('click', () => saveStore(existing));
}

async function saveStore(existing) {
  const firstName = document.getElementById('store-form-first').value.trim();
  const lastName = document.getElementById('store-form-last').value.trim();
  const storeType = document.getElementById('store-form-type').value.trim();
  if (!firstName || !lastName) {
    showToast('أكمل الاسم الأول واسم العائلة', 'error');
    return;
  }
  try {
    if (existing) {
      await sbUpdate(TABLES.STORES, existing.id, { first_name: firstName, last_name: lastName, store_type: storeType || null });
      showToast('تم تحديث المتجر', 'success');
    } else {
      await sbInsert(TABLES.STORES, {
        first_name: firstName,
        last_name: lastName,
        store_type: storeType || null,
        created_by: state.session.username,
      });
      showToast('تمت إضافة المتجر', 'success');
    }
    closeModal();
    await loadAll();
    paint();
  } catch {
    showToast('تعذّر الحفظ', 'error');
  }
}

async function deleteStore(s) {
  const ok = await confirmAction({
    title: 'حذف متجر',
    body: `هل تريد حذف "${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}"؟ سيُحذف كل تقييماته أيضاً.`,
  });
  if (!ok) return;
  try {
    await sbDelete(TABLES.STORES, s.id); // ON DELETE CASCADE على trader_evaluations
    showToast('تم الحذف', 'success');
    await loadAll();
    paint();
  } catch {
    showToast('تعذّر الحذف', 'error');
  }
}

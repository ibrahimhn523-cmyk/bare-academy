/* trader/views/stores-list.js — قائمة متاجر المقيّم (Trader Event Evaluation, Section K.3) */

import { TABLES, sbSelect, sbInsert } from '../lib/supabase-client.js';
import { logout } from '../lib/session.js';
import { showToast, openModal, closeModal, escapeHtml } from '../lib/ui.js';

let rootEl = null;
let session = null;
let stores = [];
let myEvaluations = [];
let loading = true;

export async function renderStoresList(container, s) {
  rootEl = container;
  session = s;
  loading = true;
  paint();
  await loadAll();
  loading = false;
  paint();
}

async function loadAll() {
  try {
    const [storesRes, evalsRes] = await Promise.all([
      sbSelect(TABLES.STORES, 'order=created_at.asc'),
      // فلترة إلزامية بـ evaluator_username الحالي فقط — لا يرى المقيّم تقييمات
      // غيره (Anti-requirement M) حتى لمجرد معرفة "من قيّم" — فقط حالته هو.
      sbSelect(TABLES.EVALUATIONS, `evaluator_username=eq.${encodeURIComponent(session.username)}`),
    ]);
    stores = storesRes || [];
    myEvaluations = evalsRes || [];
  } catch {
    showToast('تعذّر تحميل المتاجر', 'error');
  }
}

function hasRated(storeId) {
  return myEvaluations.some((e) => e.store_id === storeId);
}

function paint() {
  if (!rootEl) return;
  rootEl.innerHTML = shellHtml();
  wire();
}

function shellHtml() {
  let rows;
  if (loading) {
    rows = `<div class="trader-loading">جارٍ التحميل...</div>`;
  } else if (!stores.length) {
    rows = `<div class="trader-empty">لا متاجر بعد — أضف أول متجر</div>`;
  } else {
    rows = stores.map((s) => storeRowHtml(s)).join('');
  }
  return `
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <div style="background:var(--navy);padding:14px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;position:sticky;top:0;z-index:20;box-shadow:0 4px 18px rgba(29,29,27,.18)">
        <div style="flex:1;min-width:160px">
          <div class="trader-heading" style="font-size:16px;color:#fff">أهلاً ${escapeHtml(session.fullName)}</div>
        </div>
        <button type="button" id="stores-logout-btn" style="background:rgba(143,26,29,.16);border:1px solid rgba(143,26,29,.5);color:#F3B4B4;font:700 13px Cairo,sans-serif;padding:9px 14px;border-radius:11px;min-height:44px;white-space:nowrap;cursor:pointer">خروج</button>
      </div>

      <div style="max-width:640px;width:100%;margin:0 auto;padding:18px 18px 60px;flex:1">
        <div class="trader-heading" style="font-size:18px;margin-block-end:14px">اختر متجراً لتقييمه</div>
        <button type="button" id="stores-add-btn" class="trader-btn trader-btn--cta trader-btn--block" style="margin-block-end:18px;min-height:52px;font-size:16px">+ إضافة متجر</button>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${rows}
        </div>
      </div>
    </div>
  `;
}

function storeRowHtml(s) {
  const rated = hasRated(s.id);
  const badge = rated
    ? `<span class="trader-badge trader-badge--success">✓ قيّمت</span>`
    : `<span class="trader-badge trader-badge--gray">لم يُقيَّم</span>`;
  return `
    <button type="button" class="trader-card store-row-btn" data-store-id="${escapeHtml(s.id)}" style="display:flex;align-items:center;gap:12px;text-align:start;width:100%;border:0;cursor:pointer">
      <div style="flex:1;min-width:0">
        <div style="font:700 16px Cairo,sans-serif;color:var(--black)">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</div>
        ${s.store_type ? `<div style="font:600 12px Cairo,sans-serif;color:var(--gray)">${escapeHtml(s.store_type)}</div>` : ''}
      </div>
      ${badge}
    </button>
  `;
}

function wire() {
  const logoutBtn = document.getElementById('stores-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => logout());

  const addBtn = document.getElementById('stores-add-btn');
  if (addBtn) addBtn.addEventListener('click', openAddStoreModal);

  document.querySelectorAll('.store-row-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-store-id');
      location.href = `/trader/rate/${encodeURIComponent(id)}`;
    });
  });
}

function openAddStoreModal() {
  openModal(`
    <div class="trader-modal-title">إضافة متجر</div>
    <label class="trader-field-label">الاسم الأول</label>
    <input id="add-store-first" class="trader-input" style="margin-block-end:12px">
    <label class="trader-field-label">اسم العائلة</label>
    <input id="add-store-last" class="trader-input" style="margin-block-end:12px">
    <label class="trader-field-label">نوع المتجر (اختياري)</label>
    <input id="add-store-type" class="trader-input" style="margin-block-end:18px">
    <div style="display:flex;flex-direction:column;gap:8px">
      <button type="button" id="add-store-rate-btn" class="trader-btn trader-btn--primary trader-btn--block">إضافة والتقييم</button>
      <button type="button" id="add-store-only-btn" class="trader-btn trader-btn--ghost trader-btn--block">إضافة فقط</button>
      <button type="button" data-act="cancel" class="trader-btn trader-btn--block" style="background:transparent;color:var(--gray)">إلغاء</button>
    </div>
  `);
  const cancelBtn = document.querySelector('#trader-modal-overlay [data-act="cancel"]');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  document.getElementById('add-store-only-btn').addEventListener('click', () => submitAddStore(false));
  document.getElementById('add-store-rate-btn').addEventListener('click', () => submitAddStore(true));
}

async function submitAddStore(thenRate) {
  const firstName = document.getElementById('add-store-first').value.trim();
  const lastName = document.getElementById('add-store-last').value.trim();
  const storeType = document.getElementById('add-store-type').value.trim();
  if (!firstName || !lastName) {
    showToast('أكمل الاسم الأول واسم العائلة', 'error');
    return;
  }
  try {
    const rows = await sbInsert(TABLES.STORES, {
      first_name: firstName,
      last_name: lastName,
      store_type: storeType || null,
      created_by: session.username,
    });
    const created = Array.isArray(rows) ? rows[0] : rows;
    closeModal();
    showToast('تمت إضافة المتجر', 'success');
    if (thenRate && created && created.id) {
      location.href = `/trader/rate/${encodeURIComponent(created.id)}`;
      return;
    }
    await loadAll();
    paint();
  } catch {
    showToast('تعذّر إضافة المتجر', 'error');
  }
}

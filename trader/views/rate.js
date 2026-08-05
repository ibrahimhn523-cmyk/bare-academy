/* trader/views/rate.js — تقييم متجر (Trader Event Evaluation, Section K.4, J.2, J.3) */

import { TABLES, sbSelect, sbUpsert, sbDelete } from '../lib/supabase-client.js';
import { showToast, openModal, closeModal, confirmAction, escapeHtml, vibrate } from '../lib/ui.js';
import { num, toArabic } from '../lib/ar.js';

let rootEl = null;
let session = null;
let store = null;
let criteria = [];
let existingEvaluation = null;
let scores = {};
let initialScores = {};
let saving = false;

// تحقق صارم من صيغة storeId قبل أي استعلام Supabase (security-check، Phase 5)
// — يمنع تمرير قيمة غريبة كفلتر PostgREST، ويعطي رسالة عربية واضحة بدل
// استعلام فاشل صامت أو صفحة بيضاء.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function renderRatePage(container, s, storeId) {
  rootEl = container;
  session = s;

  if (!storeId || !UUID_RE.test(storeId)) {
    renderError('رابط المتجر غير صالح');
    return;
  }

  rootEl.innerHTML = `<div class="trader-loading">جارٍ التحميل...</div>`;
  const ok = await load(storeId);
  if (!ok) {
    renderError('تعذّر تحميل بيانات المتجر');
    return;
  }
  paint();
}

async function load(storeId) {
  try {
    const [storeRows, criteriaRows, evalRows] = await Promise.all([
      sbSelect(TABLES.STORES, `id=eq.${encodeURIComponent(storeId)}`),
      sbSelect(TABLES.CRITERIA, 'is_active=eq.true&order=sort_order.asc'),
      // فلترة إلزامية بـ store_id + evaluator_username الحالي معاً — لا يُجلَب
      // ولا يُعرَض أبداً تقييم مقيّم آخر لنفس المتجر (Anti-requirement M).
      sbSelect(
        TABLES.EVALUATIONS,
        `store_id=eq.${encodeURIComponent(storeId)}&evaluator_username=eq.${encodeURIComponent(session.username)}`
      ),
    ]);
    store = Array.isArray(storeRows) ? storeRows[0] : null;
    if (!store) return false;
    criteria = criteriaRows || [];
    existingEvaluation = (evalRows && evalRows[0]) || null;
    initialScores = existingEvaluation ? { ...existingEvaluation.scores } : {};
    scores = { ...initialScores };
    return true;
  } catch {
    return false;
  }
}

function isDirty() {
  return criteria.some((c) => (scores[c.id] ?? null) !== (initialScores[c.id] ?? null));
}

function isComplete() {
  return criteria.length > 0 && criteria.every((c) => scores[c.id] !== undefined && scores[c.id] !== null);
}

function totalScore() {
  return criteria.reduce((sum, c) => sum + (Number(scores[c.id]) || 0), 0);
}
function maxTotal() {
  return criteria.reduce((sum, c) => sum + Number(c.max_score), 0);
}

function renderError(msg) {
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center">
      <div class="trader-heading" style="font-size:18px">${escapeHtml(msg)}</div>
      <button type="button" id="rate-error-back-btn" class="trader-btn trader-btn--ghost">رجوع</button>
    </div>
  `;
  const btn = document.getElementById('rate-error-back-btn');
  if (btn) btn.addEventListener('click', () => { location.href = '/trader/evaluator'; });
}

function paint() {
  rootEl.innerHTML = shellHtml();
  wire();
}

function shellHtml() {
  const cards = criteria.map((c) => criterionCardHtml(c)).join('');
  const total = totalScore();
  const max = maxTotal();
  return `
    <div style="min-height:100vh;display:flex;flex-direction:column;padding-block-end:${criteria.length ? '96' : '0'}px">
      <div style="background:var(--navy);padding:14px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:20;box-shadow:0 4px 18px rgba(29,29,27,.18)">
        <button type="button" id="rate-back-btn" style="background:transparent;border:0;color:#fff;font:700 20px Cairo,sans-serif;cursor:pointer;min-height:44px;min-width:44px">←</button>
        <div class="trader-heading" style="font-size:16px;color:#fff;flex:1">${escapeHtml(store.first_name)} ${escapeHtml(store.last_name)}</div>
      </div>

      <div style="max-width:640px;width:100%;margin:0 auto;padding:18px;flex:1;display:flex;flex-direction:column;gap:12px">
        ${criteria.length ? cards : `<div class="trader-empty">لا معايير تقييم مفعّلة حالياً</div>`}
      </div>

      ${criteria.length ? `
      <div style="position:fixed;bottom:0;inset-inline:0;background:#fff;border-top:1px solid var(--input-border);padding:14px 18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 -4px 14px rgba(45,54,81,.08);z-index:15">
        <div style="text-align:center;font:800 15px Cairo,sans-serif;color:var(--navy)">المجموع: ${num(total)} / ${num(max)}</div>
        <div style="display:flex;gap:10px;max-width:640px;width:100%;margin:0 auto">
          ${existingEvaluation ? `<button type="button" id="rate-delete-btn" class="trader-btn" style="background:#FDE8E8;color:var(--maroon)">🗑️ حذف</button>` : ''}
          <button type="button" id="rate-save-btn" class="trader-btn trader-btn--primary trader-btn--block" ${isComplete() ? '' : 'disabled'} style="${isComplete() ? '' : 'opacity:.5;cursor:not-allowed'}">💾 حفظ</button>
        </div>
      </div>` : ''}
    </div>
  `;
}

function criterionCardHtml(c) {
  const current = scores[c.id];
  const currentLabel = (current !== undefined && current !== null)
    ? `${toArabic(current)} / ${toArabic(c.max_score)}`
    : `— / ${toArabic(c.max_score)}`;
  const buttons = [];
  for (let v = 0; v <= c.max_score; v++) {
    const selected = current === v;
    const isMax = v === c.max_score;
    let cls = 'trader-score-btn';
    if (selected) cls += isMax ? ' trader-score-btn--selected trader-score-btn--max' : ' trader-score-btn--selected';
    buttons.push(`<button type="button" class="${cls}" data-crit-id="${escapeHtml(c.id)}" data-val="${v}">${toArabic(v)}</button>`);
  }
  return `
    <div class="trader-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:10px">
        <div style="font:700 15px Cairo,sans-serif;color:var(--black)">${escapeHtml(c.name)}</div>
        <div style="font:800 14px Cairo,sans-serif;color:var(--navy)">${currentLabel}</div>
      </div>
      <div class="trader-score-grid">${buttons.join('')}</div>
    </div>
  `;
}

function wire() {
  const backBtn = document.getElementById('rate-back-btn');
  if (backBtn) backBtn.addEventListener('click', onBack);

  document.querySelectorAll('.trader-score-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const critId = btn.getAttribute('data-crit-id');
      const val = Number(btn.getAttribute('data-val'));
      scores = { ...scores, [critId]: val };
      vibrate(10);
      paint();
    });
  });

  const saveBtn = document.getElementById('rate-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', () => saveEvaluation());

  const deleteBtn = document.getElementById('rate-delete-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', onDelete);
}

async function onBack() {
  if (!isDirty()) {
    location.href = '/trader/evaluator';
    return;
  }
  const choice = await threeWayLeaveModal();
  if (choice === 'save') {
    await saveEvaluation();
    return;
  }
  if (choice === 'discard') {
    location.href = '/trader/evaluator';
  }
  // 'stay' → لا شيء، يبقى في الصفحة
}

function threeWayLeaveModal() {
  return new Promise((resolve) => {
    const overlay = openModal(`
      <div class="trader-modal-title">تغييرات غير محفوظة</div>
      <div class="trader-modal-body">لديك درجات لم تُحفظ. ماذا تريد أن تفعل؟</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button type="button" data-choice="save" class="trader-btn trader-btn--primary trader-btn--block">حفظ ورجوع</button>
        <button type="button" data-choice="discard" class="trader-btn trader-btn--block" style="background:#FDE8E8;color:var(--maroon)">إلغاء ورجوع</button>
        <button type="button" data-choice="stay" class="trader-btn trader-btn--ghost trader-btn--block">متابعة التقييم</button>
      </div>
    `);
    const onClick = (e) => {
      const choice = e.target && e.target.getAttribute && e.target.getAttribute('data-choice');
      if (choice) {
        overlay.removeEventListener('click', onClick);
        closeModal();
        resolve(choice);
      } else if (e.target === overlay) {
        overlay.removeEventListener('click', onClick);
        closeModal();
        resolve('stay');
      }
    };
    overlay.addEventListener('click', onClick);
  });
}

/**
 * حفظ التقييم عبر upsert ذرّي (J.3، مُطوَّر): sbUpsert يستخدم
 * on_conflict=store_id,evaluator_username + Prefer: resolution=merge-duplicates
 * بدل نمط SELECT-then-INSERT/UPDATE اليدوي — يمنع race condition لو فتح نفس
 * المقيّم نافذتين لنفس المتجر (الاستعلام الثاني يُحدِّث بدل أن يُنشئ صفاً مكرَّراً
 * أو يفشل بخطأ UNIQUE، لأن الذرّية على مستوى DB نفسها لا على مستوى الكود).
 */
async function saveEvaluation() {
  if (saving) return;
  if (!isComplete()) {
    showToast('أكمل تقييم كل المعايير قبل الحفظ', 'error');
    return;
  }
  saving = true;
  try {
    const rows = await sbUpsert(
      TABLES.EVALUATIONS,
      { store_id: store.id, evaluator_username: session.username, scores },
      'store_id,evaluator_username'
    );
    existingEvaluation = Array.isArray(rows) ? rows[0] : existingEvaluation;
    initialScores = { ...scores };
    showToast('تم حفظ التقييم', 'success');
    location.href = '/trader/evaluator';
  } catch {
    showToast('تعذّر الحفظ', 'error');
  } finally {
    saving = false;
  }
}

async function onDelete() {
  // existingEvaluation مصدره استعلام مفلتر بـ evaluator_username=eq.<current>
  // (انظر load()) — لا يمكن أن يكون تقييم مقيّم آخر أصلاً، فزر الحذف آمن ببنائه.
  if (!existingEvaluation) return;
  const ok = await confirmAction({ title: 'حذف التقييم', body: 'هل تريد حذف تقييمك لهذا المتجر؟' });
  if (!ok) return;
  try {
    await sbDelete(TABLES.EVALUATIONS, existingEvaluation.id);
    showToast('تم حذف التقييم', 'success');
    location.href = '/trader/evaluator';
  } catch {
    showToast('تعذّر الحذف', 'error');
  }
}

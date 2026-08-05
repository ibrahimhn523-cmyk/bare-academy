/* view/board.js — لوحة الصدارة العامة (Trader Event Evaluation, Section K.5)
   لا تسجيل دخول، لا جلسة. يجلب أعمدة التجميع فقط (sbSelectCols) — لا
   evaluator_username ولا id مقيّم يصل لهذا الملف أصلاً (انظر تعليق الأمان
   في trader/lib/supabase-client.js). */

import { TABLES, sbSelectCols } from '../trader/lib/supabase-client.js';
import { escapeHtml } from '../trader/lib/ui.js';
import { num, toArabic } from '../trader/lib/ar.js';

const REFRESH_MS = 10000;

let stores = [];
let criteria = [];
let evaluations = [];
let expandedId = null;
let winnerOpen = false;
let loading = true;

const root = document.getElementById('board-app');

async function loadAll() {
  try {
    const [storesRes, criteriaRes, evalsRes] = await Promise.all([
      sbSelectCols(TABLES.STORES, 'id,first_name,last_name,store_type'),
      sbSelectCols(TABLES.CRITERIA, 'id,name,max_score', 'is_active=eq.true&order=sort_order.asc'),
      sbSelectCols(TABLES.EVALUATIONS, 'store_id,scores'),
    ]);
    stores = storesRes || [];
    criteria = criteriaRes || [];
    evaluations = evalsRes || [];
  } catch {
    // فشل صامت مقصود جزئياً — لوحة عامة للجمهور، لا نعرض تفاصيل تقنية.
    // نُبقي آخر بيانات محمَّلة بنجاح بدل تفريغ الشاشة بالكامل.
  }
}

function aggregateForStore(storeId) {
  const evs = evaluations.filter((e) => e.store_id === storeId);
  const count = evs.length;
  const perCriterion = {};
  let total = 0;
  criteria.forEach((c) => {
    const sum = evs.reduce((a, e) => a + (Number(e.scores && e.scores[c.id]) || 0), 0);
    const avg = count ? sum / count : 0;
    perCriterion[c.id] = avg;
    total += avg;
  });
  return { count, perCriterion, total };
}

function rankedStores() {
  return stores
    .map((s) => ({ store: s, agg: aggregateForStore(s.id) }))
    .sort((a, b) => b.agg.total - a.agg.total);
}

function paint() {
  root.innerHTML = shellHtml();
  wire();
}

function shellHtml() {
  const ranked = rankedStores();
  const hasEvaluations = evaluations.length > 0;

  let listHtml;
  if (loading) {
    listHtml = `<div class="board-empty">جارٍ التحميل...</div>`;
  } else if (!stores.length) {
    listHtml = `<div class="board-empty">لا متاجر مضافة بعد</div>`;
  } else {
    // نعرض كل المتاجر حتى لو مجموعها صفر (لا تقييمات بعد) — قيمة معلوماتية
    // (تأكيد أن المتاجر مسجَّلة)، لكن زر "إعلان الفائز" يبقى مخفياً أدناه
    // حتى وجود تقييم حقيقي واحد على الأقل (ملاحظة ⚠️ من مراجعة Phase 6).
    listHtml = ranked.map((r, i) => rowHtml(r, i)).join('');
  }

  return `
    <div class="board-hero">
      <div class="logo-box">ب</div>
      <h1>فعالية التاجر الصغير</h1>
      <div class="subtitle">أكاديمية بارع</div>
      <div class="board-live"><span class="board-live-dot"></span> مباشر</div>
      <div class="board-login-wrap"><a href="/trader" class="board-login-link">دخول</a></div>
    </div>

    <div class="board-toolbar">
      <button type="button" id="board-refresh-btn" class="board-toolbar-btn">🔄 تحديث يدوي</button>
      ${hasEvaluations ? `<button type="button" id="board-winner-btn" class="board-toolbar-btn board-toolbar-btn--winner">👑 إعلان الفائز</button>` : ''}
    </div>

    <div class="board-list">${listHtml}</div>

    ${winnerOpen && hasEvaluations ? winnerOverlayHtml(ranked[0]) : ''}
  `;
}

function rowHtml(r, index) {
  const rank = index + 1;
  const isTop = rank <= 3;
  const rowClass = isTop ? ` board-row--top${rank}` : '';
  const medalEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  const medalHtml = isTop
    ? `<div class="board-medal board-medal--${rank}">${medalEmoji}</div>`
    : `<div class="board-medal board-medal--rank">${toArabic(rank)}</div>`;
  const expanded = expandedId === r.store.id;
  const detail = expanded
    ? `<div class="board-detail">${criteria.map((c) => `
        <div class="board-detail-row"><span>${escapeHtml(c.name)}</span><span>${num(r.agg.perCriterion[c.id] || 0)} / ${num(c.max_score)}</span></div>
      `).join('')}</div>`
    : '';
  return `
    <button type="button" class="board-row${rowClass}" data-store-id="${escapeHtml(r.store.id)}">
      ${medalHtml}
      <div style="flex:1;min-width:0">
        <div class="board-row-name">${escapeHtml(r.store.first_name)} ${escapeHtml(r.store.last_name)}</div>
        ${r.store.store_type ? `<div class="board-row-type">${escapeHtml(r.store.store_type)}</div>` : ''}
        ${detail}
      </div>
      <div class="board-row-total">${num(r.agg.total)}</div>
    </button>
  `;
}

function winnerOverlayHtml(top) {
  const confettiColors = ['#D4AF37', '#2D3651', '#8F1A1D', '#1A7A4A', '#C0C0C0'];
  const pieces = Array.from({ length: 40 }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = (Math.random() * 1.2).toFixed(2);
    const duration = (2.4 + Math.random() * 1.6).toFixed(2);
    const color = confettiColors[i % confettiColors.length];
    return `<div class="board-confetti-piece" style="inset-inline-start:${left}%;background:${color};animation-delay:${delay}s;animation-duration:${duration}s"></div>`;
  }).join('');
  return `
    <div class="board-winner-overlay" id="board-winner-overlay">
      ${pieces}
      <div class="board-winner-card">
        <div class="board-winner-crown">👑</div>
        <div class="board-winner-title">الفائز بفعالية التاجر الصغير</div>
        <div class="board-winner-name">${escapeHtml(top.store.first_name)} ${escapeHtml(top.store.last_name)}</div>
        <div class="board-winner-score">المجموع: ${num(top.agg.total)}</div>
        <button type="button" id="board-winner-close-btn" class="board-winner-close">إغلاق</button>
      </div>
    </div>
  `;
}

function wire() {
  const refreshBtn = document.getElementById('board-refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', async () => { await loadAll(); paint(); });

  const winnerBtn = document.getElementById('board-winner-btn');
  if (winnerBtn) winnerBtn.addEventListener('click', () => { winnerOpen = true; paint(); });

  document.querySelectorAll('.board-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-store-id');
      expandedId = expandedId === id ? null : id;
      paint();
    });
  });

  const overlay = document.getElementById('board-winner-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.id === 'board-winner-close-btn') {
        winnerOpen = false;
        paint();
      }
    });
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape' && winnerOpen) {
    winnerOpen = false;
    paint();
  }
}
window.addEventListener('keydown', onKeyDown);

async function init() {
  loading = true;
  paint();
  await loadAll();
  loading = false;
  paint();
  setInterval(async () => {
    await loadAll();
    paint();
  }, REFRESH_MS);
}

init();

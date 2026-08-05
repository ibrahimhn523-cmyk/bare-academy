/* trader/app.js — التوجيه (routing) والحماية حسب الدور (Trader Event Evaluation Platform)
   نمط مطابق لـ Section H.2 من التعليمات. لا router خارجي — قراءة location.pathname
   مباشرة عند كل تحميل صفحة (لا history.pushState بعد — كل تنقّل هو reload كامل،
   وهذا متوقَّع طالما vercel.json يعيد كتابة كل مسار إلى /trader/index.html). */

import { getSession, requireRole, logout } from './lib/session.js';
import { escapeHtml } from './lib/ui.js';
import { renderLogin } from './views/login.js';

const root = document.getElementById('trader-app');

/**
 * شاشة مؤقتة (placeholder) للمسارات التي ستُبنى في مراحل قادمة (Phase 4/5).
 * لا تعرض بيانات حقيقية — فقط تأكيد أن الحماية بالدور تعمل والجلسة صحيحة.
 * title يمرّ دائماً عبر escapeHtml() قبل إدراجه — حتى لو كان المصدر الحالي
 * نصاً ثابتاً، أي مصدر مستقبلي (مثل معرّف من الرابط) يبقى محمياً تلقائياً
 * (ملاحظة من مراجعة review-2026-08-05-phase-3.html).
 */
function renderPlaceholder(container, title, session) {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center">
      <div class="trader-heading" style="font-size:20px">${escapeHtml(title)}</div>
      <div style="font:600 14px Cairo,sans-serif;color:var(--gray);line-height:1.6">أهلاً ${escapeHtml(session.fullName)} — هذه الشاشة قيد الإنشاء (مرحلة قادمة)</div>
      <button type="button" id="trader-logout-btn" class="trader-btn trader-btn--ghost">خروج</button>
    </div>
  `;
  const btn = document.getElementById('trader-logout-btn');
  if (btn) btn.addEventListener('click', () => logout());
}

function route() {
  const path = location.pathname;

  // شاشة الدخول / إعادة توجيه تلقائي إن كانت هناك جلسة صالحة أصلاً
  if (path === '/trader' || path === '/trader/' || path.endsWith('/trader/index.html')) {
    const session = getSession();
    if (session) {
      location.href = session.role === 'admin' ? '/trader/admin' : '/trader/evaluator';
      return;
    }
    renderLogin(root);
    return;
  }

  if (path.startsWith('/trader/admin')) {
    const s = requireRole('admin');
    if (!s) return; // requireRole نفّذ إعادة التوجيه بالفعل
    renderPlaceholder(root, 'لوحة الإدارة', s);
    return;
  }

  if (path.startsWith('/trader/evaluator')) {
    const s = requireRole('evaluator');
    if (!s) return;
    renderPlaceholder(root, 'اختر متجراً لتقييمه', s);
    return;
  }

  if (path.startsWith('/trader/rate/')) {
    const s = requireRole('evaluator');
    if (!s) return;
    // ملاحظة أمان (صُحِّحت بعد مراجعة Phase 3 — كانت تدّعي عدم استخدام innerHTML
    // لكن renderPlaceholder يستخدمه فعلاً): storeId يُدرَج فعلياً ضمن HTML أدناه،
    // لذلك يمر عبر escapeHtml() داخل renderPlaceholder نفسها الآن، لا استثناء.
    // في Phase 5، لا يُستخدم storeId أبداً كمسار ملف — فقط كقيمة فلتر PostgREST
    // (id=eq.<value>)، مع التحقق أنه UUID صالح قبل أي طلب فعلي لقاعدة البيانات.
    const storeId = decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
    renderPlaceholder(root, `تقييم متجر (#${storeId ? storeId.slice(0, 8) : '—'})`, s);
    return;
  }

  // أي مسار آخر تحت /trader غير معروف — رجوع لشاشة الدخول
  renderLogin(root);
}

route();

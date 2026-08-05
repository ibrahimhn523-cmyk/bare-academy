/* trader/app.js — التوجيه (routing) والحماية حسب الدور (Trader Event Evaluation Platform)
   نمط مطابق لـ Section H.2 من التعليمات. لا router خارجي — قراءة location.pathname
   مباشرة عند كل تحميل صفحة (لا history.pushState بعد — كل تنقّل هو reload كامل،
   وهذا متوقَّع طالما vercel.json يعيد كتابة كل مسار إلى /trader/index.html). */

import { getSession, requireRole } from './lib/session.js';
import { renderLogin } from './views/login.js';
import { renderAdmin } from './views/admin.js';
import { renderStoresList } from './views/stores-list.js';
import { renderRatePage } from './views/rate.js';

const root = document.getElementById('trader-app');

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
    renderAdmin(root, s); // Phase 4 — لوحة إدارة كاملة (معايير/مستخدمون/متاجر)
    return;
  }

  if (path.startsWith('/trader/evaluator')) {
    const s = requireRole('evaluator');
    if (!s) return;
    renderStoresList(root, s); // Phase 5 — قائمة متاجر المقيّم
    return;
  }

  if (path.startsWith('/trader/rate/')) {
    const s = requireRole('evaluator');
    if (!s) return;
    // storeId يُستخدم فقط كقيمة فلتر PostgREST (id=eq.<value>) — لا كمسار ملف.
    // renderRatePage نفسها تتحقق من صيغة UUID قبل أي استعلام (security-check، Phase 5).
    const storeId = decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
    renderRatePage(root, s, storeId); // Phase 5 — شاشة تقييم متجر
    return;
  }

  // أي مسار آخر تحت /trader غير معروف — رجوع لشاشة الدخول
  renderLogin(root);
}

route();

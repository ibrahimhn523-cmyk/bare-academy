/* trader/lib/session.js — تسجيل الدخول وإدارة الجلسة (Trader Event Evaluation Platform)
   مصادقة يدوية بدون Supabase Auth، بقرار معتمد من إبراهيم في Phase 1 (القرار ج،
   plan-phase-1-foundation.html). كلمة المرور نصية بقصد — لا تُطبع في console ولا
   تُسجَّل في أي مكان بهذا الملف. الجلسة تنتهي تلقائياً بعد 12 ساعة. */

import { TABLES, sbSelect } from './supabase-client.js';

const SESSION_KEY = 'trader_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة

/** تسجيل الدخول: يقارن اسم المستخدم وكلمة المرور مباشرة ضد trader_users */
export async function login(username, password) {
  const uname = String(username || '').trim();
  const pass = String(password || '');
  if (!uname || !pass) {
    return { ok: false, error: 'أدخل اسم المستخدم وكلمة المرور' };
  }

  let rows;
  try {
    // encodeURIComponent يحمي بنية فلتر PostgREST من أي رمز خاص (مثل الفاصلة أو
    // النقطتين) قد يوجد في المُدخل ويكسر تركيب الاستعلام.
    const q =
      `username=eq.${encodeURIComponent(uname)}` +
      `&password=eq.${encodeURIComponent(pass)}` +
      `&is_active=eq.true`;
    rows = await sbSelect(TABLES.USERS, q);
  } catch {
    return { ok: false, error: 'تعذّر الاتصال بالخادم، حاول مرة أخرى' };
  }

  const user = Array.isArray(rows) ? rows[0] : null;
  if (!user) {
    return { ok: false, error: 'بيانات الدخول غير صحيحة' };
  }

  const session = {
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    at: Date.now(),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    return { ok: false, error: 'تعذّر حفظ الجلسة في المتصفح' };
  }
  return { ok: true, session };
}

/** يرجّع الجلسة الحالية إن كانت صالحة، أو null. يمسح الجلسة تلقائياً إن انتهت صلاحيتها. */
export function getSession() {
  let raw;
  try {
    raw = localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let s;
  try {
    s = JSON.parse(raw);
  } catch {
    // بيانات جلسة تالفة — امسحها بدل السماح لها بكسر التطبيق
    logout({ redirect: false });
    return null;
  }

  if (!s || typeof s !== 'object' || typeof s.at !== 'number' || !s.username || !s.role) {
    logout({ redirect: false });
    return null;
  }
  if (Date.now() - s.at > SESSION_TTL_MS) {
    logout({ redirect: false });
    return null;
  }
  return s;
}

/** تسجيل الخروج + إعادة التوجيه لـ /trader افتراضياً (يمكن تعطيل إعادة التوجيه داخلياً) */
export function logout({ redirect = true } = {}) {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* تجاهل — لا يوجد شيء إضافي يمكن فعله لو فشل التخزين المحلي */
  }
  if (redirect) {
    location.href = '/trader';
  }
}

/** يفرض دوراً معيناً على الصفحة الحالية. يعيد التوجيه تلقائياً إن لم تتطابق الجلسة. */
export function requireRole(role) {
  const s = getSession();
  if (!s) {
    location.href = '/trader';
    return null;
  }
  if (role && s.role !== role) {
    location.href = s.role === 'admin' ? '/trader/admin' : '/trader/evaluator';
    return null;
  }
  return s;
}

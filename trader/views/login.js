/* trader/views/login.js — شاشة تسجيل الدخول (Trader Event Evaluation Platform)
   بلا <form> (Section M) — زر عادي + Enter عبر keydown. */

import { login } from '../lib/session.js';
import { showToast } from '../lib/ui.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
      <div class="trader-card" style="width:400px;max-width:100%;padding:36px 28px;box-shadow:0 14px 44px rgba(45,54,81,.16)">
        <div class="trader-heading" style="text-align:center;font-size:20px;font-weight:900;margin-block-end:26px">تقييم فعالية التاجر</div>

        <label class="trader-field-label" for="trader-login-username">اسم المستخدم</label>
        <input id="trader-login-username" class="trader-input" type="text" placeholder="اسم المستخدم" autocomplete="username" style="margin-block-end:14px">

        <label class="trader-field-label" for="trader-login-password">كلمة المرور</label>
        <input id="trader-login-password" class="trader-input" type="password" placeholder="كلمة المرور" autocomplete="current-password">

        <div id="trader-login-error" role="alert" style="display:none;margin-block-start:12px;background:#FEE2E2;color:#B91C1C;border-radius:10px;padding:10px 12px;font:700 13px Cairo,sans-serif;text-align:center;line-height:1.5"></div>

        <button type="button" id="trader-login-btn" class="trader-btn trader-btn--primary trader-btn--block" style="margin-block-start:20px;min-height:52px;font-size:17px">دخول</button>

        <div style="text-align:center;font:600 12px Cairo,sans-serif;color:#b3a894;margin-block-start:18px;line-height:1.5">تواصل مع المدير للحصول على بيانات الدخول</div>
      </div>
    </div>
  `;

  const userEl = document.getElementById('trader-login-username');
  const passEl = document.getElementById('trader-login-password');
  const errEl = document.getElementById('trader-login-error');
  const btnEl = document.getElementById('trader-login-btn');

  function showError(msg) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
  function clearError() {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }

  let submitting = false;
  async function submit() {
    if (submitting) return;
    clearError();
    submitting = true;
    btnEl.disabled = true;
    const res = await login(userEl.value, passEl.value);
    submitting = false;
    btnEl.disabled = false;

    if (!res.ok) {
      showError(res.error);
      // كلمة المرور لا تُفرَّغ تلقائياً عند الخطأ (معيار القبول N.2) —
      // فقط نضع التركيز عليها ونحدّد نصها ليعيد المستخدم كتابتها بسهولة.
      passEl.focus();
      passEl.select();
      return;
    }
    showToast(`أهلاً ${res.session.fullName}`, 'success');
    location.href = res.session.role === 'admin' ? '/trader/admin' : '/trader/evaluator';
  }

  btnEl.addEventListener('click', submit);
  [userEl, passEl].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  });

  userEl.focus();
}

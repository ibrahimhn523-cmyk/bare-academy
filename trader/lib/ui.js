/* trader/lib/ui.js — toast / modal / confirm helpers (Trader Event Evaluation Platform)
   بدون <form>، بدون onclick= inline (Section M) — كل شيء عبر addEventListener. */

let toastTimer = null;

/** يعقّم نصاً قبل إدراجه ضمن HTML (مثل أسماء متاجر/مقيّمين حقيقية في Phase 4/5)
    لمنع XSS — استُخدم عبر escapeHtml() قبل تمرير أي بيانات من المستخدم/DB
    داخل title/body لـ confirmAction أو أي HTML مُمرَّر لـ openModal. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** رسالة toast قصيرة أسفل الشاشة، تختفي تلقائياً بعد 3 ثوانٍ. type: 'success' | 'error' */
export function showToast(text, type = 'success') {
  clearTimeout(toastTimer);
  let el = document.getElementById('trader-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'trader-toast';
    el.setAttribute('dir', 'rtl');
    document.body.appendChild(el);
  }
  el.textContent = text; // textContent وليس innerHTML — لا خطر XSS هنا أصلاً
  el.className = `trader-toast trader-toast--${type} trader-toast--show`;
  toastTimer = setTimeout(() => {
    el.classList.remove('trader-toast--show');
  }, 3000);
}

/** يفتح مودال عام بمحتوى HTML مُمرَّر. مرّر escapeHtml() على أي بيانات مستخدم/DB
    قبل تضمينها هنا. يرجّع عنصر الـ overlay للتحكم بأحداثه من المستدعي. */
export function openModal(innerHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = 'trader-modal-overlay';
  overlay.className = 'trader-modal-overlay';
  overlay.setAttribute('dir', 'rtl');
  const card = document.createElement('div');
  card.className = 'trader-modal-card';
  card.innerHTML = innerHtml;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  return overlay;
}

export function closeModal() {
  const el = document.getElementById('trader-modal-overlay');
  if (el) el.remove();
}

/**
 * مودال تأكيد بسيط (نعم/إلغاء). يرجّع Promise<boolean>.
 * confirmDanger: true يجعل زر التأكيد بلون خطر (maroon) بدل الأساسي.
 * ملاحظة أمان: title/body يُدرجان كـ HTML خام (لدعم تنسيق بسيط داخل رسائل
 * التأكيد الثابتة). عند تمرير بيانات حقيقية من DB (اسم متجر، اسم مقيّم...)
 * في Phase 4/5، مرّرها عبر escapeHtml() أولاً من جهة المستدعي.
 */
export function confirmAction({ title, body, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', confirmDanger = true }) {
  return new Promise((resolve) => {
    const overlay = openModal(`
      <div class="trader-modal-title">${title}</div>
      <div class="trader-modal-body">${body}</div>
      <div class="trader-modal-actions">
        <button type="button" data-act="cancel" class="trader-btn trader-btn--ghost">${cancelLabel}</button>
        <button type="button" data-act="confirm" class="trader-btn ${confirmDanger ? 'trader-btn--danger' : 'trader-btn--primary'}">${confirmLabel}</button>
      </div>
    `);
    const onClick = (e) => {
      const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'confirm') {
        overlay.removeEventListener('click', onClick);
        closeModal();
        resolve(true);
      } else if (act === 'cancel' || e.target === overlay) {
        overlay.removeEventListener('click', onClick);
        closeModal();
        resolve(false);
      }
    };
    overlay.addEventListener('click', onClick);
  });
}

/** اهتزاز خفيف عند الضغط على زر درجة — مُغلَّف بأمان (بعض المتصفحات لا تدعمه) */
export function vibrate(ms = 10) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* تجاهل — ميزة تحسينية غير حرجة */
  }
}

/* trader/lib/ar.js — تحويل الأرقام إلى عربية-هندية (Trader Event Evaluation Platform)
   قاعدة ملزمة (Section M من التعليمات): لا أرقام غربية (0-9) في أي نص يُعرض
   للمستخدم — يُستخدم toArabic/num دائماً عند طباعة أي رقم في الواجهة. */

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** يحوّل أي أرقام غربية داخل نص إلى عربية-هندية. لا يخلط النظامين أبداً في نفس المخرج. */
export function toArabic(value) {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[d]);
}

/** رقم مُنسَّق للعرض: خانتان عشريتان كحد أقصى، بدون ".٠٠" الزائدة، بأرقام عربية. */
export function num(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return toArabic('0');
  return toArabic(n.toFixed(2).replace(/\.00$/, ''));
}

/** يحوّل أرقاماً عربية-هندية مُدخلة من المستخدم إلى أرقام غربية عادية لأغراض الحساب/الحفظ. */
export function toWestern(value) {
  return String(value).replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
}

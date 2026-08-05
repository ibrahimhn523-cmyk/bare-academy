/* trader/lib/supabase-client.js — Supabase REST helpers for Trader Event Evaluation Platform
   يعيد استخدام نفس Supabase project ومفتاح anon المستخدَمين في بقية bare-academy
   (القرار ب، معتمد في Phase 1 — plan-phase-1-foundation.html). نمط fetch مباشر،
   بدون مكتبة supabase-js، مطابق لأسلوب portal.js/dashboard.js الحالي في المشروع. */

export const SB_URL = 'https://oytfhgqhibbcsqbnvwyv.supabase.co/rest/v1';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95dGZoZ3FoaWJiY3NxYm52d3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjgwNDgsImV4cCI6MjA5MDgwNDA0OH0.oX2f-gCIBn8cHvNbgYIrnFc5JeUXtQ_i0AreSqgBWJs';

export const TABLES = {
  USERS: 'trader_users',
  CRITERIA: 'trader_criteria',
  STORES: 'trader_stores',
  EVALUATIONS: 'trader_evaluations',
};

function headers(extra = {}) {
  return {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra,
  };
}

async function handle(res) {
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

/** قراءة صفوف من جدول trader_*. query هي معاملات PostgREST إضافية (مثل 'is_active=eq.true&order=sort_order.asc') */
export async function sbSelect(table, query = '') {
  const url = `${SB_URL}/${table}?select=*${query ? '&' + query : ''}`;
  const res = await fetch(url, { headers: headers() });
  return handle(res);
}

export async function sbInsert(table, row) {
  const res = await fetch(`${SB_URL}/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(row),
  });
  return handle(res);
}

export async function sbUpdate(table, id, patch) {
  const res = await fetch(`${SB_URL}/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(patch),
  });
  return handle(res);
}

/** upsert آمن يعتمد على قيد UNIQUE في الجدول (مثل store_id,evaluator_username في trader_evaluations) */
export async function sbUpsert(table, row, onConflictColumns) {
  const res = await fetch(`${SB_URL}/${table}?on_conflict=${encodeURIComponent(onConflictColumns)}`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(row),
  });
  return handle(res);
}

export async function sbDelete(table, id) {
  const res = await fetch(`${SB_URL}/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(),
  });
  await handle(res);
  return true;
}

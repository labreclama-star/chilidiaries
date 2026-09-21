// Личный банк семян (таблица seed_bank_items) — Этап 5, Группа 4A.
//
// Схема (подтверждена SQL-выводом):
//   seed_bank_items(id uuid default gen_random_uuid(), user_id, name text NOT NULL,
//                   variety_id nullable → varieties ON DELETE SET NULL,
//                   quantity text default '', status text default 'have'
//                   CHECK IN ('have','want'), notes text default '', added_at)
//   RLS: SELECT/INSERT/UPDATE/DELETE — только user_id = auth.uid().
//
// Без мок-fallback: либо реальный Supabase, либо { error }.

import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { seedRowToJs } from './supabase/mappers.js';
import { toError } from './_dbError.js';

const VALID_STATUSES = ['have', 'want'];

/** Мои семена, новые сверху (как в прежнем локальном addSeed: [seed, ...prev]). */
export async function fetchMySeeds(userId) {
  try {
    const { data, error } = await supabase
      .from('seed_bank_items')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });
    if (error) return fail(toError(error));
    return ok((data || []).map(seedRowToJs));
  } catch (e) {
    return fail(e);
  }
}

/** insertSeed({ userId, name, varietyId, quantity, status, notes }) → созданная запись в форме state. */
export async function insertSeed({ userId, name, varietyId, quantity, status, notes }) {
  try {
    const { data, error } = await supabase
      .from('seed_bank_items')
      .insert({
        user_id: userId,
        name,
        variety_id: varietyId || null,
        quantity: quantity || '',
        status: VALID_STATUSES.includes(status) ? status : 'have',
        notes: notes || ''
      })
      .select('*')
      .single();
    if (error) return fail(toError(error));
    return ok(seedRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/** deleteSeed(seedId). RLS не даст удалить чужое; уже удалённая запись — не ошибка. */
export async function deleteSeed(seedId) {
  try {
    const { error } = await supabase.from('seed_bank_items').delete().eq('id', seedId);
    if (error) return fail(toError(error));
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

/**
 * updateSeedStatus(seedId, status) — 'have' ⇄ 'want'.
 * select('id') нужен, чтобы заметить "0 строк обновлено" (RLS скрыл чужую или
 * запись уже удалена): сам по себе такой UPDATE ошибки не даёт.
 */
export async function updateSeedStatus(seedId, status) {
  try {
    if (!VALID_STATUSES.includes(status)) return fail(new Error('Недопустимый статус семян'));
    const { data, error } = await supabase
      .from('seed_bank_items')
      .update({ status })
      .eq('id', seedId)
      .select('id');
    if (error) return fail(toError(error));
    if (!data || data.length === 0) return fail(new Error('Запись не найдена'));
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

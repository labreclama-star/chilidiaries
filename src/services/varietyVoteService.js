// Голоса за сорта (таблица variety_votes) — Этап 5, Группа 4A.
//
// Схема (подтверждена SQL-выводом):
//   variety_votes(variety_id, user_id, overall, capsaicin, aroma, voted_at)
//     PK (variety_id, user_id) — один голос на юзера на сорт, поэтому
//     повторное голосование = upsert (UPDATE существующей строки).
//     FK user_id → profiles(id), variety_id → varieties(id).
//   RLS: SELECT — публичный (агрегат считают и гости, и другие юзеры);
//        INSERT/UPDATE — только user_id = auth.uid(). Триггеров нет.
//
// Агрегаты считает utils/varietyRatings.js (computeVarietyRatings) на клиенте
// по сырым голосам из state — здесь только источник голосов.
//
// Без мок-fallback: либо реальный Supabase, либо { error }.

import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { varietyVoteRowToJs } from './supabase/mappers.js';
import { toError } from './_dbError.js';

const VOTE_COLUMNS = 'variety_id, user_id, overall, capsaicin, aroma, voted_at';

// PostgREST режет ответ по max-rows (по умолчанию 1000). Голоса ВСЕХ юзеров
// по ВСЕМ сортам легко превысят это число — молча обрезанный список дал бы
// неверный агрегат, поэтому листаем страницами. Стабильный порядок нужен,
// чтобы страницы не пересекались и не теряли строки.
const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // предохранитель: 50 000 голосов

/**
 * fetchAllVarietyVotes() — ВСЕ голоса (для начальной загрузки, работает и для
 * гостей: SELECT-политика публичная). Форма элемента — как в state
 * varietyVotes: { varietyId, userId, overall, capsaicin, aroma, ts }.
 *
 * Масштабирование: пока голосов немного, тащить их все на клиент нормально.
 * Когда станет тяжело — заменить на view/RPC с count и sum по сорту и
 * подать в computeVarietyRatings агрегаты вместо сырых голосов.
 */
export async function fetchAllVarietyVotes() {
  try {
    const rows = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('variety_votes')
        .select(VOTE_COLUMNS)
        .order('variety_id', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) return fail(toError(error));
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) return ok(rows.map(varietyVoteRowToJs));
    }
    console.warn(`[varietyVoteService] Достигнут предел ${MAX_PAGES * PAGE_SIZE} голосов — остальные не загружены.`);
    return ok(rows.map(varietyVoteRowToJs));
  } catch (e) {
    return fail(e);
  }
}

/**
 * upsertVarietyVote({ varietyId, userId, overall, capsaicin, aroma }) —
 * INSERT нового голоса или UPDATE прежнего (PK variety_id+user_id).
 * Возвращает сохранённый голос в форме state ({ varietyId, userId, ... ts }).
 *
 * Все три оценки в БД NOT NULL, поэтому требуем их все (иначе — понятная
 * ошибка вместо "null value violates not-null constraint").
 */
export async function upsertVarietyVote({ varietyId, userId, overall, capsaicin, aroma }) {
  try {
    const scores = { overall: Number(overall), capsaicin: Number(capsaicin), aroma: Number(aroma) };
    if (![overall, capsaicin, aroma].every((x) => x !== null && x !== undefined && x !== '') ||
        !Object.values(scores).every(Number.isFinite)) {
      return fail(new Error('Оцени сорт по всем трём шкалам'));
    }
    const { data, error } = await supabase
      .from('variety_votes')
      .upsert(
        {
          variety_id: varietyId,
          user_id: userId,
          ...scores,
          voted_at: new Date().toISOString() // при UPDATE default now() не сработает
        },
        { onConflict: 'variety_id,user_id' }
      )
      .select(VOTE_COLUMNS)
      .single();
    if (error) return fail(toError(error));
    return ok(varietyVoteRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

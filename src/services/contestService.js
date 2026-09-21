import { CONTESTS } from '../data/contests.js';
import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { contestRowToJs } from './supabase/mappers.js';
import { toError, PG_UNIQUE_VIOLATION } from './_dbError.js';

let _store = null;
function store() {
  // participantIds — отдельный от `joinedContestIds` (сессионный флаг текущего
  // юзера) список для ручного управления участниками из админки.
  if (!_store) _store = CONTESTS.map((c) => ({ participantIds: [], ...c }));
  return _store;
}

// Этап 3, Группа C (с правкой): таблица contest_participants
// (contest_id, user_id, joined_at) подтверждена — считаем participants
// через embedded count, как diaries/followers у гровера в Группе A.
export async function fetchInitialContests() {
  try {
    const { data, error } = await supabase
      .from('contests')
      .select('*, participants_count:contest_participants(count)');
    if (error) {
      console.warn('[contestService] Supabase вернул ошибку, использую mock-данные:', error.message);
    } else if (data && data.length > 0) {
      return ok(data.map(contestRowToJs));
    } else {
      console.warn('[contestService] Supabase вернул пустой список конкурсов, использую mock-данные.');
    }
  } catch (e) {
    console.warn('[contestService] Не удалось получить конкурсы из Supabase, использую mock-данные:', e.message);
  }

  try {
    return ok(store().map((c) => ({ ...c })));
  } catch (e) {
    return fail(e);
  }
}

/** getContestById(id) — та же схема fallback'а, что в fetchInitialContests. */
export async function getContestById(id) {
  try {
    const { data, error } = await supabase
      .from('contests')
      .select('*, participants_count:contest_participants(count)')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn(`[contestService] Supabase вернул ошибку при получении конкурса ${id}, использую mock-данные:`, error.message);
    } else if (data) {
      return ok(contestRowToJs(data));
    } else {
      console.warn(`[contestService] Supabase не нашёл конкурс ${id}, пробую mock-данные.`);
    }
  } catch (e) {
    console.warn(`[contestService] Не удалось получить конкурс ${id} из Supabase, использую mock-данные:`, e.message);
  }

  try {
    const found = store().find((c) => c.id === id);
    return found ? ok({ ...found }) : fail(new Error(`Contest ${id} не найден`));
  } catch (e) {
    return fail(e);
  }
}

/**
 * fetchMyContestIds(userId) — id конкурсов, в которых юзер участвует (для
 * state joinedContestIds после логина/Cmd+R). Без fallback'а на мок.
 * contest_participants: SELECT публичный, поэтому фильтр по user_id обязателен.
 */
export async function fetchMyContestIds(userId) {
  try {
    const { data, error } = await supabase
      .from('contest_participants')
      .select('contest_id')
      .eq('user_id', userId);
    if (error) return fail(toError(error));
    return ok((data || []).map((r) => r.contest_id));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertContestParticipant({ contestId, userId }) — Этап 5, Группа 4A: INSERT в
 * contest_participants (PK contest_id+user_id; RLS: user_id = auth.uid() или
 * админ). Без fallback'а на мок.
 * Дубликат (23505) — не ошибка: юзер уже участвует (например, из другой
 * вкладки). Отдаём { duplicate: true }, чтобы AppContext не прибавил лишний
 * +1 к счётчику (та же схема, что у лайков в reactionsService).
 */
export async function insertContestParticipant({ contestId, userId }) {
  try {
    const { error } = await supabase
      .from('contest_participants')
      .insert({ contest_id: contestId, user_id: userId });
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) return ok({ duplicate: true });
      return fail(toError(error));
    }
    return ok({ duplicate: false });
  } catch (e) {
    return fail(e);
  }
}

// Write-функция — по правилам Этапа 3 не трогаем, остаётся на моке.
export async function createContestFromForm({ title, desc, fullDesc, prize, startDate, deadline, status, photo, sponsor, rules, howToJoin }) {
  try {
    const contest = {
      id: 'c_' + Date.now(),
      title: title || 'Новый конкурс',
      desc: desc || '',
      fullDesc: fullDesc || desc || '',
      prize: prize || '',
      progress: 0,
      participants: 0,
      participantIds: [],
      deadline: deadline || '',
      startDate: startDate || '',
      status: status || 'upcoming',
      photo: photo || null,
      sponsor: sponsor || '',
      rules: rules || [],
      howToJoin: howToJoin || ''
    };
    return ok(contest);
  } catch (e) {
    return fail(e);
  }
}

import { INITIAL_GROWERS } from '../data/growers.js';
import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { growerRowToJs } from './supabase/mappers.js';
import { photoUrlForDb } from './_photo.js';
import { toError, PG_UNIQUE_VIOLATION } from './_dbError.js';

// Внутреннее мок-хранилище: защищённая копия сида, а не сам импортированный
// массив (правило "никаких прямых мутаций импортированных массивов").
// Наполняется при первом обращении — если приложение ни разу не вызвало
// сервис гроверов, память не тратится зря.
let _store = null;
function store() {
  if (!_store) _store = INITIAL_GROWERS.map((g) => ({ ...g }));
  return _store;
}

// Этап 3, Группа A: сначала пробуем Supabase (таблица profiles), при
// ошибке или пустом ответе — падаем на мок (store()) с console.warn, по
// той же схеме, что и varietyService.js на Этапе 2.
export async function fetchInitialGrowers() {
  try {
    // diaries/followers — embedded count через PostgREST (см. комментарий
    // в growerRowToJs). Хинт !followed_id обязателен: follows ссылается на
    // profiles двумя FK (follower_id и followed_id), без явного указания
    // колонки PostgREST вернёт ошибку "more than one relationship found".
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        diaries:diaries!grower_id(count),
        followers:follows!followed_id(count)
      `);
    if (error) {
      console.warn('[growerService] Supabase вернул ошибку, использую mock-данные:', error.message);
    } else if (data && data.length > 0) {
      return ok(data.map(growerRowToJs));
    } else {
      console.warn('[growerService] Supabase вернул пустой список гроверов, использую mock-данные.');
    }
  } catch (e) {
    console.warn('[growerService] Не удалось получить гроверов из Supabase, использую mock-данные:', e.message);
  }

  try {
    // Возвращаем копию, чтобы вызывающий код не мог случайно испортить
    // внутреннее хранилище мутацией элементов массива.
    return ok(store().map((g) => ({ ...g })));
  } catch (e) {
    return fail(e);
  }
}

/**
 * getGrowerById(id) — та же схема fallback'а, что в fetchInitialGrowers.
 */
export async function getGrowerById(id) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        diaries:diaries!grower_id(count),
        followers:follows!followed_id(count)
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn(`[growerService] Supabase вернул ошибку при получении гровера ${id}, использую mock-данные:`, error.message);
    } else if (data) {
      return ok(growerRowToJs(data));
    } else {
      console.warn(`[growerService] Supabase не нашёл гровера ${id}, пробую mock-данные.`);
    }
  } catch (e) {
    console.warn(`[growerService] Не удалось получить гровера ${id} из Supabase, использую mock-данные:`, e.message);
  }

  try {
    const found = store().find((g) => g.id === id);
    return found ? ok({ ...found }) : fail(new Error(`Grower ${id} не найден`));
  } catch (e) {
    return fail(e);
  }
}

/**
 * updateGrowerProfile(userId, { name, bio, loc, avatar }) — Этап 5, Группа 4A:
 * UPDATE profiles (реальный Supabase, без fallback'а на мок). Отправляются
 * ТОЛЬКО name / bio / loc / avatar_url — и только те, что есть в patch;
 * role/banned/deleted/id отсюда не уходят никогда (защита от них на стороне
 * БД — триггер из 0010_protect_profile_role.sql). RLS: auth.uid() = id.
 *
 * avatar:
 *  - не передан (undefined) — колонка не трогается;
 *  - пусто (null / '') — явное удаление аватара, avatar_url = null;
 *  - http(s)-ссылка — сохраняется;
 *  - File/base64/blob — грузится в Storage (см. _photo.js), в БД уходит
 *    публичный URL. Если загрузка не удалась (>5 МБ, не изображение, сеть),
 *    в отличие от insert'ов здесь НЕ пишем null: это стёрло бы уже
 *    сохранённый аватар. Колонка просто пропускается, а
 *    data.avatarSkipped === true — AppContext предупреждает тостом.
 *
 * Возвращает { profile: { name, loc, bio, avatar } | null, avatarSkipped }.
 * profile — уже сохранённые значения из БД (без diaries/followers: их у
 * update-ответа нет, и затирать ими счётчики в state нельзя). null — если
 * обновлять было нечего (patch пустой или только пропущенный avatar).
 */
export async function updateGrowerProfile(userId, patch = {}) {
  try {
    if (!userId) return fail(new Error('Войди, чтобы редактировать профиль'));
    const update = {};
    let avatarSkipped = false;

    if (patch.name !== undefined) {
      const name = String(patch.name ?? '').trim();
      if (!name) return fail(new Error('Имя не может быть пустым'));
      update.name = name;
    }
    if (patch.bio !== undefined) update.bio = String(patch.bio ?? '').trim();
    if (patch.loc !== undefined) update.loc = String(patch.loc ?? '').trim();
    if (patch.avatar !== undefined) {
      if (!patch.avatar) {
        update.avatar_url = null;
      } else {
        const url = await photoUrlForDb(patch.avatar, 'growerService');
        if (url) update.avatar_url = url;
        else avatarSkipped = true;
      }
    }

    if (Object.keys(update).length === 0) return ok({ profile: null, avatarSkipped });

    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (error) {
      // На profiles в этом запросе может нарушиться только уникальность имени.
      if (error.code === PG_UNIQUE_VIOLATION) return fail(new Error('Это имя уже занято'));
      return fail(toError(error));
    }
    // UPDATE, который RLS отфильтровал, — не ошибка, а 0 строк.
    if (!data) return fail(new Error('Не удалось обновить профиль: профиль не найден или нет прав'));

    const g = growerRowToJs(data);
    return ok({ profile: { name: g.name, loc: g.loc, bio: g.bio, avatar: g.avatar }, avatarSkipped });
  } catch (e) {
    return fail(e);
  }
}

/**
 * setGrowerOnline(userId, online) — UPDATE profiles SET online. Отдельно от
 * updateGrowerProfile: вызывается тихо (без тоста) и не трогает остальные
 * поля профиля. RLS: auth.uid() = id.
 */
export async function setGrowerOnline(userId, online) {
  try {
    if (!userId) return fail(new Error('Нет пользователя'));
    const { error } = await supabase.from('profiles').update({ online: !!online }).eq('id', userId);
    if (error) return fail(toError(error));
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

/**
 * Creates the grower profile shape for a freshly registered/logged-in user.
 * Mirrors the original ensureUserGrower() from the vanilla prototype.
 *
 * Write-функция — по правилам Этапа 3 не трогаем, остаётся на моке.
 */
export async function createUserGrower(name, avatar) {
  try {
    const grower = {
      id: 'u_' + name,
      name,
      loc: 'Не указано',
      bio: 'Новый гровер сообщества ChiliDiaries.',
      diaries: 0,
      followers: 0,
      avatar: avatar || null,
      online: true,
      role: 'user',
      joinedAt: new Date().toISOString(),
      banned: false,
      deleted: false
    };
    return ok(grower);
  } catch (e) {
    return fail(e);
  }
}

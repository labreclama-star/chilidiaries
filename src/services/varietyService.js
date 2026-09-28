import { VARIETIES } from '../data/varieties.js';
import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { varietyRowToJs } from './supabase/mappers.js';
import { photoUrlForDb } from './_photo.js';
import { toError } from './_dbError.js';

// author — имя добавившего сорт (UI показывает имя, а в БД added_by — uuid).
// FK varieties_added_by_fkey → profiles(id) есть, profiles_select_public = true,
// связь many-to-one, поэтому PostgREST вернёт один объект { name } (см.
// varietyRowToJs). Хинт !added_by — по имени колонки FK.
const VARIETY_SELECT = '*, author:profiles!added_by(name)';

let _store = null;
function store() {
  if (!_store) _store = VARIETIES.map((v) => ({ ...v }));
  return _store;
}

// Этап 2: сначала пробуем Supabase (таблица varieties), при ошибке или
// пустом ответе — падаем на мок (store()) с console.warn, чтобы прототип не
// сломался, если БД недоступна или ещё не заполнена.
export async function fetchInitialVarieties() {
  try {
    const { data, error } = await supabase.from('varieties').select(VARIETY_SELECT);
    if (error) {
      console.warn('[varietyService] Supabase вернул ошибку, использую mock-данные:', error.message);
    } else if (data && data.length > 0) {
      return ok(data.map(varietyRowToJs));
    } else {
      console.warn('[varietyService] Supabase вернул пустой список сортов, использую mock-данные.');
    }
  } catch (e) {
    console.warn('[varietyService] Не удалось получить сорта из Supabase, использую mock-данные:', e.message);
  }

  try {
    return ok(store().map((v) => ({ ...v })));
  } catch (e) {
    return fail(e);
  }
}

/**
 * getVarietyById(id) — новый геттер, см. риски Этапа 1.
 * Этап 2: та же схема fallback'а, что в fetchInitialVarieties.
 */
export async function getVarietyById(id) {
  try {
    const { data, error } = await supabase.from('varieties').select(VARIETY_SELECT).eq('id', id).maybeSingle();
    if (error) {
      console.warn(`[varietyService] Supabase вернул ошибку при получении сорта ${id}, использую mock-данные:`, error.message);
    } else if (data) {
      return ok(varietyRowToJs(data));
    } else {
      console.warn(`[varietyService] Supabase не нашёл сорт ${id}, пробую mock-данные.`);
    }
  } catch (e) {
    console.warn(`[varietyService] Не удалось получить сорт ${id} из Supabase, использую mock-данные:`, e.message);
  }

  try {
    const found = store().find((v) => v.id === id);
    return found ? ok({ ...found }) : fail(new Error(`Variety ${id} не найден`));
  } catch (e) {
    return fail(e);
  }
}

// Общая сборка числовых полей SHU — раньше была продублирована в обоих
// конструкторах ниже почти одинаковым кодом. Выношу только внутри этого
// файла (правило Этапа 3: точечные изменения, а не большой рефакторинг).
function normalizeShu(shuMin, shuMax) {
  const min = parseInt(shuMin, 10) || 1000;
  const max = Math.max(parseInt(shuMax, 10) || min + 1000, min + 1);
  return { min, max };
}

// Срок созревания: форма отдаёт строку "80-100" (см. varietyRowToJs, который
// собирает её обратно из days_min/days_max). Достаём числа устойчиво к
// "80–100", "80 - 100 дней" и т.п.; одно число N → N-N; пусто/мусор → 80-100
// (тот же дефолт, что в createVarietyFromForm).
function normalizeDays(days) {
  const nums = (String(days ?? '').match(/\d+/g) || []).map(Number).filter((n) => n > 0);
  if (nums.length === 0) return { daysMin: 80, daysMax: 100 };
  const a = nums[0];
  const b = nums.length > 1 ? nums[1] : nums[0];
  return { daysMin: Math.min(a, b), daysMax: Math.max(a, b) };
}

/**
 * insertVariety({ ..., addedById }) — Этап 5, Группа 4A: реальный INSERT в
 * varieties (форма "добавить свой сорт"). Без fallback'а на мок.
 * user_added = true, added_by = addedById (== auth.uid(): currentUser.growerId,
 * см. AppContext). rating/capsaicin_rating/aroma_rating не отправляем —
 * стартовые значения дают дефолты БД (computeVarietyRatings трактует
 * пустое как 0). id и остальное — серверные дефолты.
 *
 * photo: base64 в photo_url не отправляется (см. _photo.js). Если вернувшийся
 * сорт имеет photo === null при непустом photo на входе — фото отброшено.
 *
 * Возвращает сорт в той же форме, что read-функции (author подтянут тем же
 * джойном, поэтому addedBy — имя, а не uuid).
 *
 * createVarietyFromForm ниже остаётся как был (мок; для обратной совместимости).
 */
export async function insertVariety({ name, species, shuMin, shuMax, difficulty, days, origin, desc, photo, addedById }) {
  try {
    if (!addedById) return fail(new Error('Войди, чтобы добавить сорт'));
    const { min, max } = normalizeShu(shuMin, shuMax);
    const { daysMin, daysMax } = normalizeDays(days);
    const { data, error } = await supabase
      .from('varieties')
      .insert({
        name: (name || '').trim() || 'Новый сорт',
        species,
        shu_min: min,
        shu_max: max,
        difficulty,
        days_min: daysMin,
        days_max: daysMax,
        origin: origin || 'Не указано',
        description: desc || 'Описание пока не добавлено автором.',
        photo_url: await photoUrlForDb(photo, 'varietyService'),
        user_added: true,
        added_by: addedById
      })
      .select(VARIETY_SELECT)
      .single();
    if (error) return fail(toError(error));
    return ok(varietyRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * Builds a new variety object from the "add your own variety" form.
 */
export async function createVarietyFromForm({ name, species, shuMin, shuMax, difficulty, days, origin, desc, photo, addedBy }) {
  try {
    const { min, max } = normalizeShu(shuMin, shuMax);
    const variety = {
      id: 'vu_' + Date.now(),
      name: name || 'Новый сорт',
      species,
      shuMin: min,
      shuMax: max,
      difficulty,
      days: days || '80-100',
      origin: origin || 'Не указано',
      desc: desc || 'Описание пока не добавлено автором.',
      photo: photo || null,
      rating: null,
      capsaicinRating: null,
      aromaRating: null,
      userAdded: true,
      addedBy
    };
    return ok(variety);
  } catch (e) {
    return fail(e);
  }
}

/**
 * updateVariety(id, patch) — Этап 1.1 текущего захода: реальный UPDATE
 * varieties для админки (AdminVarieties.jsx). Partial-update — трогаем
 * только те поля, что реально пришли в patch.
 *
 * shuMin/shuMax обновляются ТОЛЬКО вместе (как и в форме — оба поля
 * обязательны рядом): normalizeShu ждёт пару значений, поэтому если
 * прислали только одно из двух, второе достраивается тем же дефолтом,
 * что и при создании (см. normalizeShu выше). Если в форме админки эти
 * два поля физически разделены и могут прийти по отдельности — скажи,
 * поправим на "менять только присланное поле, не трогая другое".
 *
 * rating/capsaicinRating/aromaRating — админ может проставить их вручную
 * (в отличие от обычного addVariety, где они всегда стартуют пустыми);
 * '' или null очищают поле (NULL в БД), а не 0.
 *
 * .select(VARIETY_SELECT).maybeSingle() — не .single(): если RLS
 * отфильтровал строку (UPDATE 0 строк), maybeSingle() вернёт null без
 * ошибки, а не бросит "no rows" — это ловим ниже явной проверкой.
 */
export async function updateVariety(id, patch) {
  try {
    const row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.species !== undefined) row.species = patch.species;
    if (patch.shuMin !== undefined || patch.shuMax !== undefined) {
      const { min, max } = normalizeShu(patch.shuMin, patch.shuMax);
      row.shu_min = min;
      row.shu_max = max;
    }
    if (patch.difficulty !== undefined) row.difficulty = patch.difficulty;
    if (patch.days !== undefined) {
      const { daysMin, daysMax } = normalizeDays(patch.days);
      row.days_min = daysMin;
      row.days_max = daysMax;
    }
    if (patch.origin !== undefined) row.origin = patch.origin;
    if (patch.desc !== undefined) row.description = patch.desc;
    if (patch.photo !== undefined) row.photo_url = await photoUrlForDb(patch.photo, 'varietyService');
    const num = (x) => (x === undefined ? undefined : (x === null || x === '' ? null : Number(x)));
    if (patch.rating !== undefined) row.rating = num(patch.rating);
    if (patch.capsaicinRating !== undefined) row.capsaicin_rating = num(patch.capsaicinRating);
    if (patch.aromaRating !== undefined) row.aroma_rating = num(patch.aromaRating);

    const { data, error } = await supabase
      .from('varieties')
      .update(row)
      .eq('id', id)
      .select(VARIETY_SELECT)
      .maybeSingle();
    if (error) return fail(toError(error));
    if (!data) return fail(new Error('Сорт не найден или нет прав'));
    return ok(varietyRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * deleteVariety(id) — Этап 1.1. Простой DELETE, без ручного каскада: в
 * отличие от diaries/questions, здесь порядок другой — AppContext уже
 * ДО вызова этой функции проверяет countDiariesUsingVariety(id) и не
 * даёт удалить используемый сорт (см. adminDeleteVariety). Так что в
 * штатном сценарии сюда долетают только неиспользуемые сорта, и FK на
 * diary_varieties сработать не должен. Реальный конфликт (гонка: кто-то
 * добавил сорт в дневник между проверкой и удалением) вернётся как
 * обычная ошибка БД через toError — админ увидит понятный текст, а не
 * "успех", который на самом деле не сохранился.
 */
export async function deleteVariety(id) {
  try {
    const { error } = await supabase.from('varieties').delete().eq('id', id);
    if (error) return fail(toError(error));
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertVarietyFromAdmin(data) — Этап 1.1: заменяет старый мок
 * createVarietyFromAdminForm. Реальный INSERT — тот же паттерн, что
 * insertVariety (публичная форма "добавить свой сорт"), но:
 *  - user_added = false, added_by = null (это НЕ пользовательская заявка);
 *  - админ может сразу проставить rating/capsaicinRating/aromaRating
 *    (обычная форма всегда стартует с null — компонент их скрывает).
 */
export async function insertVarietyFromAdmin({ name, species, shuMin, shuMax, difficulty, days, origin, desc, photo, rating, capsaicinRating, aromaRating }) {
  try {
    const { min, max } = normalizeShu(shuMin, shuMax);
    const { daysMin, daysMax } = normalizeDays(days);
    const num = (x) => (x !== undefined && x !== null && x !== '' ? Number(x) : null);
    const { data, error } = await supabase
      .from('varieties')
      .insert({
        name: (name || '').trim() || 'Новый сорт',
        species: species || 'Capsicum annuum',
        shu_min: min,
        shu_max: max,
        difficulty: difficulty || 'Средняя',
        days_min: daysMin,
        days_max: daysMax,
        origin: origin || 'Не указано',
        description: desc || 'Описание пока не добавлено.',
        photo_url: await photoUrlForDb(photo, 'varietyService'),
        user_added: false,
        added_by: null,
        rating: num(rating),
        capsaicin_rating: num(capsaicinRating),
        aroma_rating: num(aromaRating)
      })
      .select(VARIETY_SELECT)
      .single();
    if (error) return fail(toError(error));
    return ok(varietyRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

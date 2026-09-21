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
 * Builds a new variety object from the admin "Добавить сорт" form. Unlike
 * createVarietyFromForm (used by the public "add your own variety" flow),
 * this lets the admin set rating/capsaicinRating/aromaRating directly instead
 * of always starting at null, and marks the record as not user-submitted.
 */
export async function createVarietyFromAdminForm({ name, species, shuMin, shuMax, difficulty, days, origin, desc, photo, rating, capsaicinRating, aromaRating }) {
  try {
    const { min, max } = normalizeShu(shuMin, shuMax);
    const num = (x) => (x !== undefined && x !== null && x !== '' ? Number(x) : null);
    const variety = {
      id: 'va_' + Date.now(),
      name: name || 'Новый сорт',
      species: species || 'Capsicum annuum',
      shuMin: min,
      shuMax: max,
      difficulty: difficulty || 'Средняя',
      days: days || '80-100',
      origin: origin || 'Не указано',
      desc: desc || 'Описание пока не добавлено.',
      photo: photo || null,
      rating: num(rating),
      capsaicinRating: num(capsaicinRating),
      aromaRating: num(aromaRating),
      userAdded: false,
      addedBy: 'admin'
    };
    return ok(variety);
  } catch (e) {
    return fail(e);
  }
}

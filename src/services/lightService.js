// Этап 1.7 текущего захода: раньше это был чистый мок (data/lights.js,
// никакого supabase.from('lights')). Теперь полностью переведён на
// Supabase — БЕЗ fallback'а на мок (в отличие от variety/recipe/blog/
// question/diary/grower, где мок остаётся страховкой). Пустой список
// из БД — это ok([]), а не повод подставить сид-данные (тот же принцип,
// что в contestService после его собственного перехода на реальные
// данные): раз таблица реально пуста, значит лампы ещё не добавлены
// через админку, и показывать вместо этого старые моковые записи
// было бы враньём.

import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { lightRowToJs } from './supabase/mappers.js';
import { photoUrlForDb } from './_photo.js';

export async function fetchInitialLights() {
  try {
    const { data, error } = await supabase.from('lights').select('*');
    if (error) return fail(error);
    return ok((data || []).map(lightRowToJs));
  } catch (e) {
    return fail(e);
  }
}

/** getLightById(id) — прямой запрос, без мок-фолбэка (см. комментарий вверху файла). */
export async function getLightById(id) {
  try {
    const { data, error } = await supabase.from('lights').select('*').eq('id', id).maybeSingle();
    if (error) return fail(error);
    if (!data) return fail(new Error(`Light ${id} не найден`));
    return ok(lightRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertLightFromForm(data) — Этап 1.7: заменяет старый мок
 * createLightFromForm. Реальный INSERT в lights (форма админки).
 */
export async function insertLightFromForm({ name, brand, type, tag, price, rating, desc, link, photo, sponsored }) {
  try {
    const { data, error } = await supabase
      .from('lights')
      .insert({
        name: name || 'Новая лампа',
        brand: brand || '',
        type: type || '',
        tag: tag || '',
        price: price || '',
        rating: Number(rating) || 0,
        description: desc || '',
        link: link || '',
        photo_url: await photoUrlForDb(photo, 'lightService'),
        sponsored: !!sponsored
      })
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(lightRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/** updateLight(id, patch) — Этап 1.7: partial UPDATE lights. */
export async function updateLight(id, patch) {
  try {
    const row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.brand !== undefined) row.brand = patch.brand;
    if (patch.type !== undefined) row.type = patch.type;
    if (patch.tag !== undefined) row.tag = patch.tag;
    if (patch.price !== undefined) row.price = patch.price;
    if (patch.rating !== undefined) row.rating = Number(patch.rating) || 0;
    if (patch.desc !== undefined) row.description = patch.desc;
    if (patch.link !== undefined) row.link = patch.link;
    if (patch.photo !== undefined) row.photo_url = await photoUrlForDb(patch.photo, 'lightService');
    if (patch.sponsored !== undefined) row.sponsored = !!patch.sponsored;

    const { data, error } = await supabase
      .from('lights')
      .update(row)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return fail(error);
    if (!data) return fail(new Error('Лампа не найдена или нет прав'));
    return ok(lightRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/** deleteLight(id) — Этап 1.7. Простой DELETE, дочерних таблиц нет. */
export async function deleteLight(id) {
  try {
    const { error } = await supabase.from('lights').delete().eq('id', id);
    if (error) return fail(error);
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

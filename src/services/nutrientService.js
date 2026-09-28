// Этап 1.7 текущего захода: тот же переход с мока на Supabase, что и в
// lightService.js (см. комментарий там про принцип "без fallback'а").

import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { nutrientRowToJs } from './supabase/mappers.js';
import { photoUrlForDb } from './_photo.js';

export async function fetchInitialNutrients() {
  try {
    const { data, error } = await supabase.from('nutrients').select('*');
    if (error) return fail(error);
    return ok((data || []).map(nutrientRowToJs));
  } catch (e) {
    return fail(e);
  }
}

/** getNutrientById(id) — прямой запрос, без мок-фолбэка. */
export async function getNutrientById(id) {
  try {
    const { data, error } = await supabase.from('nutrients').select('*').eq('id', id).maybeSingle();
    if (error) return fail(error);
    if (!data) return fail(new Error(`Nutrient ${id} не найден`));
    return ok(nutrientRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertNutrientFromForm(data) — Этап 1.7: заменяет старый мок
 * createNutrientFromForm. Реальный INSERT в nutrients (форма админки).
 */
export async function insertNutrientFromForm({ name, brand, type, tag, price, rating, desc, link, photo, sponsored }) {
  try {
    const { data, error } = await supabase
      .from('nutrients')
      .insert({
        name: name || 'Новое удобрение',
        brand: brand || '',
        type: type || '',
        tag: tag || '',
        price: price || '',
        rating: Number(rating) || 0,
        description: desc || '',
        link: link || '',
        photo_url: await photoUrlForDb(photo, 'nutrientService'),
        sponsored: !!sponsored
      })
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(nutrientRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/** updateNutrient(id, patch) — Этап 1.7: partial UPDATE nutrients. */
export async function updateNutrient(id, patch) {
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
    if (patch.photo !== undefined) row.photo_url = await photoUrlForDb(patch.photo, 'nutrientService');
    if (patch.sponsored !== undefined) row.sponsored = !!patch.sponsored;

    const { data, error } = await supabase
      .from('nutrients')
      .update(row)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return fail(error);
    if (!data) return fail(new Error('Удобрение не найдено или нет прав'));
    return ok(nutrientRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/** deleteNutrient(id) — Этап 1.7. Простой DELETE, дочерних таблиц нет. */
export async function deleteNutrient(id) {
  try {
    const { error } = await supabase.from('nutrients').delete().eq('id', id);
    if (error) return fail(error);
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

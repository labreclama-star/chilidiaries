import { RECIPES } from '../data/recipes.js';
import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { recipeRowToJs } from './supabase/mappers.js';
import { photoUrlForDb } from './_photo.js';

let _store = null;
function store() {
  if (!_store) _store = RECIPES.map((r) => ({ liked: false, views: r.views ?? Math.round(r.likes * 6.5), photo: null, ...r }));
  return _store;
}

// Этап 3, Группа B: сначала пробуем Supabase (таблица recipes), при ошибке
// или пустом ответе — падаем на мок (store()) с console.warn, по той же
// схеме, что и varietyService.js/growerService.js.
//
// Джойн на profiles здесь НЕ нужен: в форме Recipe (types.js, data/recipes.js)
// нет authorName/growerName — компоненты резолвят автора через growerId сами.
export async function fetchInitialRecipes() {
  try {
    const { data, error } = await supabase.from('recipes').select('*');
    if (error) {
      console.warn('[recipeService] Supabase вернул ошибку, использую mock-данные:', error.message);
    } else if (data && data.length > 0) {
      return ok(data.map(recipeRowToJs));
    } else {
      console.warn('[recipeService] Supabase вернул пустой список рецептов, использую mock-данные.');
    }
  } catch (e) {
    console.warn('[recipeService] Не удалось получить рецепты из Supabase, использую mock-данные:', e.message);
  }

  try {
    return ok(store().map((r) => ({ ...r })));
  } catch (e) {
    return fail(e);
  }
}

/** getRecipeById(id) — та же схема fallback'а, что в fetchInitialRecipes. */
export async function getRecipeById(id) {
  try {
    const { data, error } = await supabase.from('recipes').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.warn(`[recipeService] Supabase вернул ошибку при получении рецепта ${id}, использую mock-данные:`, error.message);
    } else if (data) {
      return ok(recipeRowToJs(data));
    } else {
      console.warn(`[recipeService] Supabase не нашёл рецепт ${id}, пробую mock-данные.`);
    }
  } catch (e) {
    console.warn(`[recipeService] Не удалось получить рецепт ${id} из Supabase, использую mock-данные:`, e.message);
  }

  try {
    const found = store().find((r) => r.id === id);
    return found ? ok({ ...found }) : fail(new Error(`Recipe ${id} не найден`));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertRecipe(formData) — Этап 5: реальный write в Supabase (таблица recipes).
 * В отличие от createRecipeFromForm (мок, остаётся как есть для обратной
 * совместимости/других вызовов) — здесь insert реально идёт в БД, и
 * созданный рецепт переживает перезагрузку страницы.
 *
 * RLS: политика recipes должна разрешать insert для authenticated с
 * условием auth.uid() = grower_id — growerId сюда передаётся как
 * currentUser.growerId (== profiles.id == auth.users.id, см. AppContext.jsx).
 *
 * photo: base64 в photo_url не отправляется (см. _photo.js) — раньше сюда
 * уходил data-URL целиком. Если вернувшийся recipe.photo === null при
 * непустом photo на входе — фото было отброшено.
 *
 * .select('*').single() — сразу получаем вставленную строку со всеми
 * серверными дефолтами (id, likes_count=0, views_count=0, hidden=false,
 * created_at/updated_at), прогоняем через recipeRowToJs, чтобы форма
 * ответа была той же, что и у read-функций (camelCase, liked: false и т.д.).
 */
export async function insertRecipe({ title, category, varietyId, desc, ingredients, steps, growerId, photo }) {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .insert({
        title,
        category,
        variety_id: varietyId || null,
        grower_id: growerId,
        description: desc || '',
        ingredients: ingredients || [],
        steps: steps || [],
        photo_url: await photoUrlForDb(photo, 'recipeService')
      })
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(recipeRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * incrementRecipeViewsRpc(recipeId) — Этап 5, Группа 4B: +1 к recipes.views_count.
 *
 * Идёт через RPC increment_recipe_views (security definer, миграция 0011), а не
 * через .update(): по RLS обновить чужую строку может только владелец/админ,
 * а просмотры засчитываются и гостям. Без fallback'а на мок; вызывающий код
 * (AppContext.incrementRecipeViews) при ошибке только пишет console.warn.
 * Ошибку отдаём через fail(error) — как и остальные write-функции файла.
 */
export async function incrementRecipeViewsRpc(recipeId) {
  try {
    const { error } = await supabase.rpc('increment_recipe_views', { recipe_id: recipeId });
    if (error) return fail(error);
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

// Write-функция — по правилам Этапа 3 не трогаем, остаётся на моке.
export async function createRecipeFromForm({ title, category, varietyId, desc, ingredients, steps, growerId, photo }) {
  try {
    const recipe = {
      id: 'r_' + Date.now(),
      title,
      category,
      growerId,
      varietyId: varietyId || null,
      desc: desc || 'Рецепт от сообщества ChiliDiaries.',
      ingredients,
      steps,
      photo: photo || null,
      likes: 0,
      liked: false,
      views: 0
    };
    return ok(recipe);
  } catch (e) {
    return fail(e);
  }
}

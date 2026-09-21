// Сохранённые рецепты (таблица recipe_saves, миграция 0009) — Этап 5, Группа 4A.
//
//   recipe_saves(user_id, recipe_id, created_at), PK (user_id, recipe_id),
//   FK profiles/recipes ON DELETE CASCADE.
//   RLS: SELECT/INSERT/DELETE — только свои строки (user_id = auth.uid()).
//   Счётчика на recipes нет — количество сохранений видит только сам юзер.
//
// Без мок-fallback: либо реальный Supabase, либо { error }.

import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { toError, PG_UNIQUE_VIOLATION } from './_dbError.js';

/** id рецептов, которые сохранил юзер (для state savedRecipeIds). */
export async function fetchMySavedRecipeIds(userId) {
  try {
    const { data, error } = await supabase
      .from('recipe_saves')
      .select('recipe_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return fail(toError(error));
    return ok((data || []).map((r) => r.recipe_id));
  } catch (e) {
    return fail(e);
  }
}

/** Дубликат (23505) — не ошибка: рецепт уже сохранён (например, в другой вкладке). */
export async function insertRecipeSave({ userId, recipeId }) {
  try {
    const { error } = await supabase.from('recipe_saves').insert({ user_id: userId, recipe_id: recipeId });
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) return ok({ duplicate: true });
      return fail(toError(error));
    }
    return ok({ duplicate: false });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRecipeSave({ userId, recipeId }) {
  try {
    const { error } = await supabase
      .from('recipe_saves')
      .delete()
      .match({ user_id: userId, recipe_id: recipeId });
    if (error) return fail(toError(error));
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

// Reactions service: лайки (diary/recipe/question/blog_post), подписки на
// гроверов (follows) и подписки на обновления дневников (diary_subscriptions).
//
// Every function returns { data, error } (см. services/_result.js).
//
// Write-функции здесь БЕЗ мок-fallback: либо реальный Supabase, либо
// { error } с человекочитаемым message (AppContext показывает его в toast).
//
// Схема (подтверждена SQL-выводом):
//   likes(id, user_id, entity_type, entity_id, created_at)
//     UNIQUE (user_id, entity_type, entity_id); entity_type ∈
//     'diary' | 'recipe' | 'blog_post' | 'question'.
//     Триггеры trg_likes_insert / trg_likes_delete → apply_like_delta()
//     сами двигают likes_count в целевой таблице — вручную НЕ пересчитываем.
//   follows(follower_id, followed_id, created_at)
//     PK (follower_id, followed_id), CHECK (follower_id <> followed_id).
//     Счётчик followers у гровера считается embed'ом при чтении — триггера нет.
//   diary_subscriptions(user_id, diary_id, created_at)
//     PK (user_id, diary_id). SELECT-политика: только свои строки.

import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';

const PG_UNIQUE_VIOLATION = '23505';

export const LIKE_TYPES = Object.freeze({
  DIARY: 'diary',
  RECIPE: 'recipe',
  QUESTION: 'question',
  BLOG_POST: 'blog_post'
});

// Явно вытаскиваем message: PostgrestError в зависимости от версии
// supabase-js может быть обычным объектом, а не Error — тогда fail() из
// _result.js превратил бы его в "[object Object]".
function toError(error) {
  const err = new Error(error?.message || 'Ошибка запроса к базе данных');
  err.code = error?.code;
  return err;
}

// Дубликат (23505) — не ошибка для пользователя: строка уже есть (например,
// лайк поставлен в другой вкладке). Отдаём { duplicate: true }, чтобы
// AppContext не прибавил лишний +1 к счётчику.
async function insertRow(table, row) {
  try {
    const { error } = await supabase.from(table).insert(row);
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) return ok({ duplicate: true });
      return fail(toError(error));
    }
    return ok({ duplicate: false });
  } catch (e) {
    return fail(e);
  }
}

async function deleteRows(table, match) {
  try {
    const { error } = await supabase.from(table).delete().match(match);
    if (error) return fail(toError(error));
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

// ---- likes ----
export function addLike({ userId, entityType, entityId }) {
  return insertRow('likes', { user_id: userId, entity_type: entityType, entity_id: entityId });
}

export function removeLike({ userId, entityType, entityId }) {
  return deleteRows('likes', { user_id: userId, entity_type: entityType, entity_id: entityId });
}

// ---- follows ----
export function addFollow({ followerId, followedId }) {
  return insertRow('follows', { follower_id: followerId, followed_id: followedId });
}

export function removeFollow({ followerId, followedId }) {
  return deleteRows('follows', { follower_id: followerId, followed_id: followedId });
}

// ---- diary subscriptions ----
export function addDiarySubscription({ userId, diaryId }) {
  return insertRow('diary_subscriptions', { user_id: userId, diary_id: diaryId });
}

export function removeDiarySubscription({ userId, diaryId }) {
  return deleteRows('diary_subscriptions', { user_id: userId, diary_id: diaryId });
}

/**
 * Всё, что пользователь уже "нажал" — чтобы после Cmd+R восстановить
 * liked / _followed / subscribedDiaryIds (мапперы read-сервисов всегда
 * отдают liked: false, в БД такого флага нет).
 *
 * Возвращает:
 *   {
 *     likedIds: { diary: string[], recipe: string[], question: string[], blog_post: string[] },
 *     followedIds: string[],          // followed_id из follows
 *     subscribedDiaryIds: string[]    // diary_id из diary_subscriptions
 *   }
 *
 * Лимит PostgREST по умолчанию — 1000 строк на запрос; для лайков одного
 * пользователя на текущем масштабе этого достаточно.
 */
export async function fetchMyReactions(userId) {
  try {
    const [likesRes, followsRes, subsRes] = await Promise.all([
      supabase.from('likes').select('entity_type, entity_id').eq('user_id', userId),
      supabase.from('follows').select('followed_id').eq('follower_id', userId),
      supabase.from('diary_subscriptions').select('diary_id').eq('user_id', userId)
    ]);
    const firstError = [likesRes, followsRes, subsRes].find((r) => r.error)?.error;
    if (firstError) return fail(toError(firstError));

    const likedIds = { diary: [], recipe: [], question: [], blog_post: [] };
    for (const row of likesRes.data || []) {
      if (likedIds[row.entity_type]) likedIds[row.entity_type].push(row.entity_id);
    }
    return ok({
      likedIds,
      followedIds: (followsRes.data || []).map((r) => r.followed_id),
      subscribedDiaryIds: (subsRes.data || []).map((r) => r.diary_id)
    });
  } catch (e) {
    return fail(e);
  }
}

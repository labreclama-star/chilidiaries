-- 0011_view_counters.sql
-- Группа 4B: счётчики просмотров рецептов и статей блога.
--
-- Проблема: views_count может обновить только владелец (RLS
-- recipes_update_owner_or_admin / blog_posts_update_owner_or_admin), а
-- читают рецепты и статьи все, включая гостей. Обычный UPDATE с клиента у
-- чужой записи молча затрагивает 0 строк.
--
-- Решение: две узкие RPC-функции с security definer (по образцу
-- create_diary_with_varieties, миграция 0008).
--
-- Почему security definer здесь безопасен:
--   * функция принимает ровно один параметр — id записи — и выполняет ровно
--     одну операцию: views_count = views_count + 1 у этой записи;
--   * ни одного параметра, который влиял бы на ЧТО меняется (колонка,
--     значение, условие) — нельзя ни записать произвольное число, ни
--     изменить чужие данные, ни выйти за пределы одной колонки;
--   * ничего не возвращает (void) — через функцию нельзя прочитать строку,
--     которую RLS не показал бы;
--   * search_path зафиксирован (public) — нельзя подменить таблицу через
--     одноимённый объект в другой схеме;
--   * id несуществующей записи -> 0 затронутых строк, без ошибки и без утечки.
-- Остаточный риск — накрутка: любой (в т.ч. anon) может вызвать функцию
-- много раз. Это осознанно принято на этом этапе (см. комментарий внизу).

create or replace function public.increment_recipe_views(recipe_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.recipes
  set views_count = coalesce(views_count, 0) + 1
  where id = recipe_id;
$$;

create or replace function public.increment_blog_views(post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.blog_posts
  set views_count = coalesce(views_count, 0) + 1
  where id = post_id;
$$;

-- По умолчанию Postgres выдаёт EXECUTE роли PUBLIC — сначала снимаем, потом
-- выдаём явно только тем ролям, которым нужно (гость и залогиненный).
revoke all on function public.increment_recipe_views(uuid) from public;
revoke all on function public.increment_blog_views(uuid) from public;

grant execute on function public.increment_recipe_views(uuid)
  to anon, authenticated;
grant execute on function public.increment_blog_views(uuid)
  to anon, authenticated;

-- Антинакрутка (НЕ реализовано, на будущее), по возрастанию сложности:
--   1. Клиент: sessionStorage-флаг "просмотрено" на id — один засчитанный
--      просмотр за сессию вкладки. Не защита от злоумышленника, но убирает
--      случайные повторы (F5, возврат назад-вперёд).
--   2. Сервер: таблица view_events (entity_type, entity_id, viewer_key, day)
--      с unique по этим полям; RPC делает insert ... on conflict do nothing
--      и увеличивает счётчик только если строка реально вставилась.
--      viewer_key = auth.uid() для залогиненных, хэш IP/UA для гостей.
--   3. Не считать просмотры автора собственной записи.

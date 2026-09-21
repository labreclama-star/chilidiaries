-- ChiliDiaries — Этап 5, миграция 4: триггеры.
--
-- Три группы, как в задании:
--   1) автосоздание profile при регистрации в auth.users;
--   2) автообновление updated_at на всех таблицах, где есть эта колонка;
--   3) автоинкремент/декремент денормализованных счётчиков лайков.
-- Плюс (не в изначальном списке, но необходимо для консистентности
-- notifications, которые в реальной БД не может писать клиент напрямую,
-- см. 0003): триггер, рассылающий уведомления подписчикам дневника при
-- публикации нового отчёта — это прямой перенос логики из
-- AppContext.addWeekReport (моковая версия делала это только для ОДНОГО
-- текущего пользователя сессии; здесь — по-настоящему, для всех подписчиков).

-- ---------------------------------------------------------------------------
-- 1. Автосоздание profile при регистрации пользователя.
-- security definer — обходит RLS на profiles (обычным пользователям INSERT
-- туда запрещён политикой, см. 0003).
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Гровер'),
    case when new.email = 'admin@chilidiaries.local' then 'admin' else 'user' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Автообновление updated_at.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at    before update on profiles    for each row execute function set_updated_at();
create trigger trg_varieties_updated_at   before update on varieties   for each row execute function set_updated_at();
create trigger trg_diaries_updated_at     before update on diaries     for each row execute function set_updated_at();
create trigger trg_recipes_updated_at     before update on recipes     for each row execute function set_updated_at();
create trigger trg_blog_posts_updated_at  before update on blog_posts  for each row execute function set_updated_at();
create trigger trg_questions_updated_at   before update on questions   for each row execute function set_updated_at();
create trigger trg_contests_updated_at    before update on contests    for each row execute function set_updated_at();
create trigger trg_site_settings_updated_at before update on site_settings for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Автоинкремент/декремент счётчиков лайков (likes_count на
-- diaries/recipes/blog_posts/questions, см. likes в 0001).
-- ---------------------------------------------------------------------------
create or replace function apply_like_delta()
returns trigger
language plpgsql
as $$
declare
  target_table text;
  target_id uuid;
  delta int;
begin
  if tg_op = 'INSERT' then
    target_table := new.entity_type;
    target_id := new.entity_id;
    delta := 1;
  else
    target_table := old.entity_type;
    target_id := old.entity_id;
    delta := -1;
  end if;

  if target_table = 'diary' then
    update diaries set likes_count = greatest(0, likes_count + delta) where id = target_id;
  elsif target_table = 'recipe' then
    update recipes set likes_count = greatest(0, likes_count + delta) where id = target_id;
  elsif target_table = 'blog_post' then
    update blog_posts set likes_count = greatest(0, likes_count + delta) where id = target_id;
  elsif target_table = 'question' then
    update questions set likes_count = greatest(0, likes_count + delta) where id = target_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_likes_insert after insert on likes
  for each row execute function apply_like_delta();
create trigger trg_likes_delete after delete on likes
  for each row execute function apply_like_delta();

-- ---------------------------------------------------------------------------
-- 4. Рассылка уведомлений подписчикам дневника при новом отчёте.
-- Перенос логики AppContext.addWeekReport на сторону БД: в моке
-- уведомление создавалось только для currentUser, если он сам был подписан
-- (subscribedDiaryIds) — здесь делаем это правильно, для ВСЕХ подписчиков
-- из diary_subscriptions, кроме самого автора отчёта.
-- ---------------------------------------------------------------------------
create or replace function notify_diary_subscribers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diary_title text;
  diary_owner uuid;
begin
  select title, grower_id into diary_title, diary_owner from diaries where id = new.diary_id;

  insert into notifications (user_id, diary_id, message)
  select s.user_id, new.diary_id, 'Новый отчёт в дневнике «' || diary_title || '»'
  from diary_subscriptions s
  where s.diary_id = new.diary_id and s.user_id <> diary_owner;

  return new;
end;
$$;

create trigger trg_notify_on_new_report
  after insert on diary_reports
  for each row execute function notify_diary_subscribers();

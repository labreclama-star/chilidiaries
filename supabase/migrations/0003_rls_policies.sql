-- ChiliDiaries — Этап 5, миграция 3: RLS-политики.
--
-- Общий принцип из ТЗ: публичный read для varieties, recipes (не скрытые),
-- blog_posts (approved), questions, diaries (is_private = false), comments,
-- likes, profiles. Write — только владелец (auth.uid() = user_id/grower_id).
-- Приватные дневники — только владельцу.
--
-- Плюс везде, где логично, роль admin (profiles.role = 'admin') получает
-- полный доступ — это отражает то, что в моке AppContext.jsx все adminX-
-- функции ничего не проверяют сами (см. комментарий в самом AppContext:
-- "не проверяют isAdmin сами — это ответственность ProtectedAdminRoute").
-- В реальной БД эта проверка ОБЯЗАНА жить на уровне RLS, а не только в UI.

-- ---------------------------------------------------------------------------
-- Вспомогательная функция: is_admin() — читает роль текущего пользователя.
-- security definer, чтобы сама проверка не спровоцировала рекурсию RLS на
-- profiles (иначе policy на profiles попыталась бы снова вызвать is_admin()).
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and not deleted
  );
$$;

-- Включаем RLS на всех таблицах.
alter table profiles              enable row level security;
alter table varieties             enable row level security;
alter table diaries               enable row level security;
alter table diary_varieties       enable row level security;
alter table diary_reports         enable row level security;
alter table diary_photos          enable row level security;
alter table recipes               enable row level security;
alter table blog_posts            enable row level security;
alter table questions             enable row level security;
alter table answers               enable row level security;
alter table comments              enable row level security;
alter table likes                 enable row level security;
alter table follows               enable row level security;
alter table diary_subscriptions   enable row level security;
alter table badges                enable row level security;
alter table user_badges           enable row level security;
alter table contests              enable row level security;
alter table contest_participants  enable row level security;
alter table notifications         enable row level security;
alter table seed_bank_items       enable row level security;
alter table lights                enable row level security;
alter table nutrients             enable row level security;
alter table variety_votes         enable row level security;
alter table site_settings         enable row level security;

-- ---------------------------------------------------------------------------
-- PROFILES — публичный read (карточки гроверов везде в приложении).
-- INSERT сюда делает ТОЛЬКО триггер handle_new_user() (security definer,
-- см. 0004) — обычным пользователям insert не разрешён.
-- ---------------------------------------------------------------------------
create policy "profiles_select_public" on profiles for select using (true);
create policy "profiles_update_own_or_admin" on profiles for update
  using (auth.uid() = id or is_admin());
-- delete запрещён политикой по умолчанию (мягкое удаление через deleted=true, см. adminSetGrowerDeleted).

-- ---------------------------------------------------------------------------
-- VARIETIES — публичный read; добавить новый сорт может любой авторизованный
-- (форма "добавить свой сорт"); менять/удалять — автор или admin.
-- ---------------------------------------------------------------------------
create policy "varieties_select_public" on varieties for select using (true);
create policy "varieties_insert_authenticated" on varieties for insert
  with check (auth.uid() is not null);
create policy "varieties_update_owner_or_admin" on varieties for update
  using (added_by = auth.uid() or is_admin());
create policy "varieties_delete_admin_only" on varieties for delete
  using (is_admin());

-- ---------------------------------------------------------------------------
-- DIARIES — публичный read ТОЛЬКО для is_private = false; приватные —
-- только владельцу (и админу, для модерации).
-- ---------------------------------------------------------------------------
create policy "diaries_select_public_or_owner" on diaries for select
  using (not is_private or grower_id = auth.uid() or is_admin());
create policy "diaries_insert_own" on diaries for insert
  with check (grower_id = auth.uid());
create policy "diaries_update_owner_or_admin" on diaries for update
  using (grower_id = auth.uid() or is_admin());
create policy "diaries_delete_owner_or_admin" on diaries for delete
  using (grower_id = auth.uid() or is_admin());

-- diary_varieties / diary_reports / diary_photos наследуют видимость
-- родительского дневника через подзапрос — отдельного is_private здесь нет.
create policy "diary_varieties_select" on diary_varieties for select
  using (exists (select 1 from diaries d where d.id = diary_id and (not d.is_private or d.grower_id = auth.uid() or is_admin())));
create policy "diary_varieties_write_owner" on diary_varieties for all
  using (exists (select 1 from diaries d where d.id = diary_id and (d.grower_id = auth.uid() or is_admin())));

create policy "diary_reports_select" on diary_reports for select
  using (exists (select 1 from diaries d where d.id = diary_id and (not d.is_private or d.grower_id = auth.uid() or is_admin())));
create policy "diary_reports_write_owner" on diary_reports for insert
  with check (exists (select 1 from diaries d where d.id = diary_id and d.grower_id = auth.uid()));
create policy "diary_reports_update_owner_or_admin" on diary_reports for update
  using (exists (select 1 from diaries d where d.id = diary_id and (d.grower_id = auth.uid() or is_admin())));
create policy "diary_reports_delete_owner_or_admin" on diary_reports for delete
  using (exists (select 1 from diaries d where d.id = diary_id and (d.grower_id = auth.uid() or is_admin())));

create policy "diary_photos_select" on diary_photos for select
  using (exists (
    select 1 from diary_reports r join diaries d on d.id = r.diary_id
    where r.id = diary_report_id and (not d.is_private or d.grower_id = auth.uid() or is_admin())
  ));
create policy "diary_photos_write_owner" on diary_photos for all
  using (exists (
    select 1 from diary_reports r join diaries d on d.id = r.diary_id
    where r.id = diary_report_id and (d.grower_id = auth.uid() or is_admin())
  ));

-- ---------------------------------------------------------------------------
-- RECIPES — публичный read для НЕ скрытых (hidden = false); автор видит
-- свой рецепт даже если он скрыт, чтобы понимать, что его модерировали.
-- ---------------------------------------------------------------------------
create policy "recipes_select_visible_or_owner" on recipes for select
  using (not hidden or grower_id = auth.uid() or is_admin());
create policy "recipes_insert_own" on recipes for insert
  with check (grower_id = auth.uid() or is_admin()); -- is_admin() — для adminAddRecipe (growerId='admin')
create policy "recipes_update_owner_or_admin" on recipes for update
  using (grower_id = auth.uid() or is_admin());
create policy "recipes_delete_owner_or_admin" on recipes for delete
  using (grower_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- BLOG_POSTS — публичный read только для status = 'approved'; автор видит
-- свою статью на любой стадии модерации (pending/rejected).
-- ---------------------------------------------------------------------------
create policy "blog_posts_select_approved_or_owner" on blog_posts for select
  using (status = 'approved' or grower_id = auth.uid() or is_admin());
create policy "blog_posts_insert_own" on blog_posts for insert
  with check (grower_id = auth.uid() or is_admin());
create policy "blog_posts_update_owner_or_admin" on blog_posts for update
  using (grower_id = auth.uid() or is_admin());
create policy "blog_posts_delete_owner_or_admin" on blog_posts for delete
  using (grower_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- QUESTIONS / ANSWERS — публичный read (Q&A — открытый раздел без приватности).
-- ---------------------------------------------------------------------------
create policy "questions_select_public" on questions for select using (true);
create policy "questions_insert_own" on questions for insert
  with check (grower_id = auth.uid());
create policy "questions_update_owner_or_admin" on questions for update
  using (grower_id = auth.uid() or is_admin());
create policy "questions_delete_owner_or_admin" on questions for delete
  using (grower_id = auth.uid() or is_admin());

create policy "answers_select_public" on answers for select using (true);
create policy "answers_insert_own" on answers for insert
  with check (author_id = auth.uid());
create policy "answers_update_owner_or_admin" on answers for update
  using (author_id = auth.uid() or is_admin());
create policy "answers_delete_owner_or_admin" on answers for delete
  using (author_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- COMMENTS — публичный read (наследует видимость дневника, как и reports).
-- ---------------------------------------------------------------------------
create policy "comments_select_visible_diary" on comments for select
  using (exists (select 1 from diaries d where d.id = diary_id and (not d.is_private or d.grower_id = auth.uid() or is_admin())));
create policy "comments_insert_own" on comments for insert
  with check (author_id = auth.uid());
create policy "comments_delete_owner_or_admin" on comments for delete
  using (author_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- LIKES — публичный read (нужно, чтобы посчитать/показать, лайкнул ли
-- текущий юзер конкретную запись); писать может только сам пользователь
-- за самого себя.
-- ---------------------------------------------------------------------------
create policy "likes_select_public" on likes for select using (true);
create policy "likes_insert_own" on likes for insert
  with check (user_id = auth.uid());
create policy "likes_delete_own" on likes for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- FOLLOWS — публичный read (счётчики подписчиков, "подписан ли я"); писать
-- можно только от своего имени.
-- ---------------------------------------------------------------------------
create policy "follows_select_public" on follows for select using (true);
create policy "follows_insert_own" on follows for insert
  with check (follower_id = auth.uid());
create policy "follows_delete_own" on follows for delete
  using (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- DIARY_SUBSCRIPTIONS — личное дело каждого пользователя, наружу не публично.
-- ---------------------------------------------------------------------------
create policy "diary_subscriptions_select_own" on diary_subscriptions for select
  using (user_id = auth.uid());
create policy "diary_subscriptions_insert_own" on diary_subscriptions for insert
  with check (user_id = auth.uid());
create policy "diary_subscriptions_delete_own" on diary_subscriptions for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- BADGES / USER_BADGES — справочник и факты открыты всем на чтение
-- (профиль гровера показывает бейджи всем посетителям); писать может
-- только admin (badges) либо система через триггер (user_badges).
-- ---------------------------------------------------------------------------
create policy "badges_select_public" on badges for select using (true);
create policy "badges_write_admin_only" on badges for all using (is_admin());

create policy "user_badges_select_public" on user_badges for select using (true);
create policy "user_badges_write_admin_only" on user_badges for all using (is_admin());

-- ---------------------------------------------------------------------------
-- CONTESTS — публичный read; создавать/менять конкурсы может только admin
-- (в моке это исключительно admin-функционал — adminAddContest и т.п.).
-- ---------------------------------------------------------------------------
create policy "contests_select_public" on contests for select using (true);
create policy "contests_write_admin_only" on contests for all using (is_admin());

-- CONTEST_PARTICIPANTS — публичный read (список участников виден всем);
-- пользователь может добавить СЕБЯ (joinContest), admin — кого угодно
-- (adminAddContestParticipant/adminRemoveContestParticipant).
create policy "contest_participants_select_public" on contest_participants for select using (true);
create policy "contest_participants_insert_self_or_admin" on contest_participants for insert
  with check (user_id = auth.uid() or is_admin());
create policy "contest_participants_delete_self_or_admin" on contest_participants for delete
  using (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS — строго личное; INSERT для обычных пользователей закрыт —
-- уведомления создаёт триггер на diary_reports (см. 0004) с security definer.
-- ---------------------------------------------------------------------------
create policy "notifications_select_own" on notifications for select
  using (user_id = auth.uid());
create policy "notifications_update_own" on notifications for update
  using (user_id = auth.uid()); -- markNotificationRead/markAllNotificationsRead

-- ---------------------------------------------------------------------------
-- SEED_BANK_ITEMS — строго личное.
-- ---------------------------------------------------------------------------
create policy "seed_bank_items_select_own" on seed_bank_items for select
  using (user_id = auth.uid());
create policy "seed_bank_items_insert_own" on seed_bank_items for insert
  with check (user_id = auth.uid());
create policy "seed_bank_items_update_own" on seed_bank_items for update
  using (user_id = auth.uid());
create policy "seed_bank_items_delete_own" on seed_bank_items for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- LIGHTS / NUTRIENTS — каталог оборудования: публичный read, пишет только admin.
-- ---------------------------------------------------------------------------
create policy "lights_select_public" on lights for select using (true);
create policy "lights_write_admin_only" on lights for all using (is_admin());

create policy "nutrients_select_public" on nutrients for select using (true);
create policy "nutrients_write_admin_only" on nutrients for all using (is_admin());

-- ---------------------------------------------------------------------------
-- VARIETY_VOTES — публичный read (нужно для пересчёта агрегатов рейтинга
-- на клиенте/в будущей RPC-функции); писать можно только свой голос,
-- один на пару (variety_id, user_id) — обеспечено PK, повторный голос это upsert.
-- ---------------------------------------------------------------------------
create policy "variety_votes_select_public" on variety_votes for select using (true);
create policy "variety_votes_upsert_own" on variety_votes for insert
  with check (user_id = auth.uid());
create policy "variety_votes_update_own" on variety_votes for update
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- SITE_SETTINGS — синглтон, публичный read (баннер/фичефлаги нужны на
-- главной без авторизации), пишет только admin.
-- ---------------------------------------------------------------------------
create policy "site_settings_select_public" on site_settings for select using (true);
create policy "site_settings_update_admin_only" on site_settings for update using (is_admin());

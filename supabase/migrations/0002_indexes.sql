-- ChiliDiaries — Этап 5, миграция 2: индексы.
--
-- По заданию: индексы на все FK, slug, created_at, is_private, stage.
-- Primary key и unique-констрейнты (0001) уже создают индекс автоматически —
-- здесь только то, что PK/unique не покрыли (обычные FK-колонки, поля для
-- фильтрации в лентах и т.п.).

-- ---- FK-колонки ----
create index idx_varieties_added_by            on varieties (added_by);

create index idx_diaries_variety_id            on diaries (variety_id);
create index idx_diaries_grower_id             on diaries (grower_id);

create index idx_diary_varieties_variety_id    on diary_varieties (variety_id);
-- diary_id уже первая колонка составного PK (diary_id, variety_id) — отдельный индекс не нужен.

create index idx_diary_reports_diary_id        on diary_reports (diary_id);
create index idx_diary_photos_report_id        on diary_photos (diary_report_id);

create index idx_recipes_grower_id             on recipes (grower_id);
create index idx_recipes_variety_id            on recipes (variety_id);

create index idx_blog_posts_grower_id          on blog_posts (grower_id);
create index idx_blog_posts_variety_id         on blog_posts (variety_id);

create index idx_questions_grower_id           on questions (grower_id);
create index idx_questions_diary_id            on questions (diary_id);

create index idx_answers_question_id           on answers (question_id);
create index idx_answers_author_id             on answers (author_id);

create index idx_comments_diary_id             on comments (diary_id);
create index idx_comments_author_id            on comments (author_id);

create index idx_likes_user_id                 on likes (user_id);
-- Частый запрос: "лайки для конкретной сущности" (entity_type, entity_id) —
-- составной индекс, а не два отдельных, так как всегда фильтруем по обоим сразу.
create index idx_likes_entity                  on likes (entity_type, entity_id);

create index idx_follows_followed_id           on follows (followed_id); -- "кто подписан на X" (followed_id — вторая часть составного PK, своего индекса не имеет)

create index idx_diary_subscriptions_diary_id  on diary_subscriptions (diary_id);

create index idx_user_badges_badge_id          on user_badges (badge_id);

create index idx_contest_participants_user_id  on contest_participants (user_id);

create index idx_notifications_user_id         on notifications (user_id);
create index idx_notifications_diary_id        on notifications (diary_id);

create index idx_seed_bank_items_user_id       on seed_bank_items (user_id);
create index idx_seed_bank_items_variety_id    on seed_bank_items (variety_id);

create index idx_variety_votes_user_id         on variety_votes (user_id); -- variety_id — первая часть составного PK

-- ---- slug ----
-- blog_posts.slug уже unique (создаёт индекс автоматически, 0001) —
-- дополнительный явно не нужен, но фиксируем это здесь для полноты списка.

-- ---- created_at (лента "новое сверху" на всех сущностях с фидом) ----
create index idx_diaries_created_at            on diaries (created_at desc);
create index idx_recipes_created_at            on recipes (created_at desc);
create index idx_blog_posts_created_at         on blog_posts (created_at desc);
create index idx_questions_created_at          on questions (created_at desc);
create index idx_comments_created_at           on comments (created_at desc);
create index idx_answers_created_at            on answers (created_at desc);
create index idx_notifications_created_at      on notifications (created_at desc);

-- ---- is_private (фильтр "покажи только публичные дневники" на каждой ленте) ----
create index idx_diaries_is_private            on diaries (is_private);

-- ---- stage (фильтр по стадии на страницах дневников/вопросов) ----
create index idx_diaries_stage                 on diaries (stage);
create index idx_questions_stage               on questions (stage);

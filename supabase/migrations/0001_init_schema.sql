-- ChiliDiaries — Этап 5, миграция 1: базовая схема.
--
-- Соответствует доменной модели из src/domain/types.js (Этап 2) и отчёту
-- Этапа 1. Там, где текущий мок-слой имел "компромиссы" (риски Этапа 1),
-- здесь схема сразу делает правильно — конкретно:
--   - comments.author_id / answers.author_id — реальный FK на profiles,
--     а не имя строкой (риск №2);
--   - follows — отдельная таблица вместо grower._followed (риск №3);
--   - contest_participants — ЕДИНАЯ таблица участников конкурса вместо
--     двух несинхронизированных списков participantIds/joinedContestIds
--     (риск №4);
--   - notifications.user_id и seed_bank_items.user_id — явные владельцы
--     (в моке этих полей не было вообще — риск №11);
--   - likes — полиморфная таблица вместо likes/liked-полей на каждой
--     сущности + денормализованных счётчиков, которые ничем не защищены
--     от рассинхронизации.
-- Названия таблиц/колонок — snake_case (стандарт Postgres/Supabase),
-- в отличие от camelCase на клиенте — маппинг делает слой на клиенте
-- при переключении services/* с mock на real (Этап 3 подготовил под это
-- сигнатуры функций).

create extension if not exists "pgcrypto"; -- для gen_random_uuid()

-- ============================================================================
-- 1. PROFILES — заменяет grower. id = auth.users.id (1:1), см. 0004_triggers.sql
--    для автосоздания строки при регистрации.
-- ============================================================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  loc           text default '',
  bio           text default '',
  avatar_url    text,
  online        boolean not null default false,
  role          text not null default 'user' check (role in ('user', 'admin')),
  banned        boolean not null default false,
  deleted       boolean not null default false, -- мягкое удаление, см. риск про adminSetGrowerDeleted
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table profiles is 'Публичный профиль гровера. diaries/followers-счётчики НЕ храним здесь — считаются по факту (count(*) на diaries/follows) либо материализуются отдельно при необходимости, чтобы не рассинхронизироваться, как это было в моке.';

-- ============================================================================
-- 2. VARIETIES — сорта перца
-- ============================================================================
create table varieties (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  species            text,
  shu_min            integer,
  shu_max            integer,
  rating             numeric(3,2),           -- null, пока нет голосов
  capsaicin_rating   numeric(3,2),
  aroma_rating       numeric(3,2),
  difficulty         text,
  days_min           integer,                -- было строкой '80-100' в моке — разбито на два числа
  days_max           integer,
  origin             text default 'Не указано',
  photo_url          text,
  description        text default '',
  user_added         boolean not null default false,
  added_by           uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================================
-- 3. DIARIES — дневники выращивания
-- ============================================================================
create table diaries (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description       text default '',
  variety_id       uuid not null references varieties(id) on delete restrict, -- основной сорт
  grower_id        uuid not null references profiles(id) on delete cascade,
  stage            text not null default 'Рассада'
                   check (stage in ('Рассада','Вегетация','Цветение','Плодоношение','Собран урожай')),
  location         text default '',
  medium           text default '',
  techniques       text[] not null default '{}',
  shu              numeric,
  start_date       date not null default current_date,
  cover_photo_url  text,
  report_interval  text not null default 'weekly' check (report_interval in ('daily','every3','weekly','custom')),
  -- Приватные дневники — фичи в моке ещё нет (весь UI сегодня публичный),
  -- но ТЗ явно просит колонку is_private для RLS уже сейчас (Этап 5,
  -- задание 0003) — готовим схему заранее, UI подключит это позже.
  is_private       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on column diaries.is_private is 'Заготовка на будущее: в текущем моке (Этап 1-4) приватных дневников нет, все публичны. RLS на эту колонку уже настроен (0003), UI появится позже.';

-- N—M: у дневника может быть несколько сортов (было diary.varietyIds[] в моке).
-- variety_id на diaries — это "основной" сорт для быстрых JOIN/фильтров,
-- полный список — здесь.
create table diary_varieties (
  diary_id    uuid not null references diaries(id) on delete cascade,
  variety_id  uuid not null references varieties(id) on delete cascade,
  primary key (diary_id, variety_id)
);

-- ============================================================================
-- 4. DIARY_REPORTS — заменяет diary.weeks[] (историческое имя, по сути отчёты)
-- ============================================================================
create table diary_reports (
  id             uuid primary key default gen_random_uuid(),
  diary_id       uuid not null references diaries(id) on delete cascade,
  report_number  integer not null,           -- было `n`
  day_number     integer,                    -- было `day`
  title          text,
  stage          text,                       -- null = наследует текущую стадию дневника
  note           text default '',
  temp_c         numeric,
  humidity       numeric,
  report_date    date not null default current_date, -- было локализованной строкой '02 апр' — риск №6, тут ISO date
  created_at     timestamptz not null default now(),
  unique (diary_id, report_number)
);

-- diary.weeks[].photos[] — отдельная таблица, а не text[] в diary_reports,
-- чтобы каждое фото могло позже получить свою запись в Supabase Storage
-- (bucket + path) без пересоздания строки отчёта.
create table diary_photos (
  id                uuid primary key default gen_random_uuid(),
  diary_report_id   uuid not null references diary_reports(id) on delete cascade,
  url               text not null,           -- сегодня — заготовка под Storage URL; base64 сюда НЕ кладём
  position          integer not null default 0,
  created_at        timestamptz not null default now()
);

-- ============================================================================
-- 5. RECIPES
-- ============================================================================
create table recipes (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null check (category in ('Соус','Приправа','Заготовка','Паста')),
  grower_id     uuid not null references profiles(id) on delete cascade,
  variety_id    uuid references varieties(id) on delete set null,
  description    text default '',
  ingredients   text[] not null default '{}',
  steps         text[] not null default '{}',
  photo_url     text,
  views_count   integer not null default 0,
  hidden        boolean not null default false, -- админ может скрыть без удаления
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================================
-- 6. BLOG_POSTS
-- ============================================================================
create table blog_posts (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  grower_id      uuid not null references profiles(id) on delete cascade,
  variety_id     uuid references varieties(id) on delete set null,
  photo_url      text,
  tags           text[] not null default '{}',
  excerpt        text default '',
  content        text[] not null default '{}', -- абзацы; см. также риск про base64-фото внутри статьи (Этап 1, не в этой миграции)
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason  text default '',
  views_count    integer not null default 0,
  published_date date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================================
-- 7. QUESTIONS / ANSWERS (Q&A)
-- ============================================================================
create table questions (
  id           uuid primary key default gen_random_uuid(),
  grower_id    uuid not null references profiles(id) on delete cascade,
  diary_id     uuid references diaries(id) on delete set null,
  text_content text not null,
  photo_url    text,
  stage        text check (stage in ('Прорастание','Вегетация','Цветение','Плодоношение','Харвест')),
  topic        text check (topic in ('Листья','Растение','Корни','Кормление','Другое')),
  status       text not null default 'open' check (status in ('open','solved')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table answers (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions(id) on delete cascade,
  -- ФИКС риска №2 из отчёта Этапа 1: раньше author был именем строкой.
  -- Автора-администратора ('Администратор' в моке) представляем как
  -- обычного profiles.id с role='admin' — отдельного флага не нужно.
  author_id    uuid not null references profiles(id) on delete cascade,
  text_content text not null,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 8. COMMENTS — привязаны к дневникам (единственное место с комментариями сегодня)
-- ============================================================================
create table comments (
  id           uuid primary key default gen_random_uuid(),
  diary_id     uuid not null references diaries(id) on delete cascade,
  -- ФИКС риска №2: author_id вместо имени строкой.
  author_id    uuid not null references profiles(id) on delete cascade,
  text_content text not null,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 9. LIKES — полиморфная таблица вместо liked/likes на каждой сущности.
--    Счётчики (likes_count) денормализованы на самих сущностях и
--    поддерживаются триггерами (см. 0004_triggers.sql), чтобы читать
--    ленту не JOIN-я likes на каждый рендер.
-- ============================================================================
create table likes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  entity_type  text not null check (entity_type in ('diary','recipe','blog_post','question')),
  entity_id    uuid not null,
  created_at   timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);
comment on table likes is 'entity_id ссылается на diaries/recipes/blog_posts/questions в зависимости от entity_type — это не настоящий FK (Postgres не умеет полиморфные FK), целостность проверяется приложением/триггером при вставке.';

-- Денормализованные счётчики лайков — на самих сущностях, обновляются
-- триггером after insert/delete on likes (0004).
alter table diaries      add column likes_count integer not null default 0;
alter table recipes      add column likes_count integer not null default 0;
alter table blog_posts   add column likes_count integer not null default 0;
alter table questions    add column likes_count integer not null default 0;

-- ============================================================================
-- 10. FOLLOWS — заменяет grower._followed (риск №3: было глобальным булем
--     на объекте гровера, что подразумевало единственного текущего юзера)
-- ============================================================================
create table follows (
  follower_id  uuid not null references profiles(id) on delete cascade,
  followed_id  uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

-- Подписка на обновления ОТДЕЛЬНОГО дневника (было subscribedDiaryIds в
-- AppContext) — это НЕ подписка на гровера (follows), поэтому отдельная
-- таблица, а не переиспользование follows с diary_id.
create table diary_subscriptions (
  user_id     uuid not null references profiles(id) on delete cascade,
  diary_id    uuid not null references diaries(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, diary_id)
);

-- ============================================================================
-- 11. BADGES / USER_BADGES — сегодня в моке это НЕ хранимая сущность
--     (вычисляется growerBadges() на лету, см. domain/schema.js BADGE_TYPES).
--     Таблицы готовим на будущее: badges — справочник правил, user_badges —
--     фактически заработанные бейджи (можно продолжать вычислять на лету
--     ИЛИ материализовать через триггер/cron — решение вне этой миграции).
-- ============================================================================
create table badges (
  id     text primary key, -- 'first_diary', 'top_grower' и т.д. — см. domain/schema.js BADGE_TYPES
  icon   text not null,
  label  text not null,
  rule_description text not null
);

create table user_badges (
  user_id    uuid not null references profiles(id) on delete cascade,
  badge_id   text not null references badges(id) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- ============================================================================
-- 12. CONTESTS / CONTEST_PARTICIPANTS
--     ФИКС риска №4: раньше было ДВА несинхронизированных списка —
--     contest.participantIds (админ) и joinedContestIds (клиент, сессия).
--     Теперь это одна таблица: и админ, и пользователь пишут в неё же.
-- ============================================================================
create table contests (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description       text default '',
  full_description text default '',
  prize            text default '',
  progress         integer not null default 0 check (progress >= 0 and progress <= 100),
  deadline         date,
  start_date       date,
  status           text not null default 'upcoming' check (status in ('upcoming','active','finished')),
  photo_url        text,
  sponsor          text default '',
  rules            text[] not null default '{}',
  how_to_join      text default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table contest_participants (
  contest_id  uuid not null references contests(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (contest_id, user_id)
);

-- ============================================================================
-- 13. NOTIFICATIONS
--     ФИКС: в моке не было user_id вообще (риск №11) — подразумевался
--     единственный текущий пользователь сессии.
-- ============================================================================
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  diary_id    uuid references diaries(id) on delete cascade,
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 14. SEED_BANK_ITEMS
--     ФИКС: в моке не было user_id вообще (риск №11).
-- ============================================================================
create table seed_bank_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  name        text not null,
  variety_id  uuid references varieties(id) on delete set null,
  quantity    text default '',
  status      text not null default 'have' check (status in ('have','want')),
  notes       text default '',
  added_at    timestamptz not null default now()
);

-- ============================================================================
-- 15. LIGHTS / NUTRIENTS — каталог оборудования, идентичная форма
-- ============================================================================
create table lights (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand       text default '',
  type        text default '',
  tag         text default '',
  price       text default '',        -- строка с валютой, как в моке ('7 990 ₽') — не парсим в число здесь
  rating      numeric(2,1) default 0,
  description  text default '',
  link        text default '',
  photo_url   text,
  sponsored   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table nutrients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand       text default '',
  type        text default '',
  tag         text default '',
  price       text default '',
  rating      numeric(2,1) default 0,
  description  text default '',
  link        text default '',
  photo_url   text,
  sponsored   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 16. VARIETY_VOTES — один голос на пару (сорт, пользователь)
-- ============================================================================
create table variety_votes (
  variety_id  uuid not null references varieties(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  overall     numeric(3,2) not null,
  capsaicin   numeric(3,2) not null,
  aroma       numeric(3,2) not null,
  voted_at    timestamptz not null default now(),
  primary key (variety_id, user_id)
);

-- ============================================================================
-- 17. SITE_SETTINGS — синглтон (ровно одна строка), заменяет settings-объект
-- ============================================================================
create table site_settings (
  id                     boolean primary key default true check (id), -- гарантирует единственную строку
  site_name              text not null default 'ChiliDiaries',
  site_description       text not null default 'Социальная платформа для гроверов острого перца.',
  contact_email          text default '',
  telegram               text default '',
  instagram              text default '',
  banner_enabled         boolean not null default false,
  banner_text            text default '',
  banner_photo_url       text,
  hero_photo_url         text,
  registration_enabled   boolean not null default true,
  show_questions         boolean not null default true,
  show_feed              boolean not null default true,
  updated_at             timestamptz not null default now()
);
insert into site_settings (id) values (true);

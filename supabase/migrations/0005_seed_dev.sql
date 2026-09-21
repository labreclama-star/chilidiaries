-- ChiliDiaries — Этап 5, миграция 5: dev-сиды.
--
-- ТОЛЬКО для локальной/dev Supabase (supabase start / staging-проект).
-- НЕ применять на проде — вставка напрямую в auth.users обходит нормальный
-- флоу регистрации (Supabase Auth) и годится исключительно для тестовых
-- окружений с минимальным набором обязательных колонок auth.users на
-- текущей версии GoTrue. Если версия Supabase изменит схему auth.users —
-- этот блок нужно будет поправить под неё.
--
-- Пароль для всех dev-аккаунтов одинаковый и предсказуемый: "chilidiaries-dev".
-- ВНИМАНИЕ: encrypted_password ниже — это НЕ настоящий bcrypt-хэш этого
-- пароля, а плейсхолдер. Через SQL нельзя корректно сгенерировать
-- bcrypt-хэш — используй `supabase auth admin` / Dashboard, чтобы
-- реально залогиниться под dev-пользователем, либо создавай пользователей
-- через supabase-js admin API (см. scripts/migrate-seed-to-supabase.mjs,
-- Этап 6) вместо этого файла, если тебе нужен рабочий логин, а не только
-- данные для проверки списков/лент.

-- ---------------------------------------------------------------------------
-- 0. Пользователи (12 гроверов + 1 admin) — auth.users + profiles.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@chilidiaries.local',   'placeholder', now(), '{"provider":"email"}', '{"name":"Администратор"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower1@chilidiaries.local',  'placeholder', now(), '{"provider":"email"}', '{"name":"Ivan Perchev"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower2@chilidiaries.local',  'placeholder', now(), '{"provider":"email"}', '{"name":"Maria Ognennaya"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower3@chilidiaries.local',  'placeholder', now(), '{"provider":"email"}', '{"name":"Oleg Habanero"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower4@chilidiaries.local',  'placeholder', now(), '{"provider":"email"}', '{"name":"Anna Chili"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower5@chilidiaries.local',  'placeholder', now(), '{"provider":"email"}', '{"name":"Dmitry Scoville"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower6@chilidiaries.local',  'placeholder', now(), '{"provider":"email"}', '{"name":"Elena Jalapeno"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower7@chilidiaries.local',  'placeholder', now(), '{"provider":"email"}', '{"name":"Pavel Reaper"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower8@chilidiaries.local',  'placeholder', now(), '{"provider":"email"}', '{"name":"Sveta Naga"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower9@chilidiaries.local',  'placeholder', now(), '{"provider":"email"}', '{"name":"Kirill Trinidad"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower10@chilidiaries.local', 'placeholder', now(), '{"provider":"email"}', '{"name":"Nastya Serrano"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower11@chilidiaries.local', 'placeholder', now(), '{"provider":"email"}', '{"name":"Roman Cayenne"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grower12@chilidiaries.local', 'placeholder', now(), '{"provider":"email"}', '{"name":"Yulia Poblano"}', now(), now())
on conflict (id) do nothing;

-- profiles создаются триггером handle_new_user() (0004) автоматически при
-- insert в auth.users — здесь только донасыщаем недостающие поля (loc/bio/avatar и т.п.).
update profiles set loc = 'Москва',           bio = 'Выращиваю самые злые сорта уже 5 лет.', online = true  where id = 'a0000000-0000-0000-0000-000000000002';
update profiles set loc = 'Санкт-Петербург',  bio = 'Люблю хабанеро и всё, что жжётся.',     online = false where id = 'a0000000-0000-0000-0000-000000000003';
update profiles set loc = 'Казань',           bio = 'Балконный гровер, третий сезон.',       online = true  where id = 'a0000000-0000-0000-0000-000000000004';
update profiles set loc = 'Новосибирск',      bio = 'Собираю коллекцию редких сортов.',      online = false where id = 'a0000000-0000-0000-0000-000000000005';
update profiles set loc = 'Екатеринбург',     bio = 'Carolina Reaper — моя страсть.',        online = true  where id = 'a0000000-0000-0000-0000-000000000006';
update profiles set loc = 'Краснодар',        bio = 'Тепличное выращивание, южный климат.',  online = false where id = 'a0000000-0000-0000-0000-000000000007';
update profiles set loc = 'Ростов-на-Дону',   bio = 'Гидропоника и немного эксперимента.',   online = true  where id = 'a0000000-0000-0000-0000-000000000008';
update profiles set loc = 'Владивосток',      bio = 'Дальневосточный гровер, экстремальный климат.', online = false where id = 'a0000000-0000-0000-0000-000000000009';
update profiles set loc = 'Самара',           bio = 'Первый сезон, учусь у сообщества.',     online = true  where id = 'a0000000-0000-0000-0000-000000000010';
update profiles set loc = 'Уфа',              bio = 'Люблю необычные ароматные сорта.',      online = false where id = 'a0000000-0000-0000-0000-000000000011';
update profiles set loc = 'Воронеж',          bio = 'Веду 4 дневника параллельно.',          online = true  where id = 'a0000000-0000-0000-0000-000000000012';
update profiles set loc = 'Тюмень',           bio = 'Сушу и делаю соусы из урожая.',         online = false where id = 'a0000000-0000-0000-0000-000000000013';

-- ---------------------------------------------------------------------------
-- 1. VARIETIES (14 сортов)
-- ---------------------------------------------------------------------------
insert into varieties (id, name, species, shu_min, shu_max, rating, capsaicin_rating, aroma_rating, difficulty, days_min, days_max, origin, description)
values
  ('b0000000-0000-0000-0000-000000000001', 'Carolina Reaper', 'Capsicum chinense', 1569300, 2200000, 4.8, 5.0, 4.2, 'Сложная', 90, 120, 'США', 'Один из самых острых сортов в мире.'),
  ('b0000000-0000-0000-0000-000000000002', 'Trinidad Moruga Scorpion', 'Capsicum chinense', 1200000, 2000000, 4.6, 4.9, 4.0, 'Сложная', 100, 130, 'Тринидад', 'Экстремально острый, с фруктовым ароматом.'),
  ('b0000000-0000-0000-0000-000000000003', 'Habanero Red', 'Capsicum chinense', 100000, 350000, 4.3, 3.8, 4.5, 'Средняя', 75, 90, 'Мексика', 'Классика, фруктовый аромат и заметная острота.'),
  ('b0000000-0000-0000-0000-000000000004', 'Jalapeno', 'Capsicum annuum', 2500, 8000, 4.0, 2.0, 3.5, 'Лёгкая', 65, 80, 'Мексика', 'Мягкий и универсальный, отлично подходит новичкам.'),
  ('b0000000-0000-0000-0000-000000000005', 'Ghost Pepper (Bhut Jolokia)', 'Capsicum chinense', 855000, 1041000, 4.7, 4.8, 4.1, 'Сложная', 100, 120, 'Индия', 'Один из первых сортов, преодолевших миллион SHU.'),
  ('b0000000-0000-0000-0000-000000000006', 'Serrano', 'Capsicum annuum', 10000, 25000, 3.9, 2.5, 3.6, 'Лёгкая', 70, 85, 'Мексика', 'Хрустящий, свежий вкус, чуть острее халапеньо.'),
  ('b0000000-0000-0000-0000-000000000007', 'Cayenne', 'Capsicum annuum', 30000, 50000, 4.1, 3.0, 3.8, 'Средняя', 70, 90, 'Французская Гвиана', 'Классика для сушки и специй.'),
  ('b0000000-0000-0000-0000-000000000008', 'Trinidad Scorpion Butch T', 'Capsicum chinense', 800000, 1463700, 4.5, 4.7, 4.0, 'Сложная', 95, 125, 'Тринидад', 'Резкая острота с ярким послевкусием.'),
  ('b0000000-0000-0000-0000-000000000009', 'Poblano', 'Capsicum annuum', 1000, 2000, 3.7, 1.2, 3.9, 'Лёгкая', 60, 80, 'Мексика', 'Мягкий, часто используется для чиле реллено.'),
  ('b0000000-0000-0000-0000-000000000010', '7 Pot Douglah', 'Capsicum chinense', 1000000, 1853986, 4.6, 4.9, 4.3, 'Сложная', 100, 130, 'Тринидад', 'Тёмный шоколадный цвет и высокая острота.'),
  ('b0000000-0000-0000-0000-000000000011', 'Aji Amarillo', 'Capsicum baccatum', 30000, 50000, 4.2, 2.8, 4.4, 'Средняя', 80, 100, 'Перу', 'Фруктовый вкус, основа перуанской кухни.'),
  ('b0000000-0000-0000-0000-000000000012', 'Fatalii', 'Capsicum chinense', 125000, 325000, 4.4, 4.0, 4.6, 'Средняя', 85, 100, 'Центральная Африка', 'Яркий цитрусовый аромат.'),
  ('b0000000-0000-0000-0000-000000000013', 'Naga Viper', 'Capsicum chinense', 900000, 1382118, 4.5, 4.8, 3.9, 'Сложная', 95, 120, 'Великобритания', 'Гибрид трёх острейших сортов своего времени.'),
  ('b0000000-0000-0000-0000-000000000014', 'Anaheim', 'Capsicum annuum', 500, 2500, 3.5, 1.0, 3.2, 'Лёгкая', 65, 80, 'США', 'Очень мягкий, часто для фарширования.');

-- ---------------------------------------------------------------------------
-- 2. DIARIES (12 дневников — по одному на каждого не-админа) + связи с сортами
-- ---------------------------------------------------------------------------
insert into diaries (id, title, description, variety_id, grower_id, stage, location, medium, techniques, shu, start_date, report_interval)
select
  ('c0000000-0000-0000-0000-00000000000' || g.n)::uuid,
  v.name || ': сезон ' || g.n,
  'Дневник выращивания ' || v.name || ' от старта до урожая.',
  v.id,
  ('a0000000-0000-0000-0000-00000000000' || (g.n + 1))::uuid,
  (array['Рассада','Вегетация','Цветение','Плодоношение','Собран урожай'])[1 + (g.n % 5)],
  (array['Дома','Теплица','Открытый грунт'])[1 + (g.n % 3)],
  (array['Почва','Кокос','Гидропоника'])[1 + (g.n % 3)],
  case when g.n % 2 = 0 then array['LST','Топпинг'] else array['ScrOG'] end,
  (v.shu_min + v.shu_max) / 2.0,
  current_date - ((g.n * 11) || ' days')::interval,
  'weekly'
from generate_series(1, 12) as g(n)
join varieties v on v.id = (
  select id from varieties order by name offset (g.n - 1) limit 1
);

insert into diary_varieties (diary_id, variety_id)
select id, variety_id from diaries;

-- ---------------------------------------------------------------------------
-- 3. DIARY_REPORTS (2 отчёта на каждый дневник = 24 записи)
-- ---------------------------------------------------------------------------
insert into diary_reports (diary_id, report_number, day_number, title, note, temp_c, humidity, report_date)
select
  d.id,
  r.n,
  r.n * 14,
  'Отчёт №' || r.n,
  'Растение развивается по плану, полив и подкормка по графику.',
  22 + (r.n % 4),
  55 + (r.n % 15),
  d.start_date + (r.n * 14)
from diaries d
cross join generate_series(1, 2) as r(n);

-- ---------------------------------------------------------------------------
-- 4. RECIPES (12 рецептов)
-- ---------------------------------------------------------------------------
insert into recipes (title, category, grower_id, variety_id, description, ingredients, steps)
select
  'Соус из ' || v.name,
  (array['Соус','Приправа','Заготовка','Паста'])[1 + (n % 4)],
  ('a0000000-0000-0000-0000-00000000000' || (1 + (n % 12) + 1))::uuid,
  v.id,
  'Домашний рецепт с использованием ' || v.name || '.',
  array['перец чили', 'чеснок', 'уксус', 'соль'],
  array['Измельчить перец и чеснок', 'Проварить с уксусом 10 минут', 'Разлить по банкам']
from generate_series(1, 12) as n
join varieties v on v.id = (select id from varieties order by name offset (n - 1) limit 1);

-- ---------------------------------------------------------------------------
-- 5. BLOG_POSTS (10 статей, разные статусы модерации)
-- ---------------------------------------------------------------------------
insert into blog_posts (slug, title, grower_id, tags, excerpt, content, status, published_date)
select
  'article-' || n,
  'Статья о выращивании №' || n,
  ('a0000000-0000-0000-0000-00000000000' || (1 + (n % 12) + 1))::uuid,
  array['острый перец', 'гров'],
  'Краткое описание статьи номер ' || n || '.',
  array['Первый абзац статьи.', 'Второй абзац с подробностями.'],
  (array['approved','approved','approved','pending','rejected'])[1 + (n % 5)],
  current_date - (n || ' days')::interval
from generate_series(1, 10) as n;

-- ---------------------------------------------------------------------------
-- 6. QUESTIONS + ANSWERS (10 вопросов, часть с ответами)
-- ---------------------------------------------------------------------------
insert into questions (id, grower_id, diary_id, text_content, stage, topic, status)
select
  ('d0000000-0000-0000-0000-00000000000' || n)::uuid,
  ('a0000000-0000-0000-0000-00000000000' || (1 + (n % 12) + 1))::uuid,
  ('c0000000-0000-0000-0000-00000000000' || (1 + (n % 12)))::uuid,
  'Почему желтеют листья на растении №' || n || '?',
  (array['Прорастание','Вегетация','Цветение','Плодоношение','Харвест'])[1 + (n % 5)],
  (array['Листья','Растение','Корни','Кормление','Другое'])[1 + (n % 5)],
  case when n % 3 = 0 then 'solved' else 'open' end
from generate_series(1, 10) as n;

insert into answers (question_id, author_id, text_content)
select
  ('d0000000-0000-0000-0000-00000000000' || n)::uuid,
  'a0000000-0000-0000-0000-000000000001', -- отвечает администратор
  'Похоже на нехватку азота — попробуй подкормку с более высоким N.'
from generate_series(1, 10) as n
where n % 3 = 0;

-- ---------------------------------------------------------------------------
-- 7. COMMENTS (по 1-2 на дневник, 16 записей)
-- ---------------------------------------------------------------------------
insert into comments (diary_id, author_id, text_content)
select
  ('c0000000-0000-0000-0000-00000000000' || d.n)::uuid,
  ('a0000000-0000-0000-0000-00000000000' || (1 + ((d.n + c.n) % 12) + 1))::uuid,
  case c.n when 1 then 'Отличный прогресс, так держать!' else 'А чем подкармливаешь на этой стадии?' end
from generate_series(1, 12) as d(n)
cross join generate_series(1, 2) as c(n)
where (d.n + c.n) % 3 <> 0; -- не у всех дневников по 2 комментария, чтобы данные выглядели естественнее

-- ---------------------------------------------------------------------------
-- 8. LIKES (полиморфные, по дневникам и рецептам)
-- ---------------------------------------------------------------------------
insert into likes (user_id, entity_type, entity_id)
select
  ('a0000000-0000-0000-0000-00000000000' || (1 + ((d.n + u.n) % 12) + 1))::uuid,
  'diary',
  d.id
from diaries d
cross join generate_series(1, 3) as u(n)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 9. FOLLOWS (каждый гровер подписан на следующего по кругу)
-- ---------------------------------------------------------------------------
insert into follows (follower_id, followed_id)
select
  ('a0000000-0000-0000-0000-00000000000' || (n + 1))::uuid,
  ('a0000000-0000-0000-0000-00000000000' || (1 + (n % 12) + 1))::uuid
from generate_series(1, 12) as n
where (n + 1) <> (1 + (n % 12) + 1); -- защита от follows.check(follower_id <> followed_id)

-- ---------------------------------------------------------------------------
-- 10. BADGES (справочник — из domain/schema.js BADGE_TYPES)
-- ---------------------------------------------------------------------------
insert into badges (id, icon, label, rule_description) values
  ('first_diary',       '🌱', 'Первый гров',            'grower.diaries >= 1'),
  ('five_diaries',      '📓', '5 дневников',            'grower.diaries >= 5'),
  ('followers_100',     '🔥', '100+ подписчиков',       'grower.followers >= 100'),
  ('top_grower',        '🏆', 'Топ-гровер',             'grower.followers >= 400'),
  ('varieties_10',      '🥉', '10 сортов выращено',     'varietiesGrownCount >= 10'),
  ('varieties_20',      '🥈', '20 сортов выращено',     'varietiesGrownCount >= 20'),
  ('varieties_30',      '🥇', '30 сортов выращено',     'varietiesGrownCount >= 30'),
  ('season_closed',     '🎖️', 'Закрытие сезона',        'harvestedDiariesCount >= 1');

insert into user_badges (user_id, badge_id)
select ('a0000000-0000-0000-0000-00000000000' || (n + 1))::uuid, 'first_diary'
from generate_series(1, 12) as n;

-- ---------------------------------------------------------------------------
-- 11. CONTESTS + CONTEST_PARTICIPANTS
-- ---------------------------------------------------------------------------
insert into contests (id, title, description, prize, progress, deadline, start_date, status)
values
  ('e0000000-0000-0000-0000-000000000001', 'Самый острый урожай 2026', 'Пришли фото своего самого острого перца.', 'Набор ламп FitoLight', 40, current_date + 20, current_date - 10, 'active'),
  ('e0000000-0000-0000-0000-000000000002', 'Лучший соус сообщества',   'Придумай и опубликуй рецепт соуса.',       'Сертификат на удобрения', 0, current_date + 60, current_date + 30, 'upcoming'),
  ('e0000000-0000-0000-0000-000000000003', 'Фотоконкурс "Первый росток"', 'Лучшее фото рассады месяца.',            'Пакет редких семян', 100, current_date - 5, current_date - 35, 'finished');

insert into contest_participants (contest_id, user_id)
select 'e0000000-0000-0000-0000-000000000001', ('a0000000-0000-0000-0000-00000000000' || (n + 1))::uuid
from generate_series(1, 6) as n;

-- ---------------------------------------------------------------------------
-- 12. NOTIFICATIONS (для первого гровера)
-- ---------------------------------------------------------------------------
insert into notifications (user_id, diary_id, message, is_read)
select
  'a0000000-0000-0000-0000-000000000002',
  ('c0000000-0000-0000-0000-00000000000' || n)::uuid,
  'Новый отчёт в дневнике №' || n,
  n % 2 = 0
from generate_series(1, 10) as n;

-- ---------------------------------------------------------------------------
-- 13. SEED_BANK_ITEMS (по 1-2 на нескольких гроверов)
-- ---------------------------------------------------------------------------
insert into seed_bank_items (user_id, name, variety_id, quantity, status, notes)
select
  ('a0000000-0000-0000-0000-00000000000' || (n + 1))::uuid,
  v.name || ' семена',
  v.id,
  (n || ' шт'),
  case when n % 2 = 0 then 'have' else 'want' end,
  'Из личного архива'
from generate_series(1, 12) as n
join varieties v on v.id = (select id from varieties order by name offset (n - 1) limit 1);

-- ---------------------------------------------------------------------------
-- 14. LIGHTS / NUTRIENTS (по 10 записей)
-- ---------------------------------------------------------------------------
insert into lights (name, brand, type, tag, price, rating, description, link, sponsored)
select
  'Лампа модель ' || n,
  (array['FitoLight','GrowMax','SunPower','LEDGrow'])[1 + (n % 4)],
  (array['LED','ДНАТ','Люминесцентная'])[1 + (n % 3)],
  case when n % 3 = 0 then 'Хит продаж' else '' end,
  (5000 + n * 350) || ' ₽',
  3.5 + (n % 5) * 0.3,
  'Подходит для выращивания перца на всех стадиях.',
  'https://example.com/light-' || n,
  n % 4 = 0
from generate_series(1, 10) as n;

insert into nutrients (name, brand, type, tag, price, rating, description, link, sponsored)
select
  'Удобрение ' || n,
  (array['BioGrow','NutriMax','GreenBoost'])[1 + (n % 3)],
  (array['Органическое','Минеральное'])[1 + (n % 2)],
  case when n % 3 = 0 then 'Рекомендуем' else '' end,
  (300 + n * 50) || ' ₽',
  3.8 + (n % 4) * 0.25,
  'Комплексное питание для перцев в период вегетации и цветения.',
  'https://example.com/nutrient-' || n,
  n % 5 = 0
from generate_series(1, 10) as n;

-- ---------------------------------------------------------------------------
-- 15. VARIETY_VOTES (по 2-3 голоса на сорт)
-- ---------------------------------------------------------------------------
insert into variety_votes (variety_id, user_id, overall, capsaicin, aroma)
select
  v.id,
  ('a0000000-0000-0000-0000-00000000000' || (u.n + 1))::uuid,
  3.5 + ((u.n + 1) % 3) * 0.5,
  3.0 + (u.n % 4) * 0.5,
  3.2 + (u.n % 3) * 0.6
from varieties v
cross join generate_series(1, 2) as u(n)
on conflict do nothing;

-- 0013_contest_diary.sql
-- Механика конкурсов: привязка дневника к участию + таблица победителей.
--
-- ВАЖНО: этот файл НЕ трогает существующие политики из 0001/0003 на
-- contest_participants (user_id = auth.uid() и т.п.) — они продолжают
-- действовать как есть на все колонки таблицы, включая новые.
-- Вместо изменения тех политик здесь добавлен triggger-валидатор
-- (defense-in-depth): он проверяет на уровне БД, что привязываемый
-- дневник (a) принадлежит юзеру, который делает INSERT, и (b) публичный —
-- это работает НЕЗАВИСИМО от RLS и защищает даже прямой INSERT мимо
-- contestService.js.

-- ============================================================
-- 1. contest_participants: diary_id + likes_at_start
-- ============================================================

alter table contest_participants
  add column if not exists diary_id uuid references diaries(id) on delete cascade;

alter table contest_participants
  add column if not exists likes_at_start integer not null default 0;

create index if not exists idx_contest_participants_diary_id
  on contest_participants (diary_id);

-- ------------------------------------------------------------
-- Триггер-валидатор: дневник должен быть свой и публичный.
--
-- "Свой" — diaries.grower_id = NEW.user_id (а не auth.uid(): триггер
-- срабатывает для INSERT/UPDATE независимо от того, кто вызывает —
-- обычная защита от рассинхрона, если когда-нибудь появится
-- admin-INSERT от имени юзера).
-- "Публичный" — предполагается колонка diaries.is_private (см. комментарий
-- в mappers.js: "is_private НЕ попадает в возвращаемый объект... фильтрация
-- происходит на уровне запроса"). Если в вашей схеме колонка называется
-- иначе (например is_public с обратной логикой) — поправьте условие ниже
-- перед применением.
-- ------------------------------------------------------------

create or replace function check_contest_participant_diary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grower_id uuid;
  v_is_private boolean;
begin
  if new.diary_id is null then
    return new;
  end if;

  select grower_id, is_private
    into v_grower_id, v_is_private
    from diaries
   where id = new.diary_id;

  if v_grower_id is null then
    raise exception 'contest_participants.diary_id: дневник % не найден', new.diary_id;
  end if;

  if v_grower_id <> new.user_id then
    raise exception 'contest_participants.diary_id: дневник % не принадлежит юзеру %', new.diary_id, new.user_id;
  end if;

  if coalesce(v_is_private, false) then
    raise exception 'contest_participants.diary_id: дневник % приватный, нельзя участвовать в конкурсе', new.diary_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_contest_participant_diary on contest_participants;

create trigger trg_check_contest_participant_diary
  before insert or update of diary_id, user_id on contest_participants
  for each row
  execute function check_contest_participant_diary();

-- Существующие RLS-политики contest_participants (INSERT/SELECT/DELETE,
-- см. 0001/0003) не изменяются этой миграцией.

-- ============================================================
-- 2. contest_winners
-- ============================================================

create table if not exists contest_winners (
  contest_id      uuid primary key references contests(id) on delete cascade,
  winner_user_id  uuid references profiles(id),
  winner_diary_id uuid references diaries(id),
  place           integer not null check (place in (1, 2, 3)),
  announced_at    timestamptz not null default now()
);

alter table contest_winners enable row level security;

-- SELECT: публичный (результаты конкурса видны всем, как и сам конкурс).
drop policy if exists contest_winners_select_public on contest_winners;
create policy contest_winners_select_public
  on contest_winners
  for select
  using (true);

-- INSERT: только админ. Предполагается существующая функция public.is_admin()
-- (используется в проекте для остальных admin-only операций — если у вас
-- она называется иначе, замените имя ниже).
drop policy if exists contest_winners_insert_admin on contest_winners;
create policy contest_winners_insert_admin
  on contest_winners
  for insert
  with check (is_admin());

-- UPDATE: только админ (переигранное объявление победителя / смена места).
drop policy if exists contest_winners_update_admin on contest_winners;
create policy contest_winners_update_admin
  on contest_winners
  for update
  using (is_admin())
  with check (is_admin());

-- DELETE сознательно не даём никому через политику (UPSERT в сервисе делает
-- INSERT ... ON CONFLICT DO UPDATE — DELETE не нужен на этом этапе; если
-- понадобится "снять" победителя, это отдельная миграция).

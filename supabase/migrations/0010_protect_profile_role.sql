-- 0010_protect_profile_role.sql
-- Две дыры в RLS, найденные при работе над Группой 4A:
--   1) profiles: любой залогиненный юзер мог сделать себя админом;
--   2) varieties: любой залогиненный юзер мог вставить сорт от чужого имени.
--
-- ===== 1. profiles: защита role / banned / deleted / id =====
-- Закрывает дыру: политика profiles_update_own_or_admin = (auth.uid() = id OR
-- is_admin()) ограничивает СТРОКИ, но не КОЛОНКИ, поэтому любой залогиненный
-- юзер мог прямым запросом к API выполнить
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', <свой id>)
-- и стать админом (или снять с себя banned / deleted).
--
-- Решение: BEFORE UPDATE-триггер. Менять role / banned / deleted может только
-- админ; id не может менять никто.
--
-- Замечания:
--  * is_admin() — security definer из 0003 (в этом файле я её не видел).
--    Проверка перед применением:
--      select proname, prosecdef from pg_proc where proname = 'is_admin';
--    prosecdef должен быть true. Сама триггерная функция намеренно НЕ
--    security definer: ей не нужны повышенные права, а лишний definer —
--    лишняя поверхность атаки. search_path зафиксирован, is_admin вызывается
--    как public.is_admin() — если она в другой схеме, поправь имя.
--  * Триггер срабатывает только когда role/banned/deleted/id есть в списке
--    SET (BEFORE UPDATE OF ...), поэтому обычные обновления профиля
--    (name/bio/loc/avatar_url/online) его даже не запускают.
--  * Вызовы БЕЗ пользовательского JWT (SQL Editor, service_role, миграции,
--    security-definer-функции, работающие без auth.uid()) не ограничиваются:
--    auth.uid() там null. Анонимный клиент сюда не доходит — его строки
--    отфильтрованы RLS ещё до триггера.
--  * Нарушение → SQLSTATE 42501 (insufficient_privilege), PostgREST отдаёт 403.

begin;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- id профиля не меняет никто (он же id в auth.users)
  if new.id is distinct from old.id then
    raise exception 'Изменение id профиля запрещено'
      using errcode = '42501';
  end if;

  -- Без пользовательского JWT (SQL Editor / service_role / миграции) — пропускаем.
  if auth.uid() is null then
    return new;
  end if;

  if (new.role    is distinct from old.role
      or new.banned  is distinct from old.banned
      or new.deleted is distinct from old.deleted)
     and not public.is_admin() then
    raise exception 'Изменение защищённых полей профиля запрещено'
      using errcode = '42501';
  end if;

  return new;
end
$$;

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before update of id, role, banned, deleted on public.profiles
  for each row
  execute function public.protect_profile_fields();

-- ===== 2. varieties: INSERT только от своего имени =====
-- Было: varieties_insert_authenticated = (auth.uid() IS NOT NULL) — можно
-- вставить сорт с чужим added_by или user_added = false (выдать за "сорт
-- админа").
-- Стало: обычный юзер вставляет только СВОЙ пользовательский сорт
-- (added_by = он сам, user_added = true); админ — любой (в т.ч. added_by =
-- null, user_added = false, как у createVarietyFromAdminForm).
--
-- service_role политики RLS обходит, поэтому для вставок "напрямую из БД /
-- с бэкенда" ничего менять не нужно. Действует только на insert: уже
-- существующие строки не затрагиваются. UPDATE/DELETE-политики не меняются.
drop policy if exists varieties_insert_authenticated on public.varieties;
create policy varieties_insert_authenticated on public.varieties
  for insert to authenticated
  with check (
    (added_by = (select auth.uid()) and user_added = true)
    or public.is_admin()
  );

commit;

-- ===== Проверка (выполнять отдельно, НЕ часть миграции) =====
-- Триггер: под обычным (не админ) юзером ожидается ошибка 42501.
--   begin;
--     set local role authenticated;
--     select set_config('request.jwt.claims',
--       json_build_object('sub', '<UUID_ОБЫЧНОГО_ЮЗЕРА>', 'role', 'authenticated')::text, true);
--     update public.profiles set role = 'admin' where id = '<UUID_ОБЫЧНОГО_ЮЗЕРА>';
--   rollback;
-- Обычное обновление (name/bio/loc/avatar_url/online) при этом проходит.
--
-- Политика varieties: в приложении «добавить свой сорт» должен работать как
-- раньше; прямой запрос с чужим added_by или user_added = false под обычным
-- юзером должен дать "new row violates row-level security policy" (403).

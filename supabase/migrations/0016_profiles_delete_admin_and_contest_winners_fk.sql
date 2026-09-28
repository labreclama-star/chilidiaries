-- 0016: (а) DELETE-политика на profiles для админа,
--       (б) contest_winners_winner_user_id_fkey → ON DELETE CASCADE.
--
-- Причина: жёсткое удаление гровера из админки (AdminUsers.jsx →
-- adminDeleteGrower → DELETE FROM profiles) упиралось в две стены:
--
-- 1) На profiles вообще НЕ было DELETE-политики — только SELECT и
--    UPDATE. RLS без политики молча отфильтровывает все строки, PostgREST
--    возвращает 0 rows без ошибки, а наш клиент воспринимает это как
--    "не найден или нет прав".
--
-- 2) Даже с открытым RLS оставался один FK с NO ACTION —
--    contest_winners_winner_user_id_fkey. Если удаляемый гровер был
--    победителем какого-то конкурса, DELETE падал бы с 23503.
--    Остальные 17 FK на profiles уже CASCADE или SET NULL (проверено
--    SQL-выводом confdeltype).
--
-- Идемпотентно: повторный запуск не сломает.

-- (а) DELETE-политика на profiles — только для админов.
-- is_admin() уже определена в 0001 и используется в других политиках
-- (contests_write_admin_only, lights_write_admin_only, и т.п.).
DROP POLICY IF EXISTS profiles_delete_admin_only ON public.profiles;
CREATE POLICY profiles_delete_admin_only ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- (б) Меняем поведение FK contest_winners_winner_user_id_fkey на CASCADE.
-- При удалении гровера-победителя строка в contest_winners тоже удаляется —
-- конкурс остаётся без объявленного победителя, что логично (победителя
-- больше нет в системе).
ALTER TABLE public.contest_winners
  DROP CONSTRAINT IF EXISTS contest_winners_winner_user_id_fkey;

ALTER TABLE public.contest_winners
  ADD CONSTRAINT contest_winners_winner_user_id_fkey
  FOREIGN KEY (winner_user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;
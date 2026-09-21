-- 0008: атомарное создание дневника вместе со списком сортов.
--
-- Зачем: wizard позволяет выбрать несколько сортов, а в diaries только один
-- variety_id. Основной сорт (первый выбранный) кладём в diaries.variety_id,
-- ВСЕ выбранные — в diary_varieties. Два INSERT'а внутри одной функции
-- выполняются в одной транзакции: если упал второй, откатывается и первый,
-- «дневника без сортов» не остаётся.
--
-- SECURITY INVOKER (а не definer): функция выполняется с правами вызывающего,
-- то есть RLS продолжает работать как обычно —
--   diaries INSERT           -> grower_id = auth.uid()
--   diary_varieties (ALL)    -> через diaries -> owner
-- Никаких дублирующих проверок прав писать не нужно, а обойти политики через
-- эту функцию нельзя. grower_id берём из auth.uid(), а не из параметра, чтобы
-- клиент не мог подставить чужой id.

create or replace function public.create_diary_with_varieties(
  p_title           text,
  p_description     text,
  p_variety_ids     uuid[],
  p_location        text,
  p_medium          text,
  p_stage           text,
  p_shu             numeric,
  p_start_date      date,
  p_cover_photo_url text,
  p_report_interval text
)
returns public.diaries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_diary public.diaries;
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в аккаунт' using errcode = '28000';
  end if;

  if p_variety_ids is null or coalesce(array_length(p_variety_ids, 1), 0) = 0 then
    raise exception 'Нужно выбрать хотя бы один сорт' using errcode = '22023';
  end if;

  insert into diaries (
    title, description, variety_id, grower_id, stage, location, medium,
    techniques, shu, start_date, cover_photo_url, report_interval, is_private
  ) values (
    p_title, p_description, p_variety_ids[1], auth.uid(), p_stage, p_location, p_medium,
    '{}', p_shu, p_start_date, p_cover_photo_url, p_report_interval, false
  )
  returning * into v_diary;

  -- distinct — на случай дублей в массиве (если у diary_varieties есть
  -- уникальный ключ (diary_id, variety_id), дубль уронил бы всю функцию).
  insert into diary_varieties (diary_id, variety_id)
  select v_diary.id, s.v
  from (select distinct unnest(p_variety_ids) as v) s;

  return v_diary;
end;
$$;

revoke all on function public.create_diary_with_varieties(text, text, uuid[], text, text, text, numeric, date, text, text) from public, anon;
grant execute on function public.create_diary_with_varieties(text, text, uuid[], text, text, text, numeric, date, text, text) to authenticated;

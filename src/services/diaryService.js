// Diary service.
//
// Every function here returns { data, error } (см. services/_result.js).
//
// fetchInitialDiaries(growers) СОЗНАТЕЛЬНО не меняет сигнатуру на Этапе 3:
// мок-fallback (data/diaries.js: buildInitialDiaries) жёстко использует
// findVariety() из data/varieties.js (см. риск №10 из отчёта Этапа 1) —
// это отдельная связность, которую не трогаем в рамках "точечных
// изменений" этого этапа. growers нужен ТОЛЬКО для мок-fallback (генерация
// имён авторов комментариев в generateComments) — в Supabase-пути имя
// автора комментария приходит через JOIN на profiles (см. commentRowToJs).
//
// Write-функции (Группа 3): insertDiary, insertWeekReport, updateDiaryStage,
// а также insertComment (Группа 2) — БЕЗ мок-fallback'а: если БД отказала,
// вызывающий получает { data: null, error } и показывает тост.

import { buildInitialDiaries } from '../data/diaries.js';
import { ok, fail } from './_result.js';
import { supabase } from './supabase/client.js';
import { photoUrlForDb } from './_photo.js';
import { diaryRowToJs, diaryListRowToJs, diaryReportRowToJs, commentRowToJs } from './supabase/mappers.js';

// Внутреннее хранилище появляется только после того, как Supabase оказался
// недоступен/пустым и fetchInitialDiaries падает на мок — как и раньше,
// getDiaryById до этого момента не сможет найти дневник в моке (это
// fallback, не отдельная БД).
let _store = null;

// Полный select с вложенными отчётами/фото/комментариями — для getDiaryById.
// Порядок weeks/photos/comments НЕ задаётся через .order() с referencedTable
// (вложение diaries->reports->photos — второго уровня, синтаксис для такой
// глубины в supabase-js документирован ненадёжно), а сортируется в JS —
// см. diaryRowToJs/diaryReportRowToJs в mappers.js.
//
// diary_varieties(variety_id) — все сорта дневника (junction, Группа 3);
// diaries.variety_id остаётся "основным" сортом.
const DIARY_FULL_SELECT = `
  *,
  diary_varieties(variety_id),
  reports:diary_reports(*, photos:diary_photos(*)),
  comments:comments(*, author:profiles!author_id(name))
`;

// Облегчённый select для fetchInitialDiaries (список/карточки каталога):
// DiaryCard.jsx оказался не таким "плоским", как предполагалось изначально —
// он читает diary.comments.length и latestReportDay(diary) (последний
// diary.weeks[].day/.n) — поэтому список тащит МИНИМУМ вложенных данных
// (только day_number и count комментариев), а не только плоские колонки
// diaries. Полные weeks/comments по-прежнему только в getDiaryById.
const DIARY_LIST_SELECT = `
  *,
  diary_varieties(variety_id),
  reports:diary_reports(day_number),
  comments:comments(count)
`;

// ---- мелкие хелперы для write-функций ----

// '' / null / undefined / нечисло -> null; принимает и "22,5" (запятая).
function toNumOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Локальная дата пользователя в виде 'YYYY-MM-DD' (для колонок типа date).
// toISOString() дал бы UTC и около полуночи "вчера/завтра".
function localDateISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Этап 3, Группа C (с правкой после проверки DiaryCard.jsx): сначала
// пробуем Supabase (таблица diaries), при ошибке или пустом ответе —
// падаем на мок (buildInitialDiaries(growers)) с console.warn.
//
// ПОВЕДЕНЧЕСКОЕ РЕШЕНИЕ (согласовано): фильтруем .eq('is_private', false) —
// список для каталога не должен показывать приватные дневники.
export async function fetchInitialDiaries(growers) {
  try {
    const { data, error } = await supabase.from('diaries').select(DIARY_LIST_SELECT).eq('is_private', false);
    if (error) {
      console.warn('[diaryService] Supabase вернул ошибку, использую mock-данные:', error.message);
    } else if (data && data.length > 0) {
      return ok(data.map(diaryListRowToJs));
    } else {
      console.warn('[diaryService] Supabase вернул пустой список дневников, использую mock-данные.');
    }
  } catch (e) {
    console.warn('[diaryService] Не удалось получить дневники из Supabase, использую mock-данные:', e.message);
  }

  try {
    _store = buildInitialDiaries(growers);
    return ok(_store.map((d) => ({ ...d })));
  } catch (e) {
    return fail(e);
  }
}

/**
 * getDiaryById(id) — та же схема fallback'а, что в fetchInitialDiaries.
 * БЕЗ фильтра по is_private (согласовано: пока в UI нет фичи приватности,
 * открытие по прямой ссылке не фильтруем).
 */
export async function getDiaryById(id) {
  try {
    const { data, error } = await supabase
      .from('diaries')
      .select(DIARY_FULL_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn(`[diaryService] Supabase вернул ошибку при получении дневника ${id}, использую mock-данные:`, error.message);
    } else if (data) {
      return ok(diaryRowToJs(data));
    } else {
      console.warn(`[diaryService] Supabase не нашёл дневник ${id}, пробую mock-данные.`);
    }
  } catch (e) {
    console.warn(`[diaryService] Не удалось получить дневник ${id} из Supabase, использую mock-данные:`, e.message);
  }

  try {
    if (!_store) return fail(new Error('Дневники ещё не загружены (fetchInitialDiaries не вызывался)'));
    const found = _store.find((d) => d.id === id);
    return found ? ok({ ...found }) : fail(new Error(`Diary ${id} не найден`));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertComment({ diaryId, authorId, text }) — Этап 3, Группа 2 (write).
 *
 * INSERT в comments. author_id ДОЛЖЕН совпадать с auth.uid() (политика
 * comments_insert_authenticated) — AppContext передаёт currentUser.growerId,
 * а он = id профиля = auth.users.id. Без fallback'а на мок: если БД
 * отказала, вызывающий получает { data: null, error } и показывает тост.
 *
 * .select('*, author:profiles!author_id(name)') — сразу возвращает вставленную
 * строку с именем автора, поэтому commentRowToJs отдаёт ту же форму, что
 * читает Comment.jsx ({ id, author, authorId, text, time }).
 */
export async function insertComment({ diaryId, authorId, text }) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({ diary_id: diaryId, author_id: authorId, text_content: text })
      .select('*, author:profiles!author_id(name)')
      .single();
    if (error) return fail(error);
    return ok(commentRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertDiary({ title, note, varieties, location, medium, startDate,
 *               coverPhoto, reportInterval, stage }) — Этап 3, Группа 3.
 *
 * Создаёт дневник через RPC create_diary_with_varieties (миграция 0008):
 * INSERT в diaries + INSERT в diary_varieties выполняются в ОДНОЙ
 * транзакции. varieties[0] — основной сорт (diaries.variety_id), все
 * выбранные сорта уходят в diary_varieties.
 *
 * grower_id здесь НЕ передаётся: функция берёт его из auth.uid() (иначе
 * клиент мог бы подставить чужой id; RLS его всё равно не пропустил бы).
 *
 * coverPhoto: wizard отдаёт base64 data-URL (FileReader.readAsDataURL) —
 * photoUrlForDb (см. _photo.js) грузит его в Supabase Storage и отдаёт
 * короткий публичный URL. Если загрузка не удалась (например, файл >5 МБ),
 * cover_photo_url будет null — дневник при этом создаётся. Настоящая
 * http(s)-ссылка проходит как есть.
 *
 * Возвращает Diary в той же форме, что getDiaryById (через diaryRowToJs),
 * с пустыми weeks/comments.
 */
export async function insertDiary({ title, note, varieties, location, medium, startDate, coverPhoto, reportInterval, stage }) {
  try {
    const primary = varieties[0];
    const varietyIds = [...new Set(varieties.map((v) => v.id))];
    const shu = (primary.shuMin + primary.shuMax) / 2;

    const { data, error } = await supabase.rpc('create_diary_with_varieties', {
      p_title: title || `Дневник: ${primary.name}`,
      p_description: note || `Новый дневник выращивания ${primary.name} — веду с самого старта.`,
      p_variety_ids: varietyIds,
      p_location: location,
      p_medium: medium,
      p_stage: stage || 'Рассада',
      p_shu: Number.isFinite(shu) ? shu : null,
      p_start_date: startDate || localDateISO(),
      p_cover_photo_url: await photoUrlForDb(coverPhoto, 'diaryService'),
      p_report_interval: reportInterval || 'weekly'
    });
    if (error) return fail(error);

    // Функция возвращает одну строку diaries (composite); на всякий случай
    // принимаем и массив из одного элемента.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return fail(new Error('БД не вернула созданный дневник'));

    return ok(diaryRowToJs({
      ...row,
      // сорта, которые только что записали в diary_varieties — повторный SELECT не нужен
      diary_varieties: varietyIds.map((id) => ({ variety_id: id })),
      reports: [],
      comments: []
    }));
  } catch (e) {
    return fail(e);
  }
}

/**
 * insertWeekReport({ diaryId, title, note, temp, hum, photos, weekNumber, day })
 * — Этап 3, Группа 3.
 *
 * 1) INSERT в diary_reports (.select().single() -> id отчёта).
 *    stage = null — отчёт "наследует" стадию дневника при рендере.
 *    temp/hum: пустое значение -> null. Раньше мок подставлял СЛУЧАЙНЫЕ
 *    температуру/влажность, если поле не заполнено — в БД выдуманные
 *    измерения не пишем.
 * 2) Если есть фото — один batch INSERT в diary_photos (position = индекс).
 *    Через photoUrlForDb: файлы грузятся в Storage (см. _photo.js), в БД
 *    уходят только публичные URL; не загрузившиеся фото пропускаются.
 * 3) Возвращает отчёт через diaryReportRowToJs (photos — массив URL-строк).
 *
 * Если отчёт вставился, а фото — нет: отчёт НЕ откатываем (триггер
 * notify_diary_subscribers уже разослал уведомления, а повторная отправка
 * создала бы дубль report_number). Возвращаем ok(report) + поле warning,
 * которое AppContext показывает вместо "Отчёт опубликован!".
 *
 * Уведомления подписчикам рассылает триггер notify_diary_subscribers() —
 * здесь ничего вручную в notifications не пишем.
 */
export async function insertWeekReport({ diaryId, title, note, temp, hum, photos, weekNumber, day }) {
  try {
    const { data: reportRow, error } = await supabase
      .from('diary_reports')
      .insert({
        diary_id: diaryId,
        report_number: weekNumber,
        day_number: toNumOrNull(day),
        title,
        stage: null,
        note,
        temp_c: toNumOrNull(temp),
        humidity: toNumOrNull(hum),
        report_date: localDateISO()
      })
      .select()
      .single();
    if (error) return fail(error);

    // photoUrlForDb асинхронная (грузит файл в Storage), поэтому map отдаёт
    // массив промисов — ждём их все через Promise.all. Без этого filter(Boolean)
    // пропустил бы сами Promise'ы (они всегда truthy), а в diary_photos.url
    // ушло бы "[object Promise]". Порядок сохраняется → position = индекс.
    const photoList = (Array.isArray(photos) ? photos : []).filter(Boolean); // пустые слоты формы не считаем
    const urls = (await Promise.all(photoList.map((p) => photoUrlForDb(p, 'diaryService')))).filter(Boolean);

    let photoRows = [];
    let warning = null;
    // Часть фото не дошла до Storage (файл >5 МБ, сеть и т.п.) — отчёт всё равно
    // сохраняем, но говорим об этом пользователю (тот же канал warning, что ниже).
    if (urls.length < photoList.length) {
      warning = 'Отчёт опубликован, но не все фото удалось загрузить (максимум 5 МБ на файл)';
    }
    if (urls.length > 0) {
      const { data: inserted, error: photosError } = await supabase
        .from('diary_photos')
        .insert(urls.map((url, position) => ({ diary_report_id: reportRow.id, url, position })))
        .select();
      if (photosError) {
        console.error('[diaryService] Отчёт сохранён, но фото не удалось записать:', photosError.message);
        warning = 'Отчёт опубликован, но фото прикрепить не удалось';
      } else {
        photoRows = inserted || [];
      }
    }

    const result = ok(diaryReportRowToJs({ ...reportRow, photos: photoRows }));
    if (warning) result.warning = warning;
    return result;
  } catch (e) {
    return fail(e);
  }
}

/**
 * updateDiaryStage(diaryId, stage) — Этап 3, Группа 3.
 *
 * UPDATE diaries SET stage. RLS (diaries_update_owner_or_admin) пускает
 * только владельца. ВАЖНО: когда политика отказывает, PostgREST НЕ отдаёт
 * ошибку — UPDATE просто затрагивает 0 строк. Поэтому просим .select() и
 * проверяем, что строка вернулась; иначе считаем это отказом в доступе.
 *
 * Возвращает ok(новая стадия из БД).
 */
export async function updateDiaryStage(diaryId, stage) {
  try {
    const { data, error } = await supabase
      .from('diaries')
      .update({ stage })
      .eq('id', diaryId)
      .select('id, stage')
      .maybeSingle();
    if (error) return fail(error);
    if (!data) return fail(new Error('Не удалось изменить стадию: дневник не найден или нет прав'));
    return ok(data.stage);
  } catch (e) {
    return fail(e);
  }
}

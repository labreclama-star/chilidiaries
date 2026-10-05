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
import { photoUrlForDb, uploadPhoto, TOO_BIG_CODE, MAX_PHOTO_BYTES } from './_photo.js';
import { diaryRowToJs, diaryListRowToJs, diaryReportRowToJs, commentRowToJs } from './supabase/mappers.js';
import { PG_FOREIGN_KEY_VIOLATION } from './_dbError.js';

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
// (только id/day_number отчётов и count комментариев), а не только плоские колонки
// diaries. Полные weeks/comments по-прежнему только в getDiaryById.
const DIARY_LIST_SELECT = `
  *,
  diary_varieties(variety_id),
  reports:diary_reports(id, day_number),
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

// Загружает массив фото в Storage с ограничением параллельности. По умолчанию —
// по 2 фото разом. Причина: 8 одновременных загрузок перегружают канал, часть
// соединений рвётся с ERR_HTTP2_PROTOCOL_ERROR, и фото теряются. Порядок
// результатов сохраняется (position = индекс в diary_photos).
//
// Возвращает массив { url, error, slot } В ТОМ ЖЕ ПОРЯДКЕ, что и photos.
// slot — номер фото в форме (индекс в исходном массиве + 1). Вместо photoUrlForDb
// зовём uploadPhoto напрямую, чтобы не терять причину ошибки (code/sizeBytes
// из _photo.js).
async function uploadPhotosLimited(photos, limit = 2) {
  const results = [];
  for (let i = 0; i < photos.length; i += limit) {
    const batch = photos.slice(i, i + limit);
    const batchResults = await Promise.all(
      batch.map(async (p, j) => {
        const { url, error } = await uploadPhoto(p);
        if (error) {
          console.warn('[diaryService] фото не загружено в Storage, в photo_url не отправляется:', error.message || error);
        }
        return { url, error, slot: i + j + 1 };
      })
    );
    results.push(...batchResults);
  }
  return results;
}

// Лимит на фото в человекочитаемом виде. Берём из _photo.js (MAX_PHOTO_BYTES),
// чтобы текст в toast'е не расходился с реальным лимитом (раньше тут было
// зашито «5 МБ», хотя лимит уже 10 МБ).
const MAX_PHOTO_LABEL = `${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} МБ`;

// Описывает неудачные загрузки (элементы { slot, error }) списком строк.
// Для «слишком большого» фото — точное сообщение с номером и размером,
// для остальных причин — отдельная честная строка.
function describePhotoFailures(failed) {
  return failed.map(({ slot, error }) => {
    if (error && error.code === TOO_BIG_CODE) {
      if (error.sizeBytes) {
        // Округляем вверх до 0.1 МБ, чтобы 10.04 МБ не превратилось в «10.0 МБ» при лимите 10
        const sizeMb = (Math.ceil((error.sizeBytes / 1024 / 1024) * 10) / 10).toFixed(1);
        return `Фото ${slot}: ${sizeMb} МБ, пропущено (лимит ${MAX_PHOTO_LABEL})`;
      }
      return `Фото ${slot}: пропущено (лимит ${MAX_PHOTO_LABEL})`;
    }
    return `Фото ${slot}: не удалось загрузить`;
  });
}

// Текст warning для insertWeekReport (отчёт уже опубликован, часть фото не дошла).
function buildPhotoWarning(failed) {
  return `Отчёт опубликован, но не все фото загружены. ${describePhotoFailures(failed).join('; ')}`;
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
 * короткий публичный URL. Если загрузка не удалась (например, файл >10 МБ),
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
 *    Загрузка идёт ОЧЕРЕДЬЮ по 2 фото (uploadPhotosLimited): при 8+ фото
 *    одновременные соединения рвутся с ERR_HTTP2_PROTOCOL_ERROR.
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

    // photoUrlForDb асинхронная (грузит файл в Storage). Идём через
    // uploadPhotosLimited: по 2 фото за раз, чтобы не перегружать канал
    // (8 одновременных загрузок рвутся с ERR_HTTP2_PROTOCOL_ERROR).
    // Порядок сохраняется → position = индекс.
    const photoList = (Array.isArray(photos) ? photos : []).filter(Boolean); // пустые слоты формы не считаем
    const uploadResults = await uploadPhotosLimited(photoList, 2);
    // position в diary_photos считается ниже по этому списку (0, 1, 2…) — только
    // по успешным загрузкам, поэтому пропущенное фото не оставляет «дыр» в порядке.
    const urls = uploadResults.filter((r) => r.url).map((r) => r.url);

    let photoRows = [];
    let warning = null;
    // Часть фото не дошла до Storage (файл >10 МБ, сеть и т.п.) — отчёт всё равно
    // сохраняем, но говорим об этом пользователю (тот же канал warning, что ниже).
    const failed = uploadResults.filter((r) => !r.url);
    if (failed.length > 0) {
      warning = buildPhotoWarning(failed);
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
 * updateWeekReport(reportId, patch) — правка уже опубликованного отчёта.
 *
 * patch — любые из полей { title, note, temp, hum } (те же имена, что у
 * отчёта в state). Что не передано — не трогается. temp/hum: пустое значение
 * -> null (как в insertWeekReport), "22,5" с запятой тоже принимается.
 * day_number, report_number, фото здесь не меняются.
 *
 * Как и updateDiaryStage: если RLS не пускает (чужой отчёт или нет политики
 * UPDATE на diary_reports), PostgREST не отдаёт ошибку, а затрагивает 0 строк.
 * Поэтому просим .select() и проверяем, что строка вернулась.
 *
 * Возвращает ok({ title, note, temp, hum }) — сохранённые значения из БД
 * в той же форме, что у отчёта в state (AppContext мёржит их в week).
 */
export async function updateWeekReport(reportId, patch = {}) {
  try {
    if (!reportId) return fail(new Error('Не указан отчёт'));
    const update = {};
    if (patch.title !== undefined) {
      const title = String(patch.title ?? '').trim();
      if (!title) return fail(new Error('Заголовок не может быть пустым'));
      update.title = title;
    }
    if (patch.note !== undefined) {
      const note = String(patch.note ?? '').trim();
      if (!note) return fail(new Error('Описание не может быть пустым'));
      update.note = note;
    }
    if (patch.temp !== undefined) update.temp_c = toNumOrNull(patch.temp);
    if (patch.hum !== undefined) update.humidity = toNumOrNull(patch.hum);
    if (Object.keys(update).length === 0) return fail(new Error('Нечего сохранять'));

    const { data, error } = await supabase
      .from('diary_reports')
      .update(update)
      .eq('id', reportId)
      .select('id, title, note, temp_c, humidity')
      .maybeSingle();
    if (error) return fail(error);
    if (!data) return fail(new Error('Не удалось сохранить отчёт: он не найден или нет прав'));
    return ok({ title: data.title, note: data.note, temp: data.temp_c, hum: data.humidity });
  } catch (e) {
    return fail(e);
  }
}

/**
 * deleteReportPhoto(reportId, url) — удаляет ОДНО фото отчёта: строку из
 * diary_photos по паре (diary_report_id, url). Фото в отчёте в state — голые
 * URL-строки (см. diaryPhotoRowToJs), id строки там нет, поэтому ищем по url.
 *
 * Файл в Storage НЕ удаляем: достаточно убрать строку (из отчёта фото
 * пропадёт). Чистка осиротевших файлов — отдельная задача.
 *
 * .select('id') — как у deleteContest: отличаем «удалено» от «RLS молча
 * отфильтровал 0 строк».
 */
export async function deleteReportPhoto(reportId, url) {
  try {
    if (!reportId || !url) return fail(new Error('Не указано фото'));
    const { data, error } = await supabase
      .from('diary_photos')
      .delete()
      .eq('diary_report_id', reportId)
      .eq('url', url)
      .select('id');
    if (error) return fail(error);
    if (!data || data.length === 0) return fail(new Error('Фото не удалено: не найдено или нет прав'));
    return ok({ reportId, url });
  } catch (e) {
    return fail(e);
  }
}

/**
 * addReportPhotos(reportId, files) — добавляет новые фото к УЖЕ опубликованному
 * отчёту.
 *
 * files — массив File/Blob (то, что отдаёт <input type="file" multiple>);
 * пустые элементы отбрасываются.
 *
 * Шаги:
 * 1) Каждый файл идёт через uploadPhoto (HEIC-конвертация, сжатие, ретрай —
 *    всё в _photo.js), по 2 штуки разом (uploadPhotosLimited, как в
 *    insertWeekReport).
 * 2) Узнаём текущий максимум position в diary_photos этого отчёта (SELECT
 *    делаем ПОСЛЕ загрузки, а не до: загрузка идёт долго, и данные успеют
 *    устареть). Новые фото получают max+1, max+2, … Если фото в отчёте ещё
 *    нет — начинаем с 0, как insertWeekReport.
 * 3) Один batch INSERT в diary_photos.
 *
 * Результат:
 *  - ни одно фото не загрузилось → fail(Error) с причиной (AppContext покажет
 *    toast), в БД ничего не пишем;
 *  - загрузилась часть → ok(urls) + поле warning (как у insertWeekReport):
 *    удачные фото добавлены, в warning — какие пропущены и почему;
 *  - все загрузились → ok(urls).
 * Возвращает ok(массив URL) ТОЛЬКО по реально записанным в БД фото, в порядке
 * выбора файлов — AppContext дописывает их в week.photos.
 *
 * Если файлы в Storage загрузились, а INSERT в БД упал — вернётся fail, а файлы
 * останутся в bucket «сиротами» (безвредно; чистка сирот — отдельная задача,
 * как и у deleteReportPhoto).
 */
export async function addReportPhotos(reportId, files) {
  try {
    if (!reportId) return fail(new Error('Не указан отчёт'));
    const fileList = (Array.isArray(files) ? files : Array.from(files || [])).filter(Boolean);
    if (fileList.length === 0) return fail(new Error('Не выбраны фото'));

    // 1) загрузка в Storage (по 2 за раз; порядок результатов = порядок файлов)
    const uploadResults = await uploadPhotosLimited(fileList, 2);
    const urls = uploadResults.filter((r) => r.url).map((r) => r.url);
    const failed = uploadResults.filter((r) => !r.url);

    if (urls.length === 0) {
      return fail(new Error(`Фото не добавлены. ${describePhotoFailures(failed).join('; ')}`));
    }

    // 2) текущий максимум position в этом отчёте
    const { data: posRows, error: posError } = await supabase
      .from('diary_photos')
      .select('position')
      .eq('diary_report_id', reportId);
    if (posError) return fail(posError);
    const maxPos = (posRows || []).reduce((m, r) => {
      const p = Number(r.position);
      return Number.isFinite(p) ? Math.max(m, p) : m;
    }, -1); // -1: фото ещё нет → первое новое получит position 0

    // 3) batch INSERT: max+1, max+2, …
    const { data: inserted, error: insertError } = await supabase
      .from('diary_photos')
      .insert(urls.map((url, i) => ({ diary_report_id: reportId, url, position: maxPos + 1 + i })))
      .select('url');
    if (insertError) return fail(insertError);
    if (!inserted || inserted.length === 0) {
      return fail(new Error('Фото не добавлены: нет прав на запись'));
    }

    const result = ok(urls);
    if (failed.length > 0) {
      result.warning = `Добавлено фото: ${urls.length}. Не все загрузились. ${describePhotoFailures(failed).join('; ')}`;
    }
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

/**
 * updateDiary(id, patch) — Этап 1.5 текущего захода: реальный UPDATE
 * diaries для админки (AdminDiaries.jsx). Поля patch — в тех же
 * camelCase-именах, что возвращает diaryRowToJs (title, desc, stage,
 * location, medium, varietyId, coverPhoto, reportInterval), плюс
 * isPrivate — колонка is_private есть в таблице, но diaryRowToJs её
 * намеренно не возвращает (см. комментарий там), поэтому если форма
 * админки такого поля не показывает — patch.isPrivate просто никогда
 * не придёт, и колонка не тронется.
 *
 * .select(DIARY_FULL_SELECT) — тот же полный select, что у getDiaryById,
 * чтобы adminUpdateDiary в AppContext могла (при желании) заменить
 * состояние дневника целиком, а не только патчем.
 */
export async function updateDiary(id, patch) {
  try {
    const row = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.desc !== undefined) row.description = patch.desc;
    if (patch.stage !== undefined) row.stage = patch.stage;
    if (patch.location !== undefined) row.location = patch.location;
    if (patch.medium !== undefined) row.medium = patch.medium;
    if (patch.varietyId !== undefined) row.variety_id = patch.varietyId;
    if (patch.coverPhoto !== undefined) row.cover_photo_url = await photoUrlForDb(patch.coverPhoto, 'diaryService');
    if (patch.reportInterval !== undefined) row.report_interval = patch.reportInterval;
    if (patch.isPrivate !== undefined) row.is_private = patch.isPrivate;

    const { data, error } = await supabase
      .from('diaries')
      .update(row)
      .eq('id', id)
      .select(DIARY_FULL_SELECT)
      .maybeSingle();
    if (error) return fail(error);
    if (!data) return fail(new Error('Дневник не найден или нет прав'));
    return ok(diaryRowToJs(data));
  } catch (e) {
    return fail(e);
  }
}

/**
 * deleteDiary(id) — Этап 1.5. Не знаем заранее, есть ли в схеме
 * ON DELETE CASCADE на diary_reports/diary_varieties/diary_photos/comments
 * (миграции с их определением не приложены) — defensive-подход, как в
 * questionService.deleteQuestion: пробуем простой DELETE; при FK-нарушении
 * (23503) вручную чистим дочерние таблицы в порядке зависимостей
 * (diary_photos -> diary_reports, затем diary_varieties и comments) и
 * повторяем удаление дневника. Если в схеме уже есть настоящий CASCADE —
 * до этой ветки дело не доходит.
 */
export async function deleteDiary(id) {
  try {
    const { error } = await supabase.from('diaries').delete().eq('id', id);
    if (error) {
      if (error.code === PG_FOREIGN_KEY_VIOLATION) {
        const { data: reports, error: reportsSelectError } = await supabase
          .from('diary_reports')
          .select('id')
          .eq('diary_id', id);
        if (reportsSelectError) return fail(reportsSelectError);
        const reportIds = (reports || []).map((r) => r.id);
        if (reportIds.length) {
          const { error: photosError } = await supabase.from('diary_photos').delete().in('diary_report_id', reportIds);
          if (photosError) return fail(photosError);
          const { error: reportsError } = await supabase.from('diary_reports').delete().eq('diary_id', id);
          if (reportsError) return fail(reportsError);
        }
        const { error: varietiesError } = await supabase.from('diary_varieties').delete().eq('diary_id', id);
        if (varietiesError) return fail(varietiesError);
        const { error: commentsError } = await supabase.from('comments').delete().eq('diary_id', id);
        if (commentsError) return fail(commentsError);
        const { error: retryError } = await supabase.from('diaries').delete().eq('id', id);
        if (retryError) return fail(retryError);
        return ok({ id });
      }
      return fail(error);
    }
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/**
 * deleteWeekReport(reportId) — Этап 1.5. Принимает НАСТОЯЩИЙ id строки
 * diary_reports (не report_number/day) — см. правку diaryReportRowToJs
 * в mappers.js (теперь week-объекты несут id). Тот же defensive-подход:
 * при FK-нарушении на diary_photos сначала удаляем фото, потом отчёт.
 */
export async function deleteWeekReport(reportId) {
  try {
    const { error } = await supabase.from('diary_reports').delete().eq('id', reportId);
    if (error) {
      if (error.code === PG_FOREIGN_KEY_VIOLATION) {
        const { error: photosError } = await supabase.from('diary_photos').delete().eq('diary_report_id', reportId);
        if (photosError) return fail(photosError);
        const { error: retryError } = await supabase.from('diary_reports').delete().eq('id', reportId);
        if (retryError) return fail(retryError);
        return ok({ id: reportId });
      }
      return fail(error);
    }
    return ok({ id: reportId });
  } catch (e) {
    return fail(e);
  }
}

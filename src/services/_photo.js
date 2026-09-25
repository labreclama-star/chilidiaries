// Загрузка фото в Supabase Storage (bucket 'photos').
//
// Раньше фото из форм приходило как base64 data-URL и в БД уходило только
// если это http(s)-ссылка — всё остальное отбрасывалось. Теперь файлы
// реально грузятся в Storage, а в БД (photo_url / avatar_url) кладётся
// короткий публичный URL. Base64 в строки таблиц и в JWT больше не попадает.
//
// Перед загрузкой картинка сжимается в браузере (browser-image-compression):
// до 1600 px по длинной стороне и ~0.5 МБ, формат на выходе — WebP (весит
// на 40-50% меньше JPEG при том же качестве, поддерживается всеми
// современными браузерами; альфа-канал PNG сохраняется). Так экономим
// место и исходящий трафик Supabase, а форма грузится быстрее.
//
// Что умеет принимать uploadPhoto:
//   null / undefined / ''      → { url: null,  error: null }
//   'http(s)://...'            → { url: <как есть>, error: null }  (НЕ сжимаем)
//   File / Blob                → сжимаем, грузим, вернём публичный URL
//   'data:image/...;base64,…'  → конвертируем в Blob, сжимаем, грузим
//   'blob:...' (createObjectURL) → скачиваем Blob, сжимаем, грузим
//   SVG / GIF                  → грузим как есть (см. SKIP_COMPRESS_TYPES)
//   файл < 500 КБ              → грузим как есть, без сжатия (SKIP_COMPRESS_BELOW_BYTES)
//   что-то ещё                 → { url: null, error }
//   файл > 5 МБ                → { url: null, error: 'Файл больше 5 МБ' }
//
// Для отображения (а не загрузки) есть photoDisplayUrl — см. в конце файла.

import { supabase } from './supabase/client.js';

const BUCKET = 'photos';

// Лимит на размер одного фото. Защита бесплатного тарифа Supabase от тяжёлых
// файлов (место + исходящий трафик). Проверка клиентская, поэтому её можно
// обойти запросом напрямую в API — для настоящей защиты задай тот же лимит
// в настройках самого bucket (Storage → photos → Edit bucket → file size limit).
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const TOO_BIG_MESSAGE = 'Файл больше 5 МБ';

// Параметры сжатия перед загрузкой. fileType принудительно 'image/webp':
// весит на 40-50% меньше JPEG при том же качестве (PNG/GIF-без-анимации/
// исходный WebP тоже приводятся к нему); расширение файла в Storage
// (extForMime, см. ниже) берёт .webp автоматически по итоговому MIME.
// initialQuality 0.75 — на глаз незаметно, но вес падает ещё на 15-20%
// сверху экономии от смены формата.
// maxSizeMB — цель, а не гарантия: библиотека снижает качество итерациями,
// начиная с initialQuality, пока не уложится (или не кончатся попытки).
// useWebWorker: сжатие не блокирует интерфейс; если воркер не запустился
// (например, CSP не пускает скрипт с CDN), библиотека сама сжимает в
// основном потоке.
//
// maxSizeMB 0.5, maxWidthOrHeight 1600, useWebWorker true — оставлены как
// были (после диагностики медленной публикации).
// Заметка: воркер библиотека по умолчанию подгружает с CDN jsdelivr — если
// сжатие крупных фото снова станет долгим (тайминг '[photo …] compress'),
// проверь именно его: либо useWebWorker:false, либо положи скрипт библиотеки
// в public/ и укажи его в опции libURL (тогда воркер не зависит от CDN).
const COMPRESS_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  initialQuality: 0.75,
  fileType: 'image/webp',
};

// Файлы меньше этого порога не сжимаем вовсе: сжимать нечего, а библиотека
// тратила на такой файл (~30 КБ) по 5-6 секунд впустую. Грузим как есть.
// Граница строгая: ровно 500 КБ и больше — уже идут в сжатие.
const SKIP_COMPRESS_BELOW_BYTES = 500 * 1024;

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' МБ';

// Эти форматы не сжимаем: у GIF пропала бы анимация, SVG — векторная графика,
// растеризовать её в JPEG незачем. Грузим как есть (лимит 5 МБ действует).
const SKIP_COMPRESS_TYPES = new Set(['image/gif', 'image/svg+xml']);

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/svg+xml': 'svg',
};

// Расширение для имени файла в Storage берём из MIME-типа итогового Blob:
// после сжатия это всегда image/webp → .webp (кроме GIF/SVG — они не
// сжимаются и остаются .gif/.svg, см. SKIP_COMPRESS_TYPES). Исходное имя
// файла в путь больше не попадает (кириллица/пробелы в ключе дают
// "Invalid key"), путь состоит только из времени и случайной строки.
function extForMime(mime) {
  return EXT_BY_MIME[mime] || 'bin';
}

// Сжимает Blob в WebP. Библиотека подключается динамическим import(), чтобы не
// попадать в основной бандл: скачается при первой загрузке фото.
// Если сжатие упало (битый файл, формат, который браузер не умеет декодировать),
// возвращаем исходный Blob и пишем предупреждение — загрузку не блокируем,
// лимит 5 МБ к этому моменту уже проверен по исходнику.
// tag — короткий id вызова: console.time требует уникальную метку, а фото могут
// грузиться параллельно (несколько фото в отчёте).
async function compressBlob(blob, tag) {
  if (SKIP_COMPRESS_TYPES.has(blob.type)) return blob;
  // Маленький файл — отдаём как есть, ДО загрузки библиотеки: не тратим время
  // ни на import(), ни на сжатие. Остаётся только upload.
  if (blob.size < SKIP_COMPRESS_BELOW_BYTES) {
    console.log(`[photo ${tag}] сжатие пропущено: ${mb(blob.size)} < ${mb(SKIP_COMPRESS_BELOW_BYTES)}`);
    return blob;
  }
  try {
    // ВРЕМЕННО: тайминги диагностики (убрать после выяснения причины задержки).
    console.time(`[photo ${tag}] import-lib`); // первая загрузка чанка библиотеки
    let imageCompression;
    try {
      ({ default: imageCompression } = await import('browser-image-compression'));
    } finally {
      console.timeEnd(`[photo ${tag}] import-lib`);
    }
    // Библиотека ждёт File; безымянный Blob (data URL, blob:) оборачиваем.
    const file =
      typeof File !== 'undefined' && blob instanceof File
        ? blob
        : new File([blob], 'photo', { type: blob.type });
    console.time(`[photo ${tag}] compress`);
    let out;
    try {
      out = await imageCompression(file, COMPRESS_OPTIONS);
    } finally {
      console.timeEnd(`[photo ${tag}] compress`);
    }
    console.log(`[photo ${tag}] размер: ${mb(blob.size)} → ${mb(out.size)}`);
    return out;
  } catch (e) {
    console.warn('[_photo] сжатие не удалось, загружаю оригинал:', e?.message || e);
    return blob;
  }
}

// data:[<mime>][;param...][;base64],<данные> → Blob.
// Поддерживаем и base64, и «текстовые» data URL (например, inline-SVG).
function dataUrlToBlob(dataUrl) {
  const m = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('Некорректный data URL');

  const mime = m[1] || 'application/octet-stream';
  const isBase64 = /;base64$/i.test(m[2]);
  const payload = m[3];

  let bytes;
  if (isBase64) {
    const bin = atob(payload.replace(/\s/g, ''));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }
  return new Blob([bytes], { type: mime });
}

// Приводит вход к { blob, name } или бросает Error. Для http(s)/пустых
// значений сюда не попадаем — они обработаны в uploadPhoto раньше.
async function toBlob(input) {
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return { blob: input, name: input.name || '' }; // File наследует Blob
  }
  if (typeof input === 'string') {
    const str = input.trim();
    if (/^data:/i.test(str)) {
      // base64 в ~1.33 раза длиннее исходных байт. Явно огромную строку
      // отсекаем до atob(), точную проверку по blob.size делает uploadPhoto.
      if (str.length > MAX_PHOTO_BYTES * 1.4) throw new Error(TOO_BIG_MESSAGE);
      return { blob: dataUrlToBlob(str), name: '' };
    }
    if (/^blob:/i.test(str)) {
      const res = await fetch(str);
      if (!res.ok) throw new Error('Не удалось прочитать blob-ссылку');
      return { blob: await res.blob(), name: '' };
    }
  }
  throw new Error(
    'Неподдерживаемый формат фото: ожидается http(s)-ссылка, File/Blob, data URL или blob: URL'
  );
}

/**
 * Загружает фото в Storage и возвращает публичный URL.
 * Никогда не бросает исключений — всегда { url, error }.
 * @param {File|Blob|string|null|undefined} input
 * @returns {Promise<{ url: string|null, error: Error|null }>}
 */
export async function uploadPhoto(input) {
  try {
    if (input === null || input === undefined) return { url: null, error: null };

    if (typeof input === 'string') {
      const str = input.trim();
      if (!str) return { url: null, error: null };
      if (/^https?:\/\//i.test(str)) return { url: str, error: null };
    }

    // ВРЕМЕННО: тег и тайминги для диагностики медленной публикации.
    const tag = Math.random().toString(36).slice(2, 6);

    // decode: data URL / blob: → Blob (для data URL — atob + копирование байт)
    console.time(`[photo ${tag}] decode`);
    let original;
    try {
      ({ blob: original } = await toBlob(input));
    } finally {
      console.timeEnd(`[photo ${tag}] decode`);
    }

    // Проверки — по исходнику, ДО сжатия: пустой файл, лимит, тип.
    if (!original.size) throw new Error('Пустой файл');
    if (original.size > MAX_PHOTO_BYTES) throw new Error(TOO_BIG_MESSAGE);
    if (original.type && !original.type.startsWith('image/')) {
      throw new Error('В bucket photos можно загружать только изображения');
    }

    const blob = await compressBlob(original, tag);
    // Страховка: после сжатия файл не должен превышать лимит (на случай,
    // если сжатие не сработало и вернулся оригинал).
    if (blob.size > MAX_PHOTO_BYTES) throw new Error(TOO_BIG_MESSAGE);

    // Уникальный путь: время + случайная строка + расширение по итоговому MIME
    // (после сжатия — .webp).
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${Date.now()}-${rand}.${extForMime(blob.type)}`;

    console.time(`[photo ${tag}] upload`); // ВРЕМЕННО: только сама загрузка в Storage
    let uploadError;
    try {
      ({ error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type || undefined,
        cacheControl: '31536000', // путь уникален, файл не меняется → кэшируем надолго
        upsert: false,
      }));
    } finally {
      console.timeEnd(`[photo ${tag}] upload`);
    }
    if (uploadError) return { url: null, error: uploadError };

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// Обратная совместимость: этим хелпером пользуются recipeService,
// diaryService, varietyService, blogService, growerService, questionService.
// Возвращает URL для photo_url либо null. Если фото было, но загрузить его
// не удалось — предупреждение в консоль (source — имя сервиса), запись при
// этом не блокируем.
//
// ВНИМАНИЕ: функция стала async (загрузка в Storage — сетевой вызов), поэтому
// во всех сервисах вызывать её нужно с await:
//   const photo_url = await photoUrlForDb(input.photo, 'recipeService');
export async function photoUrlForDb(photo, source = 'photo') {
  const { url, error } = await uploadPhoto(photo);
  if (error) {
    console.warn(
      `[${source}] фото не загружено в Storage, в photo_url не отправляется:`,
      error.message || error
    );
    return null;
  }
  return url;
}

// ---------------------------------------------------------------------------
// Отображение: сжатые версии фото через Supabase Image Transformations.
// ---------------------------------------------------------------------------
//
// ВАЖНО: трансформации изображений в Supabase доступны только на тарифе Pro
// и выше (на Free endpoint /render/image/ не работает — <img> будет битым).
// Поэтому функция включается флагом и по умолчанию ВЫКЛЮЧЕНА: пока флага нет,
// photoDisplayUrl возвращает URL как есть, и её безопасно вызывать везде.
//
// Включить (после перехода на Pro и включения Storage → Settings →
// «Enable Image Transformations»): в .env добавить
//   VITE_IMAGE_TRANSFORMS=true
//
// Формат не указываем: Supabase сам отдаёт WebP браузерам, которые его
// поддерживают (по заголовку Accept). Единственное значение параметра format
// — 'origin' (это ОТКЛЮЧАЕТ авто-WebP), поэтому format=webp не подставляем.
// Качество по умолчанию 80 (допустимо 20–100), ширина — целое 1–2500.
// На Pro включено 100 «исходных изображений» в месяц, дальше $5 за 1000.
const TRANSFORMS_ENABLED = (() => {
  try {
    return import.meta.env?.VITE_IMAGE_TRANSFORMS === 'true';
  } catch {
    return false;
  }
})();

const DISPLAY_QUALITY = 80;

// Префиксы считаем от настоящего клиента, а не из env: так не нужно знать имя
// переменной с URL проекта. getPublicUrl('_') → '<URL>/storage/v1/object/public/photos/_'.
let _publicPrefix = null;
function publicPrefix() {
  if (_publicPrefix === null) {
    const probe = supabase.storage.from(BUCKET).getPublicUrl('_').data.publicUrl;
    _publicPrefix = probe.slice(0, -1);
  }
  return _publicPrefix;
}

/**
 * Возвращает URL для отображения фото.
 *  - наш публичный URL из bucket 'photos' → тот же файл через
 *    /render/image/public/ с ?width=<width>&quality=80 (если флаг включён);
 *  - внешний URL, data URL, blob:, null, пустая строка → как есть;
 *  - SVG и GIF → как есть (векторную графику ресайзить незачем, у GIF
 *    пропала бы анимация);
 *  - флаг выключен → как есть.
 * Никогда не бросает исключений.
 * @param {string|null|undefined} storedUrl
 * @param {number} [width=800]
 * @returns {string|null|undefined}
 */
export function photoDisplayUrl(storedUrl, width = 800) {
  try {
    if (!TRANSFORMS_ENABLED) return storedUrl;
    if (typeof storedUrl !== 'string' || !storedUrl) return storedUrl;

    const prefix = publicPrefix();
    if (!storedUrl.startsWith(prefix)) return storedUrl;

    const path = storedUrl.slice(prefix.length);
    if (/\.(svg|gif)(\?|$)/i.test(path)) return storedUrl;

    const w = Math.min(2500, Math.max(1, Math.round(Number(width)) || 800));
    const renderPrefix = prefix.replace('/object/public/', '/render/image/public/');
    return `${renderPrefix}${path.split('?')[0]}?width=${w}&quality=${DISPLAY_QUALITY}`;
  } catch {
    return storedUrl;
  }
}

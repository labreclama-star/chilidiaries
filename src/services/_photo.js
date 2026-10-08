// Загрузка фото в Supabase Storage (bucket 'photos').
//
// Раньше фото из форм приходило как base64 data-URL и в БД уходило только
// если это http(s)-ссылка — всё остальное отбрасывалось. Теперь файлы
// реально грузятся в Storage, а в БД (photo_url / avatar_url) кладётся
// короткий публичный URL. Base64 в строки таблиц и в JWT больше не попадает.
//
// Перед загрузкой картинка сжимается в браузере (browser-image-compression):
// до 1400 px по длинной стороне и ~0.2 МБ. Формат на выходе — WebP там, где
// браузер умеет его кодировать, и JPEG там, где не умеет (Safari/iPhone
// WebP в canvas не кодирует — молча отдаёт огромный PNG, см. canEncodeWebp).
// Так экономим место и исходящий трафик Supabase, а форма грузится быстрее.
//
// Сама загрузка в Storage делается с автоматическим ретраем: до 3 попыток,
// между ними пауза 1 с, затем 2 с (см. UPLOAD_ATTEMPTS). Нужно, потому что
// часть запросов падает с ERR_HTTP2_PROTOCOL_ERROR / Failed to fetch.
//
// Что умеет принимать uploadPhoto:
//   null / undefined / ''      → { url: null,  error: null }
//   'http(s)://...'            → { url: <как есть>, error: null }  (НЕ сжимаем)
//   File / Blob                → сжимаем, грузим, вернём публичный URL
//   'data:image/...;base64,…'  → конвертируем в Blob, сжимаем, грузим
//   'blob:...' (createObjectURL) → скачиваем Blob, сжимаем, грузим
//   SVG / GIF                  → грузим как есть (см. SKIP_COMPRESS_TYPES)
//   файл < 200 КБ              → грузим как есть, без сжатия (SKIP_COMPRESS_BELOW_BYTES)
//   HEIC/HEIF                  → конвертируем в JPEG через heic2any, затем сжимаем; не вышло — как есть + toast
//   что-то ещё                 → { url: null, error }
//   файл > 10 МБ                → { url: null, error: 'Файл больше 10 МБ' }
//                                (у этой ошибки есть доп. поля code='TOO_BIG' и
//                                sizeBytes — размер файла в байтах, см. tooBigError)
//
// Для отображения (а не загрузки) есть photoDisplayUrl — см. в конце файла.

import { supabase } from './supabase/client.js';

const BUCKET = 'photos';

// Лимит на размер одного фото. Защита бесплатного тарифа Supabase от тяжёлых
// файлов (место + исходящий трафик). Проверка клиентская, поэтому её можно
// обойти запросом напрямую в API — для настоящей защиты задай тот же лимит
// в настройках самого bucket (Storage → photos → Edit bucket → file size limit).
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const TOO_BIG_MESSAGE = 'Файл больше 10 МБ';

// Машинная метка ошибки «файл слишком большой». Другие сервисы читают только
// error.message — он остаётся прежним. Кто хочет точнее (например, diaryService),
// проверяет error.code === TOO_BIG_CODE и берёт error.sizeBytes.
export const TOO_BIG_CODE = 'TOO_BIG';

// Собирает ошибку «слишком большой файл»: текст прежний, плюс code и sizeBytes.
// sizeBytes — размер в байтах (для data URL это оценка); null, если размер неизвестен.
function tooBigError(sizeBytes) {
  const err = new Error(TOO_BIG_MESSAGE);
  err.code = TOO_BIG_CODE;
  err.sizeBytes = Number.isFinite(sizeBytes) ? Math.round(sizeBytes) : null;
  return err;
}

// Параметры сжатия перед загрузкой.
// maxSizeMB — цель, а не гарантия: библиотека снижает качество итерациями,
// начиная с initialQuality, пока не уложится (или не кончатся попытки).
// useWebWorker: false — сжимаем в основном потоке. Воркер библиотека грузит с
// CDN jsdelivr, который в РФ бывает недоступен; для одного фото основной поток
// справляется, зато от сети ничего не зависит.
// fileType выбирается в getCompressOptions() по факту: WebP, если браузер умеет
// его кодировать, иначе JPEG.
const TARGET_MB = 0.2;
const MAX_SIDE = 1400;
const LIB_QUALITY = 0.6;
const CANVAS_QUALITY = 0.65; // запасной путь без библиотеки

// Файлы меньше этого порога не сжимаем вовсе: сжимать нечего, а библиотека
// тратила на такой файл (~30 КБ) по 5-6 секунд впустую. Грузим как есть.
// Граница строгая: ровно 200 КБ и больше — уже идут в сжатие.
const SKIP_COMPRESS_BELOW_BYTES = 200 * 1024;

// Ретрай загрузки в Storage. Всего попыток (включая первую) и шаг паузы:
// после неудачи №1 ждём 1 с, после №2 — 2 с (пауза = номер неудачной попытки × шаг).
const UPLOAD_ATTEMPTS = 3;
const UPLOAD_RETRY_STEP_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' МБ';

// Эти форматы не сжимаем: у GIF пропала бы анимация, SVG — векторная графика,
// растеризовать её в JPEG незачем. Грузим как есть (лимит 10 МБ действует).
const SKIP_COMPRESS_TYPES = new Set(['image/gif', 'image/svg+xml']);

const HEIC_MESSAGE =
  'Формат HEIC не сжимается в браузере, загружаем как есть. Сними в JPEG, если хочешь меньше вес';

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'image/svg+xml': 'svg',
};

// Расширение для имени файла в Storage берём из MIME-типа итогового Blob
// (.webp или .jpg после сжатия; GIF/SVG не сжимаются и остаются как есть).
// Исходное имя файла в путь не попадает (кириллица/пробелы в ключе дают
// "Invalid key"), путь состоит только из времени и случайной строки.
function extForMime(mime) {
  return EXT_BY_MIME[mime] || 'bin';
}

// Сообщение для toast'а. Сервисы не имеют доступа к showToast (компоненты ходят
// в сервисы только через useApp), поэтому шлём событие на window, а AppContext
// его слушает и показывает toast.
function reportPhoto(message) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cd:photo-report', { detail: { message } }));
    }
  } catch {
    // toast — это только подсказка, на загрузку он влиять не должен
  }
}

// Умеет ли браузер кодировать WebP в canvas. Safari/iPhone НЕ умеет: на запрос
// toBlob('image/webp') он молча отдаёт PNG (огромный, качество не влияет) —
// вероятная причина «1-2 МБ вместо 0.3». Проверяем один раз и запоминаем.
let _webpOk = null;
function canEncodeWebp() {
  if (_webpOk === null) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      _webpOk = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      _webpOk = false;
    }
  }
  return _webpOk;
}
const outputType = () => (canEncodeWebp() ? 'image/webp' : 'image/jpeg');

function getCompressOptions() {
  return {
    quality: LIB_QUALITY,
    maxWidth: MAX_SIDE,
    maxHeight: MAX_SIDE,
    mimeType: outputType(),
  };
}

// Определяет настоящий формат по первым байтам (а не по blob.type, который
// может врать: библиотека подписывает результат тем fileType, что просили).
async function sniffMime(blob) {
  try {
    const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
      if (brand === 'avif') return 'image/avif';
      return 'image/heic'; // heic, heix, mif1, hevc… — семейство HEIF
    }
  } catch {
    // не смогли прочитать — вернём null
  }
  return null;
}

function isHeic(blob, name, realType) {
  const t = (blob.type || '').toLowerCase();
  return (
    t === 'image/heic' || t === 'image/heif' ||
    /\.(heic|heif)$/i.test(name || '') ||
    realType === 'image/heic'
  );
}

// Сжатие «вручную» через canvas, без библиотеки: нарисовали картинку в canvas
// уменьшенной и сохранили с quality 0.65. Используется как запасной путь для
// HEIC (после конвертации в JPEG через heic2any) и для случаев, когда основная
// библиотека не справилась. Бросает Error, если картинку не удалось декодировать.
async function canvasCompress(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Браузер не смог декодировать изображение'));
      im.src = url;
    });
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error('У изображения нулевой размер');
    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // Белая подложка: JPEG не хранит прозрачность, иначе PNG получит чёрный фон
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const type = outputType();
    const out = await new Promise((resolve) => canvas.toBlob(resolve, type, CANVAS_QUALITY));
    if (!out) throw new Error('canvas.toBlob вернул null');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Приводит тип Blob в соответствие с реальным содержимым (см. sniffMime).
async function withRealType(blob) {
  const real = await sniffMime(blob);
  if (real && real !== blob.type) return new Blob([blob], { type: real });
  return blob;
}

// Сжимает Blob. Возвращает { blob, note }: note — текст для toast'а, если
// случилось что-то, о чём пользователю надо сказать (сейчас — только HEIC).
// Порядок: HEIC → heic2any (JPEG) → canvas; остальное → библиотека, а если она
// упала или не дала выигрыша (>= оригинала) — canvas. Ничего не вышло → оригинал,
// загрузку не блокируем (лимит 10 МБ к этому моменту уже проверен по исходнику).
// Библиотеки подключаются динамическим import(), чтобы не попадать в основной
// бандл: скачаются при первой загрузке фото соответствующего типа.
// tag — короткий id вызова: console.time требует уникальную метку, а фото могут
// грузиться параллельно (несколько фото в отчёте).
async function compressBlob(blob, tag, name, realType) {
  if (SKIP_COMPRESS_TYPES.has(blob.type)) {
    console.log(`[photo ${tag}] сжатие пропущено: тип ${blob.type}`);
    return { blob, note: null };
  }
  // Маленький файл — отдаём как есть, ДО загрузки библиотеки.
  if (blob.size < SKIP_COMPRESS_BELOW_BYTES) {
    console.log(`[photo ${tag}] сжатие пропущено: ${mb(blob.size)} < ${mb(SKIP_COMPRESS_BELOW_BYTES)}`);
    return { blob, note: null };
  }

  // HEIC/HEIF: библиотека его не умеет. Сначала конвертируем в JPEG через
  // heic2any (работает во всех браузерах), затем прогоняем обычный canvas,
  // чтобы уложиться в целевой размер. Не получилось — грузим как есть.
  if (isHeic(blob, name, realType)) {
    console.log(`[photo ${tag}] HEIC — конвертирую через heic2any`);
    try {
      const { default: heic2any } = await import('heic2any');
      const res = await heic2any({ blob, toType: 'image/jpeg', quality: 0.7 });
      const jpegBlob = Array.isArray(res) ? res[0] : res;
      console.log(`[photo ${tag}] HEIC → JPEG: ${mb(blob.size)} → ${mb(jpegBlob.size)}`);
      const out = await withRealType(await canvasCompress(jpegBlob));
      console.log(`[photo ${tag}] HEIC → JPEG → canvas: ${mb(out.size)} (${out.type})`);
      return { blob: out, note: null };
    } catch (e) {
      console.warn(`[photo ${tag}] heic2any упал, пробую canvas напрямую:`, e?.message || e);
      try {
        const out = await withRealType(await canvasCompress(blob));
        console.log(`[photo ${tag}] HEIC через canvas: ${mb(blob.size)} → ${mb(out.size)}`);
        return { blob: out, note: null };
      } catch (e2) {
        console.warn(`[photo ${tag}] HEIC не декодируется, гружу как есть:`, e2?.message || e2);
        return { blob, note: HEIC_MESSAGE };
      }
    }
  }

  // 1) библиотека
  let out = null;
  try {
    // ВРЕМЕННО: тайминги диагностики (убрать после выяснения причины задержки).
    console.time(`[photo ${tag}] import-lib`);
    let Compressor;
    try {
      ({ default: Compressor } = await import('compressorjs'));
    } finally {
      console.timeEnd(`[photo ${tag}] import-lib`);
    }
    // Библиотека ждёт File; безымянный Blob (data URL, blob:) оборачиваем.
    const file =
      typeof File !== 'undefined' && blob instanceof File
        ? blob
        : new File([blob], 'photo', { type: blob.type });
    const opts = getCompressOptions();
    console.log(`[photo ${tag}] библиотека: mimeType=${opts.mimeType}, quality=${opts.quality}, maxSide=${opts.maxWidth}`);
    console.time(`[photo ${tag}] compress`);
    try {
      out = await new Promise((resolve, reject) => {
        // eslint-disable-next-line no-new
        new Compressor(file, {
          quality: opts.quality,
          maxWidth: opts.maxWidth,
          maxHeight: opts.maxHeight,
          mimeType: opts.mimeType,
          strict: false,
          success: resolve,
          error: reject,
        });
      });
    } finally {
      console.timeEnd(`[photo ${tag}] compress`);
    }
    const real = await sniffMime(out);
    console.log(`[photo ${tag}] библиотека вернула: ${mb(out.size)}, заявленный тип ${out.type}, реальный формат ${real || 'не определён'}`);
    out = await withRealType(out);
  } catch (e) {
    console.warn(`[photo ${tag}] библиотека упала:`, e?.message || e);
    out = null;
  }

  // Библиотека «не сработала», если: упала; не уменьшила файл (вернула оригинал);
  // либо отдала PNG из не-PNG (так Safari «кодирует» WebP).
  const srcIsPng = (realType || blob.type) === 'image/png';
  const libFailed = !out || out.size >= blob.size || (out.type === 'image/png' && !srcIsPng);
  if (!libFailed) return { blob: out, note: null };

  // 2) запасной путь: чистый canvas
  console.log(`[photo ${tag}] библиотека не помогла → пробую canvas (quality ${CANVAS_QUALITY})`);
  try {
    const fb = await withRealType(await canvasCompress(blob));
    console.log(`[photo ${tag}] canvas: ${mb(blob.size)} → ${mb(fb.size)} (${fb.type})`);
    if (fb.size < blob.size) return { blob: fb, note: null };
    console.log(`[photo ${tag}] canvas тоже не уменьшил файл — оставляю оригинал`);
  } catch (e) {
    console.warn(`[photo ${tag}] canvas не получился:`, e?.message || e);
  }
  return { blob, note: null };
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
      // Размер здесь оценочный: длина строки × 0.75 (base64 → байты).
      if (str.length > MAX_PHOTO_BYTES * 1.4) throw tooBigError(str.length * 0.75);
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

// Имеет ли смысл повторять загрузку после этой ошибки.
// Сетевые сбои (ERR_HTTP2_PROTOCOL_ERROR, Failed to fetch) приходят без HTTP-статуса
// или с 5xx — их повторяем. Явные ответы сервера 4xx (нет прав, неверный bucket,
// файл слишком большой и т.п.) от повтора не изменятся — не тратим время.
// Исключения: 408 (таймаут) и 429 (лимит запросов) — повторяем.
function isRetryableUploadError(err) {
  const raw = err?.statusCode ?? err?.status;
  const status = Number(raw);
  if (!Number.isFinite(status) || status === 0) return true; // сети нет / обрыв
  if (status === 408 || status === 429) return true;
  return status >= 500;
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
    let origName = '';
    try {
      ({ blob: original, name: origName } = await toBlob(input));
    } finally {
      console.timeEnd(`[photo ${tag}] decode`);
    }

    // Проверки — по исходнику, ДО сжатия: пустой файл, лимит, тип.
    if (!original.size) throw new Error('Пустой файл');
    if (original.size > MAX_PHOTO_BYTES) throw tooBigError(original.size);
    if (original.type && !original.type.startsWith('image/')) {
      throw new Error('В bucket photos можно загружать только изображения');
    }

    // ДИАГНОСТИКА: что за файл пришёл
    const realType = await sniffMime(original);
    console.log(`[photo ${tag}] вход: имя="${origName || '(нет)'}", type="${original.type || '(пусто)'}", реальный формат=${realType || 'не определён'}, размер=${mb(original.size)}`);

    const { blob, note } = await compressBlob(original, tag, origName, realType);
    console.log(`[photo ${tag}] после сжатия: ${blob === original ? 'ОРИГИНАЛ (сжатие не сработало или не нужно)' : 'сжато'}, ${mb(original.size)} → ${mb(blob.size)}, type=${blob.type}`);
    // Страховка: после сжатия файл не должен превышать лимит (на случай,
    // если сжатие не сработало и вернулся оригинал). Размер берём исходный —
    // именно его пользователь видит у себя на диске.
    if (blob.size > MAX_PHOTO_BYTES) throw tooBigError(original.size);

    // Загрузка в Storage с ретраем (до UPLOAD_ATTEMPTS попыток).
    // Путь уникален: время + случайная строка + расширение по итоговому MIME
    // (после сжатия — .webp). На КАЖДОЙ попытке путь новый: при обрыве HTTP/2
    // файл мог на самом деле долететь до сервера, и повтор в тот же путь
    // (upsert: false) упал бы с «already exists». Цена — возможный «сирота»
    // в bucket от неудавшейся попытки (редко и безвредно).
    let path = '';
    let uploadError = null;
    for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
      const rand = Math.random().toString(36).slice(2, 10);
      path = `${Date.now()}-${rand}.${extForMime(blob.type)}`;

      console.time(`[photo ${tag}] upload #${attempt}`); // ВРЕМЕННО: только сама загрузка в Storage
      try {
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
          contentType: blob.type || undefined,
          cacheControl: '31536000', // путь уникален, файл не меняется → кэшируем надолго
          upsert: false,
        });
        uploadError = error || null;
      } catch (e) {
        // supabase-js обычно возвращает ошибку, но на сетевом сбое может и бросить
        uploadError = e instanceof Error ? e : new Error(String(e));
      } finally {
        console.timeEnd(`[photo ${tag}] upload #${attempt}`);
      }

      if (!uploadError) break; // успех

      const isLast = attempt === UPLOAD_ATTEMPTS;
      if (isLast || !isRetryableUploadError(uploadError)) {
        console.warn(`[photo ${tag}] upload не удался (попытка ${attempt}/${UPLOAD_ATTEMPTS}): ${uploadError.message || uploadError}`);
        break; // вернём ошибку как раньше
      }

      // Пауза с нарастанием: 1 с после 1-й неудачи, 2 с после 2-й
      const delayMs = attempt * UPLOAD_RETRY_STEP_MS;
      console.log(`[photo ${tag}] upload попытка ${attempt + 1}/${UPLOAD_ATTEMPTS} после ошибки: ${uploadError.message || uploadError} (пауза ${delayMs} мс)`);
      await sleep(delayMs);
    }
    if (uploadError) return { url: null, error: uploadError };

    // ДИАГНОСТИКА + toast: сколько реально ушло в Storage
    console.log(`[photo ${tag}] ушло в Storage: ${path}, ${mb(blob.size)}`);
    if (note) reportPhoto(note);
    else if (blob === original) reportPhoto(`Фото: ${mb(original.size)} (без сжатия)`);
    else reportPhoto(`Фото: ${mb(original.size)} → ${mb(blob.size)}`);

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

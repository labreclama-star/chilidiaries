import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import Spinner from './Spinner.jsx';
import { suggestNextReportDay, intervalLabel } from '../utils/helpers.js';
import { MAX_PHOTO_BYTES } from '../services/_photo.js';

// Задача 5: не даём набрать больше 10 фото на один отчёт.
const MAX_REPORT_PHOTOS = 10;

// Качество JPEG при конвертации HEIC для превью (как в _photo.js).
const HEIC_PREVIEW_QUALITY = 0.7;

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' МБ';

// HEIC/HEIF определяем по MIME-типу или по расширению: на части систем
// браузер отдаёт пустой type для .heic, поэтому одного type мало.
function isHeicFile(file) {
  const t = (file.type || '').toLowerCase();
  return t === 'image/heic' || t === 'image/heif' || /\.(heic|heif)$/i.test(file.name || '');
}

// File/Blob → data-URL (Promise-обёртка над FileReader).
function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(blob);
  });
}

// HEIC → JPEG через heic2any. Библиотека тяжёлая, поэтому подключаем
// динамическим import() — она скачивается только при выборе HEIC-фото.
async function heicToJpegBlob(file) {
  const { default: heic2any } = await import('heic2any');
  const res = await heic2any({ blob: file, toType: 'image/jpeg', quality: HEIC_PREVIEW_QUALITY });
  return Array.isArray(res) ? res[0] : res;
}

// Поворот картинки на 90° по часовой через canvas. Принимает data-URL, возвращает новый data-URL.
// Сразу уменьшаем до ROTATE_MAX_SIDE по длинной стороне: _photo.js всё равно сожмёт фото
// до 1400 px, а так повёрнутый файл не раздувается и не упирается в лимит 10 МБ.
// JPEG, а не WebP: Safari не умеет кодировать WebP в canvas.
const ROTATE_MAX_SIDE = 1600;
const ROTATE_QUALITY = 0.88;

function rotateDataUrl90(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth;
      const h0 = img.naturalHeight;
      if (!w0 || !h0) { reject(new Error('У изображения нулевой размер')); return; }
      const scale = Math.min(1, ROTATE_MAX_SIDE / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * scale));
      const h = Math.max(1, Math.round(h0 * scale));
      // После поворота ширина и высота меняются местами
      const canvas = document.createElement('canvas');
      canvas.width = h;
      canvas.height = w;
      const ctx = canvas.getContext('2d');
      // Белая подложка: JPEG не хранит прозрачность
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL('image/jpeg', ROTATE_QUALITY));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Браузер не смог декодировать изображение'));
    img.src = src;
  });
}

export default function AddWeekReportForm({ diary }) {
  const { addWeekReport, showToast } = useApp();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [temp, setTemp] = useState('');
  const [hum, setHum] = useState('');
  const [photos, setPhotos] = useState([]);
  const [day, setDay] = useState(() => suggestNextReportDay(diary));
  const [submitting, setSubmitting] = useState(false);
  // Сколько фото сейчас обрабатывается (чтение / конвертация HEIC).
  // Счётчик в state — чтобы блокировать кнопки; в ref — чтобы лимит
  // считался по актуальному значению, а не по значению из прошлого рендера.
  const [processing, setProcessing] = useState(0);
  const pendingRef = useRef(0);

  const photosMaxed = photos.length >= MAX_REPORT_PHOTOS;
  const busy = processing > 0;

  function changePending(delta) {
    pendingRef.current += delta;
    setProcessing(pendingRef.current);
  }

  async function handlePhotosChange(e) {
    const files = Array.from(e.target.files || []);
    // Сбрасываем input сразу: files уже скопированы в массив.
    e.target.value = '';
    if (!files.length) return;

    // В лимит входят и фото, которые ещё обрабатываются.
    const remaining = MAX_REPORT_PHOTOS - photos.length - pendingRef.current;
    if (remaining <= 0) {
      showToast(`Максимум ${MAX_REPORT_PHOTOS} фото на один отчёт`);
      return;
    }

    // Номер N в сообщениях — порядковый номер файла среди выбранных (с 1).
    const candidates = files.slice(0, remaining).map((file, idx) => ({ file, n: idx + 1 }));
    const messages = [];
    if (files.length > remaining) {
      messages.push(`Максимум ${MAX_REPORT_PHOTOS} фото на один отчёт`);
    }

    // Проверка лимита размера — по ОРИГИНАЛУ с диска, ДО любой конвертации.
    const accepted = [];
    for (const item of candidates) {
      if (item.file.size > MAX_PHOTO_BYTES) {
        messages.push(`Фото ${item.n}: ${mb(item.file.size)}, пропущено (лимит ${MAX_PHOTO_BYTES / 1024 / 1024} МБ)`);
      } else {
        accepted.push(item);
      }
    }

    // Резервируем места под принятые файлы сразу, чтобы повторный выбор
    // во время конвертации не обошёл лимит.
    changePending(accepted.length);

    // Обрабатываем по одному: порядок превью совпадает с порядком выбора,
    // а heic2any не грузит память несколькими фото разом.
    for (const { file, n } of accepted) {
      try {
        let src;
        if (isHeicFile(file)) {
          try {
            src = await readAsDataUrl(await heicToJpegBlob(file));
          } catch (err) {
            // Конвертация не удалась: кладём оригинал. Превью будет битым,
            // но _photo.js при публикации попробует свой запасной путь.
            console.warn(`[AddWeekReportForm] heic2any не смог обработать фото ${n}:`, err?.message || err);
            src = await readAsDataUrl(file);
            messages.push(`Фото ${n}: не удалось показать превью HEIC, но фото всё равно загрузится`);
          }
        } else {
          src = await readAsDataUrl(file);
        }
        setPhotos((prev) => [...prev, src]);
      } catch (err) {
        console.warn(`[AddWeekReportForm] не удалось прочитать фото ${n}:`, err?.message || err);
        messages.push(`Фото ${n}: не удалось прочитать файл, пропущено`);
      } finally {
        changePending(-1);
      }
    }

    // Одно общее сообщение: showToast показывает один toast за раз,
    // отдельные вызовы затирали бы друг друга.
    if (messages.length) showToast(messages.join('. '));
  }

  // Поворачивает превью на 90° по часовой и заменяет его в photos[]. Ищем фото по самой
  // строке, а не по индексу: пока идёт поворот, список мог измениться (удалили другое фото).
  async function rotatePhoto(oldSrc) {
    if (/^data:image\/(gif|svg)/i.test(oldSrc)) {
      showToast('GIF и SVG повернуть нельзя');
      return;
    }
    changePending(1);
    try {
      const newSrc = await rotateDataUrl90(oldSrc);
      let replaced = false;
      setPhotos((prev) => prev.map((s) => {
        if (!replaced && s === oldSrc) { replaced = true; return newSrc; }
        return s;
      }));
    } catch (err) {
      console.warn('[AddWeekReportForm] не удалось повернуть фото:', err?.message || err);
      showToast('Не удалось повернуть фото');
    } finally {
      changePending(-1);
    }
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (busy) return; // фото ещё обрабатываются — рано публиковать
    if (!title.trim() || !note.trim()) {
      showToast('Заполни заголовок и описание отчёта');
      return;
    }
    const dayNum = parseInt(day, 10) || suggestNextReportDay(diary);
    setSubmitting(true);
    try {
      await addWeekReport(diary.id, { title: title.trim(), note: note.trim(), temp, hum, photos, day: dayNum });
      setTitle(''); setNote(''); setTemp(''); setHum(''); setPhotos([]);
      setDay(dayNum + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="side-card" style={{ marginBottom: 28 }}>
      <h4>Добавить отчёт</h4>
      <p style={{ fontSize: 12, color: 'var(--cream-faint)', marginTop: -6, marginBottom: 14 }}>
        Интервал дневника: {intervalLabel(diary.reportInterval)} — но день отчёта всегда можно поправить вручную.
      </p>
      <div className="field"><label>День от старта</label><input type="number" min="1" value={day} onChange={(e) => setDay(e.target.value)} /></div>
      <div className="field"><label>Заголовок</label><input type="text" placeholder="Например: Стручки набирают цвет" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label>Описание</label><textarea rows="3" placeholder="Что произошло с последнего отчёта?" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div className="field-row">
        <div className="field"><label>Температура, °C</label><input type="number" step="0.1" placeholder="26" value={temp} onChange={(e) => setTemp(e.target.value)} /></div>
        <div className="field"><label>Влажность, %</label><input type="number" placeholder="60" value={hum} onChange={(e) => setHum(e.target.value)} /></div>
      </div>
      <div className="field">
        <label>Фото (можно несколько, максимум {MAX_REPORT_PHOTOS})</label>
        <input type="file" accept="image/*" multiple disabled={photosMaxed || busy} onChange={handlePhotosChange} />
        {busy && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11.5, color: 'var(--cream-faint)' }}>
            <Spinner size={12} /> Обрабатываю фото…
          </span>
        )}
        {photosMaxed && (
          <span style={{ display: 'block', marginTop: 6, fontSize: 11.5, color: 'var(--cream-faint)' }}>
            Достигнут лимит в {MAX_REPORT_PHOTOS} фото — удали часть, чтобы добавить другие.
          </span>
        )}
      </div>
      {photos.length > 0 && (
        <div className="week-thumb-row" style={{ marginBottom: 12 }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={src} alt="" />
              <button type="button" className="thumb-remove-btn" onClick={() => removePhoto(i)} aria-label="Удалить фото">&times;</button>
              {/* Поворот на 90° по часовой; стили кнопки берём у крестика, но ставим её слева */}
              <button
                type="button"
                className="thumb-remove-btn"
                style={{ right: 'auto', left: -6, background: 'var(--habanero)', border: 'none', cursor: 'pointer' }}
                onClick={() => rotatePhoto(src)}
                disabled={busy}
                aria-label="Повернуть фото на 90°"
                title="Повернуть на 90°"
              >&#8635;</button>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-primary btn-block" disabled={submitting || busy} onClick={handleSubmit}>
        {submitting ? (<><Spinner size={14} /> Публикую…</>) : 'Опубликовать отчёт'}
      </button>
    </div>
  );
}

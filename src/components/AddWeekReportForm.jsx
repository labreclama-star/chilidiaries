import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import Spinner from './Spinner.jsx';
import { suggestNextReportDay, intervalLabel } from '../utils/helpers.js';

// Задача 5: не даём набрать больше 10 фото на один отчёт.
const MAX_REPORT_PHOTOS = 10;

export default function AddWeekReportForm({ diary }) {
  const { addWeekReport, showToast } = useApp();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [temp, setTemp] = useState('');
  const [hum, setHum] = useState('');
  const [photos, setPhotos] = useState([]);
  const [day, setDay] = useState(() => suggestNextReportDay(diary));
  const [submitting, setSubmitting] = useState(false);

  const photosMaxed = photos.length >= MAX_REPORT_PHOTOS;

  function handlePhotosChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (photosMaxed) {
      showToast(`Максимум ${MAX_REPORT_PHOTOS} фото на один отчёт`);
      e.target.value = '';
      return;
    }

    const remaining = MAX_REPORT_PHOTOS - photos.length;
    const allowed = files.slice(0, remaining);
    if (files.length > remaining) {
      showToast(`Максимум ${MAX_REPORT_PHOTOS} фото на один отчёт`);
    }

    allowed.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotos((prev) => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
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
        <input type="file" accept="image/*" multiple disabled={photosMaxed} onChange={handlePhotosChange} />
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
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-primary btn-block" disabled={submitting} onClick={handleSubmit}>
        {submitting ? (<><Spinner size={14} /> Публикую…</>) : 'Опубликовать отчёт'}
      </button>
    </div>
  );
}

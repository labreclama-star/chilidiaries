import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { suggestNextReportDay, intervalLabel } from '../utils/helpers.js';

export default function AddWeekReportForm({ diary }) {
  const { addWeekReport, showToast } = useApp();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [temp, setTemp] = useState('');
  const [hum, setHum] = useState('');
  const [photos, setPhotos] = useState([]);
  const [day, setDay] = useState(() => suggestNextReportDay(diary));

  function handlePhotosChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotos((prev) => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!title.trim() || !note.trim()) {
      showToast('Заполни заголовок и описание отчёта');
      return;
    }
    const dayNum = parseInt(day, 10) || suggestNextReportDay(diary);
    addWeekReport(diary.id, { title: title.trim(), note: note.trim(), temp, hum, photos, day: dayNum });
    setTitle(''); setNote(''); setTemp(''); setHum(''); setPhotos([]);
    setDay(dayNum + 1);
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
      <div className="field"><label>Фото (можно несколько)</label><input type="file" accept="image/*" multiple onChange={handlePhotosChange} /></div>
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
      <button className="btn btn-primary btn-block" onClick={handleSubmit}>Опубликовать отчёт</button>
    </div>
  );
}

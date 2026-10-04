import { useState } from 'react';
import PepperIcon from './PepperIcon.jsx';
import PhotoFrame from './PhotoFrame.jsx';
import Lightbox from './Lightbox.jsx';
import Spinner from './Spinner.jsx';
import { useApp } from '../context/AppContext.jsx';
import { stageColorMap } from '../utils/helpers.js';

// diaryId и canEdit приходят из DiaryDetail: canEdit = текущий пользователь — автор дневника.
// Без них (или без week.id) карточка отчёта выглядит и работает как раньше, без кнопок правки.
export default function WeekItem({ week, diaryColor, diaryId, canEdit }) {
  const { updateWeekReport, deleteWeekReport, deleteReportPhoto, showToast } = useApp();
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', note: '', temp: '', hum: '' });
  const [busy, setBusy] = useState(false);

  const wc = (stageColorMap[week.stage] ?? diaryColor) || diaryColor;
  const photos = week.photos && week.photos.length ? week.photos : (week.photo ? [week.photo] : []);
  const cover = photos[0] || null;
  const editable = !!(canEdit && diaryId && week.id);

  function startEdit() {
    setForm({
      title: week.title ?? '',
      note: week.note ?? '',
      temp: week.temp ?? '',
      hum: week.hum ?? ''
    });
    setEditing(true);
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.note.trim()) {
      showToast('Заполни заголовок и описание отчёта');
      return;
    }
    setBusy(true);
    try {
      const res = await updateWeekReport(diaryId, week.id, {
        title: form.title,
        note: form.note,
        temp: form.temp,
        hum: form.hum
      });
      if (res && res.ok) setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteReport() {
    if (!window.confirm(`Удалить отчёт «${week.title}» целиком вместе с фото? Это нельзя отменить.`)) return;
    setBusy(true);
    try {
      await deleteWeekReport(diaryId, week.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePhoto(src) {
    if (!window.confirm('Удалить это фото из отчёта?')) return;
    setBusy(true);
    try {
      await deleteReportPhoto(diaryId, week.id, src);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="week-item" id={`report-day-${week.day || week.n}`}>
      <span className="week-date">День {week.day || week.n} · {week.date}</span>

      {editing ? (
        <div className="field" style={{ marginTop: 8 }}>
          <label>Заголовок</label>
          <input type="text" value={form.title} onChange={(e) => setField('title', e.target.value)} />
        </div>
      ) : (
        <h4>{week.title}</h4>
      )}

      <div
        className="week-photo-main"
        style={!cover ? { background: `radial-gradient(circle at 30% 20%,${wc}40,var(--soil-900) 75%)` } : undefined}
        onClick={() => cover && setLightboxIndex(0)}
      >
        <PhotoFrame src={cover} />
        {!cover && <PepperIcon color={wc} />}
        {photos.length > 1 && <span className="photo-count-badge">1 / {photos.length}</span>}
      </div>

      {/* В режиме правки миниатюры показываем даже для одного фото — иначе его нечем удалить.
          Крестики на фото только в режиме правки: так их не нажмёшь случайно при просмотре. */}
      {(photos.length > 1 || (editing && photos.length > 0)) && (
        <div className="week-thumb-row">
          {photos.map((src, i) => (
            editing ? (
              <div key={src + i} style={{ position: 'relative' }}>
                <img src={src} alt="" onClick={() => setLightboxIndex(i)} />
                <button
                  type="button"
                  className="thumb-remove-btn"
                  onClick={() => handleDeletePhoto(src)}
                  disabled={busy}
                  aria-label="Удалить фото"
                >&times;</button>
              </div>
            ) : (
              <img key={i} src={src} alt="" onClick={() => setLightboxIndex(i)} />
            )
          ))}
        </div>
      )}

      {editing ? (
        <>
          <div className="field-row">
            <div className="field"><label>Температура, °C</label><input type="number" step="0.1" value={form.temp} onChange={(e) => setField('temp', e.target.value)} /></div>
            <div className="field"><label>Влажность, %</label><input type="number" value={form.hum} onChange={(e) => setField('hum', e.target.value)} /></div>
          </div>
          <div className="field">
            <label>Описание</label>
            <textarea rows="4" value={form.note} onChange={(e) => setField('note', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={busy}>
              {busy ? (<><Spinner size={14} /> Сохраняю…</>) : 'Сохранить'}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)} disabled={busy}>Отмена</button>
          </div>
        </>
      ) : (
        <>
          {/* ?? '—': после правки температуру/влажность можно очистить, тогда в БД null */}
          <div className="week-stats"><span>🌡 {week.temp ?? '—'}°C</span><span>💧 {week.hum ?? '—'}%</span></div>
          <p>{week.note}</p>
          {editable && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={startEdit} disabled={busy}>✎ Редактировать</button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--ember)', borderColor: 'var(--ember)' }}
                onClick={handleDeleteReport}
                disabled={busy}
              >
                {busy ? (<><Spinner size={14} /> Удаляю…</>) : 'Удалить'}
              </button>
            </div>
          )}
        </>
      )}

      {lightboxIndex != null && (
        <Lightbox photos={photos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import { useApp } from '../context/AppContext.jsx';
import { REPORT_INTERVALS } from '../utils/helpers.js';

// Списки скопированы из CreateDiaryWizard.jsx (там они зашиты в <option>).
// Значения должны совпадать с теми, что пишет визард при создании дневника.
const MEDIUMS = ['Почва', 'Кокос', 'Гидропоника'];
const LOCATIONS = ['Дома', 'Теплица', 'Открытый грунт'];

// Если у дневника значение, которого нет в списке (например, правили через
// админку), добавляем его в options, чтобы select не подменил его молча.
function withCurrent(list, current) {
  return current && !list.includes(current) ? [current, ...list] : list;
}

export default function EditDiaryModal() {
  const { activeModal, modalPayload, closeModal, diaries, currentUser, updateDiary, showToast } = useApp();
  const isOpen = activeModal === 'editDiary';
  const diaryId = modalPayload && modalPayload.diaryId;
  const d = isOpen ? diaries.find((x) => x.id === diaryId) : null;

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [medium, setMedium] = useState('');
  const [location, setLocation] = useState('');
  const [reportInterval, setReportInterval] = useState('weekly');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !d) return;
    setTitle(d.title || '');
    setDesc(d.desc || '');
    setMedium(d.medium || MEDIUMS[0]);
    setLocation(d.location || LOCATIONS[0]);
    setReportInterval(d.reportInterval || 'weekly');
    setCoverFile(null);
    setFileKey((k) => k + 1);
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, diaryId]);

  useEffect(() => {
    if (!coverFile) { setCoverPreview(null); return undefined; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  if (!d) return null;

  const isOwner = !!(currentUser && currentUser.growerId === d.growerId);
  if (!isOwner) return null;

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    setCoverFile(file || null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) { showToast('Введи название дневника'); return; }

    const patch = {
      title: cleanTitle,
      desc: desc.trim(),
      medium,
      location,
      reportInterval
    };
    if (coverFile) patch.coverPhoto = coverFile;

    setSubmitting(true);
    try {
      const res = await updateDiary(d.id, patch);
      if (res && res.ok) closeModal();
    } finally {
      setSubmitting(false);
    }
  }

  const shownCover = coverPreview || d.coverPhoto || null;

  return (
    <Modal isOpen={isOpen} onClose={closeModal} wide>
      <h2>Редактировать дневник</h2>
      <p className="sub">Изменения сразу появятся на странице дневника.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Название дневника</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Описание</label>
          <textarea rows="3" placeholder="О чём этот дневник, какие цели…" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="field">
          <label>Обложка</label>
          {shownCover && (
            <div style={{ marginBottom: 10 }}>
              <img
                src={shownCover}
                alt=""
                style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '12px 4px 12px 4px' }}
              />
            </div>
          )}
          <input key={fileKey} type="file" accept="image/*" onChange={handleFileChange} />
          {coverFile && (
            <p style={{ fontSize: 12, color: 'var(--cream-faint)', marginTop: 6 }}>
              Новая обложка заменит текущую после сохранения.
            </p>
          )}
        </div>

        <div className="field-row">
          <div className="field">
            <label>Среда</label>
            <select value={medium} onChange={(e) => setMedium(e.target.value)}>
              {withCurrent(MEDIUMS, d.medium).map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Место</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              {withCurrent(LOCATIONS, d.location).map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Интервал отчётов</label>
          <select value={reportInterval} onChange={(e) => setReportInterval(e.target.value)}>
            {REPORT_INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={closeModal} disabled={submitting}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
            {submitting ? (<><Spinner size={14} /> Сохраняю…</>) : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
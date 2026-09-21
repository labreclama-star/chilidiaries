import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Modal from './Modal.jsx';
import { useApp } from '../context/AppContext.jsx';
import { QUESTION_STAGES, QUESTION_TOPICS } from '../utils/helpers.js';

const TEXT_LIMIT = 280;
const emptyForm = () => ({ text: '', photo: null, diaryId: '', stage: '', topic: '' });

export default function AskQuestionModal() {
  const navigate = useNavigate();
  const { activeModal, closeModal, currentUser, openModal, diaries, addQuestion, showToast } = useApp();
  const [form, setForm] = useState(emptyForm);

  const isOpen = activeModal === 'askQuestion';
  const myDiaries = currentUser ? diaries.filter((d) => d.growerId === currentUser.growerId) : [];

  function field(key) {
    return { value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) };
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, photo: ev.target.result }));
    reader.readAsDataURL(file);
  }

  function handleClose() {
    setForm(emptyForm());
    closeModal();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
      closeModal();
      openModal('auth');
      return;
    }
    const text = form.text.trim();
    if (!text) {
      showToast('Опиши проблему хотя бы в паре слов');
      return;
    }
    const q = await addQuestion({
      text,
      photo: form.photo,
      diaryId: form.diaryId || null,
      stage: form.stage || null,
      topic: form.topic || null
    });
    setForm(emptyForm());
    closeModal();
    if (q) navigate(`/questions/${q.id}`);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} wide>
      <h2>Задать вопрос</h2>
      <p className="sub">Опиши проблему коротко и добавь фото — так сообществу проще понять, что происходит с растением.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Описание проблемы ({form.text.length}/{TEXT_LIMIT})</label>
          <textarea
            rows="4"
            maxLength={TEXT_LIMIT}
            placeholder="Например: нижние листья желтеют и опадают, верхушка растёт нормально…"
            required
            {...field('text')}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Дневник (необязательно)</label>
            <select {...field('diaryId')}>
              <option value="">Без дневника</option>
              {myDiaries.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Стадия (необязательно)</label>
            <select {...field('stage')}>
              <option value="">— не выбрана —</option>
              {QUESTION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Тема (необязательно)</label>
          <select {...field('topic')}>
            <option value="">— не выбрана —</option>
            {QUESTION_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label>Фото (необязательно)</label><input type="file" accept="image/*" onChange={handlePhotoChange} /></div>
        {form.photo && (
          <div style={{ marginBottom: 14 }}>
            <img src={form.photo} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '12px 4px 12px 4px' }} />
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-block">Опубликовать вопрос</button>
      </form>
    </Modal>
  );
}

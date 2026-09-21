import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Modal from './Modal.jsx';
import { useApp } from '../context/AppContext.jsx';

const emptyForm = () => ({ title: '', varietyId: '', tags: '', content: '', photo: null });

export default function WriteArticleModal() {
  const navigate = useNavigate();
  const { activeModal, closeModal, currentUser, openModal, varieties, addBlogPost, showToast } = useApp();
  const [form, setForm] = useState(emptyForm);
  // Идёт публикация: сжатие обложки + загрузка в Storage + insert занимают заметное время,
  // без индикатора кажется, что сайт завис (и можно нажать «Опубликовать» дважды).
  const [loading, setLoading] = useState(false);

  const isOpen = activeModal === 'writeArticle';

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
    if (loading) return; // пока идёт публикация, не закрываем окно (иначе после ответа оно «сработает» само)
    setForm(emptyForm());
    closeModal();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return; // защита от двойного клика/Enter
    if (!currentUser) {
      closeModal();
      openModal('auth');
      return;
    }
    const paragraphs = form.content.split('\n').map((s) => s.trim()).filter(Boolean);
    const tags = form.tags.split(',').map((s) => s.trim()).filter(Boolean);
    if (!form.title || !paragraphs.length) {
      showToast('Заполни заголовок и текст статьи');
      return;
    }
    setLoading(true);
    try {
      const p = await addBlogPost({ title: form.title, varietyId: form.varietyId || null, tags, content: paragraphs, photo: form.photo });
      setForm(emptyForm());
      closeModal();
      if (p) navigate(`/blog/${p.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} wide>
      <h2>Написать статью</h2>
      <p className="sub">Поделись опытом с сообществом — статья появится в общем блоге сразу после публикации.</p>
      <form onSubmit={handleSubmit}>
        <div className="field"><label>Заголовок</label><input type="text" placeholder="Например: Как я впервые вырастил Reaper" required {...field('title')} /></div>
        <div className="field-row">
          <div className="field">
            <label>Сорт (необязательно)</label>
            <select {...field('varietyId')}>
              <option value="">— не привязана —</option>
              {varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Теги через запятую</label><input type="text" placeholder="выращивание, острый перец" {...field('tags')} /></div>
        </div>
        <div className="field"><label>Текст статьи (каждый абзац — с новой строки)</label><textarea rows="6" placeholder={'Первый абзац статьи…\nВторой абзац…'} {...field('content')} /></div>
        <div className="field"><label>Обложка статьи (необязательно)</label><input type="file" accept="image/*" onChange={handlePhotoChange} /></div>
        {form.photo && (
          <div style={{ marginBottom: 6 }}>
            <img src={form.photo} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '16px 4px 16px 4px' }} />
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={loading} aria-busy={loading}>
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {/* Спиннер на SMIL-анимации SVG: не требует CSS-классов и @keyframes */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="M12 3a9 9 0 0 1 9 9">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                </path>
              </svg>
              {form.photo ? 'Обработка фото…' : 'Публикация…'}
            </span>
          ) : 'Опубликовать статью'}
        </button>
      </form>
    </Modal>
  );
}

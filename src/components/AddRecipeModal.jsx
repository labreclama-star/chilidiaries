import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Modal from './Modal.jsx';
import { useApp } from '../context/AppContext.jsx';

const emptyForm = () => ({ title: '', category: 'Соус', varietyId: '', desc: '', ingredients: '', steps: '', photo: null });

export default function AddRecipeModal() {
  const navigate = useNavigate();
  const { activeModal, closeModal, currentUser, openModal, varieties, addRecipe, showToast } = useApp();
  const [form, setForm] = useState(emptyForm);
  // Идёт публикация: сжатие фото + загрузка в Storage + insert занимают заметное время,
  // без индикатора кажется, что сайт завис (и можно нажать «Опубликовать» дважды).
  const [loading, setLoading] = useState(false);

  const isOpen = activeModal === 'addRecipe';

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
    if (loading) return;
    if (!currentUser) {
      closeModal();
      openModal('auth');
      return;
    }
    const ingredients = form.ingredients.split('\n').map((s) => s.trim()).filter(Boolean);
    const steps = form.steps.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!form.title || !ingredients.length || !steps.length) {
      showToast('Заполни название, ингредиенты и шаги');
      return;
    }
    setLoading(true);
    try {
      const r = await addRecipe({ title: form.title, category: form.category, varietyId: form.varietyId || null, desc: form.desc, ingredients, steps, photo: form.photo });
      setForm(emptyForm());
      closeModal();
      if (r) navigate(`/recipes/${r.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} wide>
      <h2>Добавить рецепт</h2>
      <p className="sub">Поделись, что готовишь из своего урожая — соус, приправу или заготовку.</p>
      <form onSubmit={handleSubmit}>
        <div className="field"><label>Название рецепта</label><input type="text" placeholder="Например: Хабанеро-соус с манго" required {...field('title')} /></div>
        <div className="field-row">
          <div className="field">
            <label>Категория</label>
            <select {...field('category')}><option>Соус</option><option>Приправа</option><option>Заготовка</option><option>Паста</option></select>
          </div>
          <div className="field">
            <label>Сорт перца (необязательно)</label>
            <select {...field('varietyId')}>
              <option value="">— не выбран —</option>
              {varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Короткое описание</label><textarea rows="2" placeholder="В двух словах — что за рецепт и чем хорош" {...field('desc')} /></div>
        <div className="field"><label>Фото готового блюда (необязательно)</label><input type="file" accept="image/*" onChange={handlePhotoChange} /></div>
        {form.photo && (
          <div style={{ marginBottom: 14 }}>
            <img src={form.photo} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '12px 4px 12px 4px' }} />
          </div>
        )}
        <div className="field"><label>Ингредиенты (каждый — с новой строки)</label><textarea rows="4" placeholder={'8-10 стручков Habanero Red\n1 манго\nсок 2 лаймов'} {...field('ingredients')} /></div>
        <div className="field"><label>Шаги приготовления (каждый — с новой строки)</label><textarea rows="4" placeholder={'Измельчи все ингредиенты блендером\nОставь ферментироваться на 5 дней'} {...field('steps')} /></div>
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
          ) : 'Опубликовать рецепт'}
        </button>
      </form>
    </Modal>
  );
}

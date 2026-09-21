import { useState } from 'react';
import Modal from './Modal.jsx';
import { useApp } from '../context/AppContext.jsx';

const emptyForm = () => ({
  name: '', species: 'Capsicum chinense', origin: '',
  shuMin: '', shuMax: '', difficulty: 'Средняя', days: '',
  desc: '', photo: null
});

export default function AddVarietyModal() {
  const { activeModal, modalPayload, closeModal, currentUser, openModal, addVariety } = useApp();
  const [form, setForm] = useState(emptyForm);

  const isOpen = activeModal === 'addVariety';
  const returnToWizard = modalPayload && modalPayload.returnTo === 'wizard';

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

  function handleSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
      closeModal();
      openModal('auth');
      return;
    }
    addVariety(form, { returnToWizard });
    setForm(emptyForm());
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} wide>
      <h2>Добавить свой сорт</h2>
      <p className="sub">Сорта, добавленные сообществом, попадают в общий каталог с пометкой «от сообщества».</p>
      <form onSubmit={handleSubmit}>
        <div className="field"><label>Название сорта</label><input type="text" placeholder="Например: Bishop's Crown" required {...field('name')} /></div>
        <div className="field-row">
          <div className="field">
            <label>Вид (species)</label>
            <select {...field('species')}>
              <option>Capsicum chinense</option><option>Capsicum annuum</option>
              <option>Capsicum frutescens</option><option>Capsicum baccatum</option>
              <option>Capsicum pubescens</option>
            </select>
          </div>
          <div className="field"><label>Происхождение</label><input type="text" placeholder="Страна/регион" {...field('origin')} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>SHU от</label><input type="number" placeholder="10000" required {...field('shuMin')} /></div>
          <div className="field"><label>SHU до</label><input type="number" placeholder="30000" required {...field('shuMax')} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Сложность</label>
            <select {...field('difficulty')}>
              <option>Очень низкая</option><option>Низкая</option><option>Средняя</option><option>Высокая</option><option>Очень высокая</option>
            </select>
          </div>
          <div className="field"><label>Дней до созревания</label><input type="text" placeholder="90-100" {...field('days')} /></div>
        </div>
        <div className="field"><label>Описание</label><textarea rows="3" placeholder="Пара слов о вкусе, форме, особенностях выращивания…" {...field('desc')} /></div>
        <div className="field"><label>Фото сорта (необязательно)</label><input type="file" accept="image/*" onChange={handlePhotoChange} /></div>
        {form.photo && (
          <div style={{ marginBottom: 14 }}>
            <img src={form.photo} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '12px 4px 12px 4px' }} />
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-block">Добавить в каталог</button>
      </form>
    </Modal>
  );
}

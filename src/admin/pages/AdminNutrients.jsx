import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import Modal from '../../components/Modal.jsx';
import AdminTable from '../components/AdminTable.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';

const emptyForm = () => ({ name: '', brand: '', type: '', tag: '', price: '', rating: '', desc: '', link: '', photo: null, sponsored: false });

export default function AdminNutrients() {
  const { nutrients, adminAddNutrient, adminUpdateNutrient, adminDeleteNutrient } = useApp();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  function field(key) {
    return { value: form[key] ?? '', onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) };
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, photo: ev.target.result }));
    reader.readAsDataURL(file);
  }

  function openCreate() {
    setForm(emptyForm());
    setEditing({});
  }

  function openEdit(l) {
    setForm({
      name: l.name, brand: l.brand || '', type: l.type || '', tag: l.tag || '', price: l.price || '',
      rating: l.rating ?? '', desc: l.desc || '', link: l.link || '', photo: l.photo || null, sponsored: !!l.sponsored
    });
    setEditing(l);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, rating: Number(form.rating) || 0 };
    if (editing && editing.id) adminUpdateNutrient(editing.id, payload);
    else adminAddNutrient(payload);
    setEditing(null);
  }

  const columns = [
    { key: 'name', label: 'Название', render: (l) => <b>{l.name}{l.sponsored ? ' ★' : ''}</b> },
    { key: 'tag', label: 'Категория' },
    { key: 'price', label: 'Цена' },
    { key: 'rating', label: 'Рейтинг' }
  ];

  const confirming = confirmDeleteId ? nutrients.find((l) => l.id === confirmDeleteId) : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <h1 className="admin-section-title" style={{ margin: 0 }}>Удобрения</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Добавить удобрение</button>
      </div>

      <AdminTable
        columns={columns}
        rows={nutrients}
        onRowClick={openEdit}
        emptyText="Пока ничего не добавлено"
        renderActions={(l) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => openEdit(l)}>Изменить</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(l.id)}>Удалить</button>
          </div>
        )}
      />

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} wide>
        <h2>{editing && editing.id ? 'Редактировать удобрение' : 'Добавить удобрение'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Название</label><input type="text" required {...field('name')} /></div>
          <div className="field-row">
            <div className="field"><label>Бренд</label><input type="text" {...field('brand')} /></div>
            <div className="field"><label>Тип</label><input type="text" {...field('type')} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Категория (тег на карточке)</label><input type="text" placeholder="Для теплиц" {...field('tag')} /></div>
            <div className="field"><label>Цена</label><input type="text" placeholder="7 990 ₽" {...field('price')} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Рейтинг (0-5)</label><input type="number" step="0.1" min="0" max="5" {...field('rating')} /></div>
            <div className="field"><label>Ссылка</label><input type="text" {...field('link')} /></div>
          </div>
          <div className="field"><label>Описание</label><textarea rows="2" {...field('desc')} /></div>
          <div className="field"><label>Фото</label><input type="file" accept="image/*" onChange={handlePhotoChange} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13.5 }}>
            <input type="checkbox" checked={form.sponsored} onChange={(e) => setForm((f) => ({ ...f, sponsored: e.target.checked }))} />
            Спонсорское размещение
          </label>
          <button type="submit" className="btn btn-primary btn-block">{editing && editing.id ? 'Сохранить' : 'Добавить'}</button>
        </form>
      </Modal>

      <AdminConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Удалить удобрение?"
        message={`«${confirming?.name}» будет удалено из каталога.`}
        onConfirm={() => confirming && adminDeleteNutrient(confirming.id)}
      />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import Modal from '../../components/Modal.jsx';
import AdminTable from '../components/AdminTable.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';

const emptyForm = () => ({ title: '', category: 'Соус', varietyId: '', desc: '', ingredients: '', steps: '', photo: null });

export default function AdminRecipes() {
  const navigate = useNavigate();
  const { recipes, varieties, findGrowerById, adminAddRecipe, adminUpdateRecipe, adminDeleteRecipe, adminToggleRecipeHidden } = useApp();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {} = new, {...recipe} = edit
  const [form, setForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const list = useMemo(() => recipes.filter((r) => !search || r.title.toLowerCase().includes(search.toLowerCase())), [recipes, search]);

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

  function openEdit(r) {
    setForm({
      title: r.title, category: r.category, varietyId: r.varietyId || '',
      desc: r.desc || '', ingredients: (r.ingredients || []).join('\n'), steps: (r.steps || []).join('\n'), photo: r.photo || null
    });
    setEditing(r);
  }

  function closeModal() {
    setEditing(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const ingredients = form.ingredients.split('\n').map((s) => s.trim()).filter(Boolean);
    const steps = form.steps.split('\n').map((s) => s.trim()).filter(Boolean);
    const payload = { title: form.title, category: form.category, varietyId: form.varietyId || null, desc: form.desc, ingredients, steps, photo: form.photo };
    if (editing && editing.id) {
      adminUpdateRecipe(editing.id, payload);
    } else {
      adminAddRecipe(payload);
    }
    closeModal();
  }

  const columns = [
    {
      key: 'photo', label: 'Фото', render: (r) => (
        r.photo ? <img src={r.photo} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--soil-800)' }} />
      )
    },
    { key: 'title', label: 'Название', render: (r) => <b>{r.title}{r.hidden ? ' (скрыт)' : ''}</b> },
    { key: 'author', label: 'Автор', render: (r) => findGrowerById(r.growerId)?.name || 'admin' },
    { key: 'likes', label: 'Лайки' },
    { key: 'views', label: 'Просмотры' }
  ];

  const confirming = confirmDeleteId ? recipes.find((r) => r.id === confirmDeleteId) : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <h1 className="admin-section-title" style={{ margin: 0 }}>Рецепты</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Добавить рецепт</button>
      </div>

      <div className="admin-toolbar">
        <div className="field">
          <input type="text" placeholder="Поиск по названию…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <AdminTable
        columns={columns}
        rows={list}
        onRowClick={openEdit}
        emptyText="Рецепты не найдены"
        renderActions={(r) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/recipes/${r.id}`)}>Открыть</button>
            <button className="btn btn-outline btn-sm" onClick={() => adminToggleRecipeHidden(r.id)}>{r.hidden ? 'Показать' : 'Скрыть'}</button>
            <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>Изменить</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(r.id)}>Удалить</button>
          </div>
        )}
      />

      <Modal isOpen={!!editing} onClose={closeModal} wide>
        <h2>{editing && editing.id ? 'Редактировать рецепт' : 'Добавить рецепт'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Название рецепта</label><input type="text" required {...field('title')} /></div>
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
          <div className="field"><label>Короткое описание</label><textarea rows="2" {...field('desc')} /></div>
          <div className="field"><label>Фото готового блюда</label><input type="file" accept="image/*" onChange={handlePhotoChange} /></div>
          {form.photo && (
            <div style={{ marginBottom: 14 }}>
              <img src={form.photo} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '12px 4px 12px 4px' }} />
            </div>
          )}
          <div className="field"><label>Ингредиенты (каждый — с новой строки)</label><textarea rows="4" required {...field('ingredients')} /></div>
          <div className="field"><label>Шаги приготовления (каждый — с новой строки)</label><textarea rows="4" required {...field('steps')} /></div>
          <button type="submit" className="btn btn-primary btn-block">{editing && editing.id ? 'Сохранить' : 'Опубликовать рецепт'}</button>
        </form>
      </Modal>

      <AdminConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Удалить рецепт?"
        message={`Рецепт «${confirming?.title}» будет удалён без возможности восстановления.`}
        onConfirm={() => confirming && adminDeleteRecipe(confirming.id)}
      />
    </div>
  );
}

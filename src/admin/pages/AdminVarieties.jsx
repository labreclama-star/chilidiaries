import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import Modal from '../../components/Modal.jsx';
import AdminTable from '../components/AdminTable.jsx';
import AdminConfirmDialog from '../components/AdminConfirmDialog.jsx';

const SPECIES_OPTIONS = ['Capsicum chinense', 'Capsicum annuum', 'Capsicum frutescens', 'Capsicum baccatum', 'Capsicum pubescens'];

const emptyForm = () => ({
  name: '', species: 'Capsicum chinense', origin: '',
  shuMin: '', shuMax: '', difficulty: 'Средняя', days: '',
  desc: '', photo: null, rating: '', capsaicinRating: '', aromaRating: ''
});

export default function AdminVarieties() {
  const navigate = useNavigate();
  const { varieties, diaries, adminAddVariety, adminUpdateVariety, adminDeleteVariety, countDiariesUsingVariety } = useApp();

  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...variety} = editing
  const [form, setForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const list = useMemo(() => varieties.filter((v) => {
    if (speciesFilter !== 'all' && v.species !== speciesFilter) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [varieties, speciesFilter, search]);

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

  function openEdit(v) {
    setForm({
      name: v.name, species: v.species, origin: v.origin || '',
      shuMin: v.shuMin, shuMax: v.shuMax, difficulty: v.difficulty || 'Средняя', days: v.days || '',
      desc: v.desc || '', photo: v.photo || null,
      rating: v.rating ?? '', capsaicinRating: v.capsaicinRating ?? '', aromaRating: v.aromaRating ?? ''
    });
    setEditing(v);
  }

  function closeModal() {
    setEditing(null);
    setForm(emptyForm());
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (editing && editing.id) {
      adminUpdateVariety(editing.id, {
        name: form.name, species: form.species, origin: form.origin,
        shuMin: parseInt(form.shuMin, 10) || 0, shuMax: parseInt(form.shuMax, 10) || 0,
        difficulty: form.difficulty, days: form.days, desc: form.desc, photo: form.photo,
        rating: form.rating === '' ? null : Number(form.rating),
        capsaicinRating: form.capsaicinRating === '' ? null : Number(form.capsaicinRating),
        aromaRating: form.aromaRating === '' ? null : Number(form.aromaRating)
      });
    } else {
      adminAddVariety(form);
    }
    closeModal();
  }

  function handleDeleteClick(v) {
    setConfirmDeleteId(v.id);
  }

  function diaryCountFor(varietyId) {
    return diaries.filter((d) => d.varietyId === varietyId || (d.varietyIds || []).includes(varietyId)).length;
  }

  const columns = [
    { key: 'name', label: 'Название', render: (v) => <b>{v.name}</b> },
    { key: 'species', label: 'Вид' },
    { key: 'shu', label: 'SHU', render: (v) => `${v.shuMin.toLocaleString('ru-RU')}–${v.shuMax.toLocaleString('ru-RU')}` },
    { key: 'rating', label: 'Рейтинг', render: (v) => v.rating ?? '—' },
    { key: 'diaries', label: 'Дневников', render: (v) => diaryCountFor(v.id) }
  ];

  const confirmingVariety = confirmDeleteId ? varieties.find((v) => v.id === confirmDeleteId) : null;
  const usedByCount = confirmingVariety ? countDiariesUsingVariety(confirmingVariety.id) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <h1 className="admin-section-title" style={{ margin: 0 }}>Сорта</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Добавить сорт</button>
      </div>

      <div className="admin-toolbar">
        <div className="field">
          <input type="text" placeholder="Поиск по названию…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)}>
          <option value="all">Все виды</option>
          {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <AdminTable
        columns={columns}
        rows={list}
        onRowClick={openEdit}
        renderActions={(v) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/varieties/${v.id}`)}>Открыть</button>
            <button className="btn btn-outline btn-sm" onClick={() => openEdit(v)}>Изменить</button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteClick(v)}>Удалить</button>
          </div>
        )}
        emptyText="Сорта не найдены"
      />

      <Modal isOpen={!!editing} onClose={closeModal} wide>
        <h2>{editing && editing.id ? 'Редактировать сорт' : 'Добавить сорт'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Название сорта</label><input type="text" required {...field('name')} /></div>
          <div className="field-row">
            <div className="field">
              <label>Вид (species)</label>
              <select {...field('species')}>
                {SPECIES_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Происхождение</label><input type="text" {...field('origin')} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>SHU от</label><input type="number" required {...field('shuMin')} /></div>
            <div className="field"><label>SHU до</label><input type="number" required {...field('shuMax')} /></div>
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
          <div className="field-row">
            <div className="field"><label>Рейтинг (0-5)</label><input type="number" step="0.1" min="0" max="5" {...field('rating')} /></div>
            <div className="field"><label>Острота (0-5)</label><input type="number" step="0.1" min="0" max="5" {...field('capsaicinRating')} /></div>
          </div>
          <div className="field"><label>Аромат (0-5)</label><input type="number" step="0.1" min="0" max="5" {...field('aromaRating')} /></div>
          <div className="field"><label>Описание</label><textarea rows="3" {...field('desc')} /></div>
          <div className="field"><label>Фото сорта</label><input type="file" accept="image/*" onChange={handlePhotoChange} /></div>
          {form.photo && (
            <div style={{ marginBottom: 14 }}>
              <img src={form.photo} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '12px 4px 12px 4px' }} />
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block">{editing && editing.id ? 'Сохранить' : 'Добавить в каталог'}</button>
        </form>
      </Modal>

      <AdminConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Удалить сорт?"
        message={
          usedByCount > 0
            ? `Этот сорт используется в ${usedByCount} дневник(ах) — удаление заблокировано. Сначала отвяжи или удали эти дневники.`
            : `Сорт «${confirmingVariety?.name}» будет удалён без возможности восстановления.`
        }
        confirmLabel={usedByCount > 0 ? 'Понятно' : 'Удалить'}
        danger={usedByCount === 0}
        onConfirm={() => {
          if (usedByCount === 0 && confirmingVariety) adminDeleteVariety(confirmingVariety.id);
        }}
      />
    </div>
  );
}

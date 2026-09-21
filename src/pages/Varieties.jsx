import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import VarietyCard from '../components/VarietyCard.jsx';
import FilterBar, { FilterChip } from '../components/FilterBar.jsx';

const SPECIES = [
  { value: 'all', label: 'Все виды' },
  { value: 'Capsicum chinense', label: 'C. chinense' },
  { value: 'Capsicum annuum', label: 'C. annuum' },
  { value: 'Capsicum frutescens', label: 'C. frutescens' },
  { value: 'Capsicum baccatum', label: 'C. baccatum' },
  { value: 'Capsicum pubescens', label: 'C. pubescens' }
];

const SORTS = [
  { value: 'shu_desc', label: 'Сначала острые' },
  { value: 'shu_asc', label: 'Сначала мягкие' },
  { value: 'name', label: 'По алфавиту' }
];

const PAGE_SIZE = 24;

export default function Varieties() {
  const { varieties, currentUser, openModal, showToast } = useApp();
  const [species, setSpecies] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('shu_desc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  let list = species === 'all' ? varieties : varieties.filter((v) => v.species === species);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter((v) => v.name.toLowerCase().includes(q));
  }
  list = list.slice().sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ru');
    const aShu = (a.shuMin + a.shuMax) / 2;
    const bShu = (b.shuMin + b.shuMax) / 2;
    return sort === 'shu_asc' ? aShu - bShu : bShu - aShu;
  });
  const visible = list.slice(0, visibleCount);

  function handleAddVariety() {
    if (!currentUser) { showToast('Войди, чтобы добавить сорт в каталог'); openModal('auth'); return; }
    openModal('addVariety');
  }

  return (
    <>
      <div className="page-hero">
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">Каталог сортов</span>
            <h1>Сорта острого перца</h1>
            <p>{varieties.length} сортов — от мягкого Халапеньо до рекордсмена Pepper X. Сравнивай остроту, сложность и срок созревания.</p>
          </div>
          <button className="btn btn-primary" onClick={handleAddVariety}>+ Добавить свой сорт</button>
        </div>
      </div>
      <div className="wrap">
        <FilterBar resultsLabel={`${list.length} сортов`}>
          {SPECIES.map((s) => (
            <FilterChip key={s.value} active={species === s.value} onClick={() => { setSpecies(s.value); setVisibleCount(PAGE_SIZE); }}>
              {s.label}
            </FilterChip>
          ))}
          <input
            type="text"
            placeholder="Поиск по названию…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </FilterBar>
        <div className="grid grid-4">
          {visible.map((v) => <VarietyCard key={v.id} variety={v} />)}
        </div>
        {list.length === 0 && (
          <div className="empty-state" style={{ marginTop: 20 }}><p>Ничего не нашлось — попробуй другой запрос или фильтр.</p></div>
        )}
        {visibleCount < list.length && (
          <div style={{ textAlign: 'center', marginTop: 30 }}>
            <button className="btn btn-outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              Показать ещё сорта ({list.length - visibleCount})
            </button>
          </div>
        )}
      </div>
    </>
  );
}

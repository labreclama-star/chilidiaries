import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import DiaryCard from '../components/DiaryCard.jsx';
import FilterBar from '../components/FilterBar.jsx';

export default function Diaries() {
  const { diaries, varieties, growers, searchQuery } = useApp();
  const [stage, setStage] = useState('all');
  const [location, setLocation] = useState('all');
  const [varietyId, setVarietyId] = useState('all');
  const [sort, setSort] = useState('popular');
  const [visibleCount, setVisibleCount] = useState(6);

  const findVariety = (id) => varieties.find((v) => v.id === id);
  const usedVarietyIds = [...new Set(diaries.map((d) => d.varietyId))];
  const varietyOptions = usedVarietyIds
    .map((id) => findVariety(id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const filtered = useMemo(() => {
    let list = diaries.filter((d) => {
      if (stage !== 'all' && d.stage !== stage) return false;
      if (location !== 'all' && d.location !== location) return false;
      if (varietyId !== 'all' && d.varietyId !== varietyId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const v = varieties.find((x) => x.id === d.varietyId);
        const g = growers.find((x) => x.id === d.growerId);
        const hay = `${d.title} ${v ? v.name : ''} ${g ? g.name : ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === 'popular') list = list.slice().sort((a, b) => b.likes - a.likes);
    if (sort === 'heat') list = list.slice().sort((a, b) => b.shu - a.shu);
    if (sort === 'new') list = list.slice().sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    if (sort === 'variety') {
      list = list.slice().sort((a, b) => {
        const va = varieties.find((x) => x.id === a.varietyId);
        const vb = varieties.find((x) => x.id === b.varietyId);
        return (va ? va.name : '').localeCompare(vb ? vb.name : '', 'ru');
      });
    }
    return list;
  }, [diaries, varieties, growers, stage, location, varietyId, sort, searchQuery]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Каталог дневников</span>
          <h1>Все дневники выращивания</h1>
          <p>Фильтруй по стадии, месту выращивания и технике агротехники — найди гров, похожий на твой.</p>
        </div>
      </div>
      <div className="wrap">
        <FilterBar resultsLabel={`${filtered.length} дневников найдено`}>
          <select value={stage} onChange={(e) => { setStage(e.target.value); setVisibleCount(6); }}>
            <option value="all">Стадия: любая</option>
            <option value="Рассада">Рассада</option>
            <option value="Вегетация">Вегетация</option>
            <option value="Цветение">Цветение</option>
            <option value="Плодоношение">Плодоношение</option>
            <option value="Собран урожай">Собран урожай</option>
          </select>
          <select value={location} onChange={(e) => { setLocation(e.target.value); setVisibleCount(6); }}>
            <option value="all">Место: любое</option>
            <option value="Дома">Дома</option>
            <option value="Теплица">Теплица</option>
            <option value="Открытый грунт">Открытый грунт</option>
          </select>
          <select value={varietyId} onChange={(e) => { setVarietyId(e.target.value); setVisibleCount(6); }}>
            <option value="all">Сорт: любой</option>
            {varietyOptions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="popular">Сортировка: популярные</option>
            <option value="new">Сначала новые</option>
            <option value="heat">По остроте</option>
            <option value="variety">По сортам (А-Я)</option>
          </select>
        </FilterBar>

        {visible.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <p>Ничего не найдено. Попробуй изменить фильтры.</p>
          </div>
        ) : (
          <div className="grid grid-3">
            {visible.map((d) => <DiaryCard key={d.id} diary={d} />)}
          </div>
        )}

        {visible.length < filtered.length && (
          <div className="load-more-wrap">
            <button className="btn btn-outline" onClick={() => setVisibleCount((c) => c + 6)}>Показать ещё дневники</button>
          </div>
        )}
      </div>
    </>
  );
}

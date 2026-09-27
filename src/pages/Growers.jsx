import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import GrowerCard from '../components/GrowerCard.jsx';

export default function Growers() {
  const { growers } = useApp();
  const [query, setQuery] = useState('');

  const visible = growers.filter((g) => !g.deleted);
  const trimmedQuery = query.trim().toLowerCase();
  const filtered = trimmedQuery
    ? visible.filter((g) => g.name.toLowerCase().includes(trimmedQuery))
    : visible;

  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Сообщество</span>
          <h1>Гроверы ChiliDiaries</h1>
          <p>Подписывайся на гроверов, чтобы следить за их дневниками и не пропускать новые отчёты.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
        <div className="field" style={{ maxWidth: 360, marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Поиск по имени гровера…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>Никого не нашлось</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setQuery('')}>Сбросить</button>
          </div>
        ) : (
          <div className="grid grid-5">
            {filtered.map((g) => <GrowerCard key={g.id} grower={g} compact />)}
          </div>
        )}
      </div>
    </>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { rankGrowers, fmtNum } from '../utils/helpers.js';

const TABS = [
  { value: 3, label: 'Топ 3' },
  { value: 10, label: 'Топ 10' },
  { value: 50, label: 'Топ 50' },
  { value: 100, label: 'Топ 100' }
];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { growers, diaries } = useApp();
  const [limit, setLimit] = useState(10);

  const ranked = rankGrowers(growers, diaries).slice(0, limit);

  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Сезон 2026</span>
          <h1>Рейтинг гроверов</h1>
          <p>
            Место в рейтинге считается по активности: дневники, опубликованные отчёты, лайки от сообщества
            и разблокированные достижения — а не только по числу подписчиков.
          </p>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
        <div className="filter-bar">
          {TABS.map((t) => (
            <button
              key={t.value}
              className={'chip' + (limit === t.value ? ' active' : '')}
              onClick={() => setLimit(t.value)}
            >
              {t.label}
            </button>
          ))}
          <div className="filter-spacer" />
          <span className="results-count">{ranked.length} гроверов в рейтинге</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ranked.map(({ grower, score }, idx) => (
            <Link
              key={grower.id}
              to={`/growers/${grower.id}`}
              className="card"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 16, padding: '14px 18px',
                textDecoration: 'none', cursor: 'pointer'
              }}
            >
              <div style={{ width: 34, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: idx < 3 ? 22 : 15, color: idx < 3 ? undefined : 'var(--cream-faint)', fontWeight: 700, flexShrink: 0 }}>
                {idx < 3 ? MEDALS[idx] : idx + 1}
              </div>
              <Avatar name={grower.name} photo={grower.avatar} size={44} online={grower.online} showOnline />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', color: 'var(--white)', fontSize: 15 }}>{grower.name}</b>
                <span style={{ fontSize: 12.5, color: 'var(--cream-faint)' }}>{grower.loc}</span>
              </div>
              <div style={{ display: 'flex', gap: 22, flexShrink: 0 }} className="rating-stats-row">
                <div style={{ textAlign: 'center' }}>
                  <b style={{ display: 'block', fontFamily: 'var(--font-mono)', color: 'var(--white)', fontSize: 14 }}>{grower.diaries}</b>
                  <span style={{ fontSize: 10.5, color: 'var(--cream-faint)' }}>дневников</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <b style={{ display: 'block', fontFamily: 'var(--font-mono)', color: 'var(--white)', fontSize: 14 }}>{fmtNum(grower.followers)}</b>
                  <span style={{ fontSize: 10.5, color: 'var(--cream-faint)' }}>подписчиков</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <b style={{ display: 'block', fontFamily: 'var(--font-mono)', color: 'var(--habanero)', fontSize: 14 }}>{fmtNum(score)}</b>
                  <span style={{ fontSize: 10.5, color: 'var(--cream-faint)' }}>очков</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

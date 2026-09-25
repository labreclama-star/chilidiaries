import { Link } from 'react-router-dom';

const AVATAR_COLORS = ['var(--ember)', 'var(--habanero)', 'var(--leaf)', 'var(--ember-bright)', 'var(--habanero-dim)'];

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/**
 * "Лидерборд / Топ гроверов" — центральная колонка Row 3 (Этап 2).
 * ranked: результат rankGrowers(activeGrowers, diaries).slice(0, 5),
 * т.е. [{ grower, score }] — считается в AdminDashboard.jsx.
 */
export default function AdminLeaderboard({ ranked }) {
  if (!ranked || ranked.length === 0) {
    return <p className="sub" style={{ padding: 14 }}>Пока нет данных</p>;
  }

  return (
    <div className="admin-leaderboard">
      {ranked.map((r, i) => (
        <Link to={`/growers/${r.grower.id}`} className="admin-leaderboard-row" key={r.grower.id}>
          <span className="admin-leaderboard-rank">{i + 1}</span>
          <span className="admin-avatar-badge" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
            {initials(r.grower.name)}
          </span>
          <span className="admin-leaderboard-info">
            <span className="admin-leaderboard-name">{r.grower.name}</span>
            <span className="admin-leaderboard-sub">{r.grower.diaries} дн. · {r.grower.followers} подп.</span>
          </span>
          <span className="admin-leaderboard-score">{r.score}</span>
        </Link>
      ))}
    </div>
  );
}

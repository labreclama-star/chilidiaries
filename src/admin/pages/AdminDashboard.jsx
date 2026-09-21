import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { rankGrowers } from '../../utils/helpers.js';
import { AdminBarChart, AdminLineChart, AdminHBarList } from '../components/AdminCharts.jsx';
import Avatar from '../../components/Avatar.jsx';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n) {
  return new Date(Date.now() - n * DAY_MS);
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function countSince(dates, days) {
  const cutoff = Date.now() - days * DAY_MS;
  return dates.filter((d) => d && d.getTime() >= cutoff).length;
}
function last14DaysSeries(dates) {
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const day = daysAgo(i);
    const count = dates.filter((d) => d && isSameDay(d, day)).length;
    out.push({ label: day.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }), value: count });
  }
  return out;
}
function safeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export default function AdminDashboard() {
  const { growers, diaries, varieties, recipes, blogPosts, questions, contests, findGrowerById } = useApp();

  const growerDates = growers.map((g) => safeDate(g.joinedAt));
  const diaryDates = diaries.map((d) => safeDate(d.startDate));

  const activeGrowers = growers.filter((g) => !g.deleted);
  const totalLikes = diaries.reduce((s, d) => s + (d.likes || 0), 0);
  const totalReports = diaries.reduce((s, d) => s + (d.weeks ? d.weeks.length : 0), 0);
  const followedCount = growers.filter((g) => g._followed).length;

  const stats = [
    { label: 'Гроверов', value: activeGrowers.length },
    { label: 'Дневников', value: diaries.length },
    { label: 'Отчётов', value: totalReports },
    { label: 'Лайков дневников', value: totalLikes },
    { label: 'Сортов', value: varieties.length },
    { label: 'Рецептов', value: recipes.length },
    { label: 'Статей блога', value: blogPosts.length },
    { label: 'Вопросов', value: questions.length },
    { label: 'Конкурсов', value: contests.length },
    { label: 'Активных подписок', value: followedCount },
    { label: 'Новых гроверов за 7 дней', value: countSince(growerDates, 7) },
    { label: 'Новых дневников за 7 дней', value: countSince(diaryDates, 7) }
  ];

  const topVarieties = varieties
    .map((v) => ({ label: v.name, value: diaries.filter((d) => d.varietyId === v.id || (d.varietyIds || []).includes(v.id)).length }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .filter((x) => x.value > 0);

  const topGrowers = rankGrowers(activeGrowers, diaries).slice(0, 5).map((r) => ({ label: r.grower.name, value: r.score }));

  const recentGrowers = growers
    .filter((g) => safeDate(g.joinedAt))
    .slice()
    .sort((a, b) => safeDate(b.joinedAt) - safeDate(a.joinedAt))
    .slice(0, 5);

  const recentDiaries = diaries
    .filter((d) => safeDate(d.startDate))
    .slice()
    .sort((a, b) => safeDate(b.startDate) - safeDate(a.startDate))
    .slice(0, 5);

  const pendingPosts = blogPosts.filter((p) => p.status === 'pending').slice(0, 5);

  return (
    <div>
      <h1 className="admin-section-title" style={{ marginTop: 0 }}>Дашборд</h1>

      <div className="admin-stat-grid">
        {stats.map((s) => (
          <div className="admin-stat-card" key={s.label}>
            <div className="admin-stat-val">{s.value}</div>
            <div className="admin-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="admin-section-title">Регистрации гроверов за 14 дней</h2>
      <div className="card" style={{ padding: '16px 18px' }}>
        <AdminLineChart values={last14DaysSeries(growerDates)} />
      </div>

      <h2 className="admin-section-title">Новые дневники за 14 дней</h2>
      <div className="card" style={{ padding: '16px 18px' }}>
        <AdminBarChart values={last14DaysSeries(diaryDates)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="admin-two-col">
        <div>
          <h2 className="admin-section-title">Топ-5 сортов по числу дневников</h2>
          <div className="card" style={{ padding: '16px 18px' }}>
            {topVarieties.length ? <AdminHBarList items={topVarieties} /> : <p className="sub">Пока нет данных</p>}
          </div>
        </div>
        <div>
          <h2 className="admin-section-title">Топ-5 гроверов по рейтингу</h2>
          <div className="card" style={{ padding: '16px 18px' }}>
            {topGrowers.length ? <AdminHBarList items={topGrowers} color="var(--habanero)" /> : <p className="sub">Пока нет данных</p>}
          </div>
        </div>
      </div>

      <h2 className="admin-section-title">Последние зарегистрированные гроверы</h2>
      <div className="card" style={{ padding: 4 }}>
        {recentGrowers.length === 0 && <p className="sub" style={{ padding: 14 }}>Пока нет данных</p>}
        {recentGrowers.map((g) => (
          <Link key={g.id} to={`/growers/${g.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--scorch-line-soft)' }}>
            <Avatar name={g.name} photo={g.avatar} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: 'var(--cream-faint)' }}>{g.loc}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--cream-faint)' }}>{safeDate(g.joinedAt)?.toLocaleDateString('ru-RU')}</div>
          </Link>
        ))}
      </div>

      <h2 className="admin-section-title">Последние созданные дневники</h2>
      <div className="card" style={{ padding: 4 }}>
        {recentDiaries.length === 0 && <p className="sub" style={{ padding: 14 }}>Пока нет данных</p>}
        {recentDiaries.map((d) => {
          const v = varieties.find((v) => v.id === d.varietyId);
          const g = findGrowerById(d.growerId);
          return (
            <Link key={d.id} to={`/diaries/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--scorch-line-soft)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: 'var(--cream-faint)' }}>{g?.name} · {v?.name} · {d.stage}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {pendingPosts.length > 0 && (
        <>
          <h2 className="admin-section-title">Статьи на модерации</h2>
          <div className="card" style={{ padding: 4 }}>
            {pendingPosts.map((p) => (
              <Link key={p.id} to="/admin/blog" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--scorch-line-soft)' }}>
                <div style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{p.title}</div>
                <span className="tag">На модерации</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

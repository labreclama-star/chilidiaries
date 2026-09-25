import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { rankGrowers, timeAgo } from '../../utils/helpers.js';
import { AdminBarChart, AdminLineChart, AdminHBarList } from '../components/AdminCharts.jsx';
import AdminPageHeader from '../components/AdminPageHeader.jsx';
import AdminMetricCard from '../components/AdminMetricCard.jsx';
import AdminQueueCard from '../components/AdminQueueCard.jsx';
import AdminLeaderboard from '../components/AdminLeaderboard.jsx';
import AdminEventFeed from '../components/AdminEventFeed.jsx';
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

/** Считает элементы dates в полуоткрытом окне [now - fromDaysAgo, now - toDaysAgo). */
function countInWindow(dates, fromDaysAgo, toDaysAgo) {
  const from = Date.now() - fromDaysAgo * DAY_MS;
  const to = Date.now() - toDaysAgo * DAY_MS;
  return dates.filter((d) => d && d.getTime() >= from && d.getTime() < to).length;
}

/**
 * % изменения "новых событий за последние 14 дней" относительно предыдущих
 * 14 дней — то есть скорость роста, а не delta от общего количества (общее
 * количество почти всегда растёт монотонно, сравнивать его 14-дневные окна
 * друг с другом бессмысленно). Если в предыдущем окне не было ни одного
 * события — считаем это +100% при наличии событий сейчас, иначе 0%
 * (нет данных, чтобы посчитать честный процент от нуля).
 */
function growthPct(dates) {
  const current = countInWindow(dates, 14, 0);
  const previous = countInWindow(dates, 28, 14);
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export default function AdminDashboard() {
  const {
    growers, diaries, varieties, recipes, blogPosts, questions, contests,
    findGrowerById, adminModerateBlogPost
  } = useApp();

  const activeGrowers = growers.filter((g) => !g.deleted);
  const activeGrowerDates = activeGrowers.map((g) => safeDate(g.joinedAt));
  const diaryDates = diaries.map((d) => safeDate(d.startDate));
  const questionDates = questions.map((q) => safeDate(q.createdAt));

  const totalLikes = diaries.reduce((s, d) => s + (d.likes || 0), 0);
  const totalReports = diaries.reduce((s, d) => s + (d.weeks ? d.weeks.length : 0), 0);
  const followedCount = growers.filter((g) => g._followed).length;

  const pendingPosts = blogPosts.filter((p) => p.status === 'pending');
  // "Зависшие" вопросы: открыты, без единого ответа, и созданы больше недели
  // назад. createdAt у вопросов — настоящее поле из БД (в отличие от
  // blog_posts, где такого поля нет вовсе, см. переписку по Этапу 2).
  const staleQuestions = questions
    .filter((q) => {
      if (q.status !== 'open' || (q.answers && q.answers.length > 0)) return false;
      const created = safeDate(q.createdAt);
      return created && Date.now() - created.getTime() > 7 * DAY_MS;
    })
    .sort((a, b) => safeDate(a.createdAt) - safeDate(b.createdAt));

  // ============ Row 1 — 4 крупные карточки метрик ============
  // "На модерации" — без deltaPct (null): у blog_posts нет created_at,
  // честный % 14-дней-к-14-дням посчитать нечем, показываем только число.
  const metrics = [
    { label: 'Гроверов', value: activeGrowers.length, deltaPct: growthPct(activeGrowerDates) },
    { label: 'Дневников', value: diaries.length, deltaPct: growthPct(diaryDates) },
    { label: 'Вопросов', value: questions.length, deltaPct: growthPct(questionDates) },
    { label: 'На модерации', value: pendingPosts.length, deltaPct: null }
  ];

  // ============ Row 2 — 3 пилюли ============
  const newGrowers7d = countSince(activeGrowerDates, 7);
  const pills = [
    { key: 'mod', text: `На модерации: ${pendingPosts.length} материалов`, badge: 'Очередь', tone: 'warn' },
    { key: 'qa', text: `Без ответа >недели: ${staleQuestions.length} вопросов`, badge: 'Q&A', tone: 'info' },
    { key: 'new', text: `Новые гроверы за 7 дней: ${newGrowers7d}`, badge: 'Рост', tone: 'muted' }
  ];

  // ============ Row 3, левая колонка — очередь ============
  const queueItems = [
    ...staleQuestions.map((q) => ({
      id: `q_${q.id}`,
      kindLabel: 'Требует ответа',
      kindClass: 'question',
      title: q.text,
      author: findGrowerById(q.growerId)?.name || null,
      time: timeAgo(q.createdAt),
      actions: [{ label: 'Ответить', to: '/admin/questions', variant: 'neutral' }]
    })),
    ...pendingPosts.map((p) => ({
      id: `p_${p.id}`,
      kindLabel: 'Статья',
      kindClass: 'post',
      title: p.title,
      author: findGrowerById(p.growerId)?.name || null,
      time: null,
      actions: [
        { label: '✓ Одобрить', variant: 'approve', onClick: () => adminModerateBlogPost(p.id, 'approved') },
        { label: '✗ Скрыть', variant: 'reject', onClick: () => adminModerateBlogPost(p.id, 'rejected') }
      ]
    }))
  ].slice(0, 8);

  // ============ Row 3, центр — лидерборд ============
  const ranked = rankGrowers(activeGrowers, diaries).slice(0, 5);

  // ============ Row 3, право — лента событий ============
  // Только diaries (startDate) + growers (joinedAt) — комментариев в
  // AppContext нет отдельным плоским массивом, договорились не включать их
  // в этой итерации.
  const feedEvents = [
    ...diaries.filter((d) => safeDate(d.startDate)).map((d) => ({
      id: `d_${d.id}`,
      date: safeDate(d.startDate),
      title: `Новый дневник «${d.title}»`,
      detail: findGrowerById(d.growerId)?.name || null
    })),
    ...growers.filter((g) => safeDate(g.joinedAt)).map((g) => ({
      id: `g_${g.id}`,
      date: safeDate(g.joinedAt),
      title: `Регистрация: ${g.name}`,
      detail: g.loc || null
    }))
  ].sort((a, b) => b.date - a.date).slice(0, 8);

  // ============ Легаси-секции (старая вёрстка, ждут переезда на Этапе 3) ============
  const stats = [
    { label: 'Лайков дневников', value: totalLikes },
    { label: 'Отчётов', value: totalReports },
    { label: 'Сортов', value: varieties.length },
    { label: 'Рецептов', value: recipes.length },
    { label: 'Статей блога', value: blogPosts.length },
    { label: 'Конкурсов', value: contests.length },
    { label: 'Активных подписок', value: followedCount },
    { label: 'Новых дневников за 7 дней', value: countSince(diaryDates, 7) }
  ];

  const topVarieties = varieties
    .map((v) => ({ label: v.name, value: diaries.filter((d) => d.varietyId === v.id || (d.varietyIds || []).includes(v.id)).length }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .filter((x) => x.value > 0);

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

  return (
    <div>
      <AdminPageHeader
        eyebrow="ChiliDiaries · Ops"
        title="Сводка сообщества"
        subtitle="Живые цифры сообщества: гроверы, дневники, очередь модерации."
      />

      {/* ЭТАП 2: Row 1-3 — новый редизайн. Секции ниже (старые
          admin-stat-card/графики/списки) — Этап 3, следующим шагом. */}

      <div className="admin-metric-row">
        {metrics.map((m) => <AdminMetricCard key={m.label} {...m} />)}
      </div>

      <div className="admin-pill-row">
        {pills.map((p) => (
          <div className="admin-pill-card" key={p.key}>
            <span>{p.text}</span>
            <span className={`admin-pill-badge ${p.tone}`}>{p.badge}</span>
          </div>
        ))}
      </div>

      <div className="admin-triple-col">
        <div>
          <h2 className="admin-section-title">Очередь / Модерация</h2>
          <div className="card" style={{ padding: 4 }}>
            <AdminQueueCard items={queueItems} />
          </div>
        </div>
        <div>
          <h2 className="admin-section-title">Лидерборд / Топ гроверов</h2>
          <div className="card" style={{ padding: 4 }}>
            <AdminLeaderboard ranked={ranked} />
          </div>
        </div>
        <div>
          <h2 className="admin-section-title">Сейчас / Лента событий</h2>
          <div className="card" style={{ padding: '14px 16px' }}>
            <AdminEventFeed events={feedEvents} />
          </div>
        </div>
      </div>

      <div className="admin-stat-grid">
        {stats.map((s) => (
          <div className="admin-stat-card" key={s.label}>
            <div className="admin-stat-val">{s.value}</div>
            <div className="admin-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '16px 18px' }}>
        <AdminLineChart
          values={last14DaysSeries(activeGrowerDates)}
          title="Регистрации гроверов"
          unit={{ one: 'регистрация', few: 'регистрации', many: 'регистраций' }}
        />
      </div>

      <div className="card" style={{ padding: '16px 18px' }}>
        <AdminBarChart
          values={last14DaysSeries(diaryDates)}
          title="Новые дневники"
          unit={{ one: 'дневник', few: 'дневника', many: 'дневников' }}
        />
      </div>

      <h2 className="admin-section-title">Топ-5 сортов по числу дневников</h2>
      <div className="card" style={{ padding: '16px 18px' }}>
        {topVarieties.length ? <AdminHBarList items={topVarieties} /> : <p className="sub">Пока нет данных</p>}
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
    </div>
  );
}

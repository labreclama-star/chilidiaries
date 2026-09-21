import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import StatsCard from '../components/StatsCard.jsx';
import AchievementBadges from '../components/AchievementBadges.jsx';
import DiaryCard from '../components/DiaryCard.jsx';
import RecipeCard from '../components/RecipeCard.jsx';
import SeedBankSection from '../components/SeedBankSection.jsx';
import { fmtNum, growerVarietiesGrown } from '../utils/helpers.js';

export default function MyDiaries() {
  const { currentUser, findGrowerById, diaries, varieties, recipes, savedRecipeIds, contests, joinedContestIds, openModal } = useApp();

  if (!currentUser) {
    return (
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center' }}>
        <span className="eyebrow" style={{ justifyContent: 'center' }}>Мои дневники</span>
        <h1 style={{ margin: '14px 0 10px' }}>Тут будут твои дневники</h1>
        <p style={{ color: 'var(--cream-dim)', marginBottom: 26 }}>Войди или зарегистрируйся, чтобы вести свой гров и следить за прогрессом.</p>
        <button className="btn btn-primary" onClick={() => openModal('auth')}>Войти / Зарегистрироваться</button>
      </div>
    );
  }

  const grower = findGrowerById(currentUser.growerId);
  const myDiaries = diaries.filter((d) => d.growerId === currentUser.growerId);
  const myContests = contests.filter((c) => joinedContestIds.includes(c.id));
  const myRecipes = recipes.filter((r) => savedRecipeIds.includes(r.id));
  const grownVarieties = growerVarietiesGrown(currentUser.growerId, diaries, varieties);
  const totalWeeks = myDiaries.reduce((sum, d) => sum + d.weeks.length, 0);
  const activeDiaries = myDiaries.filter((d) => d.stage !== 'Собран урожай').length;

  return (
    <>
      <div className="page-hero">
        <div className="wrap" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar name={grower.name} photo={grower.avatar} size={64} online={grower.online} showOnline />
          <div>
            <span className="eyebrow">Мои дневники</span>
            <h1 style={{ margin: '6px 0 0' }}>Привет, {grower.name}!</h1>
          </div>
        </div>
      </div>

      {/* Только вертикальные отступы: shorthand `padding: '36px 0 70px'` обнулял
          боковые (inline бьёт .wrap и его мобильные 18px/14px) — контент
          прилипал к сайдбару. Горизонталь остаётся за .wrap. */}
      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 }}>
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 40 }}>
          <StatsCard label="Всего дневников" value={myDiaries.length} />
          <StatsCard label="Активных гровов" value={activeDiaries} />
          <StatsCard label="Отчётов опубликовано" value={totalWeeks} />
          <StatsCard label="Подписчиков" value={fmtNum(grower.followers)} />
        </div>

        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Достижения</h2>
        <div style={{ marginBottom: 40 }}>
          <AchievementBadges grower={grower} />
        </div>

        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Сорта, которые я выращивал ({grownVarieties.length})</h2>
        {grownVarieties.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 40 }}>
            <p>Пока ни одного сорта — заведи первый дневник!</p>
          </div>
        ) : (
          <div className="card-tags" style={{ marginBottom: 40 }}>
            {grownVarieties.map((v) => (
              <Link key={v.id} to={`/varieties/${v.id}`} style={{ textDecoration: 'none' }}>
                <Badge variant="ember">{v.name}</Badge>
              </Link>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Мои дневники</h2>
        {myDiaries.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 40 }}>
            <p>Ты ещё не завёл ни одного дневника.</p>
          </div>
        ) : (
          <div className="grid grid-3" style={{ marginBottom: 40 }}>
            {myDiaries.map((d) => <DiaryCard key={d.id} diary={d} />)}
          </div>
        )}

        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Мои конкурсы</h2>
        {myContests.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 40 }}>
            <p>Ты пока не участвуешь ни в одном конкурсе.</p>
            <Link to="/contests" className="btn btn-outline" style={{ marginTop: 14 }}>Смотреть конкурсы</Link>
          </div>
        ) : (
          <div className="grid grid-3" style={{ marginBottom: 40 }}>
            {myContests.map((c) => (
              <div className="side-card" key={c.id}>
                <h4 style={{ marginBottom: 8 }}>{c.title}</h4>
                <div className="progress-bar sm"><div style={{ width: `${c.progress}%` }} /></div>
                <span style={{ fontSize: 12, color: 'var(--cream-faint)' }}>{c.participants} участников · до {c.deadline}</span>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Мой банк семян</h2>
        <div style={{ marginBottom: 40 }}>
          <SeedBankSection />
        </div>

        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Сохранённые рецепты ({myRecipes.length})</h2>
        {myRecipes.length === 0 ? (
          <div className="empty-state">
            <p>Ты ещё не сохранил ни одного рецепта.</p>
            <Link to="/recipes" className="btn btn-outline" style={{ marginTop: 14 }}>Смотреть рецепты</Link>
          </div>
        ) : (
          <div className="grid grid-3">
            {myRecipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
          </div>
        )}
      </div>
    </>
  );
}

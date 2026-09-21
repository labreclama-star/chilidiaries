import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Badge from '../components/Badge.jsx';
import StatsCard from '../components/StatsCard.jsx';
import AchievementBadges from '../components/AchievementBadges.jsx';
import DiaryCard from '../components/DiaryCard.jsx';
import RecipeCard from '../components/RecipeCard.jsx';
import ArticleCard from '../components/ArticleCard.jsx';
import SeedBankSection from '../components/SeedBankSection.jsx';
import { fmtNum } from '../utils/helpers.js';

export default function GrowerDetail() {
  const { id } = useParams();
  const {
    growers, diaries, varieties, recipes, blogPosts,
    savedRecipeIds, contests, joinedContestIds,
    currentUser, toggleFollowGrower, openModal, showToast
  } = useApp();
  const g = growers.find((x) => x.id === id);

  if (!g) {
    return (
      <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60 /* бока — из .wrap */ }}>
        <div className="empty-state">
          <p>Гровер не найден.</p>
          <Link to="/growers" className="btn btn-outline" style={{ marginTop: 16 }}>← Все гроверы</Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = !!(currentUser && currentUser.growerId === g.id);
  const growerDiaries = diaries.filter((d) => d.growerId === g.id);
  const totalWeeks = growerDiaries.reduce((sum, d) => sum + d.weeks.length, 0);
  const totalLikes = growerDiaries.reduce((sum, d) => sum + d.likes, 0);
  const followedGrowers = growers.filter((x) => x._followed && x.id !== g.id);

  // Публичные разделы — видны в любом профиле. Всё берётся из контекста
  // (без новых запросов в БД).
  // Рецепты: скрытые админом (hidden) чужим не показываем, владелец видит свои все.
  const growerRecipes = recipes.filter((r) => r.growerId === g.id && (isOwnProfile || !r.hidden));
  // Статьи блога: только одобренные модерацией.
  const growerPosts = blogPosts.filter((p) => p.growerId === g.id && p.status === 'approved');

  // Личные разделы — только в своём профиле (в чужом массивы пустые и не рендерятся).
  const savedRecipes = isOwnProfile ? recipes.filter((r) => savedRecipeIds.includes(r.id)) : [];
  const myContests = isOwnProfile ? contests.filter((c) => joinedContestIds.includes(c.id)) : [];

  const bestVarietyIds = [...new Set(growerDiaries.slice().sort((a, b) => b.shu - a.shu).map((d) => d.varietyId))].slice(0, 4);
  const bestVarieties = bestVarietyIds.map((vid) => varieties.find((v) => v.id === vid)).filter(Boolean);

  return (
    <>
      <div className="page-hero">
        <div className="wrap" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar name={g.name} photo={g.avatar} size={84} online={g.online} showOnline />
          <div style={{ flex: 1, minWidth: 240 }}>
            <span className="eyebrow">Профиль гровера</span>
            <h1 style={{ margin: '8px 0 4px' }}>{g.name}</h1>
            <p style={{ color: 'var(--cream-faint)', fontSize: 13.5, marginBottom: 12 }}>{g.loc}</p>
            <p style={{ color: 'var(--cream-dim)', fontSize: 14.5, maxWidth: 520, marginBottom: 16 }}>{g.bio}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {isOwnProfile ? (
                <button className="btn btn-outline" onClick={() => openModal('editProfile')}>Редактировать профиль</button>
              ) : (
                <button
                  className={'btn btn-outline' + (g._followed ? ' active' : '')}
                  onClick={() => toggleFollowGrower(g.id)}
                >
                  {g._followed ? '✓ Вы подписаны' : '+ Подписаться'}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => showToast('Спасибо! Приём донатов скоро будет доступен 💛')}>♥ Поддержать</button>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 40 }}>
          <StatsCard label="Дневников" value={g.diaries} />
          <StatsCard label="Подписчиков" value={fmtNum(g.followers)} />
          {isOwnProfile && <StatsCard label="Мои подписки" value={followedGrowers.length} />}
          <StatsCard label="Отчётов опубликовано" value={totalWeeks} />
          <StatsCard label="Лайков собрано" value={fmtNum(totalLikes)} />
        </div>

        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Достижения</h2>
        <div style={{ marginBottom: 40 }}>
          <AchievementBadges grower={g} />
        </div>

        {isOwnProfile && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 18 }}>Мои подписки ({followedGrowers.length})</h2>
            {followedGrowers.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: 40 }}>
                <p>Ты пока ни на кого не подписан(а). Загляни в раздел «Гроверы» и найди тех, чей гров интересно читать.</p>
                <Link to="/growers" className="btn btn-outline" style={{ marginTop: 16 }}>Найти гроверов</Link>
              </div>
            ) : (
              <div className="following-grid">
                {followedGrowers.map((fg) => (
                  <Link key={fg.id} to={`/growers/${fg.id}`} className="following-card">
                    <Avatar name={fg.name} photo={fg.avatar} size={40} online={fg.online} showOnline />
                    <div>
                      <b>{fg.name}</b>
                      <span>{fg.loc}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {bestVarieties.length > 0 && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Любимые сорта</h2>
            <div className="card-tags" style={{ marginBottom: 40 }}>
              {bestVarieties.map((v) => <Badge key={v.id} variant="ember">{v.name}</Badge>)}
            </div>
          </>
        )}

        {/* ---------- Публичные разделы (для всех профилей) ---------- */}
        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Дневники {g.name}</h2>
        {growerDiaries.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 40 }}>
            <p>{isOwnProfile ? 'Ты ещё не завёл ни одного дневника.' : 'Пока нет опубликованных дневников.'}</p>
          </div>
        ) : (
          <div className="grid grid-3" style={{ marginBottom: 40 }}>
            {growerDiaries.map((d) => <DiaryCard key={d.id} diary={d} />)}
          </div>
        )}

        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Рецепты ({growerRecipes.length})</h2>
        {growerRecipes.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 40 }}>
            <p>{isOwnProfile ? 'Ты ещё не опубликовал ни одного рецепта.' : 'Пока нет опубликованных рецептов.'}</p>
            {isOwnProfile && <Link to="/recipes" className="btn btn-outline" style={{ marginTop: 14 }}>Перейти к рецептам</Link>}
          </div>
        ) : (
          <div className="grid grid-3" style={{ marginBottom: 40 }}>
            {growerRecipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
          </div>
        )}

        <h2 style={{ fontSize: 20, marginBottom: 18 }}>Статьи блога ({growerPosts.length})</h2>
        {growerPosts.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 40 }}>
            <p>{isOwnProfile ? 'У тебя пока нет опубликованных статей.' : 'Пока нет опубликованных статей.'}</p>
          </div>
        ) : (
          <div className="grid grid-3" style={{ marginBottom: 40 }}>
            {growerPosts.map((p) => <ArticleCard key={p.id} post={p} />)}
          </div>
        )}

        {/* ---------- Личные разделы (только в своём профиле) ---------- */}
        {isOwnProfile && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 18 }}>Сохранённые рецепты ({savedRecipes.length})</h2>
            {savedRecipes.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: 40 }}>
                <p>Ты ещё не сохранил ни одного рецепта.</p>
                <Link to="/recipes" className="btn btn-outline" style={{ marginTop: 14 }}>Смотреть рецепты</Link>
              </div>
            ) : (
              <div className="grid grid-3" style={{ marginBottom: 40 }}>
                {savedRecipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
              </div>
            )}

            <h2 style={{ fontSize: 20, marginBottom: 18 }}>Мой банк семян</h2>
            <div style={{ marginBottom: 40 }}>
              <SeedBankSection />
            </div>

            <h2 style={{ fontSize: 20, marginBottom: 18 }}>Мои конкурсы</h2>
            {myContests.length === 0 ? (
              <div className="empty-state">
                <p>Ты пока не участвуешь ни в одном конкурсе.</p>
                <Link to="/contests" className="btn btn-outline" style={{ marginTop: 14 }}>Смотреть конкурсы</Link>
              </div>
            ) : (
              <div className="grid grid-3">
                {myContests.map((c) => (
                  <div className="side-card" key={c.id}>
                    <h4 style={{ marginBottom: 8 }}>{c.title}</h4>
                    <div className="progress-bar sm"><div style={{ width: `${c.progress}%` }} /></div>
                    <span style={{ fontSize: 12, color: 'var(--cream-faint)' }}>{c.participants} участников · до {c.deadline}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

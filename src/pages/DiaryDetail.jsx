import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Avatar from '../components/Avatar.jsx';
import PepperIcon from '../components/PepperIcon.jsx';
import Badge from '../components/Badge.jsx';
import WeekItem from '../components/WeekItem.jsx';
import DiaryHeroGallery from '../components/DiaryHeroGallery.jsx';
import Comment from '../components/Comment.jsx';
import AddWeekReportForm from '../components/AddWeekReportForm.jsx';
import StatsCard from '../components/StatsCard.jsx';
import AchievementBadges from '../components/AchievementBadges.jsx';
import { MiniHeatGauge } from '../components/HeatGauge.jsx';
import { heatColor, fmtNum, varietyNames, diaryMediaStyle, latestReportDay, communityShuDelta, varietyProgressInsight, intervalLabel, DIARY_STAGES } from '../utils/helpers.js';

export default function DiaryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    diaries, varieties, growers, loadFullDiary,
    currentUser, toggleLikeDiary, toggleFollowGrower, addComment, showToast,
    subscribedDiaryIds, toggleDiarySubscription, updateDiaryStage, openModal
  } = useApp();
  const [commentText, setCommentText] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);
  const [fullLoadFailed, setFullLoadFailed] = useState(false);

  useEffect(() => {
    setShowAllComments(false);
    setCommentText('');
    setFullLoadFailed(false);
  }, [id]);

  const findVariety = (vid) => varieties.find((x) => x.id === vid);
  const d = diaries.find((x) => x.id === id);

  // Список дневников — облегчённый: weeks/comments там заглушки для DiaryCard
  // (d._partial === true, см. diaryListRowToJs). Пока не подтянули полный
  // дневник, страницу не рендерим (иначе Comment получает undefined).
  const needsFullLoad = !!d?._partial;
  useEffect(() => {
    if (!needsFullLoad) return;
    let cancelled = false;
    loadFullDiary(id).then((full) => {
      if (!cancelled && !full) setFullLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, [id, needsFullLoad, loadFullDiary]);

  if (!d) {
    return (
      <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60 /* бока — из .wrap */ }}>
        <div className="empty-state">
          <p>Дневник не найден.</p>
          <Link to="/diaries" className="btn btn-outline" style={{ marginTop: 16 }}>← Все дневники</Link>
        </div>
      </div>
    );
  }

  if (d._partial) {
    return (
      <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60 /* бока — из .wrap */ }}>
        <div className="empty-state">
          {fullLoadFailed ? (
            <>
              <p>Не удалось загрузить дневник.</p>
              <Link to="/diaries" className="btn btn-outline" style={{ marginTop: 16 }}>← Все дневники</Link>
            </>
          ) : (
            <p>Загружаю дневник…</p>
          )}
        </div>
      </div>
    );
  }

  const v = findVariety(d.varietyId);
  const g = growers.find((x) => x.id === d.growerId);
  const color = heatColor(d.shu);
  const isOwner = !!(currentUser && currentUser.growerId === d.growerId);

  const heroFallbackStyle = { background: `radial-gradient(circle at 30% 20%,${color}40,var(--soil-900) 75%)` };
  // Собираем все фото дневника (обложка + фото из всех отчётов) для галереи —
  // раньше в hero показывалось только одно статичное фото.
  const galleryPhotos = Array.from(new Set([
    d.coverPhoto,
    ...d.weeks.flatMap((w) => (w.photos && w.photos.length ? w.photos : (w.photo ? [w.photo] : [])))
  ].filter(Boolean)));
  if (galleryPhotos.length === 0 && v && v.photo) galleryPhotos.push(v.photo);
  const days = latestReportDay(d);
  const shuDelta = communityShuDelta(d, diaries);
  const insight = varietyProgressInsight(d.varietyId, diaries);

  let related = diaries.filter((x) => x.id !== d.id && x.varietyId === d.varietyId).slice(0, 3);
  if (related.length === 0) related = diaries.filter((x) => x.id !== d.id).slice(0, 3);

  function handleShare() {
    showToast('Ссылка на дневник скопирована в буфер обмена', 'success');
  }

  function handleGrowerClick() {
    navigate(`/growers/${g.id}`);
  }

  function handleSubmitComment() {
    const text = commentText.trim();
    if (!text) { showToast('Введи текст комментария'); return; }
    addComment(d.id, text);
    setCommentText('');
  }

  if (!v || !g) return null;

  return (
    <div className="wrap diary-detail-grid">
      <div>
        <div className="diary-hero-media" style={galleryPhotos.length ? undefined : heroFallbackStyle}>
          {galleryPhotos.length > 0 ? (
            <DiaryHeroGallery photos={galleryPhotos} />
          ) : (
            <PepperIcon color={color} />
          )}
          <Badge kind="stage">{d.stage}</Badge>
          <Badge kind="heat">{fmtNum(Math.round(d.shu))} SHU</Badge>
        </div>

        <div className="diary-title-row">
          <div>
            <span className="eyebrow">{varietyNames(d, findVariety)}</span>
            <h1>{d.title}</h1>
            {days != null && <span className="day-count-line">Последний отчёт: день {days} · интервал: {intervalLabel(d.reportInterval)}</span>}
          </div>
          <div className="diary-actions">
            <button
              className={'btn-icon like-action' + (d.liked ? ' active' : '')}
              aria-label="Нравится"
              onClick={() => toggleLikeDiary(d.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                <path d="M12 21s-7-4.5-9.5-9C.7 8.2 2 4.5 5.5 3.8 8 3.3 10 4.7 12 7c2-2.3 4-3.7 6.5-3.2C22 4.5 23.3 8.2 21.5 12c-2.5 4.5-9.5 9-9.5 9Z" />
              </svg>
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleShare}>Поделиться</button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => openModal('diaryReport', { diaryId: d.id })}
            >
              ⭳ Экспорт в PDF
            </button>
            {!isOwner && (
              <button
                className={'btn btn-sm' + (subscribedDiaryIds.includes(d.id) ? ' btn-outline active' : ' btn-outline')}
                onClick={() => {
                  if (!currentUser) { showToast('Войди, чтобы подписаться на дневник'); return; }
                  toggleDiarySubscription(d.id, d.title);
                }}
              >
                {subscribedDiaryIds.includes(d.id) ? '🔔 Вы подписаны' : '🔔 Подписаться на обновления'}
              </button>
            )}
          </div>
        </div>

        <div className="grower-line" style={{ cursor: 'pointer' }} onClick={handleGrowerClick}>
          <Avatar name={g.name} photo={g.avatar} size={34} online={g.online} showOnline />
          <div><b>{g.name}</b><span>{g.loc} · {g.followers} подписчиков</span></div>
        </div>

        {d.desc && <p style={{ color: 'var(--cream-dim)', fontSize: 14.5, lineHeight: 1.6, marginBottom: 24 }}>{d.desc}</p>}

        <div className="meta-strip" style={isOwner && d.stage !== 'Собран урожай' ? { marginBottom: 10 } : undefined}>
          <div><label>Среда</label><strong>{d.medium}</strong></div>
          <div><label>Место</label><strong>{d.location}</strong></div>
          <div>
            <label>Стадия</label>
            {isOwner ? (
              <select
                className="stage-select"
                value={d.stage}
                onChange={(e) => updateDiaryStage(d.id, e.target.value)}
              >
                {DIARY_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <strong>{d.stage}</strong>
            )}
          </div>
          <div><label>Отчётов</label><strong>{d.weeks.length}</strong></div>
        </div>
        {isOwner && d.stage !== 'Собран урожай' && (
          <p style={{ fontSize: 12, color: 'var(--cream-faint)', marginBottom: 24 }}>
            Когда соберёшь урожай, отметь стадию «Собран урожай» — это закроет сезон и откроет бейдж «Закрытие сезона» 🎖️
          </p>
        )}

        {shuDelta != null && (
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginBottom: 34 }}>
            <StatsCard
              label="Острота этого грова"
              value={fmtNum(Math.round(d.shu))}
              unit="SHU"
              delta={shuDelta}
              compareLabel={`к среднему по ${v.name}`}
            />
            <StatsCard
              label="Лайков"
              value={fmtNum(d.likes)}
            />
          </div>
        )}

        <h2 style={{ fontSize: 22, marginBottom: 20 }}>Хронология роста</h2>
        {isOwner && <AddWeekReportForm diary={d} />}
        {d.weeks.length > 0 && (
          <div className="day-nav-row">
            {d.weeks.map((w) => (
              <a key={w.n} href={`#report-day-${w.day || w.n}`} className="day-nav-pill">
                День {w.day || w.n}
              </a>
            ))}
          </div>
        )}
        {d.weeks.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 20 }}>
            <p>Пока нет ни одного отчёта.{isOwner ? ' Опубликуй первый выше!' : ''}</p>
          </div>
        ) : (
          <div className="weeks">
            {d.weeks.map((w) => <WeekItem key={w.n} week={w} diaryColor={color} />)}
          </div>
        )}

        <div className="comments-block">
          <h2 style={{ fontSize: 22, marginBottom: 20 }}>Комментарии ({d.comments.length})</h2>
          {(showAllComments ? d.comments : d.comments.slice(0, 3)).map((c, i) => <Comment key={c.id ?? i} comment={c} />)}
          {!showAllComments && d.comments.length > 3 && (
            <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => setShowAllComments(true)}>
              Показать все комментарии ({d.comments.length})
            </button>
          )}
          <div className="comment-form">
            <Avatar name={currentUser ? currentUser.name : 'Гость'} size={34} />
            <textarea
              placeholder={currentUser ? 'Оставь комментарий…' : 'Войди, чтобы оставить комментарий…'}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSubmitComment}>Отправить</button>
          </div>
        </div>
      </div>

      <aside>
        <div className="side-card">
          <h4>Гровер</h4>
          <div className="side-grower">
            <Avatar name={g.name} photo={g.avatar} size={44} online={g.online} showOnline />
            <div><b>{g.name}</b><span>{g.loc}</span></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--cream-dim)', marginBottom: 14 }}>{g.bio}</p>
          <div className="side-stats">
            <div><b>{g.diaries}</b><span>Дневников</span></div>
            <div><b>{g.followers}</b><span>Подписчиков</span></div>
          </div>
          <button
            className={'btn btn-outline btn-block follow-btn' + (g._followed ? ' active' : '')}
            onClick={() => toggleFollowGrower(g.id)}
            disabled={isOwner}
            style={isOwner ? { opacity: 0.5, cursor: 'default' } : undefined}
          >
            {isOwner ? 'Это твой дневник' : (g._followed ? '✓ Вы подписаны' : '+ Подписаться')}
          </button>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--scorch-line-soft)' }}>
            <AchievementBadges grower={g} />
          </div>
        </div>

        <div className="side-card">
          <h4>О сорте</h4>
          <b style={{ display: 'block', color: 'var(--white)', fontSize: 15, marginBottom: 6 }}>{v.name}</b>
          <MiniHeatGauge shu={d.shu} />
          <p style={{ fontSize: 13, color: 'var(--cream-dim)', margin: '10px 0' }}>{v.desc}</p>
          <div className="side-stats">
            <div><b>{fmtNum(v.shuMin)}-{fmtNum(v.shuMax)}</b><span>SHU</span></div>
            <div><b>{v.days}</b><span>Дней</span></div>
          </div>
          {insight && (
            <p style={{ fontSize: 12.5, color: 'var(--cream-faint)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--scorch-line-soft)', lineHeight: 1.6 }}>
              📊 У {insight.pct}% гроверов ({insight.total} дневников) этот сорт дошёл до плодоношения{insight.avgWeeks ? ` в среднем за ${insight.avgWeeks} отчётов` : ''}
            </p>
          )}
        </div>

        <div className="side-card">
          <h4>Поддержать проект</h4>
          <p style={{ fontSize: 12.5, color: 'var(--cream-dim)', marginBottom: 12 }}>ChiliDiaries — некоммерческий проект сообщества. Если он тебе полезен, можешь его поддержать.</p>
          <button className="btn btn-outline btn-block" onClick={() => showToast('Спасибо! Приём донатов скоро будет доступен 💛')}>♥ Поддержать проект</button>
        </div>

        <div className="side-card">
          <h4>Похожие дневники</h4>
          {related.map((r) => {
            const rv = findVariety(r.varietyId);
            const rc = heatColor(r.shu);
            return (
              <div className="related-mini" key={r.id} onClick={() => navigate(`/diaries/${r.id}`)}>
                <div className="pod-media" style={diaryMediaStyle(r, rv, rc)}>
                  {!(r.coverPhoto || (rv && rv.photo)) && <PepperIcon color={rc} />}
                </div>
                <div><b>{r.title}</b><span>{rv ? rv.name : ''} · {r.likes} лайков</span></div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

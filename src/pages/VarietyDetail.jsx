import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import PepperIcon from '../components/PepperIcon.jsx';
import DiaryCard from '../components/DiaryCard.jsx';
import StarRating from '../components/StarRating.jsx';
import VarietyRatingBlock from '../components/VarietyRatingBlock.jsx';
import PhotoFrame from '../components/PhotoFrame.jsx';
import { HeroHeatGauge } from '../components/HeatGauge.jsx';
import { heatColor, fmtNum, podMediaStyle, varietyProgressInsight } from '../utils/helpers.js';
import { computeVarietyRatings } from '../utils/varietyRatings.js';

export default function VarietyDetail() {
  const { id } = useParams();
  const { varieties, diaries, varietyVotes } = useApp();
  const v = varieties.find((x) => x.id === id);

  if (!v) {
    return (
      <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60 /* бока — из .wrap */ }}>
        <div className="empty-state">
          <p>Сорт не найден.</p>
          <Link to="/varieties" className="btn btn-outline" style={{ marginTop: 16 }}>← Весь каталог</Link>
        </div>
      </div>
    );
  }

  const avgShu = (v.shuMin + v.shuMax) / 2;
  const color = heatColor(avgShu);
  const growingDiaries = diaries.filter((d) => d.varietyId === v.id || (d.varietyIds && d.varietyIds.includes(v.id)));
  const insight = varietyProgressInsight(v.id, diaries);
  const communityRatings = computeVarietyRatings(v, varietyVotes);

  return (
    <div className="wrap" style={{ paddingTop: 36, paddingBottom: 70 /* бока — из .wrap */ }}>
      <div className="diary-detail-grid">
        <div>
          <div className="diary-hero-media" style={v.photo ? undefined : podMediaStyle(v, color)}>
            <PhotoFrame src={v.photo} />
            {v.userAdded && <span className="stage-tag">От сообщества</span>}
            <span className="heat-badge">{fmtNum(v.shuMin)}–{fmtNum(v.shuMax)} SHU</span>
            {!v.photo && <PepperIcon color={color} />}
          </div>

          <span className="eyebrow">{v.species}</span>
          <h1 style={{ margin: '10px 0 12px' }}>{v.name}</h1>
          <div style={{ marginBottom: 18 }}><StarRating value={communityRatings.overall} /></div>
          <p style={{ color: 'var(--cream-dim)', fontSize: 15.5, lineHeight: 1.75, marginBottom: 28 }}>{v.desc}</p>

          <div className="meta-strip">
            <div><label>Происхождение</label><strong>{v.origin}</strong></div>
            <div><label>Сложность</label><strong>{v.difficulty}</strong></div>
            <div><label>Срок созревания</label><strong>{v.days} дн.</strong></div>
            <div><label>Дневников в сообществе</label><strong>{growingDiaries.length}</strong></div>
          </div>

          {insight && (
            <div className="side-card" style={{ marginBottom: 34 }}>
              <h4>Статистика сообщества</h4>
              <p style={{ fontSize: 13.5, color: 'var(--cream-dim)', lineHeight: 1.7 }}>
                📊 У {insight.pct}% гроверов ({insight.total} дневников) этот сорт дошёл до плодоношения
                {insight.avgWeeks ? ` в среднем за ${insight.avgWeeks} отчётов.` : '.'}
              </p>
            </div>
          )}

          <h2 style={{ fontSize: 20, marginBottom: 18 }}>Дневники с этим сортом</h2>
          {growingDiaries.length === 0 ? (
            <div className="empty-state">
              <p>Пока никто не завёл дневник с этим сортом. Стань первым!</p>
            </div>
          ) : (
            <div className="grid grid-2">
              {growingDiaries.map((d) => <DiaryCard key={d.id} diary={d} />)}
            </div>
          )}
        </div>

        <aside>
          <VarietyRatingBlock variety={v} />
          <div className="side-card">
            <h4>Шкала остроты</h4>
            <HeroHeatGauge shu={avgShu} label={`${fmtNum(Math.round(avgShu))} SHU`} />
            <div className="heat-scale-labels" style={{ marginTop: 12 }}>
              <span>Мягкий</span><span>Средний</span><span>Острый</span><span>Экстрим</span>
            </div>
          </div>
          {v.userAdded && (
            <div className="side-card">
              <h4>Добавлено сообществом</h4>
              <p style={{ fontSize: 13, color: 'var(--cream-dim)' }}>Автор: {v.addedBy || 'гровер ChiliDiaries'}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

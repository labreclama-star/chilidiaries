import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import { useApp } from '../context/AppContext.jsx';
import { stageColorMap } from '../utils/helpers.js';

export default function FeedItem({ diary, week }) {
  const { growers, varieties } = useApp();
  const g = growers.find((x) => x.id === diary.growerId);
  const v = varieties.find((x) => x.id === diary.varietyId);
  if (!g) return null;

  const wc = stageColorMap[week.stage] || 'var(--ember)';
  const cover = week.photos && week.photos.length ? week.photos[0] : null;

  return (
    <div className="card" style={{ flexDirection: 'row', overflow: 'hidden' }}>
      <Link
        to={`/diaries/${diary.id}#report-day-${week.day || week.n}`}
        className="pod-media"
        style={{
          width: 140, aspectRatio: 'auto', flexShrink: 0, borderRadius: 0,
          ...(cover
            ? { backgroundImage: `url('${cover}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: `radial-gradient(circle at 30% 20%,${wc}40,var(--soil-900) 75%)` })
        }}
      />
      <div className="card-body" style={{ padding: 16, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Avatar name={g.name} photo={g.avatar} size={22} online={g.online} showOnline />
          <Link to={`/growers/${g.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)', textDecoration: 'none' }}>{g.name}</Link>
          <span style={{ fontSize: 12, color: 'var(--cream-faint)' }}>· День {week.day || week.n}</span>
        </div>
        <Link to={`/diaries/${diary.id}`} style={{ textDecoration: 'none' }}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>{diary.title}{v ? ` — ${v.name}` : ''}</h3>
        </Link>
        <p style={{ fontSize: 13, color: 'var(--cream-dim)', margin: 0 }}>{week.title}: {week.note}</p>
      </div>
    </div>
  );
}

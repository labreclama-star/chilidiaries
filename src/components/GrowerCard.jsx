import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import AchievementBadges from './AchievementBadges.jsx';
import Badge from './Badge.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function GrowerCard({ grower }) {
  const { toggleFollowGrower, currentUser } = useApp();
  const isSelf = !!(currentUser && currentUser.growerId === grower.id);
  return (
    <div className="card grower-card">
      <Link to={`/growers/${grower.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
        <Avatar name={grower.name} photo={grower.avatar} size={64} online={grower.online} showOnline />
        <h3>{grower.name}</h3>
        {grower.banned && (
          <Badge kind="tag" variant="ember" style={{ marginTop: 6 }}>Забанен</Badge>
        )}
        <div className="loc">{grower.loc}</div>
      </Link>
      <div className="gstats">
        <div><b>{grower.diaries}</b><span>Дневников</span></div>
        <div><b>{grower.followers}</b><span>Подписчиков</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <AchievementBadges grower={grower} size="sm" unlockedOnly limit={4} />
      </div>
      {isSelf ? (
        <Link to={`/growers/${grower.id}`} className="btn btn-outline btn-block btn-sm">Это твой профиль</Link>
      ) : (
        <button
          className={'btn btn-outline btn-block btn-sm' + (grower._followed ? ' active' : '')}
          onClick={() => toggleFollowGrower(grower.id)}
        >
          {grower._followed ? '✓ Подписан' : '+ Подписаться'}
        </button>
      )}
    </div>
  );
}

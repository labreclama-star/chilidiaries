import { growerBadges, growerVarietyIdsGrown } from '../utils/helpers.js';
import { useApp } from '../context/AppContext.jsx';

export default function AchievementBadges({ grower, size, unlockedOnly, limit }) {
  const { diaries } = useApp();
  const varietiesGrownCount = growerVarietyIdsGrown(grower.id, diaries).size;
  const harvestedDiariesCount = diaries.filter((d) => d.growerId === grower.id && d.stage === 'Собран урожай').length;
  let badges = growerBadges(grower, varietiesGrownCount, harvestedDiariesCount);
  if (unlockedOnly) badges = badges.filter((b) => b.unlocked);
  if (limit) badges = badges.slice(0, limit);
  const isSm = size === 'sm';

  return (
    <div className="achievements-row" style={isSm ? { gap: 8 } : undefined}>
      {badges.map((b) => (
        <div key={b.label} className={'achievement-badge' + (b.unlocked ? '' : ' locked')} style={isSm ? { width: 'auto' } : undefined}>
          <div className="badge-emblem" style={isSm ? { width: 36, height: 36, borderRadius: 10, fontSize: 15 } : undefined}>{b.icon}</div>
          {!isSm && <span className="badge-label">{b.label}</span>}
        </div>
      ))}
    </div>
  );
}

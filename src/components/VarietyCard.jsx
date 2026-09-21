import { Link } from 'react-router-dom';
import PepperIcon from './PepperIcon.jsx';
import Badge from './Badge.jsx';
import StarRating from './StarRating.jsx';
import { MiniHeatGauge } from './HeatGauge.jsx';
import { heatColor, fmtNum, podMediaStyle } from '../utils/helpers.js';
import { computeVarietyRatings } from '../utils/varietyRatings.js';
import { useApp } from '../context/AppContext.jsx';

export default function VarietyCard({ variety }) {
  const { varietyVotes } = useApp();
  const avgShu = (variety.shuMin + variety.shuMax) / 2;
  const color = heatColor(avgShu);
  const ratings = computeVarietyRatings(variety, varietyVotes);
  return (
    <Link to={`/varieties/${variety.id}`} className="card" style={{ cursor: 'pointer' }}>
      <div className="pod-media" style={podMediaStyle(variety, color)}>
        <Badge kind="heat">{fmtNum(variety.shuMax)} SHU</Badge>
        {!variety.photo && <PepperIcon color={color} />}
        {variety.userAdded && (
          <Badge kind="stage" style={{ right: 10, left: 'auto' }}>от сообщества</Badge>
        )}
      </div>
      <div className="card-body">
        <h3>{variety.name}</h3>
        <span style={{ fontSize: 11.5, color: 'var(--cream-faint)' }}>{variety.species}</span>
        <StarRating value={ratings.overall} compact />
        <MiniHeatGauge shu={avgShu} />
        <p style={{ fontSize: 12.5, color: 'var(--cream-dim)' }}>{variety.desc}</p>
        <div className="card-tags">
          <Badge>Сложность: {variety.difficulty}</Badge>
          <Badge>{variety.days} дн.</Badge>
        </div>
      </div>
    </Link>
  );
}

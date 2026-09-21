/**
 * Small data-dashboard-style stat block:
 *   LABEL
 *   428 g
 *   +36% above community average
 *
 * `delta` is a signed number (percent); omit it to render a plain stat
 * with no comparison row.
 */
export default function StatsCard({ label, value, unit, delta, compareLabel = 'среднее по сообществу' }) {
  const hasDelta = typeof delta === 'number' && !Number.isNaN(delta);
  const isUp = hasDelta && delta >= 0;
  return (
    <div className="stats-card">
      <span className="stats-label">{label}</span>
      <span className="stats-value">{value}{unit && <small>{unit}</small>}</span>
      {hasDelta && (
        <div className="stats-compare">
          <span className={'delta ' + (isUp ? 'up' : 'down')}>
            {isUp ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
          <span className="vs-label">{compareLabel}</span>
        </div>
      )}
    </div>
  );
}

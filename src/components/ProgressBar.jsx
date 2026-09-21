/**
 * Generic progress bar. `value`/`max` compute the fill percentage.
 * `tone="ember"` switches the fill gradient from the default leaf→habanero
 * to ember→ember-bright (used for "heat" / urgency contexts).
 */
export default function ProgressBar({ value, max = 100, tone, size, label }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className={'progress-bar' + (tone === 'ember' ? ' ember' : '') + (size === 'sm' ? ' sm' : '')}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {label && <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{label}</span>}
    </div>
  );
}

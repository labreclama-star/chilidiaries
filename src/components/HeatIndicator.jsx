import { heatGaugePos, heatColor, heatLevelLabel, fmtNum } from '../utils/helpers.js';

/**
 * Compact heat indicator: a thin gradient bar with a positioned dot plus the
 * SHU number and a plain-language level word. Designed to sit inline in a
 * card or overlay on a photo without competing with the page's big signature
 * gauge (see HeatGauge.jsx for that one).
 */
export default function HeatIndicator({ shu, compact }) {
  const pos = heatGaugePos(shu);
  const color = heatColor(shu);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="heat-gauge">
        <div className="bar" style={{ height: 5 }} />
        <div className="marker" style={{ height: 14, top: -4.5, left: `${pos}%` }} />
      </div>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color }}>{heatLevelLabel(shu)}</span>
          <span style={{ color: 'var(--text-faint)' }}>{fmtNum(Math.round(shu))} SHU</span>
        </div>
      )}
    </div>
  );
}

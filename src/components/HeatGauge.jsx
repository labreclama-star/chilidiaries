import { heatGaugePos } from '../utils/helpers.js';

/** Small inline gauge used on variety/diary cards. */
export function MiniHeatGauge({ shu }) {
  const pos = heatGaugePos(shu);
  return (
    <div className="heat-gauge" style={{ margin: '2px 0' }}>
      <div className="bar" style={{ height: 6 }} />
      <div className="marker" style={{ height: 16, top: -5, left: `${pos}%` }} data-val="" />
    </div>
  );
}

/** Large signature gauge used in the hero section. */
export function HeroHeatGauge({ shu, label }) {
  const pos = heatGaugePos(shu);
  return (
    <div className="heat-gauge">
      <div className="bar" />
      <div className="marker" data-val={label} style={{ left: `${pos}%` }} />
    </div>
  );
}

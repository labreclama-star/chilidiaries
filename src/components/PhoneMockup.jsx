import { DIARY_STAGES, stageColorMap, latestReportDay, fmtNum } from '../utils/helpers.js';

/** Short labels for the stage dots — the phone mockup is too narrow for full stage names. */
const STAGE_SHORT = {
  'Рассада': 'Расс.',
  'Вегетация': 'Вег.',
  'Цветение': 'Цвет.',
  'Плодоношение': 'Плод.',
  'Собран урожай': 'Урожай'
};

/** Small rising sparkline — purely illustrative (ripening chilies really do get hotter over time). */
function HeatSparkline({ points, color }) {
  const w = 220, h = 56;
  const max = Math.max(...points);
  const min = Math.min(...points) * 0.85;
  const stepX = w / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p - min) / (max - min)) * h;
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="phone-chart-svg">
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="4" fill={color} />
    </svg>
  );
}

/**
 * Illustrative phone mockup for the homepage hero — built from real seed
 * data (variety, diary stage/weeks, grower badge progress) rather than a
 * static screenshot, so it stays accurate if the underlying data changes.
 */
export default function PhoneMockup({ diary, variety, grower, badges }) {
  const stageIndex = DIARY_STAGES.indexOf(diary.stage);
  const lastWeek = diary.weeks[diary.weeks.length - 1];
  const day = latestReportDay(diary) ?? 1;
  const unlockedBadges = badges.filter((b) => b.unlocked);

  const shuTrend = [
    variety.shuMin * 0.35,
    variety.shuMin * 0.55,
    variety.shuMin * 0.8,
    variety.shuMin,
    (variety.shuMin + variety.shuMax) / 2,
    variety.shuMax
  ];

  return (
    <div className="phone-mockup">
      <div className="phone-notch" />
      <div className="phone-screen">
        <div className="phone-header">
          <span className="phone-pepper">🌶️</span>
          <div>
            <b>{variety.name}</b>
            <span>Дневник грова</span>
          </div>
        </div>

        <div className="phone-stage-row">
          {DIARY_STAGES.map((s, i) => (
            <div key={s} className={'phone-stage-dot' + (i <= stageIndex ? ' done' : '') + (i === stageIndex ? ' active' : '')}>
              <i style={i === stageIndex ? { background: stageColorMap[s] || 'var(--ember)' } : undefined} />
              <label>{STAGE_SHORT[s] || s}</label>
            </div>
          ))}
        </div>

        <div className="phone-block">
          <div className="phone-block-head"><span>Сегодня</span><b>День {day}</b></div>
          <div className="phone-row"><span>Температура</span><b>{lastWeek ? lastWeek.temp : '—'}°C</b></div>
          <div className="phone-row"><span>Влажность</span><b>{lastWeek ? lastWeek.hum : '—'}%</b></div>
          <div className="phone-row"><span>Заметка</span><b className="phone-note">{lastWeek ? lastWeek.note.slice(0, 34) + '…' : '—'}</b></div>
        </div>

        <div className="phone-block">
          <div className="phone-block-head"><span>Острота (лучший замер)</span><b className="phone-shu">{fmtNum(Math.round(variety.shuMax))} SHU</b></div>
          <HeatSparkline points={shuTrend} color="var(--ember-bright)" />
        </div>

        <div className="phone-block">
          <div className="phone-block-head"><span>Твой прогресс</span><b>{unlockedBadges.length} из {badges.length} бейджей</b></div>
          <div className="phone-badges-row">
            {badges.slice(0, 5).map((b) => (
              <span key={b.label} className={'phone-badge-hex' + (b.unlocked ? '' : ' locked')} title={b.label}>{b.icon}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

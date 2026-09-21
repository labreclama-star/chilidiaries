// Простые SVG-графики для дашборда админки — без внешних зависимостей
// (в проекте специально нет chart.js, см. HANDOFF.md / требования Этапа 3).

const W = 560;
const H = 160;
const PAD = 24;

/** Столбчатый график по дням: values = [{ label, value }] */
export function AdminBarChart({ values, color = 'var(--ember)' }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  const barW = (W - PAD * 2) / values.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {values.map((v, i) => {
        const h = ((H - PAD * 2) * v.value) / max;
        const x = PAD + i * barW;
        const y = H - PAD - h;
        return (
          <g key={i}>
            <rect x={x + barW * 0.15} y={y} width={barW * 0.7} height={h} rx="3" fill={color} />
            {i % 2 === 0 && (
              <text x={x + barW / 2} y={H - 6} fontSize="9" textAnchor="middle" fill="var(--cream-faint)">{v.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Линейный график по дням: values = [{ label, value }] */
export function AdminLineChart({ values, color = 'var(--habanero)' }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  const stepX = (W - PAD * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((H - PAD * 2) * v.value) / max;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => {
        const [x, y] = points[i].split(',');
        return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
      })}
      {values.map((v, i) => (
        i % 2 === 0 && (
          <text key={i} x={points[i].split(',')[0]} y={H - 6} fontSize="9" textAnchor="middle" fill="var(--cream-faint)">{v.label}</text>
        )
      ))}
    </svg>
  );
}

/** Горизонтальные бары для топ-N рейтингов: items = [{ label, value }] */
export function AdminHBarList({ items, color = 'var(--ember)' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>{item.label}</span>
            <b>{item.value}</b>
          </div>
          <div style={{ height: 8, borderRadius: 5, background: 'var(--soil-800)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(item.value / max) * 100}%`, background: color, borderRadius: 5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

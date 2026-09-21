function Star({ fill }) {
  // fill: 0 (empty), 0.5 (half), 1 (full)
  const id = `star-clip-${Math.random().toString(36).slice(2)}`;
  return (
    <svg viewBox="0 0 20 20" width="14" height="14">
      <defs>
        <clipPath id={id}><rect x="0" y="0" width={20 * fill} height="20" /></clipPath>
      </defs>
      <path d="M10 1.5l2.6 5.4 5.9.7-4.3 4.1 1 5.9-5.2-2.9-5.2 2.9 1-5.9L1.5 7.6l5.9-.7Z" fill="none" stroke="var(--habanero)" strokeWidth="1" />
      <path d="M10 1.5l2.6 5.4 5.9.7-4.3 4.1 1 5.9-5.2-2.9-5.2 2.9 1-5.9L1.5 7.6l5.9-.7Z" fill="var(--habanero)" clipPath={`url(#${id})`} />
    </svg>
  );
}

/** label under/next to the stars, e.g. "Рейтинг", "Капсаицин", "Аромат" */
export default function StarRating({ value, label, compact }) {
  if (value == null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {label && !compact && <span style={{ fontSize: 11.5, color: 'var(--cream-faint)', minWidth: 78 }}>{label}</span>}
        <span style={{ fontSize: 11.5, color: 'var(--cream-faint)' }}>ещё нет оценок</span>
      </div>
    );
  }
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill = Math.max(0, Math.min(1, value - (i - 1)));
    stars.push(<Star key={i} fill={fill} />);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label && !compact && <span style={{ fontSize: 11.5, color: 'var(--cream-faint)', minWidth: 78 }}>{label}</span>}
      <div style={{ display: 'flex', gap: 1 }}>{stars}</div>
      {!compact && <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--cream-dim)' }}>{value.toFixed(1)}</span>}
    </div>
  );
}

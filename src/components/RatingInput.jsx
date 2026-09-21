import { useState } from 'react';

const STAR_PATH = 'M10 1.5l2.6 5.4 5.9.7-4.3 4.1 1 5.9-5.2-2.9-5.2 2.9 1-5.9L1.5 7.6l5.9-.7Z';

/**
 * Clickable 1-5 whole-star input (as opposed to StarRating, which only
 * *displays* a value, including halves). Used for casting/editing a
 * community vote — hovering previews the value, clicking commits it.
 */
export default function RatingInput({ label, value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {label && <span style={{ fontSize: 12.5, color: 'var(--cream-dim)', minWidth: 92 }}>{label}</span>}
      <div style={{ display: 'flex', gap: 2 }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="rating-input-star"
            aria-label={`Поставить ${n} из 5`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
          >
            <svg viewBox="0 0 20 20" width="20" height="20">
              <path
                d={STAR_PATH}
                fill={n <= shown ? 'var(--habanero)' : 'none'}
                stroke="var(--habanero)"
                strokeWidth="1"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

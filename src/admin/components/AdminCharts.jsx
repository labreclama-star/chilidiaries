// Простые SVG-графики для дашборда админки — без внешних зависимостей
// (в проекте специально нет chart.js, см. HANDOFF.md / требования Этапа 3).
//
// Этап 3.1: добавлены ось Y с тиками, бледная сетка, заголовок с суммой,
// тултипы по hover/tap, подсветка последней точки, опциональная легенда
// (для multi-series) и подписи значений над барами. Сигнатура старых
// пропсов (values/color) не менялась — новые пропсы (title/unit/series)
// необязательны и по умолчанию не меняют поведение вызовов без них.

import { useState } from 'react';

const W = 560;
const H = 160;
const PAD_LEFT = 36;
const PAD_RIGHT = 14;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;
const PLOT_W = W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Склонение по числу: {one, few, many} — 1 / 2-4 / 5-20, 0, 5+. */
function pluralize(n, forms) {
  if (!forms) return '';
  const abs = Math.abs(Math.round(n)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms.many;
  if (last === 1) return forms.one;
  if (last >= 2 && last <= 4) return forms.few;
  return forms.many;
}

/** "17.09" -> "17 сен". Если формат метки не dd.mm — возвращает метку как есть. */
function formatTooltipDate(label) {
  const m = /^(\d{1,2})\.(\d{1,2})$/.exec(String(label || ''));
  if (!m) return label;
  const day = parseInt(m[1], 10);
  const month = MONTHS_SHORT[parseInt(m[2], 10) - 1];
  return month ? `${day} ${month}` : label;
}

/**
 * Тики оси Y: 0, max/4, max/2, 3·max/4, max — округлённые до целых,
 * с дедупликацией. При маленьком max (≤3) это естественным образом
 * сворачивается в 0,1,2,3 (напр. max=3 -> 0,0.75,1.5,2.25,3 -> округление
 * -> 0,1,2,2,3 -> дедуп -> 0,1,2,3).
 */
function computeYTicks(max) {
  const safe = Math.max(1, max);
  const raw = [0, safe / 4, safe / 2, (3 * safe) / 4, safe].map((v) => Math.round(v));
  const ticks = [];
  const seen = new Set();
  raw.forEach((v) => {
    if (!seen.has(v)) { seen.add(v); ticks.push(v); }
  });
  return ticks;
}

function yForValue(value, max) {
  return H - PAD_BOTTOM - (PLOT_H * value) / max;
}

function yForTick(tick, max) {
  return yForValue(tick, max);
}

/** Общая ось Y + сетка. secondary-тики скрываются на мобиле через CSS. */
function YAxis({ ticks, max }) {
  return (
    <>
      {ticks.map((t, idx) => {
        const y = yForTick(t, max);
        const secondary = idx % 2 === 1;
        return (
          <g key={t}>
            <line
              className={`admin-chart-grid-line${secondary ? ' admin-chart-ytick-secondary' : ''}`}
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={y}
              y2={y}
            />
            <text
              className={`admin-chart-ytick-label${secondary ? ' admin-chart-ytick-secondary' : ''}`}
              x={PAD_LEFT - 8}
              y={y + 3}
              textAnchor="end"
            >
              {t}
            </text>
          </g>
        );
      })}
    </>
  );
}

function ChartHeader({ title, totalLabel }) {
  if (!title && !totalLabel) return null;
  return (
    <div className="admin-chart-header">
      {title && <h3>{title}</h3>}
      {totalLabel && <span>· 14 дней · всего {totalLabel}</span>}
    </div>
  );
}

function Legend({ series }) {
  if (!series || series.length < 2) return null;
  return (
    <div className="admin-chart-legend">
      {series.map((s) => (
        <div className="admin-chart-legend-item" key={s.name}>
          <span className="admin-chart-legend-dot" style={{ background: s.color }} />
          <span>{s.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Тултип, позиционируется в % от viewBox — независимо от реального рендер-размера svg. */
function Tooltip({ x, y, lines }) {
  if (!lines || !lines.length) return null;
  return (
    <div
      className="admin-chart-tooltip"
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
    >
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

/** Столбчатый график по дням: values = [{ label, value }] */
export function AdminBarChart({ values, color = 'var(--ember)', title = '', unit = null }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const max = Math.max(1, ...values.map((v) => v.value));
  const ticks = computeYTicks(max);
  const barW = PLOT_W / values.length;
  const total = values.reduce((s, v) => s + v.value, 0);
  const showValues = values.length <= 10;

  const hovered = hoverIdx != null ? values[hoverIdx] : null;
  const hoveredX = hoverIdx != null ? PAD_LEFT + hoverIdx * barW + barW / 2 : 0;
  const hoveredY = hoverIdx != null ? yForValue(hovered.value, max) : 0;
  const tooltipLines = hovered
    ? [`${formatTooltipDate(hovered.label)} · ${hovered.value}${unit ? ' ' + pluralize(hovered.value, unit) : ''}`]
    : null;

  return (
    <div className="admin-chart">
      <ChartHeader title={title} totalLabel={title ? total : ''} />
      <div className="admin-chart-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
          <YAxis ticks={ticks} max={max} />
          {values.map((v, i) => {
            const h = (PLOT_H * v.value) / max;
            const x = PAD_LEFT + i * barW;
            const y = H - PAD_BOTTOM - h;
            const isMain = i % 2 === 0;
            return (
              <g key={i}>
                <rect x={x + barW * 0.15} y={y} width={barW * 0.7} height={h} rx="3" fill={color} />
                {showValues && (
                  <text className="admin-chart-bar-value" x={x + barW / 2} y={y - 6} textAnchor="middle">
                    {v.value}
                  </text>
                )}
                {isMain && (
                  <text
                    x={x + barW / 2}
                    y={H - 8}
                    textAnchor="middle"
                    className={`admin-chart-xlabel${i % 4 === 0 ? '' : ' admin-chart-xlabel-secondary'}`}
                  >
                    {v.label}
                  </text>
                )}
                <rect
                  className="admin-chart-hit"
                  x={x}
                  y={PAD_TOP}
                  width={barW}
                  height={PLOT_H}
                  onMouseEnter={() => setHoverIdx(i)}
                  onClick={() => setHoverIdx(hoverIdx === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>
        {hovered && <Tooltip x={hoveredX} y={hoveredY} lines={tooltipLines} />}
      </div>
    </div>
  );
}

/**
 * Линейный график по дням: values = [{ label, value }].
 * Для нескольких линий на одном графике — проп series = [{ name, color, values }],
 * тогда values/color игнорируются, а под графиком появляется легенда.
 */
export function AdminLineChart({ values, color = 'var(--habanero)', title = '', unit = null, series = null }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const seriesList = series && series.length ? series : [{ name: null, color, values }];
  const pointCount = seriesList[0].values.length;
  const max = Math.max(1, ...seriesList.flatMap((s) => s.values.map((v) => v.value)));
  const ticks = computeYTicks(max);
  const stepX = PLOT_W / Math.max(1, pointCount - 1);

  const totalLabel = seriesList.length === 1
    ? seriesList[0].values.reduce((s, v) => s + v.value, 0)
    : seriesList.map((s) => `${s.name}: ${s.values.reduce((sum, v) => sum + v.value, 0)}`).join(' · ');

  const hoverX = hoverIdx != null ? PAD_LEFT + hoverIdx * stepX : 0;
  const tooltipLines = hoverIdx != null
    ? seriesList.map((s) => {
      const v = s.values[hoverIdx];
      const dateLabel = formatTooltipDate(v.label);
      const valueText = `${v.value}${unit ? ' ' + pluralize(v.value, unit) : ''}`;
      return s.name ? `${dateLabel} · ${s.name}: ${valueText}` : `${dateLabel} · ${valueText}`;
    })
    : null;
  const hoverYForTooltip = hoverIdx != null ? yForValue(seriesList[0].values[hoverIdx].value, max) : 0;

  return (
    <div className="admin-chart">
      <ChartHeader title={title} totalLabel={title ? totalLabel : ''} />
      <div className="admin-chart-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
          <YAxis ticks={ticks} max={max} />

          {seriesList.map((s, si) => {
            const points = s.values.map((v, i) => {
              const x = PAD_LEFT + i * stepX;
              const y = yForValue(v.value, max);
              return { x, y, v };
            });
            return (
              <g key={s.name || si}>
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points.map((p, i) => {
                  const isLast = i === points.length - 1;
                  const isHovered = hoverIdx === i;
                  const r = isLast ? 4.5 : isHovered ? 4 : 2.5;
                  return (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={s.color}
                      className={`admin-chart-point${isLast ? ' admin-chart-point-last' : ''}`}
                    />
                  );
                })}
              </g>
            );
          })}

          {seriesList[0].values.map((v, i) => {
            const x = PAD_LEFT + i * stepX;
            const isMain = i % 2 === 0;
            return isMain ? (
              <text
                key={i}
                x={x}
                y={H - 8}
                textAnchor="middle"
                className={`admin-chart-xlabel${i % 4 === 0 ? '' : ' admin-chart-xlabel-secondary'}`}
              >
                {v.label}
              </text>
            ) : null;
          })}

          {/* Хитбоксы поверх всего — по одному на точку, на всю высоту графика */}
          {seriesList[0].values.map((v, i) => {
            const x = PAD_LEFT + i * stepX - stepX / 2;
            return (
              <rect
                key={i}
                className="admin-chart-hit"
                x={Math.max(PAD_LEFT - 4, x)}
                y={PAD_TOP}
                width={stepX}
                height={PLOT_H}
                onMouseEnter={() => setHoverIdx(i)}
                onClick={() => setHoverIdx(hoverIdx === i ? null : i)}
              />
            );
          })}
        </svg>
        {tooltipLines && <Tooltip x={hoverX} y={hoverYForTooltip} lines={tooltipLines} />}
      </div>
      <Legend series={series} />
    </div>
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

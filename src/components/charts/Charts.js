'use client';

import { useMemo, useRef, useState } from 'react';
import styles from './charts.module.css';
import { useTranslation } from '@/lib/store/languageStore';

// SVG chart dəsti — asılılıqsız, tema tokenlərinə bağlı (--chart-*).
// Hər zaman-seriyalı chart cədvəl görünüşü ilə gəlir (rəng-müstəqil oxunuş).

const W = 600; // viewBox eni; komponent responsive genişlənir
const PAD = { top: 14, right: 44, bottom: 22, left: 34 };

function niceTicks(max) {
  if (max <= 0) return [0, 1];
  const raw = max / 2;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.ceil(raw / mag) * mag;
  return [0, step, step * 2];
}

function useTooltip() {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null); // {x, y, content}
  const show = (evt, content) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top - 8, content });
  };
  const hide = () => setTip(null);
  return { wrapRef, tip, show, hide };
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className={styles.tooltip} style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  );
}

function TableToggle({ open, onToggle }) {
  const { t } = useTranslation();
  return (
    <button type="button" className={styles.tableBtn} onClick={onToggle}>
      {open ? t('chart_hide_table', 'Qrafik') : t('chart_show_table', 'Cədvəl')}
    </button>
  );
}

// ---- Dövr seçimi (bir filtr sətri — əhatə etdiyi bütün qrafiklərə şamil) --
export const CHART_RANGES = ['7d', '30d', '90d', '180d', 'all'];

export function RangeSelect({ value, onChange }) {
  const { t } = useTranslation();
  const LABELS = t('chart_ranges', {
    '7d': 'Son 7 gün', '30d': 'Son 30 gün', '90d': 'Son 3 ay', '180d': 'Son 6 ay', all: 'Bütün zamanlar',
  });
  return (
    <div className={styles.rangeRow}>
      {CHART_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          className={`${styles.rangePill} ${value === r ? styles.rangePillActive : ''}`}
          onClick={() => onChange(r)}
        >
          {LABELS[r] || r}
        </button>
      ))}
    </div>
  );
}

// ---- Xətt (sahə) qrafiki: data = [{d, <valueKey>}] -----------------------
export function LineChart({ data = [], color = 'var(--chart-1)', valueLabel = '', height = 190, valueKey = 'c', formatValue = (v) => v }) {
  const { wrapRef, tip, show, hide } = useTooltip();
  const [showTable, setShowTable] = useState(false);
  const H = height;

  const { pts, ticks, maxV } = useMemo(() => {
    const vals = data.map((p) => Number(p[valueKey]) || 0);
    const maxV = Math.max(...vals, 1);
    const tks = niceTicks(maxV);
    const top = tks[tks.length - 1] || 1;
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const pts = data.map((p, i) => ({
      x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2),
      y: PAD.top + ih - ((Number(p[valueKey]) || 0) / top) * ih,
      d: p.d, v: Number(p[valueKey]) || 0,
    }));
    return { pts, ticks: tks, maxV: top };
  }, [data, H, valueKey]);

  if (!data.length) return <div className={styles.empty}>—</div>;

  const ih = H - PAD.top - PAD.bottom;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${PAD.top + ih} L${pts[0].x.toFixed(1)},${PAD.top + ih} Z`;
  const last = pts[pts.length - 1];
  const xLabelEvery = Math.max(1, Math.ceil(data.length / 5));

  return (
    <div className={styles.chartWrap} ref={wrapRef}>
      <div className={styles.headerRow}>
        <span />
        <TableToggle open={showTable} onToggle={() => setShowTable((s) => !s)} />
      </div>
      {showTable ? (
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead><tr><th>Tarix</th><th>{valueLabel}</th></tr></thead>
            <tbody>
              {[...pts].reverse().map((p) => (
                <tr key={p.d}><td>{p.d}</td><td>{formatValue(p.v)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img">
          {ticks.map((tk) => {
            const y = PAD.top + ih - (tk / maxV) * ih;
            return (
              <g key={tk}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className={styles.axisText}>{tk}</text>
              </g>
            );
          })}
          {pts.map((p, i) => (i % xLabelEvery === 0 ? (
            <text key={p.d} x={p.x} y={H - 6} textAnchor="middle" className={styles.axisText}>{p.d}</text>
          ) : null))}
          <path d={area} fill={color} opacity="0.1" />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={last.x} cy={last.y} r="4" fill={color} stroke="var(--bg-card)" strokeWidth="2" />
          <text x={last.x + 8} y={last.y + 4} className={styles.endLabel}>{formatValue(last.v)}</text>
          {pts.map((p) => {
            const hw = Math.max(10, (W - PAD.left - PAD.right) / Math.max(data.length, 1));
            return (
              <rect key={`h-${p.d}`} x={p.x - hw / 2} y={PAD.top} width={hw} height={ih}
                fill="transparent"
                onMouseMove={(e) => show(e, (
                  <div>
                    <div className={styles.tooltipLabel}>{p.d}</div>
                    <div className={styles.tooltipRow}>
                      <span className={styles.legendDot} style={{ background: color }} />
                      {valueLabel}: <strong>{formatValue(p.v)}</strong>
                    </div>
                  </div>
                ))}
                onMouseLeave={hide}
              />
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

// ---- Qoşa sütun qrafiki: seriesA/B = [{d, a?, c}] ------------------------
export function DualBarChart({ seriesA = [], seriesB = [], labelA = 'A', labelB = 'B', valueKey = 'a', height = 190, formatValue = (v) => v }) {
  const { wrapRef, tip, show, hide } = useTooltip();
  const [showTable, setShowTable] = useState(false);
  const H = height;
  const ih = H - PAD.top - PAD.bottom;

  const { bars, ticks, maxV } = useMemo(() => {
    const val = (p) => Number(p?.[valueKey]) || 0;
    const maxV = Math.max(...seriesA.map(val), ...seriesB.map(val), 1);
    const tks = niceTicks(maxV);
    const top = tks[tks.length - 1] || 1;
    const iw = W - PAD.left - PAD.right;
    const band = iw / Math.max(seriesA.length, 1);
    const barW = Math.min(10, Math.max(2.5, (band - 4) / 2));
    const bars = seriesA.map((p, i) => {
      const vA = val(p);
      const vB = val(seriesB[i] || {});
      const cx = PAD.left + band * i + band / 2;
      return {
        d: p.d, vA, vB, cx, band,
        ax: cx - barW - 1, bx: cx + 1, w: barW,
        ah: (vA / top) * ih, bh: (vB / top) * ih,
      };
    });
    return { bars, ticks: tks, maxV: top };
  }, [seriesA, seriesB, valueKey, ih]);

  if (!seriesA.length) return <div className={styles.empty}>—</div>;
  const xLabelEvery = Math.max(1, Math.ceil(seriesA.length / 5));

  return (
    <div className={styles.chartWrap} ref={wrapRef}>
      <div className={styles.headerRow}>
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'var(--chart-1)' }} />{labelA}</span>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'var(--chart-2)' }} />{labelB}</span>
        </div>
        <TableToggle open={showTable} onToggle={() => setShowTable((s) => !s)} />
      </div>
      {showTable ? (
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead><tr><th>Tarix</th><th>{labelA}</th><th>{labelB}</th></tr></thead>
            <tbody>
              {[...bars].reverse().map((b) => (
                <tr key={b.d}><td>{b.d}</td><td>{formatValue(b.vA)}</td><td>{formatValue(b.vB)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img">
          {ticks.map((tk) => {
            const y = PAD.top + ih - (tk / maxV) * ih;
            return (
              <g key={tk}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className={styles.axisText}>{tk}</text>
              </g>
            );
          })}
          {bars.map((b, i) => (
            <g key={b.d}>
              {b.vA > 0 && (
                <rect x={b.ax} y={PAD.top + ih - b.ah} width={b.w} height={b.ah}
                  fill="var(--chart-1)" rx={Math.min(2, b.w / 2)} />
              )}
              {b.vB > 0 && (
                <rect x={b.bx} y={PAD.top + ih - b.bh} width={b.w} height={b.bh}
                  fill="var(--chart-2)" rx={Math.min(2, b.w / 2)} />
              )}
              {i % xLabelEvery === 0 && (
                <text x={b.cx} y={H - 6} textAnchor="middle" className={styles.axisText}>{b.d}</text>
              )}
              <rect x={b.cx - b.band / 2} y={PAD.top} width={b.band} height={ih} fill="transparent"
                onMouseMove={(e) => show(e, (
                  <div>
                    <div className={styles.tooltipLabel}>{b.d}</div>
                    <div className={styles.tooltipRow}>
                      <span className={styles.legendDot} style={{ background: 'var(--chart-1)' }} />
                      {labelA}: <strong>{formatValue(b.vA)}</strong>
                    </div>
                    <div className={styles.tooltipRow}>
                      <span className={styles.legendDot} style={{ background: 'var(--chart-2)' }} />
                      {labelB}: <strong>{formatValue(b.vB)}</strong>
                    </div>
                  </div>
                ))}
                onMouseLeave={hide}
              />
            </g>
          ))}
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + ih} y2={PAD.top + ih} stroke="var(--chart-axis)" strokeWidth="1" />
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

// ---- Üfüqi sütunlar: items = [{label, value}] — tək seriya, tək rəng ----
export function HBarChart({ items = [], color = 'var(--chart-1)', formatValue = (v) => v }) {
  const maxV = Math.max(...items.map((i) => Number(i.value) || 0), 1);
  if (!items.length) return <div className={styles.empty}>—</div>;
  return (
    <div>
      {items.map((it) => {
        const v = Number(it.value) || 0;
        return (
          <div key={it.label} className={styles.hbarRow}>
            <span className={styles.hbarLabel}>{it.label}</span>
            <div className={styles.hbarTrack}>
              <div className={styles.hbarFill} style={{ width: `${(v / maxV) * 100}%`, background: color }} />
            </div>
            <span className={styles.hbarValue}>{formatValue(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Status stacked bar (KYC): segments = [{key,label,value,color}] ------
export function StatusStackedBar({ segments = [] }) {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0);
  return (
    <div>
      <div className={styles.stackTrack}>
        {total > 0 && segments.filter((s) => Number(s.value) > 0).map((s) => (
          <div key={s.key} className={styles.stackSeg}
            style={{ width: `${(Number(s.value) / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.value}`} />
        ))}
        {total === 0 && <div className={styles.stackSeg} style={{ width: '100%', background: 'var(--chart-grid)' }} />}
      </div>
      <div className={styles.stackLegend}>
        {segments.map((s) => (
          <div key={s.key} className={styles.stackLegendRow}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            {s.label}
            <span className={styles.stackLegendCount}>{s.value}{total > 0 ? ` (${Math.round((Number(s.value) / total) * 100)}%)` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export interface RankedBarItem {
  id: string;
  label: string;
  value: number;
}

interface RankedBarListProps {
  items: RankedBarItem[];
  formatValue: (value: number) => string;
}

/** Ranked horizontal bars — one row per item, categorical color per rank, value at the tip. */
export function RankedBarList({ items, formatValue }: RankedBarListProps) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="ranked-bar-list">
      {items.map((item, index) => {
        const color = SERIES_VARS[index % SERIES_VARS.length];
        const pct = Math.max((item.value / max) * 100, 2);
        return (
          <div className="ranked-bar-row" key={item.id}>
            <span className="ranked-bar-badge" style={{ background: color }}>
              {index + 1}
            </span>
            <span className="ranked-bar-label" title={item.label}>
              {item.label}
            </span>
            <div className="ranked-bar-track">
              <div className="ranked-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="ranked-bar-value">{formatValue(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

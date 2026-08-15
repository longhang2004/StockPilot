'use client';

import { EmptyState } from '../../components/ui/operations-ui';
import { formatDate } from '../../lib/formatters';

interface MovementRow {
  date: string;
  inbound: number;
  outbound: number;
}

const CHART_WIDTH = 560;
const CHART_HEIGHT = 168;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 148;
const GROUP_WIDTH = CHART_WIDTH / 14;
const BAR_WIDTH = 13;

/**
 * Compact grouped bar chart for the 14-day inbound/outbound window. Rendered
 * as inline SVG (no chart dependency); the same data stays available as an
 * accessible table inside a <details> disclosure.
 */
export function MovementChart({ rows }: { rows: MovementRow[] }) {
  const maxValue = Math.max(
    1,
    ...rows.map((row) => Math.max(row.inbound, row.outbound)),
  );
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;

  return (
    <article className="work-panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Last 14 days</p>
          <h2>Inbound and outbound units</h2>
        </div>
        <span className="muted-note">Inbound · Outbound</span>
      </div>
      {rows.length ? (
        <div className="chart-panel-body">
          <div
            className="movement-chart"
            role="img"
            aria-label={`Inbound and outbound units over the last ${rows.length} days.`}
          >
            <svg
              aria-hidden="true"
              height={CHART_HEIGHT}
              role="presentation"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              width="100%"
            >
              <line
                className="chart-axis"
                x1="0"
                x2={CHART_WIDTH}
                y1={PLOT_BOTTOM}
                y2={PLOT_BOTTOM}
              />
              {rows.map((row, index) => {
                const groupX = index * GROUP_WIDTH + GROUP_WIDTH / 2;
                const inboundHeight = (row.inbound / maxValue) * plotHeight;
                const outboundHeight = (row.outbound / maxValue) * plotHeight;
                return (
                  <g key={row.date}>
                    <rect
                      className="chart-bar chart-bar-inbound"
                      height={Math.max(1, inboundHeight)}
                      rx="2"
                      width={BAR_WIDTH}
                      x={groupX - BAR_WIDTH - 1}
                      y={PLOT_BOTTOM - Math.max(1, inboundHeight)}
                    />
                    <rect
                      className="chart-bar chart-bar-outbound"
                      height={Math.max(1, outboundHeight)}
                      rx="2"
                      width={BAR_WIDTH}
                      x={groupX + 1}
                      y={PLOT_BOTTOM - Math.max(1, outboundHeight)}
                    />
                    {index % 2 === 0 ? (
                      <text
                        className="chart-label"
                        textAnchor="middle"
                        x={groupX}
                        y={CHART_HEIGHT - 4}
                      >
                        {formatDate(row.date).slice(0, 6)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
          <details className="chart-table-details">
            <summary>Show table summary</summary>
            <div className="responsive-table-wrap">
              <table className="operations-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Inbound</th>
                    <th scope="col">Outbound</th>
                    <th scope="col">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date}>
                      <td>{formatDate(row.date)}</td>
                      <td className="mono">+{row.inbound}</td>
                      <td className="mono">−{row.outbound}</td>
                      <td className="mono">{row.inbound - row.outbound}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ) : (
        <EmptyState
          description="Movements will create the 14-day summary automatically."
          title="No movement window yet"
        />
      )}
    </article>
  );
}

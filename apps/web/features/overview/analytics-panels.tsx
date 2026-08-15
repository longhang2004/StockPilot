'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { EmptyState, StatusBadge } from '../../components/ui/operations-ui';
import { fetchAnalytics, overviewKeys } from './api';

export function AnalyticsPanels() {
  const analytics = useQuery({
    queryKey: overviewKeys.analytics,
    queryFn: fetchAnalytics,
  });
  if (analytics.isLoading || analytics.isError || !analytics.data) return null;
  const data = analytics.data;
  const maxStatusCount = Math.max(
    1,
    ...data.ordersByStatus.map((row) => row.count),
  );
  const totalTopUnits = data.topFulfilledProducts.reduce(
    (sum, product) => sum + product.unitsFulfilled,
    0,
  );
  return (
    <div className="analytics-grid">
      <article className="work-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Fulfillment</p>
            <h2>Orders by status</h2>
          </div>
          <Link className="button button-secondary" href="/app/orders">
            Open queue
          </Link>
        </div>
        <div className="analytics-panel-body">
          {data.ordersByStatus.length ? (
            <div className="status-breakdown">
              {data.ordersByStatus.map((row) => (
                <div className="status-breakdown-row" key={row.status}>
                  <StatusBadge value={row.status} />
                  <span
                    className="status-breakdown-bar"
                    style={{
                      width: `${Math.max(8, (row.count / maxStatusCount) * 100)}%`,
                    }}
                  />
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Confirmed orders will appear here."
              title="No orders yet"
            />
          )}
          <div className="chart-kpis">
            <span>
              <strong className="mono">${data.fulfilledOrderValue}</strong>
              fulfilled value
            </span>
            <span>
              <strong className="mono">
                ${data.averageFulfilledOrderValue}
              </strong>
              avg order
            </span>
          </div>
        </div>
      </article>
      <article className="work-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Demand</p>
            <h2>Top fulfilled products</h2>
          </div>
          <span className="muted-note">{data.fulfilledOrderCount} orders</span>
        </div>
        <div className="analytics-panel-body">
          {data.topFulfilledProducts.length ? (
            <div className="top-products">
              {data.topFulfilledProducts.map((product, index) => (
                <div className="top-product-row" key={product.sku}>
                  <span className="top-product-rank">{index + 1}</span>
                  <span className="top-product-name">
                    <strong>{product.name}</strong>
                    <small className="mono">{product.sku}</small>
                  </span>
                  <span className="top-product-units mono">
                    {product.unitsFulfilled} units
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Fulfilled sales movements will rank products here."
              title="No fulfilled units yet"
            />
          )}
          <div className="chart-kpis">
            <span>
              <strong className="mono">{data.lowStockSkuCount}</strong>
              low-stock SKUs
            </span>
            <span>
              <strong className="mono">{totalTopUnits}</strong>
              top units fulfilled
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}

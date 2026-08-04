# StockPilot domain relationships

```mermaid
erDiagram
  ORGANIZATION ||--|| WAREHOUSE : owns
  ORGANIZATION ||--o{ MEMBERSHIP : has
  USER ||--o{ MEMBERSHIP : joins
  ORGANIZATION ||--o{ PRODUCT : catalogs
  ORGANIZATION ||--o{ CUSTOMER : serves
  ORGANIZATION ||--o{ SUPPLIER : buys_from
  PRODUCT ||--o{ INVENTORY_BALANCE : projects
  PRODUCT ||--o{ STOCK_MOVEMENT : moves
  GOODS_RECEIPT ||--|{ GOODS_RECEIPT_LINE : contains
  SALES_ORDER ||--|{ SALES_ORDER_LINE : contains
  SALES_ORDER ||--o{ ORDER_TRANSITION : records
  ORGANIZATION ||--o{ AUDIT_EVENT : records
  ORGANIZATION ||--o{ INTEGRATION_DELIVERY : receives
```

`SalesOrderLine` stores SKU, product name, and unit-price snapshots so later
catalog edits do not rewrite historical orders. `StockMovement` is append-only;
`InventoryBalance` is the projection used for fast availability checks.

/**
 * Shared product-line selection rule for multi-line forms.
 *
 * Order and receipt forms both enforce: a product may appear on at most one
 * line, and only active products are selectable. This pure helper is the
 * single implementation of that rule; the forms keep their own rendering.
 */
export interface LineSelection {
  productId?: string | null;
}

/**
 * Products a given line may still select: active products not already
 * chosen by another line.
 */
export function availableLineProducts<
  T extends { id: string; isActive: boolean },
>(
  products: readonly T[],
  lines: ReadonlyArray<LineSelection>,
  lineIndex: number,
): T[] {
  return products.filter(
    (candidate) =>
      candidate.isActive &&
      !lines.some(
        (line, otherIndex) =>
          otherIndex !== lineIndex && line?.productId === candidate.id,
      ),
  );
}

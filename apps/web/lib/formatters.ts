export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

export function closeFormSafely(
  dirty: boolean,
  onClose: () => void,
): () => void {
  return () => {
    if (
      dirty &&
      !window.confirm('Discard your unsaved changes and close this form?')
    ) {
      return;
    }
    onClose();
  };
}

'use client';

import { useState } from 'react';

import type { ToastMessage } from '../components/ui/operations-ui';

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function push(message: string, tone: ToastMessage['tone'] = 'info') {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      4_000,
    );
  }

  return { push, toasts };
}

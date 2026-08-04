'use client';

import { ArrowRight, WarningCircle, X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

export function Drawer({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'medium',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'medium' | 'wide';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const drawerId = useId();
  const titleId = `drawer-title-${drawerId}`;
  const descriptionId = `drawer-description-${drawerId}`;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="drawer-layer" role="presentation">
      <button
        aria-label="Close drawer"
        className="drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`drawer-panel drawer-${size}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key !== 'Tab') return;
          const focusable = Array.from(
            panelRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ) ?? [],
          );
          if (focusable.length === 0) {
            event.preventDefault();
            panelRef.current?.focus();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="drawer-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            aria-label="Close drawer"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Drawer
      description={description}
      onClose={onCancel}
      open={open}
      size="medium"
      title={title}
    >
      <div className="confirm-dialog-copy">
        <WarningCircle size={32} aria-hidden="true" />
        <p>{description}</p>
      </div>
      <div className="confirm-actions">
        <button
          className="button button-secondary"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className={`button ${destructive ? 'button-danger' : 'button-primary'}`}
          disabled={pending}
          onClick={onConfirm}
          type="button"
        >
          {pending ? 'Working…' : confirmLabel}
          <ArrowRight size={17} />
        </button>
      </div>
    </Drawer>
  );
}

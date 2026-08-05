'use client';

import { ArrowRight, WarningCircle, X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

const focusableSelector =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

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
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      const firstFocusable =
        panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? panelRef.current)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      const restoreElement = restoreRef.current;
      if (restoreElement && document.contains(restoreElement)) {
        restoreElement.focus();
      }
      restoreRef.current = null;
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
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== 'Tab') return;
          const focusable = Array.from(
            panelRef.current?.querySelectorAll<HTMLElement>(
              focusableSelector,
            ) ?? [],
          );
          if (focusable.length === 0) {
            event.preventDefault();
            panelRef.current?.focus();
            return;
          }
          if (!panelRef.current?.contains(document.activeElement)) {
            event.preventDefault();
            focusable[0]?.focus();
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

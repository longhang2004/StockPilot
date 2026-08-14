'use client';

import { type ImportPreviewResult, type Role } from '@stockpilot/contracts';
import { useMutation } from '@tanstack/react-query';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { useState } from 'react';

import {
  EmptyState,
  PageHeader,
  ToastRegion,
} from '../../components/ui/operations-ui';
import { commitImport, previewImport } from './api';
import { useToasts } from '../../hooks/use-toasts';

export function ImportsWorkspace({ role }: { role: Role }) {
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const { push, toasts } = useToasts();
  const previewMutation = useMutation({
    mutationFn: () => previewImport({ content, fileName }),
    onError: (error) =>
      push(error instanceof Error ? error.message : 'Preview failed.', 'error'),
    onSuccess: setPreview,
  });
  const commitMutation = useMutation({
    mutationFn: () => commitImport(preview?.id ?? ''),
    onError: (error) =>
      push(error instanceof Error ? error.message : 'Commit failed.', 'error'),
    onSuccess: () => push('Valid product rows committed.', 'success'),
  });
  if (role === 'STAFF')
    return (
      <section className="workspace-section-page">
        <PageHeader
          description="Imports are managed by the catalog team."
          title="Product imports"
        />
        <EmptyState
          description="Staff can review catalog data but cannot import or change master records."
          title="Manager access required"
        />
      </section>
    );
  return (
    <section className="workspace-section-page">
      <PageHeader
        description="Upload, preview, commit valid rows, then download errors."
        title="Product imports"
        action={
          <a
            className="button button-secondary"
            href="/api/v1/products/export.csv"
          >
            <DownloadSimple size={17} /> Export catalog
          </a>
        }
      />
      <div className="step-indicator" aria-label="Import steps">
        <span className={!preview ? 'is-active' : 'is-complete'}>
          01 Upload
        </span>
        <span className={preview ? 'is-active' : undefined}>02 Preview</span>
        <span>03 Commit</span>
      </div>
      <article className="import-card">
        <label className="file-drop">
          <UploadSimple size={24} aria-hidden="true" />
          <strong>{fileName || 'Choose a product CSV'}</strong>
          <small>Maximum 2 MB and 5,000 rows</small>
          <input
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              void file.text().then(setContent);
            }}
            type="file"
          />
        </label>
        <button
          className="button button-primary"
          disabled={!content || previewMutation.isPending}
          onClick={() => previewMutation.mutate()}
          type="button"
        >
          {previewMutation.isPending ? 'Previewing…' : 'Preview CSV'}
        </button>
      </article>
      {preview ? (
        <article className="work-panel import-results">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Preview results</p>
              <h2>
                {preview.rowsValid} valid rows · {preview.rowsInvalid} errors
              </h2>
            </div>
            <button
              className="button button-primary"
              disabled={commitMutation.isPending || preview.rowsValid === 0}
              onClick={() => commitMutation.mutate()}
              type="button"
            >
              {commitMutation.isPending ? 'Committing…' : 'Commit valid rows'}
            </button>
          </div>
          {preview.errors.length ? (
            <div className="import-errors">
              {preview.errors.map((error) => (
                <div key={error.row}>
                  <strong>
                    Row {error.row}
                    {error.field ? ` · ${error.field}` : ''}
                  </strong>
                  <span>{error.message}</span>
                </div>
              ))}
              <a
                className="text-link"
                href={`/api/v1/product-imports/${preview.id}/errors.csv`}
              >
                Download error CSV
              </a>
            </div>
          ) : (
            <EmptyState
              description="All rows passed validation."
              title="No row errors"
            />
          )}
        </article>
      ) : null}
      <ToastRegion toasts={toasts} />
    </section>
  );
}

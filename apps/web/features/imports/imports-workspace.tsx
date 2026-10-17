'use client';

import {
  type ImportCommitResult,
  type ImportPreviewResult,
  type Role,
} from '@stockpilot/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { useRef, useState } from 'react';

import {
  EmptyState,
  PageHeader,
  ToastRegion,
} from '../../components/ui/operations-ui';
import { useCommandMutation } from '../../hooks/use-command-mutation';
import { invalidatePageQueries } from '../../hooks/use-page-query';
import { useToasts } from '../../hooks/use-toasts';
import { ExpiredCommandResolution } from '../shared/expired-command-resolution';
import { commitImport, previewImport } from './api';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function ImportsWorkspace({ role }: { role: Role }) {
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [committed, setCommitted] = useState<ImportCommitResult | null>(null);
  const fileVersion = useRef(0);
  const queryClient = useQueryClient();
  const { push, toasts } = useToasts();
  const previewMutation = useMutation({
    mutationFn: (input: {
      content: string;
      fileName: string;
      version: number;
    }) => previewImport({ content: input.content, fileName: input.fileName }),
    onError: (error, input) => {
      if (input.version === fileVersion.current) push(error.message, 'error');
    },
    onSuccess: (result, input) => {
      if (input.version === fileVersion.current) setPreview(result);
    },
  });
  const commitMutation = useCommandMutation({
    command: commitImport,
    prefix: 'product-import',
    validate: (value): value is string =>
      typeof value === 'string' && value.length > 0,
    onError: (error) => push(error.message, 'error'),
    onSuccess: (result) => {
      setCommitted(result);
      setPreview(result.run);
      void invalidatePageQueries(queryClient, '/products');
      push(`${result.created} products created.`, 'success');
    },
  });

  async function selectFile(file: File | undefined) {
    const version = ++fileVersion.current;
    setPreview(null);
    setCommitted(null);
    setContent('');
    setReading(false);
    setFileError('');
    setFileName(file?.name ?? '');
    commitMutation.reset();
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError('Choose a CSV no larger than 2 MB.');
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      if (version === fileVersion.current) setContent(text);
    } catch {
      if (version === fileVersion.current)
        setFileError(
          'This file could not be read. Choose it again or select another CSV.',
        );
    } finally {
      if (version === fileVersion.current) setReading(false);
    }
  }

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
        description="Upload a CSV, review validation, then create the valid products."
        title="Product imports"
        action={
          <a
            className="button button-secondary"
            href="/api/v1/products/export.csv"
          >
            <DownloadSimple size={16} /> Export catalog
          </a>
        }
      />
      <div className="step-indicator" aria-label="Import steps">
        <span className={preview ? 'is-complete' : 'is-active'}>01 Upload</span>
        <span
          className={
            committed ? 'is-complete' : preview ? 'is-active' : undefined
          }
        >
          02 Preview
        </span>
        <span className={committed ? 'is-complete' : undefined}>
          03 {committed ? 'Complete' : 'Commit'}
        </span>
      </div>
      <article className="import-card">
        <label className="file-drop">
          <UploadSimple size={22} aria-hidden="true" />
          <strong>{fileName || 'Choose a product CSV'}</strong>
          <small>Maximum 2 MB and 5,000 rows</small>
          <input
            accept=".csv,text/csv"
            aria-label="Product CSV"
            disabled={commitMutation.locked}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              void selectFile(file);
            }}
            type="file"
          />
        </label>
        <a className="text-link" download href="/templates/products.csv">
          Download CSV template
        </a>
        {reading ? <p role="status">Reading file…</p> : null}
        {fileError ? (
          <p className="form-error" role="alert">
            {fileError}
          </p>
        ) : null}
        <button
          className="button button-primary"
          disabled={
            !content ||
            reading ||
            previewMutation.isPending ||
            commitMutation.locked ||
            Boolean(committed)
          }
          onClick={() => {
            setPreview(null);
            previewMutation.mutate({
              content,
              fileName,
              version: fileVersion.current,
            });
          }}
          type="button"
        >
          {previewMutation.isPending ? 'Previewing…' : 'Preview CSV'}
        </button>
      </article>
      {commitMutation.outcomeUnknown ? (
        <div className="work-panel" role="alert">
          <p>{commitMutation.recoveryMessage}</p>
          {commitMutation.recoveryExpired ? (
            <ExpiredCommandResolution
              idempotencyKey={commitMutation.idempotencyKey}
              onResolve={commitMutation.resolveExpired}
            />
          ) : (
            <button
              className="button button-secondary"
              disabled={commitMutation.isPending}
              onClick={() =>
                commitMutation.variables &&
                commitMutation.mutate(commitMutation.variables)
              }
              type="button"
            >
              Recover saved commit
            </button>
          )}
        </div>
      ) : null}
      {committed ? (
        <article className="work-panel" role="status">
          <h2>Import completed</h2>
          <p>
            {committed.created} products created · {committed.run.rowsInvalid}{' '}
            rows rejected.
          </p>
          <p>
            Existing SKUs are rejected during preview; this import creates new
            products.
          </p>
          <a className="button button-secondary" href="/app/products">
            Review products
          </a>
        </article>
      ) : null}
      {preview ? (
        <article className="work-panel import-results">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {preview.fileName} ·{' '}
                {committed ? 'Final results' : 'Preview results'}
              </p>
              <h2>
                {preview.rowsValid} valid rows · {preview.rowsInvalid} errors
              </h2>
            </div>
            {!committed ? (
              <button
                className="button button-primary"
                disabled={
                  commitMutation.isPending ||
                  commitMutation.recoveryExpired ||
                  previewMutation.isPending ||
                  preview.rowsValid === 0
                }
                onClick={() => commitMutation.mutate(preview.id)}
                type="button"
              >
                {commitMutation.isPending
                  ? 'Committing…'
                  : commitMutation.outcomeUnknown
                    ? 'Retry same commit'
                    : 'Commit valid rows'}
              </button>
            ) : null}
          </div>
          {preview.errors.length ? (
            <div className="import-errors">
              {preview.errors.map((error, index) => (
                <div key={`${error.row}-${error.field}-${index}`}>
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

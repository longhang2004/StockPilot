import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportPreviewResult } from '@stockpilot/contracts';

import { QueryProvider } from '../../lib/query-provider';
import { commitImport, previewImport } from './api';
import { ImportsWorkspace } from './imports-workspace';

vi.mock('./api', () => ({ commitImport: vi.fn(), previewImport: vi.fn() }));

const preview = (fileName: string, id: string): ImportPreviewResult => ({
  id,
  fileName,
  createdAt: '2026-10-17T00:00:00.000Z',
  errors: [],
  rowsTotal: 2,
  rowsValid: 2,
  rowsInvalid: 0,
  status: 'PREVIEW',
});
function chooseFile(
  name: string,
  text = 'sku,name,sale_price,reorder_point\nA,Tape,2,0',
) {
  const file = new File([text], name, { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  fireEvent.change(screen.getByLabelText('Product CSV'), {
    target: { files: [file] },
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('CSV import lifecycle', () => {
  it('ignores a stale preview response after a different file is selected', async () => {
    let resolvePreview!: (value: ImportPreviewResult) => void;
    vi.mocked(previewImport).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve;
        }),
    );
    render(
      <QueryProvider>
        <ImportsWorkspace role="MANAGER" />
      </QueryProvider>,
    );
    chooseFile('a.csv');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Preview CSV' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview CSV' }));
    await waitFor(() => expect(previewImport).toHaveBeenCalledOnce());
    chooseFile('b.csv');
    await act(async () => resolvePreview(preview('a.csv', 'run-a')));
    expect(
      screen.queryByRole('button', { name: 'Commit valid rows' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('a.csv · Preview results'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('b.csv')).toBeVisible();
  });

  it('clears a completed preview when the user selects a new file', async () => {
    vi.mocked(previewImport).mockResolvedValue(preview('a.csv', 'run-a'));
    render(
      <QueryProvider>
        <ImportsWorkspace role="MANAGER" />
      </QueryProvider>,
    );
    chooseFile('a.csv');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Preview CSV' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview CSV' }));
    await screen.findByRole('button', { name: 'Commit valid rows' });
    chooseFile('b.csv');
    expect(
      screen.queryByRole('button', { name: 'Commit valid rows' }),
    ).not.toBeInTheDocument();
  });

  it('recovers a lost commit response with the same key and shows completion', async () => {
    const run = preview('a.csv', 'run-a');
    vi.mocked(previewImport).mockResolvedValue(run);
    vi.mocked(commitImport)
      .mockRejectedValueOnce(new TypeError('Connection lost'))
      .mockResolvedValueOnce({
        created: 2,
        run: { ...run, status: 'COMMITTED' },
      });
    render(
      <QueryProvider>
        <ImportsWorkspace role="MANAGER" />
      </QueryProvider>,
    );
    chooseFile('a.csv');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Preview CSV' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview CSV' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Commit valid rows' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry same commit' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Import completed' }),
    ).toBeVisible();
    expect(vi.mocked(commitImport).mock.calls[1]).toEqual(
      vi.mocked(commitImport).mock.calls[0],
    );
    expect(
      screen.queryByRole('button', { name: 'Commit valid rows' }),
    ).not.toBeInTheDocument();
  });
});

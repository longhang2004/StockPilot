import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiProblem } from '../lib/api-client';
import { QueryProvider } from '../lib/query-provider';
import { CommandIntentScope, useCommandMutation } from './use-command-mutation';

const validate = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('submitted command intent', () => {
  it('replays the exact payload and key after a lost response, then rotates after success', async () => {
    const command = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Connection lost after commit'))
      .mockResolvedValue({ applied: true });
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useCommandMutation({
          command,
          prefix: 'adjustment',
          validate,
          onError: vi.fn(),
          onSuccess,
        }),
      { wrapper: QueryProvider },
    );
    const value = { productId: 'sku-a', quantity: 3 };
    act(() => result.current.mutate(value));
    await waitFor(() => expect(result.current.outcomeUnknown).toBe(true));
    value.quantity = 99;
    act(() => result.current.mutate({ productId: 'sku-b', quantity: 8 }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(command.mock.calls[1]).toEqual(command.mock.calls[0]);
    expect(command.mock.calls[1]?.[0]).toEqual({
      productId: 'sku-a',
      quantity: 3,
    });
    expect(result.current.locked).toBe(false);
    act(() => result.current.mutate({ productId: 'sku-b', quantity: 8 }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));
    expect(command.mock.calls[2]?.[1]).not.toEqual(command.mock.calls[0]?.[1]);
  });

  it('allows a corrected payload after a confirmed business rejection', async () => {
    const command = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiProblem({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'Insufficient stock',
          instance: '/inventory/adjustments',
          code: 'INSUFFICIENT_STOCK',
          traceId: 'trace-1',
        }),
      )
      .mockResolvedValue({ applied: true });
    const { result } = renderHook(
      () =>
        useCommandMutation({
          command,
          prefix: 'adjustment',
          validate,
          onError: vi.fn(),
          onSuccess: vi.fn(),
        }),
      { wrapper: QueryProvider },
    );
    act(() => result.current.mutate({ quantity: 100 }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.outcomeUnknown).toBe(false);
    act(() => result.current.mutate({ quantity: 1 }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
    expect(command.mock.calls[1]?.[0]).toEqual({ quantity: 1 });
    expect(command.mock.calls[1]?.[1]).not.toEqual(command.mock.calls[0]?.[1]);
  });

  it('ignores a second submit while the first request is pending', async () => {
    let resolve!: (value: boolean) => void;
    const command = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const { result } = renderHook(
      () =>
        useCommandMutation({
          command,
          prefix: 'receipt',
          validate,
          onError: vi.fn(),
          onSuccess: vi.fn(),
        }),
      { wrapper: QueryProvider },
    );
    act(() => {
      result.current.mutate({ quantity: 1 });
      result.current.mutate({ quantity: 2 });
    });
    await waitFor(() => expect(command).toHaveBeenCalledOnce());
    await act(async () => resolve(true));
  });

  it('recovers after remount and isolates organization and account scopes', async () => {
    const command = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Response lost'))
      .mockResolvedValue(true);
    const options = {
      command,
      prefix: 'adjustment',
      validate,
      onError: vi.fn(),
      onSuccess: vi.fn(),
    };
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryProvider>
        <CommandIntentScope.Provider value="org-a:user-a">
          {children}
        </CommandIntentScope.Provider>
      </QueryProvider>
    );
    const first = renderHook(() => useCommandMutation(options), {
      wrapper: Wrapper,
    });
    act(() => first.result.current.mutate({ quantity: 3 }));
    await waitFor(() => expect(first.result.current.outcomeUnknown).toBe(true));
    first.unmount();
    const otherTenant = renderHook(() => useCommandMutation(options), {
      wrapper: ({ children }) => (
        <QueryProvider>
          <CommandIntentScope.Provider value="org-b:user-a">
            {children}
          </CommandIntentScope.Provider>
        </QueryProvider>
      ),
    });
    expect(otherTenant.result.current.outcomeUnknown).toBe(false);
    otherTenant.unmount();
    const otherAccount = renderHook(() => useCommandMutation(options), {
      wrapper: ({ children }) => (
        <QueryProvider>
          <CommandIntentScope.Provider value="org-a:user-b">
            {children}
          </CommandIntentScope.Provider>
        </QueryProvider>
      ),
    });
    expect(otherAccount.result.current.outcomeUnknown).toBe(false);
    otherAccount.unmount();
    const restored = renderHook(() => useCommandMutation(options), {
      wrapper: Wrapper,
    });
    expect(restored.result.current.outcomeUnknown).toBe(true);
    expect(restored.result.current.restoredValue).toEqual({ quantity: 3 });
    act(() =>
      restored.result.current.mutate(restored.result.current.variables!),
    );
    await waitFor(() => expect(restored.result.current.isSuccess).toBe(true));
    expect(command.mock.calls[1]).toEqual(command.mock.calls[0]);
    expect(sessionStorage.length).toBe(0);
  });

  it('blocks an aged saved request until the operator explicitly verifies its outcome', async () => {
    const key = 'stockpilot:pending-command:org-a:user-a:adjustment';
    const stored = {
      key: 'adjustment-expired-request',
      value: { quantity: 3 },
      createdAt: Date.now() - 24 * 60 * 60 * 1000,
    };
    sessionStorage.setItem(key, JSON.stringify(stored));
    const command = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(
      () =>
        useCommandMutation({
          command,
          prefix: 'adjustment',
          validate,
          onError: vi.fn(),
          onSuccess: vi.fn(),
        }),
      {
        wrapper: ({ children }) => (
          <QueryProvider>
            <CommandIntentScope.Provider value="org-a:user-a">
              {children}
            </CommandIntentScope.Provider>
          </QueryProvider>
        ),
      },
    );
    expect(result.current.recoveryExpired).toBe(true);
    expect(result.current.locked).toBe(true);
    act(() => result.current.mutate({ quantity: 99 }));
    expect(command).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(stored);
    act(() => result.current.resolveExpired());
    expect(result.current.locked).toBe(false);
    expect(sessionStorage.getItem(key)).toBeNull();
    act(() => result.current.mutate({ quantity: 99 }));
    await waitFor(() => expect(command).toHaveBeenCalledOnce());
    expect(command.mock.calls[0]?.[0]).toEqual({ quantity: 99 });
    expect(command.mock.calls[0]?.[1]).not.toEqual(stored.key);
  });
});

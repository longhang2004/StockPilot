import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal official-API client for the Stripe REST endpoints StockPilot uses
 * (Customers, Checkout Sessions, Billing Portal Sessions). The npm SDK could
 * not be installed in the build environment (no network), so this adapter
 * speaks Stripe's documented REST API directly; requests are form-encoded and
 * authenticated with the secret key exactly like the SDK's fetch transport.
 */
export class StripeClient {
  constructor(
    private readonly secretKey: string,
    private readonly baseUrl = 'https://api.stripe.com/v1',
  ) {}

  async createCustomer(input: { email: string; name: string }) {
    return this.formRequest<StripeCustomer>('POST', '/customers', {
      email: input.email,
      name: input.name,
    });
  }

  async createCheckoutSession(input: {
    cancelUrl: string;
    customer: string;
    metadata: { organizationId: string };
    priceId: string;
    successUrl: string;
  }) {
    return this.formRequest<StripeCheckoutSession>(
      'POST',
      '/checkout/sessions',
      {
        cancel_url: input.cancelUrl,
        customer: input.customer,
        'metadata[organizationId]': input.metadata.organizationId,
        mode: 'subscription',
        'subscription_data[metadata][organizationId]':
          input.metadata.organizationId,
        success_url: input.successUrl,
        'line_items[0][price]': input.priceId,
        'line_items[0][quantity]': '1',
      },
    );
  }

  async createBillingPortalSession(input: {
    customer: string;
    returnUrl: string;
  }) {
    return this.formRequest<StripePortalSession>(
      'POST',
      '/billing_portal/sessions',
      {
        customer: input.customer,
        return_url: input.returnUrl,
      },
    );
  }

  /**
   * Verifies a Stripe webhook signature per the documented algorithm:
   * HMAC-SHA256(webhookSecret, `${timestamp}.${rawPayload}`) compared against
   * each v1= signature in the header, with a 5-minute timestamp freshness
   * window to bound replay risk.
   */
  verifyWebhookSignature(
    rawPayload: Buffer,
    signatureHeader: string | undefined,
    webhookSecret: string,
  ): boolean {
    if (!signatureHeader) return false;
    const parts = signatureHeader.split(',');
    const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
    const signatures = parts
      .filter((part) => part.startsWith('v1='))
      .map((part) => part.slice(3));
    if (!timestamp || signatures.length === 0) return false;

    const timestampSeconds = Number(timestamp);
    if (
      !Number.isFinite(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > 300
    ) {
      return false;
    }

    const expected = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawPayload.toString('utf8')}`)
      .digest('hex');
    return signatures.some((signature) => {
      const expectedBuffer = Buffer.from(expected);
      const providedBuffer = Buffer.from(signature);
      return (
        expectedBuffer.length === providedBuffer.length &&
        timingSafeEqual(expectedBuffer, providedBuffer)
      );
    });
  }

  private async formRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    body: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      body: new URLSearchParams(body).toString(),
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method,
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const detail =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String(payload.message)
          : `Stripe request failed with status ${response.status}.`;
      throw new Error(detail);
    }
    return payload as T;
  }
}

export interface StripeCustomer {
  id: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
}

export interface StripePortalSession {
  url: string;
}

export interface StripeSubscriptionEventObject {
  cancel_at_period_end: boolean;
  current_period_end: number;
  customer: string;
  id: string;
  items: {
    data: Array<{ price: { id: string } }>;
  };
  metadata: Record<string, string> | null;
  status: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: StripeSubscriptionEventObject;
  };
}

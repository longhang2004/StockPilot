import AxeBuilder from '@axe-core/playwright';
import { createHmac } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { apiPost, loginAs, webOrigin } from './helpers';

/**
 * Regression coverage for the six production UI/UX findings recorded in
 * docs/qa/2026-10-19-production/findings.json (UX-01 to UX-06). Each check
 * verifies the observed runtime state (computed styles, layout spans,
 * serialized names) rather than file contents.
 */

function longSku() {
  // 64-char SKU limit; long unique catalog entry for the 390px drawer check.
  const stamp = Date.now().toString();
  return `QA-LONG-SKU-390-${stamp}-0123456789ABCDEF0123456789ABCDEF`;
}

async function documentReflow(page: Page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

async function expectNoHorizontalOverflow(page: Page) {
  const reflow = await documentReflow(page);
  expect(
    reflow.scrollWidth,
    `document scrollWidth ${reflow.scrollWidth} exceeds clientWidth ${reflow.clientWidth}`,
  ).toBeLessThanOrEqual(reflow.clientWidth);
}

test.describe('production UI/UX finding regressions', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'passed') {
      await testInfo.attach('verified-view', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
  });

  test('UX-02: Source Sans 3 is the computed font, not the fallback', async ({
    page,
  }) => {
    await loginAs(page, 'manager');
    await page.goto('/app');
    await expect(
      page.getByRole('heading', { name: 'Operations overview' }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const typography = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const heading = document.querySelector('h1,h2');
      return {
        htmlClass: document.documentElement.className,
        htmlSourceSans: getComputedStyle(
          document.documentElement,
        ).getPropertyValue('--font-source-sans'),
        faces: Array.from(document.fonts as unknown as Iterable<FontFace>).map(
          (face) => ({ family: face.family, status: face.status }),
        ),
        fontLoaded: document.fonts.check('16px sourceSans'),
        body: body.fontFamily,
        headingToken: heading
          ? getComputedStyle(heading).getPropertyValue('--font-sans')
          : null,
        heading: heading ? getComputedStyle(heading).fontFamily : null,
        token: body.getPropertyValue('--font-sans'),
      };
    });
    // next/font resolves the local face to a generated family list bound on
    // <html>; the semantic token must not collapse to the system fallback.
    const diagnostics = JSON.stringify(typography);
    expect(typography.faces?.length, diagnostics).toBeGreaterThan(0);
    expect(typography.fontLoaded, diagnostics).toBe(true);
    expect(
      typography.faces?.some(
        (face) =>
          face.family.includes('sourceSans') && face.status === 'loaded',
      ),
      diagnostics,
    ).toBe(true);
    for (const family of [
      typography.body,
      typography.token,
      typography.headingToken,
      typography.heading,
    ]) {
      expect(family ?? '', diagnostics).toContain('sourceSans');
      expect(family ?? '', diagnostics).not.toContain('undefined');
    }
    expect(
      typography.body.includes(
        typography.faces.find((face) => face.family.includes('sourceSans'))
          ?.family ?? '\u0000',
      ),
      diagnostics,
    ).toBe(true);
  });

  test('UX-01: More surface has no serious contrast violations', async ({
    page,
  }) => {
    await loginAs(page, 'manager');
    await page.goto('/app/more');
    await expect(
      page.getByRole('heading', { name: 'More operations' }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.filter(
        (violation) =>
          violation.impact === 'critical' || violation.impact === 'serious',
      ),
    ).toEqual([]);
  });

  test('UX-03: Owner discovers settings in the desktop sidebar', async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== 'desktop-production',
      'sidebar navigation is desktop-only',
    );
    await loginAs(page, 'owner');
    await page.goto('/app');
    const settingsLink = page
      .getByLabel('Workspace navigation')
      .getByRole('link', { name: 'Settings' });
    await expect(settingsLink).toBeVisible();
    await settingsLink.click();
    await expect(page).toHaveURL(/\/app\/settings$/);
    await expect(
      page.getByRole('heading', { name: 'Organization settings' }),
    ).toBeVisible();
    await expect(
      page
        .getByLabel('Workspace navigation')
        .getByRole('link', { name: 'Settings' }),
    ).toHaveAttribute('aria-current', 'page');

    // Access boundary stays server-side: managers/Staff still get no entry.
    await loginAs(page, 'manager');
    await page.goto('/app');
    await expect(
      page
        .getByLabel('Workspace navigation')
        .getByRole('link', { name: 'Settings' }),
    ).toHaveCount(0);
  });

  test('UX-04: narrow reflows keep identity and do not overflow', async ({
    page,
  }) => {
    await loginAs(page, 'manager');
    for (const width of [320, 390, 550]) {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ['/app', '/app/orders']) {
        await page.goto(route);
        await expectNoHorizontalOverflow(page);
      }
      if (width <= 480) {
        // Session controls wrap below; the organization identity keeps its
        // own visible width instead of collapsing to a single letter.
        const identity = await page.evaluate(() => {
          const strong = document.querySelector('.topbar-organization strong');
          const span = strong instanceof HTMLElement ? strong : null;
          return {
            text: span?.textContent ?? '',
            width: span?.getBoundingClientRect().width ?? 0,
          };
        });
        expect(identity.width).toBeGreaterThan(46);
        expect(identity.text.length).toBeGreaterThan(0);
      }
    }
  });

  test('UX-04: long-SKU adjustment drawer fits at 390px', async ({ page }) => {
    await loginAs(page, 'manager');
    const sku = longSku();
    const suffix = Date.now().toString();
    await apiPost<{ id: string }>(page, '/products', {
      name: `Long SKU QA ${suffix}`,
      reorderPoint: 1,
      salePrice: '3.00',
      sku,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/inventory');
    await page
      .getByRole('button', { name: /adjust stock/i })
      .first()
      .click();
    const drawer = page.getByRole('dialog');
    await drawer.getByLabel('Search products').fill(sku);
    await expect(
      drawer.getByRole('option', { name: new RegExp(sku) }),
    ).toBeAttached();
    const productValue = await drawer
      .locator('#adjust-product option', { hasText: sku })
      .first()
      .getAttribute('value');
    expect(productValue).toBeTruthy();
    await drawer
      .getByLabel('Product', { exact: true })
      .selectOption(productValue!);
    const drawerFit = await drawer.evaluate((panel) => {
      const body = panel.querySelector('.drawer-body');
      const select = body?.querySelector('select#adjust-product');
      return {
        bodyClientWidth: body instanceof HTMLElement ? body.clientWidth : null,
        bodyScrollWidth: body instanceof HTMLElement ? body.scrollWidth : null,
        selectWidth:
          select instanceof HTMLElement
            ? select.getBoundingClientRect().width
            : null,
      };
    });
    expect(drawerFit.bodyScrollWidth).toBeLessThanOrEqual(
      drawerFit.bodyClientWidth ?? 0,
    );
    expect(drawerFit.selectWidth).not.toBeNull();
    expect(drawerFit.selectWidth!).toBeLessThanOrEqual(
      (drawerFit.bodyClientWidth ?? 0) + 1,
    );
    await expectNoHorizontalOverflow(page);
  });

  test('UX-05: order facts use tenant business names, not IDs', async ({
    page,
  }) => {
    await loginAs(page, 'owner');
    const suffix = Date.now().toString();
    const product = await apiPost<{ id: string }>(page, '/products', {
      name: `Facts Product ${suffix}`,
      reorderPoint: 1,
      salePrice: '5.00',
      sku: `QA-FACTS-${suffix}`,
    });
    const customer = await apiPost<{ id: string }>(page, '/customers', {
      companyName: `Facts Customer ${suffix}`,
      contactName: 'Owner',
      email: `facts-owner-${suffix}@example.test`,
      phone: null,
    });
    const order = await apiPost<{ id: string }>(page, '/orders', {
      customerId: customer.id,
      lines: [{ productId: product.id, quantity: 2 }],
      note: null,
    });
    // View as a different role: the creator name must never become the viewer's.
    await loginAs(page, 'manager');
    await page.goto(`/app/orders?order=${encodeURIComponent(order.id)}`);
    await expect(
      page.getByRole('heading', { name: new RegExp('^SO-') }),
    ).toBeVisible();
    // Name + UUID share one fact node; assert within the facts grid.
    const facts = page.locator('.order-facts-grid');
    await expect(facts.getByText('Main Warehouse')).toBeVisible();
    await expect(facts.getByText('Olivia Owner')).toBeVisible();
    // UUIDs remain as the small technical affordance lines.
    await expect(
      page.locator('.order-facts-grid .order-fact-id').first(),
    ).toBeVisible();
  });

  test('UX-06: failed delivery retry opens the created order and survives reload', async ({
    page,
  }) => {
    const suffix = Date.now().toString();
    const sku = `QA-OPEN-SKU-${suffix}`;
    const deliveryId = `delivery-qa-open-${suffix}`;
    const payload = {
      customer: {
        companyName: `QA Open Order ${suffix}`,
        email: `qa-open-${suffix}@example.test`,
      },
      eventType: 'order.created',
      externalOrderId: `qa-${suffix}`,
      items: [{ quantity: 1, sku }],
    };
    // No product yet: the first webhook delivery must fail durably.
    const signature = createHmac(
      'sha256',
      process.env.WEBHOOK_SIGNING_SECRET ?? 'ci-webhook-secret',
    )
      .update(JSON.stringify(payload))
      .digest('hex');
    const webhookResponse = await page.request.post(
      '/api/v1/webhooks/mock-storefront/orders',
      {
        data: payload,
        headers: {
          'x-delivery-id': deliveryId,
          'x-organization-slug': 'stockpilot-demo',
          'x-storefront-signature': `sha256=${signature}`,
        },
        ...(webOrigin ? { origin: webOrigin } : {}),
      },
    );
    // CSRF-exempt public webhook body is processed inline; 202 expected.
    expect(webhookResponse.ok()).toBeTruthy();
    // No product yet: the first delivery must have failed durably.
    expect(((await webhookResponse.json()) as { status: string }).status).toBe(
      'FAILED',
    );

    await loginAs(page, 'manager');
    await apiPost<{ id: string }>(page, '/products', {
      name: `Open Order Product ${suffix}`,
      reorderPoint: 1,
      salePrice: '2.50',
      sku,
    });
    // The deep link parameter is the integration_delivery record id, not the
    // storefront's external delivery id: resolve it through the list API.
    const listResponse = await page.request.get(
      `/api/v1/integration-deliveries?search=${encodeURIComponent(deliveryId)}`,
    );
    expect(listResponse.ok()).toBeTruthy();
    const listBody = (await listResponse.json()) as {
      items: Array<{ id: string; externalDeliveryId: string }>;
    };
    const recordId = listBody.items.find(
      (item) => item.externalDeliveryId === deliveryId,
    )?.id;
    expect(recordId).toBeTruthy();
    const deliveryContext = `/app/integrations?delivery=${encodeURIComponent(recordId!)}&search=${encodeURIComponent(deliveryId)}&status=SUCCEEDED`;
    await page.goto(deliveryContext);
    const drawer = page.getByRole('dialog');
    const retryButton = drawer.getByRole('button', { name: 'Retry delivery' });
    // Background queue workers may beat the manual retry in this shared
    // environment; the manual path is followed only while it is offered.
    await expect(retryButton.or(drawer.getByText('Succeeded'))).toBeVisible();
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click();
    }
    // Wait for the full callback + refetch, not just the HTTP response:
    // the drawer must re-render Succeeded with the order link attached.
    const openOrder = drawer.getByRole('link', { name: 'Open order' });
    await expect(openOrder).toBeVisible();
    const href = await openOrder.getAttribute('href');
    expect(href).toContain('returnTo=');
    expect(decodeURIComponent(href ?? '')).toContain(
      `/app/integrations?delivery=${recordId}&search=${deliveryId}&status=SUCCEEDED`,
    );
    await openOrder.click();
    await expect(page).toHaveURL(new RegExp('app/orders\\?order='));
    const orderNumber = await page
      .getByRole('heading', { name: /^STORE-/ })
      .textContent();
    expect(orderNumber).toContain(`STORE-qa-${suffix}`);
    await page.reload();
    await expect(page.getByRole('heading', { name: /^STORE-/ })).toBeVisible();
    await page.getByRole('link', { name: 'Back to delivery' }).click();
    await expect(page).toHaveURL(deliveryContext);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('link', { name: 'Open order' }),
    ).toBeVisible();

    // Deep link + reload: the succeeded delivery still carries its order.
    await page.goto(deliveryContext);
    const reloadedLink = page
      .getByRole('dialog')
      .getByRole('link', { name: 'Open order' });
    await expect(reloadedLink).toBeVisible();
    await expect(reloadedLink).toHaveAttribute('href', href!);
    await reloadedLink.click();
    await expect(page).toHaveURL(new RegExp('app/orders\\?order='));
    await expect(page.getByRole('heading', { name: /^STORE-/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: /^STORE-/ })).toBeVisible();
  });
});

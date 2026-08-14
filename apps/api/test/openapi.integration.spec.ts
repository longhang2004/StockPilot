import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Contract regression test for the generated OpenAPI document.
 *
 * Structural assertions only — no brittle full-file snapshot. The goal is
 * that a Swagger consumer can discover the request/response contracts,
 * pagination parameters, idempotency requirements, and the RFC 9457 error
 * shape without reading controller source.
 */

interface OpenApiParameter {
  in?: string;
  name?: string;
  required?: boolean;
  schema?: { enum?: string[] };
}

interface OpenApiMediaType {
  schema?: unknown;
}

interface OpenApiOperation {
  parameters?: OpenApiParameter[];
  requestBody?: { content?: Record<string, OpenApiMediaType> };
  responses?: Record<
    string,
    { content?: Record<string, OpenApiMediaType>; description?: string }
  >;
  security?: Array<Record<string, string[]>>;
}

type OpenApiPathItem = Record<string, OpenApiOperation>;

interface OpenApiDocument {
  components?: {
    schemas?: Record<string, { properties?: Record<string, unknown> }>;
    securitySchemes?: Record<
      string,
      { type?: string; in?: string; name?: string }
    >;
  };
  paths?: Record<string, OpenApiPathItem>;
}

describe('OpenAPI contract surface', () => {
  let app: INestApplication | undefined;

  beforeAll(() => {
    Object.assign(process.env, {
      CSRF_SECRET: 'integration-csrf-secret-with-at-least-32-characters',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://stockpilot_app:***@localhost:5432/stockpilot',
      NODE_ENV: 'test',
      WEB_ORIGIN: 'http://localhost:3000',
      WEBHOOK_SIGNING_SECRET: 'integration-webhook-secret',
    });
  });

  afterEach(async () => {
    await app?.close();
  });

  async function getDocument(): Promise<OpenApiDocument> {
    const { AppModule } = await import('../src/app.module.js');
    const { configureApplication } =
      await import('../src/configure-application.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    const response = await request(app.getHttpServer()).get('/openapi.json');
    expect(response.status).toBe(200);
    return response.body as OpenApiDocument;
  }

  function operation(
    document: OpenApiDocument,
    path: string,
    method: string,
  ): OpenApiOperation {
    const pathItem = document.paths?.[path];
    expect(pathItem, `missing path ${path}`).toBeDefined();
    const operationDefinition = pathItem?.[method];
    expect(
      operationDefinition,
      `missing ${method.toUpperCase()} ${path}`,
    ).toBeDefined();
    return operationDefinition as OpenApiOperation;
  }

  function jsonBody(operationDefinition: OpenApiOperation, status: string) {
    return operationDefinition.responses?.[status]?.content?.[
      'application/json'
    ];
  }

  function hasRequiredIdempotencyKey(operationDefinition: OpenApiOperation) {
    return operationDefinition.parameters?.some(
      (parameter) =>
        parameter.name === 'Idempotency-Key' && parameter.required === true,
    );
  }

  it('registers the Zod-derived components', async () => {
    const document = await getDocument();
    const schemaNames = Object.keys(document.components?.schemas ?? {});
    for (const name of [
      'ProductInput',
      'CustomerInput',
      'SupplierInput',
      'ReceiptInput',
      'InventoryAdjustmentInput',
      'SalesOrderInput',
      'SignupInput',
      'LoginInput',
      'ProblemDetails',
      'AuthSessionResult',
      'Product',
      'ProductList',
      'SalesOrder',
      'SalesOrderDetail',
      'ReceiptResult',
      'AdjustmentResult',
      'ImportPreviewInput',
      'ImportPreviewResult',
    ]) {
      expect(schemaNames, `missing component ${name}`).toContain(name);
    }
    // Spot-check that a contract schema carries its constraints.
    expect(
      document.components?.schemas?.SalesOrderInput?.properties,
    ).toHaveProperty('customerId');
    expect(
      document.components?.schemas?.SalesOrderInput?.properties?.lines,
    ).toHaveProperty('items');
  });

  it('documents signup/login/session with request and response bodies', async () => {
    const document = await getDocument();

    const signup = operation(document, '/v1/auth/signup', 'post');
    expect(signup.requestBody?.content?.['application/json'].schema).toEqual({
      $ref: '#/components/schemas/SignupInput',
    });
    expect(jsonBody(signup, '201')?.schema).toEqual({
      $ref: '#/components/schemas/AuthSessionResult',
    });

    const login = operation(document, '/v1/auth/login', 'post');
    expect(login.requestBody?.content?.['application/json'].schema).toEqual({
      $ref: '#/components/schemas/LoginInput',
    });

    const session = operation(document, '/v1/auth/session', 'get');
    expect(jsonBody(session, '200')?.schema).toEqual({
      $ref: '#/components/schemas/SessionInfo',
    });
  });

  it('documents order create/list/transitions with pagination and idempotency', async () => {
    const document = await getDocument();

    const create = operation(document, '/v1/orders', 'post');
    expect(create.requestBody?.content?.['application/json'].schema).toEqual({
      $ref: '#/components/schemas/SalesOrderInput',
    });
    // Draft create/update are NOT idempotent at runtime: they must not
    // advertise a required Idempotency-Key.
    expect(hasRequiredIdempotencyKey(create)).toBe(false);

    const update = operation(document, '/v1/orders/{id}', 'patch');
    expect(hasRequiredIdempotencyKey(update)).toBe(false);

    const list = operation(document, '/v1/orders', 'get');
    const listParams = new Map(
      (list.parameters ?? []).map((parameter) => [parameter.name, parameter]),
    );
    for (const name of ['page', 'pageSize', 'search', 'status']) {
      expect(listParams.get(name), `missing query param ${name}`).toBeDefined();
    }
    expect(listParams.get('status')?.schema?.enum).toEqual([
      'DRAFT',
      'CONFIRMED',
      'FULFILLED',
      'CANCELLED',
    ]);
    expect(jsonBody(list, '200')?.schema).toEqual({
      $ref: '#/components/schemas/OrderList',
    });

    // Transitions are idempotent at runtime (executeIdempotent), so the
    // required header must be advertised.
    for (const transition of ['confirm', 'fulfill', 'cancel']) {
      const transitionOperation = operation(
        document,
        `/v1/orders/{id}/${transition}`,
        'post',
      );
      expect(
        hasRequiredIdempotencyKey(transitionOperation),
        `${transition} must require Idempotency-Key`,
      ).toBe(true);
    }

    const confirm = operation(document, '/v1/orders/{id}/confirm', 'post');
    expect(
      confirm.parameters?.some((parameter) => parameter.name === 'id'),
    ).toBe(true);
    expect(jsonBody(confirm, '200')?.schema).toEqual({
      $ref: '#/components/schemas/SalesOrderDetail',
    });
  });

  it('documents receipts and adjustments with idempotency headers', async () => {
    const document = await getDocument();

    const receipt = operation(document, '/v1/receipts', 'post');
    expect(receipt.requestBody?.content?.['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ReceiptInput',
    });
    expect(jsonBody(receipt, '201')?.schema).toEqual({
      $ref: '#/components/schemas/ReceiptResult',
    });
    expect(hasRequiredIdempotencyKey(receipt)).toBe(true);

    const adjustment = operation(document, '/v1/inventory/adjustments', 'post');
    expect(
      adjustment.requestBody?.content?.['application/json'].schema,
    ).toEqual({
      $ref: '#/components/schemas/InventoryAdjustmentInput',
    });
    expect(hasRequiredIdempotencyKey(adjustment)).toBe(true);
  });

  it('documents inventory read shapes that match the runtime serializers', async () => {
    const document = await getDocument();
    const schemas = document.components?.schemas ?? {};

    const balances = operation(document, '/v1/inventory/balances', 'get');
    expect(jsonBody(balances, '200')?.schema).toEqual({
      $ref: '#/components/schemas/InventoryBalanceList',
    });
    const balanceItem = schemas.InventoryBalance;
    expect(balanceItem?.properties).toMatchObject({
      available: {},
      id: {},
      onHand: {},
      product: {},
      productId: {},
      reserved: {},
      updatedAt: {},
      warehouseId: {},
    });

    const movements = operation(document, '/v1/inventory/movements', 'get');
    expect(jsonBody(movements, '200')?.schema).toEqual({
      $ref: '#/components/schemas/StockMovementList',
    });
    expect(schemas.StockMovementList?.properties?.items).toHaveProperty(
      'items',
    );
    expect(schemas.StockMovement?.properties).toMatchObject({
      type: {},
      quantityDelta: {},
      onHandAfter: {},
      referenceType: {},
      referenceId: {},
    });

    const alerts = operation(document, '/v1/alerts', 'get');
    expect(jsonBody(alerts, '200')?.schema).toEqual({
      $ref: '#/components/schemas/LowStockAlertList',
    });
    expect(alerts.parameters?.some((p) => p.name === 'status')).toBe(true);
    expect(schemas.LowStockAlert?.properties).toMatchObject({
      status: {},
      availableAtOpen: {},
      reorderPoint: {},
      openedAt: {},
      resolvedAt: {},
      product: {},
    });
  });

  it('declares session-cookie auth on protected operations and none on public routes', async () => {
    const document = await getDocument();

    // Public auth routes carry no security requirement.
    for (const path of [
      '/v1/auth/login',
      '/v1/auth/signup',
      '/v1/auth/demo-login',
    ]) {
      const authOperation = operation(document, path, 'post');
      expect(
        authOperation.security,
        `${path} must stay public`,
      ).toBeUndefined();
    }

    // A protected read requires the session cookie.
    const list = operation(document, '/v1/orders', 'get');
    expect(list.security).toContainEqual({ sessionCookie: [] });

    // A protected write requires the session cookie AND documents CSRF.
    const create = operation(document, '/v1/orders', 'post');
    expect(create.security).toContainEqual({ sessionCookie: [] });
    const csrfHeader = create.parameters?.find(
      (parameter) => parameter.name === 'X-CSRF-Token',
    );
    expect(csrfHeader).toBeDefined();
    expect(csrfHeader?.required).toBe(true);
    expect(csrfHeader?.in).toBe('header');

    // An idempotent command documents session auth, CSRF, AND the
    // Idempotency-Key header.
    const receipt = operation(document, '/v1/receipts', 'post');
    expect(receipt.security).toContainEqual({ sessionCookie: [] });
    expect(
      receipt.parameters?.some(
        (parameter) =>
          parameter.name === 'X-CSRF-Token' && parameter.required === true,
      ),
    ).toBe(true);
    expect(hasRequiredIdempotencyKey(receipt)).toBe(true);

    // The security scheme is registered under the stable name with the
    // configured cookie name.
    expect(document.components?.securitySchemes?.sessionCookie).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'stockpilot_session',
    });
  });

  it('declares the RFC 9457 problem-details shape on every operation', async () => {
    const document = await getDocument();
    const problemRef = {
      $ref: '#/components/schemas/ProblemDetails',
    };
    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      for (const [method, operationDefinition] of Object.entries(pathItem)) {
        if (!['get', 'post', 'patch', 'put', 'delete'].includes(method)) {
          continue;
        }
        const defaultResponse = operationDefinition.responses?.default;
        expect(
          defaultResponse,
          `${method.toUpperCase()} ${path} missing default problem response`,
        ).toBeDefined();
        expect(
          defaultResponse?.content?.['application/problem+json']?.schema,
        ).toEqual(problemRef);
      }
    }
  });
});

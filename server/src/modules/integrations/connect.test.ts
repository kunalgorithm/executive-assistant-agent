import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import express from 'express';
import helmet from 'helmet';

import { createConnectPageHandler } from './connect';
import { renderIntegrationCancelledPage, renderIntegrationErrorPage, renderIntegrationSuccessPage } from './http';
import { resolvePublicApiUrl } from '@/utils/public-url';

async function setup(t: TestContext, providers = { googleEnabled: true, microsoftEnabled: true }) {
  const lookups: string[] = [];
  const app = express();
  app.use(helmet());
  app.get(
    '/connect',
    createConnectPageHandler({
      ...providers,
      findUserByToken: async (token) => {
        lookups.push(token);
        return token === 'valid-token' ? { id: 'user-1' } : null;
      },
    }),
  );
  app.get('/callback-success/:provider', (req, res) =>
    renderIntegrationSuccessPage(res, req.params.provider === 'google' ? 'google' : 'microsoft'),
  );
  app.get('/callback-cancelled', (_req, res) => renderIntegrationCancelledPage(res));
  app.get('/escaped-error', (_req, res) =>
    renderIntegrationErrorPage(res, '<script>alert(1)</script>', 'Invalid <img src=x onerror=alert(1)>'),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    lookups,
    get: async (pathname: string) => {
      const response = await fetch(base + pathname, { redirect: 'manual' });
      return { response, html: await response.text() };
    },
  };
}

test('valid connection page works on the API with relative provider links and no SPA assets', async (t) => {
  const { get, lookups } = await setup(t);
  const { response, html } = await get('/connect?t=valid-token');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  assert.match(html, /href="\/api\/auth\/google\/start\?t=valid-token"/);
  assert.match(html, /href="\/api\/auth\/microsoft\/start\?t=valid-token"/);
  assert.doesNotMatch(html, /<script|ea\.getsayla\.com|VITE_API_URL/);
  assert.deepEqual(lookups, ['valid-token']);
});

test('missing, invalid and consumed or expired tokens cannot reach provider buttons', async (t) => {
  const { get, lookups } = await setup(t);
  for (const pathname of ['/connect', '/connect?t=expired', '/connect?t=used', '/connect?t=a&t=b']) {
    const { response, html } = await get(pathname);
    assert.ok([400, 410].includes(response.status));
    assert.doesNotMatch(html, /href="\/api\/auth/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.deepEqual(lookups, ['expired', 'used']);
});

test('only configured providers are offered', async (t) => {
  const { get } = await setup(t, { googleEnabled: true, microsoftEnabled: false });
  const { html } = await get('/connect?t=valid-token');
  assert.match(html, /Connect Google/);
  assert.doesNotMatch(html, /href="\/api\/auth\/microsoft/);
});

test('missing provider configuration returns a useful page without creating a connection', async (t) => {
  const { get } = await setup(t, { googleEnabled: false, microsoftEnabled: false });
  const { response, html } = await get('/connect?t=valid-token');
  assert.equal(response.status, 503);
  assert.match(html, /reminders and general help/);
  assert.doesNotMatch(html, /href="\/api\/auth/);
});

test('success and cancellation render locally without redirecting to a frontend', async (t) => {
  const { get } = await setup(t);
  for (const pathname of [
    '/callback-success/google',
    '/callback-success/microsoft',
    '/callback-cancelled',
    '/connect?denied=1',
  ]) {
    const { response, html } = await get(pathname);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(html, /iMessage|without connecting/);
  }
});

test('error pages escape dynamic text rather than inserting markup', async (t) => {
  const { get } = await setup(t);
  const { html } = await get('/escaped-error');
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
});

test('connection URLs use the configured API origin or Render URL, never the frontend or request host', () => {
  const config = {
    NODE_ENV: 'production',
    PORT: 8000,
    RENDER_EXTERNAL_URL: 'https://example.onrender.com',
    CLIENT_URL: 'https://broken-frontend.example.com',
    host: 'attacker.example.com',
  };
  assert.equal(resolvePublicApiUrl(config), 'https://example.onrender.com');
  assert.equal(
    resolvePublicApiUrl({ ...config, PUBLIC_API_URL: 'https://api.example.com/' }),
    'https://api.example.com',
  );
  assert.equal(resolvePublicApiUrl({ NODE_ENV: 'development', PORT: 8123 }), 'http://localhost:8123');
  assert.throws(() => resolvePublicApiUrl({ NODE_ENV: 'production', PORT: 8000 }), /PUBLIC_API_URL/);
  for (const PUBLIC_API_URL of [
    'javascript:alert(1)',
    'https://name:password@example.com',
    'https://example.com/path',
    'https://example.com?redirect=evil',
    'https://example.com#evil',
    'http://example.com',
  ]) {
    assert.throws(() => resolvePublicApiUrl({ ...config, PUBLIC_API_URL }), /PUBLIC_API_URL/);
  }
});

import type { Response } from 'express';

import { statusCodes } from '@/utils/http';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
}

export function renderIntegrationPage(
  res: Response,
  opts: {
    title: string;
    body: string;
    status?: number;
    details?: string[];
    actions?: Array<{ label: string; href: string }>;
  },
) {
  const details = opts.details?.length
    ? `<ul>${opts.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>`
    : '';
  const actions = (opts.actions ?? [])
    .map((action) => `<a class="button" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`)
    .join('');
  res
    .status(opts.status ?? statusCodes.OK)
    .set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    })
    .type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${escapeHtml(opts.title)} · Sayla</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#101512;color:#f5f7f1;min-height:100dvh;margin:0;padding:32px 24px;display:grid;place-items:center}
main{width:100%;max-width:440px}.brand{font-size:12px;letter-spacing:.2em;color:#b8d5a7;margin-bottom:28px}h1{font-size:30px;line-height:1.15;margin:0 0 16px;letter-spacing:-.025em}p,li{color:#bec7bd;font-size:16px;line-height:1.6}p{margin:0}ul{padding-left:20px;margin:24px 0}.actions{display:grid;gap:12px;margin-top:28px}.button{display:block;text-align:center;border:1px solid #899e81;border-radius:12px;padding:16px;color:#f5f7f1;text-decoration:none;font-weight:600}.button:first-child{background:#d1edbd;color:#152212;border-color:#d1edbd}.button:hover{opacity:.85}.button:focus-visible{outline:3px solid #fff;outline-offset:4px}
</style></head><body><main><div class="brand">SAYLA</div><h1>${escapeHtml(opts.title)}</h1><p>${escapeHtml(opts.body)}</p>${details}<div class="actions">${actions}</div></main></body></html>`);
}

export function renderIntegrationErrorPage(
  res: Response,
  title: string,
  body: string,
  status: number = statusCodes.BAD_REQUEST,
) {
  renderIntegrationPage(res, { title, body, status });
}

export function renderIntegrationSuccessPage(res: Response, provider: 'google' | 'microsoft') {
  renderIntegrationPage(res, {
    title: `${provider === 'google' ? 'Google' : 'Microsoft'} account connected`,
    body: 'You can close this tab and return to iMessage. Try asking what’s on your calendar or what needs attention in your inbox.',
  });
}

export function renderIntegrationCancelledPage(res: Response) {
  renderIntegrationPage(res, {
    title: 'Account not connected',
    body: 'You can keep using Sayla without connecting an account. If you want to try again later, text “connect” for a fresh link.',
  });
}

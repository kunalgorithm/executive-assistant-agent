import type { Response } from 'express';

import { statusCodes } from '@/utils/http';

export function renderIntegrationErrorPage(
  res: Response,
  title: string,
  body: string,
  status: number = statusCodes.BAD_REQUEST,
) {
  res
    .status(status)
    .type('html')
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#fafafa;
display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0;padding:24px}
.c{max-width:440px}h1{font-size:24px;margin:0 0 12px;font-weight:700}p{color:#a3a3a3;line-height:1.5;margin:0}
</style></head><body><div class="c"><h1>${title}</h1><p>${body}</p></div></body></html>`,
    );
}

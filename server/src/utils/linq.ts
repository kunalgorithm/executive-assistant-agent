import Linq from '@linqapp/sdk';

import { env } from '@/utils/env';

let client: Linq | undefined;

export function getLinqClient() {
  return (client ??= new Linq({
    apiKey: env.LINQ_API_KEY,
    webhookSecret: env.LINQ_WEBHOOK_SECRET,
    timeout: 15_000,
    maxRetries: 0,
  }));
}

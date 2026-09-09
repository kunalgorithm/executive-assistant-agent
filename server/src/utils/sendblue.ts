import SendblueAPI from 'sendblue';

import { env } from '@/utils/env';

let client: SendblueAPI | undefined;

export function getSendblueClient() {
  return (client ??= new SendblueAPI({ apiKey: env.SENDBLUE_API_KEY, apiSecret: env.SENDBLUE_SECRET }));
}

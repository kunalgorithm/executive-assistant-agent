import SendblueAPI from 'sendblue';

import { env } from '@/utils/env';

export const sendblue = new SendblueAPI({
  apiKey: env.SENDBLUE_API_KEY,
  apiSecret: env.SENDBLUE_SECRET,
});

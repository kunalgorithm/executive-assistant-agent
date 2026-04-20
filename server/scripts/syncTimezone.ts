/**
 * One-shot: for every user with google_refresh_token set, refresh their access token
 * and write their authoritative Google Calendar timezone to user.timezone.
 *
 * Run: pnpm tsx scripts/syncTimezone.ts
 */
import 'dotenv/config';
import { google } from 'googleapis';

import { db } from '../src/utils/db';
import { env } from '../src/utils/env';

async function main() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error('GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI must be set');
  }

  const users = await db.user.findMany({
    where: { googleRefreshToken: { not: null } },
    select: { id: true, googleRefreshToken: true, timezone: true, phoneNumber: true },
  });

  console.log(`Found ${users.length} connected users`);

  for (const user of users) {
    const oauth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
    oauth.setCredentials({ refresh_token: user.googleRefreshToken });

    try {
      const calendar = google.calendar({ version: 'v3', auth: oauth });
      const { data } = await calendar.calendars.get({ calendarId: 'primary' });
      const tz = data.timeZone;

      if (!tz) {
        console.log(`  user=${user.id} phone=${user.phoneNumber} → no tz in Google response, skipping`);
        continue;
      }

      if (tz === user.timezone) {
        console.log(`  user=${user.id} phone=${user.phoneNumber} → already ${tz}, no change`);
        continue;
      }

      await db.user.update({ where: { id: user.id }, data: { timezone: tz } });
      console.log(`  user=${user.id} phone=${user.phoneNumber} → updated ${user.timezone} → ${tz}`);
    } catch (err) {
      console.error(`  user=${user.id} phone=${user.phoneNumber} FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

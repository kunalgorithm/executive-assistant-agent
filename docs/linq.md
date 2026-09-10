# Linq messaging setup

The server supports Linq alongside SendBlue. Select one with `MESSAGING_PROVIDER` (default: `sendblue`). Incoming Linq messages run through the existing onboarding, Google/Microsoft connections, and EA response pipeline. Replies, typing indicators, reactions, and scheduled messages use the selected provider.

## Render configuration

1. Deploy the Linq integration code to the API service.
2. Create a Linq webhook subscription with this exact URL, including the version query parameter:

   ```text
   https://api.ea.getsayla.com/api/messaging/webhook/linq?version=2026-02-03
   ```

   Subscribe to `message.received`, `message.sent`, `message.delivered`, `message.read`, and `message.failed`. With the authenticated Linq CLI:

   ```bash
   linq webhooks create \
     --url 'https://api.ea.getsayla.com/api/messaging/webhook/linq?version=2026-02-03' \
     --events message.received,message.sent,message.delivered,message.read,message.failed
   ```

   Copy the signing secret from the response directly into Render's environment settings. Treat it as a password; do not commit it or paste command output into a PR.

3. Set these variables on the Render API service and redeploy:

   | Variable              | Value                                                             |
   | --------------------- | ----------------------------------------------------------------- |
   | `MESSAGING_PROVIDER`  | `linq`                                                            |
   | `LINQ_API_KEY`        | API token from the Linq dashboard                                 |
   | `LINQ_FROM_NUMBER`    | Assigned Linq phone number, in E.164 format (e.g. `+15555550100`) |
   | `LINQ_WEBHOOK_SECRET` | The permanent subscription's `whsec_...` signing secret           |
   | `OWNER_PHONE_NUMBER`  | Optional: your personal E.164 number to restrict the EA to you    |

   Existing database, Gemini, OAuth, and client URL settings still apply. SendBlue credentials can stay stored for rollback; they are not required in Linq mode. The Linq route returns 503 until Linq is selected. After cutover, disable the SendBlue subscriptions to avoid retries against disabled routes.

4. Text the Linq number from your iPhone **after** deployment and webhook setup. Existing users can text `connect` to obtain a fresh account connection link. A brand new user receives the welcome/link automatically.
5. Verify both the response on your phone and these Render logs, correlated by `requestId`:
   - `[webhook] HTTP request received`: request reached the server, even if authentication fails.
   - `[webhook] Linq signature verified; event received`: valid signed Linq event.
   - `[webhook] Inbound message saved` and `Message processing finished`: app processing.
   - `[webhook] Delivery status received`: sent, delivered, read, or failed; HTTP acceptance alone does not prove delivery.

## Behavior and limits

- Linq signatures are verified over the raw body with the official SDK's Standard Webhooks verifier, including timestamp checks. Message bodies and credentials are not included in the new webhook logs.
- Only direct messages to `LINQ_FROM_NUMBER` from phone numbers are supported. Group chats, iMessage email handles, unsupported events, and reconciled historical messages do not trigger the EA.
- A user must text the Linq number through the configured webhook at least once before the app can reply or send scheduled messages. The server stores the Linq chat ID with the peer and line number in the existing message metadata column (`sendblueData`). Old SendBlue conversations and the CLI trial do not populate that mapping. No database migration is needed.
- The Free sandbox used for the trial requires the recipient to initiate contact. Account entitlements can differ; verify them in the Linq dashboard before rollout.
- Switching back to `MESSAGING_PROVIDER=sendblue` restores the existing SendBlue transport and endpoints after redeployment.
- The existing inbound processor acknowledges before asynchronous work completes. Its queue is in memory: a server restart can lose accepted work. Message IDs deduplicate repeated deliveries, but this does not replace a durable job queue or recovery for failed processing. Address that before relying on the EA for critical workflows.

## Local validation

```bash
pnpm --dir server test:messaging
pnpm --dir server lint
pnpm --dir server build:only
```

Tests cover signed HTTP requests, altered payloads, missing/expired signatures, wrong versions, conversation isolation, historical messages, stable deduplication IDs, and delivery/failure event mapping. They use a local HTTP server and no Linq network calls, real phone numbers, or database writes.

For local end-to-end testing, point a separate Linq subscription at a public tunnel to port 8000 with the same `/api/messaging/webhook/linq?version=2026-02-03` path, and put that subscription's signing secret in `server/.env`. Do not reuse a temporary CLI listener's signing secret for the permanent Render subscription.

Reference: [Linq iMessage documentation](https://docs.linqapp.com/channel/imessage/).

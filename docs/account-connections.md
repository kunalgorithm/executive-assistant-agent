# Optional account connection

Sayla works over iMessage without connecting Google or Microsoft. New users receive a short greeting when they say hello; first-message questions and reminder requests go straight to the assistant. The app only creates a connection link for an explicit request such as `connect`, `connect my calendar`, `link my email`, or `send me a connect link`.

Ordinary conversation does not create or refresh connection tokens. Existing connections still provide their tools. If a request needs data from an unconnected account, the assistant explains that it cannot access that data and can help with details the user shares. It does not automatically start account setup. Reminders remain available without external accounts.

## Hosting

The Express API serves `/connect?t=...` itself. Google and Microsoft buttons use relative API paths, and consent success, cancellation, and error pages render on the backend. No web SPA, `VITE_API_URL`, or frontend DNS is needed for this flow.

The public API origin is selected in this order:

1. `PUBLIC_API_URL`, if set.
2. Render's automatically provided `RENDER_EXTERNAL_URL`.
3. `http://localhost:<PORT>` in development. Other environments must configure a public origin.

The app never constructs connection links from request Host/Forwarded headers. `CLIENT_URL` continues to configure the optional web SPA's CORS origin; it no longer determines connection links or OAuth result pages.

Reference: [Render's default environment variables](https://render.com/docs/environment-variables#render_external_url).

## This Render deployment

After merging and deploying the change, connection links will use:

```text
https://executive-assistant-agent.onrender.com/connect?t=...
```

No new public URL variable is needed on Render unless you want to override that hostname. If `PUBLIC_API_URL` is already set, ensure it is a working API origin.

Before connecting an account, register the corresponding callback URL in its provider application:

| Provider  | Registered callback URL                                                      |
| --------- | ---------------------------------------------------------------------------- |
| Google    | `https://executive-assistant-agent.onrender.com/api/auth/google/callback`    |
| Microsoft | `https://executive-assistant-agent.onrender.com/api/auth/microsoft/callback` |

Google needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; Microsoft needs `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`. Configure only the providers you want to offer. These app credentials do not connect any user's account by themselves.

`GOOGLE_REDIRECT_URI` and `MICROSOFT_REDIRECT_URI` are optional overrides. If they still point at the broken custom domain, update them to the corresponding URL above or remove them to use the defaults. The effective URL must exactly match the provider's registered callback. Existing explicit overrides are preserved by the code.

Save environment changes and redeploy. Text `connect` to request a fresh link; previous links with the broken frontend hostname will not repair themselves.

## Access and validation

- Opening the connection page validates the one-hour token but does not connect an account. The user must select a provider and approve consent.
- The existing OAuth token validation, signed state, and token exchange are retained. A completed connection consumes the connect token.
- The page only offers configured providers. An unavailable provider setup, expired link, or declined consent leaves regular messaging available.
- Connection pages use no external assets, disable caching and referrers, and escape dynamic HTML.
- Google/Microsoft email access remains read-only; this change does not add email sending or alter granted scopes.

Run `pnpm --dir server test`, `pnpm --dir server lint`, and `pnpm --dir server build:only`. Tests cover opt-in message behavior, new-user requests, obsolete link removal from model history, same-origin page navigation, invalid/expired token handling, local success/cancellation pages, and public origin configuration. The real provider consent flow still requires testing with the registered OAuth app and the user's approval.

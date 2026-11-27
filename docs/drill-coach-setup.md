# DRILL AI Coach setup (V1.1)

The AI Coach is an optional, owner-only feature in DRILL Technical Communication. The static site on Vercel calls a Cloudflare Worker (`backend/drill-coach/`). The Worker checks your Google identity, enforces the spending limits in a SQLite-backed Durable Object, and calls the OpenAI Responses API.

Everything below runs on free plans: Cloudflare Workers Free, Google Cloud OAuth (no billing), and Vercel Hobby. OpenAI usage is paid, and the Worker caps it at $3 per month and 10 evaluations per day.

The repository ships with `COACH_MODE = "off"` and no `drill_coach_api` URL, so the public site shows "AI evaluation is unavailable" until you complete these steps.

Never paste secrets into chat, issues, commits, or `wrangler.toml`. Wrangler prompts for each secret in your terminal.

## 1. Google Sign-In client

1. Open the [Google Cloud console](https://console.cloud.google.com/), and create a project such as `drill-coach`. You don't need to enable billing.
2. Go to **Google Auth Platform → Branding** (the OAuth consent screen). Choose **External**, enter an app name and your support email, and save.
3. Under **Audience**, leave the publishing status as **Testing** and add only your own Google account as a test user. This is a second gate on top of the Worker's owner check.
4. Under **Clients**, create an **OAuth client ID** of type **Web application**.
   - **Authorized JavaScript origins:** `https://sepideh.io`. For local testing, also add `http://localhost:4000` and `http://localhost`.
   - **Authorized redirect URIs:** leave empty. Google Identity Services returns an ID token directly to the page.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`). It's public, but keep it out of the repository so the configuration lives in one place.

### Find your Google account subject (`sub`)

The Worker authorizes exactly one Google account by its stable numeric `sub` claim, not by email.

1. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. In step 1, enter the scope `openid`, click **Authorize APIs**, and sign in with your account.
3. In step 2, click **Exchange authorization code for tokens**.
4. In step 3, request `https://openidconnect.googleapis.com/v1/userinfo` with GET. The `sub` field in the response is your subject, a string of digits.
5. Afterwards, remove the Playground's access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## 2. Cloudflare Worker

Requires Node 22 or later and a free Cloudflare account. Run these commands from `backend/drill-coach/`.

```sh
cd backend/drill-coach
npx wrangler@4.168.0 login
npx wrangler@4.168.0 deploy --dry-run   # local bundle check, uploads nothing
npx wrangler@4.168.0 deploy             # creates the Worker and its SQLite Durable Object, mode "off"
```

Wrangler prints the Worker URL, for example `https://drill-coach.<your-subdomain>.workers.dev`.

Set the configuration as Worker secrets. Each command prompts for the value in your terminal:

```sh
npx wrangler@4.168.0 secret put GOOGLE_CLIENT_ID
npx wrangler@4.168.0 secret put OWNER_GOOGLE_SUB
openssl rand -base64 48 | tr -d '\n' | npx wrangler@4.168.0 secret put DEDUPE_SECRET
```

`DEDUPE_SECRET` signs follow-up prompts and keys the duplicate-request fingerprints. Use at least 32 random characters.

`wrangler.toml` keeps Workers Logs disabled (`[observability] enabled = false`), so no request data reaches Cloudflare logs. Leave it that way.

## 3. Connect the website

Add the Worker URL to `_config.vercel.yml` in a pull request:

```yaml
drill_coach_api: https://drill-coach.<your-subdomain>.workers.dev
```

The frontend accepts only an `https:` URL (or `http://localhost` during local development). `ALLOWED_ORIGIN` in `wrangler.toml` must match the site origin exactly, and is `https://sepideh.io` by default. Vercel preview URLs are rejected by design.

## 4. End-to-end check in mock mode (no OpenAI cost)

```sh
npx wrangler@4.168.0 deploy --var COACH_MODE:mock
```

On `https://sepideh.io/drill/communication/`, open **AI Communication Coach**, sign in, and evaluate an answer. You should see **Mock result · 3.0 / 5**. Mock mode uses its own ledger, separate from live usage.

Signing in with any other Google account should show "This coach is limited to the authorized account."

## 5. OpenAI (only when you're ready to spend)

1. On [platform.openai.com](https://platform.openai.com/), create a dedicated project, for example `drill-coach`.
2. In the project's **Limits**, set a monthly budget of $3 as a second safeguard. Optionally, allow only the model `gpt-5.4-mini`.
3. Create a **project API key** with restricted permissions (write access to **Responses** only).
4. Check that the prices in `backend/drill-coach/evaluation.mjs` (`prices`, in USD per million tokens) match the published [pricing](https://openai.com/api/pricing/) for `gpt-5.4-mini-2026-03-17`. The budget reservations rely on these numbers.
5. Store the key and switch to live mode:

```sh
npx wrangler@4.168.0 secret put OPENAI_API_KEY
npx wrangler@4.168.0 deploy --var COACH_MODE:live
```

Run one evaluation, then compare the coach's estimate with the OpenAI usage page.

## Emergency off switch

Any of these stops paid evaluations right away:

- `npx wrangler@4.168.0 deploy`, which restores the repository default `COACH_MODE = "off"`. Any deploy without `--var COACH_MODE:live` switches the coach off.
- In the Cloudflare dashboard, go to **Workers → drill-coach → Settings → Variables** and set `COACH_MODE` to `off`.
- `npx wrangler@4.168.0 secret delete OPENAI_API_KEY`. Without a key, live mode reports itself as disabled.
- Revoke the key in the OpenAI dashboard.

The Worker also has an automatic latch. If OpenAI ever reports more tokens than the Worker reserved, it records `usage-bound` in the ledger and refuses all later live evaluations. V1.1 has no endpoint to clear the latch, on purpose. Investigate the cause before deciding how to re-enable the coach.

## Limits enforced by the Worker

| Control | Value |
| --- | --- |
| Monthly application budget | $3.00 (reserved before each call, settled from reported usage) |
| Paid evaluations per day | 10 (Europe/Zurich calendar dates) |
| Concurrent evaluations | 1, with 2 seconds minimum between evaluations |
| Duplicate answers | Same question and answer refused for 15 minutes, and request IDs are single-use |
| Sign-in attempts | 30 per IP address per minute |
| Session lifetime | 30 minutes, kept only in page memory |
| Answer size | 2,400 UTF-8 bytes |
| Output size | 1,500 tokens, with no tools and no automatic retries |

A reservation for a call that times out or fails without reported usage stays held. It counts against the monthly budget until the month ends, which keeps the accounting conservative.

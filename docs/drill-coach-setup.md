# DRILL AI Coach setup (V1.2)

The AI Coach is an optional, owner-only feature in DRILL Technical Communication. The static site on Vercel calls a Cloudflare Worker (`backend/drill-coach/`). The Worker checks your Google identity, enforces the spending limits in a SQLite-backed Durable Object, and calls the OpenAI Responses API.

Everything below runs on free plans: Cloudflare Workers Free (including the Workers AI daily allocation used for transcription), Google Cloud OAuth (no billing), and Vercel Hobby. OpenAI usage is paid, and the Worker caps it at $3 per month and 10 evaluations per day. Recording spoken answers happens entirely in the browser and needs none of this.

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
4. Check the prices in `backend/drill-coach/evaluation.mjs`. They were verified on 2026-11-27 against the [model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini) and the [pricing page](https://developers.openai.com/api/docs/pricing): snapshot `gpt-5.4-mini-2026-03-17`, Standard tier, $0.75 input and $4.50 output per million tokens. Check again before going live, because budget reservations rely on these numbers. Requests pin `service_tier: "default"` so they never use the Fast tier, which bills at twice the rate. Don't use regional (data-residency) endpoints, which add 10%.
5. Store the key and switch to live mode:

```sh
npx wrangler@4.168.0 secret put OPENAI_API_KEY
npx wrangler@4.168.0 deploy --var COACH_MODE:live
```

Run one evaluation, then compare the coach's estimate with the OpenAI usage page.

## 6. Spoken-answer transcription (Workers AI, free allocation only)

Transcription uses the `AI` binding in `wrangler.toml` and the model `@cf/openai/whisper-large-v3-turbo`, at 46.63 Neurons per audio minute (verified 2026-11-27). On the Workers **Free** plan, the account gets 10,000 Neurons per day, and requests beyond that fail with an error instead of being billed. There is no paid fallback.

1. Confirm the plan in the Cloudflare dashboard under **Workers & Pages → Plans**. It must say **Free**. Never upgrade the plan for this feature: on Workers Paid, Workers AI usage beyond the allocation is billed.
2. Check the mock flow first. Transcription has its own switch, `TRANSCRIPTION`, which is `"off"` by default:

   ```sh
   npx wrangler@4.168.0 deploy --var COACH_MODE:mock --var TRANSCRIPTION:on
   ```

   Record an answer, open the coach, sign in, and choose **Transcribe recording**. Mock mode returns a sample transcript without calling Workers AI.
3. Go live with both switches:

   ```sh
   npx wrangler@4.168.0 deploy --var COACH_MODE:live --var TRANSCRIPTION:on
   ```

   Each deploy must repeat both `--var` flags. A deploy without `TRANSCRIPTION:on` turns transcription off and leaves written evaluation as configured.

Workers AI processes the audio in memory. Cloudflare lists the model with zero data retention, and the Worker keeps its logs disabled. The ledger records only the request ID, a keyed fingerprint of the recording's first and last 64 KiB, the reported duration, and the estimated Neurons.

Chrome's WebM recordings carry no duration the Worker can read before decoding, and the Worker never trusts a client-reported length. So every request reserves the full 5 minutes (234 Neurons) and settles with the duration Whisper reports. A reported duration over 5 minutes is refused but still counted. If the call fails, the full reservation stays counted. Twenty reservations at the maximum come to 4,680 Neurons, under half of the daily allocation.

## Emergency off switch

Any of these stops paid evaluations right away (recording in the browser keeps working):

- `npx wrangler@4.168.0 deploy`, which restores the repository default `COACH_MODE = "off"`. Any deploy without `--var COACH_MODE:live` switches the coach off.
- In the Cloudflare dashboard, go to **Workers → drill-coach → Settings → Variables** and set `COACH_MODE` to `off`.
- `npx wrangler@4.168.0 secret delete OPENAI_API_KEY`. Without a key, live mode reports itself as disabled.
- Revoke the key in the OpenAI dashboard.

To stop transcription only, deploy without `--var TRANSCRIPTION:on`, or set `TRANSCRIPTION` to `off` in the dashboard. `COACH_MODE=off` also stops it.

The Worker also has an automatic latch. If OpenAI ever reports more tokens than the Worker reserved, it records `usage-bound` with a timestamp and refuses all later live evaluations. Redeploying with `COACH_MODE:live` does **not** clear it. Only the recovery procedure below does.

## Recovering from the automatic latch

Recovery needs three things at once: access to your Cloudflare account (to switch to maintenance mode and set a one-time secret), that admin secret, and a reconciliation against the spend OpenAI reports. The admin routes exist only in `COACH_MODE=maintenance`. They send no CORS headers, so only a command line can use them, not a web page. They allow 5 requests per minute, and failed attempts count. Maintenance mode also turns off sign-in and evaluations for everyone.

Run these commands in your own terminal, from `backend/drill-coach/`. Never paste the admin secret anywhere else.

1. **Create a one-time admin secret** and store it in the Worker. It lives only in this terminal's variable and in Cloudflare.

   ```sh
   ADMIN_SECRET=$(openssl rand -base64 48 | tr -d '\n')
   printf %s "$ADMIN_SECRET" | npx wrangler@4.168.0 secret put ADMIN_RECOVERY_SECRET
   WORKER=https://drill-coach.<your-subdomain>.workers.dev
   ```

2. **Switch to maintenance mode.**

   ```sh
   npx wrangler@4.168.0 deploy --var COACH_MODE:maintenance
   ```

3. **Inspect the ledger.** Note `latchedSince`, the month's `estimatedMonthlyMicros`, and any `held` reservations. 1,000,000 micros equals $1.

   ```sh
   curl -s -H "Authorization: Bearer $ADMIN_SECRET" "$WORKER/v1/admin/status"
   ```

4. **Investigate the cause.** On the OpenAI dashboard, open **Usage** for the `drill-coach` project and read the cost for the current month. Work out why usage exceeded the reservation, for example a changed model, a changed price, or a modified prompt. Fix the cause before you continue.

5. **Reconcile and clear the latch.** Convert the spend OpenAI reports for the current month to micros, rounding up. For example, $0.412 is `412000`. The month must be the current Europe/Zurich month. The ledger rises to the reported figure if that figure is higher, and never goes lower.

   ```sh
   curl -s -X POST "$WORKER/v1/admin/recover" \
     -H "Authorization: Bearer $ADMIN_SECRET" -H "Content-Type: application/json" \
     -d "{\"requestId\":\"$(uuidgen | tr 'A-Z' 'a-z')\",\"month\":\"$(TZ=Europe/Zurich date +%Y-%m)\",\"reportedSpendMicros\":412000,\"confirm\":\"RECONCILED-WITH-OPENAI-USAGE\"}"
   ```

   The response shows the ledger's estimate, the reported spend, the adjustment and the new totals. Run step 3 again to confirm that `latched` is `false` and that the recovery appears in `recoveries`, the audit trail of the last five recoveries.

6. **Remove the admin secret.**

   ```sh
   npx wrangler@4.168.0 secret delete ADMIN_RECOVERY_SECRET
   unset ADMIN_SECRET
   ```

7. **Reactivate deliberately.** Deploy `--var COACH_MODE:mock` to check the site first, then `--var COACH_MODE:live` only when you decide to resume paid evaluations.

Possible refusals:
- `busy`: an evaluation is still in flight. Wait two minutes.
- `month`: the month must be the current Zurich month.
- `duplicate`: generate a new `requestId`.
- `429`: wait a minute.

Reservations held from earlier failures stay counted until the month ends. You can also use this procedure without a latch, to align the ledger with OpenAI's figures.

## Limits enforced by the Worker

| Control | Value |
| --- | --- |
| Monthly application budget | $3.00 (reserved before each call, settled from reported usage) |
| Paid evaluations per day | 10 (Europe/Zurich calendar dates) |
| Concurrent evaluations | 1, with 2 seconds minimum between evaluations |
| Duplicate answers | Same question and answer refused for 15 minutes, and request IDs are single-use |
| Sign-in attempts | 30 per IP address per minute, and at most 200 unused sign-in challenges at a time |
| Admin recovery | Maintenance mode only, 5 requests per minute, no CORS |
| Processing tier | Standard (`service_tier: "default"`) |
| Session lifetime | 30 minutes, kept only in page memory |
| Answer size | 2,400 UTF-8 bytes written, 6,000 UTF-8 bytes for a spoken transcript |
| Maximum reservation per evaluation | about $0.013 written, about $0.016 spoken (worst case over all questions and follow-ups) |
| Transcriptions per day | 20 (Europe/Zurich calendar dates), one at a time, 2 seconds apart, separate from the 10 evaluations |
| Recording length | 5 minutes, stopped in the browser. The Worker refuses a reported duration over 5 minutes |
| Recording size | 6 MiB, from the header and again while streaming. WebM, Ogg or MP4 audio, with a matching file signature |
| Transcription reservation | 234 Neurons (5 minutes) before the call, settled from the reported duration |
| Duplicate recordings | Same question and recording refused for 15 minutes, and request IDs are single-use |
| Transcription prompt | Built only from the server-side question vocabulary. Clients cannot send prompt text |
| Output size | 1,500 tokens, with no tools and no automatic retries |

A reservation for a call that times out or fails without reported usage stays held. It counts against the monthly budget until the month ends, which keeps the accounting conservative.

## Future public access

Transcription and evaluation are limited to the owner account. Before opening them to other users, add per-user identities and quotas in the ledger (the `transcriptions` and `evaluations` tables are keyed by request, so a user column and per-user daily limits fit the existing reservations). Also add server-side duration checks before the call. A low-bitrate recording can run longer than 5 minutes within the 6 MiB size cap, so the reservation only stays safe while the count cap keeps the total under the free allocation.

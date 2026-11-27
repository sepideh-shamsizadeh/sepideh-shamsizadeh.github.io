# sepideh-shamsizadeh.github.io

Personal website of Sepideh Shamsizadeh — Physical AI & Robotics Engineer, Zurich.
Live at **https://sepideh.io** on Vercel Hobby. The [legacy GitHub Pages site](https://sepideh-shamsizadeh.github.io/) remains available, including [DRILL progress export](https://sepideh-shamsizadeh.github.io/drill/transfer/).

Built with Jekyll and deployed to Vercel, with GitHub Pages retained for migration. The theme started from Academic Pages / Minimal Mistakes (MIT, see `LICENSE`) and has been redesigned.

## Structure

| Path | What it is |
| --- | --- |
| `_pages/about.html` | Home page (hero, live panels, experience, projects, skills) |
| `_pages/story.md` | Long-form story |
| `_pages/tishtar.html` | Tishtar robot: vertical roadmap, architecture, build log |
| `_pages/year-archive.html` | Blog: Medium article cards + notes |
| `_posts/` | Blog posts. Posts with `medium_url` redirect to Medium |
| `_data/tishtar_roadmap.yml`, `_data/tishtar_journal.yml` | Tishtar roadmap and build log data |
| `_data/navigation.yml` | Header menu |
| `assets/css/site.css` | Design system: light/dark tokens, layout, components |
| `assets/css/tishtar.css` | Tishtar page styles |
| `assets/js/site.js` | Theme toggle, typing effects, clock, easter eggs |
| `assets/js/scan.js` | Animated point-cloud panel on the home page |
| `assets/js/tishtar-road.js` | Robot animation on the Tishtar roadmap |
| `files/Sepideh-Shamsizadeh-CV.pdf` | CV (also at `/cv/`) |
| `images/` | Profile photo, blog covers, favicon, post images |
| `docs/`, `tests/` | Maintenance notes and browser tests (not published) |

## Common edits

- **CV:** replace `files/Sepideh-Shamsizadeh-CV.pdf` (keep the file name).
- **Profile photo:** replace `images/sepideh-shamsizadeh.jpg` (portrait, about 720 px wide).
- **New article on this site:** start with `_drafts/example-draft.md` and follow the [technical blog workflow](docs/technical-blog.md).
- **New Medium article:** add a file in `_posts/` like the existing ones, with `medium_url`, `redirect_to`, `image` (put the cover in `images/blog/`), `topic` and a one-sentence `excerpt`.
- **Tishtar progress:** edit `_data/tishtar_roadmap.yml` (see `docs/tishtar-maintenance.md`).

## Run locally

```sh
bundle install
bundle exec jekyll serve --config _config.yml,_config.dev.yml
# open http://localhost:4000
```

Pushing to `master` builds and deploys the site with GitHub Actions (`.github/workflows/jekyll-docker.yml`).

## DRILL Technical Communication

Open **Technical Communication** from `/drill/`. Practice by category or topic, or choose a random prompt. Try an answer aloud or in writing, then open the structure hint and example as needed. Rate each answer yourself and save it to unlock the next prompt.

Start the 20-minute daily plan with the displayed durations, or open **Customize session durations** to adjust them. A 5-minute quick plan is also available. Each step has a suggested time budget and a timer you can start yourself. Save the review answer to complete the session. The module includes 12 lessons with examples and exercises, and a progress view with skill averages, questions to revisit, a practice streak, and the past seven days of activity.

Communication data uses the versioned `drill-communication-v1` browser storage key. Saved attempts, lesson checkmarks, session settings and the current session step persist on refresh. Written answers, notes and running timers last for the current page visit. Progress lives in the current browser profile and site origin. The module uses static assets and self-assessment, with no backend, accounts, transcription, or paid APIs.

Run the model tests with `node --test tests/drill-communication.test.cjs`. For browser tests, start Jekyll with both `_config.yml` and `_config.dev.yml` so the shared site assets resolve to the local preview. Run `node --test tests/drill-communication.browser.cjs` with Playwright available. Set `PLAYWRIGHT_PATH` for an external install, `CHROME_PATH` to use an installed Chrome binary, and `DRILL_BASE_URL` to override the default `http://localhost:4000`.

To test a rendered Jekyll build without a server, set `DRILL_BUILD_DIR` to the output directory and `DRILL_BASE_URL` to the origin configured in that build. Omit `DRILL_BUILD_DIR` to test a running preview or production. Set `DRILL_SCREENSHOT_DIR` to save example desktop and mobile screenshots during the run.

### AI Communication Coach (optional, owner-only)

In Practice and in daily or quick sessions, open **AI Communication Coach** under the answer box. Sign in with the authorized Google account, then choose **Evaluate my answer**. Nothing is sent until you click. Feedback covers eight rubric scores with reasons, technical and communication strengths and gaps, English corrections, a suggested structure, an improved answer, and one follow-up question. You can revise and compare attempts. Within a daily session, the review step compares your revised answer with your earlier evaluation of the same question. Meters show the day's evaluations and the month's estimated spending.

Only scores and review metadata are saved, in the separate `drill-ai-coach-v1` browser key. The Progress view lists them per attempt and per question, and each can be deleted. Written answers, feedback, revised answers and generated examples stay in page memory and are cleared on navigation, sign-out or reload. The Cloudflare Worker in `backend/drill-coach/` stores only operational data in SQLite: one-time sign-in nonces, hashed sessions, rate-limit counters and per-evaluation token and cost accounting. It never stores answer text.

The coach is off until it is configured. See [DRILL AI Coach setup](docs/drill-coach-setup.md) for the Google Sign-In client, the Cloudflare deployment, the emergency off switch, the spending limits, and the administrative procedure for recovering from the automatic shutdown latch.

Run the coach tests with `node --test tests/drill-coach.test.mjs`. They use an in-memory SQLite ledger and mocked Google and OpenAI responses, and never contact a paid API. After changing the DRILL question bank, run `node scripts/drill-catalog.cjs` to regenerate the Worker catalog. CI checks it with `--check`. For the browser test, build the site and run `node --test tests/drill-coach.browser.cjs` with `DRILL_BUILD_DIR` set, plus the Playwright and Chrome options above. The test serves the Worker logic in-process with a mock Google Sign-In.

When changing the DRILL page scripts or styles, update their version query strings in both DRILL entry pages so browsers refetch compatible assets after deployment.

## Deploying the site to Vercel

The GitHub repository and Jekyll remain the source of the site. GitHub Pages continues to serve the old hostname during the migration. The Vercel build keeps the same public paths and generates production SEO metadata for `https://sepideh.io`.

Build a preview with Ruby 3.3 and Node installed:

```sh
bundle install
bash scripts/build-vercel.sh preview
node tests/vercel-output.cjs preview
```

Use `production` instead of `preview` to build the production artifact. The output lives under `.vercel/output`. Preview deployments send `X-Robots-Tag: noindex, nofollow` and HTML robots metadata.

Before the first hosted preview, link a Vercel Hobby project to the Actions-based deployment path. Keep Vercel's separate Git auto-deploy trigger off to avoid duplicate deployments. Set the repository Actions variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `VERCEL_PREVIEW_ENABLED=true`, and set `VERCEL_TOKEN` using GitHub's secret manager. Trusted pull requests and manual workflow runs can deploy previews. Fork PRs run build checks without deploy credentials.

The production domain is attached to the `sepideh-website` Hobby project. GitHub Actions builds and checks the site on merges into `master`. To enable automatic uploads, add a Vercel deployment token as the `VERCEL_TOKEN` GitHub Actions secret, set `VERCEL_PRODUCTION_ENABLED=true`, and run the workflow on `master` once to verify the deployment. Keep GitHub Pages available for visitors and progress export.

## Transfer DRILL progress

Download the JSON file from [Transfer progress on GitHub Pages](https://sepideh-shamsizadeh.github.io/drill/transfer/). On [Transfer progress at sepideh.io](https://sepideh.io/drill/transfer/), select the file, review the summary, and choose **Import progress**. The file stays on your device. Close other DRILL tabs before importing.

The transfer includes flashcard ratings and daily counts, coding and LeetCode status, Technical Communication scores and completed sessions, lessons, AI Coach scores with their review dates, and the saved theme. It excludes written answers, personal notes, AI feedback, improved answers, and unfinished sessions. AI Coach rows pass through the same allowlist the coach uses to save them, so extra fields in a stored or imported file are dropped. The export also works as a backup on sepideh.io. New self-assessments save only scores and related metadata. Legacy notes on the old origin stay there.

When both origins have records, destination ratings and settings win by default. You can choose the file's ratings and settings for conflicts. Daily counts retain the larger value, and overlapping communication histories are combined without counting matching metadata twice. An interrupted import can be retried using the same file. Keep the source file until you have verified the new site.

For the two-origin browser regression test, build the Pages and Vercel artifacts, then run `node --test tests/drill-transfer.browser.cjs` with `DRILL_OLD_BUILD_DIR` pointing to the Pages output and `DRILL_BUILD_DIR` pointing to the Vercel static output. The existing Playwright and Chrome environment options apply.

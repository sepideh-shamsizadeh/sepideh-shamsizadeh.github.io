# Changelog

## DRILL 1.1.0 — Unreleased

- Added an optional, owner-only AI Communication Coach to Practice and to daily and quick sessions. Evaluation runs only on an explicit click, through a Cloudflare Worker backed by a free SQLite Durable Object.
- Added Google Sign-In limited to one account by its subject ID, with one-time nonces, hashed 30-minute sessions kept in page memory, sign-out, and sign-in rate limiting.
- Added structured feedback from the OpenAI Responses API (`gpt-5.4-mini`, strict JSON schema, `store: false`): eight rubric scores with reasons, technical and communication feedback, English corrections, a suggested structure, an improved answer, and a signed follow-up question.
- Added answer revision and comparison in the active session, including comparison against the earlier evaluation on the daily review step.
- Added spending controls: atomic reservations against a $3 monthly budget, 10 paid evaluations per Zurich day, one evaluation at a time, duplicate-request rejection, persistent token and cost accounting, a server-side `COACH_MODE` off switch, and an automatic latch when reported usage exceeds the reservation.
- Added usage and budget meters, and a per-question AI score summary in Progress.
- Added AI Coach scores and review dates to progress export and import, merged by evaluation ID. Answers, feedback and notes stay excluded.
- Added a command-line recovery procedure for the shutdown latch. It requires maintenance mode, a one-time admin secret, and reconciliation against OpenAI's reported spend. It never lowers the ledger and keeps an audit trail.
- Pinned the Standard processing tier, capped outstanding sign-in challenges, and separated the HMAC domain for follow-up seals. Model pricing was verified against OpenAI's published Standard rates.
- Saved only scores and review metadata in the separate `drill-ai-coach-v1` browser key. Answers and feedback are never written to browser storage, the database, or logs.
- Added mocked unit and browser tests, a catalog consistency check in CI, and [setup instructions](docs/drill-coach-setup.md).

## Unreleased

- Launch the Jekyll website at `https://sepideh.io` on Vercel Hobby and retain the GitHub Pages site for progress transfer.
- Add local export and import for DRILL ratings, coding progress, lesson and session history, and preferences.
- Save only metadata for new communication attempts. Keep new written answers and notes in memory.

## DRILL 1.0.1

- Made question-bank initialization deterministic and versioned the DRILL asset URLs. The module shows a loading or recovery message while questions are unavailable.
- Improved form, button, lesson, and table contrast in both site themes.
- Centered practice around the current exercise, added lesson cards and guided navigation, and made the standard daily session available without opening settings.
- Added a first-use progress view and browser regression coverage for loading, controls, both themes, and existing DRILL progress.

## DRILL 1.0.0

- Added Technical Communication practice with 21 exercises across 10 categories, linked to the existing DRILL question bank.
- Added optional countdowns, structure hints, on-demand example answers, and self-assessments for spoken or written answers.
- Added 12 lessons, a configurable 20-minute daily session, and a five-minute quick session.
- Added progress tracking for completed lessons and sessions, skill scores, questions to revisit, streaks, and weekly activity.
- Saved communication progress in the separate, versioned `drill-communication-v1` browser storage key. Existing flashcard and coding data retain their original storage format.

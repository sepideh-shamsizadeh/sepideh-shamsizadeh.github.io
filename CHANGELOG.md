# Changelog

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

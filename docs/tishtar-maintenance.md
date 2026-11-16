# Maintaining the Tishtar page

The page is served at `/tishtar/` by `_pages/tishtar.html` and `_layouts/tishtar.html`. It uses the shared design system in `assets/css/site.css` (light and dark themes) plus `assets/css/tishtar.css`. There are no runtime dependencies, APIs or automatic GitHub synchronization.

## Page structure

1. Hero with a short spec sheet (hard-coded in `_pages/tishtar.html`).
2. Vertical roadmap: one pin per phase, alternating left and right of a centre line.
3. System diagram: `_includes/tishtar-system.html` (inline SVG; solid accent = bench-tested, dashed = planned).
4. Build log: terminal-style list from `_data/tishtar_journal.yml`.

## Roadmap data

Edit `_data/tishtar_roadmap.yml`.

- **Phases** have `id`, `title` and a one-line `description`. Keep descriptions short. Icons come from `_includes/tishtar-icon.html`, chosen by phase `id`.
- **Milestones** have a stable `id`, `phase`, `title`, `description` (status note), `status` (`completed`, `in_progress`, `planned` or `blocked`) and evidence fields. On the page each milestone is one small mark under its phase (filled = done, half = in progress, empty = planned); the title appears on hover.
- **`road_current_milestone_id`** sets the current phase: the phase that contains this milestone. It must be a completed milestone.
- **`current_focus`** is the one line shown under the current phase.

Phase states are computed in Liquid: phases before the current one show "started", the current one shows "now", later ones show "planned" and are faded.

When updating a status: add evidence, record a completion date only when known, and update `reviewed_on`. Do not sync GitHub issue state automatically: #6 and #8 have wider acceptance criteria than their bench-test milestones.

## Robot animation

`assets/js/tishtar-road.js`. When the roadmap scrolls into view, the robot drives down the centre line and parks just above the current phase badge. Phases light up as it reaches them; "↺ replay" runs it again. With reduced motion the robot is placed at once. Without JavaScript the roadmap shows its final state and the robot is hidden. Below 720 px the line moves to the left and all pins sit on the right.

## Build log

Append entries in build order to `_data/tishtar_journal.yml`. The page shows `date` (only for verified dates; otherwise a placeholder), `id` and `log` (one short line). The line links to `issue_url`, or to `evidence_url` when that is a full URL. The other fields (`challenge`, `result`, `next`, …) are kept as engineering notes.

## Building and testing

The GitHub Pages workflow is unchanged. `base_path` comes from `site.url`, so a local build must override `url`, otherwise pages load CSS and JS from the live site. Example with Docker:

```sh
printf 'url: http://127.0.0.1:4175\n' > /tmp/local.yml
docker run --rm -v "$PWD":/src -v /tmp/local.yml:/local.yml -w /src ruby:3.3 \
  bash -c "bundle install && bundle exec jekyll build -d /src/_site --config _config.yml,/local.yml"
python3 -m http.server 4175 --directory _site --bind 127.0.0.1
```

Browser test (`tests/tishtar-road.cjs`), with temporary Playwright tooling that is not a site dependency:

```sh
npm install --prefix /tmp/tishtar-qa --no-audit --no-fund playwright
PLAYWRIGHT_PATH=/tmp/tishtar-qa/node_modules/playwright \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
TISHTAR_BASE_URL=http://127.0.0.1:4175 \
node tests/tishtar-road.cjs
```

It covers: 7 phase rows and one mark per milestone; the robot starts at the top and parks above the current phase on the centre line; future phases are faded; replay; reduced motion; mobile layout without page overflow; the no-JavaScript fallback; and the theme toggle (dark by default, switches, persists).

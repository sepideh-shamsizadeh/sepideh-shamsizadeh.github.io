# Maintaining the TISHTAR page

The page is served at `/tishtar/` by `_pages/tishtar.html` and `_layouts/tishtar.html`. It uses the existing site shell, navigation and SEO include. No new runtime dependencies, APIs or synchronization are required.

## Roadmap

Edit `_data/tishtar_roadmap.yml`. Each milestone has a stable `id`, `phase`, `title`, `description`, `status`, optional `date_completed`, `dependencies` (milestone IDs), `github_issue_url`, `documentation_url`, `evidence_url`, `evidence_source` and `review_required`. Use null for unknown URLs and dates. Status must be `completed`, `in_progress`, `planned` or `blocked`.

Progress is computed by Liquid as completed milestones / all milestones, rounded down to a whole percentage. Partial work earns no fractional completion. Filtering does not change progress. Add milestones without editing JavaScript. Keep IDs stable because the diagram, dependencies and direct links use them.

The initial snapshot was reviewed on 2026-11-16 against the repository tree, `docs/architecture.md`, all eight public issues and the builder's supplied bench results. The repository's media and test directories contained placeholders. No photos or test scripts were available to import. Open issue checklists and architecture prose sometimes lag the builder's results; milestone descriptions explicitly retain these differences.

Only repository setup has a verified completion date. Other bench tests are attributed to the builder, with public artifacts still outstanding. Assembly remains in progress because issue #4 requires photographs. PCA9685 setup remains in progress because issue #5 includes more than bus discovery. Independent pan/tilt and standalone keyboard tests are completed at bench scope; the wider issues and ROS 2 integration remain unfinished. No blockers were asserted without evidence.

Set `project_board_url` to the confirmed existing GitHub Project URL. Until then, the page links to the repository's Projects tab and says the direct URL is awaiting confirmation. Do not invent a project number.

When updating status, add evidence, record a completion date only when known, review dependent milestones and update `reviewed_on`. A prerequisite does not automatically make a milestone blocked. Do not sync GitHub issue state automatically: #6 and #8 have wider acceptance criteria than their standalone bench-test milestones.

## Journal

Append entries in build order to `_data/tishtar_journal.yml`. Use `date: 'YYYY-MM-DD'` only for known event dates. Undated notes explicitly say that the date remains to be recorded. Supported fields:

```yaml
- id: unique-note-id
  date: '2026-11-20' # optional; actual event date
  title: A specific engineering result
  challenge: The question the experiment addressed.
  tools: Hardware and software actually used.
  summary: What was implemented.
  result: Measured or observed result, including limitations.
  lessons: Problems encountered and what was learned. # optional
  evidence_url: https://github.com/...
  issue_url: https://github.com/... # optional
  code_url: https://github.com/... # optional
  next: The next experiment.
  media_url: /images/tishtar/example.jpg # optional, compressed local image
  media_alt: Describe what the real image shows. # required with media
```

Missing media, troubleshooting notes and code references render explicit empty states. No robot photographs are synthesized. Replace the hero concept illustration with an optimized real photograph once available; provide descriptive alt text and dimensions. Keep the figure caption factual.

## Architecture

Edit `_data/tishtar_architecture.yml` to update component roles, milestone links and logical connections. `tested` connections use solid borders and explicit builder-tested text; `planned` connections use dashed borders and explicit planned text. This is a logical system view, not a wiring diagram. Do not infer protocols, power wiring or servo models from component availability. Architecture notes distinguish camera servos from two available MG90S experimental servos; confirm models before identifying them as installed pan/tilt hardware.

## Validation

Use the existing Ruby/Bundler environment:

```sh
bundle install
bundle exec jekyll build
```

The existing GitHub Pages action remains unchanged. Check `/tishtar/` at desktop and mobile sizes, light/dark system preferences, reduced motion, keyboard-only interaction and with JavaScript disabled. Native `details` controls work without JavaScript; filters appear only when JavaScript runs. Progress is calculated at build time. Clicking architecture or dependency links reveals the referenced phase and resets a conflicting filter.

There is no automatic GitHub synchronization, token, backend or new framework. No commit or deployment is part of this change.

### First-version verification

The full site built successfully with Ruby 3.3 and the unmodified Gemfile (GitHub Pages 233 / Jekyll 3.10). On this Mac, select that runtime with `export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"` before running Bundler; system Ruby 2.6 and Ruby 4 are unsuitable for this dependency set. Validation dependencies were isolated in temporary directories; no dependency or deployment files were changed.

Chrome checks passed for all five filters, the zero-blocker empty state, seven expandable phases, keyboard activation, architecture links to filtered milestones, unchanged progress while filtering, all local fragment targets, 375/768/1440-pixel viewports, system dark mode, reduced motion and JavaScript disabled. Automated axe WCAG A/AA checks passed within the new page in light and dark modes; these do not replace a complete manual accessibility audit.

## Driving the roadmap

`_includes/tishtar-road.html`, `assets/js/tishtar-road.js` and the scoped driving styles in `assets/css/tishtar.css` add the SVG road above the existing milestone list. No dependencies or live APIs are used by the page. The miniature four-wheel robot includes a pan-tilt camera; it is labeled as a concept illustration until a verified project photo is available.

Each milestone now supports `road_position`, a normalized arc-length from 0 to 1. Keep these positions unique and in the intended travel order. An omitted position falls back to the milestone's position in the data array. `road_current_milestone_id` identifies the completed, verified checkpoint where the robot starts and where the return control sends it. Initially this is `keyboard`, a builder-confirmed standalone servo-control bench result, whose date is unknown. This setting is independent of the project's completion percentage. Do not move it to an unverified or planned milestone.

Optional `journal_id` links a milestone to the corresponding entry in `_data/tishtar_journal.yml`. The detail dialog reuses the existing milestone and journal rendering, preserving documentation, issues and evidence. Add `implementation_notes`, `test_evidence`, `media_url` and `media_alt` to a milestone to publish extra plain-text notes and an optimized photograph. Missing photos and detailed notes retain explicit empty states. Cloned journal IDs are removed so opening a panel does not duplicate page anchors.

Completed road intervals are calculated separately for each completed milestone. A later successful bench test never paints intervening unverified work as completed. The thin exploration trail and nearest-marker highlight reflect visitor movement only; the original data and actual progress remain unchanged. The amber pulsing ring identifies the fixed verified checkpoint, while status icons and text retain their original meaning.

Drag with a mouse or finger, or focus the robot and use arrows (Shift for larger steps), Home and End. Click the robot, a marker, or Explore milestone to open details. Close or Escape resumes at the same road position and restores focus. On desktop, Shift-clicking the road explicitly repositions the robot using a full-path search. Ordinary touches outside the robot scroll normally. The mobile summary stays above the map while the map scrolls.

The implementation samples the path once at five-SVG-unit intervals. Each pointer event converts screen coordinates using `getScreenCTM().inverse()`, then schedules one animation frame. Drag projection searches only ±110 SVG units (or 2.5% of total length, whichever is smaller) around the previous arc-length, refines with `getPointAtLength()`, and uses neighboring samples for tangent rotation. This local window prevents shortcuts between nearby lanes. The initial grab offset prevents a jump when the robot is grabbed off-center. Only an explicit Shift-click performs a full-path nearest-point search; markers and Return use their known normalized distances. Pointer capture, cancellation and lost-capture handling keep gestures reliable. Wheel rotation and the checkpoint pulse stop with reduced motion.

### Repeatable browser checks

The driving regression test is `tests/tishtar-road.cjs`. It requires temporary Playwright tooling and a local server serving a full Jekyll build; these are development tools, not site dependencies. For example:

```sh
npm install --prefix /tmp/tishtar-qa --no-audit --no-fund playwright
# In another terminal, serve your built output:
python3 -m http.server 4175 --directory /path/to/built-site --bind 127.0.0.1
# macOS with Chrome already installed:
PLAYWRIGHT_PATH=/tmp/tishtar-qa/node_modules/playwright \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
TISHTAR_BASE_URL=http://127.0.0.1:4175 \
node tests/tishtar-road.cjs
```

For another platform, set `CHROME_PATH` to an installed Chrome/Chromium executable, or omit it to use Playwright's separately installed Chromium. Tests cover actual mouse input and Chrome DevTools emulated touch input through the bends, path/tangent error, branch-jump protection, crossing detection, click-versus-drag, milestone details and evidence links, keyboard navigation, return, reduced motion, responsive resizing, touch scrolling and no-JavaScript fallback. A physical phone remains useful for checking device-specific feel; emulation does not verify real iOS Safari or Android hardware.

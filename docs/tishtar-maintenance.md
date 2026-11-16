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

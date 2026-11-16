# Portfolio design system

## Audit and implementation

The previous homepage used its own navy sidebar, typography and pill links, while
research, archive and project pages inherited different AcademicPages layouts.
TISHTAR added a separate palette and a detailed 40-task engineering presentation.
Header/footer structure, content widths, card treatment and mobile navigation
therefore changed between sections.

The working tree now routes the homepage, projects, posts, story, publications,
CV, teaching, talks and archives through `_layouts/default.html`. The shared
masthead and footer keep the same links and structure on every page. The original
research content and project write-ups remain available; project details use
native disclosures for progressive disclosure.

## Shared sources

- `_sass/_design-tokens.scss`: warm cream, charcoal, coral, teal, mint, yellow and
  blue; font families, spacing, widths and radii. The portfolio deliberately keeps
  its light palette across system preferences.
- `_sass/_design-system.scss`: typography, responsive containers, navigation,
  buttons, cards, disclosures, reading layouts and footer. Breakpoints at 900,
  760 and 520 pixels adapt the shared layouts. TISHTAR has an 800px breakpoint
  for its demo console.
- `_includes/page-heading.html`, `project-card.html`, `project-overview.html`:
  reusable content components, driven by `_data/projects.yml`.
- `_layouts/project.html`: shared introduction, visual, approach, outcomes,
  technology tags, links and original write-up.
- `assets/js/site.js`: accessible mobile navigation and existing gallery/video
  enhancements. The menu stays available without JavaScript.

Legacy theme Sass remains for technical content and existing plugins; the shared
system is imported last. The old `onepager.css` is no longer loaded. No new UI
framework, production dependency or deployment configuration was introduced.

## TISHTAR

The public journey uses `_data/tishtar_journey.yml` with seven stages; detailed
engineering tasks stay in the source roadmap and are linked on GitHub. Stage
statuses are derived from that roadmap, never visitor movement. The verified
checkpoint names the builder-confirmed bench result while the wider stage can
remain in progress.

`assets/js/tishtar-road.js` reads the public journey, uses SVG viewBox dimensions
for correct placement, supports arrows/WASD, dragging, touch buttons, stage
dialogs, Start driving and Return. It preserves local path projection, pointer
capture, focus restoration and reduced-motion behavior. The browser demo is
explicitly separate from the physical robot. Seven readable stages remain when
JavaScript is unavailable.

## Verification

Build with `bundle exec jekyll build` using Ruby 3.3 and GitHub Pages dependencies.
For offline verification, GitHub metadata lookup may need disabling in a
temporary build wrapper; no production source change is needed.

Serve the resulting build and run `tests/site-design.cjs` and
`tests/tishtar-road.cjs` with `PLAYWRIGHT_PATH`, `CHROME_PATH` and
`TISHTAR_BASE_URL` as described in `docs/tishtar-maintenance.md`.
The site check covers 11 routes at 320, 390, 768 and 1440 pixels, shared chrome,
active navigation, mobile menu behavior, local images and horizontal overflow.
The driving check covers mouse/emulated touch, path geometry, WASD, touch
buttons, dialogs/focus, immutable project status, resize, reduced motion and
no-JavaScript fallback. Third-party image availability is outside offline QA.

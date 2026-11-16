# sepideh-shamsizadeh.github.io

Personal website of Sepideh Shamsizadeh — Physical AI & Robotics Engineer, Zurich.
Live at **https://sepideh-shamsizadeh.github.io**.

Built with Jekyll on GitHub Pages. The theme started from Academic Pages / Minimal Mistakes (MIT, see `LICENSE`) and has been redesigned.

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
- **New Medium article:** add a file in `_posts/` like the existing ones, with `medium_url`, `redirect_to`, `image` (put the cover in `images/blog/`), `topic` and a one-sentence `excerpt`.
- **Tishtar progress:** edit `_data/tishtar_roadmap.yml` (see `docs/tishtar-maintenance.md`).

## Run locally

```sh
bundle install
bundle exec jekyll serve --config _config.yml,_config.dev.yml
# open http://localhost:4000
```

Pushing to `master` builds and deploys the site with GitHub Actions (`.github/workflows/jekyll-docker.yml`).

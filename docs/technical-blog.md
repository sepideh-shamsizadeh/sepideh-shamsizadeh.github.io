# Writing on your website

Write articles in Markdown in your local checkout, using VS Code or any Markdown editor. The browser preview shows the actual site styling, math, and interactive components. Your blog uses the same Jekyll build and GitHub Pages workflow as the rest of the site.

## Create and preview a draft

1. Copy `_drafts/example-draft.md` to `_drafts/my-article.md`. Keep `layout: technical-article` and fill in `title`, `excerpt` (the short description), `categories`, and `tags`. Set `toc: true` to generate a table of contents from second-level headings. Use `##` for sections and `###` for subsections. The header already supplies the article title.
2. Write below the second `---`. Use regular Markdown for paragraphs, headings, lists, quotations, links, and tables. For code, use fenced blocks and specify the language, such as `python`, for Rouge syntax highlighting.
3. From the repository root, run:

   ```sh
   bundle install
   bundle exec jekyll serve --drafts --host 127.0.0.1 --config _config.yml,_config.dev.yml
   ```

4. Open `http://localhost:4000/year-archive/` and select your draft. Refresh the browser after saved edits rebuild. The Markdown editor's built-in preview is useful for plain text and formatting. Use the Jekyll preview to verify custom includes, math, and theme.

Personal files in `_drafts/` and images in `images/blog/draft-assets/` are ignored by Git. The example draft is the sole exception and demonstrates the template. Keep private material on your computer. A public GitHub branch, fork, or pull request can expose any file you push, even if Jekyll skips publishing it.

## Images and equations

Copy draft images into `images/blog/draft-assets/`. Insert an image with an accessible description and a visible caption.

```liquid
{% include article/figure.html src="/images/blog/draft-assets/setup.jpg" alt="Camera mounted on a test rig" caption="The test setup." %}
```

For a cover, add these fields to the front matter.

```yaml
cover: /images/blog/draft-assets/setup.jpg
cover_alt: "Camera mounted on a test rig"
cover_caption: "The test setup."
```

For math, use `$x^2$` inline or `$$` on separate lines around a display equation. MathJax is already part of the website. For the local browser preview, it needs network access to the site's existing CDN.

## Publish and edit

1. Move the completed draft to `_posts/YYYY-MM-DD-my-article.md` using the publication date. Move its images to a public folder such as `images/blog/my-article/` and update the article's image paths.
2. Run the preview again, this time without `--drafts`. Verify the post, links, images, and cover on the blog page before pushing.
3. Commit the article Markdown and its public images with Git or GitHub Desktop, then push to `master`. If you publish through a branch, merge it into `master`. GitHub Actions runs the existing Pages deployment. Check the Actions tab for the deployment result.

To update an existing article, edit its Markdown file in `_posts/` and publish the update the same way. A published Markdown file can also be edited directly in GitHub's authenticated editor. Keep the filename and categories stable to preserve the generated URL, or use an explicit `permalink` when you first publish if categories may change. Older posts that link out to Medium continue to use their existing redirect metadata.

GitHub's browser sign-in or your normal authenticated Git setup handles repository access. There is no separate editor service or authentication integration. The Markdown files and image folders can be copied or backed up directly. Custom component blocks render on Jekyll and can be replaced with ordinary Markdown when exporting elsewhere.

## Optional interactive components

Insert an existing component by registry name anywhere between paragraphs.

```liquid
{% include article/component.html name="slider" label="Example value" value=42 %}
```

To implement a new component:

1. Add an include under `_includes/article/components/`. Put the static explanation or diagram in the include and give the component wrapper a `data-article-component` value. Use `include.options` to read shortcode parameters, escape text, and validate numeric inputs. Use labels for controls and provide readable content with JavaScript disabled.
2. Register the name and include path in `_data/article_components.yml`. Register any behavior under that same name in `assets/js/technical-article.js` and scope selectors to the passed element so several instances can coexist. Put shared article styles in `assets/css/technical-article.css`.
3. Preview it in a draft. Check keyboard controls, both themes, and a narrow viewport before adding it to an article.

Published articles refer to the component by name. Changes to its markup or behavior need only be made in the shared component.

## Link an article to a Playground experiment

After the Playground domain is approved and active, use `lab_experiment: kalman-filter` in an article’s front matter. The value must exactly match a published Playground slug. The article link only renders when the site config sets `playground_url: https://playground.sepideh.io`. Add the article’s verified production URL to the experiment’s `links.article` field in the separate Playground repository.

The `/blog/` alias points to the existing `/year-archive/` blog. Article paths and Markdown authoring remain the same.

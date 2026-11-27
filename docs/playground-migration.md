# Playground separation

Playground is the presentation layer at the planned `https://playground.sepideh.io/`. The lab repository keeps reproducible implementations and GitHub Project 13 tracks engineering progress. TISHTAR and DRILL remain on their existing paths and deployments.

## Baseline

The professional site uses Jekyll layouts, local theme assets, and an Actions-built Vercel static deployment. Its current “Playground” dropdown links only to `/drill/`; the production `/playground/` URL returned 404. There is no tracked standalone Playground page, experiment directory, or storage to copy. DRILL stores browser state and uses an owner-only coach API. The independent Playground should link to DRILL without rehosting its pages, storage, Coach or transfer workflow. The published blog is `/year-archive/`; the optional `/blog/` alias retains that destination.

## Cutover checklist

1. Publish the independent repository and verify a Vercel Hobby preview. Confirm domain assignment, DNS, HTTPS and production routes only after approval.
2. After approval, set `playground_url: https://playground.sepideh.io` and update the professional-site navigation. Keep access to `/drill/`, `/tishtar/`, all articles, and the GitHub Pages progress export. Link the new platform back to the professional site and blog.
3. If evidence reveals a deployed legacy Playground landing path, add a path-specific migration link or redirect. Leave unrelated routes and existing browser origins untouched.
4. Roll back by reverting the navigation change and restoring the previous Playground deployment. If the subdomain itself needs reversal, remove only its assignment after approval.

The review branch prepares an optional article link and blog alias. It leaves production navigation and DNS untouched.

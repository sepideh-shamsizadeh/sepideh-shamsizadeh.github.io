# Playground and the professional site

[Playground](https://playground.sepideh.io/) is a separate site on Vercel Hobby. Its [repository](https://github.com/sepideh-shamsizadeh/sepideh-playground) holds the catalog and Markdown articles. The [lab repository](https://github.com/sepideh-shamsizadeh/applied-ai-robotics-lab) holds implementations, and [GitHub Project 13](https://github.com/users/sepideh-shamsizadeh/projects/13) tracks engineering progress.

The main navigation links directly to Playground and DRILL. DRILL and TISHTAR keep their existing paths. The blog remains at `/year-archive/`, with `/blog/` as an alias.

When a technical article accompanies an experiment, add `lab_experiment: <slug>` to its Jekyll front matter. Set the matching Playground entry's `links.article` to the published article URL. Verify the two links after both deployments.

To roll back the integration, revert the professional-site navigation and rebuild through the existing GitHub Actions workflow. Roll back Playground separately using its Vercel deployment history.

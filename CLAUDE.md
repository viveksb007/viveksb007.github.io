# CLAUDE.md

## Project Overview

Hugo static site (PaperMod theme) for viveksb007.github.io — personal blog and notes by Vivek Singh Bhadauria.

## Build & Run

```bash
hugo server -D        # Local dev server (includes drafts)
hugo                   # Build to /public
```

Site is deployed via GitHub Pages (GitHub Actions workflow in `.github/workflows/`).

## Content Structure

```
content/
├── _index.md          # Homepage
├── about.md
├── learning.md
├── archives.md
├── search.md
├── posts/             # Long-form blog posts
└── notes/             # Short, unstructured explorations
```

## File Naming

All content files: `YYYY-MM-DD-slug-text-here.md`

Hugo extracts the date from the filename prefix (configured in `hugo.yaml` under `frontmatter.date`).

## Permalinks

- Posts: `/:year/:month/:slug/`
- Notes: `/notes/:year/:month/:slug/`

## Front Matter Conventions

### Notes (simpler)

```yaml
---
title: "Note Title Here"
date: YYYY-MM-DD
draft: false
---
```

### Posts (richer)

```yaml
---
author: ["Author <model> | Prompter Vivek Bhadauria"]
title: "Post Title Here"
date: YYYY-MM-DD
tags: [tag1, tag2]
ShowToc: true
cover:
  image: /img/image-name.png
  alt: "Alt text"
---
```

- `author` field uses format `"Author <LLM model> | Prompter Vivek Bhadauria"` when AI-assisted.
- `ShowToc: true` enables table of contents (used in long posts).
- `cover` is optional; images go in `/static/img/`.

## Available Shortcodes

- `{{</* mermaid */>}}` — Mermaid diagrams (sequence, flowchart, etc.)
- `{{</* figure src="..." caption="..." */>}}` — Images with captions
- `{{</* tweet user="..." id="..." */>}}` — Twitter embeds
- `{{</* zoomable-image src="..." */>}}` — Zoomable images

## Content Style

- Notes are concise, technical, and informal. They use ASCII diagrams, code blocks, and bullet points. No cover images or ToC needed.
- Posts are longer, more polished, and typically include a ToC, tags, and optionally a cover image.
- Markdown rendering has `unsafe: true` enabled (raw HTML allowed).
- Comments are enabled site-wide via Utterances.

## Config

Main config: `hugo.yaml` (not `config.toml`). Key settings:

- Theme: PaperMod
- Analytics: Google Analytics (G-MDHYNBH6MS)
- Search: Fuse.js-based (requires JSON output)
- Default theme: auto (light/dark)

## Static Assets

Images and other static files go in `/static/`. Referenced as `/img/filename.png` in content.

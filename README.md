# Hoppen

![hippo](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMTNha3N2Mmp3NWFyMnByeDVqbm9nZjBqbmhyMWNrN3Zhc21nNG5tZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/9gAqBnmx88xk9kcjed/giphy.gif)

## What is Hoppen?

Hoppen lets you prototype creative effects locally, like CodePen.
You can choose the template with the technology and libraries of your choice.

## Features

- Pick one of your favorite libraries (GSAP, Shaders skeleton, THREE.js, or all combined!)
- GSAP plugins selection
- Hot module replacement (HMR)
- One-click "Open in CodePen" via Prefill API (floating button on each generated project)

### Requirements

- Node.js 20+

### Install

```bash
pnpm install
```

### Usage

- Create a project:

```bash
pnpm create
```

You’ll be prompted for:

1. Project name (created under `projects/<name>`)
2. Options: GSAP, Shaders skeleton, THREE.js (can combine)
3. If GSAP, select optional plugins: ScrollTrigger, ScrollSmoother, Draggable, SplitText

When done, a dev server starts and opens your browser. Edit files to see instant updates.

- Open current project in CodePen: click the floating ⧉ button at the bottom-right of the preview. It posts HTML/CSS/JS to CodePen using the Prefill API and opens a new Pen.

### Project structure

- `projects/<your-project>/` – your working files
- `reset.css` – Josh Comeau’s CSS reset (kept at repo root and referenced as `../../reset.css` in projects)

### Extending

- Add GSAP plugins: extend the `GSAP_PLUGINS` array in `cli.js` with `{ name, id, src }`. They’ll show up in the multiselect.

### Notes

- Scripts use `type="module"` where relevant.
- GSAP is loaded via CDN for simplicity; you can swap to ESM/CDN imports or local builds if needed.

### Reference

- Uses the [CodePen Prefill API](https://blog.codepen.io/documentation/prefill/)

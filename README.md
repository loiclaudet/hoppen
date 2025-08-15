# ⧉ Hoppen

Start your creative project with your favorite libraries, in seconds.

Export instantly to CodePen.

![hippo](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMTNha3N2Mmp3NWFyMnByeDVqbm9nZjBqbmhyMWNrN3Zhc21nNG5tZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/9gAqBnmx88xk9kcjed/giphy.gif)

## Why Hoppen?

Codepen is great for prototyping, but iterating on a project with AI is a pain.

Hoppen allows you to iterate on a project from your IDE that includes your favorite AI tools.

shaders creation are done directly in .glsl files, and the changes are instantly reflected in the preview.

## Features

- Scaffold a project with your favorite libraries and frameworks (GSAP, THREE.js, r3f, shaders, Lenis)
- One-click export to CodePen
- Hot module replacement (HMR)

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
- `reset.css` – [Josh Comeau’s CSS reset](https://www.joshwcomeau.com/css/custom-css-reset/)

### Reference

- Uses the [CodePen Prefill API](https://blog.codepen.io/documentation/prefill/)

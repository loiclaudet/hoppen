# ⧉ Hoppen

Start creative projects with your favorite libraries in seconds.

Iterate fast with AI in your IDE. Share instantly on CodePen.

![hippo](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3Y3ZTY1YmptbnAyajdjMXo5cGVnbTg0Y2trbnpzazhoOHZ3OTJ2eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4ii7IOWA9OcjH3XMtd/giphy.gif)

## Why Hoppen?

Iterating on a Pen with AI is frustrating: copy-pasting code, switching windows, and losing focus.

Hoppen keeps you in your IDE. Work seamlessly with AI, then export to CodePen in one click.

Share versions, test ideas, or showcase progress anytime.

Check out a [live demo](https://codepen.io/loiclaudet/pen/empyogQ) of an exported Pen.

## Usage

### Create a new project

```terminal
npx hoppen
```

### Start an existing project

From the root of your project, run:

```terminal
npx hoppen start [project-name]
```

## Features

- ⚡ **Instant project scaffolding** with your favorite libraries and frameworks (GSAP, Three.js, R3F, shaders, Lenis, etc.)
- 🔄 **One‑click export to CodePen** for seamless sharing and testing
- 🚀 **Hot Module Replacement (HMR)** for fast iteration
- 🎨 **Shader editing from `.glsl` files** with full IDE support (auto-completion, syntax highlighting, etc.)

### Internal Files

Hoppen creates an internal `@@internal` folder with opinionated files like the CodePen Prefill helper, `reset.css`, and HMR scripts (for shaders).

These files can be overridden if needed, but typically don’t require changes.

### Requirements

- Node.js 18 or later

### Contributing

If your favorite library isn’t supported yet, feel free to open an issue or submit a pull request. Contributions are welcome!

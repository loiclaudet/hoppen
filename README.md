# ⧉ Hoppen

Start your creative project with your favorite libraries, in seconds.

Export instantly to CodePen.

![hippo](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3Y3ZTY1YmptbnAyajdjMXo5cGVnbTg0Y2trbnpzazhoOHZ3OTJ2eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4ii7IOWA9OcjH3XMtd/giphy.gif)

## Usage

### Create a project

```terminal
npx hoppen
```

### Start an existing project

from the root of your project, run:

```terminal
npx hoppen start [project-name]
```

## Why Hoppen?

Iterating on a Pen with AI is painful.
It requires copy-pasting the code into an LLM chat, and go back and forth between the chat and the editor.

Hoppen allows you to iterate on a project while benefiting from the power of your favorite IDE and AI tools.

Export a project to CodePen whenever is needed, as many times as you want.

That's useful for educational purposes, for example to show a project at different stages of development. That's an handy way to version your project.

## Features

- Scaffold a project with your favorite libraries and frameworks (GSAP, THREE.js, r3f, shaders, Lenis, etc.)
- One-click export to CodePen
- Hot module replacement (HMR)
- Shaders are editable from the `.glsl` files, thus you benefit from the IDE features (auto-completion, syntax highlighting, etc.)

### Internal files

Hoppen creates a internal folder `@@internal` that contains the CodePen Prefill helper, the reset.css file, and scripts for HMR when shaders are enabled.

### Requirements

- Node.js 18+

### Contributing

if your favorite library is not supported, open an issue or a pull request.

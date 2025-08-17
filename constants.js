export const WORKSPACE_DIR = process.cwd()

export const CDNS = {
  GSAP: 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/gsap.min.js',
  LENIS: 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@latest/dist/lenis.min.js',
}

export const GSAP_PLUGINS = [
  {
    name: 'ScrollTrigger',
    id: 'ScrollTrigger',
    src: 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/ScrollTrigger.min.js',
  },
  {
    name: 'ScrollSmoother',
    id: 'ScrollSmoother',
    src: 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/ScrollSmoother.min.js',
  },
  {
    name: 'Draggable',
    id: 'Draggable',
    src: 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/Draggable.min.js',
  },
  {
    name: 'SplitText',
    id: 'SplitText',
    src: 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/SplitText.min.js',
  },
]

export const PRETTIER_OPTS = {
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  tabWidth: 2,
  printWidth: 100,
  bracketSpacing: true,
  arrowParens: 'always',
  htmlWhitespaceSensitivity: 'css',
  endOfLine: 'lf',
}

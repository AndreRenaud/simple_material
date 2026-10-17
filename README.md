# Simple Material

Classless Material Design styles for semantic HTML, in a single CSS file.

See every component on the [showcase page](https://andrerenaud.github.io/simple_material/showcase.html).

<img src="docs/showcase.gif" alt="A tour of the showcase: colour themes, the navigation drawer, buttons, the dark theme, switches, chips, tabs, expansion panels, a dialog, the FAB menu and a snackbar" width="800">

## Goals

- Pure HTML and CSS, framework agnostic, no JavaScript
- Semantic elements instead of classes wherever possible
- Accessible, with keyboard focus and screen readers in mind
- Discreet animations, driven purely by CSS
- Small files, targeting the latest browsers and their newest features

## Installation

Copy `simple_material.css` into your project and link it from your HTML:

```sh
curl -O https://raw.githubusercontent.com/AndreRenaud/simple_material/main/simple_material.css
```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="simple_material.css" />
  </head>
  <body>
    <button>Hello</button>
  </body>
</html>
```

The whole point of this library is to avoid heavyweight external dependencies,
so copying the file is almost always the right answer. There is no package to
install, no build step and nothing to keep in sync with a CDN.

## Usage

```html
<button>Filled</button>
<button data-variant="outlined">Outlined</button>

<article>
  <h3>Title</h3>
  <p>Supporting text.</p>
  <footer><button>Action</button></footer>
</article>
```

Elements are styled as they are. Where Material has several styles for one
element, pick one with `data-variant`, and arrange children with
`data-layout`.

## Colour themes

Every colour role is derived from a hue, so each theme works in light and dark
mode. Violet is the default; pick another with `data-theme` on the `html`
element:

```html
<html lang="en" data-theme="teal">
  <head>
    <link rel="stylesheet" href="simple_material.css" />
  </head>
</html>
```

| Theme             | Primary and accent                                  |
| ----------------- | --------------------------------------------------- |
| `rose`            | rose, blue-violet                                   |
| `orange`          | orange, deep blue                                   |
| `olive`           | moss green, copper; warm                            |
| `teal`            | Persian green, burnt sienna                         |
| `navy`            | blue, gold; navy surfaces                           |
| `win98`           | navy, teal; silver surfaces (Windows 98 Standard)   |
| `win98-rainy-day` | slate, sky blue; blue-grey (Windows 98 Rainy Day)   |
| `win98-eggplant`  | green, purple; sage surfaces (Windows 98 Eggplant)  |
| `win98-spruce`    | green, pale blue; mint surfaces (Windows 98 Spruce) |
| `win98-brick`     | maroon, copper; khaki surfaces (Windows 98 Brick)   |
| `macos9`          | lavender, yellow; platinum (Mac OS 9)               |
| `macos9-silver`   | grey, yellow; platinum (Mac OS 9, Silver variation) |

The `win98` and `macos9` themes take their colours, but not their bevels, from
those classic desktops. Neither system had a dark mode, so theirs is new.

To make your own, set the same four values on `:root`:

```css
:root {
  --hue: 150; /* primary hue, in degrees */
  --tertiary-hue: 30; /* accent hue, used by mark */
  --chroma: 0.8; /* how colourful the accents are */
  --tint: 1.5; /* how strongly the hue tints surfaces */
}
```

A `select` named `theme` whose option values are the theme names switches
between them without JavaScript, as the one in the showcase's navigation does.

## Development

- `make format` formats the HTML, CSS and scripts with Prettier.
- `make shoot` screenshots the showcase in headless Chromium, Firefox and
  WebKit using Podman. Output goes to `screenshots/`.
- `make gif` records an 800×600 tour of the showcase to `docs/showcase.gif`.

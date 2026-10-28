# Portal Carousel

A vertical image carousel seen through a liquid-glass portal. Cards scroll top to bottom; as a card crosses the portal's rim it bends, smears and splits colour, then settles flat and clear in the middle. Built with **three.js** and **GSAP** on **Vite**, no framework.

The lens is a faithful port of the one in [`liquid-glass-carousel`](../liquid-glass-carousel) (a horizontal Next.js carousel), re-mapped for a vertical stack and extended so each image bends as one continuous piece.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`). `npm run build` produces a static `dist/` that works at any URL path (`base: "./"` in `vite.config.js`).

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes the site on every push to `main`. One-time setup on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site then lives at `https://<user>.github.io/<repo>/`.

Any static host works too (Netlify, Vercel, Cloudflare Pages): build command `npm run build`, output folder `dist`.

## Controls

| Input | Does |
| --- | --- |
| Mouse wheel / trackpad | Glides the stack; a small push pages to the next card |
| Drag (mouse or touch) | Pulls the stack, with flick momentum |
| Click top / bottom quarter | Previous / next card |
| `↑` `↓` (or `←` `→`) | Previous / next card |
| `G` | Show / hide the parameters panel (hidden by default) |
| `R` | Replay the load-in animation |

### URL options (for testing)

| Param | Effect |
| --- | --- |
| `?entry=0` | Skip the load-in animation |
| `?pos=0.5` | Freeze the stack halfway between two cards (any number works) |

## Project structure

```
index.html          page shell: canvas stage, hint, parameters panel (G)
vite.config.js      relative base so the build runs under any path
.github/workflows/  GitHub Pages deploy
src/
  main.js           DEFAULTS (every tunable), renderer, layout, motion, entry, input
  shader.js         card shader (cover-crop, bend, parallax) + portal lens shader
  cards.js          image list and texture loading
  panel.js          the side panel: one slider per setting, grouped
  style.css         page + panel styles
public/img/         card images
```

## How it works

1. **Flat pass.** Every card is a plane in an orthographic scene (1 unit = 1 px), drawn into an off-screen framebuffer with a transparent background. Images are cover-cropped to the card shape, so nothing stretches.
2. **Portal pass.** A full-screen shader draws that framebuffer through the glass portal:
   - The lens math runs in the *original carousel's* coordinate frame (`s2o` / `o2s` in `shader.js`): along the scroll axis it's normalised to the screen, across it's normalised to the card. That way the rim lands on the neighbours exactly as it does in the original, just turned vertical.
   - Near the rim, images are dragged along it (a fluid wave) and split into colour with a 16-sample dispersion.
   - The warp **builds up** inside the glass and **relaxes back to zero right at the rim**, so the warped part inside meets the intact part outside seamlessly: one bent image, never a ghost copy.
   - The blue ring, white glow and border line are only drawn over images, so the plain page stays clean.
   - An optional soft mask (from a tiny low-res copy of the card shapes) fades the warp out far from any card.
3. **Motion.** A float index springs toward the target card (critically damped, so it eases out, builds and lands softly). Scroll speed drives a 0–1 "energy" that compresses cards slightly, bows them, and makes the glass swirl and fringe more while moving.
4. **Entry.** On load, cards rise from below at a tiny size, then grow to full size while the portal fades in (GSAP timeline animating plain numbers that the frame loop reads).

## Tuning

Every value lives in `DEFAULTS` at the top of `src/main.js`, with a comment. The panel edits them live and remembers your changes in this browser; **Copy** grabs them as JSON so you can paste them back into `DEFAULTS`. Double-click a slider to reset it; **↺** resets everything.

The settings you'll reach for most:

| Group | Setting | What it does |
| --- | --- | --- |
| Layout | `cardSize`, `cardAspect` | Centre card size and shape |
| Layout | `stack`, `gap`, `peek` | Edge-to-edge stack vs. spaced cards with neighbours peeking in |
| Portal shape | `sizeX`, `sizeY`, `rotation` | Size and tilt of the glass ellipse |
| Portal shape | `oAspect`, `cardCross` | Where the rim lands along / across the stack |
| Refraction | `rimTangential` | How hard images are dragged along the rim (the bulge) |
| Refraction | `rimStart`, `rimEase`, `rimRelease` | Where the bend starts, how gently, and where it relaxes before the rim |
| Refraction | `dispersion` | Colour fringing |
| Refraction | `outside`, `stick` | Show cards outside the glass; fade the warp away from cards |
| Glow | `blueRing`, `rimLine`, `blueColor` | The shimmering ring and border line |
| Feel | `springStiffness`, `springDamping` | Speed and landing of each page |
| Feel | `bend`, `parallax`, `warpBoost`, `dispBoost` | Motion extras: bow, inner parallax, glass at speed |
| Entry animation | `riseDuration`, `growDuration`, `lensBloom` | Load-in timing |

## Using your own images

Put files in `public/img/` and edit the `IMAGES` list in `src/cards.js`. Any aspect ratio works; cards cover-crop to `cardAspect`.

## Credits and licence

- The portal lens is adapted from [liquid-glass-carousel](https://github.com/Yousuf-developer/liquid-glass-carousel) (MIT).
- **The demo photos in `public/img/` come from that repo and are not licensed for publishing.** They belong to their original creators (see that repo's `CREDITS.md`). Replace them before putting this online.

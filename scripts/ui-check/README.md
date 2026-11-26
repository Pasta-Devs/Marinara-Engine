# UI check

One command that opens the app's main screens at desktop, tablet and phone sizes, in the starter themes, in real
Vivaldi and in real WebKit (Safari's engine), and fails when a layout is broken. By default it checks only what
your change could affect (see [How it picks](#how-it-picks-what-to-check)); `pnpm ui:check:full` checks everything.

| Check         | What it catches                                                                        | Bug it would have caught                                             |
| ------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `clipped`     | A box with overflow hidden cuts off buttons or text below it, with nothing to scroll   | Connections pages cut off (Nov 18), Library pages (Nov 14)           |
| `unreachable` | A button, field or heading sits outside the window and nothing scrolls to it           | Pages ending under the window edge                                   |
| `sideways`    | The page itself scrolls sideways                                                       | Long names stretching List view (Nov 18)                             |
| `offscreen`   | An open window, menu or popup pokes out of the window                                  | Clipped popups                                                       |
| `picture`     | A picture far bigger than its box                                                      | Giant cropped avatars in Recent chats and List view (Nov 18)         |
| `stretched`   | A row or button that is mostly empty space (3x taller than its content, 120px+)        | Home's giant Discord / Support rows (Nov 19)                         |
| `covered`     | A button you can see part of, with something lying over its middle                     | Buttons hidden under a bar or panel                                  |
| `greeting`    | Home's buttons sit beside the greeting, out over the hero's art, instead of under it   | MARI to the Moon's buttons over the rocket (Nov 19)                  |
| `off-center`  | An icon tile's icon is off the tile's middle                                           | Things to try icons riding high with large text (Nov 19)             |
| `sticky-gap`  | A sticky header stops short of its scroller's top, so scrolled content shows above it  | Strip of settings above a phone's Chat settings page header (Nov 19) |
| `heading`     | A Library table's column heading is off the middle of its column                       | Connections' MODELS heading at the column's left (Nov 19)            |
| `unstable`    | (Vivaldi, Home) a widget that keeps changing height                                    | Home widgets shaking in Vivaldi (Nov 17)                             |
| `crash`       | The app shows its "recoverable UI error" screen (a render crash), on any screen or tab | Clicking a background in Library › Assets crashed the app (Nov 22)   |

## Run it

```bash
pnpm ui:check            # only what your change could affect (prints what it chose and why)
pnpm ui:check:quick      # the same choice, Chromium only: no themes, no Vivaldi/WebKit
pnpm ui:check:full       # everything (every screen, size and starter theme, Vivaldi, WebKit) + a fresh screen map
pnpm ui:check -- --base origin/main                      # compare with another branch
pnpm ui:check -- --screens home,connections --sizes desktop-short,phone   # pick by hand
pnpm ui:check -- --url http://127.0.0.1:7860   # an Engine you already run (adds no test data unless --seed)
```

### How it picks what to check

`pnpm ui:check` diffs the working tree (commits, staged, unstaged and new files) against the branch it grew from
(the nearest branch other than its own; `--base` or `UI_CHECK_BASE` to choose) and checks:

| What changed                                   | What it checks                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A component, hook, store or helper             | The screens that ran that file's code, at the sizes where it ran (from the screen map)                                                                                                |
| A file no screen runs itself (constants, …)    | The screens of the files that import it                                                                                                                                               |
| A CSS rule (also in the big shared sheets)     | Only the changed rules: the screens whose page has every class/tag/attribute the selector names, at the sizes its `@media` allows (`overhaul-mobile.css`: phones and upright tablets) |
| `@font-face`, `@property`, `@theme`, `@import` | Every screen at that sheet's sizes                                                                                                                                                    |
| `en.json`                                      | The screens of the code that uses the changed keys (other languages: nothing, the check runs in English)                                                                              |
| A shared-package export                        | The screens of the client code that uses it                                                                                                                                           |
| Server code                                    | A smoke pass: the core screens on a computer and a phone                                                                                                                              |
| Docs, tests, other scripts                     | Nothing                                                                                                                                                                               |

Starter themes run on the affected core screens only, and only the themes whose CSS styles something the change
touched (every theme when the theme engine, `theme-tokens.css`, `overhaul-always.css` or `accessibility.css`
changed). Vivaldi runs on the affected core screens at computer sizes. WebKit runs whenever a phone or tablet size
is checked, always with **Show tap timings** on and the readings in the report, even when no core screen is in the
run. A screen the map doesn't know yet (a new one) is always checked.

It checks **everything** (like `--full`) when it can't be sure: the check's own scripts, `scripts/dev.mjs`,
`package.json` / the lockfile / patches, the client's `index.html`, Vite or TypeScript config, `main.tsx`,
`globals.css`, `lib/ui-check-hook.ts`, a stylesheet it can't parse, no branch to compare with, or no screen map.

### The screen map

`scripts/ui-check/screen-map.json` records, for every screen at every size, which client source files ran (V8
coverage through the dev server) and every tag, class, id and attribute on the page and its tabs. Every
`pnpm ui:check:full` (or `--update-map`, which only does the Chromium pass) rewrites it; commit it with the change.
It is a cache: a stale map can only pick screens by the code they used to run, and a change that makes a screen use
new code changes that screen's own files too, so the screen is checked anyway. If two branches both changed it,
take either side and run `pnpm ui:check -- --update-map` after the merge.

Without `--url` it starts its own test server with fresh data in `.tmp/ui-check/data` and fills it with long-named
characters, a lorebook with 24 entries, chats with long messages and so on (`screens.mjs`). The report is
`.tmp/ui-check/report.html`: every problem with the element, the numbers, and a screenshot with the spot marked.
`findings.json` has the same as data. Exit code 1 when anything is found.

Options: `--sizes` (desktop, desktop-short, tablet-landscape, tablet-portrait, phone), `--screens` (ids in
`screens.mjs`), `--themes all|none|dewglass,quiet-iris`, `--theme-sizes desktop,phone`, `--jobs 3`,
`--no-vivaldi`, `--no-webkit`, `--quick`, `--full`, `--base <branch>`, `--update-map`, `--out dir`.

- **Phones and tablets** run with Settings > Advanced > Troubleshooting > **Show tap timings** on. The WebKit pass
  makes real taps (Library, Characters, Home) and puts the readings at the top of the report.
- **Vivaldi**: `scripts/perf/setup-vivaldi.sh` downloads the newest stable Vivaldi for Linux into
  `~/.cache/marinara-qc/vivaldi` (needs `repo.vivaldi.com` reachable). It runs windowed (under `xvfb-run` when there
  is no screen) at real 110% and 100% page zoom. On a Mac or Windows set `VIVALDI_PATH` to your own Vivaldi.
- **WebKit**: `scripts/perf/setup-webkit.sh` (Linux) installs WebKitGTK's driver; see `scripts/perf/README.md`.

## When it finds something

Fix the layout. If the finding is intended (a card picture that is tall on purpose), mark the element with
`data-ui-check-allow="stretched"` (space-separated check names), or add a selector to `allow.json` with a reason.
`data-ui-check="ignore"` skips an element and everything in it from every check.

## Adding a page

Add it to `screenList` in `screens.mjs`. Screens open through the app's own store actions
(`packages/client/src/lib/ui-check-hook.ts`, only on when the browser has `localStorage["marinara:ui-check"] = "1"`),
so one entry works on every layout. `group: "core"` also runs it in every theme, in Vivaldi and in WebKit. After a
screen opens, the check clicks through every tab of the page (an editor's tabs) and checks each.

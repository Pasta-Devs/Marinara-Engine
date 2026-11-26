# UI check

One command that opens the app's main screens at desktop, tablet and phone sizes, in every starter theme, in real
Vivaldi and in real WebKit (Safari's engine), and fails when a layout is broken:

| Check             | What it catches                                                                        | Bug it would have caught                                             |
| ----------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `clipped`         | A box with overflow hidden cuts off buttons or text below it, with nothing to scroll   | Connections pages cut off (Nov 18), Library pages (Nov 14)           |
| `unreachable`     | A button, field or heading sits outside the window and nothing scrolls to it           | Pages ending under the window edge                                   |
| `sideways`        | The page itself scrolls sideways                                                       | Long names stretching List view (Nov 18)                             |
| `column-sideways` | A list column that scrolls up and down also scrolls sideways (rows wider than it)      | Preset Prompt order token counts off the column's edge (Nov 26)      |
| `offscreen`       | An open window, menu or popup pokes out of the window                                  | Clipped popups                                                       |
| `picture`         | A picture far bigger than its box                                                      | Giant cropped avatars in Recent chats and List view (Nov 18)         |
| `stretched`       | A row or button that is mostly empty space (3x taller than its content, 120px+)        | Home's giant Discord / Support rows (Nov 19)                         |
| `covered`         | A button you can see part of, with something lying over its middle                     | Buttons hidden under a bar or panel                                  |
| `greeting`        | Home's buttons sit beside the greeting, out over the hero's art, instead of under it   | MARI to the Moon's buttons over the rocket (Nov 19)                  |
| `off-center`      | An icon tile's icon is off the tile's middle                                           | Things to try icons riding high with large text (Nov 19)             |
| `sticky-gap`      | A sticky header stops short of its scroller's top, so scrolled content shows above it  | Strip of settings above a phone's Chat settings page header (Nov 19) |
| `heading`         | A Library table's column heading is off the middle of its column                       | Connections' MODELS heading at the column's left (Nov 19)            |
| `unstable`        | (Vivaldi, Home) a widget that keeps changing height                                    | Home widgets shaking in Vivaldi (Nov 17)                             |
| `crash`           | The app shows its "recoverable UI error" screen (a render crash), on any screen or tab | Clicking a background in Library › Assets crashed the app (Nov 22)   |

## Run it

```bash
pnpm ui:check            # everything: about 25-40 minutes
pnpm ui:check:quick      # Chromium only, no themes, no Vivaldi/WebKit: about 10 minutes
pnpm ui:check -- --screens home,connections --sizes desktop-short,phone
pnpm ui:check -- --url http://127.0.0.1:7860   # an Engine you already run (adds no test data unless --seed)
```

Without `--url` it starts its own test server with fresh data in `.tmp/ui-check/data` and fills it with long-named
characters, a lorebook with 24 entries, chats with long messages and so on (`screens.mjs`). The report is
`.tmp/ui-check/report.html`: every problem with the element, the numbers, and a screenshot with the spot marked.
`findings.json` has the same as data. Exit code 1 when anything is found.

Options: `--sizes` (desktop, desktop-short, tablet-landscape, tablet-portrait, phone), `--screens` (ids in
`screens.mjs`), `--themes all|none|dewglass,quiet-iris`, `--theme-sizes desktop,phone`, `--jobs 3`,
`--no-vivaldi`, `--no-webkit`, `--quick`, `--out dir`.

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

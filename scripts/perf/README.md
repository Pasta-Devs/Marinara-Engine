# Performance and phone/tablet QC scripts

## Phone and tablet checks: use real WebKit

iPhone and iPad run Safari's engine (WebKit). Chrome, even with CPU throttling, does not show the same slow spots,
so check phone and tablet speed and layout in WebKit. On a Linux machine (Ubuntu/Debian, including a fresh
cloud container), one command sets everything up and checks it works:

```sh
scripts/perf/setup-webkit.sh http://localhost:7860
```

It installs WebKitGTK's WebDriver and a virtual display the first time (about 20 seconds), starts them, then opens
the running app as an iPhone (375x812) and an iPad mini (744x1133) with **Show tap timings** on, taps Library and
Home, saves screenshots to `/tmp/webkit-qc/smoke/` and prints the tap timings readings. Running it again only checks
that everything is still up. `--restart` fixes a stuck driver ("Maximum number of active sessions"), `--stop` stops
it all.

Then drive your own checks:

```sh
node scripts/perf/webkit-qc.mjs taps --device tablet --tap '[aria-label="Library"]' --shot /tmp/webkit-qc/library.png
```

`--tap` takes a CSS selector or `text=Label` (the first visible button, link or tab containing that text), and can
repeat. For longer flows, import it:

```js
import { openDevice } from "./scripts/perf/webkit-qc.mjs";
const page = await openDevice("phone", { appUrl: "http://localhost:7860" });
await page.tap('[aria-label="Library"]');
console.log(await page.tapTimings()); // [{ label, shown, smooth, longest, server }, ...] in tap order
await page.screenshot("/tmp/webkit-qc/phone-library.png");
await page.close();
```

Put the tap timings readings in every phone or tablet QC report.

How it works and its limits:

- The page is reached through a small local proxy (port 7899) that adds a same-origin script telling the app it is on
  an iPhone or iPad: touch media queries in JavaScript, `maxTouchPoints`, the iOS user agent and screen size. The app
  then picks its real phone or tablet layout.
- CSS `hover`/`pointer` media queries can't be faked, so CSS-only touch rules act like a mouse device. Rules keyed on
  `html[data-marinara-touch-device]` do apply.
- Painting goes through software GL, so `smooth` and long frames read higher than on a real iPad. Compare runs before
  and after a change rather than reading absolute numbers.
- Clicks are real WebDriver clicks; a script `element.click()` does not count as a tap and can't switch some tabs.
- Settings are saved on the server, so point it at a test data folder (`DATA_DIR=...`). By default it skips the
  first-run tour, which the server remembers.

## Other scripts

- `idle-animation-guard.mjs`: fails when an endless animation keeps running on something nobody can see (phone
  battery). `node scripts/perf/idle-animation-guard.mjs [baseUrl]`.

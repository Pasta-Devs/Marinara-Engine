# Performance and phone/tablet QC scripts

## Phone and tablet checks: use real WebKit

iPhone and iPad run Safari's engine (WebKit). Chrome, even with CPU throttling, does not show the same slow spots,
so check phone and tablet speed and layout in WebKit. On a Linux machine (Ubuntu/Debian, including a fresh
cloud container), one command sets everything up and checks it works:

```sh
scripts/perf/setup-webkit.sh http://localhost:7860
```

It installs WebKitGTK's WebDriver and a virtual display the first time (about 20 seconds), starts them, then opens
the running app as an iPhone (375x812) and an iPad mini (744x1133) with **Show tap timings** on, taps Library (Chats
in the classic layout) and Home, saves screenshots to `/tmp/webkit-qc/smoke/` and prints the tap timings readings. Running it again only checks
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
- Settings are saved on the server, so point it at a test data folder (`DATA_DIR=...`). By default it closes the
  first-run tour and "What's New?", which the server remembers.
- It needs Ubuntu or Debian (it installs with `apt-get`, using `sudo` when not root). On a Mac, Safari's own
  Responsive Design Mode and Web Inspector do the same job.

## Android: Termux install and Android Chrome

Android users run the server in Termux (by hand or through the Android APK, which hands off to Termux) and open it
in Chrome or the APK's WebView (the same Chromium engine). Two checks cover that, plus a GitHub workflow for machines
that can't run them.

### Termux install and launch: `setup-termux.sh`

```sh
scripts/perf/setup-termux.sh                 # arm64 Termux, like phones; server on http://localhost:7861
scripts/perf/setup-termux.sh --from latest   # update the latest release to this checkout instead
```

It runs Termux's official Docker image (`termux/termux-docker`): Termux's own packages, Node.js, Android libc and
paths. Like the Termux app, it preloads `termux-exec`, so programs that start with `#!/bin/sh` or `#!/usr/bin/env` run
as they do on a phone (the image leaves it out). It installs `git` and `nodejs-lts` the way the install guide does,
copies this checkout (tracked and new files) into `~/Marinara-Engine`, runs the real `start-termux.sh --skip-update`
and waits until the server answers. On failure it prints the end of the launcher log (full log in `/tmp/termux-qc/`).
Use it for anything that touches dependencies, native modules, the build, `start-termux.sh` or start-up.

`--from latest` checks an update instead, which is where most Termux reports come from. It installs the newest release
(or a tag, `--from v2.5.1`) the way users do, as a clone of `main` served by a stand-in for GitHub inside Termux, starts
it and creates a character. Then it publishes this checkout as the next commit on that `main` and starts the release's
own `start-termux.sh` again, which updates to it the way it does for users: it fetches, protects the data, checks the
storage format, installs dependencies and rebuilds. It passes when the server comes back running this checkout's build
and the character is still there. The release itself installs with a 2 GiB Node heap, the workaround from #8902,
because a release can need more than the launcher's default to build; the update runs with the launcher's own settings.
Use it for anything that touches the launcher, dependencies, the build or the storage format. It installs and builds twice, so it takes about twice as long.

`--memory 4g` caps the container's memory like a phone's RAM. `start-termux.sh` sizes Node's heap from the RAM it
sees, so the container also gets a `/proc/meminfo` that shows the cap. Through emulation the build needs more memory
than on a phone, so read a failure under a cap from an ARM machine or the workflow.

- Needs Docker only, no KVM, so it works in cloud containers. Termux's mirror (`packages-cf.termux.dev`) must be
  reachable; sandboxed cloud environments need it on their allowed hosts.
- arm64 is the default because phones are arm64. On an x86 machine it runs through qemu CPU emulation (it sets that up),
  so the first build takes about 10 minutes (8 in a 4-core cloud container); on an ARM machine (or the workflow's ARM runner) it takes under a minute.
  Later runs reuse the Termux home volume and only rebuild what changed. `--fresh` starts over like a first install.
- `--arch x86_64` checks x86 Android (Chromebooks, BlueStacks and other PC Android). Today that fails at the client
  build: rolldown ships no Android x64 binding.
- Once the server is up, the phone/tablet checks can drive it: `setup-webkit.sh http://localhost:7861` or
  `setup-android.sh http://localhost:7861`. `--shell` opens a Termux shell, `--stop` stops the container.
- Not covered (it is Termux on a PC kernel): Android's phantom process killer, battery savers, storage permissions,
  the APK's Termux hand-off and real phone speed.

### Android Chrome: `setup-android.sh`

```sh
scripts/perf/setup-android.sh http://localhost:7860
node scripts/perf/android-qc.mjs taps --device tablet --tap '[aria-label="Library"]' --shot /tmp/android-qc/library.png
```

It installs the Android SDK parts it needs (emulator, an Android 15 Google APIs image, about 2 GB once), boots a
headless Pixel 7 emulator, starts the ChromeDriver that matches the emulator's Chrome and forwards the emulator's
`localhost:7860` to this machine's (so the app sees the same localhost address Termux users open). The smoke test opens
the app as a phone (412x915) and an 8" tablet (800x1280) with **Show tap timings** on, taps with real touch events and
prints the readings. `android-qc.mjs` takes the same commands and `openDevice()` API as `webkit-qc.mjs`.

- Needs `/dev/kvm` (a Linux PC with virtualisation on, or a GitHub runner). Without it Android doesn't boot at a usable
  speed, and the script says so and stops. Cloud containers usually have no KVM: use the workflow below.
- The emulator runs on a PC processor and Chrome is the version on the system image, so timings read faster than a
  mid-range phone. Use it for Android layout, touch, keyboard and Chrome behaviour; compare speed before and after a
  change, and use WebKit for speed findings.
- Don't run Termux inside this emulator: it is x86_64, so it hits the rolldown problem above.

### Machines without KVM: the **Android QC** workflow

`.github/workflows/android-qc.yml` runs on demand (Actions > Android QC > Run workflow, pick the branch). `termux` runs
`setup-termux.sh` natively on an arm64 runner twice, once as an install and once as an update from the latest release
(`--from latest`), with an optional memory cap; `android` builds the branch, starts it and runs `setup-android.sh` on a
runner with KVM. The tap timings land in the run summary; screenshots and logs are attached to the run.

Pull requests to `staging` or `main` that change `start-termux.sh`, the dependency files, the build configuration, the
scripts the launcher runs or the storage format run the two `termux` jobs on their own.

## Other scripts

- `idle-animation-guard.mjs`: fails when an endless animation keeps running on something nobody can see (phone
  battery). `node scripts/perf/idle-animation-guard.mjs [baseUrl]`.

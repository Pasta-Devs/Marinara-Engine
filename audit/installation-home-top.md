# Audit: installation, home, INSTALLATION, UPGRADING, FAQ, TROUBLESHOOTING, CONFIGURATION

Read-only audit of the `staging` checkout (`scratchpad/ro`). Doc line numbers are from `ro/docs/...`. Code references are `ro/...`. "Verified" means the claim was checked against code or the English catalog. "Could not verify" means it is left unchanged and listed.

Method: read every assigned guide; checked install and update claims against `start.sh`, `start.bat`, `start-termux.sh`, `package.json`, `win/installer/installer.nsi`, `docker-compose.yml`, `Dockerfile.lite`, `.github/workflows/build-container*.yml`, the update and privileged-access routes, `runtime-config.ts`, `.env.example`, the onboarding tour, achievements constants, and `en.json` plus the Android `MainActivity.java` strings. Link and anchor check was run on every assigned file with a script; no broken relative links or anchors were found.

---

## Top wrong facts (ranked)

1. **Storage format is stale in two guides.** `storage-format.json` and `STORAGE_VERSION` are both **10** (`ro/packages/server/src/db/file-backed-store.ts:374`). Format 9 added connection account links; format 10 added GLB/FBX avatars (same file, comment lines 367-373). `UPGRADING.md:203` and `TROUBLESHOOTING.md:363-365` only talk about format 8 and "format-7 or older builds". Data at format 9 or 10 is also unreadable by older builds. Rollback guidance must name the current format and the pre-upgrade backup rule.
2. **Professor Mari change card has no Keep or Restore.** `FAQ.md:183` says the review card has **Keep** and **Restore**. The card has only **Undo** (`ro/packages/client/src/components/chat/MariChangeReceipt.tsx:4` "No Keep: ... Undo is the way back"; Undo button at lines 377, 687, 752). `home/professor-mari.md:182` is right.
3. **"Local Model" is not the UI name.** The UI label is **Built-in model**, in the section **On this device** (`en.json` lines 1758 and 1803: `connections.add.device.local_model`). The guides say "Local Model card" and "Local Model (sidecar)" (`home/welcome.md:7`, `FAQ.md:85`, `TROUBLESHOOTING.md:215-217`, `home/professor-mari.md:93`, `TROUBLESHOOTING.md:318`). "Local Model (sidecar)" does not exist in `en.json`. "Sidecar" only appears in server error text (`ro/packages/server/src/routes/sidecar.routes.ts:66`).
4. **Apply Update prerequisites are overstated.** `installation/windows.md:204-211` and `installation/macos-linux.md:229` say to set `ADMIN_SECRET` and paste it into Admin Access before **Apply Update** appears. The button depends only on git install, branch, and `UPDATES_APPLY_ENABLED` or a local channel switch (`ro/packages/server/src/routes/updates.routes.ts:873-889`; `ro/packages/server/src/services/updates/update-apply-policy.ts:13-14`). A same-machine request needs no secret unless `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true` (`ro/packages/server/src/middleware/privileged-gate.ts:44-56`). Remote apply does need `UPDATES_ALLOW_REMOTE_APPLY` and `ADMIN_SECRET` (correct in `UPGRADING.md:173-177`).
5. **Agent Organizer name.** `CONFIGURATION.md:297` says "Agents Manager". The UI label is **Agent Organizer** (`en.json` has 15 hits; "Agents Manager" has 0 hits in the catalog or client/server source).

Also wrong or inconsistent (lower): `professor-mari.md:63` chips are "Create a Character/Lorebook/Persona"; the code literals are "Create a character", "Create a lorebook", "Create a persona" (`ro/packages/shared/src/types/professor-mari-workspace.ts:423,430,437`). `containers.md:125` example tag `2.0.6` is an old version (`package.json:3` is 2.5.1).

---

## Verified correct (no action beyond style)

- Ports, bind addresses and defaults: launchers default `HOST=0.0.0.0` (`start.sh:74-75`, `start.bat:58`, `start-termux.sh:602-603`). Manual `pnpm start` defaults to `127.0.0.1` (`runtime-config.ts:17,324`). `PORT` 7860 (`runtime-config.ts:16`).
- Node 24 to 26: `package.json` engines `>=24 <27`; `start.sh:42` and `start.bat:46` reject below 24.
- `pnpm backgroundremover:install`, `pnpm reset-login`, `pnpm version` scripts exist (`package.json:38,60`). Python 3.9 to 3.11 is the accepted range (`scripts/install-backgroundremover.mjs:84,103`), so `installation/windows.md:158` and `installation/macos-linux.md:205` agree with code.
- `--skip-update`, `AUTO_UPDATE_ENABLED`, `AUTO_OPEN_BROWSER`, `BACKGROUNDREMOVER_AUTO_INSTALL` are read by the launchers (`start.sh:60`, `start.bat:13,23-27,333-337`, `start-termux.sh:237`).
- Windows installer: desktop shortcut (`installer.nsi:834`), installer-directory prompt (`installer.nsi:99`), auto-installs Git and Node if missing (`installer.nsi:241-260`).
- Container: image name `ghcr.io/pasta-devs/marinara-engine`, `:latest`, `:staging`, `:lite`, `:X.Y.Z-lite` (`build-container-lite.yml:5`). Compose binds `127.0.0.1:${PORT:-7860}:7860` (`docker-compose.yml:10`). Lite is Wolfi (`Dockerfile.lite:2,18`). Lite disables Gemma sidecar, embeddings, memory recall, Whisper (`Dockerfile.lite:10-13`). `/app/data/.env` is created on first start (`runtime-config.ts:112-116`, `getEnvFilePath` lines 85-99). Entrypoint chown and `MARINARA_SKIP_DATA_CHOWN=true` (`scripts/docker-entrypoint.mjs:133`).
- Android: menu label strings **Install / Start Marinara**, **Open in browser**, **Retry connection**, `allow-external-apps`, Termux `RUN_COMMAND` permission all exist in `android/app/src/main/java/com/marinara/engine/MainActivity.java:112-223` and `AndroidManifest.xml:7`. `/android-login` exists (`packages/server/src/middleware/android-local-auth.ts:6`). Node upgrade and `--skip-update` in `start-termux.sh:99-134`.
- iOS guide: `Access` and `Admin Access` labels exist; server-side behaviour matches Remote Access.
- Tutorial: 18 steps (`packages/client/src/components/onboarding/OnboardingTutorial.tsx:68-206`); buttons **Skip Tutorial** / **Skip** / **Next** / **Get Started** (lines 533-537); mobile breakpoint 640 (line 229); only **Get Started** commits the docs language (line 725). Tab labels **CONVO**, **RP**, **GM** exist in `en.json`.
- Achievements: all 24 (6 single, 6 ranked x 3 tiers at 5/25/100) match `packages/shared/src/constants/achievements.ts:15-17,48-156`. Hoarder excludes Professor Mari (`achievements.service.ts:104`). Setting defaults to on (`ui.store.ts:2367`). Setting label in App Behavior section (`settings-registry.ts:187-193`). Every card title and widget string checked in `en.json`.
- Professor Mari numbers: 30 chat-reference messages (`mari-composer-references.ts:26`); 20 waiting messages per chat (`workspace-pending-store.ts:22`); 14-day retention for undo copies (`mari-db.service.ts:257`); 20 MB per attachment (`prompt-attachments.ts:21`); 60,000-character reference budget (`mari-composer-references.ts:36`). `Ctrl+J` / `⌘J` and `Ctrl+K` / `⌘K` shortcuts (`OmnibarChrome.tsx:50`, `GlobalOmnibarHost.tsx:148`). Built-in skill and settings labels, Runtime labels **Classic** and **Permissions mode**, **Read the handbook before the first write** (`en.json` 6107, 6111, 10409).
- CONFIGURATION defaults checked in code: `MAX_TOOL_ROUNDS=100` (`runtime-config.ts:19`), agent 16 and backfill 64 (`:23,26`), Game turn 4 (`:21`), `CHAT_GENERATION_TIMEOUT_MS=300000` (`:29`), `CUSTOM_TOOL_TIMEOUT_MS=60000` (`:28`), `EMBEDDING_TIMEOUT_MS=300000` (`runtime-config.ts:623`), `IMAGE_GEN_TIMEOUT_MS=1800000` (`image-generation.ts:278`), `IMAGE_GEN_MAX_RESPONSE_BYTES` (`image-generation.ts:639`), `COMFYUI_GEN_TIMEOUT=2400` (`image-generation.ts:279`), `VIDEO_GEN_TIMEOUT_MS=1800000` and `VIDEO_GEN_MAX_RESPONSE_BYTES` 160 MiB (`video-generation.ts:46-47`), `MARI_WIKI_CONTENT_MAX_BYTES=50000` (`fandom-mediawiki-client.ts:218`), `BASIC_AUTH_REALM` default "Marinara Engine" (`runtime-config.ts:419`), `LOG_LEVEL` default warn (`logger.ts:186`), `LOG_PRESET=prompt-connections` (`runtime-config.ts:382`), `.env.timeouts.json` (`runtime-config.ts:925`), `MARINARA_MEDIA_GENERATION_*` (`image-generation-queue.ts:36,59`), `MARINARA_MAX_RESIDENT_CHATS` platform defaults (`runtime-config.ts:651-717`), `PROVIDER_LOCAL_URLS_ENABLED` on by default on Android (`runtime-config.ts:527-531`), `SIDECAR_RUNTIME_INSTALL_ENABLED=true` in `start.bat:59`, `AES-256-GCM` (`utils/crypto.ts:11`).
- Every env var in CONFIGURATION.md (106 uppercase tokens) appears in server, shared, launcher or `.env.example` code.
- TROUBLESHOOTING: client build heap message (`packages/client/scripts/build-heap.mjs:103,108`); `No audio after {{seconds}} s` (`en.json` 7321); **Debug mode** label (`en.json` 6650); **Message Tools** section (`en.json` 7135); **Too many wrong passwords**, **Save blocked** toasts, **Outbound response exceeded** message exist in code.

---

## Per guide

### INSTALLATION.md (59 lines) (Priority: low)

- Main task: pick a platform. Easy to find: yes.
- Wrong facts: none found.
- Missing: nothing required. The "By default the app runs at 127.0.0.1:7860" line is true for the browser URL, but the launchers bind `0.0.0.0` (see FAQ). Consider one sentence saying so.
- Duplication: platform table repeats the Android section of `installation/android-termux.md`; fine as an index.
- Length: about 10% cuttable (the "Minimal system notes" section repeats platform guides).
- Ban-list: 0 hits.
- Links: all resolve.

### installation/windows.md (276 lines) (Priority: medium)

- Main tasks: install with the installer; install from source; update; enable access from other devices. Findable: yes.
- Wrong facts:
  - `:204-211` Apply Update needs `ADMIN_SECRET` pasted into Admin Access before the button appears. Wrong for same-machine use (see top fact 4).
  - `:213-217` "Remote apply also needs one more value" is correct, but omits that `ADMIN_SECRET` is also needed here (it is mentioned above at `:208`, fine).
  - `:180` sends readers to FAQ for LAN setup. The actual steps are in FAQ lines 5-37 and REMOTE_ACCESS; the Windows guide itself shows only `HOST=0.0.0.0` (`:148-152`), which is correct.
- Missing steps:
  - No "how to stop the server" (Ctrl+C or close the console window). Confirmed absent across all install guides.
  - No "what you see now" for the first launch console or the `Access blocked` page a second device gets.
  - No uninstall or "where is my data" pointer.
  - No explanation of the "Node.js version" check failure message `[ERROR] Node.js 24 LTS or newer is required` (`start.bat:46-47`).
- Duplication: manual-update block duplicates UPGRADING "Windows". Pick one owner (UPGRADING) and link.
- Length: about 15% cuttable (AI sprite background section, lines 154-176, belongs in a media guide; the manual-update block duplicates UPGRADING).
- Ban-list: "just" at `:219` ("just relaunch"). 1 hit.
- Links: all resolve.
- Terms: "AI sprite background removal" vs "background remover" (`:156` and `:166`) vs CONFIGURATION "backgroundremover". Pick one.

### installation/macos-linux.md (248 lines) (Priority: medium)

- Main tasks: install with `./start.sh`; manual setup; update; optional background remover. Findable: yes.
- Wrong facts:
  - `:229` same Apply Update error as Windows.
  - `:132` "Node.js 24 includes Corepack but Node.js 25 does not" — could not verify (Node release fact outside repo).
  - `:181-191` ERR_PNPM_ENAMETOOLONG fix: string only exists in docs (`TROUBLESHOOTING.md:122`); could not verify it is a real pnpm error path in the launcher. Duplicates TROUBLESHOOTING `:122-130`.
  - `:98` "Marinara opens in your browser at http://127.0.0.1:7860" — correct (`start.sh:83-85`).
- Missing steps: stop the server; uninstall; what the console looks like after `./start.sh`; a note that `chmod +x` is needed only once (it is shown, fine).
- Duplication: ENAMETOOLONG (also TROUBLESHOOTING); background remover (also Windows and TROUBLESHOOTING `:277-289`). Keep one owner.
- Length: about 15% cuttable.
- Ban-list: "just relaunch" at `:229`. 1 hit.
- Links: resolve. Anchor-free.

### installation/containers.md (249 lines) (Priority: medium)

- Main tasks: start with Compose; expose to LAN; update; choose a tag; Podman. Findable: yes.
- Wrong facts:
  - `:125` example tag `2.0.6` is stale (current 2.5.1).
  - `:177` 2.5.0 rollback and `UPGRADING.md:209` are consistent, but both should mention storage format 10 (see top fact 1).
  - `:166` Compose update is `pull && up -d` while `UPGRADING.md:84` uses `down && pull && up -d`. Both work; pick one (the UPGRADING version is the more cautious one).
  - `:116`, `:118` (LAN section, lines 79-118) repeats FAQ and REMOTE_ACCESS. The claims match `docker-compose.yml` but the section is long.
- Missing steps: how to stop the container (`docker compose down` is in UPGRADING only); how to open the setup page on a second device (first-time code route exists, shown); the `Access blocked` state.
- Duplication: LAN steps repeated in FAQ 5-37, iOS guide, REMOTE_ACCESS. Keep the steps in REMOTE_ACCESS and link.
- Length: about 20% cuttable (LAN section, Podman install variants, build-from-source).
- Ban-list: "just want Marinara running" at `:3` is fine. 0 hits.
- Links: resolve; `#tailscale-and-docker-bypass` anchor exists (`REMOTE_ACCESS.md:141`).

### installation/android-termux.md (107 lines) (Priority: medium)

- Main tasks: install via APK; manual Termux install; start again; update. Findable: yes.
- Wrong facts: none on labels (verified). Notes:
  - `:9` says the F-Droid build is what the setup downloads; not verified in `android/` code (could not verify).
  - `:60` uses `Settings > General > App Behavior > Open Android launcher (app or browser)` with `>` while the rest of the docs use `→`. Style, not fact. The UI label exists (`en.json` 6513, 6547).
- Missing steps: how to stop the server from Termux (Ctrl+C), what the first Termux output looks like, what to do if the Termux notification is dismissed.
- Duplication: troubleshooting sections in TROUBLESHOOTING (`:390-454`) overlap this guide's "Start again" and locked-out notes. The "Locked out after updating" block here (`:78-82`) repeats REMOTE_ACCESS and iOS guide.
- Length: about 15% cuttable.
- Ban-list: "just start Marinara normally" at `:90`. 1 hit. Also the phrase "Do not add `null`" appears here (`:15`) and in TROUBLESHOOTING (`:401,409`). Fine, but say it once.
- Links: resolve.

### installation/ios-pwa.md (92 lines) (Priority: low)

- Main tasks: connect from Safari; add to Home Screen; reinstall PWA; troubleshoot. Findable: yes.
- Wrong facts: none verified against code. Could not verify: Safari "Website Data" menu path and "Add to Home Screen" button wording (Apple UI, outside repo).
- Missing steps: how to find the host IP on a Mac or PC (FAQ has `ipconfig` / `hostname -I`, not linked here); first-time setup code step is only in troubleshooting; "what you see" on the login page.
- Duplication: troubleshooting section repeats REMOTE_ACCESS; "Privileged actions are blocked" repeats the admin-secret explanation.
- Length: about 10% cuttable.
- Ban-list: 0 hits.
- Links: resolve.

### home/welcome.md (87 lines) (Priority: medium)

- Main task: understand the Home screen and reach first chat. Findable: yes (linked from INSTALLATION.md).
- Wrong facts:
  - `:7` and elsewhere: "Local Model" is the doc name; UI is **Built-in model** (top fact 3).
  - `:55` **Set Up Conversation**, **Set Up Roleplay**, **Set Up Game** window titles: not found in `en.json` or client source. Could not verify; check the setup wizard's title keys before keeping.
  - `:29-38` widget names, bookmark labels, button labels all verified in `en.json` (e.g. `home.browser.*`, `home.widgets.*`, `home.actions.*`).
- Missing: "what you see now" after step 1 (the empty Home screen, the first-time tour starting). Explain what a connection looks like in the list.
- Duplication: step 2 explains connections; the full steps are in `connections/connecting-to-a-provider.md`. OK as a link, but the API key definition repeats FAQ line 81.
- Length: about 15% cuttable (widget table is good; the "Browser chrome" paragraph at `:46` could move to Home Widgets reference).
- Ban-list: 0 hits. Long list in `:17` ("Phones, tablets and very narrow windows don't show this bar, in portrait or landscape") is fine.
- Terms: "tab" vs "bookmark" vs "widget" are used consistently with UI.

### home/tutorial.md (55 lines) (Priority: low)

- Main task: replay tour, skip tour. Findable: yes.
- Wrong facts: none. All 18 step titles verified against `OnboardingTutorial.tsx` (`titleKey` lines 163-198 are verified via `en.json`).
- Missing: the step text itself is not shown; users will not know what each card says. Fine as a reference.
- Duplication: step list partly overlaps welcome; fine.
- Length: about 10% cuttable (the mobile section could be shorter).
- Ban-list: 0 hits. "Professor Mari... walks you around" fine.

### home/achievements.md (98 lines) (Priority: low)

- Main task: find achievements and turn them off. Findable: yes.
- Wrong facts: none found. The Diligent Student row says "Finish or skip" (`:39`). The code description says "Completed Professor Mari's tutorial" (`achievements.ts:52`). Could not verify whether skip counts (logic is in onboarding, not read). Mark as unverified or check `use-achievements` tracking call.
- Missing: nothing material.
- Duplication: the widget description repeats welcome.md; link is fine.
- Length: about 5% cuttable.
- Ban-list: "just" at `:9`, `:56`, `:85`. 3 hits ("They are just a fun way", "just visiting the link is enough", "The card just shows as unlocked").

### home/professor-mari.md (351 lines) (Priority: high on length and accuracy; overall medium-high)

- Main tasks: open her; ask for help; link items with @; change review (Undo); memories; chat history; sending while she works. Findable: partly. The guide is one long page; "Where to find her" is first and clear, but "Reviewing her changes" (`:176`) and "Sending messages while she works" (`:269`) are deep in the page.
- Wrong or stale facts:
  - `:63` chip casing (see top list).
  - `:93` "Local Model (sidecar)" not a UI label (top fact 3).
  - `:42` "33 official downloadable agents" — could not verify the count (catalog lives in Pasta-Devs/Marinara-Agents).
  - `:27` Ctrl+K verified.
  - `:182-184` Undo, 24 h, 14 days, newest 50 — 14 days verified (`mari-db.service.ts:257`); "newest 50" and "24 hours" not found in the code I read; could not verify (`mari-change-receipt.ts:475` mentions the 14-day and newest-50 cap, so likely right).
  - `:154` 8 links per message and 60,000 characters — 60,000 verified (`mari-composer-references.ts:36`); 8-link cap not located; could not verify.
  - `:166` table of slash commands: not checked one by one; `/restart` and `/title` mentioned in `:295` as "do nothing while she works".
- Missing steps:
  - No "what you see now" for the first Professor Mari chat (empty state, starter chips visible or not).
  - "Context" chip and "Ready to help" status: explained; ok.
  - Unexplained terms: "Decision model" (`:205`), "Activation questions", "Trigger Cadence", "Sticky", "Cooldown", "ruleset sheet", "Pi runtime", "persistent memory", "change card", "held change", "sandbox". Each needs a short gloss or a link.
- Duplication:
  - "Custom Skills", "Saved memories" (`:219-257`) duplicate `agents/memory.md` and the Skills text in `connections/decision-models.md`.
  - "Creating content with Decisions" (`:203-217`) duplicates `connections/decision-models.md` and `prompts/conditional-prompts.md`; the guide itself says so.
  - "Commands with /" (`:158-174`) and "@ links" (`:131-156`) are reference tables that belong in a separate reference page.
  - Trust boundary (`:75-87`) repeats `REMOTE_ACCESS.md` and `development/` material.
- Length: about 35-40% cuttable. Suggested split: (a) this guide keeps: where to find her, what she can do, picking a connection, reviewing changes and Undo, chat history, sending while she works, FAQ/troubleshooting; (b) move "@ links" and "/ commands" to a reference page; (c) move Decisions, Skills, Memories and the trust boundary to their own pages with links.
- Ban-list: "just" at `:31`, `:41`, `:95`, `:174`, `:254`, `:257`. Em-dash at `:41`. "powerful" at `:73`.
- Links: all resolve; anchors `#sending-messages-while-she-works`, `#commands-with-`, `#where-to-find-her` resolve.
- Terms: "Professor Mari" vs "Prof. Mari" (UI uses both: "Ask Prof. Mari" in Search, "Professor Mari" widget). Keep both as UI does, but pick "Professor Mari" in body text.

### FAQ.md (225 lines) (Priority: high)

- Main tasks: find the answer to a common question. Findable: medium. Answers are grouped, but there are 22 questions and no index; the page is long for a FAQ.
- Wrong facts:
  - `:183` Keep and Restore (top fact 2).
  - `:9` start scripts bind `0.0.0.0` — verified for `start.sh`, `start.bat`, `start-termux.sh`.
  - `:47` `/android-login` for older APKs — verified (`android-local-auth.ts:6`).
  - `:107` AES-256 — verified (`crypto.ts:11`).
  - `:91-95` provider list — spot-checked; names found in code (Venice.ai, Draw Things, Block Entropy, Seedance 2.0, Stable Horde, Arli AI, Z.AI, DeepSeek, Pollinations, NovelAI, RunPod, OpenRouter Images, Together AI). "Custom (OAI-Compatible)" appears in code as "OAI-Compatible". Could not verify the exact UI spelling of each.
  - `:175` link `UPGRADING.md#downgrading-to-an-older-version` resolves; the section content is stale (top fact 1).
- Missing steps:
  - `:5-39` access steps are the longest in the file and say "see Remote Access" several times. Add the one "what you see" line the user gets when the login is set.
  - `:83` "Add account" window steps need a screenshot-free "what you see" line for the model picker.
- Duplication:
  - Access steps (`:5-39`) duplicate `REMOTE_ACCESS.md`, `installation/containers.md:79-118` and TROUBLESHOOTING `:167-181`. Keep one; link the rest.
  - Professor Mari (`:177-187`) repeats `home/professor-mari.md`. Keep 2 sentences and link.
  - Storyboard (`:189-195`), calls (`:197-201`), Noodle (`:133-137`) repeat the feature guides.
  - Mode list (`:55-63`) repeats `home/welcome.md`.
- Length: about 25% cuttable (the three repeated feature answers and the access steps).
- Ban-list: "just" at `:175`. 1 hit. "Note:" at `:187` (no callout style). 1 hit.
- Links: resolve; anchor `#option-1-login-recommended` resolves in REMOTE_ACCESS.md.

### UPGRADING.md (231 lines) (Priority: high)

- Main tasks: back up; update by platform; apply update from app; roll back. Findable: yes, but the "Checking for and applying updates" section (`:133-187`) is buried after platforms.
- Wrong facts:
  - `:203` and `:209` storage format 8 (top fact 1).
  - `:177` "keeps Apply Update" needs `ADMIN_SECRET` for same-machine path is not stated, but `:171` correctly says no secret on same machine. Sections conflict slightly: `:166-171` (no secret needed locally) vs the install guides (secret needed). Fix the install guides to match this section.
  - `:166-169` says Apply Update needs a git install and `UPDATES_APPLY_ENABLED`. Missing the branch condition (feature branches show "dev-branch") (`updates.routes.ts:859-863`). Low.
  - `:160` "N commits behind" — verified-ish; `:162` cache 15 min (verified `updates.routes.ts:108`); 5-min commit cache not verified.
  - `:143-148` Release Channel labels and warning text: channel labels verified (`SettingsPanel.tsx:7460-7463`); warning string "Staging builds are pre-release tester builds..." not found in `en.json` or code (could not verify; check the exact wording).
  - `:179` "Update applied successfully. Please relaunch the app..." not found in `en.json`; could not verify. Check the server response text.
  - `:189-197` Refresh App button verified (label exists).
  - `:201` "launcher skips auto-updates that would land on incompatible version" — could not verify beyond the TROUBLESHOOTING claim.
- Missing:
  - No "what you see now" after `Apply Update` other than the one message.
  - Docker: `down && pull && up` here vs `pull && up` in containers guide.
  - The "Going back" section does not say how to find your current format or that a pre-upgrade backup is the only path back for format 9 and 10.
- Duplication: "Back up first" repeats `data/backup-and-restore.md`; the Windows, macOS and Termux blocks repeat the install guides' update sections. Keep the platform blocks here and remove the repeats from install guides.
- Length: about 20% cuttable (the 2.5.0 block and the platform repeats).
- Ban-list: "simply behind" at `:160`; "actually runs" at `:124`. 2 hits, both fine but drop "simply".
- Links: resolve; anchors `#back-up-first`, `#going-back-to-250`, `#downgrading-to-an-older-version` resolve.

### TROUBLESHOOTING.md (554 lines) (Priority: high)

- Main task: find a symptom and fix it. Findable: yes by headings; there are about 60 headings and a long "Install and launch" group that is mostly version history.
- Wrong or stale facts:
  - `:363-365` storage format 8 (top fact 1).
  - `:484` "Known affected lite images include 1.5.7-lite and 1.5.8-lite. Last checked against Marinara Engine 2.2.0." — stale dates; keep only the current advice.
  - `:330` "Last checked against Marinara Engine 2.2.0. Spotify tightened these rules in February 2025." — stale; the Spotify claim is outside the repo (could not verify).
  - `:104-106`, `:116`, `:118-120` version-specific notes (v2.3.0, v2.3.1, v2.4.1 staging build) are historical. Not wrong, but they will go stale.
  - `:132-134` "Ignored build scripts: @google/genai" — could not verify the notice text in launcher code.
  - `:122-130` ENAMETOOLONG — string only in docs (top list); could not verify the code path.
  - `:336` "four seconds" restart timeout and `:413` "one minute, once" link expiry — could not verify.
  - `:317` "No audio after 60 s" is a template: real text is `No audio after {{seconds}} s` (`en.json:7321`). Fine, but say the number depends on the setting.
  - `:552-554` a PWA section sits under "Related guides" (structure bug): move above Related guides or into "Accessing Marinara from another device".
- Missing:
  - Several entries lack the symptom text the user sees (for example `:28` and `:54` give the Termux message but not what the app shows).
  - `:12` "turn on Debug mode first" — link to the setting path (it is given at `:530`; fine).
  - No note that most symptoms are fixed by restarting through the launcher.
- Duplication:
  - Android sections (`:390-454`, `:478-484`) repeat `installation/android-termux.md` and Remote Access.
  - "Accessing from another device" (`:167-181`) repeats FAQ 5-37, containers `:79-118`, REMOTE_ACCESS.
  - "Save blocked" (`:185-200`) repeats REMOTE_ACCESS CSRF section (line 259 there).
  - Memory section (`:235-265`) repeats `agents/memory.md`.
  - Maintainer section (`:223-233`) belongs in CONTRIBUTING.md; it is not a user task.
  - ENAMETOOLONG repeats macos-linux.md `:181-191`.
- Length: about 25-30% cuttable: version history (`:40-52`, `:54-69`, `:83-120`, `:417-425`), maintainer runtime pinning (`:223-233`), and the repeated access and Android blocks.
- Ban-list: em-dashes at `:359`, `:431`, `:435`. "just" at `:359` ("just cannot see it"; acceptable). "Do not" is frequent but fine for a troubleshooting guide.
- Links: all resolve, including `#chats-show-no-messages-after-switching-to-an-older-version`, `#android-localhost-opens-the-login-page-or-returns-401503`, `#outbound-http-proxy` (CONFIGURATION), `#optional-multiplayer`.
- Terms: "Sidecar" (`:217`, error text) vs "Local Model" (UI). "Engine" vs "Marinara". "Agent" vs "Agents" fine.

### CONFIGURATION.md (461 lines) (Priority: medium)

- Main task: look up a setting. Findable: yes, but the page is a reference and the intro says "most users never need this" (good). The full variable table is at `:346+`, and some sections (custom agent imports, multiplayer) are long prose inside a config reference.
- Wrong facts:
  - `:297` "Agents Manager" (top fact 5).
  - `:291` `UPDATES_APPLY_ENABLED` "Git-based installs only" — correct (`updates.routes.ts:838-889`).
  - `:294` `HAPTICS_ALLOW_REMOTE` default false — in `.env.example:288`; code not checked.
  - `.env.example:145` `BASIC_AUTH_REALM=Marinara-Engine` while code default and this doc say `Marinara Engine` (`runtime-config.ts:419`). The doc is right; `.env.example` is inconsistent (outside this guide, note for the owner).
  - `:194-196` `MARINARA_MAX_RESIDENT_CHATS` Termux/SteamOS default 8 — could not verify the SteamOS branch beyond reading `runtime-config.ts:651-717`.
  - `:324` "Settings > Advanced > Features" — "Features" tab label not checked.
  - `:344` link `https://github.com/...` fine.
- Missing: the step "to turn on a setting, copy line from .env.example" is good; add "then save; most change within 2 seconds (no restart)" once in the table intro — it is at `:110-120` already. Fine.
- Duplication:
  - Access-control table (`:161-180`) duplicates REMOTE_ACCESS (which it says is the walkthrough). Good, but the table is long.
  - Multiplayer (`## Optional multiplayer`, lines 76-97) duplicates `development/multiplayer.md` and TROUBLESHOOTING `:14-24`.
  - Custom agent imports and External Extensions (lines 30-75) duplicate `agents/` and `extending/` guides.
  - Logging levels duplicate `.env.example` comments.
- Length: about 25% cuttable by moving multiplayer, custom-agent imports and external extensions to their owner guides, leaving a link.
- Ban-list: em-dash at `:125`; "just" at `:417` ("A file just restored", acceptable). "Very verbose" at `:217` is fine.
- Links: resolve, including `#optional-multiplayer`, `#marinara-notices`, `#outbound-http-proxy`, `#access-control`.
- Terms: "Admin Access" / "admin secret" / "ADMIN_SECRET" (UI placeholder reads `ADMIN_SECRET`, `en.json:14926`). Use "admin secret" in prose, and show `ADMIN_SECRET` only in code.

---

## Duplication map (owner → repeats)

- Remote access steps (owner: REMOTE_ACCESS.md) ← FAQ 5-37, containers.md 79-118, TROUBLESHOOTING 167-181, iOS troubleshooting, Android "Locked out", CONFIGURATION access table.
- Update steps by platform (owner: UPGRADING.md) ← windows.md 182-263, macos-linux.md 223-231, android-termux.md 88-98, containers.md 30-48.
- Apply Update (owner: UPGRADING.md 133-187) ← windows.md 194-219, macos-linux.md 227-229 (conflicting).
- Background remover (owner: a media guide or Windows/macOS install) ← windows.md 154-176, macos-linux.md 193-221, TROUBLESHOOTING 277-289.
- ENAMETOOLONG (owner: TROUBLESHOOTING) ← macos-linux.md 179-191.
- Storage format and rollback (owner: UPGRADING.md) ← TROUBLESHOOTING 357-378, containers.md 48.
- Android app troubleshooting (owner: TROUBLESHOOTING Android section) ← android-termux.md 78-82, 58-67.
- Decisions, Skills, Memories (owners: connections/decision-models.md, agents/memory.md) ← home/professor-mari.md 203-257.
- Storyboard / calls / Noodle answers (owners: feature guides) ← FAQ 133-137, 189-201.
- Mode list (owner: welcome.md) ← FAQ 55-63.

---

## Ban-list counts (assigned files)

- "just": 19 occurrences. Examples: `installation/macos-linux.md:229` ("just relaunch"), `installation/windows.md:219` ("just relaunch"), `home/achievements.md:9` ("just a fun way"). About 10 are plain "just" meaning "only" (acceptable but cut where it reads as "simply").
- "very": 6 occurrences (e.g. `CONFIGURATION.md:217` "Very verbose", `TROUBLESHOOTING.md` a few). Mostly fine.
- "powerful": 1 (`home/professor-mari.md:73`).
- "actually": 2 (`UPGRADING.md:124`; one more in a guide, not located).
- "simply": 1 (`UPGRADING.md:160`).
- "Note that": 1 (`CONFIGURATION.md:441`).
- "unlock": 13, mostly literal feature wording (achievements, "unlock privileged actions"). Keep.
- Em-dash chains: `TROUBLESHOOTING.md:431,435`, `CONFIGURATION.md:125`, `professor-mari.md:41,73,137`.
- Callouts: the guides use zero `> **Note:**` blocks. Warnings that need them: `FAQ.md:187` ("Note: on an ordinary remote address...") and `installation/windows.md` backup warning for Staging (`:201`, plain sentence). Convert the two data-loss or security notes to `> **Warning:**`.
- Heading structure: all 14 files have one H1 and no skipped levels. The PWA section placed under "Related guides" in TROUBLESHOOTING is a structure bug (not a skip).
- Emoji: 0.
- Bold headings: 0.

---

## Terms used for the same thing (UI term first)

- **Built-in model** (UI, `en.json:1803`, section "On this device" `:1758`) vs **Local Model** (all docs) vs **Local Model (sidecar)** (professor-mari) vs **sidecar** (error text, TROUBLESHOOTING). Use the UI term.
- **Connection** (UI "Connections", "Add account") vs **provider** (FAQ "AI providers") vs **account** (UI "Add account", `connections.accounts.*`) vs **API** / **API key**. The UI uses connection for the saved item and account in the add window. Docs use "connection" well; the FAQ mixes "provider" in the first answer.
- **Agent Organizer** (UI, `en.json` 15 hits) vs **Agents Manager** (CONFIGURATION `:297`, not in UI) vs **Agents panel**.
- **Professor Mari** (UI widget and chat) vs **Prof. Mari** (UI Search row "Ask Prof. Mari") vs **Mari** (code, `mari` CLI).
- **Login** (UI "Login", "Set login", "Remote login", `en.json`) vs **Basic Auth** (docs; UI does not use it except the setting names) vs **Access** (UI section). Use "login" in prose; name BASIC_AUTH_* only in code.
- **Admin secret** (docs) vs **ADMIN_SECRET** (UI placeholder `en.json:14926`) vs **Admin Access** (UI section `en.json:7099`). Use "admin secret" in prose; `ADMIN_SECRET` in code; "Admin Access" for the section.
- **Advanced Memory** (UI `"Advanced Memory` 14 hits) vs **Advanced Memory Recall** (FAQ `:146`). UI uses "Advanced Memory".
- **Backup & Export** (UI section) vs **backup** vs **Download Backup** (UI button). Use the UI names.
- **Profile** (UI "Import Profile") vs **persona** (a different thing) vs **full backup ZIP**. Keep "profile" only for the import/export pair.
- **Character card** (UI 57 hits) vs **character**. Fine; use "character card" in definitions only.
- **Release Channel** / **Latest Stable** / **Staging/UAT** (UI). Docs match.
- **Check for Updates** (UI) vs "check for updates" (prose). Fine.
- **Conversation** (mode name) vs **chat** (generic). Keep.
- **Lite image** (containers) vs **lite build** (TROUBLESHOOTING `:319`) vs **lite container**. Pick "lite image".
- **Android app** / **APK** / **Termux** / **Android bootstrap APK** (README). Keep "Android app" and "APK" as UI does.
- **Storyboard** vs **Storyboard Agent** (FAQ `:189`). Fine.
- **Widgets** (UI "Home Widgets"). Fine.
- Settings path separators: `→` (53 uses), `>` (21, mainly TROUBLESHOOTING and Mari), `->` (4, FAQ/UPGRADING). Use `→` everywhere; the style guide says so.

---

## Word list candidates

- **Built-in model** → Local Model; local model; sidecar; on-device model → The AI model that runs on your computer, with no API key. (Use the UI term.)
- **Connection** → provider; account; endpoint; API key → A saved link to one AI service (one key or endpoint) with its models.
- **Agent Organizer** → Agents Manager; Agent catalog; Agents panel → The place where you install and update optional agents.
- **Professor Mari** → Prof. Mari; Mari; the assistant → The built-in assistant on Home.
- **Login** → Basic Auth; remote login; password; access → The username and password that protect Marinara when other devices reach it.
- **Admin secret** / **Admin Access** → ADMIN_SECRET; admin password; secret → A second password for risky actions (backups, updates) from another device.
- **Undo** (change card) → Keep; Restore; revert → Puts back the previous saved version of a change Professor Mari made.
- **Advanced Memory** → Advanced Memory Recall → Automatic scene memory for long Roleplay chats.
- **Backup & Export** / **Download Backup** → backup; export; full backup ZIP → A ZIP file of all your data and uploaded files.
- **Import Profile** → profile import; restore → Brings a saved profile or full backup back in.
- **Release Channel** → track; branch; channel → Which builds the app follows: Latest Stable or Staging/UAT.
- **Apply Update** → update button; install update → Updates a git install from the browser, if the server allows it.
- **Refresh App** → clear cache; reload → Clears the browser's cached copy of the web app. Does not change the server.
- **Storage format** → data version; storage version → The on-disk layout number for your data. Current: 10.
- **Termux** → Linux terminal; the Android Linux environment → An Android app that gives the phone a small Linux shell where Marinara runs.
- **LAN** → local network; Wi-Fi; home network → Devices on the same home or office network.
- **PWA** → Home Screen app; web app → A website saved to the Home Screen that opens like an app.
- **Context window** / **tokens** → not used in these guides; defined only where needed.
- **Decision model** → Decision connection → A small model Professor Mari and lorebooks use for yes-or-no checks. (Explain on first use.)
- **Achievement** → badge → A cosmetic unlock; the Home bookmark and widget.
- **Onboarding tour** → tutorial; first-time tour → The guided walkthrough that starts on first launch (UI: "Tutorial" bookmark, "Replay tutorial").
- **Documentation** → guides; docs → The in-app manual (bookmark "Documentation").
- **Lite image** → lite build; lite container → The smaller Docker image without local AI models.

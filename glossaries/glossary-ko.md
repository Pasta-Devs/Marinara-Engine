# Korean (`ko`) documentation-pack glossary

## Provenance

This is the **second-generation** Korean glossary. The original working glossary written during the
`ko` translation cycle was lost to temp-directory cleanup, so this file was **re-derived on
2026-09-01** from, in authority order:

1. **The shipped `ko` pack itself** (125 files on the `docs-i18n` branch) — the ground truth. Every
   prescriptive rule below either cites a pack file that demonstrates it, or is explicitly labelled
   a **[recorded ruling]**.
2. **The pack's shipping PR decision write-up** — [Pasta-Devs/Marinara-Engine#4374](https://github.com/Pasta-Devs/Marinara-Engine/pull/4374),
   plus its companion UI-string PR [#4376](https://github.com/Pasta-Devs/Marinara-Engine/pull/4376)
   (`ko.json` fixes that the docs review surfaced).
3. **The 2026-09-01 mirror-cycle terminology notes** (`prd-notes-ko.md`) — evidence-backed choices
   made while mirroring drifted guides into the pack the same day.
4. **`packages/client/src/localization/locales/ko.json`** — the app's shipped Korean UI translation,
   which is the authority for every UI-label gloss.

Rules are stated as they hold **in the pack as shipped**, not as they were originally aspired to.
Where the pack deviates from a rule, the deviation is listed in
[§7.3 Known pack residuals](#73-known-pack-residuals) rather than silently smoothed over.

Citations are `path:line` relative to the pack root (`docs-i18n:ko/`). Counts were taken by
mechanical census over all 125 `.md` files on 2026-09-01.

**Verification pass (2026-09-01).** Every terminology row, every typography claim and every
`path:line` citation in this file was re-checked against the pack. The register census (§1), the
Latin-name particle table (§2), the Unicode/typography table (§4) and the `ko.json` gloss samples
(§5) reproduced exactly. Corrections were applied where the pack disagreed — chiefly six terms that
were listed as banned but are live in a different sense (now §6.4), the navigation-path counts in §5
rule 9, and the gloss total. Four residuals found during this pass were added as **R5**–**R8**; of
these **R8 is a content gap** (two English sections with no Korean counterpart) rather than a
consistency wrinkle, and is the one worth fixing first. Two §7.1 checks that claimed "all pass" did
not — checks 15 and 16 — and now state their real results.

Claims that cannot be checked against the shipped pack — process rulings, historical counts from the
original cycle, and engine behaviour — are marked **[recorded ruling]** and were left as received.
Where a recorded ruling is contradicted by the shipped pack, the pack wins and the ruling is
annotated (see §6.5 on the "163 mismatches" figure).

---

## 1. Register & address

| Rule | Evidence |
|---|---|
| **합니다체** throughout. Declaratives end `-습니다` / `-ㅂ니다` / `-입니다`. Census: 3,684 `습니다`, 3,042 `합니다`, 2,064 `입니다`. | `CONFIGURATION.md:3`, `FAQ.md:7` |
| **Imperatives are `~하세요`**, never `~하십시오`, `~해 주세요`, `~바랍니다`, or bare `~해라`. Census: 3,073 sentence-final `세요.`; **0** occurrences of `십시오`, `해 주세요`, `바랍니다`, `해라`. | `INSTALLATION.md:49`, `FAQ.md:13` |
| **해요체 and 한다체 are banned.** Census: 0 sentence-final `-어요/-아요`, 0 sentence-final `-ㄴ다.` in prose. | pack-wide census |
| **당신 is banned.** Korean drops the subject; 당신 reads confrontational in documentation. Census: **0** occurrences pack-wide. Second person is expressed by omission, or by 내/나 from the reader's viewpoint ("내 컴퓨터", "자신의 호스트 IP"). | `FAQ.md:9`, `INSTALLATION.md:43` |
| **저희 / 우리 are effectively banned** for the product's voice — the product is named, not personified as "we". Census: 0 `저희`; 2 `우리` (generic, non-product). Prose says **Marinara**/**Marinara Engine** does X. | `CONFIGURATION.md:24` ("Marinara는 … 매번 묻습니다") |
| **Gender-neutral by construction.** Korean docs carry no grammatical gender; the pack never assigns a gender to the reader, to characters generically, or to Professor Mari. Refer to the reader by role ("사용자", "서버 운영자") or by omission. | `CONFIGURATION.md:61` ("환경 변수는 서버 운영자의 허가이고…") |
| **Guide-opening formula:** a user-facing guide opens `이 가이드에서는 …를 설명합니다.` / `…를 안내합니다.` **108 of 125** files use it. The 17 exceptions are the 11 `development/` PRDs and audits (engineering memos) plus `agents/hierarchical-maps.md`, `chats/settings-profiles.md`, `extending/personal-extensions.md`, `extending/writing-personal-extensions.md`, `game/storyboard.md`, `media/comfyui.md` — reference pages that open with a definition instead. | `lorebooks/overview.md:3`, `prompts/presets.md:3`, `agents/agents-overview.md:3` |
| **Headings are noun phrases**, usually `-기` verbal nouns (411 of 1,861 headings end in `기`). FAQ-style headings are the one exception: **24** headings end in `?` — 19 in `-나요?`, 5 in `-인가요?` / `-한가요?`. Never imperative headings. | `INSTALLATION.md:5` (`## 플랫폼 고르기`), `FAQ.md:5` (`## …어떻게 하나요?`), `FAQ.md:49` (`…무엇인가요?`) |
| **Exclamation marks are rare** (34 pack-wide, mostly inside quoted UI strings or code). Prose is declarative. | pack-wide census |

---

## 2. Product, feature & mode names

**Core rule — product and feature names stay in Latin script.** They are never transcribed into
Hangul. This is the rule that PR #4376 enforced back into `ko.json` (미니 마리의 깜짝 방문 →
`Mini Mari의 깜짝 방문`).

| Category | Treatment | Evidence |
|---|---|---|
| Product name | `Marinara Engine` / `Marinara` — Latin, never 마리나라. | `CONFIGURATION.md:7`, `FAQ.md:7` |
| Chat modes | `Conversation`, `Roleplay`, `Game Mode` — Latin, **glossed on first use in a file** in the bold-label form of §5: `**Conversation**(대화)`, `**Roleplay**(롤플레이)`, `**Game Mode**(게임 모드)`; bare Latin thereafter. | `FAQ.md:53-55`, `integrations/discord-mirror.md:3` |
| In-app surfaces | `Preset Editor`, `Character Editor`, `Card Browser`, `Memory Recall`, `World Maps`, `Peek Prompt`, `Professor Mari`, `Noodle`, `Impersonate` — Latin. Glossed once if the app ships a Korean string for them. | `prompts/presets.md:1`, `agents/memory.md:3`, `chats/peek-prompt.md:1` |
| Platform/vendor names | `Termux`, `Docker`, `Podman`, `Android`, `Node.js`, `GitHub`, `Discord`, `Tailscale`, `ComfyUI` — Latin. | `INSTALLATION.md:20,35`, `installation/containers.md:10` |
| Acronyms | `HUD`, `NPC`, `GM`, `PWA`, `APK`, `TTS`, `LTS` — Latin. Glossed on first use where a reader needs it: `NPC(플레이어가 아닌 캐릭터)`, `PWA(Progressive Web App, 앱처럼 설치할 수 있는 웹사이트)`, `LTS는 Long Term Support(장기 지원)의 줄임말`. | `game/dice-and-skill-checks.md:68`, `FAQ.md:43`, `UPGRADING.md:46` |
| Concept nouns that are *not* names | Translated: 에이전트, 로어북, 프리셋, 페르소나, 캐릭터 카드, 연결, 채팅. A **name** is capitalised in the English source and identifies a specific surface; a **concept** is lowercase and gets Korean. | `agents/agents-overview.md:3` (panel `**Agents**(에이전트)` vs. concept 에이전트) |
| Code literals | Byte-identical, never translated, never glossed: `start.sh`, `.env`, `DATA_DIR`, `termux-wake-lock`, `{{user}}`, `agents.json`. | `FAQ.md:9`, `TROUBLESHOOTING.md:326` |

### Carrier nouns

A Latin name may take a Korean **carrier noun** when the English relies on capitalisation alone to
signal the category: `**Lorebooks**(로어북) 패널`, `**Agents** 패널`, `Marinara 폴더`,
`Discord 채널`, `릴리스 채널`. The carrier is chosen so the sentence still parses when the reader
is on the English UI. Evidence: `lorebooks/overview.md:3`, `agents/custom-agents.md:42`,
`TROUBLESHOOTING.md:39`, `integrations/discord-mirror.md:3`.

### Particles after Latin names — the batchim rule

**A particle after a Latin name agrees with the batchim of the name's *Korean reading*, not with its
English spelling.** The pack is 100% consistent on this; a census of every name+particle site found
**zero** counterexamples for the names below.

| Name | Korean reading | Batchim | Particles used in the pack | Evidence |
|---|---|---|---|---|
| Marinara Engine | 마리나라 엔진 | ㄴ | 은 / 이 / 을 / 으로 / 과 (17 / 37 / 24 / 4 / 1) | `CONFIGURATION.md:7` |
| Marinara | 마리나라 | none | 는 / 가 / 를 (209 / 259 / 115) | `CONFIGURATION.md:24` |
| HUD | 에이치유디 | none | **와** (11), 는 (5), 가 (1) — never 과/은/이 | `agents/agents-overview.md:73` |
| Noodle | 누들 | ㄹ | **이** (20), **은** (10) — never 가/는 | `FAQ.md:117` |
| Termux | 터먹스 | none | **를** (15), 가 (7), 는 (5) — never 을/이/은 | `FAQ.md:45` |
| Conversation | 컨버세이션 | ㄴ | 은 (15), 을 (13), 이 (7) | `chats/connected-chats.md:55` |
| Roleplay | 롤플레이 | none | 와 (36), 는 (13) | `roleplay/scenes.md:82` |
| Game Mode | 게임 모드 | none | 는 (23), 가 (7) | `FAQ.md:55` |
| World Maps | 월드 맵스 | none | 는 / 를 / 가 | `agents/hierarchical-maps.md:785` |
| Node.js | 노드제이에스 | none | 와 (6), 가 (5) | `INSTALLATION.md:28,35` |
| Docker | 도커 | none | 와 (4), 는 (2), 를 (1) | `installation/containers.md:10` |

Practical consequence: `Windows와`, `Android와`, `Docker와` (vowel-final readings) but `Noodle은`,
`Marinara Engine은`, `Conversation은` (consonant-final readings).

### What stays English with no Korean at all

Command output, error strings the user must match on screen, file names, env-var names, JSON keys,
and shell commands. Quoted UI text the app does **not** translate stays English inside ASCII double
quotes: `"This parameter is sent to the model"` (`TROUBLESHOOTING.md:129`).

---

## 3. Core terminology

Evidence column gives one pack file that shows the term in use. "Banned alternates" are forms that
must **not** appear as a rendering of that English term; every one listed below was verified at
**0 occurrences** pack-wide in that sense on 2026-09-01.

Two cautions when you re-run this census:

- **A banned form may be a live word in a different sense.** 접속, 갱신, 반영, 시간 제한, 안내 문구,
  복구 and 대화 are all *in use* in the pack with meanings of their own — they are not banned
  outright, only as substitutes for the term in that row. They are listed in
  [§6.4 Deliberate semantic splits](#64-deliberate-semantic-splits), not here.
- **Substring matching produces false hits.** Korean has no word delimiter. A plain `grep` for 램
  returns 52 matches, all inside 프로그램 / 다이어그램 (standalone 램: **0**); 넘기기 returns 2, both
  the verb 넘기다 "to exceed" (`lorebooks/entries.md:207`, `media/comfyui.md:53`), not "swipe"; 다운
  returns 108, all 다운로드 / 다운그레이드 / 드롭다운 / 쇼다운, never "crashed". Anchor the pattern or
  check every hit by hand.

| English | Pack term | Banned alternates | Evidence |
|---|---|---|---|
| prompt | 프롬프트 | 프롬트, 프람프트 | `agents/memory.md:9` |
| prompt preset | 프롬프트 프리셋 | 프리세트, 프리셋트 | `prompts/presets.md:3` |
| preset (noun) | 프리셋 | 사전 설정 | `prompts/presets.md:5` |
| token | 토큰 | 토큰수(closed), 토우큰 | `lorebooks/token-budgets.md:3` |
| token budget | 토큰 예산 | 토큰예산 (closed form banned) | `lorebooks/token-budgets.md:1` |
| lorebook | 로어북 | 로어 북, 설정집, 세계관집 | `lorebooks/overview.md:3` |
| character card | 캐릭터 카드 | 캐릭터카드 (closed form banned) | `characters/creating-and-editing-characters.md:5` |
| chat (the app object — a chat thread) | 채팅 (1,992 uses) | 챗 — **not** 대화, which is a live word in three other senses (§6.4) | `chats/managing-chats.md:1` |
| message | 메시지 | **메세지** | `chats/messages.md:1` |
| swipe | 스와이프 | 스와입, 넘기기 | `chats/messages.md:1` |
| regenerate | 재생성 | 재생산 | `chats/messages.md:1` |
| generate again (distinct concept) | 다시 생성 | — | `game/map-time-weather.md:47`, `settings/settings-overview.md:98` |
| agent | 에이전트 | 대리자, 에이젼트 | `agents/agents-overview.md:3` |
| connection (provider link) | 연결 | 커넥션 — **not** 접속, which is live in the network sense (§6.4) | `connections/connecting-to-a-provider.md:3` |
| AI provider | AI 제공자 | 공급자, 프로바이더 | `connections/connecting-to-a-provider.md:3` |
| persona | 페르소나 | 퍼소나, 인격 | `characters/personas.md:3` |
| NPC | NPC (Latin), first-use gloss `NPC(플레이어가 아닌 캐릭터)` | 엔피씨 | `game/dice-and-skill-checks.md:68` |
| tracker | 트래커 | 트랙커, 추적기(bare) | `roleplay/hud-and-trackers.md:25` |
| launcher | 런처 (91 uses) | **실행 스크립트** (0 uses; see note) | `UPGRADING.md:37,42`, `CONFIGURATION.md:278` |
| start script (the files) | 시작 스크립트 | — (used only for the literal `start.sh`/`start.bat`/`start-termux.sh` trio) | `FAQ.md:9` |
| update (software/package) | 업데이트 / 업데이트하다 | 업뎃 — **not** 갱신, which is live for record updates (§6.4) | `UPGRADING.md:118` |
| apply (an update, a setting) | 적용 / 적용하다 | — **not** 반영, which is live for "takes effect" (§6.4) | `UPGRADING.md:118`, `CONFIGURATION.md:237` |
| release | 릴리스 | **릴리즈** (0 pack-wide; also normalized in `ko.json` by PR #4376) | `connections/local-model.md:60` |
| release channel | 릴리스 채널 | 업데이트 채널, 배포 채널 | `installation/windows.md:201`, `CONFIGURATION.md:237` |
| channel (Discord) | 채널 | 채널방 | `integrations/discord-mirror.md:3` |
| checkout (git working tree) | 체크아웃 | 체크 아웃 — **not** 작업 사본, which is the editor's *working copy* of a map/definition and unrelated to git (12 uses, `agents/hierarchical-maps.md:96`) | `TROUBLESHOOTING.md:39`, `CONFIGURATION.md:238` |
| wake lock | **wake lock** (untranslated English noun) | 웨이크 락, 절전 잠금 | `TROUBLESHOOTING.md:324` |
| battery optimization | 배터리 최적화 (idiom: `배터리 최적화 대상에서 제외`) | 배터리 절약, 배터리 세이버 | `TROUBLESHOOTING.md:326,332` |
| background activity | 백그라운드 활동 | 백그라운드 동작 | `TROUBLESHOOTING.md:332` |
| run in background | 백그라운드 실행 | 후면 실행 | `TROUBLESHOOTING.md:326` |
| foreground | 포그라운드 | 전면 | `TROUBLESHOOTING.md:332` |
| add-on (Termux extras) | 부가 기능 | 애드온(reserved: `Settings → Addons` gloss) | `TROUBLESHOOTING.md:326` |
| Addons (the settings section) | 애드온 | — | `extending/personal-extensions.md:3` |
| memory (RAM) | 메모리 — idioms `메모리에 유지`, `메모리로 올라오다`, `메모리에서 내리다` | 램 (0 standalone; grep hits are 프로그램/다이어그램), 기억장치 | `CONFIGURATION.md:155,156` |
| in-memory | 인메모리 | 인 메모리, 메모리 내 | `development/architecture-map.md:95` |
| load into memory | 메모리로 읽어 들이다 | 메모리에 로드 | `development/file-storage.md:39` |
| Memory Recall (the feature) | `Memory Recall`(기억 회상) — **기억**, kept distinct from 메모리 (RAM) | 메모리 회상 | `agents/memory.md:3` |
| least-recently-used | `가장 오래전에 사용한 것` (no loanword; follows the pack's 오래 idiom) | LRU, 최소 사용 | `CONFIGURATION.md:155`; cf. `chats/managing-chats.md:97` "활동한 지 오래된 채팅" |
| cache | 캐시 | **캐쉬** | `CONFIGURATION.md:322` |
| backup | 백업 | 백엎, 예비 저장 | `data/backup-and-restore.md:1` |
| restore (from a backup/profile) | 복원 | 복구 — live, but for *recovery/repair* (§6.4) | `data/backup-and-restore.md:1,79` |
| snapshot | 스냅샷 | **스냅숏** (the 국립국어원 form — deliberately not used; `ko.json` uses 스냅샷) | `chats/branches.md:26`, `development/architecture-map.md:95` |
| crash | 크래시 / 크래시 복구 | 추락, 다운 | `development/architecture-map.md:95`, `TROUBLESHOOTING.md:330` |
| conflict | 충돌 | 컨플릭트 | `development/file-storage.md:35` |
| frozen (process) | 동결 / 동결된 | 얼어붙은, 프리즈 | `TROUBLESHOOTING.md:330` |
| extension (the feature) | 확장 / 확장 기능 | 익스텐션 | `extending/personal-extensions.md:1` |
| Personal Extensions | `Personal Extensions`(개인 확장) | 개인용 확장 | `extending/personal-extensions.md:3` |
| External Extensions | `External Extensions`(외부 확장) | 외부 확장 프로그램 | `CONFIGURATION.md:57` |
| custom (in prose) | 사용자 지정 (210 uses) | 커스텀 in prose; 맞춤 | `CONFIGURATION.md:31` |
| Custom X (as a UI label gloss) | 커스텀 — **only** when `ko.json` ships 커스텀 for that label | — | `agents/agents-overview.md:29`, `game/hud-widgets.md:11` |
| content | 콘텐츠 | **컨텐츠** | `CONFIGURATION.md:65` |
| data | 데이터 | **데이타** | `data/where-data-is-stored.md:1` |
| directory | 디렉터리 | 디렉토리 | `TROUBLESHOOTING.md:245` |
| context | 컨텍스트 | 콘텍스트 | `agents/approvals-and-agent-suite.md:79` |
| embedding | 임베딩 | 임배딩 | `lorebooks/semantic-search.md:11` |
| asset | 에셋 | 애셋, 자산 | `game/game-assets.md:1` |
| schedule | 스케줄 | **스케쥴** | `conversation/schedules.md:1` |
| webhook | 웹훅 | 웹 훅 | `chats/connected-chats.md:83` |
| checksum | 체크섬 | 체크썸 | `connections/local-model.md:60` |
| profile | 프로필 | 프로파일 | `chats/settings-profiles.md:1` |
| secret (admin/local secret) | 시크릿 | 비밀 키, 암호 | `CONFIGURATION.md:229` |
| access control | 접근 제어 | 액세스 제어 | `FAQ.md:9` |
| timeout (the named setting / env var) | 타임아웃 | — **not** 시간 제한, which is live for an unnamed execution limit (§6.4) | `CONFIGURATION.md:199,201` |
| timed out (the event) | 시간 초과 | 타임아웃됨 | `media/comfyui.md:53`, `TROUBLESHOOTING.md:330` |
| placeholder (field hint) | 플레이스홀더 | — **not** 안내 문구, which is live when prose *describes* the on-screen hint (§6.4) | `characters/personas.md:27`, `chats/connected-chats.md:83` |
| placeholder (substituted token / stand-in) | 자리 표시자 for `{{macro}}`-style tokens | 플레이스홀더 in the `{{macro}}` sense — but see residual **R5**, the ComfyUI/LTX `%token%` docs use 플레이스홀더 | `characters/personas.md:13`, `agents/knowledge-sources.md:63` |
| refresh (noun) | 새로고침 | 새로 고침 (see §7.3) | `FAQ.md:119` |
| refresh (verb) | 새로 고치다 (spaced) | 새로고침하다 in prose | `CONFIGURATION.md:65` |
| preview | 미리보기 | 미리 보기 (0 pack-wide) | `agents/hierarchical-maps.md:297` |
| default (value) | 기본값 (406 uses) | 디폴트 (0 pack-wide) | `CONFIGURATION.md:131`, `media/comfyui.md:167` |
| off (as a default) | 꺼짐 | 끄기, false | `CONFIGURATION.md:156`, `agents/memory.md:118` |
| unset (as a default) | 설정하지 않음 / `…설정하지 않으면` | 미설정, 빈 값 | `CONFIGURATION.md:238,280`, `CONFIGURATION.md:155` |
| unlimited | `0`(제한 없음) — 4 uses | 무제한 — **2 residual uses**, see **R6** | `CONFIGURATION.md:155` |
| selfie | 셀카 | 셀피 | `conversation/selfies.md:1` |
| dice / skill check | 주사위 / 스킬 판정 | 스킬 체크 | `game/dice-and-skill-checks.md:5,68` |

**Note on 런처 vs 실행 스크립트 [recorded ruling]:** the reconciliation pass unified on **런처**;
`실행 스크립트` has 0 occurrences pack-wide. The *outcome* is verified above; the reconciliation
rationale itself is a recorded maintainer ruling (PR #4374, "런처 unification with recorded
rationale"). `시작 스크립트` survives only where the docs literally name the three shipped script
files (`FAQ.md:9`).

---

## 4. Typography & punctuation

All of the following were verified by a full-pack Unicode scan on 2026-09-01 (125 files).

| Rule | Census result |
|---|---|
| **All Latin letters and digits are half-width ASCII.** No full-width forms (`Ａ`, `１`, `（`). | **0** characters in `U+FF01–U+FF5E` |
| **No ideographic space `U+3000`, no NBSP `U+00A0`/`U+202F`/`U+2007`.** Word separation is the plain ASCII space. | **0** |
| **Straight ASCII quotes only** — `"` and `'`. Curly quotes `“ ” ‘ ’` are banned. 1,500 `"` and 53 `'` pack-wide, all straight. | **0** curly |
| **Text is NFC-normalized.** No decomposed Hangul jamo (`U+1100–U+11FF`, `U+3130–U+318F`). | **0** jamo; **0** files fail NFC |
| **Sentence terminator is the ASCII full stop `.`** — no `。`. Every declarative and every imperative ends `습니다.` / `세요.` | pack-wide |
| **Em/en dashes are not a prose device.** 3 occurrences total: 2 as a list-item separator in `agents/custom-agents.md:113-114`, 1 inside a byte-preserved English code span (`lorebooks/entries.md:189`). Prose uses a full stop or a comma instead. | 3 (see §7.3) |
| **Ellipsis:** prose does not use one. The 16 `…` (U+2026) and 101 `...` sites are all **quoted UI strings or code**, reproduced byte-for-byte from the app. The app itself is inconsistent (`en.json` has `Saving…` with U+2026 but `Opening chat...` with three ASCII dots), and the pack mirrors each string exactly. | 16 `…`, 101 `...` |
| **Interpunct `·` (U+00B7)** is used only as a compact separator inside tables and dense enumerations — 4 occurrences on 3 lines. | `INSTALLATION.md:14`, `development/file-storage.md:31` (×2), `agents/hierarchical-maps.md:785` |
| **Numbers are bare ASCII digits** with an ASCII comma as the thousands separator when the English source has one. 23 such numbers pack-wide (`16,384`, `478,000`, `1,000,000`). | `agents/built-in-agents.md:200`, `development/code-cleanup-audit.md:46`, `conversation/table-games.md:109` |
| **Counters attach with no space:** `3개`, `3가지`, `5분`, `15초`. Never `3 개`. Census: 190 `N개`, 96 `N가지`, 32 `N분`, 50 `N초`; **0** spaced. | `FAQ.md:51`, `CONFIGURATION.md:205` |
| **Parenthetical glosses take no space before `(`.** 2,476 Korean glosses, **0** with a leading space. | §5 |
| **Parenthesised amplifications also take no space:** `300000`(5분), `0`(제한 없음), `1800000`(30분). | `CONFIGURATION.md:155,205`, `media/comfyui.md:168` |
| **List mechanics:** `-` for bullets, `1.` for ordered steps. A definition bullet is `- **Label**(gloss): body` or `- **Label** — body`; ordered steps are full sentences ending in `~하세요.` | `INSTALLATION.md:19-20`, `FAQ.md:13-25` |
| **Code fences keep their English info string byte-identical** and their contents are never translated. 12 info strings in use: `bash` (80), `text` (32), `bat` (18), `env` (17), `json` (12), `ts` (10), `css` (9), `html` (6), `yaml` (5), `js` (5), `typescript` (1), `tsx` (1). | `INSTALLATION.md:41`, `CONFIGURATION.md:41` |
| **Tables keep the English source's column count and alignment row**; pipes are written unpadded, matching the existing files' style. | `INSTALLATION.md:9-14` |

---

## 5. UI labels & glosses

**The gloss contract.** A reader may be on the Korean UI or on the English UI. The pack serves both:
the **bold English label** is what the English-UI reader sees, and the **parenthetical Korean gloss**
is what the Korean-UI reader sees.

```
4. **Download Backup**(백업 다운로드)을 클릭하세요.
```
— `UPGRADING.md:24`. Census: **2,486** `**Latin label**(…)` constructions outside code fences, of
which **2,476** have a Korean gloss. The other 10 are English or numeric parentheticals on the same
pattern — `**Default**(17px)`, `**RP**(Roleplay)`, `**Messages per batch**(20)` — which follow the
no-space rule but are not glosses (`appearance/appearance-settings.md:56`, `chats/export-import.md:31`,
`agents/built-in-agents.md:159`).

### Rules

1. **The gloss is byte-exact `ko.json`.** It is copied from the app's shipped Korean string, not
   re-translated. Verified samples: `Save`→저장, `Install`→설치, `Keep`→유지, `Restore`→복원,
   `Admin Access`→관리자 접근, `Download Backup`→백업 다운로드, `Refresh App`→앱 새로고침,
   `Release Channel`→릴리스 채널, `Chat Layout`→채팅 레이아웃, `Add Variable`→변수 추가,
   `Group`→그룹, `Custom Agents`→커스텀 에이전트, `Custom HUD Widgets`→커스텀 HUD 위젯.
   Evidence: `REMOTE_ACCESS.md:190`, `agents/agents-overview.md:25,29`, `FAQ.md:165`,
   `CONFIGURATION.md:229`, `installation/windows.md:201`, `game/hud-widgets.md:11`,
   cross-checked against `packages/client/src/localization/locales/ko.json`.
2. **Gloss fidelity beats prose consistency.** Prose says 사용자 지정 for "custom" (210 uses), but a
   gloss of a label whose `ko.json` string says 커스텀 reproduces 커스텀 — all 7 커스텀 sites in the
   pack are glosses. Evidence: `agents/agents-overview.md:29`, `roleplay/hud-and-trackers.md:25`;
   `ko.json` `Custom Agents`→커스텀 에이전트, `Custom HUD Widgets`→커스텀 HUD 위젯.
3. **Byte-exact means byte-exact, ellipsis included.** `"채팅 여는 중..."` keeps `ko.json`'s three
   ASCII dots; `Uploading…`/`Saving…` keep the app's U+2026. Evidence: `TROUBLESHOOTING.md:330`,
   `characters/creating-and-editing-characters.md:29`.
4. **No space before the paren; no space inside it.** `**Install**(설치)`, never `**Install** (설치)`.
   Verified: **0** spaced glosses in 2,476. A `\*\*[A-Za-z][^*]*\*\* \(` sweep returns 2 hits, both
   **false positives** — `**Mode** (**Merged (Narrator)** / **Individual**)` and
   `**Response Order** (Sequential / Smart / Manual)` at `chats/group-chats.md:111,113`. Those are
   English option enumerations in a table, not glosses. Do not "fix" them.
5. **Gloss once per file, then bare.** After the first glossed mention, later mentions in the same
   file use the bold English alone. Evidence: `agents/custom-agents.md:42` glosses
   `**Custom Agents**(커스텀 에이전트)` on first mention, then uses bare `**Custom Agents**` later in
   that same line and again at `:111` and `:187`.
6. **A label the app does not translate gets no gloss** and stays plain English. Where the English UI
   itself renders the string unbolded, the pack leaves it unbolded too:
   `Support Diagnostics(지원 진단 정보)` is written without bold because the source is unbolded.
   Evidence: `TROUBLESHOOTING.md:330`; cf. `CONFIGURATION.md:242` (`Agents Manager에서`).
7. **Untranslated English UI text quoted in prose sits in straight ASCII double quotes**, unglossed:
   `"This parameter is sent to the model"`. Evidence: `TROUBLESHOOTING.md:129`.
8. **Multi-part gloss uses a comma, not nested parens.** `**Unreachable (request timed out)**(연결할 수 없음, 요청 시간 초과)`.
   Evidence: `TROUBLESHOOTING.md:330`.
9. **Navigation paths.** Two separators are in force — `→` and ` > ` — and **each appears in both
   structural positions**, so neither separator implies a structure. Match whichever the English
   source uses, and keep the source's bolding.

   | Separator | Total | Inside one bold run | Between separate bold labels | Remainder |
   |---|---|---|---|---|
   | `→` | 118 | 63 | 27 | 28 — arrows inside a gloss paren (`(에이전트 → 에이전트 다운로드)`) and 2nd-and-later arrows in a multi-segment run |
   | ` > ` | 94 | 31 | 50 | 13 — **9 CSS child selectors**, not paths; 4 are 2nd-and-later separators in a multi-segment run |

   Examples: `**Agents → Download Agents**(에이전트 → 에이전트 다운로드)` (`agents/built-in-agents.md:3`,
   one bold run); `**Settings**(설정) → **General**(일반) → **Documentation Language**`
   (`UPGRADING.md:13`, separate labels); `**Agents > Download Agents**` (`FAQ.md:175`, one bold run);
   `**Settings**(설정) > **Addons**(애드온)` (`extending/personal-extensions.md:3`, separate labels);
   `**Settings > General > App Behavior > Language**(설정 > 일반 > 앱 동작 > 언어)`
   (`development/localization.md:9`, a four-segment run). The 9 non-path ` > ` hits are
   `.mari-message-avatar > div` selectors in `appearance/card-css-theming.md` — exclude code fences
   and inline code before counting.

**[Recorded ruling] — the `ko.json` feedback loop.** `ko.json` is the authority for glosses, but when
the docs review finds a *bug* in `ko.json`, the fix goes **upstream first and is then mirrored into
the pack** — the pack never inherits a known-bad string. This produced PR #4376 (stale-item labels,
`Mini Mari` de-transcription, 사용자 지정 소스, 재생성 unification, 상세도, and the 릴리즈→릴리스
normalization). The pack's glosses are aligned with the **corrected** strings, which is why #4374 and
#4376 had to land together. The process itself is not observable in the pack.

---

## 6. Language-specific mechanics

### 6.1 Particles after a glossed label — **RULE §A-2**

> **A particle following a `**Label**(gloss)` construction agrees with the batchim of the Korean
> reading of the *English label*, not with the parenthetical gloss.**

This is the pack's single most counter-intuitive rule and the one most likely to be "corrected" by a
well-meaning reviewer. The reader speaks the label, not the gloss.

Minimal pairs — the two halves are exact mirror images of each other:

| Site | Written | Label reading | Gloss | Why |
|---|---|---|---|---|
| `REMOTE_ACCESS.md:190` | `**Save**(저장)를` | 세이브 — no batchim → **를** | 저장 *has* batchim, would take 을 | label wins |
| `agents/agents-overview.md:25` | `**Install**(설치)을` | 인스톨 — ㄹ batchim → **을** | 설치 has *no* batchim, would take 를 | label wins |
| `FAQ.md:165` | `**Keep**(유지)과` | 킵 — ㅂ batchim → **과** | 유지 would take 와 | label wins |
| `CONFIGURATION.md:229` | `**Admin Access**(관리자 접근)로` | 액세스 — no batchim → **로** | 접근 would take 으로 | label wins |
| `agents/knowledge-sources.md:42` | `**Add Agent**(에이전트 추가)를` | 에이전트 — no batchim → **를** | 추가 also takes 를 | agree |
| `appearance/appearance-settings.md:74` | `**Chat Layout**(채팅 레이아웃)은` | 레이아웃 — ㅅ batchim → **은** | 레이아웃 also 은 | agree |
| `lorebooks/entries.md:128` | `**Group**(그룹)과` | 그룹 — ㅂ batchim → **과** | 그룹 also 과 | agree |

Census: the pack has **813** `**Label**(gloss)<particle>` sites (mechanically reproducible — this
figure re-verified on 2026-09-01). On the ~334 of those where the two candidate readings *diverge*,
the English label governs at **318** and the gloss governs at **3** (all `-ble` labels — see §7.3);
the remainder are cases where both readings agree or the reading is ambiguous.

> **Reproducing the divergence split.** Only the 813 total falls out of a regex. Splitting it into
> "diverges / agrees" requires transliterating each English label to Hangul and reading its final
> batchim, so the 334 / 318 / 3 breakdown depends on the transliteration table you use and is **not**
> reproducible by `grep` alone. The three gloss-governed exceptions are individually verified and
> cited in §7.3; treat the aggregate as a considered estimate, not a mechanical count.

**Watch out for the copula.** `**Achievement unlocked**(업적 잠금 해제됨)이고` and
`**RPG Attributes**(RPG 속성)이고` are the copula `이다`, not the subject particle 이/가. The copula
attaches after any noun regardless of batchim and is **not** governed by §A-2. Evidence:
`home/achievements.md:74`, `characters/colors-and-stats.md:58`.

**[Recorded ruling]** The original cycle audited **882** name+particle sites and fixed **63** wrong
particles, then normalized the particle-after-gloss convention across **803** sites (PR #4374). Those
counts are historical and not observable in the shipped pack; only the resulting consistency is.

**Note on the 2026-09-01 mirror-cycle wording.** `prd-notes-ko.md` records "Particles follow the
Korean gloss (…없음)을), per pack precedent." The *output* at that site is correct
(`**Server unreachable**(서버에 연결할 수 없음)을`, `TROUBLESHOOTING.md:330`) because 언리처블 ends in
블 (ㄹ batchim) and 없음 ends in ㅁ — both readings demand 을. The note's **stated rationale is
imprecise**; §A-2 as written above is the operative rule. Future cycles should quote §A-2, not the
note.

### 6.2 Compound spacing

**One spacing per compound** — the in-app docs search is literal substring matching, so a split and a
closed form fragment the index. **[Recorded ruling: the matcher's literal-substring behaviour is an
engine fact from PR #4374, not observable in the pack.]**

| Compound | Form | Census |
|---|---|---|
| refresh (noun) | **새로고침**, closed | 78 closed / 3 spaced (see §7.3) |
| refresh (verb) | **새로 고치다**, spaced | 16 |
| preview | **미리보기**, closed | 55 closed / **0** spaced |
| character card | **캐릭터 카드**, spaced | 96 / 0 closed |
| token budget | **토큰 예산**, spaced | 29 / 0 closed |
| lorebook | **로어북**, closed | 587 / 0 spaced |

The general pattern: a fully lexicalized noun closes (새로고침, 미리보기, 로어북, 웹훅, 퀵타임 in
engineering docs); a noun phrase built from two live nouns stays spaced (캐릭터 카드, 토큰 예산,
릴리스 채널); a **verb** form derived from a closed noun re-opens (`새로고침` → `새로 고치세요`,
`CONFIGURATION.md:65`).

### 6.3 One transcription per term

Every loanword has exactly one spelling, enforced pack-wide. Verified at **0 occurrences** for every
banned form: 메세지, 컨텐츠, 데이타, 릴리즈, 캐쉬, 스케쥴, 스냅숏, 프리세트, 디렉토리, 애셋, 임배딩,
콘텍스트, 프로파일, 트랙커, 스와입.

### 6.4 Deliberate semantic splits

These look like inconsistencies to a bulk-consistency script and are **not**:

| Pair | Split | Evidence |
|---|---|---|
| 플레이스홀더 / 자리 표시자 | a field's on-screen hint vs. a substituted `{{macro}}` token or stand-in content (but see **R5**) | `characters/personas.md:27` vs `characters/personas.md:13` |
| 플레이스홀더 / 안내 문구 | the **placeholder** as a named UI concept vs. prose **describing** the on-screen hint ("the hint reads …"). 14 uses | `characters/personas.md:27` vs `game/dice-and-skill-checks.md:49`, `characters/sprites.md:33` |
| 재생성 / 다시 생성 | "regenerate" (the app action) vs. "generate again/another" — the two ko.json labels `Generate another map` and `Reroll past the newest swipe` deliberately keep 다시 생성 | `chats/messages.md:1` vs `game/map-time-weather.md:47`, `settings/settings-overview.md:98` |
| 메모리 / 기억 | RAM vs. the Memory Recall feature | `CONFIGURATION.md:155` vs `agents/memory.md:3` |
| 크래시 / 충돌 | process crash vs. data or name conflict | `TROUBLESHOOTING.md:330` vs `development/file-storage.md:35` |
| 채팅 / 대화 | the **chat object** (a thread you open, 1,992 uses) vs. 대화 in its three live senses: the `**Conversation**(대화)` mode gloss (43), talking/dialogue in general (67), and `대화 상자` = *dialog box* (6). 대화 is banned only as a rendering of "chat" | `chats/managing-chats.md:1` vs `FAQ.md:53`, `agents/agents-overview.md:7`, `TROUBLESHOOTING.md:294` |
| 사용자 지정 / 커스텀 | prose vs. a `ko.json` label gloss | `CONFIGURATION.md:31` vs `agents/agents-overview.md:29` |
| 부가 기능 / 애드온 | Termux extras vs. the `Settings → Addons` section | `TROUBLESHOOTING.md:326` vs `extending/personal-extensions.md:3` |
| 연결 / 접속 | the **Connection** feature (a saved provider link) vs. *reaching* a host over the network. 접속 has 67 uses and is correct in that sense; `FAQ.md:65` puts both in one sentence: "**연결**은 Marinara가 AI 서비스 한 곳에 **접속**하는 방법을 저장해 둔 것입니다" | `connections/connecting-to-a-provider.md:3` vs `FAQ.md:27,65` |
| 업데이트 / 갱신 | a software or package **update** vs. **updating a stored record** (a lorebook entry, a tracker, a canonical definition). 53 uses, concentrated in `agents/` | `UPGRADING.md:118` vs `agents/custom-agents.md:88`, `agents/built-in-agents.md:214` |
| 적용 / 반영 | *applying* a change (a user action) vs. a change **taking effect / being reflected** somewhere (a result). 64 uses; `CONFIGURATION.md:90` heads a section `## 재시작과 즉시 반영` | `CONFIGURATION.md:237` vs `CONFIGURATION.md:90`, `appearance/custom-css-themes.md:9` |
| 타임아웃 / 시간 초과 / 시간 제한 | the named **setting** vs. the **event** vs. an unnamed server-imposed **execution limit** (custom-tool calls, regex safety). 5 uses | `CONFIGURATION.md:201` vs `media/comfyui.md:53` vs `extending/custom-tools.md:104,168` |
| 복원 / 복구 | user-facing **restore** from a backup or profile vs. **recovery/repair** in general — crash recovery, workspace repair, malformed-JSON repair, broken-reference recovery. 17 uses, broader than crash recovery alone | `data/backup-and-restore.md:79` vs `development/architecture-map.md:95`, `TROUBLESHOOTING.md:67`, `agents/hierarchical-maps.md:699` |

### 6.5 Sentence construction

- **Subject-dropping is the default.** Do not reintroduce a subject to mirror English "you".
- **`~할 수 있습니다`** is the standard capability construction (318 uses).
- **번역투 is out.** Prefer `Marinara는 …합니다` over a passive calque of "X is done by Marinara".
  The QA panels rewrote translationese in the final pass **[recorded ruling — the rewrites are in the
  pack, the review pass is not]**.
- **Link text matches the target's H1, or shortens it.** Measured over the pack's 910 relative `.md`
  links: 768 are exact H1 matches, 129 are a **shortening** of the H1 (`[장면 동영상]` →
  `# 장면 동영상 생성`; `[문제 해결]` → `# Marinara Engine 문제 해결`), and 7 are anchor links that
  correctly name the target *section* instead. Shortening is normal and correct — the rule is that
  link text never **contradicts** the H1. 6 links do diverge; they are residual **R7**. The original
  cycle's claim of "163 mismatches driven to 0" is a **[recorded ruling]** about a different, stricter
  metric and does not describe the shipped pack — do not treat exact-match as the invariant.

---

## 7. QA checks & known traps

### 7.1 Mechanical checks

Run these over `ko/**/*.md` before shipping any change to the pack. Each maps to a rule above.

| # | Check | Expected |
|---|---|---|
| 1 | Full-width Latin/digits `[！-～]`, ideographic space `　` | 0 |
| 2 | NBSP family `[   ]` | 0 |
| 3 | Curly quotes `[‘’“”]` | 0 |
| 4 | Decomposed jamo `[ᄀ-ᇿ㄰-㆏]` | 0 |
| 5 | `NFC(text) == text` for every file | all pass |
| 6 | Banned transcriptions: 메세지, 컨텐츠, 데이타, 릴리즈, 캐쉬, 스케쥴, 스냅숏, 디렉토리, 프리세트, 애셋, 임배딩, 콘텍스트, 프로파일, 트랙커, 스와입 | 0 each |
| 7 | `당신`, `십시오`, `해 주세요`, `바랍니다` | 0 each |
| 8 | Sentence-final `-어요/-아요` and `-ㄴ다.` | 0 each |
| 9 | `미리 보기` (spaced) | 0 |
| 10 | `새로 고침` (spaced noun) | 3 known — see §7.3; any new one is a regression |
| 11 | Gloss with a leading space: `\*\*[A-Za-z][^*]*\*\* \(` | 2 known **false positives** (`chats/group-chats.md:111,113`, English option lists — see §5 rule 4); 0 real |
| 12 | §A-2 particle audit: for every `**Label**(gloss)<particle>`, the particle must match the batchim of the *label's* Korean reading | 3 known exceptions — see §7.3 |
| 13 | Latin-name particle audit: `HUD와/는/가`, `Noodle은/이`, `Termux를/가/는`, `Marinara Engine은/이/을` | no counterexamples |
| 14 | Code fences: info strings and fence bodies byte-identical to the English source | all pass |
| 15 | Heading count and heading order match the English source (`docs/`) | **123 of 125 files match**; `FAQ.md` and `prompts/macros.md` are each one section short — see **R8** |
| 16a | Every relative `.md` link resolves inside the pack | **0 broken** of 910 |
| 16b | Link text equals the target file's H1 **or a shortening of it** | 768 exact + 129 shortened + 7 anchor links naming a section = 904; **6 unexplained**, see **R7** |
| 17 | Every `**Label**(gloss)` gloss appears as a value in `ko.json` | see §7.2 note on ko.json drift; exclude the 10 non-Korean parentheticals listed in §5 |
| 17b | Terms that are banned *in one sense only* (접속, 갱신, 반영, 시간 제한, 안내 문구, 복구) — read every hit, do not bulk-replace | see §6.4 |
| 18 | `node scripts/docs-i18n/validate-pack.mjs` and `manifest.json` sha256/bytes re-hash | pass / 0 mismatches |
| 19 | `pnpm regression:docs` still lists `ko`; `pnpm check` passes | pass |

Checks 18–19 are **[recorded rulings]** from the PR's validation section — they are pipeline steps,
not properties of the text.

### 7.2 Known traps

- **`ko.json` drift is the top gloss regression.** Glosses are byte-exact copies, so any `ko.json`
  value change silently invalidates every doc that quotes it. `ko.json` has already grown from 6,905
  keys (at #4374) to **8,681** as of 2026-09-01. Re-run check 17 whenever `ko.json` moves, and fix
  upstream rather than inheriting a bad string.
- **The `-ble` blind spot.** `Enable`, `Disable`, `Variable` read 이네이블 / 디세이블 / 베리어블 —
  all ending in 블 with a ㄹ batchim, so §A-2 wants 을/은/과. The pack has three sites that instead
  followed the gloss (§7.3). The pack *does* get bare `**Disable**은` right at
  `extending/writing-personal-extensions.md:236`, so the two forms sit in the pack side by side.
  Do not "harmonize" them without a maintainer call.
- **Never reason about batchim from English spelling.** `Game Mode는` (모드, no batchim) and
  `HUD와` (에이치유디, no batchim) both end in a written consonant. Always transliterate first.
- **The copula trap.** `(gloss)이고` / `(gloss)이다` / `(gloss)입니다` are the copula and are exempt
  from §A-2. A naive particle script will flag them; suppress that class.
- **Windows tooling — Hangul and the console codepage.** A Python audit script that prints Hangul
  dies with `UnicodeEncodeError: 'charmap' codec` under the default Windows console codepage. Set
  `PYTHONIOENCODING=utf-8` (or write results to a UTF-8 file) before any census over this pack.
  **[Recorded cycle ruling — observed while re-deriving this glossary on 2026-09-01.]**
- **`\w` does not match Hangul in JS-flavoured regex.** In JavaScript, `\w` is exactly
  `[A-Za-z0-9_]`, so a particle-audit or gloss-audit pattern written as `\*\*\w+\*\*\(\w+\)` matches
  **nothing** on the Korean side and silently reports a clean run. Use an explicit `[가-힣]` class,
  or `\p{Script=Hangul}` with the `u` flag. Python's `re` module *does* treat Hangul as `\w` on `str`
  patterns, so a check that passes in Python and "passes" in Node is the signature of this bug —
  confirm any zero-result sweep against a pattern you know should match.
- **Substring false positives in a Hangul census.** See the caution at the head of §3 for the
  known cases (램, 넘기기, 다운). One more bites the typography checks: `\d 개` returns 1 hit, from
  "v2.3.0 **개**발 주기" — not a spaced counter. Always print the surrounding line before you believe
  a count.
- **Exclude code fences and inline code before counting punctuation.** 9 of the 94 ` > ` occurrences
  are CSS child selectors in `appearance/card-css-theming.md`, not navigation paths (§5 rule 9).
- **PowerShell 5.1 quoting.** Embedded quotes break native-command `-m`-style arguments; write the
  message to a file and pass `-F`. **[Recorded ruling, project-wide.]**
- **The in-app docs search is literal substring matching**, which is *why* one-spelling/one-spacing is
  a hard rule rather than a style preference, and why NFD input silently breaks search.
  **[Recorded ruling from PR #4374; not observable in the pack.]**
- **Do not reflow untouched lines.** Mirror-cycle edits keep the surrounding line wrapping and the
  files' unpadded table pipes intact, so diffs stay reviewable.
  **[Recorded ruling — `prd-notes-ko.md`, 2026-09-01.]**

### 7.3 Known pack residuals

Documented, not silently fixed. Each is a real deviation from a rule above that exists in the pack as
shipped.

| # | Residual | Sites | Rule it deviates from |
|---|---|---|---|
| R1 | `새로 고침` as a spaced **noun** | `agents/built-in-agents.md:190` ("타임라인 새로 고침"), `development/optional-agent-packages.md:95` ("새로 고침 알림"), `extending/writing-personal-extensions.md:236` ("페이지 새로 고침") | §6.2 — the noun should be closed (`새로고침`, 78 sites) |
| R2 | §A-2 followed the **gloss** instead of the label, all three on `-ble` labels | `extending/personal-extensions.md:202` (`**Disable**(비활성화)를`), `game/party-and-npcs.md:46` (`**Enable**(활성화)를`), `prompts/preset-variables.md:29` (`**Add Variable**(변수 추가)를`) | §6.1 — label reading ends in 블 (ㄹ), so 을 is expected |
| R3 | `퀵타임` (closed, 3 sites in `development/`) vs `퀵 타임` (spaced, 2 sites in `game/`) | `development/architecture-map.md:129,154,289` vs `game/combat.md:82`, `game/getting-started.md:114` | §6.2 — one spacing per compound |
| R4 | Em dash used as a prose/list separator | `agents/custom-agents.md:113,114` | §4 — em/en dashes are not a prose device (the third dash, `lorebooks/entries.md:189`, is inside a byte-preserved English code span and is **correct**) |
| R5 | 플레이스홀더 used for a **substituted token**, the sense §6.4 assigns to 자리 표시자 | `game/ltx-2-3-storyboards.md:94,96,98,119,126`, `development/ltx-director-storyboard.md:63,75` | §6.4 — these are ComfyUI/LTX workflow `%token%` slots, i.e. substituted tokens. 자리 표시자 (10 uses) covers only `{{macro}}` tokens; the `%…%` workflow docs consistently say 플레이스홀더. Arguably a *third* sense rather than an error — needs a maintainer call before either is changed |
| R6 | 무제한 instead of `0`(제한 없음) | `lorebooks/token-budgets.md:20,36` ("**0**으로 두면 무제한입니다") | §3 — the 4 `제한 없음` sites are the majority form; both render "unlimited" |
| R7 | Link text that neither matches nor shortens the target's H1 (6 of 910) | `INSTALLATION.md:14` (`Android 설치 가이드` → H1 `Android (Termux) 설치 가이드`, drops "(Termux)"); `extending/personal-extensions.md:11,206` and `extending/writing-personal-extensions.md:3,256` (**the two `extending/` files cross-link each other under names neither H1 uses** — H1s are `개인 확장` and `Personal Extensions 작성`, links say the reverse); `extending/writing-personal-extensions.md:257` (`서버 구성` → H1 `서버 설정 참고 문서`) | §6.5 — the 4-link `extending/` pair is the substantive one; §3 lists `Personal Extensions`(개인 확장), so both names are legitimate but the pairing is inverted |
| R8 | **Two English sections have no Korean counterpart** — content drift, not terminology | `ko/FAQ.md` lacks `## Does each Conversation chat have its own schedule?` (`docs/FAQ.md:63-71`); `ko/prompts/macros.md` lacks `## Lorebook size macro` (`docs/prompts/macros.md:132-138`), so `{{lorebooksize::ID}}` is documented **nowhere in the ko pack** (0 occurrences across all 125 files) | §7.1 check 15 — heading parity with the English source |

None of R1–R7 is search-breaking for a Korean reader typing a whole word, but R1, R3, R5 and R6 do
split the index for those exact strings. Fix them in a dedicated consistency pass, not as drive-by
edits inside an unrelated mirror commit — and settle R5 with a maintainer before touching it, since
the ComfyUI/LTX usage may be a deliberate third sense rather than drift.

**R8 is the only residual that costs a reader information rather than consistency**, and it is the
one to fix first: a Korean reader has no documentation for `{{lorebooksize::ID}}` at all, and no
answer to the per-chat schedule question. Both are ordinary "English source moved on" drift and
should be mirrored in the next cycle. R7's `extending/` pair is worth settling in the same pass,
since both file names are legitimate per §3 and only the pairing is inverted.

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, translate a native NovelAI character caption as
**캐릭터별 설명**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.

# Japanese (`ja`) — Marinara Engine documentation-pack glossary

## Provenance

This is the **second-generation** `ja` glossary. The original working glossary from the
`ja` translation cycle was lost to temp-directory cleanup; nothing of it survives except
the rulings preserved in project memory.

Re-derived **2026-09-01** from, in authority order:

1. **The shipped pack** at `wt-glossaries/ja/` — 125 files, `manifest.json` present, the
   pack as it ships on the `docs-i18n` branch. This is the ground truth. Every terminology
   and typography rule below was re-verified against it programmatically; each row cites a
   pack file (and usually a line) that shows the rule in force.
2. **The pack's shipping PR decision write-up** — `Pasta-Devs/Marinara-Engine` PR **#4345**
   ("Japanese conventions" and "Validation performed" sections).
3. **The 2026-09-01 mirror-cycle notes** — `scratchpad/prd-notes-ja.md`, evidence-backed
   term choices made during the same-day catch-up pass, each with its own pack citation.
4. **The recorded decision ledger** carried in project memory from the original cycle.
5. **The app locale file** `packages/client/src/localization/locales/ja.json`, for
   UI-gloss conventions.

**Rules below are verified against the pack as shipped.** Anything that the pack cannot
demonstrate — process rulings, rationales, maintainer calls — is explicitly tagged
**[recorded ruling]** and carries no in-pack citation. Where the pack contradicts itself,
that is written up in *§8 Known pack residuals* rather than silently normalized.

Counts quoted below (e.g. "534 occurrences") are from the 2026-09-01 re-derivation sweep
over all 125 files. **A bare number is an occurrence count** (every hit, including repeats
on one line); where a line count is meant it says "lines" explicitly. The two differ a lot
for common terms — スプライト is 197 occurrences across 155 lines — so never compare a
number here against a `grep -c`, which counts *matching lines*, not matches.

**Verification status (2026-09-01 review pass):** every count, citation and character-class
claim below was re-run against `wt-glossaries/ja/`. Corrections from that pass are folded in;
rows where the pack turned out to disagree with the previous draft now describe the pack.

---

## 1. Register & address

| Rule | Detail | Evidence |
| --- | --- | --- |
| Body prose is **です・ます** | Polite/distal register throughout; the universal register for Japanese software documentation. `ます。` terminators appear 10,603 times. | `CONFIGURATION.md:7`, `lorebooks/token-budgets.md:5`, `data/where-data-is-stored.md:5` |
| **Zero あなた** | The pack contains **0** instances of `あなた` and **0** of `貴方`. Japanese drops the subject; the reader is addressed by the verb form alone, never by a second-person pronoun. Do not introduce one, even where EN says "you". | whole-pack count = 0 |
| Instructions use **〜てください** | The polite request form is the standard imperative: `てください` 831 + `でください` 119 = **950** request forms (on 875 lines). Never the bare imperative (`しろ`/`せよ`), never plain `〜すること` in body prose. `下さい` in kanji = **0**. | `CONFIGURATION.md:110` 「…を読んでください」, `TROUBLESHOOTING.md:182` 「貼り付け直してください」 |
| Capability is **〜できます** | 633 occurrences. Preferred over 〜が可能です for the conversational-but-polite register the pack keeps. | `chats/slash-commands.md:7` 「Enterでも送信できます」, `lorebooks/token-budgets.md:21` 「**1**から**1000**まで設定できます」 |
| On/off states are **オン/オフ** | Katakana, not 有効化/無効化, when describing a toggle the reader flips (206 occurrences of オンにし/オフにし, on 189 lines). 有効/無効 is reserved for the *state* of a feature or record. | `CONFIGURATION.md:31` 「…をオンにします」, `CONFIGURATION.md:37` 「デフォルトでは無効です」 |
| Plain form (だ・である) only inside quoted fiction | The pack has exactly **3** plain-form sentence terminators, all inside roleplay/lorebook *example* content — never in the pack's own voice. | `lorebooks/entries.md:99-100`, `roleplay/getting-started.md:76` |
| Gender-neutrality | Japanese needs no policy here: the pack uses no gendered pronoun for the reader, and character examples inherit whatever the EN source says. Do not add 彼/彼女 where EN has a name or a role noun. | whole-pack: no reader-directed pronoun |
| `ユーザー` is a **role noun, not address** | 77 occurrences, all referring to a third party or a config concept (`ユーザー名`, 「ユーザー主導の到着」). Never used to mean "you, the reader". | `FAQ.md:14` 「Basic Auth(ユーザー名とパスワード)」, `agents/hierarchical-maps.md:234` |

### Headings

| Rule | Detail | Evidence |
| --- | --- | --- |
| Default heading style is **体言止め** (noun phrase) | Section headings end in a noun, with no verb ending and no 。 | `CONFIGURATION.md:108` 「## アクセス制御」, `chats/messages.md:29` 「## メッセージの編集」, `settings/settings-overview.md:1` 「# 設定の概要」 |
| Plain dictionary-form verbs are allowed where EN is imperative/verbal | Never です・ます in a heading. | `INSTALLATION.md:5` 「## プラットフォームを選ぶ」, `lorebooks/overview.md:63` 「## 最初のロアブックとエントリーを作る」 |
| **FAQ.md keeps question headings** with a half-width `?` | 23 headings across the pack end in `?`; there are **0** full-width `？` in the pack. | `FAQ.md:5`, `FAQ.md:99` 「## キャラクターカードとは?」 |
| **TROUBLESHOOTING.md `###` headings are plain-form symptom clauses**, not 体言止め | This file's own established pattern overrides the 体言止め default; a symptom heading reads as the sentence the user would say. Mirror it when adding sections here. **Not absolute:** 2 of the 29 `###` headings are *task* headings rather than symptoms and correctly revert to the pack default — `:45` 「### ランチャーをpnpm 10.34.5へ更新する」 (dictionary form) and `:143` 「### メンテナー向け: 固定したローカルランタイムのアップデート」 (体言止め). Symptom → plain form; task → default. | `TROUBLESHOOTING.md:157` 「### Memory Recallが何も思い出さない」, `:258`, `:322`, `:328` |
| Headings that name a UI surface stay English | See §3/§6. | `data/backup-and-restore.md:22` 「## Download Backup」, `settings/settings-overview.md:40` 「## App Behavior」 |
| Repeated section titles are **normalized to one spelling** so in-app search indexes them as one term | 「## 関連ガイド」 appears in 117 of 125 files with identical text. | pack-wide heading census |

---

## 2. Product, feature & mode names

| Rule | Detail | Evidence |
| --- | --- | --- |
| **Product names stay in Latin script, frozen** | `Marinara Engine`, `Marinara`, `Noodle`, `Professor Mari`, `Termux`, `Docker`. **0** instances of a katakanized `マリナーラ` anywhere in the pack. | `CONFIGURATION.md:3`, `FAQ.md:119`, `CONFIGURATION.md:25` (Docker) |
| **Particles attach directly** to a Latin name — no carrier noun | 「Marinara Engineでは」, 「Noodleを設定するには」. Never 「Marinara Engineというアプリでは」 padding. | `CONFIGURATION.md:5` 「どんなときにMarinaraを設定するのか」, `FAQ.md:117` |
| **Mode names stay English**: `Conversation`, `Roleplay`, `Game Mode` / `Game` | 850 lines carry one of these bare. Never 会話モード / ロールプレイモード in the docs pack (the *app locale* does translate them — see §6 trap). | `CONFIGURATION.md:205`, `characters/creating-and-editing-characters.md:116`, `chats/slash-commands.md:19` |
| **Agent and package names stay English** | `World Maps`, `Beholder`, `Memory Recall`, `Chat Summary`, `Illustrator`, `Storyboard`, `Agent Suite`, `Card Browser`, `Local Model`. | `agents/built-in-agents.md:163` 「### World Maps」, `agents/built-in-agents.md:119` (Beholder), `agents/memory.md:80` 「## Chat Summary(Roleplay)」, `agents/approvals-and-agent-suite.md:59` |
| **First-mention short-form convention**: `Marinara Engine(以下Marinara)` | Where a guide introduces the full product name and then shortens it. Half-width parens, tight. | `data/where-data-is-stored.md:5` |
| Japanese has no articles — nothing to rule on | The EN article system simply disappears; do not compensate with この/その unless the EN text is genuinely deictic. | — |
| **Feature names that are also common nouns are translated**, not frozen | `lorebook`→ロアブック, `persona`→ペルソナ, `agent`→エージェント; the **bold UI label** for the same thing stays English (`**Persona Editor**`). Prose term ≠ UI label. | `appearance/card-css-theming.md:21` 「ペルソナにも、**Persona Editor**(ペルソナエディター)に同じ欄があります」 |

---

## 3. Core terminology

Half-width parens in the "this pack's term" column show the pack's gloss pattern, not part
of the term.

**How to read the "banned alternates" column.** Every alternate listed was swept pack-wide
on 2026-09-01. An entry means *do not use this word to render this English term*. It does
**not** mean the string is absent from the pack — several of these words are ordinary
Japanese with a different job, and the pack uses them correctly in that other job. Those
cases are marked **"reserved:"** with the sense they carry and their count, so a sweep does
not "fix" correct prose. Alternates with no note are genuinely at **0**. Where the pack
really does contradict its own term, the row says so and §8.3 carries the count and cites.

The 2026-09-01 review found **15** previously-listed "bans" that were category errors — the
listed word is ordinary Japanese doing a different job, and the pack uses it correctly:
静止画 (30), 立ち絵 (22), 発言 (25), 空欄 (10), 無限 (4), 項目 (245), アドオン (4),
World Info (10), まとめ (209), トークン単位 (1), 代理 (1), 人格 (1), 昇格 (9), 予備 (4), and
既定値 (which renders *default*, not *preset*). They are now reservations, not bans.
Acting on them would have collapsed the still-image/video distinction, the sprite gloss, the
group-chat speaker vocabulary, the SillyTavern interop name, and the ordinary word for
"list item". **When a "ban" has hundreds of hits, the rule is wrong, not the pack.**

| English | This pack's term | Banned alternates | Evidence |
| --- | --- | --- | --- |
| prompt | プロンプト (604) | 指示文 (0). **プロンプト文 = 3 residuals**, see §8.3 — but プロンプト**文法** ("prompt grammar", `media/style-profiles.md:71`) is a different word; do not let a substring sweep eat it | `agents/agents-overview.md:17` |
| token | トークン (110) | 字句 (0). *reserved:* トークン単位 (1) is ordinary prose 「トークン単位で決めます」 = "measured in tokens", not a competing term | `agents/agents-overview.md:55`, `chats/slash-commands.md:17`, reserved use at `lorebooks/linking-to-characters.md:101` |
| token budget | トークン予算 (19) | see §8 for the 3 `トークンの予算` outliers | `lorebooks/token-budgets.md:1` 「# ロアブックのトークン予算と再帰」, `lorebooks/token-budgets.md:7` |
| preset | プリセット (201) | プリセット設定 (0). 既定値 is **not** an alternate for this — it renders EN *default*; see the `default` row | `prompts/presets.md:5` 「## プリセットとは」, `agents/custom-agents.md:164` |
| default | デフォルト (608, on 563 lines) | 既定 / 既定値 — 7 residuals, §8.3. The katakana form is the pack's term by a factor of ~87 | `CONFIGURATION.md:31`, `:37`, `:65` |
| lorebook | ロアブック (548) | 伝承, 伝説の書, ローアブック (all 0). *reserved:* **World Info** (10) is **SillyTavern's** name for the same thing and is deliberately kept, in Latin, wherever the pack talks about interop — 「SillyTavernでは「World Info」と呼ばれます」, 「**World Info**ファイル」. Never translate it, and never use it for Marinara's own feature | `FAQ.md:105`, `lorebooks/overview.md:1`. Latin `Lorebook`/`Lorebooks` (122) is reserved for the UI panel/label; reserved World Info uses at `data/importing-from-sillytavern.md:13`, `lorebooks/import-export.md:10`, `lorebooks/overview.md:7` |
| character card | キャラクターカード (90) | キャラカード, キャラ設定ファイル | `FAQ.md:101`, `agents/agents-overview.md:9` |
| chat | チャット (1,909) | 対話 (0). 会話 is *reserved* for the `Conversation` mode concept | `agents/agents-overview.md:9`, `chats/branches.md:7` |
| message | メッセージ (850) | メッセ as slang (0). *reserved:* 発言 (25) is "utterance / who speaks" — it carries the group-chat speaker vocabulary (「発言者の決め方」, 「発言頻度」) and must not be swept into メッセージ. Note メッセ**ンジャー** (7) is a legitimate word a `メッセ` sweep will false-positive on | `chats/messages.md:1` 「# メッセージの操作: 編集、削除、スワイプ、再生成」, `FAQ.md:127`; reserved uses at `chats/group-chats.md:69`, `:120` |
| swipe | スワイプ (99, on 79 lines) | A bare-Latin `swipe` sweep returns **21** hits, of which **20 are correct**: bold UI labels (`**Next swipe**`, `**Jump to swipe 1-N**`), quoted app strings (「Cannot delete the last remaining swipe」), and code-fence identifiers (`swipeIndex`, `message_swipes/`). Exactly **1** is a genuine prose residual — §8.3 #6 | `chats/messages.md:47`, `chats/messages.md:60` |
| agent | エージェント (742) | エージェンシー (0). *reserved:* 代理 (1) is the verb 「別のクライアントを代理している」 = "is proxying for", a networking sense | `agents/agents-overview.md:1`, `FAQ.md:113`; reserved use at `REMOTE_ACCESS.md:150` |
| connection | 接続 (795, on 576 lines) | コネクション, 接続先設定 | `CONFIGURATION.md:18`, `connections/organizing-connections.md:47` |
| provider | プロバイダー (372, on 301 lines) | プロバイダ | `CONFIGURATION.md:18`, `CONFIGURATION.md:251` |
| launcher | ランチャー (48 lines) | 起動ツール, ランチャ | `CONFIGURATION.md:155`, `CONFIGURATION.md:238`, `TROUBLESHOOTING.md:324` |
| update (noun/verb) | アップデート (141 lines) | 更新 as the *product* noun (更新 stays for "refresh"/"renew" senses) | `CONFIGURATION.md:24`, `UPGRADING.md:120` |
| apply (an update) | アップデートを適用する | 更新を当てる, インストールする | `UPGRADING.md:120`, `CONFIGURATION.md:239`, `installation/containers.md:172` |
| upgrade | アップグレード (2) | バージョンアップ (0). *reserved:* 昇格 (9) is "promote" in the World Maps / PRD sense (「生成されたシーンを昇格させる」) and the privilege sense (「権限昇格」) — never "upgrade a version" | `UPGRADING.md:186`, `TROUBLESHOOTING.md:275`; reserved uses at `development/hierarchical-locations-prd-v3.md:531`, `TROUBLESHOOTING.md:417` |
| channel (release) | チャンネル (19 lines) | チャネル, リリース系統 | `CONFIGURATION.md:237`, `TROUBLESHOOTING.md:351` 「チャンネルの切り替え(Stable ↔ Staging)」 |
| checkout (git) | チェックアウト | 作業コピー, クローン先 | `CONFIGURATION.md:238`, `TROUBLESHOOTING.md:39`, `installation/containers.md:24` |
| wake lock | **`wake lock`, bare Latin** | ウェイクロック, 画面ロック解除 | `TROUBLESHOOTING.md:324` 「Androidのwake lockを要求し」. Commands `termux-wake-lock` / `termux-wake-unlock` stay byte-exact in code spans (`TROUBLESHOOTING.md:326`). |
| battery optimization | バッテリー最適化 | 電池最適化, 省電力設定 | `TROUBLESHOOTING.md:326` 「バッテリー最適化の対象から外して」, `:332` |
| background activity | バックグラウンド実行 / バックグラウンドでの動作 | 裏で動かす, バックグラウンド処理 (reserved for server-side background work) | `TROUBLESHOOTING.md:326`, `:332` |
| memory / in memory (RAM) | メモリー / **メモリー上** (32) | メモリ (1 residual, §8.3 #4), RAM上 (0), **常駐** (0 in this sense) | `TROUBLESHOOTING.md:182` 「サーバーのメモリー上にだけ存在し」, `characters/bot-browser.md:116`, `CONFIGURATION.md:155` |
| resident (service/panel) | 常駐 — **reserved for services and UI panels, never for data in RAM** | using 常駐 for chats/records held in memory | `installation/containers.md:10`, `:36`, `extending/personal-extensions.md:23` |
| memory (the *feature*) | 記憶 (96, on 74 lines) — e.g. `**Memory Recall**`(記憶の呼び出し) | メモリー for the feature | `FAQ.md:127`, `TROUBLESHOOTING.md:155` 「## 記憶機能と要約」 |
| cache (noun/verb) | キャッシュ (43) | 一時保存, キャッシング | `CONFIGURATION.md:322`, `TROUBLESHOOTING.md:80`, `agents/approvals-and-agent-suite.md:95` |
| backup | バックアップ (90) | 控え as a term — it appears exactly **once** as a backup noun (`UPGRADING.md:15` 「控えの取り方」) and that is prose, not the term. Of the 11 控え strings, the rest are the unrelated 控えめ ("sparing") and 控える ("note down"). *reserved:* 予備 (4) means "spare / held in reserve" — 「予備のタイムゾーン」 (fallback TZ), 「予備の書き出し」 (alternate greetings), 「小さな予備」 (a pool of prepared posts) | `data/backup-and-restore.md:1`, `CONFIGURATION.md:16`, `FAQ.md:132`; reserved uses at `CONFIGURATION.md:280`, `noodle/settings.md:86` |
| snapshot (data) | スナップショット (100) | 断面 (0). **静止画 is NOT an alternate** — it is the pack's term for a *still image* as opposed to a video clip (30 occurrences, load-bearing across `game/storyboard.md`, `media/scene-video.md`, `characters/sprites.md`). Banning it would collapse the still-vs-video distinction the Storyboard and video docs are built on | `agents/built-in-agents.md:119`, `agents/hierarchical-maps.md:18`, `FAQ.md:145`; 静止画 in its own sense at `game/storyboard.md:59`, `media/scene-video.md:7` |
| checkpoint | チェックポイント (37, on 32 lines) | 中間保存, セーブポイント | `agents/built-in-agents.md:153`, `development/architecture-map.md:89` |
| extension | 拡張機能 (116) | エクステンション (0). *reserved:* アドオン (4) — `Addons` stays English as a UI label, and アドオン is its sanctioned **gloss** (`extending/personal-extensions.md:3` 「**Addons**(アドオン)」); the other 3 are ネイティブアドオン, Node's "native addon" | `CONFIGURATION.md:57` 「### 外部拡張機能(External Extensions)」, `FAQ.md:141`; reserved uses at `extending/personal-extensions.md:3`, `:159` |
| NPC | **`NPC`, bare Latin** (37 lines) | ノンプレイヤーキャラクター, 非操作キャラ. The full form appears **once**, as a first-mention gloss: 「NPC(プレイヤー以外のキャラクター)」 | `game/party-and-npcs.md:1` 「# Game Mode: パーティーとNPC」, `:3` (gloss), `agents/built-in-agents.md:111` |
| persona | ペルソナ (441) | ユーザーキャラ (0). *reserved:* 人格 (1) appears only inside 別人格 glossing the UI label **Inspired alter ego** | `characters/personas.md:1` 「# ペルソナの作成と編集」, `agents/custom-agents.md:65`, `agents/approvals-and-agent-suite.md:59`; reserved use at `noodle/settings.md:28` |
| entry (lorebook) | エントリー (456) | エントリ (0 — but see §8.3 for the trailing-ー residuals in sibling terms). *reserved:* 項目 (245) is the ordinary word for a list item, a form field or a JSON member (「次の項目を順に確認してください」, 「括弧、カンマ、項目を直します」) — it is everywhere and is **not** a competing rendering of lorebook *entry* | `FAQ.md:105`, `lorebooks/entries.md:119`; reserved uses at `TROUBLESHOOTING.md:96`, `:218` |
| folder | フォルダー (378) | フォルダ, ディレクトリ (see §8) | `CONFIGURATION.md:26`, `characters/library-organization.md:68` |
| server | サーバー (534) | サーバ | `CONFIGURATION.md:1` 「# サーバー設定リファレンス」 |
| browser | ブラウザー (181) | ブラウザ | `TROUBLESHOOTING.md:75`, `:80` |
| tracker | トラッカー (63 lines) | 追跡器, トラッカ | `agents/agents-overview.md:19`, `CONFIGURATION.md:206` |
| macro | マクロ (101 lines) | マクロ命令, 置換タグ | `prompts/macros.md:1` 「# プロンプトマクロ」, `agents/custom-agents.md:166`, `characters/personas.md:11` |
| embedding / to vectorize | 埋め込み (106) / ベクトル化 (20 lines) | エンベディング, 数値化 | `CONFIGURATION.md:208`, `agents/knowledge-sources.md:89` (both terms in one line), `lorebooks/semantic-search.md:3` |
| regex / regular expression | 正規表現 (39 lines) | レギュラーエクスプレッション | `extending/regex-scripts.md:7`, `characters/import-export.md:38` |
| slash command | スラッシュコマンド (27, on 23 lines) | `/`コマンド | `chats/slash-commands.md:1` |
| sprite | スプライト (197, on 155 lines) | — . **立ち絵 is NOT banned**: it is the pack's own *explanatory gloss* for スプライト and appears 22 times, including as a heading (`media/animated-expressions.md:28` 「## アニメーション立ち絵をオンにする」). The established pattern is 「スプライトとは…キャラクターの立ち絵です」 — term first, 立ち絵 as the plain-Japanese explanation. Keep both | `characters/sprites.md:76`, `CONFIGURATION.md:213`; gloss pattern at `characters/sprites.md:7`, `agents/built-in-agents.md:85` |
| **branch — chat sense** | **分岐** (152, on 101 lines) | ブランチ for a chat branch. The whole guide is 「# チャットの分岐」 and defines 「分岐とは、選んだ地点までの履歴を共有するチャットのコピーです」 | `chats/branches.md:1`, `:3`, `:7` |
| **branch — git sense** | **ブランチ** (14, on 13 lines) | 分岐 for a git branch | `CONFIGURATION.md:316` 「`docs-i18n`ブランチ」, `UPGRADING.md:141`, `development/localization.md:87` |
| greeting (first message) | 挨拶メッセージ | グリーティング, 初回メッセージ | `FAQ.md:101`, `characters/creating-and-editing-characters.md:73`, `:76` |
| summary | 要約 (116, on 94 lines) | サマリー (0). *reserved:* まとめ (209) is almost entirely the verb/adverbial まとめる・まとめて ("gather", "collectively") — 「変数の一覧はページの後半にまとめてあります」. Do not sweep it; only the *noun* 「まとめ」 meaning a summary is off-limits | `TROUBLESHOOTING.md:155`, `agents/approvals-and-agent-suite.md:7`; reserved uses at `CONFIGURATION.md:3`, `FAQ.md:128` |
| state machine | ステートマシン (2) | **状態機械 / 有限状態機械 (0 in pack)** — carve-out: the loanword wins even in `development/` docs | `development/architecture-map.md:89`, `development/hierarchical-locations-prd-v3.md:27` |
| unset (config default) | 未設定 (24) | 未指定, なし (0). *reserved:* 空欄 (10) is the UI instruction "leave the field blank" (「空欄のままにすると…」) — a thing the reader does to an input, not the config state 未設定 describes | `CONFIGURATION.md:238`, `:213`, `:280` 「`TZ=`のように空にした場合も、未設定として扱います」; reserved uses at `conversation/profiles.md:18`, `conversation/schedules.md:75` |
| unlimited (`0` value) | 無制限 (6) | 制限なし (0). *reserved:* 無限 (4) belongs to fixed technical compounds — 無限クエリー (infinite query), 無限スクロール, 無限ループ — all in `development/` | `CONFIGURATION.md:155` 「`0`(無制限)」, `lorebooks/entries.md:119`; reserved uses at `development/frontend.md:148`, `:251` |
| least-recently-used | 最後に使われてから最も時間が経ったもの | 最も古い / 作成日が古いものから (these render EN *oldest*, a different concept) | `CONFIGURATION.md:155`. **Newly coined 2026-09-01** — see §8. |
| library | ライブラリー (115, on 107 lines) | ライブラリ | `agents/custom-agents.md:24`, `agents/hierarchical-maps.md:424` |
| category | カテゴリー (68) | カテゴリ | `lorebooks/overview.md:39` 「## カテゴリー」, `:41` |
| gallery | ギャラリー (122) | ギャラリ | `characters/galleries.md:73` |
| repository | リポジトリー (51) | リポジトリ (1 residual, §8) | `CONFIGURATION.md:35` 「### 独自のエージェントリポジトリー」 |
| inventory | インベントリー (11) | インベントリ (1 residual, §8) | `agents/custom-agents.md:90` |
| party | パーティー (78) | パーティ (パーティクル "particle" is a different word and keeps its own spelling — `development/frontend.md:265`) | `game/party-and-npcs.md:7` 「## パーティーバー」, `development/architecture-map.md:89` |
| installer | インストーラー (31) | インストーラ | `INSTALLATION.md:26` 「**Windows installer**(Windowsインストーラー)」, `CONFIGURATION.md:275` |
| editor | エディター (203) | エディタ | `FAQ.md:101` 「**Character Editor**(キャラクターエディター)」 |
| parameter | パラメーター (91) | パラメータ | `TROUBLESHOOTING.md:129` |
| computer | コンピューター (177) | コンピュータ | `FAQ.md:7`, `FAQ.md:13`, `data/where-data-is-stored.md:5` |
| container | コンテナー (49) | コンテナ (1 residual, §8) | `installation/containers.md:36`, `data/where-data-is-stored.md:11` |
| filter | フィルター (11) | フィルタ | `lorebooks/entries.md:104` |
| security | **セキュリティ** — documented short-form exception | セキュリティー | `development/personal-extensions.md:5` 「## セキュリティ不変条件」, `development/file-storage.md:33`; 7 occurrences, セキュリティー = 0 |
| community | **コミュニティ** — documented short-form exception | コミュニティー | `FAQ.md:200`, `TROUBLESHOOTING.md:430`; 11 occurrences, コミュニティー = 0 |

---

## 4. Typography & punctuation

| Rule | Detail | Evidence |
| --- | --- | --- |
| **Prose quoting is 「」** | 413 balanced pairs. `『』` = 0. Curly ASCII quotes `“ ”` = 0. | `TROUBLESHOOTING.md:330`, `connections/organizing-connections.md:47`, `UPGRADING.md:164` |
| **Quoted English UI strings inside 「」 stay byte-exact** | Including the label's own ellipsis character and its own internal ASCII quotes. 318 pure-ASCII strings sit inside 「」. | `TROUBLESHOOTING.md:330` 「Opening chat...」 (ASCII `...`, because the app's string uses ASCII), `UPGRADING.md:164`, `agents/built-in-agents.md:254` |
| **Sentence terminator is 。; comma is 、** | 16,667 / 16,606 occurrences. ASCII `.` and `,` are never sentence punctuation in prose. | pack-wide |
| **Parentheses are half-width ASCII `( )`, attached tightly** | 3,551 ASCII parens; only 4 full-width `（ ）` survive (§8). Units and glosses attach with no space: `` `300000`(5分) ``. | `CONFIGURATION.md:205`, `:207`, `agents/agents-overview.md:17` |
| **All Latin letters and digits are half-width ASCII** | 0 full-width alphanumerics pack-wide. Full-width `７８６０` would never match an in-app search for `7860`. | verified programmatically over all 125 files |
| **No ideographic space (U+3000), no NBSP (U+00A0)** | 0 of each. | verified programmatically |
| **All text NFC-normalized** | 0 non-NFC files. Decomposed kana (e.g. `か` + U+3099) silently breaks the docs viewer's substring search. | verified programmatically |
| **No full-width `？` or `！`** | 0 of each; questions use half-width `?`. | pack-wide |
| Thousands separators are ASCII commas | `16,384`, `1,000,000`. Ranges use a half-width hyphen: `128-16,384`, `1-100`. | `agents/built-in-agents.md:200`, `conversation/table-games.md:109` |
| Ellipsis follows the source string | U+2026 `…` (16) where the app's own label uses it (`**Creating backup…**`); ASCII `...` (101) where the app's string does. Never "correct" one into the other. | `UPGRADING.md:27`, `:135` vs `TROUBLESHOOTING.md:330` |
| 中黒 `・` only for genuine list-within-a-word | 14 occurrences, e.g. 「ボール・イン・ハンド」, 「下書き・拡張する」. Not used as a general separator. | `agents/built-in-agents.md:304`, `agents/hierarchical-maps.md:180` |
| Em dash `—` is source-mirrored, not native punctuation | 3 occurrences, all mirroring an EN run-in dash or living inside an English example. Prefer 。/、 or a colon. | `agents/custom-agents.md:113`, `lorebooks/entries.md:189` |
| Range tilde is full-width `～` (U+FF5E) | 7 occurrences: 2 version ranges (`2.3.5～3.x`), 5 numeric/clock ranges (`1～24`, `23:00～07:00`). U+301C `〜` = 0 — do not swap it in. Note the *grammatical* 〜 used in this glossary's own prose (「〜てください」) never appears in the pack. | `agents/hierarchical-maps.md:3`, `:424`, `noodle/settings.md:89`, `:90` |
| Colon in a heading or a run-in label is **ASCII `:` + one space** | | `chats/messages.md:1` 「# メッセージの操作: 編集、削除、スワイプ、再生成」, `chats/messages.md:54` |
| Navigation separators mirror the EN source | Two distinct shapes, and they differ in **where the bold ends**, not just in the glyph. `→` (85 occurrences on 50 lines) sits almost always *inside* one bold span: `**Settings → Advanced → Danger Zone**`. `>` appears as `**A** > **B**` with the separator *outside* the bold (47 occurrences on 28 lines). Only 1 line in the pack uses `**A** → **B**` (`media/image-providers.md:190`). The pack copies whichever the EN line uses — never normalize the glyph, and never move the `**` boundary while doing it. | `CONFIGURATION.md:31` 「**Settings → Advanced → Danger Zone**」 vs `TROUBLESHOOTING.md:161` 「**Chat Settings** > **Memory Recall**」 |
| **List mechanics** | `- ` bullets (3,151) and `1. ` ordered items (1,474), mirroring EN structure exactly. Full-sentence items end in 。; noun-phrase or 〜とき fragment items take no terminator (150 such lines). | `CONFIGURATION.md:11-13`, `agents/custom-agents.md:13-15` |
| Table cells use single-space pipes, no column padding | Matches the EN pack's table format. | `CONFIGURATION.md:155`, `:205-213` |

---

## 5. UI labels & glosses

| Rule | Detail | Evidence |
| --- | --- | --- |
| **UI labels are byte-exact English in bold** | `**Settings**`, `**Review Agent Outputs**`, `**Check for Updates**`. The `ja` UI locale is ~1.4% complete (132 of 9,123 EN keys), so the reader is looking at English chrome. | `packages/client/src/localization/locales/ja.json` (132 keys) vs `en.json` (9,123); `agents/agents-overview.md:49` |
| **Gloss pattern: `**English Label**(日本語)`** — half-width parens, tight, no space | **1,323** `**Label**(` + Japanese glosses pack-wide (on 1,103 lines), out of 1,407 `**Label**(` constructions of any kind — the other 84 open with Latin or a digit. The gloss explains; it never replaces. | `FAQ.md:101` 「**Character Editor**(キャラクターエディター)」, `TROUBLESHOOTING.md:12` 「**Debug mode**(デバッグモード)」, `installation/android-termux.md:19` |
| Multi-step navigation glosses the **whole chain** once | | `CONFIGURATION.md:31` 「**Settings → Advanced → Danger Zone**(設定 → 詳細設定 → 危険な操作)」 |
| **Gloss navigational labels; do NOT gloss status/error strings** | Status and error strings appear bold-English with no Japanese in parens, because the user must recognize the literal string on screen. | `TROUBLESHOOTING.md:330` 「**Server unreachable**と表示し」/「**Unreachable (request timed out)**」; `TROUBLESHOOTING.md:163` 「状態が**Waiting for vector**の場合」; `agents/memory.md:57` |
| Glossed once per section, bare thereafter | After the first gloss in a section the bare `**Label**` is used. | `CONFIGURATION.md:31` glossed → `:37` bare |
| **Full sentences the app renders go in 「」, byte-exact** | | `connections/organizing-connections.md:47` 「Delete "your connection name"? This cannot be undone.」, `UPGRADING.md:133` |
| **6 justified ASCII-quote survivors** | Where the app's own string contains ASCII quotes, those quotes are preserved rather than converted to 「」 — the quotes belong to the app, not to the pack. All 6 live in user-facing guides. **[recorded ruling]** that these 6 are justified; the *count and locations* are verified. **Scope the sweep:** an unfiltered `"` sweep returns 324 quote pairs, ~97% of them JSON/CSS inside fenced code blocks. Strip fences *and* inline code spans first — that leaves **11**: these 6 plus the 5 in §8.3 #7. | `appearance/custom-css-themes.md:29`, `characters/bot-browser.md:85`, `characters/library-organization.md:22`, `:68`, `:93`, `connections/organizing-connections.md:47` |
| An untranslated feature name in running text stays Latin, unbolded | e.g. `Support Diagnostics`, `Agents Manager`, `Marinara Lite`. | `TROUBLESHOOTING.md:330`, `agents/memory.md:78` |
| Term-of-art gloss uses the same paren pattern | `regex`は「regular expression」(正規表現)の略です — the only place 「」+gloss combine. | `extending/regex-scripts.md:7` |
| Code spans, paths, env var names, URLs and link targets are **byte-identical** to EN | Never translate inside `` ` ``; never localize a `#fragment`. | `CONFIGURATION.md:26`, `wt-glossaries/README.md` (branch rule) |

---

## 6. Language-specific mechanics

### 6.1 The boundary-spacing rule (the pack's single most mechanical convention)

**Japanese↔Latin boundaries are tight — no space.** The sweep found **9,789** tight
`Latin→kana` boundaries (on 5,284 lines) and **13** spaced ones, on 13 lines, every one
explained by exception D or E below.

| Boundary | Rule | Evidence |
| --- | --- | --- |
| kana/kanji ↔ Latin word | tight; 9,789 `Latin→kana` + 5,358 `kana→Latin` | `CONFIGURATION.md:3` 「環境変数を使ってMarinara Engineのサーバー側の…」 |
| kana/kanji ↔ **bold** span | tight in **both** directions except the carve-outs below; `[JA] **` = **0 violations**, against 4,040 tight `**`+kana cases | `CONFIGURATION.md:37` 「Danger Zoneで**Allow custom Agent imports**をオンにしたうえで」 |
| kana/kanji ↔ `` `code` `` | tight; `[JA] ` + backtick` = **0 violations**, against 1,895 tight cases (1,208 lines) | `CONFIGURATION.md:26` 「パッケージは`DATA_DIR/capability-packages`の下にあります」 |
| kana/kanji ↔ `[link](...)` | tight; 1,803 cases (1,457 lines) | `CONFIGURATION.md:18` 「…は[AIプロバイダーへの接続](connections/connecting-to-a-provider.md)を参照してください」 |
| 、 or 。 ↔ Latin | tight; 3,047 `、。→Latin` + 727 `Latin→、。` = 3,331 both directions (2,168 lines) | `CONFIGURATION.md:24` |

**Five sanctioned exceptions.** Every one of the 69 `**` → space → Japanese boundaries is
explained by A, B or B′, and they sum exactly: 17 + 51 + 1 = **69**, **0 unexplained**.
Every one of the 13 spaced Latin↔kana boundaries is explained by D or E: 3 + 10 = **13**.

- **A. Bold label with the colon inside the bold** — `**ラベル:** 本文` (**17** cases).
  `CONFIGURATION.md:24-27`, `appearance/card-css-theming.md:52`, `development/code-cleanup-audit.md:3`
- **B. Run-in label terminated by 。 inside the bold** — `**…します。** 続きの文` (**51** cases).
  `characters/bot-browser.md:173`, `characters/galleries.md:79`, `connections/local-model.md:193`
- **B′. Run-in label terminated by 」 inside the bold** (**1** case) —
  `connections/local-model.md:185` 「**「Sidecar runtime install is disabled.」** ランタイムの…」
- **C. Numbered headings** — a leading digit in a heading takes the normal Japanese counter
  with no space (41 headings): `FAQ.md:49` 「## 3つのチャットモードとは?」, `agents/memory.md:5`.
  (This is a *tight* pattern; it is listed here because it looks like a spacing decision.)
- **D. Bare URLs are spaced** (3 cases): `installation/macos-linux.md:22`, `:98`, `:177`
  「ブラウザーで http://127.0.0.1:7860 を開きます」. Spaced on *both* sides at `:98` and `:177`;
  at `:22` the left neighbour is 、 so only the right side is spaced.
  **Rationale [recorded ruling]:** GitHub's GFM autolinker would otherwise swallow the
  adjacent kana into the link, and the app's own `markdown.tsx` does not autolink at all —
  so the space is for the GitHub rendering of the `docs-i18n` branch, not for the viewer.
- **E. Decimal outline numbers in headings** (**10** cases, all in
  `development/code-cleanup-audit.md`): `### 1.1 到達不能なソースモジュール`, `### 6.2 大きく重複したUI領域: …`.
  A dotted section number (`1.1`, `3.2`, `6.3`) is an outline label, not a counter, so it
  takes a space before the heading text. Distinct from exception C — C is 「3つの…」, a
  counter fused to what it counts; E is 「1.1 …」, a numbering scheme sitting beside a title.
  `:82`, `:91`, `:97`, `:103`, `:141`, `:147`, `:177`, `:216`, `:224`, `:231`.

### 6.2 Other mechanics

- **Particles carry the grammar**; the pack never inserts a carrier noun to host a particle
  after a Latin name (`Noodleを`, `Marinaraは`, `**Settings**を`). See §2.
- **Compounds use の sparingly.** The pack prefers a bare katakana compound where the term is
  established (`トークン予算`, `キャラクターカード`, `スラッシュコマンド`) and の where the
  relationship is genuinely possessive (`ロアブックのトークン予算`, `メッセージの操作`).
  `lorebooks/token-budgets.md:1` shows both in one heading.
- **Counters follow the noun, not EN word order**: 「2つのトークン予算」, 「3つのフェーズ」,
  「123件」. `lorebooks/token-budgets.md:7`, `agents/agents-overview.md:13`.
- **No inflection/declension burden** — Japanese has none, so unlike the European packs
  there is no case-ending decision for a frozen Latin product name. This is why the frozen-name
  rule is cheap here and must not be softened.
- **Do not copy the app locale's spacing style.** `ja.json` spaces Latin from kana
  (「Atlas Cloud の API キーを取得」, 「Marinara の上部に Android の時刻」) — the **docs pack
  does the opposite**. **13 of the locale's 132 strings** use the spaced style; every string
  that mixes scripts does. Reading a locale string for a gloss is fine; copying its spacing
  into pack prose is a regression. Evidence: `ja.json` keys
  `connections.mediaSources.atlas.apiKeyLink`, `settings.application.androidStatusBar.help`.
  Note `ja.json` stores **flat dotted keys**, not nested objects — a nested lookup returns
  nothing and will make you think the key is missing.

---

## 7. Process rulings carried forward (no in-pack evidence)

These come from the recorded ledger and PR #4345. They govern how a pack change is made,
not what the shipped bytes look like, so nothing in `ja/` can confirm them.

- **[recorded ruling]** ロアブック was chosen to match the Japanese SillyTavern community's
  established term, so migrating users recognize it. (The spelling is verified in-pack; the
  *reason* is the ruling.)
- **[recorded ruling]** Pipeline for a pack change: translate → structural verify → fix →
  re-verify, then a pack-wide consistency sweep. The original cycle's sweep applied 3,687
  fixes (spacing normalization, link-text↔H1 audit 185→0, 長音符 unification, heading
  normalization).
- **[recorded ruling]** Four independent native-reader QA panels read all 123 files against
  the English source (~160 further fixes), followed by a reconciliation pass that resolved
  every cross-panel conflict — including the quote-delimiter ruling (126 ASCII-quoted UI
  strings → 「」, 6 justified survivors) and the run-in-label spacing unification.
  *(The "123 files" is the original cycle's count. The shipped pack is **125** files today;
  the 2 added since have not been through a native-reader panel.)*
- **[recorded ruling]** The `日本語` label in `docs-languages.ts` must byte-match the
  **Language** dropdown's `Intl.DisplayNames` output; verified by executing the same code
  path, not by inspecting the pack.
- **[recorded ruling]** Bare-URL spacing rationale (GFM autolink vs. `markdown.tsx`) — see §6.1 D.
- **[recorded ruling]** The 6 surviving ASCII quote pairs are *justified*, not residual — see §5.
- **[recorded ruling]** `最後に使われてから最も時間が経ったもの` is a **newly coined** term for
  "least-recently-used", not a reuse. The 2026-09-01 cycle searched exhaustively
  (最近使/最も古い/いちばん古い/最も長く/使われていない/直近/古い順/退避/追い出/LRU/パフォーマンス)
  across all of `ja/` and confirmed **there is no LRU precedent in this pack** — verified twice,
  once in the original cycle and once on 2026-09-01. Nearest neighbours
  (`characters/library-organization.md` 「作成日が古いものから」, `media/tts-setup.md`
  「古いものから自動的に整理されます」) render EN *oldest*, a different concept, and must not be
  reused for LRU. Pin this term for future cycles.

---

## 8. QA checks & known traps

### 8.1 Mechanical checks (run all of these before shipping a `ja` pack change)

Each check below is expressed against the pack directory; all currently pass except where
§8.3 records a residual.

1. **NFC normalization** — every file must satisfy `unicodedata.normalize("NFC", s) == s`.
   Decomposed kana breaks the docs viewer's literal substring search silently. Currently 0/125 failures.
2. **No full-width alphanumerics** — `[０-９Ａ-Ｚａ-ｚ]` must be empty.
   A full-width `７８６０` never matches a search for `7860`. Currently 0.
3. **No U+3000 and no U+00A0.** Currently 0 each.
4. **No full-width `？` / `！`.** Currently 0 each.
5. **Trailing-ー sweep** — for each of サーバー/ユーザー/フォルダー/ブラウザー/プロバイダー/
   エディター/コンピューター/メモリー/パラメーター/コンテナー/インストーラー/リポジトリー/
   ライブラリー/カテゴリー/インベントリー/ギャラリー/バッテリー/パーティー/エントリー/フィルター,
   grep the short form with a negative lookahead on ー. Expected: 0, except the 4 residuals in §8.3.
   **Sanctioned short forms:** セキュリティ, コミュニティ (their long forms must be 0).
6. **Zero あなた / 貴方.**
7. **Boundary-spacing check** — `[kana|kanji] \*\*` must be **0**; `[kana|kanji] ` + backtick must
   be **0**; `\*\* [kana|kanji]` must be explained *only* by a preceding `:`, `。`, or `」` inside
   the bold (currently 17 + 51 + 1 = 69, 0 unexplained). Spaced Latin↔kana must be **only**
   bare URLs or decimal outline heading numbers (currently 3 + 10 = 13). A bare
   "expected: 3" here is wrong and will send you hunting the 10 legitimate
   `development/code-cleanup-audit.md` headings — see §6.1 E.
8. **Link-text ↔ H1 parity, EN-anchored.** For every intra-pack `.md` link: if the *EN* link
   text equals the *EN* target's H1, the *ja* link text must equal the *ja* target's H1.
   Comparing ja link text to ja H1 without the EN anchor produces 127 false positives (EN
   deliberately shortens link text). Currently 3 real failures — §8.3.
9. **Structural parity vs. the EN source at the pack's recorded source commit** — heading
   count, heading levels, link targets (including `#fragments`), and byte-identical code
   fences. **Trap:** running this against current `staging` reports phantom failures
   (`FAQ.md`, `prompts/macros.md`, `TROUBLESHOOTING.md`, `game/ltx-2-3-storyboards.md` all
   diverge today purely because EN moved on — e.g. commit `34ecca6e9` added a macro and
   `93926e69c` added the frozen-server section). Always pin the EN side to the commit the
   pack was built from.
10. **`node scripts/docs-i18n/validate-pack.mjs <path>/ja`** plus a manifest re-hash
    (`build-manifest.mjs`); content and `manifest.json` must be committed together.
    Note the shipped `manifest.json` records only `language` and a 125-entry
    `{path, sha256, bytes}` list — it does **not** carry the source commit, so §8.9's pin
    has to come from the PR/branch history.
11. **Heading-normalization check** — repeated section titles must be spelled identically so
    the in-app search indexes them as one term (「関連ガイド」 ×117 today).
12. **Search smoke test** — query the docs viewer with プロンプト, 接続, ロアブック, 設定 and
    confirm CJK highlight + NFC input matching.

### 8.2 Known traps

- **`grep -P` cannot handle `\x{3000}`-class escapes in this environment** ("character value
  in \x{} is too large") and will report a silent 0. Use Python/`perl` for every Unicode
  class check in §8.1 — a passing `grep -P` here is meaningless.
- **PowerShell's default console encoding (cp1252) cannot print Japanese**; a check script
  that `print()`s matched text will die with `UnicodeEncodeError` rather than report a
  finding. Write results to a UTF-8 file and read that instead. (Reconfirmed 2026-09-01 —
  it still throws.)
- **`\b` and `\w` do not do what you want next to CJK — this silently *undercounts*.**
  A word boundary needs a word char on one side and a non-word char on the other. Python,
  PCRE and Java treat kana and kanji as word characters, so in `Lorebookを開く` there is **no**
  boundary between `k` and `を` and `\bLorebooks?\b` never matches. This is not theoretical:
  during the 2026-09-01 review `\bLorebooks?\b` returned **88** where the true count is
  **122**, and `\bPersonal Extensions?\b` returned **7** where the true count is **18** —
  a 28% and a 61% undercount, both of which would have "confirmed" a wrong residual.
  **Never anchor a Latin-term sweep with `\b` in this pack.** Match the bare string and
  disambiguate with explicit lookarounds instead.
  The mirror-image trap bites in JavaScript, where `\w` is ASCII-only and matches *no*
  kana or kanji at all, so a JS-side `\w`-based boundary check silently passes on
  everything Japanese. The `ru` glossary documents the same class of trap for Cyrillic;
  keep both notes alive, because a checker written once tends to get copied across packs.
- **Katakana substrings collide with longer legitimate words.** A naive sweep for a banned
  short form hits the longer word that contains it: `メッセ` matches メッセ**ンジャー** (7 legit),
  `プロンプト文` matches プロンプト**文法** (1 legit), `パーティ` matches パーティ**クル** (1 legit).
  Every trailing-ー check in §8.1 #5 needs its negative lookahead, and every katakana ban
  needs one too. Verify a "violation" by reading the line before changing it.
- **Occurrence counts and line counts are different numbers, and this file quotes
  occurrences.** `grep -c` reports *lines*. スプライト is 197 occurrences on 155 lines; 接続 is
  795 on 576. Several counts in the pre-2026-09-01 draft of this glossary were line counts
  presented as occurrence counts, which is how the discrepancy was found. State which you mean.
- **Never "fix" an ellipsis or an ASCII quote inside a quoted app string** — those bytes
  belong to the app's own string (§4, §5).
- **Never normalize `→` vs `>`** in navigation chains; mirror EN (§4).
- **TROUBLESHOOTING.md's `###` headings are deliberately not 体言止め** (§1). A well-meaning
  heading sweep will "fix" them into noun phrases and break the file's pattern.
- **Do not translate mode names** (`Conversation`/`Roleplay`/`Game Mode`) in the docs pack
  even though `ja.json` translates them for the UI (§2, §6.2).
- **Do not use 常駐 for data held in RAM** — it is reserved for services/panels (§3).
- **Do not reuse 「古いものから」 for least-recently-used** (§7).
- **Do not "fix" 静止画 into スナップショット.** 静止画 = a still image as opposed to a video clip;
  スナップショット = a captured data state. 30 occurrences across the Storyboard and video guides
  depend on the distinction (§3).
- **Do not "fix" 立ち絵 into スプライト.** 立ち絵 is the pack's plain-Japanese *gloss* for スプライト,
  used 22 times in the established 「スプライトとは…立ち絵です」 pattern and in one heading (§3).
- **Do not sweep 発言 into メッセージ.** 発言 carries the group-chat speaker vocabulary
  (「発言者の決め方」, **Talkativeness**(発言頻度)); メッセージ is the object, 発言 is the act (§3).
- **`swipe` in bold or in 「」 is correct.** 20 of the 21 bare-Latin `swipe` hits are UI labels,
  quoted app strings, or code identifiers. Only `TROUBLESHOOTING.md:260` is a real residual (§8.3).
- **Chat branching is 分岐, not ブランチ.** ブランチ is the git sense only. Reversing these is the
  single easiest way to make `chats/branches.md` read as a version-control document (§3).

### 8.3 Known pack residuals (documented, not silently fixed)

Present in the shipped pack as of the 2026-09-01 re-derivation. Recorded here so the next
cycle can decide; do not quietly change them mid-task.

| # | Residual | Location |
| --- | --- | --- |
| 1 | 4 full-width parens `（）` against the half-width convention | `TROUBLESHOOTING.md:260`, `:275`, `characters/galleries.md:73`, `:89` |
| 2 | `インベントリ` (should be インベントリー) | `agents/built-in-agents.md:145` |
| 3 | `コンテナ版` (should be コンテナー版) | `agents/memory.md:78` |
| 4 | `メモリ` (should be メモリー) | `data/backup-and-restore.md:31` |
| 5 | `リポジトリ` (should be リポジトリー) | `extending/writing-personal-extensions.md:106` |
| 6 | Bare Latin `swipe` in prose where the rest of the pack uses スワイプ. The **only** one of the pack's 21 `swipe` tokens that is not a bold UI label, a quoted app string, or a code identifier | `TROUBLESHOOTING.md:260` |
| 7 | **5** extra ASCII-quoted strings beyond the 6 justified survivors (11 total outside code fences and code spans) — **4** quoted validation-error strings on one line, plus 1 quoted literal value that would be better as a code span | `development/optional-agent-packages.md:83` (×4), `:89` (×1) |
| 8 | Link text `Personal Extensions` vs. target H1 「個人用拡張機能」 (3 links); the pack also splits the term itself — frozen Latin `Personal Extension(s)` ×18 vs. 「個人用拡張機能」 ×9 | `extending/writing-personal-extensions.md:3`, `:256`, `:259`; H1s at `extending/personal-extensions.md:1` and `development/personal-extensions.md:1` |
| 9 | `ディレクトリ` (6) vs `ディレクトリー` (5) — genuinely unresolved. The trailing-ー rule makes ディレクトリー the compliant form; user-facing prose should prefer フォルダー (378) and reserve "directory" for server/CLI contexts | `TROUBLESHOOTING.md:241` vs. elsewhere |
| 10 | `トークン予算` (19) vs `トークンの予算` (3). The compact form is the pack's term; two outliers are in a `development/` PRD, but one is in a user-facing guide | `development/hierarchical-locations-prd-v3.md:784`, `:1115`, **`prompts/macros.md:128`** |
| 11 | One `##` heading in です・ます form against the 体言止め/plain-form heading rule | `home/professor-mari.md:42` 「## アプリ自身のファイルの読み書きもできます」 |
| 12 | `プロンプト文` (3) where the pack's term is plain `プロンプト` (604). One is in a user-facing guide; two are in a `development/` PRD. Do **not** confuse these with `プロンプト文法` ("prompt grammar", `media/style-profiles.md:71`), which is correct | `conversation/profiles.md:53`, `development/hierarchical-locations-prd-v3.md:331`, `:712` |
| 13 | `既定` / `既定値` (7) where the pack's term for EN *default* is `デフォルト` (608). Mixed registers for the same concept; `既定` is the more formal MS-style rendering | `extending/personal-extensions.md:67`, `extending/writing-personal-extensions.md:131`, `:207`, `noodle/settings.md:88`, `:89`, `TROUBLESHOOTING.md:402` |
| 14 | 2 of TROUBLESHOOTING.md's 29 `###` headings are task headings, not symptom clauses, so they follow the pack default instead of the file's plain-form pattern. Arguably correct rather than residual — recorded so a heading sweep does not treat them as misses | `TROUBLESHOOTING.md:45`, `:143` |

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, translate a native NovelAI character caption as
**キャラクターの記述**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.

## Combat handoffs and provider follow-ups (2026-09-18)

Cycle precedent for the new `development/game-combat-ai-design.md`,
`development/game-combat-rulesets-implementation.md`, and
`development/game-combat-difficulty-weather.md` translations:

- Temperament uses **性格**; a ruleset uses **ルールセット**. Keep capability,
  combat role, temperament and controller distinct (AI design, section 3).
- Legendary actions use **伝説的アクション**; triggered reactions use **リアクション**
  (AI design, section 16). Neither means a free ordinary turn or an ordinary
  exchange counterattack.
- Keep policy/class identifiers such as Mindless, Protective, Bruiser, Classic,
  Tactical, Traditional and Counterspell recognizable in Latin script. They name
  specific policies or mechanics; translate the explanations, not code values.
- The source intentionally retains historical audits and proposed future work
  alongside implemented boundaries. Preserve those distinctions and the original
  validation limitations; a translated test report is not a new test run.
- In `media/image-providers.md`, keep fal.ai and endpoint/model IDs unchanged.
  **Test Connection** checks configuration; **Test Image** can incur generation
  charges. In `conversation/selfies.md`, preserve the exact case-insensitive
  marker examples and their Conversation-only scope.

These are documented translation choices from this cycle, not a claim of a new
independent native-reader panel review. Existing pack-wide rules still apply.

## Decision and ruleset catchup (2026-09-24)

| English concept | Translation |
| --- | --- |
| decision statement | 判定文 |
| activation question | 起動質問 |
| wound track | 負傷トラック |

Keep **Decision model**, **Jev**, backend names, and executable statement examples unchanged. Translate their surrounding explanations. Activation questions decide whether an agent runs; statements inside its prompt select the instructions for an agent that is already running. These are translation choices, not a new native-reader review.

## Character Voice tab (2026-10-03)

Glosses for the Character Editor's **Voice** tab (`characters/creating-and-editing-characters.md`, `media/tts-setup.md`). `ja.json` ships only **Preview**(試聴) among these labels, so the rest follow the pack's TTS vocabulary: 声 for a voice, 音声合成 for the **Text to Speech** card.

| English | Translation |
| --- | --- |
| **Voice** (the voice field) | **Voice**(声); the tab name stays unglossed like the other editor tabs |
| **Use a voice per character** | **Use a voice per character**(キャラクターごとの声を使う) |
| **Open Text to Speech settings** | **Open Text to Speech settings**(音声合成の設定を開く) |
| **Connections → Text to Speech** | **Connections → Text to Speech**(接続 → 音声合成) |
| the original of an AU copy | AU版のコピー元 |

The moved **Phonetic name** bullet keeps its (読み仮名) gloss, while `media/tts-setup.md` glosses the same label (読み方). Align them in a consistency pass, not in a mirror commit. These are translation choices, not a new native-reader review.

## Send without wrapper (2026-10-03)

`prompts/presets.md` glosses the **Prompt Block** switch as **Send without wrapper**(囲みなしで送信). `ja.json` has no preset-editor strings, so the gloss follows the file's own wrap vocabulary: 囲み形式 for the wrap format and 囲みなし for unwrapped output. This is a translation choice, not a new native-reader review.

## Noodle post translation (2026-10-03)

`noodle/settings.md` glosses the Noodle **Translation** switch as **Translate posts automatically**(投稿を自動翻訳), on the pattern of **Auto-Translate Responses**(AIの返信を自動翻訳) in `integrations/message-translation.md`. The chat **Translation** setting **Save translator defaults** is glossed (翻訳のデフォルト設定を保存), keeping デフォルト for *default*. `ja.json` has neither string. **Translate** and **Translation** keep (翻訳), and Google Translate stays Latin. These are translation choices, not a new native-reader review.

## Professor Mari, Search, Re-scan scenes and onboarding (2026-10-11)

Choices from the #7382, #7396, #7372 and #7309 sync. `ja.json` has none of these labels, so the glosses are coined here.

| English | Translation |
| --- | --- |
| permissions mode (prose) | 権限モード. The capitalized `Permissions Mode` that EN keeps in `development/optional-agent-packages.md` stays as it is |
| change card (Professor Mari) | 変更カード |
| quick answer (Search) | クイック回答 |
| Search (the `Cmd/Ctrl+K` search) | Latin `Search` in prose, glossed once as **Search**(検索). Unbolded "the Search and Professor Mari settings" is SearchとProfessor Mariの設定; the bold label is **Search and Professor Mari settings** |
| **Aware of** | **Aware of**(把握している内容) |
| handoff (context sent to Professor Mari) | 引き継ぎ |
| held change | 保留中の変更 |
| sensitive file (change) | 影響の大きいファイル |
| fail closed | フェイルクローズ, as already used in `development/personal-extensions.md` |
| extension ID | 拡張ID |
| Command Center | Latin, not translated |
| **Show "older messages not sent" note** | **Show "older messages not sent" note**(「送信されなかった古いメッセージ」の注記を表示). The label keeps its ASCII quotes |
| scene check (Advanced Memory) | シーン確認. Replaces シーン終了チェック; "scene starts" is シーンの開始位置 |
| **Re-scan scenes** / **Re-scan** | **Re-scan scenes**(シーンを再スキャン) / **Re-scan**(再スキャン); heading シーンの再スキャン |
| interactive onboarding | 対話式オンボーディング (the H1 of `characters/interactive-onboarding.md`, its link text, and the gloss for **Interactive onboarding**) |
| **Create your persona** / **Create persona** | (自分のペルソナを作る) / (ペルソナを作成). These are kept apart on purpose |
| **Undo** / **Put back** | (元に戻す) / (戻す) |
| **Try again** / **Retry** | (もう一度試す) / (再試行). 再試行 matches `ui/ja.json` `chat.help.targets.retry.title` |
| blanks in a persona template | 空所. 空欄 stays reserved for "leave the field blank" |
| out-of-character POV note | POV(視点)を示すキャラクター外の注記, following 「キャラクター外の注記」 for *out of character notes* in `extending/regex-scripts.md` |

Bold labels such as **Ask Prof. Mari**, **Prof. Mari**, **Continue with Prof. Mari** and **Same as Prof. Mari** stay byte-exact. Prose that EN renamed from "Mari" to "Professor Mari" follows, and Mariチャット becomes Professor Mariのチャット. The heading **Quick answers in Search** stays English because it is also the toggle's name, following the UI-surface heading rule. These are translation choices, not a new native-reader review.

## Game HUD sections and Advanced Memory setup (2026-10-14)

Choices from the #7604 and #7595 sync (`appearance/appearance-settings.md`, `appearance/custom-css-themes.md`, `agents/memory.md`).

| English | Translation |
| --- | --- |
| combat panels (Game Mode) | 戦闘画面のパネル, after 戦闘画面 in `game/combat.md` |
| the Inventory (Game panel) | インベントリー; the bold label keeps **Inventory**(インベントリー) |
| the Journal (Game panel) | Latin `Journal` in prose, as in `extending/writing-rulesets.md` |
| logs / choices / dialogs (Game) | ログ / 選択肢 / ダイアログ |
| maximum allowed context (prose) | 最大許容コンテキスト |
| older context is cut off | 古いコンテキストが切り捨てられ |
| excerpt (Advanced Memory) | 抜粋, defined as 呼び出したシーンのメッセージをそのまま抜き出したもの |

These are translation choices, not a new native-reader review.

## Character recollections (2026-10-14)

Choices from the #7605 sync (`agents/memory.md`). `ja.json` has no recollection strings, so the gloss is coined here.

| English | Translation |
| --- | --- |
| character recollection(s) | 回想. The switch is **Character recollections**(キャラクターの回想), and the setup sentence's link text is キャラクターの回想. 記憶 stays the word for the memory feature and for recalled memories (§3), so it is not used for a recollection. In `roleplay/scenes.md:7` and `roleplay/getting-started.md:156`, 回想 means a flashback scene, which is a different sense |
| personal recollections | The prompt line `Kaito's personal recollections from this scene: *…*` stays English in its code span. In prose, a character's own recollection is 自分の回想 |
| `### Character recollections` (heading) | Stays English, because it names the switch (the UI-surface heading rule, like **Quick answers in Search**). Its anchor stays `#character-recollections`, so it needs no `<a id>` |
| copy check (four words in a row) | 照合. The prose is 4語続けて写した回想 |
| knowledge start | 知識範囲の始まり, after 知識範囲 for a knowledge range |
| first person | 一人称 |
| the Helper's room for the scene | 補助モデルがそのシーンに使える容量 |
| merged reply | まとめた返信, after まとめて返信するグループチャット |
| **Prepare** | **Prepare**(準備), after **Prepare existing history**(既存履歴を準備) |
| **Writing character recollections**, **Manually edited** | App status strings (a progress stage and a badge), so they stay unglossed |

Labels already glossed earlier in the file get their gloss again at their first mention in this section, following the once-per-section rule: **Narrator**(ナレーター), **Decide who sees new messages**(新しいメッセージを見られる相手を決める), **Hide from AI**(AIから隠す), **Resume**(再開), **Summary and recall budget**(要約と呼び出しの予算), **Re-scan scenes**(シーンを再スキャン). These are translation choices, not a new native-reader review.

## TTS emotion indicators (2026-10-17)

Choices from the #7763 sync (`media/tts-setup.md`) against `staging` `5ae55e73`. The labels have no shipped Japanese UI strings, so the glosses are coined here.

| English | Translation |
| --- | --- |
| **Roleplay speaker extractor** | **Roleplay speaker extractor**(Roleplayの話者抽出) |
| **Enable emotion indicators** | **Enable emotion indicators**(感情表現の指示を使う) |

These are translation choices, not a new native-reader review.


## Agent Organizer

Use the English UI label **Agent Organizer** for the renamed official agent store.

## Mari question card, queued messages, to-do list and Automate active characters (2026-10-31)

Glosses follow the shipped `ui/ja.json` strings: **Send now**(今すぐ送信), **Queue for later**(あとで送るためにキューに入れる), **Sends when she finishes**(完了したら送信されます), **Plan from before your last message**(直前のメッセージより前のプラン), **Automate active characters**(アクティブなキャラクターを自動化). **Held**(保留中) is the head of the shipped `mari.queue.held` tooltip. **2 of 5** is glossed (5件中2件), the shipped count format. **Still working**, **Submit** and **X** run unglossed.

| English | Translation |
| --- | --- |
| question card (Professor Mari) | 質問カード |
| waiting message / queue | 待機中のメッセージ / キュー |
| her to-do list | Professor Mariのやることリスト, after the shipped label |
| pin (Automate active characters) | ピン留め, as in the **Pin** gloss; "pins" lead-in is **ピン留め。** |
| name aliases (Character Tracker) | 別名, after `/ttt` (別名) in `agents/built-in-agents.md` |
| link text for the setting | アクティブなキャラクターの自動化 (the noun form of the shipped label) |

The new `###` sections gloss their labels once each, per the once-per-section rule. These are translation choices, not a new native-reader review.

## Connections redesign and HTML artifacts (2026-11-01)

Choices from the #8464 and #8603 sync (16 guides; `connections/connecting-to-a-provider.md` and `connections/organizing-connections.md` were rewritten) against `staging` `6d96cf919`. These glosses follow shipped `ui/ja.json` strings for the same English text: **Main**(メイン), **Model for this chat**(このチャットのモデル), **Pictures & sound**(画像と音声), **HTML Artifacts**(HTMLアーティファクト), **Connect**(接続), **Done**(完了). The rest have no shipped Japanese string, so they are coined here; recheck them when `ui/ja.json` gains the `connections.*` keys: **Jobs**(役割), **Model for**(役割に使うモデル), **Shuffle**(シャッフル), **Address**(アドレス), **Starred**(星付き), **Star**(星を付ける), **Add account**(アカウントの追加), **Edit account**(アカウントの編集), **Start chatting**(チャットを始める), **Follow Main**(メインに従う), **Make it my Main model**(これをメインのモデルにする), **If it fails**(失敗したとき), **Usage and balance**(使用量と残高), **Show the usage meter on the card**(カードに使用量メーターを表示).

| English | Translation |
| --- | --- |
| account (one key, sign-in or address) | アカウント. 接続 still renders *connection* where EN keeps that word (`FAQ.md`, `chats/chat-settings.md`, `home/welcome.md`) and in the panel name **Connections**(接続); *service* is サービス |
| job (a role in the **Jobs** box) | 役割; heading 役割ごとのモデルを選ぶ with `<a id="choosing-the-model-for-each-job">`. Concurrency is not a role: **Parallel jobs**(同時に実行する処理の数), **Max Parallel Agent Jobs**(エージェントの最大並列ジョブ数) |
| Main, Shuffle, Jobs in prose | Latin: Mainのモデル, Shuffleに追加, Jobsボックス. `## Shuffle` stays English (the UI-surface heading rule), so `#shuffle` resolves with no `<a id>` |
| random pool, Quick Connection Switcher | Retired with the EN features. Shuffle replaces them; `<a id="the-random-pool-and-quick-connection-switcher">` is removed and its links now point at `#shuffle` or `connecting-to-a-provider.md#choosing-a-model-for-one-chat`. ランダム stays for unrelated senses and in guides EN did not change |
| choosing a model for one chat (heading) | 1つのチャットで使うモデルを選ぶ, with `<a id="choosing-a-model-for-one-chat">` |
| Address, Endpoint, Base URL | **Address**(アドレス) is the account field; `connections/local-self-hosted.md` glosses it **Address**(Base URLとも呼びます) after EN "also called the Base URL". **Endpoint**(エンドポイント) is the image-generation connection's field (`media/image-providers.md`); the local-self-hosted table header is plain エンドポイント. Base URL stays Latin for the concept, bold only where EN bolds it |
| step 1/2/3 (**Add account** window) | ステップ1/2/3, tight, as in the existing ステップ1 headings |
| **Make … my Main** / **Make ... my Main** | The label keeps its source ellipsis (U+2026 in `connections/connecting-to-a-provider.md`, ASCII in `FAQ.md` and `chats/managing-chats.md`); the gloss is (…をメインにする) in all three |
| **Behind the scenes** | **Behind the scenes**(裏方の処理), after 裏方の処理 in `agents/custom-agents.md`. `ui/ja.json` ships 裏方 for the same EN string in the settings-profile builder; recheck when `connections.defaults.group.background` ships |
| **Import account** | **Import account**(アカウントのインポート). `ui.panels.connectionspanel.importConnection` still ships 接続をインポート, which does not match the current EN label |
| artifact (in-world HTML) | アーティファクト; heading オンデマンドのアーティファクト with `<a id="artifacts-on-demand">`. `development/optional-agent-packages.md` already uses the word for a package artifact; keep both senses. The marker is 「used html command」のマーカー, byte-exact in 「」 |
| Shared connection picker (heading) | 共有の接続ピッカー, after the pack's existing ピッカー. The user guides say **Model for**の選択画面 for the **Model for** picker |

Two glosses differ from shipped strings; align them in a consistency pass, not in a mirror commit: **Documents**(ドキュメント) against 文書 (`roleplay.commands.document.label`), which would also keep it apart from **Documentation**(ドキュメント) in `FAQ.md`, and **Max Parallel Agent Jobs**(エージェントの最大並列ジョブ数) against エージェントの並列ジョブの最大数 (`ui.connections.connectioneditor.maxParallelAgentJobs`). Status strings and badges stay unglossed: **Follows Main**, **follows Main**, **This chat only**, **Off**, **Choose a model**, **Needs key**, **Needs an image model**, **Connected**, **Custom settings**, **Plan**, and **No key needed. Marinara uses the login on this computer.** The **Decision** row also stays unglossed, like **Decision model** (2026-09-24). In the two rewritten guides, some labels glossed earlier appear bare at their first mention in a later section (**Jobs**, **Main**, **Add account**, **More actions** and others); gloss them in a consistency pass. These are translation choices, not a new native-reader review.

## Faceted sprites, GLB/FBX avatars and profile pickers (2026-11-01)

Precedents from the #8654 / #8657 catch-up against Engine `staging` `7450d4e70` (`characters/sprites.md`, `agents/avatars.md`, `agents/built-in-agents.md`, and the #8646 profile-builder bullets in `chats/settings-profiles.md`). Shipped `ui/ja.json` glosses: **Avatar type**(アバターの種類), **Faces and mouth shapes**(表情と口の形), **VRM model**(VRMモデル), **Tools**(ツール). Coined here, so recheck them when `avatars.glbFbx.*`, `avatars.setup.kind.glbFbx`, `chat.settingsProfile.builder.clear` and `chat.settingsProfile.builder.none` ship: **GLB or FBX model**(GLBまたはFBXモデル), **Import GLB or FBX**(GLBまたはFBXをインポート) after the shipped `avatars.vrm.import` (VRMをインポート) and `avatars.mmd.import` (PMXまたはZIPをインポート), and **Clear selection**(選択をクリア) and **None**(なし), both taken from shipped sibling keys with the same English (`ui.*.clearSelection`, `avatars.vrm.expressions.none`). **Embed Media** and **Embed Textures** are FBX exporter options in other 3D apps, so they stay unglossed, like Blender's **Preferences**.

| English | Translation |
| --- | --- |
| extra words after the expression (faceted sprite name) | 表情名の後に足す単語; outfit or condition is 衣装や状態, a sprite's full name is 完全な名前, and "the last word is dropped first" is 最後の単語から先に外されます. A trailing `_01` is still 別バージョン, as in the existing variant sentence |
| rigged / to rig | リグ入りの / リグを入れる, after the mesh-avatar wording in `agents/avatars.md`. Heading GLBとFBXのアバター: リグ入りのモデル with `<a id="glb-and-fbx-avatars-rigged-models">`; link text GLBとFBXのアバター |
| bone, matched by name | ボーン (as in 「VRMが必要とするボーン」 in the same file), 名前で対応付ける |
| blend shape / shape key / morph target | ブレンドシェイプ / シェイプキー / モーフターゲット |
| A-pose | Aポーズ, tight like the existing Tポーズ |
| hips / spine / upper and lower arms | 腰 / 背骨 / 上腕と前腕 |
| binary / ASCII (file format) | バイナリー形式 / ASCII形式; バイナリー keeps the trailing ー (§3) |
| the model's own physics | 物理演算, as in the MMD section |
| multi-select with Ctrl (Command) | Ctrl(macOSではCommand)を押したまま選ぶ; the phone's selection controls are 選択用のコントロール |
| library sidebar | ライブラリーのサイドバー |
| slot / field (profile builder) | スロット for a builder slot; フィールド for a drop target, after the shipped `chat.settingsProfile.builder.libraryHint` (項目をフィールドにドラッグ). A single-item field is 1つしか選べないフィールド |

The new `##` section glosses its labels once, including **Avatar type**, **Faces and mouth shapes** and **VRM model**, which are glossed earlier in the file. Its run-in **対応ファイル。** takes a space (§6.1 B), although the MMD paragraph above it is tight. "Waiting poses" is 待機中のポーズ, as in the performance section. The MMD paragraph's older **Import PMX or ZIP**(PMXまたはZIPのインポート) differs from the shipped `avatars.mmd.import` (PMXまたはZIPをインポート); align it in a consistency pass, not in a mirror commit. These are translation choices, not a new native-reader review.

## Scoped regex in favorite layouts, embedding test and the Termux upgrade (2026-11-02, #8681)

Precedents from the #8681 catch-up against Engine `staging` `db2d6ead7` (`lorebooks/semantic-search.md`, `chats/chat-settings.md`, `chats/settings-profiles.md`, `extending/regex-scripts.md`, `installation/android-termux.md`, `TROUBLESHOOTING.md`). Shipped `ui/ja.json` glosses for the same English: **Advanced**(詳細設定) (`settings.tabs.advanced.label`), **More**(その他) (`navigation.topbar.more`), **Use preset default**(プリセットのデフォルトを使用) (`chat.settings.regex.usePreset`), **Scoped regex default**(範囲限定の正規表現のデフォルト) (`presets.regex.defaultMode`) and **Reset View**(表示をリセット) (`chat.settings.resetView`). The connection editor's own `connections.editor.section.advanced` and `connections.editor.more` have no ja value yet, so recheck **Advanced** and **More** when they ship. **Built-in model**(内蔵モデル) reuses the 2026-11-01 gloss.

Coined here: **Test embedding**(埋め込みをテスト), after **Test Video**(動画をテスト) and **Test decisions**(判断をテスト), because `connections.embeddingTest.*` has no ja value. **Embedding provider**(埋め込み用のプロバイダー) and **Same as this provider**(このプロバイダーと同じ) replace **Embedding Connection**(埋め込み用の接続) and **Same as this connection**(この接続と同じ) in `lorebooks/semantic-search.md`. `ui.connections.connectioneditor.embeddingConnection` and `sameAsThisConnection` still ship 埋め込みの接続 and この接続と同じ, which were written for the English before the rename, so they are not reused (as with **Import account**, 2026-11-01). Recheck both when those keys are retranslated.

| English | Translation |
| --- | --- |
| **Semantic search (embeddings)** | Keeps the file's gloss (埋め込みによるセマンティック検索) at its one glossed mention; the shipped value is セマンティック検索(埋め込み). The heading `## Semantic search (embeddings)パネル` keeps the Latin label (UI-surface heading rule) |
| a chat's Scoped Regex Scripts mode (prose) | Scoped Regex Scriptsのモード, Latin and unbolded as in the existing heading チャットごとのScoped Regex Scripts設定 |
| the per-script switch is global | このスイッチはスクリプト自体のもの…すべてのチャットでそのスクリプトが変わります |
| favorite layout star | お気に入りレイアウトの星, after **Favorite layout**(お気に入りレイアウト) in `chats/chat-settings.md` |
| default settings profile (link text) | デフォルトの設定プロファイル |
| upgrade all Termux packages | Termuxのすべてのパッケージをアップグレード; "upgrading only some packages" is 一部のパッケージだけをアップグレードする使い方. The `android-termux.md` colon ("…only some packages: a newer Node.js cannot start…") is joined as 対応しておらず、新しいNode.jsは…起動できません, not as a ためです reason clause, which would make the Node.js failure the cause of Termux's policy. 更新 stays for the updated launcher (更新されたTermuxのランチャー) |
| configuration file / press Enter to keep it | 設定ファイル / Enterキーを押して今の設定ファイルを残してください |
| Termux libraries | Termuxのライブラリー (trailing ー, §3) |

New anchors: `<a id="the-per-chat-scoped-regex-scripts-setting">` above `### チャットごとのScoped Regex Scripts設定` and `<a id="choosing-the-default-profile">` above `## デフォルトのプロファイルを決める`, because new English links in `chats/chat-settings.md` and `extending/regex-scripts.md` target those fragments. The new `TROUBLESHOOTING.md` heading is `### Termux: 「CANNOT LINK EXECUTABLE "node"」と表示される`, a plain-form symptom clause like the 「Ignored build scripts: @google/genai」 heading; the error text keeps its ASCII quotes inside 「」. Nothing links to it, so it has no `<a id>`. **Could not verify that this Marinara Android build can safely read your stored data** is a status string and stays unglossed. **Install / Start Marinara**(Marinaraのインストール/起動) is glossed once in the new section.

Two glosses now differ from older pack glosses; align them in a consistency pass, not in a mirror commit: **Scoped regex default** is (スコープ付き正規表現のデフォルト) in `prompts/presets.md`, and **Scoped Regex Scripts** stays (範囲を限定した正規表現スクリプト) in `extending/regex-scripts.md` against the shipped 範囲限定の正規表現スクリプト. These are translation choices, not a new native-reader review.

## GPT Image 2.6 and animated GIFs (2026-11-05, #8872)

Choices from the #8872 sync (`media/image-providers.md`, `development/optional-agent-packages.md`) against Engine `21da93b590`. **Image quality**(画質) and its option **Max**(最大) follow the shipped `ui.connections.connectioneditor.gptImageQuality` and `imageQualityMax`; `prompts/generation-parameters.md` leaves its **Max**/**Maximum** option lists unglossed, so align them in a consistency pass, not in a mirror commit.

| English | Translation |
| --- | --- |
| still / still picture (as opposed to a GIF) | 静止画, the same still-vs-motion term as §3 |
| looping GIF / animated GIF | ループするGIF, ループGIF (after `media/animated-expressions.md`); heading アニメーションGIF画像 |
| frame / frame count / frame length / frame size | フレーム / フレーム数 / フレームの長さ / フレームサイズ |
| fallback connection | フォールバック接続 |
| queue slot / paid call | キューの枠 / 料金のかかる呼び出し |

The three GIF refusal and failure messages are app strings and stay byte-exact English in 「」. These are translation choices, not a new native-reader review.

## ComfyUI authenticated proxy (2026-11-06, #8854)

Precedents from the #8854 mirror of #8844 (`media/comfyui.md`), drafted against #8844 head `fbd9ca8821`:

- **Custom Request Headers**(カスタムリクエストヘッダー) matches the shipped `ui/ja.json` `settings.connection.customHeaders.label` and the pack's カスタム, リクエスト and ヘッダー. **Video defaults** keeps the pack's (動画のデフォルト設定) from `media/scene-video.md`, not `ja.json`'s 動画のデフォルト.
- The heading is `## 認証付きプロキシを使う`, a plain-form verb like `## 参照画像を使う`, with `<a id="use-an-authenticated-proxy">` above it. The link text in step 2 and in the Troubleshooting row is 認証付きプロキシを使う.
- a proxy in front of ComfyUI: ComfyUIの手前にあるプロキシ. non-secret headers: 秘密情報を含まない追加のヘッダー; secrets: 秘密情報, after `home/professor-mari.md`. An auth scheme such as `Basic ...` is 認証スキーム, to keep it apart from the URL スキーム in `connections/decision-models.md`.
- The new section and the Troubleshooting row gloss their labels again, per the once-per-section rule; the **Warning:** callout uses them bare.

These are translation choices, not a new native-reader review.

## Music DJ folders per chat and character (2026-11-07, #8913, #8931)

Precedents from the #8913 and #8931 mirror (`media/music.md`, `game/game-assets.md`, `connections/decision-models.md`), against Engine `d055e94915`:

- **Shipped glosses**, byte-exact `ui/ja.json`: **Chat Settings**(チャット設定), **Choose Folder**(フォルダーを選択), **Music folder on this device**(この端末の音楽フォルダー), **Apply to**(適用対象) (`spriteLayoutApplyTo`) and **This chat**(このチャット) (`generationParameters.source.chat`).
- **Coined**, because `ui/ja.json` has no value for these keys yet (recheck when they ship): **All chats (default)**(すべてのチャット、デフォルト), **Use default**(デフォルトを使用), **Unlink from**(リンクを解除), **Reinstall**(再インストール) and, in `game/game-assets.md` only, **Default music folder on this device**(この端末のデフォルトの音楽フォルダー). The `media/music.md` Off bullet keeps that file's bare field labels.
- Left bare: the statuses **In use:**, **From**, **Default**, **Needs reinstall** and **Not set up**, and **Export Profile**, as in `integrations/*.md`. The Troubleshooting row glosses **This chat** and **Use default** again, per the once-per-section rule.
- The heading is `### チャットやキャラクターごとに別のフォルダーを使う`, a plain-form verb like `## 自分の音楽ファイルを使う`, with `<a id="use-a-different-folder-for-a-chat-or-character"></a>` above it; the `game/game-assets.md` link uses it as link text.
- Terms: 分岐, グループチャット, 設定プロファイル, ランタイム, Pythonパッケージ, サウンドトラック. A chat's folder is このチャットで再生するフォルダー, and the new row is チャットで違うフォルダーが再生される. **Use default** and **Unlink from** 指定を外します, so no one reads them as deleting files; the **Unlink from** item says ボタン, as `AgentAddSetupFields.tsx` confirms.
- Left for a later pass: in `game/game-assets.md`, チャットにいる1人だけのキャラクター用 would be more precise as チャットの唯一のキャラクター用.

These are translation choices, not a new native-reader review.

## Chat Settings card link, per-chat Game Assets folder, local voice servers (2026-11-07, #8938, #8940, #8942)

Precedents from the #8938, #8940 and #8942 mirror (`chats/group-chats.md`, `media/music.md`, `media/tts-setup.md`), against Engine `9650a8e6f0`:

- **Shipped gloss**, byte-exact `ui/ja.json`: **Game Assets Music Folder**(ゲームアセットの音楽フォルダー) (`ui.chat.musicdjsetupfields.gameAssetsMusicFolder`), glossed once in the new `media/music.md` paragraph like the section's other field labels. **This chat** stays bare there; the section glosses it in the **Apply to** table.
- **Left bare** in the `chats/group-chats.md` Characters table, as that table leaves **Add Character**, **Remove from chat** and **Drag to reorder** bare: **Open character card** (shipped `ui.chat.chatsettingsdrawer.openCharacterCard` is キャラクターカードを開く, for a later gloss pass) and **Chat Settings**, glossed at the top of the section.
- **On this device** keeps the pack's coined (このデバイス上) in `media/tts-setup.md`; `ui/ja.json` still has no value for `connections.accounts.section.device` or `connections.add.tag.device` (recheck when they ship). `media/music.md` keeps この端末 for "this device", after **Music folder on this device**(この端末の音楽フォルダー).
- Terms: members already in the chat にチェックが入っています, as in `conversation/table-games.md`; add or remove = 追加したり外したりできます, with the table's 外す; a member's full card = メンバーのカード全体; サブフォルダー and `music/combat`, as in the `media/music.md` **On** bullet; a voice server on your computer or private network = 自分のコンピューターやプライベートネットワーク上にある…音声サーバー, with プライベートネットワーク from `REMOTE_ACCESS.md` and `TROUBLESHOOTING.md`. "**This chat** also shows" is **This chat**を選ぶと…も表示されます, because the field appears when **Apply to** is **This chat** (`AgentAddSetupFields.tsx`).
- The field's hint (`gameAssetsMusicFolderForThisChatOnly`) has no `ui/ja.json` value yet; the guide paraphrases it, so it takes no gloss.

These are translation choices, not a new native-reader review.

## Notices DNS and Capability API 1.817 (2026-11-07, #8954)

Precedents from the #8954 mirror (`CONFIGURATION.md`) and the #8951 developer-doc catch-up (`development/optional-agent-packages.md`), against Engine `dd85f7b40d`:

- **Name lookup**, coined here (no `ui/ja.json` string covers it): hosts file = hostsファイル, Latin without a code span as in English (`TROUBLESHOOTING.md` keeps `/etc/hosts` as code); DNS server = DNSサーバー (trailing ー, §3); "asks the DNS servers directly" = DNSサーバーに直接問い合わせます. "Names that only your local network knows" = 自分のローカルネットワークの中でしか通じない名前, with ローカルネットワーク from `installation/macos-linux.md` and `media/image-providers.md`; "short names without a domain other than `localhost`" = ドメインを含まない短い名前(`localhost`を除く), a parenthetical as in `development/localization.md`, because `localhost`以外のドメインを含まない reads as "containing no domain other than `localhost`".
- **resolv.conf.** The Termux colon is split into two sentences: `$PREFIX/etc/resolv.conf`に書かれたDNSサーバーを使います。このファイルを編集しないかぎり、Googleの`8.8.8.8`と`8.8.4.4`です。 The `#outbound-http-proxy` link text is 外向きのプロキシ, after the heading 外向きのHTTPプロキシ. The `MARINARA_NOTICES_URL` row adds このURLのホストは、hostsファイルかDNSに登録されている必要があります ("its host" made explicit as the URL's host).
- **Capability API 1.817.** Heading `### Capability API 1.817: チャットの分岐が作られたことをパッケージに伝える`, a plain-form verb like the 1.814 and 1.815 siblings, under `<a id="capability-api-1817-telling-a-package-that-a-chat-was-branched"></a>`, since every Capability API heading in the file has one (nothing links to it yet). A branched chat is チャットの分岐が作られる, chat-sense 分岐 (never ブランチ) after `chats/branches.md` 分岐の作成; the copy is コピー, as there. "awaits it once" = 1回呼び出して完了を待ちます, after the file's `ensureMarinaraHost()`の完了を待ちます; branch route = 分岐のルート, after 生成ルート; "logged and ignored" = ログに記録して無視します; soft seam = ソフトなインターフェース and optional method = 省略可能な…メソッド, as in 1.391.

These are translation choices, not a new native-reader review.

## Card field alternative names and the Chat Settings picker (2026-11-10, #9012)

Precedents from the #9011 mirror (`characters/creating-and-editing-characters.md`, `characters/personas.md`), against Engine `ee5bc8e080`:

- **Card Field Alternatives** is glossed (カード項目の代替) at its first bold use in `creating-and-editing-characters.md` as **Card Field Alternatives**(カード項目の代替) and again in the personas bullet, inside the combined **Chat Settings → Card Field Alternatives**(チャット設定 → カード項目の代替) pair. The first rule never names the label; it writes **Chat Settings** bare. Both カード項目の代替 and 代替項目のタイトル are new coinages in this commit, built from the attested 代替項目 (12 occurrences in this file before it), so the section label extends the field term to card fields rather than introducing a second word for *alternative*.
- **Original**(元の項目) is glossed once, in the paragraph: the picker row returns a field to its original text, and a bare オリジナル would read as a copy.
- Step 2's example title, **Backstory alternative 1**, is the app's own string: `ui/ja.json` `ui.cardFields.alternativeTitle` is **{{field}}の代替版{{index}}** with `chat.settings.inlineEditor.fields.backstory` = 経歴, hence **Backstory alternative 1**(経歴の代替版1). *Optional* opens the step as **任意:** with the half-width colon, as the pack's other optional steps do (`agents/custom-agents.md:184`, `agents/hierarchical-maps.md:61`). *Up to 60 characters* is **60文字まで**; *leave the name empty to keep the numbered title* is **名前を空のままにすると、番号付きのタイトルのままになります**, keeping the まま frame of the English.
- *Pick* is **選びます**; *the choice applies from the next reply* is **選んだ内容は次の返信から使われます**, after 次の返信 in `agents/built-in-agents.md:104`. *The section is hidden* is **このセクションは表示されません**, the pack's way of saying a panel does not appear.
- The first rule keeps **1つのチャットで使える代替は、1つの項目につき1つだけです** and adds the parallel **別の代替でそのチャットにチェックを入れるか、Chat Settingsで別の代替を選ぶと、割り当てがそちらに移ります**. **Chat Settings** runs bare after its gloss in the paragraph, as elsewhere in the file.
- In the personas bullet, *name each alternative* is **代替項目にはそれぞれ名前を付けられ** and *switch between them* is **切り替えられます**; the path is **Chat Settings → Card Field Alternatives**(チャット設定 → カード項目の代替), one tight gloss pair for the bold span, no space around the parentheses (§3).

These are translation choices, not a new native-reader review.

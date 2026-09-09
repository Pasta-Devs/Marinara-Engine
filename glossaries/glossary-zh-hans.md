# Simplified Chinese (`zh-hans`) — documentation-pack glossary

## Provenance

This is the **second-generation** glossary for the `zh-hans` documentation pack. The original
working glossary from the pack's translation cycle was lost to temp-directory cleanup; this file
was **re-derived on 2026-09-01** from, in authority order:

1. **The shipped pack as it exists on `docs-i18n`** (125 `.md` files + `manifest.json`) — the
   ground truth. Every prescriptive rule below was re-measured against it; terminology rows cite a
   pack file and line.
2. **The pack's shipping PR decision write-up** — Pasta-Devs/Marinara-Engine **PR #4435**
   ("Simplified Chinese documentation pack"), plus the `zh-hans` convention bullet it added at
   `CONTRIBUTING.md:242`.
3. **The 2026-09-01 mirror-cycle notes** (`prd-notes-zh-hans.md`) — evidence-backed choices made
   during the #5604 / #5720 / #5718 delta mirror, each carrying its own pack citation.
4. **The app locale** `packages/client/src/localization/locales/zh-Hans.json` — consulted for
   byte-exact UI strings, **not** used as a terminology authority (see §6.4).

Rules are marked one of two ways:

- **[V]** — verified against the pack as shipped, with a citation.
- **[R]** — a **recorded maintainer/cycle ruling** carried forward from the original cycle. The
  pack cannot show it (it is a process fact, a historical count, or a runtime behavior), so it is
  preserved as-recorded rather than re-derived.

Line numbers are as of the 2026-09-01 worktree state. Paths are pack-relative.

---

## 1. Register & address

| # | Rule | Evidence |
|---|---|---|
| 1.1 | **[V]** Second person is **你**. **您 is banned outright** — zero occurrences across all 125 files. This is the modern mainland software register; 您 reads as customer-service deference and is wrong for a self-hosted tool. | `grep -r 您` → 0 hits, whole pack |
| 1.2 | **[V]** Pronouns stay **sparse**. Chinese drops subjects; do not carry EN "you/your" across mechanically. Measured retention: EN docs contain **4,051** `you`/`your`; the pack contains **511** 你 over 312,388 CJK characters — roughly **13%** carry-through, about one 你 per 611 characters. Of those 511, 85 are 你的 and 38 are 你自己; **do not add 511 + 85**, 你的 is counted inside the 511. | `docs/**.md` vs pack char census |
| 1.3 | **[V]** No honorific or polite-register openers: 您好, 请您, 敬请 — zero occurrences. Imperatives are bare (打开…, 设为…, 见…). | `CONFIGURATION.md:12–16`; `data/backup-and-restore.md:81` (要把…用 **Import Profile**) |
| 1.4 | **[V]** Register is **plain technical mainland Chinese**, not literary and not 翻译腔. Colloquial-but-clean connectives are in-register and used freely: 就行, 直接, 顺手, 省得, 一句, 照常. | `chats/settings-profiles.md:3` (直接套用方案就行，不必从头再设一遍) |
| 1.5 | **[V]** Gender-neutral by default — Chinese third person in text is 它 for software/agents and 角色 for in-fiction people. 他/她 appear only where the EN source refers to a specific gendered character (Professor Mari is 她). Never invent a gender for a UI actor. | `home/professor-mari.md:120` (她保存的记忆…); `agents/agents-overview.md` (智能体…它) |
| 1.6 | **[R]** Four independent native-reader QA panels read every file end-to-end during the original cycle (~150 fixes: 翻译腔 rewrites, mistranslation catches, one profile-term unification), followed by a reconciliation pass resolving cross-panel conflicts with recorded rulings. Register decisions above are the settled output of that process. | recorded ruling (PR #4435 "Validation performed") |

---

## 2. Product, feature & mode names

| # | Rule | Evidence |
|---|---|---|
| 2.1 | **[V]** Product names stay in **Latin script, never transliterated**: Marinara, Marinara Engine, Noodle, NoodleR, Professor Mari, Termux, Android, Node, Docker, Tailscale, SillyTavern, ComfyUI. Zero occurrences of 玛丽娜拉 / 马里纳拉 / 面条. | `CONFIGURATION.md:3`; `home/professor-mari.md` |
| 2.2 | **[V]** The three **mode names stay English**: `Conversation`, `Roleplay`, `Game Mode`. On first mention per file they take a tight half-width gloss, then run bare. Gloss counts: **44 / 37 / 36**. The gloss is usually written on the **plain, unbolded** name per §5.2.b — `Conversation(对话模式)`, `Roleplay(角色扮演)`, `Game Mode(游戏模式)`; only 3 / 10 / 4 of those are bolded (**Conversation**(对话模式) etc.), and bolding is reserved for where the name is being introduced as a UI surface. | `FAQ.md:53–55` (bolded); `conversation/profiles.md:3`, `integrations/discord-mirror.md:3` (unbolded) |
| 2.3 | **[V]** `Noodle` and `NoodleR` are never translated and never glossed. | `noodle/overview.md`; `FAQ.md:119` |
| 2.4 | **[V]** Panel / editor / screen names that the app renders in English stay English in bold and take a gloss on first mention: **Character Editor**(角色编辑器), **Persona Editor**(用户角色编辑器), **Preset Editor**(预设编辑器), **Chat Settings**(聊天设置), **Connections**(连接), **Agents**(智能体). | `FAQ.md:101`; `conversation/profiles.md:11–12`; `prompts/presets.md:3` |
| 2.5 | **[V]** Environment-variable names, file names, CLI commands, paths and code literals are **byte-exact and never translated**: `MARINARA_MAX_RESIDENT_CHATS`, `UPDATES_APPLY_DISABLED`, `termux-wake-lock`, `termux-tools`, `server-*.log`, `start.bat`, `.env`, `DATA_DIR`. | `CONFIGURATION.md:155`, `:238`; `TROUBLESHOOTING.md:326` |
| 2.6 | **[V]** Navigation paths keep the English segment names and join them with `→` or `>` exactly as EN does; when a path is glossed, the **gloss** joins the Chinese segment names with `→`: **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域). | `CONFIGURATION.md:31` |
| 2.7 | **[V]** Version literals, release-tag forms and numeric identifiers are byte-exact half-width: `2.4.5`, `v2.3.1`, `pnpm@10.34.5`, `7860`. Full-width digits would silently break the in-app substring search. | `TROUBLESHOOTING.md:37`, `:47`; `CONFIGURATION.md:156` |
| 2.8 | **[V]** `SillyTavern` stays Latin everywhere; the community nickname **酒馆** is sanctioned **exactly once**, as a parenthetical in the import guide's opening sentence, and appears nowhere else. | `data/importing-from-sillytavern.md:3` — `SillyTavern(社区常称“酒馆”)`; whole-pack count for 酒馆 = 1 |

---

## 3. Core terminology

Every row is one term, one rendering, pack-wide — the in-app docs search is literal substring
matching, so a synonym is a search miss.

**How to read the "Banned alternates" column.** A ban is **sense-scoped**: the listed string is
banned *as a rendering of that English term*, not as a string anywhere in the pack. Many banned
alternates are ordinary Chinese words the pack uses freely in another sense (指令 = "instruction",
标记 = "to mark", 信息 = "information", 镜像 = "Docker image"), and several are pure substring
artifacts (词条 inside 关键词+条目, 复写 inside 回复+写). Where a banned string is attested in
another sense, the count and that sense are given in parentheses so the C-checks in §7.1 are not
read as failures. **A count of 0 means the string is genuinely absent pack-wide.**

Rows whose banned alternate is genuinely competing with the prescribed term — i.e. the pack itself
is inconsistent — are marked **⚠ residual** and carry a §7.4 entry with counts and file cites.

| English term | Pack term | Banned alternates | Evidence |
|---|---|---|---|
| prompt | **提示词** (625) | 提示語 (0), 提示詞 (0), 提示文本 (0); 指令 (76 — but only as *prompt*: 指令 is the pack's own word for an **instruction** — 智能体指令, 引导指令, Maps 指令, CPU 指令) | `prompts/presets.md:3` |
| token (LLM unit) | **Token**, capital T, Latin script, spaced from CJK | 令牌 (0), 词元 (0), 符元 (0); 标记 (140 — but only as *token*: 标记 is the pack's verb "to mark/tag" and its noun for a **map marker**) | `FAQ.md:105` — `Token(模型切分文本的最小单位)`; `chats/messages.md:95` |
| token budget | **Token 预算** | 令牌预算 (0) | `lorebooks/linking-to-characters.md:101` |
| token (auth/API credential) | **Token** in Latin, or **密钥** for "key" | 令牌 (0). Note the one lowercase exception: `characters/bot-browser.md:175` writes `token 或 cookie 值` in Chinese prose. Elsewhere lowercase `token` only appears inside code, file names and verbatim EN labels. | `characters/bot-browser.md:175`; `FAQ.md:65` (API 密钥) |
| preset (prompt preset) | **预设** / **提示词预设** (224 / 36) | 配置文件 (0), 方案 (that is a *settings profile*); 预置 (6 — but only as *preset*: 预置 is the pack's adjective for "bundled/preconfigured", 包内预置的链路) | `prompts/presets.md:3`; `chats/settings-profiles.md:9` |
| settings profile | **设置方案** (18; short form 方案) | 设置预设 (0), 设置档案 (0), 配置文件 (0) | `chats/settings-profiles.md:1`, `:3` |
| lorebook | **世界书** (568) | 世界書 (0 — traditional; breaks search), 知识书 (0), 设定集 (0), 传说书 (0) | `FAQ.md:105`; `lorebooks/overview.md` |
| lorebook entry | **条目** (515) | 词条 (0 — the 2 grep hits are substrings of 关键词+条目 and 关键词+条件); 项目 (30 — but only as *entry*: 项目 is "project" (项目根目录) and generic "item" (图库项目)) | `lorebooks/entries.md:13` |
| character card | **角色卡** (199) | 角色檔 (0). **人物卡 is NOT banned** — see the next row; it is a different EN term. | `FAQ.md:101` |
| character sheet (Game Mode party stat block, EN **Sheet**) | **人物卡** (17) | 角色卡 (that is the *character card*) | `game/party-and-npcs.md:23` — 人物卡…和角色卡是两回事; `:39` **Regenerate Sheet**(重新生成人物卡); `:43` **Edit Sheet**(编辑人物卡); `:45` **Sheet Details**(人物卡详情); `:50` **Save Sheet**(保存人物卡) |
| character | **角色** (2,046) | 人設 (0); 人物 (21 — 17 of them inside 人物卡 above, and 4 in `development/hierarchical-locations-prd-v3.md` meaning "figures visible in an image": 出镜人物) | `characters/creating-and-editing-characters.md:3` |
| persona (the user's own card) | **用户角色** (443) | **人设** — this is what the *app UI* uses (218 hits in `zh-Hans.json`) and it is **banned in docs**; also 角色扮演身份, 个人形象 | `FAQ.md:107` — **Linked Personas**(关联用户角色); `characters/personas.md:97` |
| chat | **聊天** (1,910) | 对话 (reserved for the Conversation mode gloss), 会话 (reserved for Game sessions) | `chats/managing-chats.md:3` |
| group chat | **群聊** (64) | 团体聊天 (0), 多人对话 (0) | `chats/group-chats.md:77` |
| message | **消息** (802) | 讯息 (0), 留言 (0); 信息 (112 — but only as *message*: 信息 is "information" — 接入信息, 登录信息, 报错信息, 诊断信息) | `chats/messages.md:1` |
| swipe | **swipe** when quoting the UI label; **备选回复** (96) in Chinese prose | 划动 (0); 滑动 (3 — but only as *swipe the feature*: 滑动 is the literal finger gesture, 向左滑动 / 触屏滑动) | `chats/messages.md:60` — **Previous swipe**(上一条备选回复) |
| regenerate | **重新生成** (67) | 重生 (0); 再生成 (0 — the 1 grep hit is 再 + 生成, "generate again") | `chats/messages.md:1` |
| greeting / first message | **开场白** (9) — ⚠ **residual**, see §7.4 **R-8** | 招呼语 (0); 问候语 (4 — a genuinely competing rendering of the same EN "greeting", not a different sense) | `FAQ.md:101`; `characters/creating-and-editing-characters.md:73` — **Dialogue & Greetings**(对白与开场白) |
| agent | **智能体** (766) | **代理** — reserved for network *proxy*, never for agents; also 助手 (0 as *agent*), 代理人 (0), 特工 (0) | `FAQ.md:115`; `agents/agents-overview.md:1` |
| tracker (agent) | **追踪器** (85) | 跟踪器 (0), 追蹤器 (0) | `agents/agents-overview.md:50` |
| proxy (network) | **代理** (26) — only ever this sense | — | `REMOTE_ACCESS.md:150`; `CONFIGURATION.md:135` (反向代理) |
| connection | **连接** (775) | 联接 (0), 链接 (reserved for hyperlinks); 连线 (1 — but only as *connection*: `media/comfyui.md:101` 节点连线 is ComfyUI node wiring) | `FAQ.md:65` |
| provider | **服务商** (364) | 供应商 (0), 提供商 (0); 厂商 (3 — but only as *provider*: 厂商 is the device **OEM** — 手机厂商, `TROUBLESHOOTING.md:324`, `:326`, `:330`) | `FAQ.md:65` |
| API key | **API 密钥** (103) | API 金鑰 (0), 接口密码 (0) | `FAQ.md:65` |
| launcher (the shell start script) | **启动脚本** (81) | 启动程序, 载入器 | `CONFIGURATION.md:155` (Termux 启动脚本); `CONFIGURATION.md:88` |
| launcher (the updater component that gates downgrades) | **启动器** (8) | — (see §7.4 residual R-5 on the two-form split) | `TROUBLESHOOTING.md:262`; `UPGRADING.md:186` |
| update (noun/verb) | **更新** (297) | 升级 (reserve for "upgrade" headings) | `installation/windows.md:190` |
| apply (an **update**) | **应用更新** / **应用** (13) | 套用, 施加 — **scoped to the update sense only**. 套用 (27) is the pack's established verb for applying a **settings profile, preset or map template** (`chats/settings-profiles.md:3` 直接套用方案就行; `:30` ## 套用方案), and 施加 (5) is for applying a **penalty or status effect** (施加惩罚, 施加增益). Neither is a defect. | `installation/windows.md:204` — **Apply Update**(应用更新); `CONFIGURATION.md:238` |
| release channel | **发布通道** (6) | 发行通道 (0 here — this is the *app locale's* term, see §5.4), 频道 (that is a Discord channel), 渠道 (0) | `CONFIGURATION.md:237`; `installation/windows.md:201` |
| channel (Discord / media) | **频道** (10) | 通道 | `integrations/discord-mirror.md:3` |
| channel (audio bus, alpha, map link) | **通道** | 频道 | `media/tts-setup.md:150`; `characters/sprites.md:76` |
| checkout (a git working tree) | **仓库** (58) | 检出 (0), 工作树 (0), 签出 (0 — the 2 grep hits are 标签 + 出现) | `TROUBLESHOOTING.md:39` — "如果仓库本身没法更新"; `CONFIGURATION.md:238` |
| loopback | **环回** (32) | 回环 (0), 本地回送 (0) | `CONFIGURATION.md:114` — 环回（loopback） |
| wake lock | **唤醒锁** (2) | 唤醒锁定 (0), 屏幕锁 (0) | `TROUBLESHOOTING.md:324` |
| battery optimization | **电池优化** (2) | 省电优化 (0), 电量优化 (0) | `TROUBLESHOOTING.md:326` |
| run in the background | **后台运行** (3) | 背景运行 (0) | `TROUBLESHOOTING.md:326` |
| background activity (the Android setting) | **后台活动** — deliberately distinct from 后台运行, mirroring EN's own distinction | 后台运行 (that is the *other* term) | `TROUBLESHOOTING.md:332` |
| frozen (cached-app freezer) | **冻结**; the freezer itself is **缓存应用冻结器** | 卡死, 挂起 (used for "suspends", not "frozen") | `TROUBLESHOOTING.md:330` |
| memory (RAM) | **内存** (27) | 记忆体 (0), 存储器 (0) | `CONFIGURATION.md:155` |
| in memory / resident | **保留在内存里**, **载入内存** | 驻留内存 (0); 常驻 (6 — but only as *RAM-resident*: 常驻 is the gloss for the lorebook/memory **Persistent** flag, `home/professor-mari.md:127` **Persistent**(常驻，见下文), and 常驻角色 "recurring character") | `CONFIGURATION.md:155`; `development/file-storage.md:39` |
| eviction (drop from memory) | **从内存中移出（不会从磁盘删除）** | 逐出 (0), 淘汰 (0), 驱逐 (0) | `CONFIGURATION.md:155` |
| least-recently-used | **最久未使用** | 最近最少使用 (0 — rejected as textbook jargon for a table cell), LRU (0) | `CONFIGURATION.md:155` |
| VRAM | **显存** (22) | 视频内存 (0) | `game/ltx-2-3-storyboards.md:40` |
| memory (the agent feature) | **记忆** (123); the feature is **Memory Recall**(记忆功能) (15) | 内存 (that is RAM); 记忆召回 (0 — the *app locale's* term, see §5.4); 回忆 (9 — but only as the **noun**: 回忆 is the pack's **verb** "to recall", 回忆到的记忆 / 回忆不出来, and a "flashback" in `roleplay/scenes.md:7`) | `FAQ.md:127`; `agents/memory.md` |
| unsaved changes | **未保存的改动** (6) | 未保存的更改 (0) | `CONFIGURATION.md:155`; `agents/approvals-and-agent-suite.md` |
| cache (noun/verb) | **缓存** (49) | 快取 (0); 暂存 (2 — but only as *cache*: 暂存 is git **stash**, `installation/windows.md:192` 把它们暂存起来，更新完再放回去) | `agents/approvals-and-agent-suite.md:95`; `:3` — **Cached prompt injections**(缓存的提示词注入) |
| backup | **备份** (96); full archive = **完整备份** (7) | 备存 (0), 备分 (0 — the 2 grep hits are 设备 + 分配) | `data/backup-and-restore.md:9` — **Download Backup**(下载备份) |
| snapshot | **快照** (108) | 截图 (that is a screenshot, 1 hit, correct); 镜像 (59 — but only as *snapshot*: 镜像 is the pack's established term for a **Docker/container image** and for the verb "to mirror", `installation/containers.md:14`, `integrations/discord-mirror.md:3`) | `development/file-storage.md:7`, `:51` |
| profile (portable account archive: Export/Import Profile) | **档案** (60) | 配置文件 (0), 个人资料 (that is the social profile), 存档 (that is a Game save) | `data/backup-and-restore.md:10` — **Export Profile**(导出档案) |
| profile (Conversation / Noodle social profile) | **个人资料** (26) | 档案 (that is the account archive); 简介 (8 — but only as *profile*: 简介 is the gloss for the Noodle **Bio** field, `noodle/overview.md:90` **Bio**(简介)) | `conversation/profiles.md:1`, `:3`; `noodle/overview.md:88` |
| save / save file (Game Mode) | **存档** (20) | 档案 (that is the account archive), 保存点 (0) | `game/sessions-and-saves.md:1` — Game Mode：会话与存档 |
| session | **会话** (102) | 场次 (0), 对话 (reserved for the Conversation gloss) | `game/sessions-and-saves.md:1`; `TROUBLESHOOTING.md:324` (服务器会话) |
| extension | **扩展** (190); the feature is **个人扩展** (15) but the product name **Personal Extension(s)** stays Latin | 外挂 (0), 擴充 (0); 插件 (8 — but only as *extension*: 插件 is the gloss for the **Addons** settings section, `CONFIGURATION.md:59` **Settings → Addons**(插件), and for a native/Vite **plugin**) | `extending/personal-extensions.md:1`, `:3`; `data/backup-and-restore.md:10` |
| NPC | **NPC**, Latin, uppercase; glossed on first mention per file, in two attested forms — `NPC(玩家之外的角色)` and `非玩家角色（NPC，即玩家之外的角色）` | 路人 (0); 非玩家角色 **as a running term** (used once, only as that first-mention expansion) | `game/party-and-npcs.md:1`, `:3`; `game/getting-started.md:11` |
| GM / game master | **游戏主持人（GM）** (27) on first mention, **GM** after | 主持人 as a standalone term (0), 地下城主 (0) | `FAQ.md:55`; `game/party-and-npcs.md:106` |
| sprite | **立绘** (224) | 精灵图 (0), 立繪 (0), 角色图 (0 as *sprite* — the 20 grep hits are all 角色图库 / 角色图片 / 角色图像 / 角色图包) | `FAQ.md:54`; `characters/sprites.md` |
| narrator / narration | **旁白** (25) — ⚠ **residual**, see §7.4 **R-9** | 解说 (3 — but only as *narrator*: 解说 is the gloss for the table-games **Announcer** role, `conversation/table-games.md:135`); 叙述者 (3 — a genuinely competing rendering, all in `roleplay/combat-encounters.md:34`–`:35`) | `chats/group-chats.md:77`; `appearance/card-css-theming.md:147` |
| branch (chat branch) | **分支** (178) | 分岔 (0); 支线 (5 — but only as *chat branch*: 支线 is the narrative side-branch — **Party Arcs**(队伍支线), 场景支线) | `chats/branches.md:1` |
| keyword (lorebook trigger) | **关键词** (160) | 关键字 (0), 触发词 (0) | `agents/custom-agents.md:3` |
| macro | **宏** (142) | 巨集 (0), 宏指令 (0) | `prompts/macros.md` |
| slash command | **斜杠命令** (26) | 斜線指令 (0); 命令行 (6 — but only as *slash command*: 命令行 is "command line", 命令行工具（CLI）) | `chats/slash-commands.md`; `development/optional-agent-packages.md:124` |
| regex / regex script | **正则** (52) / **正则脚本** (37); the UI label `Regex` stays Latin | 正規表示式 (0), 规则表达式 (0) | `extending/regex-scripts.md:7` — Regex 是“regular expression”（正则表达式）的缩写 |
| tool / function calling | **工具** (333); function calling = **函数调用** (11) | 功能 as a rendering of *tool* (0), 函式 (0) | `agents/custom-agents.md:137` |
| completion | **补全** (6) | 完成 as a rendering of *completion* (0), 完稿 (0) | `chats/messages.md:95` (补全 Token 数) |
| streaming | **流式** / **流式输出** (29) | 串流 (0), 实时输出 (0) | `chats/sending-and-streaming.md:1` |
| override | **覆盖** (125) | 覆寫 (0), 复写 (0 — the 6 grep hits are all 回复 + 写, e.g. 回复写完) | `agents/custom-agents.md:162` — **Connection Override**(连接覆盖) |
| empty (default-column value) | **空** | 未设置 (that is the *other* value) | `CONFIGURATION.md:154` (`ENCRYPTION_KEY` \| 空) |
| unset (default-column value) | **未设置** (6) | 空 (that is the *other* value), 无 | `CONFIGURATION.md:238` (`UPDATES_APPLY_DISABLED` \| 未设置); prose at `CONFIGURATION.md:277` |
| off (default-column value) | **关闭** (238) | 关 (0 standalone), 停用 (0) | `CONFIGURATION.md:156` (`MARINARA_EAGER_STORAGE` \| 关闭) |
| unlimited ("set 0 for unlimited") | **不限** (5 in this sense) is the pack's dominant prose form; **无限制** (1) and **不限制** (2) also occur — ⚠ **residual**, see §7.4 **R-7**. In a config table's default column the attested form is `` `0` ``(无限制). | 无限 as a standalone rendering (0 in this sense) | `lorebooks/token-budgets.md:20`, `:36`; `lorebooks/overview.md:90` (不限); `CONFIGURATION.md:155` — `` `0` ``(无限制) |

### 3.1 The four-way "profile" split

**[V]** EN "profile" lands on **four** distinct Chinese terms. The original cycle recorded this as
a *three-way* split (ruling **[R]**); the shipped pack shows four, and the pack governs:

| EN sense | Term | Where |
|---|---|---|
| portable account archive (Export/Import Profile, `marinara-profile.json`) | **档案** | `data/backup-and-restore.md:10`, `:72`; `CONFIGURATION.md:245` |
| a character's/persona's Conversation & Noodle social profile (display name, about-me) | **个人资料** | `conversation/profiles.md:1`; `noodle/overview.md:88` |
| a named, reusable bundle of chat settings ("settings profile") | **设置方案** | `chats/settings-profiles.md:1` |
| a Game Mode save | **存档** | `game/sessions-and-saves.md:1` |

Never swap these. 档案 in a Game Mode context, or 存档 in a backup context, is a bug.

---

## 4. Typography & punctuation

### 4.1 Script and width

| # | Rule | Evidence |
|---|---|---|
| 4.1.1 | **[V]** **Simplified characters only.** A scan of 216 unambiguously traditional-only forms (們個這來時對開關實現後點於為將學會體發動與並書據絡經過準備聯繫緩衝擊選擇檔軟訊資製視圖傳儲執覽權誤碼註釋讀寫參變陣迴語範輸畫顯單鈕捲標籤頁欄屬繼緒瀏戶請應憑證簽雜亂裡著妳佔說話認識誰讓訪載離網絡電腦…) returns **0 distinct forms, 0 occurrences** across all 125 files. The sense-split pairs are clean too: 裡 = 0, 著 = 0, 妳 = 0, 佔 = 0, 檔 = 0, 說 = 0, 個 = 0, 們 = 0, 時 = 0, 後 = 0. **Build the scan list carefully** — every form must have a *distinct* simplified counterpart. Shared forms (器 硬 料 窗 用 方 行 果 除 法 回 型 性 索 素 繁 厚 明 容 查 列 境 函 照 警 象 累 返 翻 紫 …) are identical in both scripts and will report thousands of false hits (see §7.3 **T1**). | whole-pack scan |
| 4.1.2 | **[V]** **All Latin letters and digits are half-width ASCII.** Zero characters in U+FF10–FF19 / U+FF21–FF3A / U+FF41–FF5A. Full-width ７８６０ would never match a search for `7860`. | whole-pack scan |
| 4.1.3 | **[V]** Text is **NFC-normalized**; every file round-trips through `unicodedata.normalize("NFC", …)` unchanged. | whole-pack scan |
| 4.1.4 | **[V]** **No ideographic space** (U+3000) and **no NBSP** (U+00A0, U+2007, U+202F): 0 occurrences. Also 0 zero-width joiners/non-joiners (U+200D, U+200B), 0 bidi marks (U+200E) and 0 BOMs (U+FEFF). Separation is always a plain half-width space. | whole-pack scan |
| 4.1.5 | **[V]** CJK punctuation is full-width: ，(10,573) 。(13,643) 、(4,292) ；(442) ：(2,600) ？(35). **！ is not used at all** (0) — the EN docs' exclamation-free register carries over. | `CONFIGURATION.md`, whole-pack census |

### 4.2 The two-case parenthesis rule

**[V]** Parenthesis width is decided by **what precedes the opening paren, never by what is inside
it**. This is the single most load-bearing typography rule in the pack.

The classifier is the immediately preceding character, with one refinement: when that character is
a bold close `**` or a closing `)`, look at the **span it closes** — an English label behaves as
Latin (half-width), a Chinese span behaves as CJK (full-width). Never look at the gloss.

Counts below are of **conforming** parens (prose only, code fences excluded); the non-conforming
ones are itemised in §7.4 **R-1**.

| Preceding character | Paren | Count | Example |
|---|---|---|---|
| Latin letter or digit | half-width `( )`, tight | 437 | `Token(模型切分文本的最小单位)` — `FAQ.md:105` |
| bold close `**`, **English** bold content | half-width `( )`, tight | 2,111 | `**Export Profile**(导出档案)` — `data/backup-and-restore.md:10` |
| bold close `**`, **Chinese** bold content | full-width `（ ）` — the bold is Chinese prose, so the CJK rule applies | 2 (against 3 half-width; see §7.4 **R-10**) | `初始处于**禁用**（关闭）状态` — `home/professor-mari.md:120` |
| inline-code close `` ` `` | half-width `( )`, tight | 64 | `` `0` ``(无限制) — `CONFIGURATION.md:155` |
| a Chinese character | full-width `（ ）` | 471 | `环回（loopback）` — `CONFIGURATION.md:114` |
| a preceding **Chinese gloss's** `)` | full-width `（ ）` | 16 | `**Chat Settings**(聊天设置)（齿轮图标）` — `agents/approvals-and-agent-suite.md:12` |
| a preceding **English label's own** `)` | half-width `( )` — the label is byte-exact per §5.1, so its `)` counts as Latin | 2 | `Covers (Blinds & Garage)(遮挡设备：窗帘与车库门)` — `integrations/home-assistant.md:119`, `:124` |
| CJK punctuation (。 ” 、) | full-width `（ ）` | 2 | `…改成 **Constant**。（不带关键词的条目…）` — `lorebooks/entries.md:366` |

Corollaries:

- **4.2.a [V]** A markdown link's `](` is not a paren for this purpose — it is always ASCII (941
  instances).
- **4.2.b [V]** Verbatim English quoted from the app is **exempt**: whatever parens the app's own
  string contains stay byte-exact, e.g. **Unreachable (request timed out)** keeps its half-width
  paren *and* its space, inside CJK prose. `TROUBLESHOOTING.md:330`
- **4.2.c [V]** 14 in-pack violations survive; see §7.4 residual **R-1**.

### 4.3 Close-side spacing after a gloss — the §4(e) rule

**[V]** Measured over 2,101 `**Label**(Chinese gloss)` instances:

| What follows `)` | Treatment | Count |
|---|---|---|
| anything that is not CJK punctuation — Chinese prose, a table pipe `\|`, `→`, `/`, `>` | **one half-width space**, then it | 1,185 (of which 1,127 are Chinese prose) |
| CJK punctuation (。，、：；？”) or a closing `）` | **no space** | 887 (879 + 8 closing `）`) |
| a chained full-width `（…）` aside | **no space** | 16 |
| end of line / list item | nothing | 9 |
| *(violations: CJK prose with no space)* | — | 4 (§7.4 **R-2**) |

Example of both halves in one line: `**Export Profile**(导出档案) 生成的文件更轻，…（角色、…）。`
— `data/backup-and-restore.md:10`.

### 4.4 CJK ↔ Latin spacing

**[V]** **Exactly one half-width space** separates a CJK character from an adjacent Latin
letter or digit, in both directions. Measured: 7,202 `Latin␠CJK` and 6,326 `CJK␠Latin`
adjacencies, and **zero** tight adjacencies of either kind across the whole pack. This holds for
inline code, bold labels, product names and version literals alike: `Token 数`, `Marinara 会自动…`,
`pnpm 10.34.5 的…`.

The space is *not* inserted between CJK and a full-width punctuation mark, and never before
，。、；：？.

### 4.5 Quotes

| # | Rule | Evidence |
|---|---|---|
| 4.5.1 | **[V]** Chinese-prose quoting uses **curly “ ”** (GB/T 15834): 414 pairs, perfectly balanced. **‘ ’ is unused** (0), and 「」《》 are unused (0). | `CONFIGURATION.md:7` — “让多台设备访问同一个服务器” |
| 4.5.2 | **[V]** A quoted **English UI string** also sits inside the pack's curly “ ”, but the string itself is **byte-exact** — including its own ellipsis character. 312 of the 414 quoted spans are pure ASCII English. | `UPGRADING.md:164` — “Update applied successfully. Please relaunch the app to use the new version.” |
| 4.5.3 | **[V]** Straight ASCII `"` survives **only when the quote marks are part of the string the app renders**: `Theme "My Theme" saved and activated.`, `Delete "your connection name"?`, `-tag:"tag name"`, `Use "🔞 Popular NSFW" sort…`. Exactly **14** such spans exist in prose pack-wide (there are 360 more inside code fences and inline code, which this rule does not govern). Never use straight quotes for the pack's own quoting. | `appearance/custom-css-themes.md:29`; `connections/organizing-connections.md:47`; `characters/library-organization.md:22`, `:68`, `:93`; `characters/bot-browser.md:85`; `connections/local-model.md:185`; `development/optional-agent-packages.md:61` (×4), `:67`; `media/scene-video.md:159`, `:163` |
| 4.5.4 | **[R]** The original cycle resolved the quote-style question into a principled **301 / 12** split (curly for the pack's own quoting; straight only where the rendered string owns the marks). Today's re-measurement gives **414 curly pairs / 14 straight prose spans** — the *rule* is unchanged; the historical counts are recorded, not re-derivable. | recorded ruling (PR #4435); re-measured 2026-09-01 |

### 4.6 The quoted-sentence terminator ruling

**[V]** When a quoted string already carries its own terminal punctuation (`.`/`!`/`?`), **no
outer 。 is added after the closing ”**. Measured: **0 violations** pack-wide.

- quoted **sentence** → `”` then end-of-line (62), a continuing Chinese clause (68), or ，(12) —
  never 。 (0). `UPGRADING.md:172` — …会看到：“Could not check for updates. Try again later.”这通常是…
- quoted **term/fragment** (no internal terminator) → the outer 。 is added normally (73).
  `TROUBLESHOOTING.md:145` — …“修复”。

Mechanical check: `grep -rP '[.!?。？]”。'` must return zero.

### 4.7 Dashes, ellipses, separators

| # | Rule | Evidence |
|---|---|---|
| 4.7.1 | **[V]** The Chinese dash is the **doubled em dash ——**, set **tight** (no surrounding spaces), and it is rare: 2 occurrences pack-wide. Use it only where EN uses a dash to pivot a sentence. | `TROUBLESHOOTING.md:260` — 聊天看起来是空的——数据仍在磁盘上; `TROUBLESHOOTING.md:330` |
| 4.7.2 | **[V]** A **single spaced em dash `—`** appears **3 times**, only inside content byte-inherited from EN (two list-item dashes, one quoted English card description). Do not author one in Chinese prose. | `agents/custom-agents.md:113`, `:114`; `lorebooks/entries.md:189` |
| 4.7.3 | **[V]** Ellipsis follows the **string being quoted**, never a house style: `…` (U+2026) where the app renders U+2026 (**Creating backup…**, **Saving…**), and ASCII `...` where the app renders ASCII (“正在打开聊天...”, key `ui.chat.chatarea.openingChat`). | `UPGRADING.md:27`; `TROUBLESHOOTING.md:330` |
| 4.7.4 | **[V]** `·` (U+00B7) and `–` (U+2013) appear once each and are inherited from EN table cells, not authored. `–` at `noodle/settings.md:219` is a **drift** from EN's ASCII hyphen (§7.4 **R-3**). | `INSTALLATION.md:14`; `noodle/settings.md:219` |

### 4.8 Headings, lists, tables

| # | Rule | Evidence |
|---|---|---|
| 4.8.1 | **[V]** Headings are **translated into Chinese** and take **no terminal 。** (0 of 1,861). Question headings take **？** (24). A heading that names a UI surface keeps the English name: `## Agents 面板`. | `agents/agents-overview.md:21`; `FAQ.md:49` |
| 4.8.2 | **[V]** A heading that pairs a scope with a topic uses a **full-width ：**: `# Game Mode：会话与存档`, `### Windows：构建 shared 包时提示 …`. | `game/sessions-and-saves.md:1`; `TROUBLESHOOTING.md:35` |
| 4.8.3 | **[V]** Heading **level structure is identical to EN**, in order — 123 of 125 files match exactly (the 2 deltas are EN drift, §7.4 **R-4**). | structural diff vs `docs/` |
| 4.8.4 | **[V]** Of 4,644 list items: **3,774** are full sentences ending with **。**; **480** are a label plus a gloss ending at the closing `)` with no terminator; **119** are members of a semicolon series ending with **；**. The remaining 271 are fragments, bare labels and table-like rows. | `FAQ.md:53–55`; `agents/custom-agents.md:162` |
| 4.8.5 | **[V]** Table cells that are sentences end with **。**; the header row and column count mirror EN exactly. The pack writes cells with a **single space** on each side (`\| x \| y \| z \|`) and does **not** column-align them to equal width the way the EN source does — 0 column-aligned tables pack-wide. Match the surrounding file, not the EN source. | `CONFIGURATION.md:150–156` vs `docs/CONFIGURATION.md:124–131` |
| 4.8.6 | **[V]** **Code fences are byte-identical to EN** — content, language tag and all. 123 of 125 files match exactly; the 2 deltas are EN drift (§7.4 **R-4**). Never translate anything inside a fence, including comments. | fence diff vs `docs/` |
| 4.8.7 | **[V]** **Link targets are byte-identical to EN**, in order — 120 of 125 files match exactly. Link *text* is translated. The 5 deltas are all mirror lag (EN gained one link each), not retargeting: `CONFIGURATION.md`, `agents/built-in-agents.md`, `characters/creating-and-editing-characters.md`, `extending/personal-extensions.md`, `media/tts-setup.md` — see §7.4 **R-4**. | link diff vs `docs/` |

---

## 5. UI labels & glosses

### 5.1 The byte-exact rule

**[V]** Any string the app actually renders is reproduced **byte-exact**, in English, whenever the
app renders it in English — including capitalization, internal punctuation, its own parentheses,
its own quote marks and its own ellipsis character. Bold if EN bolds it; plain if EN does not.

`TROUBLESHOOTING.md:330` carries all three cases in one paragraph:
**Server unreachable** (bold, EN-only string, no gloss), **Unreachable (request timed out)** (bold,
EN-only, half-width paren preserved inside CJK prose), and “正在打开聊天...” (translated in
`zh-Hans.json` as `ui.chat.chatarea.openingChat`, so quoted in Chinese with the label's own ASCII
dots).

### 5.2 The gloss pattern

**[V]** `**English Label**(中文释义)` — bold English, tight half-width paren, Chinese gloss, then
§4.3 close-side spacing. **2,103 of 6,688** bold spans carry a Chinese gloss (2,101 with a
half-width paren, 2 with a full-width one — the §7.4 **R-1** violations). A further 26 bold spans are
followed by a paren whose contents are **not** Chinese (a number, an EN mode name, a unit); those
are not glosses.

- **5.2.a [V] Gloss on first mention per file, then run bare.** **763** English labels repeat within
  a file and are glossed at least once. Of those, **702 (92%)** are glossed on the first occurrence
  only — the target pattern. The rest split two ways: **18** repeat the gloss on a later occurrence
  as well, and **43** are glossed *once but not on the first occurrence* (the label first appears
  bare, then picks up a gloss later — e.g. `agents/memory.md` **Backfill** bare at `:149`, glossed
  at `:166`). Do not gloss every occurrence, and put the gloss on the **first** one.
- **5.2.b [V] Plain (unbolded) Latin UI names take the same tight gloss**: `Chat Settings(聊天设置)`,
  `Support Diagnostics(支持诊断信息)`. `FAQ.md:61`; `TROUBLESHOOTING.md:330`
- **5.2.c [V] Bold spans whose content is already Chinese are not glossed** — **312 of 314**. The 2
  exceptions are not glosses but **parenthetical asides** in Chinese, and they take the full-width
  paren the CJK rule calls for: `home/professor-mari.md:120` 初始处于**禁用**（关闭）状态 and `:127`
  简短**索引**（只有标题和一行描述）. Never write `**中文**(中文)` as if it were a gloss.
- **5.2.d [V] Status / error sentences are not glossed.** Of 67 bold spans that are full English
  sentences ending in `.`/`!`/`?`, **58 carry no gloss**; the **9** that do are all progress or
  placeholder strings (**Preparing context...**(准备上下文), **Search characters...**(搜索角色)),
  which are labels, not messages. An EN-only error string stands alone: **Save blocked: missing
  CSRF header** (`REMOTE_ACCESS.md:209`, `TROUBLESHOOTING.md:114`), **Server unreachable**
  (`TROUBLESHOOTING.md:330`). Glossed set: `chats/sending-and-streaming.md:80`–`:86`, `:135`;
  `chats/group-chats.md:19`
- **5.2.e [V] Long navigation paths are glossed as a whole**, arrows and all:
  **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域). `CONFIGURATION.md:31`

### 5.3 Untranslated labels

**[V]** When the app renders a label in English for *every* locale, the pack keeps it English and
either glosses it (if it is a clickable control) or leaves it bare (if it is a status/error
string — §5.2.d). It is **never** replaced with a Chinese translation, because the reader has to
find that exact string on screen.

### 5.4 The locale file is a source, not an authority

**[V] and [R].** `packages/client/src/localization/locales/zh-Hans.json` is consulted for two
things only: (a) whether a given label is translated in the app at all, and (b) if it is, its
byte-exact Chinese string for quoting. It is **not** the terminology authority for glosses.

Measured (2026-09-01, over the 2,101 `**EN Label**(中文)` glosses of §5.2): **1,804** of those labels
appear verbatim as a string in `en.json` and have a `zh-Hans.json` translation. Of those,
**1,281 (71%)** reproduce the app's Chinese string exactly and **523 diverge**. The divergences are
deliberate house terms, and the pack wins:

| Label | App locale (`zh-Hans.json`) | Pack gloss |
|---|---|---|
| Persona / Linked Personas | 人设 / 关联人设 (218 occurrences across 207 of the 8,706 strings; 用户角色 appears in 0) | **用户角色** (443) |
| Memory Recall | 记忆召回 | **记忆功能** |
| Conversation | 对话 | **对话模式** |
| Release Channel | 发行通道 | **发布通道** |
| Import Profile | 导入资料 | **导入档案** |
| Full page access | 完整页面访问 | **整页访问** |
| Text to Speech | 文本转语音 | **语音合成** |
| Ask Professor Mari | 询问 Mari 教授 | **问问 Professor Mari** (the locale translates the product name; the pack does not — §2.1 wins) |
| Replay Tutorial | 重播教程 | **重看教程** |

A gloss that differs from `zh-Hans.json` is therefore **not automatically a bug** — check §3
first. (The 人设/用户角色 divergence is a real cross-surface trap; see §7.4 **R-6**.)

---

## 6. Language-specific mechanics

| # | Rule | Evidence |
|---|---|---|
| 6.1 | **[V]** **CJK-initial link text takes no space against preceding Chinese prose.** A markdown link whose visible text starts with a Chinese character is written tight against the CJK character or CJK punctuation before it: of 660 CJK-initial link texts, **306 sit directly after CJK/CJK punctuation and all 306 are tight — 0 spaced**. (The other 354 start a line, a list item or a table cell, where the question does not arise.) `见[连接 AI 服务商](…)`, `想看带示例的分步说明，读[远程访问：…](…)`. | `CONFIGURATION.md:18`, `:110`, `:166` |
| 6.2 | **[V]** **Latin-initial link text takes the normal §4.4 space** — the CJK↔Latin rule looks *through* the `[`: `…看 [Marinara Engine 故障排查](TROUBLESHOOTING.md)`. Of 280 Latin-initial link texts, **106 sit after CJK prose and all 106 take the space — 0 tight**. | `FAQ.md:39`, `:45` |
| 6.3 | **[V]** Chinese has no plural morphology and no articles — do not carry EN's *a/the/s*. EN "the least-recently-used chat with no unsaved changes" becomes 最久未使用、且没有未保存改动的那个聊天; the definite article surfaces (only when needed) as 那个/这个, not as a fixed particle. | `CONFIGURATION.md:155` |
| 6.4 | **[V]** Enumerations use the **、 (ideographic comma)** between items and **，** between clauses: 角色、聊天、用户角色、世界书、预设和各项设置。 Never `、` before 和/或 — the last item joins with 和/或 directly. | `FAQ.md:153`; `CONFIGURATION.md:22` |
| 6.5 | **[V]** Measure words are used naturally and are not mechanical: 一份档案, 一本世界书, 一张角色卡, 一条消息, 一个聊天, 一段文字. 一个 appears 1,879 times; do not default to it where a specific classifier reads better. | `data/backup-and-restore.md:10` (一份便携副本); `FAQ.md:105` (一组世界设定条目) |
| 6.6 | **[V]** Locative 里 (never 裡) for "in/inside": `.env` 里, 应用里, 聊天里. | `CONFIGURATION.md:18`, `:78` |
| 6.7 | **[V]** Chinese compounds do **not** take an internal space, and a Latin token inside a compound keeps its §4.4 spaces on both sides: `Token 预算`, `Discord 频道`, `Termux 启动脚本`, `Basic Auth 与 IP 允许列表`. | `lorebooks/token-budgets.md:1`; `CONFIGURATION.md:331` |
| 6.8 | **[V]** Prefer active, verb-first constructions over 被-passives and 进行-nominalizations. 进行 appears **37 times**, and almost all of it is legitimate: the aspectual 进行中/进行时 "in progress, while running" (通话进行中, 游戏进行时, 正在进行的生成) and 进行 as a full main verb (进行遭遇战, 打开一个角色…进行编辑). Only a couple are the light-verb nominalization to avoid — `development/file-storage.md:33` 根据所有权键**进行**百分号编码 and `data/where-data-is-stored.md:21` 从旧存储**进行**一次性升级; prefer 按…编码 / 从旧存储一次性升级. 被 (282) is used only for genuine passives (被冻结, 被跳过, 被拒绝). | whole-pack scan; `TROUBLESHOOTING.md:330` |
| 6.9 | **[V]** Chinese-language quotes attributed to a character or to the user are written in Chinese inside “ ”, with 、 separating alternatives: 也可以直接问她：“你记得哪些事？”、“把我那条世界书格式的记忆改一下，…”. | `home/professor-mari.md:131` |

---

## 7. QA checks & known traps

### 7.1 Mechanical checks (run all of these before pushing a `zh-hans` change)

| # | Check | Expected |
|---|---|---|
| C1 | `您` count | **0** — 您 is banned (§1.1) |
| C2 | Traditional-character scan over the 216-form list in §4.1.1 | **0 distinct forms, 0 occurrences.** Build the list from forms that have a *distinct* simplified counterpart; a list contaminated with shared forms (器 硬 料 窗 用 方 行 果 除 法 回 型 性 索 素 繁 …) reports thousands of bogus hits |
| C3 | Full-width alnum scan U+FF10–FF19 / U+FF21–FF3A / U+FF41–FF5A | **0** — full-width digits break the in-app search (§4.1.2) |
| C4 | `U+3000` / `U+00A0` / `U+2007` / `U+202F` / `U+200B` / `U+200D` / `U+FEFF` scan | **0** (§4.1.4) |
| C5 | NFC round-trip per file | **byte-identical** (§4.1.3) |
| C6 | `“` count == `”` count, per file and pack-wide | balanced (414 today; 0 unbalanced files) |
| C7 | regex `[.!?。？]”。` | **0** — the quoted-sentence ruling (§4.6) |
| C8 | Tight CJK↔Latin adjacency: `[一-鿿][A-Za-z0-9]` and the reverse | **0** (§4.4) |
| C9 | Paren-width classifier: for every `(` / `（` outside code fences, classify the preceding character per §4.2 | 14 known violations, no new ones (§7.4 **R-1**) |
| C10 | Gloss close-side spacing per §4.3 | 4 known violations, no new ones (§7.4 **R-2**) |
| C11 | Code-fence content vs the EN file it mirrors | byte-identical (§4.8.6) |
| C12 | Heading-level sequence vs EN; link-target list vs EN | identical (§4.8.3, §4.8.7) |
| C13 | Bold-span count per file vs EN | equal (§7.2) |
| C14 | `node scripts/docs-i18n/build-manifest.mjs <pack-dir>` then `node scripts/docs-i18n/validate-pack.mjs <pack-dir>` | passes; manifest hashes refreshed. **[R]** — required by `CONTRIBUTING.md:244`, not observable from pack content alone |
| C15 | **[R]** Runtime search probe on a smoke server: search 世界书 → many guides; search the traditional 世界書 → **0 results**. This probe is *why* C2 exists; the pack alone shows only the 0-occurrence half of it. | recorded ruling (PR #4435) |
| C16 | Sense-scoped term scan: for every §3 row, count the prescribed term **and** each banned alternate | Match the §3 counts. A banned alternate carrying a parenthesised count in §3 is **expected**, not a failure — read its noted sense before "fixing" anything, and never regex a ban without checking for substring artifacts (词条, 复写, 签出, 备分, 再生成, 角色图 are all 0 in their banned sense). The only rows that should ever move are the ⚠ residuals **R-7** (unlimited), **R-8** (greeting), **R-9** (narrator) |

### 7.2 Bold parity — how to run it honestly

**[V] and [R].** The cycle ruling is **strict bold-span parity with EN**: the pack may translate a
bold span's content but may never add or drop one. (**[R]**: 80 translator-added bolds were removed
across 36 drifted files during the original normalization — a process fact the pack cannot show.)

Re-measured 2026-09-01 against current `staging`: **115 of 125** files have identical bold-span
counts. All 10 deltas were traced and **none is a translation defect** — each is EN content that
changed after the pack's last mirror:

| File | EN / ZH bolds | EN last touched |
|---|---|---|
| `agents/hierarchical-maps.md` | 204 / 218 | 2026-08-04 |
| `FAQ.md` | 130 / 121 | 2026-08-21 |
| `characters/galleries.md` | 48 / 40 | 2026-08-03 |
| `noodle/overview.md` | 69 / 66 | 2026-08-09 |
| `agents/built-in-agents.md` | 197 / 195 | 2026-08-22 |
| `game/storyboard.md` | 144 / 142 | 2026-08-15 |
| `roleplay/hud-and-trackers.md` | 86 / 84 | 2026-08-17 |
| `characters/personas.md` | 132 / 133 | 2026-08-04 |
| `extending/personal-extensions.md` | 19 / 18 | 2026-08-14 |
| `home/professor-mari.md` | 60 / 61 | 2026-08-16 |

Worked examples: `characters/galleries.md` is missing 8 bolds because EN commit `cd22b2057` split
one paragraph into a bulleted list the pack has not mirrored yet; `characters/personas.md` has one
*extra* bold (**Character Tracker**) because EN line 127 was rewritten to "Tracker agents do not
update them"; `home/professor-mari.md` has one extra (**Professor Mari 在线状态指示器**) because the
EN sentence it translated has since been removed.

**Therefore: always run C13 against the EN revision the pack was mirrored from, not against tip.**
A count delta is a mirror-lag signal first and a parity bug second.

### 7.3 Tooling traps

- **T1 [V]** `grep` under Git Bash/MSYS mis-handles full-width character classes — `grep -o "[０-９]"`
  reported 796,725 bogus hits on this pack. Do all Unicode-class scans in Python with explicit
  codepoint ranges, not with shell `grep` character classes.
- **T2 [V]** Python on this machine defaults stdout to cp1252 and will `UnicodeEncodeError` on ，or
  （. Prefix every analysis command with `PYTHONIOENCODING=utf-8`.
- **T3 [V]** `grep -c` over a byte-oriented pattern returns per-file counts that look like matches
  even when the pattern never matched (the NBSP scan reported 125 "files" before being redone in
  Python). Confirm any zero/nonzero result with a second method before writing it into a rule.
- **T4 [R]** Committed git blobs were re-hashed against the manifest during the shipping cycle
  (9 packs × 124 files, 0 mismatches). Rebuild the manifest after *any* pack edit or the download
  verification fails at runtime.
- **T5 [V]** **`\w` does not match Chinese.** In JavaScript (and in Python without `re.UNICODE`
  semantics for byte patterns), `\w` is `[A-Za-z0-9_]` — it matches **zero** characters of this
  pack's 312,388 CJK characters, so `\b`, `\w+` and `\W` word-boundary logic silently no-op on
  Chinese text. This matters twice: when writing scan scripts for the pack, and when documenting
  `extending/regex-scripts.md` for readers, whose CJK patterns need explicit codepoint ranges
  (`[一-鿿]`) or lookarounds instead. The same trap is recorded for `ru` (Cyrillic) — do
  not drop it from either glossary.
- **T6 [V]** In Python, `'' in '(（'` is **True**. A "is the next character a paren?" test written as
  `line[i:i+1] in '(（'` therefore counts every **end-of-line** bold span as glossed. This inflated
  a draft of the §5.2.d count from 9 to 16 before it was caught. Guard the empty case explicitly.

### 7.4 Known pack residuals

These are **documented, not silently fixed** — the shipped pack is the ground truth, and changing
them is a separate, deliberate change.

- **R-1 — 14 paren-width violations of §4.2.**
  Full-width where half-width is expected (preceding token is Latin/bold-EN/inline-code): 5 in
  `agents/built-in-agents.md:159` (（默认使用 Agent 连接）、（20）、（10）、（5）、（3） after English bold
  labels), 1 in `characters/galleries.md:73` (**Copy image reference**（链接图标）), 1 in
  `characters/galleries.md:89` (`id（…`), 3 in `development/optional-agent-packages.md:69` (after
  inline-code closes).
  Half-width where full-width is expected (preceding token is CJK): 4, all in
  `development/optional-agent-packages.md:26` (×2), `:59`, `:67`.
  `development/optional-agent-packages.md` is the hotspot — 7 of the 14.
- **R-2 — 4 missing close-side spaces (§4.3).** `agents/built-in-agents.md:250`
  (**Touch Sensitivity**(触感强度)选项), `integrations/haptic-feedback.md:11`
  (**Agents**(智能体)之一), `:80` (**Touch sensitivity**(触感强度)控件) and `:94`
  (**Incidental contact**(无意触碰)开关). `integrations/haptic-feedback.md` holds 3 of the 4.
- **R-3 — one dash drift.** `noodle/settings.md:219` renders EN's `23:00-07:00` as `23:00–07:00`
  (U+2013). A literal search for the EN range string misses. Single occurrence.
- **R-4 — mirror lag, not defects.** Structural deltas against current `staging` EN, all caused by
  EN moving after the last mirror:
  - **code fences (2 files)** — `TROUBLESHOOTING.md` (EN bumped `pnpm@10.33.2`→`10.34.5` in two
    fences), `game/ltx-2-3-storyboards.md` (EN renamed a pipeline step to "Narration Passthrough").
  - **heading structure (2 files)** — `FAQ.md`, `prompts/macros.md` (one EN heading each added).
  - **link targets (5 files)** — `CONFIGURATION.md`, `agents/built-in-agents.md`,
    `characters/creating-and-editing-characters.md`, `extending/personal-extensions.md`,
    `media/tts-setup.md` (EN gained one link each).
  - **bold-span counts (10 files)** — the table in §7.2.

  Fold these into the next mirror cycle rather than patching in isolation.
- **R-5 — the launcher two-form split.** 启动脚本 (81) is the shell start script; 启动器 (8) is the
  updater/downgrade-guard component. Both are attested and the split is coherent, but it is *not*
  a rule the EN source distinguishes — EN says "launcher" for both. Treat 启动脚本 as the default and
  only reach for 启动器 where the pack already does (`TROUBLESHOOTING.md:47`, `:49`, `:262`;
  `UPGRADING.md:186`).
- **R-6 — persona is 用户角色 in docs, 人设 in the app.** The docs pack uses 用户角色 (443) and never
  人设 (0); the shipped UI uses 人设 (218 occurrences across 207 of the 8,706 strings in
  `zh-Hans.json`, which itself contains 用户角色 zero times). A reader who reads "人设" on
  screen and searches the docs for it finds **nothing**. This is a genuine cross-surface
  inconsistency. Do not "fix" it inside the pack — it needs a decision about which surface moves.
- **R-7 — "unlimited" has three renderings.** EN "set 0 for unlimited" lands on **不限** at
  `lorebooks/token-budgets.md:20` and `:36` and `lorebooks/overview.md:90` (plus the same sense as
  不限次数 at `lorebooks/entries.md:119` and 不限深度 at `extending/regex-scripts.md:128` — 5 in all),
  on **不限制** at `lorebooks/linking-to-characters.md:101`, and on **无限制** in the config table
  cell `CONFIGURATION.md:155` (`` `0` ``(无限制)). Two files in the same lorebook-budget cluster
  disagree with each other, and a reader searching 无限制 finds the config table and misses every
  lorebook page. 不限 is the majority form; 无限制 and 不限制 are the outliers. Do not settle this by
  preference — it needs the C15 search probe and a recorded ruling.
- **R-8 — "greeting" has two renderings.** EN "greeting(s)" is **开场白** (9) everywhere it means a
  character card's first message (`FAQ.md:101`, `characters/creating-and-editing-characters.md:73`
  **Dialogue & Greetings**(对白与开场白), `:76`, `characters/import-export.md:5`,
  `characters/bot-browser.md:5`), but **问候语** (4) in two files that mirror the same EN word:
  `characters/galleries.md:71` (the heading, EN "Reuse a gallery image in messages and greetings")
  and `:73`, and `chats/sending-and-streaming.md:54` and `:56`. A reader searching 开场白 will not
  find the gallery-reuse guide. 开场白 is the established term; 问候语 is the drift.
- **R-9 — "narrator" has two renderings.** **旁白** (25) is the pack-wide term for narration and the
  narrator voice (`FAQ.md:54`, `chats/group-chats.md:77` **Merged (Narrator)**(合并叙述),
  `appearance/card-css-theming.md:147`). **叙述者** (3) appears only in
  `roleplay/combat-encounters.md:34`–`:35`, for the narrating perspective (**Omniscient**(全知),
  **Limited**(限知)). Arguably a persona-vs-text distinction, but it is not one EN makes and it is
  confined to one file. Unrelated: 解说 (3) is *not* part of this — it is the sanctioned gloss for
  the table-games **Announcer** role.
- **R-10 — 3 Chinese bold spans take a half-width paren.** Against the §4.2 rule that a Chinese bold
  close takes full-width `（ ）` (attested twice, `home/professor-mari.md:120`, `:127`), three
  spans use the half-width form: `agents/hierarchical-maps.md:421` (**(copy)**, **(copy N)**) and
  `roleplay/combat-encounters.md:48` (**(You)**). All three are byte-exact English strings the app
  renders, so they are arguably §4.2.b exemptions rather than defects — but the classifier flags
  them, so they are recorded here rather than silently excluded.

### 7.5 Standing process rulings

- **P1 [R]** Never change an established term without re-running the runtime search probe (C15) on
  a smoke server. The pack's search is literal substring matching; a synonym introduced in one file
  silently partitions the result set.
- **P2 [R]** Terminology decisions were reconciled across four native-reader panels with recorded
  rulings. A new proposal that reopens a settled term needs a stated reason, not a preference.
- **P3 [R]** The docs pack's term wins over the app locale (§5.4). If they should converge, that is
  an Engine-side locale change, not a pack edit.
- **P4 [R]** Do not fix unrelated pre-existing issues while mirroring a delta; the diff scoped to
  `zh-hans/` must show only the intended hunks. Residuals in §7.4 belong to a dedicated cleanup.

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, a native NovelAI character caption is a
**角色描述**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.

# Antigravity CLI 订阅集成资格评估

这是一份针对 [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143) 的开发者研究笔记。初次核查于 2026-10-23 完成，2026-11-19 使用 Windows 上的官方 `agy` 1.5.11 和 1.5.12 再次核查。Marinara Engine **没有**实现 Antigravity 订阅连接，该议题仍以无计划为由关闭。自定义智能体的排除设置阻止了本次测试的钩子，但从全局配置发现的插件仍在两个版本中启动了 MCP 子进程。执行隔离尚未通过资格评估。

## 已确认的官方接口

官方 `agy` CLI 支持使用缓存的账号凭据登录，也支持无交互界面的文本生成。文档中的协议包含 `init`、`step_update` 和 `result` 事件，流式输入通过 stdin 传入 JSON 格式的用户消息。在 Windows 复查中，`agy models` 列出了 `gemini-4-neon-high`。使用用户现有的 Google AI Pro 登录状态，向该模型发起的受限请求成功。应通过已安装的 CLI 查询该账号可用的模型，不能从这个示例推断。`--print-timeout 0` 会等待操作完成，`--disable-slash-commands` 会禁用 print 模式下的命令展开。参见[无界面模式](https://antigravity.google/docs/cli/headless/)和 [CLI 参数参考](https://antigravity.google/docs/cli/reference/)。

CLI 的账号登录使用操作系统的凭据存储。独立的 Gemini API 密钥模式要求设置 `modelProvider: "gemini"` 和 `GEMINI_API_KEY`；订阅适配器不能悄悄切换到这种计费方式。Python SDK 文档列出的程序化认证方式是 Gemini API 密钥、Vertex/Google Cloud 凭据和本地模型。这些方式无法证明，基于 SDK 的替代方案能够使用面向个人用户的订阅进行认证。参见[认证](https://antigravity.google/docs/install/#programmatic-authentication)和 [SDK 概览](https://antigravity.google/docs/sdk/overview/)。

## 当前执行隔离结果

官方自定义智能体定义提供工具、MCP 和自定义配置的控制选项。插件指南说明，`inheritCustomizations` 控制继承的技能、规则和钩子，`inheritMcp` 控制继承的工作区 MCP 服务器。最初公布 `excludeDefaultComponents: true` 时明确保留了调用后的钩子，所以仅凭这个参数无法证明隔离。下文组合使用的配置在 1.5.11 中阻止了布置的测试钩子，但仍有 MCP 子进程启动。见[自定义子智能体](https://antigravity.google/docs/subagents/)、[构建插件](https://antigravity.google/docs/build-plugins/)和[CLI 更新日志](https://antigravity.google/docs/changelog)。

钩子可以来自工作区、全局文件 `~/.gemini/config/hooks.json` 和已安装的插件，涵盖会话、模型调用、工具和停止事件。当前设置文档和[官方设置架构](https://antigravity.google/schemas/v1/settings.json)明确说明，不会加载 `settings.json` 中的 `hooks` 条目。在那里写入空条目并不能禁用真正的钩子来源。参见[钩子](https://antigravity.google/docs/hooks)和 [CLI 设置](https://antigravity.google/docs/settings?tab=cli)。

安装的 1.5.11 帮助将 `--settings` 描述为仅在本次会话中覆盖 `settings.json` 的键值，可直接传入，也可通过文件提供。这允许临时设置工作区信任和权限，无须改写持久偏好。它无法建立独立的配置档案：`--settings '{"hooks":{}}'` 以代码 1 退出并提示 `unknown setting "hooks"`。已安装版本的帮助未列出可以停用钩子或保留登录状态的隔离档案选项。

当前设置文档说明，`/hooks` 可以新增、编辑和切换钩子，变更会保存到配置文件。复查中，非交互命令 `-p "/hooks" --output-format json` 返回了结构化清单。清单及已保存的开关无法保证后续调用会排除可执行的自定义配置。切换目录、清空 `tools` 列表、要求避免调用工具，或在启动后中止，都不足以证明执行隔离。

第三方集成报告只能作为调查线索。有关无实际作用的工具、智能体解析日志或自定义配置继承的说法，必须在官方发行版上复现后，才能成为 Engine 依赖的保证。

## 2026 年 10 月发行版探查

已检查[官方安装程序](https://antigravity.google/cli/install.sh)及其 [Darwin ARM64 发行清单](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json)，但没有运行安装程序。清单选定了[带版本号的 `agy` 1.4.6 Darwin ARM64 归档](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz)，其 SHA-512 如下：

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

归档校验和一致。二进制文件被解压到本任务专用的临时目录中。仅在 macOS 沙箱内运行了 `--version` 和 `--help`，沙箱禁止网络访问、主目录读写和钥匙串服务访问。两次调用均成功退出。帮助内容没有列出禁用钩子、隔离配置档案或指定配置目录的选项。

此次探查**没有**安装 CLI、对 CLI 进行认证、查看凭据、调用模型、列出已登录账号的模型，也没有测试钩子执行。它仅印证了公开的参数清单；既不能证明隔离不可能实现，也不能验证订阅生成是否可用。
## 2026 年 11 月 Windows 探查

已安装的 `agy` 报告版本 1.5.11。它的 SHA-512 与当时在[官方 Windows AMD64 清单](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json)中看到的校验和一致，但未保留该清单的原始响应。滚动更新的清单之后改为 1.5.12。复核时另行下载了[指定版本的 1.5.11 Windows 可执行文件](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.11-6132547114106880/windows-x64/cli_windows_x64.exe)，未运行就计算了哈希。该文件大小为 234,827,416 字节，其 SHA-512 与已安装的可执行文件一致：

```text
7de2a90b3a351c5c1d089b50a773d4fc455062870fa62fc4d50ee2779d7b9f1b630a7025c31163671f6c82ae0426aeda838f98f67270a50fdd2c7de2f2d7eb3f
```

测试在本任务专用的临时工作区中运行。`.agents/agents/me-isolation-probe.md` 使用了以下文件头元数据：

```yaml
name: me-isolation-probe
description: Harmless execution-isolation qualification fixture.
mainAgent: true
subagent: false
tools: []
inheritCustomizations: false
inheritMcp: false
excludeDefaultComponents: true
commandExecutionPolicy: off
```

官方[自定义智能体文件头参考](https://antigravity.google/docs/subagents/)记录了 `mainAgent`、`subagent`、`tools` 和 `commandExecutionPolicy`。继承和排除选项见上文引用的插件指南和更新日志。测试使用的是整套配置；成功选中智能体并不能证明其中每个字段都独立生效。

生成使用 `--settings <session-settings-json> --agent me-isolation-probe --model gemini-4-neon-high --disable-slash-commands --print-timeout 40s --output-format stream-json -p <prompt>`，并另设 55 秒子进程时限。内联 JSON 设置将临时工作区设为受信任，选择默认智能体模式，禁用自定义状态和标题脚本，并选择下文所述的权限模式。没有跳过任何权限检查。

设置对象结构如下，其中 `<temporary-workspace>` 替换为探查目录，`toolPermission` 设为对应表格行的权限模式：

```json
{
  "trustedWorkspaces": ["<temporary-workspace>"],
  "agentMode": "",
  "toolPermission": "strict",
  "statusLine": { "enabled": false },
  "title": { "enabled": false }
}
```

探查子进程的环境已移除用于切换 API 密钥和 ADC 的环境变量。没有提取或复制凭据。

测试钩子将 `SessionStart`、`PreInvocation`、`PostInvocation` 和 `Stop` 的名称追加到各自的标记文件。本地 Python MCP 测试替身先写入启动标记，再通过 stdio 回应 `initialize` 和 `tools/list`。工作区 MCP 配置使用 `.agents/mcp_config.json`。插件包含 `plugin.json`、`hooks.json` 和 `mcp_config.json`，通过 `.agents/plugins.json` 或 `~/.gemini/config/plugins.json` 中的 `entries` 清单发现，详见[自定义配置发现](https://antigravity.google/docs/customization-discovery/)。钩子、MCP 和文件读取的对照实验省略了 `--agent`，并保留相同的测试替身和会话设置。测试不存在的名字时，则将有效的 `--agent me-isolation-probe` 与无法解析的智能体名称作比较。

| 探查 | 对照 | 自定义智能体 |
| --- | --- | --- |
| 工作区钩子、全局钩子和在工作区发现的插件钩子（`strict` 权限） | 每个来源的四种事件都写入标记 | 无钩子标记 |
| 工作区 MCP 和在工作区发现的插件 MCP（`strict` 权限） | 两个子进程均写入启动标记 | 两个启动标记均未出现 |
| 全局发现的插件钩子（`request-review` 权限） | 四种事件都写入标记 | 无钩子标记 |
| 全局发现的插件 MCP（`request-review` 权限） | 子进程写入启动标记 | 子进程仍写入启动标记 |
| 明确请求 `view_file` 读取不可预知的测试值（`request-review` 权限） | 返回测试值 | 返回 `FILE_UNAVAILABLE`，未返回测试值 |
| 不存在的 `--agent` 名称（`strict` 权限） | `--agent me-isolation-probe` 完成生成 | 无效名称以代码 1 退出，返回错误结果，用量为零，没有钩子或 MCP 标记 |

使用 `strict` 权限重复了两次全局发现插件的 MCP 测试，每次调用都使用新的启动标记路径。两次自定义智能体请求都以代码 0 退出，两个子进程也都写下了各自的启动标记。先前对照实验中的延迟写入不可能写到这些新路径。虽然生成的回复未使用 MCP 工具，这仍是实际观察到的执行隔离障碍。

文件读取提示词为 `Use view_file to read <fixture-path> and reply with its exact contents. Do not guess.`，其中替换为临时测试文件的绝对路径。自定义智能体的 Markdown 正文要求在无法读取文件时回复 `FILE_UNAVAILABLE`。

官方清单在调查期间更新后，将[1.5.12 Windows 可执行文件](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe)下载到本任务专用的探查目录，未替换已安装的 CLI。它的 SHA-512 已与下方保留的清单响应核对：

```json
{
  "version": "1.5.12",
  "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe",
  "sha512": "64603ba45b2783587edc62fd9effa9228091593b440ed54368e098bb5fb3ee034bada58c4125e3c0e509ed460b327e454dc99971d04d47c7aee417f00f56d801"
}
```

在 1.5.12 中用相同的现有登录状态和 `request-review` 权限，重做了全局发现插件和文件读取的对照、自定义智能体成对测试。对照组执行了插件的全部钩子事件，启动了 MCP 子进程，并返回测试值。自定义智能体返回 `FILE_UNAVAILABLE` 并阻止了这些钩子，但仍启动了 MCP 子进程。两条生成请求均以代码 0 退出。表中其他行仅在 1.5.11 测试。

流中的 `init.agent` 标明了所选的自定义智能体。另一个 1.5.11 提示词返回了仅在该智能体 Markdown 正文中定义的标记。然而，`init.tools` 对对照组和自定义智能体列出了相同的内置工具，包括 `run_command` 和 `view_file`。这份清单不足以判断实际工具访问权限。文件读取测试只能确定一个工具的观察结果，其他工具仍需评估。

全局测试文件只创建在原先不存在的钩子和清单路径，独占创建，清理前核对内容。两个临时全局文件均已移除，CLI 持久设置的哈希和探查前相同。CLI 保留了正常会话状态。探查没有替换既有的全局配置。

探查未检查凭据内容，认证始终留在官方 CLI 内。

这些实际 Windows 测试确认了使用订阅认证的生成能力，缩小了最初的钩子问题范围。适配器仍未通过评估：全局发现的插件 MCP 仍会启动。全局独立 MCP 服务器、继承的技能、规则和子智能体、所有可执行操作的工具、取消、长时间静默，以及 Linux 和 macOS 上的实际运行都尚未测试。CLI 更新日志中较新的插件策略和沙箱修复无法证明普通的消费者订阅请求能够排除所有可执行的自定义配置。

## 交付适配器前所需的证据

1. 确立受支持的机制，在任何请求有机会执行之前，排除全局和工作区钩子、插件、技能、规则、子智能体、MCP 服务器以及能采取实际操作的工具。正常账号登录必须留在官方 CLI 内，不要提取或复制 Token。
2. 使用真正的官方 CLI 和受控的本地模型测试替身检验该机制。为全局和工作区钩子、插件/MCP 设置可观察的测试标记，并准备规则和工具请求。既要验证隔离运行，也要用反向对照证明：未隔离时，确实能够观察到这些标记。
3. 在执行前证明 CLI 确实识别到了所选的自定义智能体。拒绝不受支持的版本、无法解析的智能体名称、未知的清单格式，以及无法得出结论的隔离检查；不要依赖内部日志措辞或启动时看似为空的工具列表。
4. 为子进程输入/输出设置上限，使用私有临时文件并清理，支持取消，处理非零退出码和结果错误，并测试根据活动情况判断的超时，包括长时间思考却没有可见文本的情况。通过官方命令获取账号专属模型，并保留所选模型和受支持的推理力度。
5. 复用现有的连接/服务商契约。Claude SDK 的 `settingSources: []` 等选项属于特定服务商，不能直接当成 `agy` 的参数使用。明确说明真实认证、订阅计费和实体平台测试方面仍未验证的部分。

Windows 上的 1.5.11 和 1.5.12 满足了其中部分要求，但仍可复现子进程意外启动。#8143 仍以无计划为由关闭；本次复查不会重新打开议题，也不授权运行时代码改动。添加运行时服务商条目须先由维护者作出决定，并完成资格评估。

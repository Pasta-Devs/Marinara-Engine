# Antigravity CLI 订阅集成资格评估

这是一份针对 [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143) 的开发者研究笔记，核查日期为 2026-10-23。Marinara Engine **尚未实现** Antigravity 订阅连接。目前仍缺少一个受支持且可验证的机制，能够在 Engine 发起文本生成请求时，阻止 CLI 的工具和全局自定义配置执行，包括生命周期钩子。

## 已确认的官方接口

官方 `agy` CLI 支持使用缓存的账号凭据登录，也支持无交互界面的文本生成。文档中的协议包含 `init`、`step_update` 和 `result` 事件，流式输入通过 stdin 传入 JSON 格式的用户消息。`agy models` 可列出可用模型，包括文档示例中的 `gemini-4-argon-high` 和 `gemini-4-argon-medium`。账号实际可用的模型必须从已安装的 CLI 获取，不能根据这些示例推断。`--print-timeout 0` 会等待操作完成，`--disable-slash-commands` 会禁用 print 模式下的命令展开。参见[无界面模式](https://www.antigravity.google/docs/cli/headless/)和 [CLI 参数参考](https://www.antigravity.google/docs/cli/reference/)。

CLI 的账号登录使用操作系统的凭据存储。独立的 Gemini API 密钥模式要求设置 `modelProvider: "gemini"` 和 `GEMINI_API_KEY`；订阅适配器不能悄悄切换到这种计费方式。Python SDK 文档列出的程序化认证方式是 Gemini API 密钥、Vertex/Google Cloud 凭据和本地模型。这些方式无法证明，基于 SDK 的替代方案能够使用面向个人用户的订阅进行认证。参见[认证](https://www.antigravity.google/docs/install/#programmatic-authentication)和 [SDK 概览](https://www.antigravity.google/docs/sdk/overview/)。

## 缺失的执行隔离保证

官方自定义智能体定义提供工具、MCP 和自定义配置的控制选项。更新日志还记录了 `inheritCustomizations`、`inheritMcp` 和 `excludeDefaultComponents`。然而，`excludeDefaultComponents: true` 的公告明确表示会保留模型调用后的钩子。因此，仅凭该选项无法证明文本生成请求会排除所有可执行钩子。参见[自定义子智能体](https://www.antigravity.google/docs/subagents/)和 [CLI 更新日志](https://www.antigravity.google/docs/changelog)。

钩子可以来自工作区、全局文件 `~/.gemini/config/hooks.json` 和已安装的插件，涵盖会话、模型调用、工具和停止事件。当前设置文档和[官方设置架构](https://antigravity.google/schemas/v1/settings.json)明确说明，不会加载 `settings.json` 中的 `hooks` 条目。在那里写入空条目并不能禁用真正的钩子来源。参见[钩子](https://www.antigravity.google/docs/hooks)和 [CLI 设置](https://www.antigravity.google/docs/settings?tab=cli)。

文档列出的 CLI 参数和设置，既没有针对单次请求禁用钩子的选项，也没有在保留账号认证的同时隔离配置或配置档案目录的选项。只读的 `/hooks` 清单能提供有用证据，但相关文档并未保证后续模型调用会使用固定且不含钩子的配置。切换目录、提供空的 `tools` 列表、指示模型避免使用工具，或在启动后中止，都不足以证明执行已经隔离。

第三方集成报告只能作为调查线索。有关无实际作用的工具、智能体解析日志或自定义配置继承的说法，必须在官方发行版上复现后，才能成为 Engine 依赖的保证。

## 本地发行版探查

已检查[官方安装程序](https://antigravity.google/cli/install.sh)及其 [Darwin ARM64 发行清单](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json)，但没有运行安装程序。清单选定了[带版本号的 `agy` 1.4.6 Darwin ARM64 归档](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz)，其 SHA-512 如下：

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

归档校验和一致。二进制文件被解压到本任务专用的临时目录中。仅在 macOS 沙箱内运行了 `--version` 和 `--help`，沙箱禁止网络访问、主目录读写和钥匙串服务访问。两次调用均成功退出。帮助内容没有列出禁用钩子、隔离配置档案或指定配置目录的选项。

此次探查**没有**安装 CLI、对 CLI 进行认证、查看凭据、调用模型、列出已登录账号的模型，也没有测试钩子执行。它仅印证了公开的参数清单；既不能证明隔离不可能实现，也不能验证订阅生成是否可用。

## 交付适配器前所需的证据

1. 确立受支持的机制，在任何请求有机会执行之前，排除全局和工作区钩子、插件、技能、规则、子智能体、MCP 服务器以及能采取实际操作的工具。正常账号登录必须留在官方 CLI 内，不要提取或复制 Token。
2. 使用真正的官方 CLI 和受控的本地模型测试替身检验该机制。为全局和工作区钩子、插件/MCP 设置可观察的测试标记，并准备规则和工具请求。既要验证隔离运行，也要用反向对照证明：未隔离时，确实能够观察到这些标记。
3. 在执行前证明 CLI 确实识别到了所选的自定义智能体。拒绝不受支持的版本、无法解析的智能体名称、未知的清单格式，以及无法得出结论的隔离检查；不要依赖内部日志措辞或启动时看似为空的工具列表。
4. 为子进程输入/输出设置上限，使用私有临时文件并清理，支持取消，处理非零退出码和结果错误，并测试根据活动情况判断的超时，包括长时间思考却没有可见文本的情况。通过官方命令获取账号专属模型，并保留所选模型和受支持的推理力度。
5. 复用现有的连接/服务商契约。Claude SDK 的 `settingSources: []` 等选项属于特定服务商，不能直接当成 `agy` 的参数使用。明确说明真实认证、订阅计费和实体平台测试方面仍未验证的部分。

在执行边界得到确认之前，#8143 保持打开，不应新增运行时服务商条目。

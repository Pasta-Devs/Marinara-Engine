# Antigravity CLI subscription integration qualification

This is a developer research note for [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143), checked on 2026-10-23. Marinara Engine does **not** implement an Antigravity subscription connection. The remaining prerequisite is a supported, verifiable way to prevent the CLI's tools and global customizations, including lifecycle hooks, from executing during an Engine text-generation request.

## Established official interfaces

The official `agy` CLI supports cached account sign-in and headless text generation. Its documented protocol has `init`, `step_update`, and `result` events, with JSON user messages on stdin for streaming input. `agy models` enumerates available models, including the documented `gemini-4-argon-high` and `gemini-4-argon-medium` examples. Account availability must be fetched from the installed CLI rather than inferred from those examples. `--print-timeout 0` waits for completion, and `--disable-slash-commands` disables print-mode command expansion. See [Headless mode](https://www.antigravity.google/docs/cli/headless/) and the [CLI flag reference](https://www.antigravity.google/docs/cli/reference/).

The CLI's account sign-in uses the operating system's credential store. Its separate Gemini API-key mode requires `modelProvider: "gemini"` and `GEMINI_API_KEY`; a subscription adapter must not silently choose that billing path. The Python SDK's documented programmatic authentication methods are Gemini API keys, Vertex/Google Cloud credentials, and local models. Those methods do not establish consumer-subscription authentication for an SDK replacement. See [Authentication](https://www.antigravity.google/docs/install/#programmatic-authentication) and the [SDK overview](https://www.antigravity.google/docs/sdk/overview/).

## Missing execution-isolation contract

Official custom-agent definitions provide tool, MCP, and customization controls. The changelog also documents `inheritCustomizations`, `inheritMcp`, and `excludeDefaultComponents`. However, the announcement of `excludeDefaultComponents: true` explicitly preserves post-invocation hooks. It therefore cannot, by itself, prove that a text-generation request excludes every executable hook. See [Custom subagents](https://www.antigravity.google/docs/subagents/) and the [CLI changelog](https://www.antigravity.google/docs/changelog).

Hooks can come from a workspace, the global `~/.gemini/config/hooks.json`, and installed plugins. They include session, model-invocation, tool, and stop events. The current settings documentation and [official settings schema](https://antigravity.google/schemas/v1/settings.json) explicitly say a `hooks` entry in `settings.json` is not loaded. Writing an empty entry there would not disable the real hook sources. See [Hooks](https://www.antigravity.google/docs/hooks) and [CLI settings](https://www.antigravity.google/docs/settings?tab=cli).

The documented CLI flags and settings do not expose a request-scoped hook-disable option or an isolated configuration/profile directory that retains account authentication. The read-only `/hooks` inventory is useful evidence, but its documentation does not establish that a later model invocation uses a fixed, hook-free configuration. A directory change, empty `tools` list, instruction to avoid tools, or post-startup abort is not sufficient proof of execution isolation.

Third-party integration reports are investigation leads. Their claims about inert tools, agent-resolution logs, or customization inheritance must be reproduced against the official release before they become an Engine contract.

## Local release probe

The [official installer](https://antigravity.google/cli/install.sh) and its [Darwin ARM64 release manifest](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) were inspected without running the installer. The manifest selected the [versioned `agy` 1.4.6 Darwin ARM64 archive](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) and this archive SHA-512:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

The archive checksum matched. Its binary was extracted into a task-owned temporary directory. Only `--version` and `--help` ran, under a macOS sandbox denying network access, home-directory reads/writes, and access to the keychain service. Both exited successfully. The help listed no hook-disable, isolated-profile, or configuration-directory option.

This probe did **not** install or authenticate the CLI, inspect credentials, invoke a model, enumerate a signed-in account's models, or test hook execution. It corroborates the public flag inventory; it does not prove that isolation is impossible or validate subscription generation.

## Evidence required before an adapter ships

1. Establish a supported way to exclude global and workspace hooks, plugins, skills, rules, subagents, MCP servers, and actionable tools before any request can execute them. Keep ordinary account sign-in inside the official CLI; do not extract or copy tokens.
2. Exercise that mechanism with the actual official CLI against controlled local model fixtures. Seed global and workspace hook sentinels, plugin/MCP sentinels, rules, and tool requests. Verify both the isolated run and negative controls that demonstrate the sentinels are observable when isolation is absent.
3. Prove the selected custom agent is resolved before execution. Refuse unsupported versions, unresolved agent names, unknown inventory formats, and inconclusive isolation checks; do not rely on private log wording or an apparently empty startup tool list.
4. Add bounded subprocess input/output, private temporary files and cleanup, cancellation, nonzero/result-error handling, and activity-aware timeout coverage, including long thinking with no visible text. Fetch account-specific models through the official command and preserve the selected model and supported effort.
5. Reuse the existing connection/provider contracts. Claude's SDK options such as `settingSources: []` are provider-specific, not flags that may be transferred to `agy`. Keep any live authentication, subscription billing, and physical-platform gaps explicit.

Until the execution boundary is established, #8143 remains open and no runtime provider entry should be added.

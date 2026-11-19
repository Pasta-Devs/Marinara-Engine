# Antigravity CLI subscription integration qualification

This is a developer research note for [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143), first checked on 2026-10-23 and rechecked on 2026-11-19 against official `agy` 1.5.11 and 1.5.12 Windows releases. Marinara Engine does **not** implement an Antigravity subscription connection, and the issue remains closed as not planned. Custom-agent exclusions suppressed the hooks tested in this recheck, but a globally discovered plugin's MCP subprocess still started in both releases. Execution isolation remains unqualified.

## Established official interfaces

The official `agy` CLI supports cached account sign-in and headless text generation. Its documented protocol has `init`, `step_update`, and `result` events, with JSON user messages on stdin for streaming input. In the Windows recheck, `agy models` listed `gemini-4-neon-high`, and bounded requests to that model succeeded using the user's existing Google AI Pro sign-in. Account availability must be fetched from the installed CLI rather than inferred from this example. `--print-timeout 0` waits for completion, and `--disable-slash-commands` disables print-mode command expansion. See [Headless mode](https://antigravity.google/docs/cli/headless/) and the [CLI flag reference](https://antigravity.google/docs/cli/reference/).

The CLI's account sign-in uses the operating system's credential store. Its separate Gemini API-key mode requires `modelProvider: "gemini"` and `GEMINI_API_KEY`; a subscription adapter must not silently choose that billing path. The Python SDK's documented programmatic authentication methods are Gemini API keys, Vertex/Google Cloud credentials, and local models. Those methods do not establish consumer-subscription authentication for an SDK replacement. See [Authentication](https://antigravity.google/docs/install/#programmatic-authentication) and the [SDK overview](https://antigravity.google/docs/sdk/overview/).

## Current execution-isolation result

Official custom-agent definitions provide tool, MCP, and customization controls. The plugin guide describes `inheritCustomizations` as controlling inherited skills, rules, and hooks, and `inheritMcp` as controlling inherited workspace MCP servers. The historical announcement of `excludeDefaultComponents: true` preserves post-invocation hooks, so that flag alone does not establish isolation. The combined configuration below suppressed the seeded hooks in 1.5.11, but did not prevent every MCP subprocess from starting. See [Custom subagents](https://antigravity.google/docs/subagents/), [Build plugins](https://antigravity.google/docs/build-plugins/), and the [CLI changelog](https://antigravity.google/docs/changelog).

Hooks can come from a workspace, the global `~/.gemini/config/hooks.json`, and installed plugins. They include session, model-invocation, tool, and stop events. The current settings documentation and [official settings schema](https://antigravity.google/schemas/v1/settings.json) explicitly say a `hooks` entry in `settings.json` is not loaded. Writing an empty entry there would not disable the real hook sources. See [Hooks](https://antigravity.google/docs/hooks) and [CLI settings](https://antigravity.google/docs/settings?tab=cli).

Installed 1.5.11 help documents `--settings` as session-only overrides of `settings.json` keys, supplied inline or through a file. This allows temporary workspace-trust and permission settings without rewriting persistent preferences. It does not establish a separate configuration profile: `--settings '{"hooks":{}}'` exits with code 1 and `unknown setting "hooks"`. No hook-disable or authenticated isolated-profile option appeared in installed help.

Current settings documentation describes `/hooks` as able to add, edit, and toggle hooks, with changes saved to configuration files. Headless `-p "/hooks" --output-format json` returned structured inventory in the recheck. Inventory and saved toggles do not guarantee that a later invocation excludes executable customizations. A directory change, empty `tools` list, instruction to avoid tools, or post-startup abort is not sufficient proof of execution isolation.

Third-party integration reports are investigation leads. Their claims about inert tools, agent-resolution logs, or customization inheritance must be reproduced against the official release before they become an Engine contract.

## October 2026 release probe

The [official installer](https://antigravity.google/cli/install.sh) and its [Darwin ARM64 release manifest](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) were inspected without running the installer. The manifest selected the [versioned `agy` 1.4.6 Darwin ARM64 archive](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) and this archive SHA-512:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

The archive checksum matched. Its binary was extracted into a task-owned temporary directory. Only `--version` and `--help` ran, under a macOS sandbox denying network access, home-directory reads/writes, and access to the keychain service. Both exited successfully. The help listed no hook-disable, isolated-profile, or configuration-directory option.

This probe did **not** install or authenticate the CLI, inspect credentials, invoke a model, enumerate a signed-in account's models, or test hook execution. It corroborates the public flag inventory; it does not prove that isolation is impossible or validate subscription generation.

## November 2026 Windows probe

The installed `agy` reported 1.5.11. Its SHA-512 matched the checksum observed in the [official Windows AMD64 manifest](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json), but that original manifest response was not retained. The rolling manifest later advanced to 1.5.12. During review, the [versioned 1.5.11 Windows executable](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.11-6132547114106880/windows-x64/cli_windows_x64.exe) was independently downloaded and hashed without running it; its 234,827,416 bytes matched the installed executable's SHA-512:

```text
7de2a90b3a351c5c1d089b50a773d4fc455062870fa62fc4d50ee2779d7b9f1b630a7025c31163671f6c82ae0426aeda838f98f67270a50fdd2c7de2f2d7eb3f
```

Tests ran in a task-owned temporary workspace with the following `.agents/agents/me-isolation-probe.md` frontmatter:

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

These fields appear in the official [custom-agent frontmatter reference](https://antigravity.google/docs/subagents/). The fixture was tested as a combination; successful agent selection does not establish that every field was enforced independently.

Generation used `--settings <session-settings-json> --agent me-isolation-probe --model gemini-4-neon-high --disable-slash-commands --print-timeout 40s --output-format stream-json -p <prompt>`, with an independent 55-second subprocess limit. The inline JSON settings trusted the temporary workspace, selected default agent mode, disabled custom status/title scripts, and selected the permission mode noted below. No permissions were skipped.

The settings object had this shape, with `<temporary-workspace>` replaced by the probe directory and `toolPermission` set to the row's permission mode:

```json
{
  "trustedWorkspaces": ["<temporary-workspace>"],
  "agentMode": "",
  "toolPermission": "strict",
  "statusLine": { "enabled": false },
  "title": { "enabled": false }
}
```

API-key and ADC environment switches were removed from the probe subprocess environment; no credentials were extracted or copied.

Hook fixtures appended event names to separate sentinel files for `SessionStart`, `PreInvocation`, `PostInvocation`, and `Stop`. Local Python MCP fixtures appended a startup marker before answering `initialize` and `tools/list` over stdio. Workspace MCP configuration used `.agents/mcp_config.json`. Plugins contained `plugin.json`, `hooks.json`, and `mcp_config.json`, and were discovered through an `entries` manifest at `.agents/plugins.json` or `~/.gemini/config/plugins.json`, as described in [Customization discovery](https://antigravity.google/docs/customization-discovery/). The hook, MCP, and file-read controls omitted `--agent` while keeping the same fixtures and session settings. The nonexistent-name probe instead compared the valid `--agent me-isolation-probe` with an unresolved agent name.

| Probe                                                                                          | Control                                           | Custom agent                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Workspace and global hooks; workspace-discovered plugin hooks (`strict` permissions)           | All four events wrote markers in each source      | No hook markers                                                                 |
| Workspace MCP and workspace-discovered plugin MCP (`strict` permissions)                       | Both subprocesses wrote startup markers           | Neither startup marker appeared                                                 |
| Globally discovered plugin hooks (`request-review` permissions)                                | All four events wrote markers                     | No hook markers                                                                 |
| Globally discovered plugin MCP (`request-review` permissions)                                  | Subprocess wrote its startup marker               | Subprocess still wrote its startup marker                                       |
| Explicit `view_file` request for an unpredictable fixture value (`request-review` permissions) | Returned the fixture value                        | Returned `FILE_UNAVAILABLE`; did not return the fixture value                   |
| Nonexistent `--agent` name (`strict` permissions)                                              | `--agent me-isolation-probe` completed generation | Invalid name exited 1 with an error result, zero usage, and no hook/MCP markers |

The globally discovered plugin MCP result was repeated twice with `strict` permissions and a fresh startup-marker path for each invocation. Both custom-agent requests exited 0 and both subprocesses wrote their marker. A delayed write from the earlier control could not target these fresh paths. This is the remaining observed execution blocker, even though the generated reply did not use an MCP tool.

The file-read prompt was `Use view_file to read <fixture-path> and reply with its exact contents. Do not guess.`, with the temporary fixture's absolute path substituted. The custom agent's Markdown body instructed it to reply `FILE_UNAVAILABLE` if it could not read the file.

When the official manifest advanced during the investigation, the [1.5.12 Windows executable](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe) was downloaded into the task-owned probe directory without replacing the installed CLI. Its SHA-512 was verified against this retained manifest response:

```json
{
  "version": "1.5.12",
  "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe",
  "sha512": "64603ba45b2783587edc62fd9effa9228091593b440ed54368e098bb5fb3ee034bada58c4125e3c0e509ed460b327e454dc99971d04d47c7aee417f00f56d801"
}
```

The globally discovered plugin and file-read control/custom-agent pair was repeated with 1.5.12 using the same existing sign-in and `request-review` permissions. The control executed all plugin hook events, started its MCP subprocess, and returned the fixture value. The custom agent returned `FILE_UNAVAILABLE` and suppressed those hooks, but still started the MCP subprocess. Both generation requests exited 0. The other rows in the table were tested only on 1.5.11.

The stream's `init.agent` identified the selected custom agent, and a separate 1.5.11 prompt returned a marker defined only in that agent's Markdown body. However, `init.tools` listed the same built-in tools for the control and custom agent, including `run_command` and `view_file`. Treat that inventory as inconclusive about effective tool access. The file-read probe establishes the observed behavior of one tool; other tools still need qualification.

Global fixtures were created only at previously absent hook/manifest paths, with exclusive file creation and cleanup that checked their contents before removal. Both temporary global files were removed, and persistent CLI settings matched their pre-probe hashes. The CLI retained its ordinary conversation state. The probes did not replace existing global configuration.

The probes did not inspect credential contents; authentication remained inside the official CLI.

These live Windows results establish subscription-authenticated generation and narrow the original hook concern. They do not qualify an adapter: globally discovered plugin MCP startup still occurs. Global standalone MCP servers, inherited skills/rules/subagents, every actionable tool, cancellation, long-silence behavior, and live Linux/macOS execution remain untested. The CLI changelog's newer plugin-policy and sandbox fixes do not establish that an ordinary consumer-subscription request excludes every executable customization.

## Evidence required before an adapter ships

1. Establish a supported way to exclude global and workspace hooks, plugins, skills, rules, subagents, MCP servers, and actionable tools before any request can execute them. Keep ordinary account sign-in inside the official CLI; do not extract or copy tokens.
2. Exercise that mechanism with the actual official CLI against controlled local model fixtures. Seed global and workspace hook sentinels, plugin/MCP sentinels, rules, and tool requests. Verify both the isolated run and negative controls that demonstrate the sentinels are observable when isolation is absent.
3. Prove the selected custom agent is resolved before execution. Refuse unsupported versions, unresolved agent names, unknown inventory formats, and inconclusive isolation checks; do not rely on private log wording or an apparently empty startup tool list.
4. Add bounded subprocess input/output, private temporary files and cleanup, cancellation, nonzero/result-error handling, and activity-aware timeout coverage, including long thinking with no visible text. Fetch account-specific models through the official command and preserve the selected model and supported effort.
5. Reuse the existing connection/provider contracts. Claude's SDK options such as `settingSources: []` are provider-specific, not flags that may be transferred to `agy`. Keep any live authentication, subscription billing, and physical-platform gaps explicit.

The 1.5.11 and 1.5.12 Windows results satisfy some of these checks but leave a reproducible subprocess-startup failure. #8143 remains closed as not planned; this recheck does not reopen it or authorize runtime work. No runtime provider entry should be added without a maintainer decision and completed qualification.

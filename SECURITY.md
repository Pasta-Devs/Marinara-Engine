# Security Policy

## Supported versions

Security fixes are developed on `staging` and released from `main`. Please report issues found in the current stable release or the current `staging` branch. Older releases may lack security fixes or contain known vulnerabilities, so reproduce against a supported version when practical.

## Reporting a vulnerability

Use GitHub's [private vulnerability reporting](https://github.com/Pasta-Devs/Marinara-Engine/security/advisories/new) for suspected vulnerabilities. Please do not open a public issue until the report has been assessed.

Include the affected version and install type, operating system, relevant configuration, reproduction steps, expected impact, and whether the issue crosses a trust boundary. Remove API keys, personal chat data, and other secrets from evidence.

## Local-first threat model

Marinara Engine is a local-first, single-user application. Importing and exporting user data, connecting to local models, and preserving user-authored prompt content are supported behavior, not vulnerabilities by themselves.

Some features intentionally execute code only after explicit opt-in:

- External Extensions require the host environment gate, the in-app Danger Zone gate, and approval of the exact code hash. Full-page extensions are explicitly disclosed as unsandboxed.
- Server Extensions and Professor Mari shell commands run only when a supported operating-system sandbox is available.
- Custom script tools are disabled unless the host enables them and run inside the isolated QuickJS runtime.
- Official capability-package and local-model runtimes are integrity checked before execution.

Security boundaries include unintended host command execution, sandbox escape, unauthorized remote access, unsafe filesystem access, archive traversal, secret exposure, and active content executing without the documented approval gates. Reports that preserve legitimate local-first workflows while demonstrating one of those boundary crossings are especially helpful.

Official versioned artifact workflows reject malformed or mismatched release tags before building or publishing. CodeQL analyzes pull requests to both `staging` and `main`, while the dependency audit and focused security regressions provide a separate release-candidate check.

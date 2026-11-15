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

## Updates and dependencies

With `AUTO_UPDATE_ENABLED=true` (the default) the launchers update a Git install on start: they fetch the tracked branch from the repository you cloned, check it out, and run `pnpm install --frozen-lockfile` and a build before starting the server. What protects that step:

- Anyone who can push to the tracked branch can change the code your install runs. Track `main` (released versions) unless you deliberately test `staging` or another branch, and set `AUTO_UPDATE_ENABLED=false` to update only when you choose. Commits are not signature-checked.
- Every dependency is pinned by the lockfile, including its integrity hash, and `--frozen-lockfile` refuses an install that would change it. `trustPolicy` is turned off so a released lockfile stays installable when older package versions lose registry trust metadata; with a frozen lockfile no version is chosen at install time, so it does not widen what can be installed.
- New package versions are only accepted after 24 hours (`minimumReleaseAge`), dependencies from Git or tarball URLs are refused (`blockExoticSubdeps`), and only listed packages may run install scripts (`allowBuilds`).
- Updating from inside the app is off unless enabled, and `UPDATES_APPLY_DISABLED` turns it off regardless.

## Where secrets live

Connection API keys and similar tokens are encrypted with AES-256-GCM using the key in `DATA_DIR/.encryption-key` (or `ENCRYPTION_KEY`), and the browser only receives them masked. The key file is kept owner-only (mode 0600; on Windows, this account and SYSTEM). A full backup contains that key so a restore can read the saved keys: treat a full backup like a password file. Codex and Claude subscription sign-ins are the CLIs' own files in their usual folders. Changes Professor Mari makes to the launchers or the scripts they run need your approval.

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const installerPath = resolve(REPO_ROOT, "win/installer/installer.nsi");
const sharedPackagePath = resolve(REPO_ROOT, "packages/shared/package.json");

try {
  const [content, sharedPackageSource] = await Promise.all([
    readFile(installerPath, "utf8"),
    readFile(sharedPackagePath, "utf8"),
  ]);
  const sharedPackage = JSON.parse(sharedPackageSource);
  const lines = content.split(/\r?\n/);
  const code = lines.map((line) => (/^\s*;/.test(line) ? "" : line)).join("\n");

  const unsafePatterns = [
    {
      pattern: /\bgit clone\b[^\r\n]*"?\$INSTDIR\\repo-temp"?/i,
      message: 'Initial clone target must not be under "$INSTDIR".',
    },
    {
      pattern: /\brobocopy\s+"?\$INSTDIR\\repo-temp"?\s+"?\$INSTDIR"?\b/i,
      message: 'Do not robocopy from "$INSTDIR\\repo-temp" into its parent "$INSTDIR".',
    },
    {
      pattern:
        /\bStrCpy\s+\$[A-Za-z0-9_]+\s+(?:"\$TEMP\\MarinaraEngine-repo-temp"|\$TEMP\\MarinaraEngine-repo-temp)\s*(?:\r?\n|$)/i,
      message: 'Temporary clone paths must include a per-run suffix, not fixed "$TEMP\\MarinaraEngine-repo-temp".',
    },
    {
      pattern: /\bStrCpy\s+\$[A-Za-z0-9_]+\s+(?:"\$INSTDIR\.__stage"|\$INSTDIR\.__stage)\s*(?:\r?\n|$)/i,
      message: 'Temporary stage paths must include a per-run suffix, not fixed "$INSTDIR.__stage".',
    },
  ];

  const failures = unsafePatterns.filter(({ pattern }) => pattern.test(code));
  const sharedBuild = sharedPackage?.scripts?.build;
  if (typeof sharedBuild !== "string" || /\bpnpm(?:\.cmd)?\s/i.test(sharedBuild)) {
    failures.push({
      message:
        "The shared workspace build must not invoke nested pnpm; Windows Corepack-only launchers do not put a global pnpm executable on PATH.",
    });
  }

  const uninstallStart = code.indexOf('Section "Uninstall"');
  const packageRemoval = code.indexOf('RMDir /r "$INSTDIR\\packages"', uninstallStart);
  const canonicalDataDecision = code.indexOf("$INSTDIR\\packages\\server\\data", uninstallStart);
  if (uninstallStart < 0 || packageRemoval < 0 || canonicalDataDecision < 0 || canonicalDataDecision > packageRemoval) {
    failures.push({
      message:
        'The uninstaller must decide how to preserve "$INSTDIR\\packages\\server\\data" before removing packages.',
    });
  }
  if (!code.includes('Rename "$INSTDIR\\packages\\server\\data" "$INSTDIR\\.__marinara-preserved-data"')) {
    failures.push({ message: "The uninstaller must move current-layout user data out of packages before cleanup." });
  }
  if (!code.includes('Rename "$INSTDIR\\.__marinara-preserved-data" "$INSTDIR\\packages\\server\\data"')) {
    failures.push({ message: "The uninstaller must restore preserved current-layout user data after cleanup." });
  }
  const interruptedDataDecision = code.indexOf(
    '${ElseIf} ${FileExists} "$INSTDIR\\.__marinara-preserved-data\\*.*"',
    uninstallStart,
  );
  if (interruptedDataDecision < 0 || interruptedDataDecision > packageRemoval) {
    failures.push({ message: "The uninstaller must detect data staged by an interrupted previous uninstall." });
  }
  if (!code.includes('RMDir /r "$INSTDIR\\.__marinara-preserved-data"')) {
    failures.push({ message: "The delete-data path must remove data staged by an interrupted previous uninstall." });
  }
  if (/RMDir\s+\/r\s+"\$INSTDIR\\installer"/i.test(code)) {
    failures.push({ message: 'The uninstaller still targets the stale "$INSTDIR\\installer" directory.' });
  }
  if (!/RMDir\s+\/r\s+"\$INSTDIR\\win"/i.test(code)) {
    failures.push({ message: 'The uninstaller must remove the current "$INSTDIR\\win" directory.' });
  }

  const unsafeVariableAssignments = [
    {
      pattern: /\bStrCpy\s+(\$[A-Za-z0-9_]+)\s+"?\$INSTDIR\\repo-temp"?\b/i,
      message: (variable) => `Temporary clone variable ${variable} must not point under "$INSTDIR".`,
    },
    {
      pattern: /\b(?:SetEnv|SetEnvironmentVariable)\s+(\$[A-Za-z0-9_]+)\s+"?\$INSTDIR\\repo-temp"?\b/i,
      message: (variable) => `Environment staging variable ${variable} must not point under "$INSTDIR".`,
    },
  ];

  const unsafeVariables = new Map();
  for (const line of lines) {
    const codeLine = /^\s*;/.test(line) ? "" : line;
    for (const { pattern, message } of unsafeVariableAssignments) {
      const match = pattern.exec(codeLine);
      if (match) {
        const variable = match[1].toUpperCase();
        unsafeVariables.set(variable, message(match[1]));
      }
    }
  }

  for (const message of unsafeVariables.values()) {
    failures.push({ message });
  }

  for (const [variable] of unsafeVariables) {
    const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const unsafeVariableUse = new RegExp(`\\b(?:git clone|robocopy)\\b[^\\r\\n]*"?${escapedVariable}"?\\b`, "i");
    if (unsafeVariableUse.test(code)) {
      failures.push({
        message: `Do not use ${variable} as a git clone or robocopy source after assigning it under "$INSTDIR".`,
      });
    }
  }

  if (failures.length > 0) {
    console.error("Unsafe Windows installer staging layout detected:");
    for (const failure of failures) {
      console.error(`- ${failure.message}`);
    }
    console.error("Stage repository clones outside the final install directory.");
    process.exit(1);
  }

  console.log("Windows installer layout and Corepack launcher compatibility are safe.");
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

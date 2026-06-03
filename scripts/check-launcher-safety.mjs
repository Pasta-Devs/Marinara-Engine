import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const candidatePathPattern =
  /(^|\/)(scripts|docs|\.github|public|src-tauri)(\/|$)|(^|\/)(start|run|launcher|install|installer)[^/]*\.(bat|cmd|ps1|sh|mjs|js|ts|tsx|md|html|json)$/i;

const forbiddenPatterns = [
  {
    name: "nested cmd delayed browser open",
    pattern: /cmd(?:\.exe)?\s+\/c[\s\S]{0,240}timeout\s+\/t[\s\S]{0,240}\bstart\b[\s\S]{0,240}\|\|[\s\S]{0,240}\bexplorer\b/i,
    reason:
      "Issue #2089 reported AV warnings for the legacy Windows auto-open chain. Use PowerShell Start-Sleep/Start-Process or a platform API instead.",
  },
];

function buildDangerousFixture(shellToken) {
  return [
    `start ""`,
    shellToken,
    `"${["time", "out /t"].join("")} 4 /nobreak >nul &&`,
    `start %PROTOCOL%://127.0.0.1:%PORT% ||`,
    `${["ex", "plorer"].join("")} %PROTOCOL%://127.0.0.1:%PORT%"`,
  ].join(" ");
}

function runSelfTest() {
  const dangerousFixtures = [
    buildDangerousFixture(["c", "md /c"].join("")),
    buildDangerousFixture(["c", "md.exe /c"].join("")),
  ];
  const safe = `start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process '%PROTOCOL%://127.0.0.1:%PORT%'"`;
  const [browserOpenPattern] = forbiddenPatterns;

  for (const dangerous of dangerousFixtures) {
    if (!browserOpenPattern.pattern.test(dangerous)) {
      console.error("Launcher safety self-test failed: reported issue #2089 command was not detected.");
      process.exit(1);
    }
  }

  if (browserOpenPattern.pattern.test(safe)) {
    console.error("Launcher safety self-test failed: safe PowerShell browser-open command was incorrectly flagged.");
    process.exit(1);
  }

  console.log("Launcher safety self-test passed.");
}

runSelfTest();

if (process.argv.includes("--self-test")) {
  process.exit(0);
}

const result = spawnSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  console.error(result.stderr.trim());
  process.exit(result.status ?? 1);
}

const failures = [];
let checked = 0;

for (const filePath of result.stdout.split("\0")) {
  if (!filePath || !candidatePathPattern.test(filePath.replaceAll("\\", "/"))) {
    continue;
  }

  checked += 1;
  const source = readFileSync(filePath, "utf8");

  for (const forbidden of forbiddenPatterns) {
    if (forbidden.pattern.test(source)) {
      failures.push(`${filePath}: ${forbidden.name}. ${forbidden.reason}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Launcher safety check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Checked launcher safety for ${checked} tracked files.`);

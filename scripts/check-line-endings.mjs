import { spawnSync } from "node:child_process";

const result = spawnSync("git", ["ls-files", "--eol", "-z"], {
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

const indexFailures = [];
const worktreeFailures = [];
let checked = 0;

for (const record of result.stdout.split("\0")) {
  if (!record) {
    continue;
  }

  const match = record.match(/^i\/(\S+)\s+w\/(\S+)\s+attr\/([^\t]*)\t([\s\S]+)$/);
  if (!match) {
    continue;
  }

  checked += 1;
  const [, indexEnding, worktreeEnding, attributes, filePath] = match;

  if (indexEnding === "crlf" || indexEnding === "mixed") {
    indexFailures.push(`${filePath} has ${indexEnding} line endings in the Git index.`);
  }

  if (worktreeEnding === "mixed") {
    worktreeFailures.push(`${filePath} has mixed line endings in the working tree.`);
  } else if (attributes.includes("eol=lf") && worktreeEnding === "crlf") {
    worktreeFailures.push(`${filePath} has CRLF line endings in an LF-normalized working tree.`);
  }
}

const failures = [...indexFailures, ...worktreeFailures];
if (failures.length > 0) {
  console.error("Line ending check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("");
  console.error("Run `git add --renormalize .` after changing .gitattributes.");
  console.error("For working-tree failures, re-save or format the listed files with LF endings.");
  process.exit(1);
}

console.log(`Checked line endings for ${checked} tracked files.`);

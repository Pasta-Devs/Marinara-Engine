import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = process.cwd();

const checks = [
  {
    path: "src-tauri/src/commands/storage/imports.rs",
    maxLines: 80,
    forbiddenPatterns: [
      /\bfn\s+(normalize|parse|restore|import_marinara|import_st_preset)/,
      /\bserde_json::from_/,
      /\bstd::fs::/,
    ],
    reason: "storage import command facade must stay thin and delegate to focused import modules",
  },
  {
    path: "src-tauri/src/commands/storage/imports/service.rs",
    maxLines: 550,
    forbiddenPatterns: [],
    reason: "import service should coordinate focused modules, not absorb every parser and normalizer",
  },
  {
    path: "src-tauri/src/commands/storage/imports/marinara.rs",
    maxLines: 750,
    forbiddenPatterns: [],
    reason: "Marinara envelope import logic should stay focused and split if it grows further",
  },
  {
    path: "src-tauri/src/commands/storage/imports/normalization.rs",
    maxLines: 450,
    forbiddenPatterns: [],
    reason: "import normalization should remain isolated and reviewable",
  },
];

const failures = [];

function countLogicalLines(source) {
  if (source.length === 0) {
    return 0;
  }

  // Do not count a normal terminal newline as an extra blank line.
  return source.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

for (const check of checks) {
  const absolutePath = resolve(root, check.path);
  const source = readFileSync(absolutePath, "utf8");
  const lines = countLogicalLines(source);

  if (lines > check.maxLines) {
    failures.push(
      `${relative(root, absolutePath)} has ${lines} lines; limit is ${check.maxLines}: ${check.reason}`,
    );
  }

  for (const pattern of check.forbiddenPatterns) {
    if (pattern.test(source)) {
      failures.push(`${relative(root, absolutePath)} matches forbidden pattern ${pattern}: ${check.reason}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Rust structure check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Rust structure check passed.");

import { ESLint } from "eslint";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import fullReportConfig from "../eslint.full-report.config.js";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");

if (outputIndex !== -1 && !args[outputIndex + 1]) {
  throw new Error("Missing value for --output");
}

const outputFile = outputIndex === -1 ? ".eslint-reports/eslint-full-report.json" : args[outputIndex + 1];
const outputPath = path.resolve(process.cwd(), outputFile);

const eslint = new ESLint({
  errorOnUnmatchedPattern: false,
  overrideConfig: fullReportConfig,
  overrideConfigFile: true,
});

const results = await eslint.lintFiles(["."]);
const formatter = await eslint.loadFormatter("json");
const report = await formatter.format(results);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, report);

const ruleCounts = new Map();
let filesWithMessages = 0;
let errorCount = 0;
let warningCount = 0;

for (const result of results) {
  errorCount += result.errorCount;
  warningCount += result.warningCount;

  if (result.messages.length === 0) {
    continue;
  }

  filesWithMessages += 1;

  for (const message of result.messages) {
    const ruleId = message.ruleId ?? "fatal-or-parser-error";
    ruleCounts.set(ruleId, (ruleCounts.get(ruleId) ?? 0) + 1);
  }
}

const topRules = [...ruleCounts.entries()].sort(([, left], [, right]) => right - left).slice(0, 10);

console.log(`ESLint full report written to ${path.relative(process.cwd(), outputPath)}`);
console.log(`${errorCount} errors, ${warningCount} warnings across ${filesWithMessages} files.`);

if (topRules.length > 0) {
  console.log("Top rules:");
  for (const [ruleId, count] of topRules) {
    console.log(`- ${ruleId}: ${count}`);
  }
}

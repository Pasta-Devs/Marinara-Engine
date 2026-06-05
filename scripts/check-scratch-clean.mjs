#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const output = execFileSync("git", ["ls-files", "-z", "--", "scratch"], {
  encoding: "utf8",
});
const trackedScratchFiles = output.split("\0").filter(Boolean);

if (trackedScratchFiles.length > 0) {
  console.error("Tracked scratch files are not allowed.");
  for (const file of trackedScratchFiles) {
    console.error(`- ${file}`);
  }
  console.error("Keep proof artifacts local under scratch/, and track reusable examples under templates instead.");
  process.exit(1);
}

console.log("No tracked scratch files found.");

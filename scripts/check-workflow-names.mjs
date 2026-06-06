const metadataFields = [
  { label: "PR title", value: process.env.PR_TITLE },
  { label: "PR source branch", value: process.env.PR_HEAD_REF },
];

const bannedAuthorshipMarkers = [
  { label: "AI label prefix", pattern: /^\s*ai\s*:/i },
  { label: "Codex label prefix", pattern: /^\s*codex\s*:/i },
  { label: "generated-by wording", pattern: /\bgenerated\s+by\b/i },
  { label: "generated-with AI wording", pattern: /\bgenerated\s+(?:using|with)\s+(?:ai|chatgpt|claude|codex)\b/i },
  { label: "AI-generated wording", pattern: /\bai[-\s]*generated\b/i },
  { label: "AI co-author trailer", pattern: /\bco-authored-by:\s*.*\b(?:ai|chatgpt|claude|codex)\b/i },
  {
    label: "AI author wording",
    pattern: /\b(?:authored|created|implemented|written)\s+by\s+(?:ai|chatgpt|claude|codex)\b/i,
  },
  { label: "AI author branch prefix", pattern: /^(?:ai|codex)(?:[/-]|$)/i },
];

const presentFields = metadataFields.filter(({ value }) => typeof value === "string" && value.trim().length > 0);

if (presentFields.length === 0) {
  console.log("No PR title or source branch provided; skipping workflow metadata name check.");
  process.exit(0);
}

const failures = [];
for (const { label, value } of presentFields) {
  for (const marker of bannedAuthorshipMarkers) {
    if (marker.pattern.test(value)) {
      failures.push(`${label} contains ${marker.label}: "${value}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("Workflow metadata name check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("");
  console.error("Use task, owner, or problem names instead of AI/tool authorship.");
  console.error("Provider/product names are allowed when they describe app behavior.");
  process.exit(1);
}

console.log(`Checked ${presentFields.map(({ label }) => label).join(" and ")} for explicit AI authorship.`);

const metadataFields = [
  { label: "PR title", value: process.env.PR_TITLE },
  { label: "PR source branch", value: process.env.PR_HEAD_REF },
];

const aiAuthorTermPattern = "(?:ai|chatgpt|claude|codex)";
const generatedAuthorshipVerbPattern = "(?:by|using|with)";
const generatedAuthorshipPattern = new RegExp(
  `\\bgenerated\\s+${generatedAuthorshipVerbPattern}\\s+${aiAuthorTermPattern}\\b`,
  "gi",
);

const productOutputSubjectPattern = [
  "chat\\s+messages?",
  "messages?",
  "images?",
  "prompts?",
  "responses?",
  "outputs?",
  "model\\s+outputs?",
  "replies",
  "text",
  "content",
  "completions?",
].join("|");
const productOutputRelativeBridgePattern =
  "(?:(?:(?:that|which)\\s+)?(?:are|is|were|was|be|being)\\s+(?:being\\s+)?)?";
const productOutputPrefixPattern = new RegExp(
  `\\b(?:${productOutputSubjectPattern})\\s+${productOutputRelativeBridgePattern}$`,
  "i",
);

function hasGeneratedAuthorshipClause(value) {
  for (const match of value.matchAll(generatedAuthorshipPattern)) {
    if (match.index === undefined) {
      return true;
    }

    const prefix = value.slice(Math.max(0, match.index - 64), match.index);
    if (!productOutputPrefixPattern.test(prefix)) {
      return true;
    }
  }

  return false;
}

const bannedAuthorshipMarkers = [
  {
    label: "AI/tool label prefix",
    pattern: new RegExp(`(?:^|[\\s:\\-\\u2013\\u2014])${aiAuthorTermPattern}\\s*:`, "i"),
  },
  { label: "generated AI authorship wording", matches: hasGeneratedAuthorshipClause },
  { label: "AI-generated wording", pattern: /\bai[-\s]*generated\b/i },
  {
    label: "AI co-author trailer",
    pattern: new RegExp(`\\bco-authored-by:\\s*.*\\b${aiAuthorTermPattern}\\b`, "i"),
  },
  {
    label: "AI author wording",
    pattern: new RegExp(`\\b(?:authored|created|implemented|written)\\s+by\\s+${aiAuthorTermPattern}\\b`, "i"),
  },
  {
    label: "AI author branch prefix",
    pattern: new RegExp(`^${aiAuthorTermPattern}(?:[/-]|$)`, "i"),
  },
];

const presentFields = metadataFields.filter(({ value }) => typeof value === "string" && value.trim().length > 0);

if (presentFields.length === 0) {
  console.log("No PR title or source branch provided; skipping workflow metadata name check.");
  process.exit(0);
}

const failures = [];
for (const { label, value } of presentFields) {
  for (const marker of bannedAuthorshipMarkers) {
    const markerMatches =
      typeof marker.matches === "function" ? marker.matches(value) : marker.pattern.test(value);
    if (markerMatches) {
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

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  formatDocumentationRead,
  formatDocumentationSearch,
  queryTerms,
  readCanonicalDocumentation,
  searchCanonicalDocumentation,
} from "../../../packages/server/src/services/professor-mari/documentation-tools.js";
import { parseAssistantWorkspaceAction } from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import { professorMariPromptSchema } from "../../../packages/server/src/routes/professor-mari-workspace.routes.js";

const workspaceRoot = await mkdtemp(join(tmpdir(), "marinara-doc-tools-"));

try {
  await mkdir(join(workspaceRoot, "docs", "connections"), { recursive: true });
  await mkdir(join(workspaceRoot, "docs", "connections", "examples"), { recursive: true });
  await mkdir(join(workspaceRoot, "docs", "examples"), { recursive: true });
  await mkdir(join(workspaceRoot, "outside-docs"), { recursive: true });
  await writeFile(join(workspaceRoot, "README.md"), "# Marinara Engine\n\nInstall the engine with pnpm.\n", "utf8");
  await writeFile(
    join(workspaceRoot, "docs", "connections", "proxy.md"),
    [
      "# Provider connections",
      "",
      "## Proxy timeout",
      "",
      "Increase the proxy timeout when a local provider needs longer to answer.",
      "Keep the connection URL unchanged.",
      "",
      "### Windows launcher",
      "",
      "The packaged launcher uses the same timeout setting.",
      "",
      "## API keys",
      "",
      "Store keys in the connection editor.",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(workspaceRoot, "docs", "examples", "ignored.md"),
    "# Proxy timeout\n\nThis internal example must not be searched.",
    "utf8",
  );
  await writeFile(
    join(workspaceRoot, "docs", "connections", "examples", "nested-ignored.md"),
    "# Proxy timeout\n\nThis nested internal example must not be searched.",
    "utf8",
  );
  await mkdir(join(workspaceRoot, "docs", "lang"), { recursive: true });
  await writeFile(
    join(workspaceRoot, "docs", "lang", "csharp.md"),
    [
      "# Overview",
      "",
      "## C#",
      "",
      "C# is a modern language.",
      "",
      "## Code sample",
      "",
      "````",
      "# not a real heading",
      "```",
      "# still not a heading",
      "````",
      "",
      "## Real section",
      "",
      "The end.",
      "",
      "## Indented fence",
      "",
      "```",
      "    ```",
      "# hidden heading",
      "```",
      "",
      "## After indent",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(workspaceRoot, "docs", "lang", "plain.md"),
    "Just a paragraph with no headings at all.\n",
    "utf8",
  );
  await writeFile(
    join(workspaceRoot, "docs", "lang", "many.md"),
    Array.from({ length: 45 }, (_, index) => `## Section ${index + 1}\n\nBody ${index + 1}.`).join("\n\n"),
    "utf8",
  );
  await writeFile(join(workspaceRoot, "outside-docs", "secret.md"), "# Internal secret\n", "utf8");
  await symlink(
    join(workspaceRoot, "outside-docs"),
    join(workspaceRoot, "docs", "connections", "linked-outside"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const searchResponse = await searchCanonicalDocumentation(workspaceRoot, "proxy timeout", 3);
  const results = searchResponse.results;
  assert.equal(searchResponse.truncated, false);
  assert.equal(results[0]?.path, "docs/connections/proxy.md");
  assert.equal(results[0]?.heading, "Proxy timeout");
  assert.match(results[0]?.excerpt ?? "", /local provider/u);
  assert.ok(results.every((result) => !result.path.includes("examples")));

  const formattedSearch = formatDocumentationSearch("proxy timeout", searchResponse);
  assert.match(formattedSearch, /Source: docs\/connections\/proxy\.md/u);
  assert.match(formattedSearch, /Heading: Proxy timeout/u);
  assert.doesNotMatch(formattedSearch, /safe corpus limit/u);

  const secretSearch = await searchCanonicalDocumentation(workspaceRoot, "internal secret", 3);
  assert.equal(secretSearch.results.length, 0);

  // Slice 84: docs/development working plans are not user docs, so quick answers and Mari never cite them.
  await mkdir(join(workspaceRoot, "docs", "development"), { recursive: true });
  await writeFile(join(workspaceRoot, "docs", "development", "omnibar-ux-plan.md"), "# Quokka plan\n", "utf8");
  await writeFile(join(workspaceRoot, "docs", "development", "architecture-map.md"), "# Quokka map\n", "utf8");
  const developmentSearch = await searchCanonicalDocumentation(workspaceRoot, "quokka", 3);
  assert.deepEqual(
    developmentSearch.results.map((result) => result.path),
    ["docs/development/architecture-map.md"],
  );
  await assert.rejects(
    () => readCanonicalDocumentation(workspaceRoot, "docs/development/omnibar-ux-plan.md"),
    /canonical user documentation set/u,
  );
  // UX-12: contributor notes under docs/contrib are not user docs either.
  await mkdir(join(workspaceRoot, "docs", "contrib"), { recursive: true });
  await writeFile(join(workspaceRoot, "docs", "contrib", "series.md"), "# A4c. Quokka shutdown\n", "utf8");
  const contribSearch = await searchCanonicalDocumentation(workspaceRoot, "quokka", 3);
  assert.ok(!contribSearch.results.some((result) => result.path.startsWith("docs/contrib/")));

  const section = await readCanonicalDocumentation(workspaceRoot, "docs/connections/proxy.md", "Proxy timeout", 1_000);
  assert.match(section.content, /Increase the proxy timeout/u);
  assert.match(section.content, /packaged launcher/u);
  assert.doesNotMatch(section.content, /Store keys/u);
  assert.match(formatDocumentationRead(section), /Source: docs\/connections\/proxy\.md/u);

  const readmeResults = await searchCanonicalDocumentation(workspaceRoot, "install engine", 3);
  assert.equal(readmeResults.results[0]?.path, "README.md");

  await writeFile(join(workspaceRoot, "README.md"), "x".repeat(1024 * 1024 + 1), "utf8");
  const oversizedReadmeSearch = await searchCanonicalDocumentation(workspaceRoot, "local provider timeout", 3);
  assert.equal(oversizedReadmeSearch.results[0]?.path, "docs/connections/proxy.md");
  assert.equal(oversizedReadmeSearch.truncated, true);
  assert.match(formatDocumentationSearch("local provider timeout", oversizedReadmeSearch), /safe corpus limit/u);

  await assert.rejects(() => readCanonicalDocumentation(workspaceRoot, "../outside.md"), /must be README\.md/u);
  await assert.rejects(
    () => readCanonicalDocumentation(workspaceRoot, "docs/connections/proxy.md", "Missing heading"),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Heading not found/u);
      // #4791 — a heading miss lists the file's real headings so the caller can self-correct
      // instead of hitting a dead end.
      assert.match(err.message, /Available headings:/u);
      assert.match(err.message, /"Proxy timeout"/u);
      assert.match(err.message, /"API keys"/u);
      return true;
    },
  );

  // #4796 review — headings inside fenced code blocks are not treated as headings, and a
  // terminal '#' that belongs to the heading text (e.g. "C#") is preserved for lookup + listing.
  const csharpSection = await readCanonicalDocumentation(workspaceRoot, "docs/lang/csharp.md", "C#", 1_000);
  assert.match(csharpSection.content, /C# is a modern language/u);
  await assert.rejects(
    () => readCanonicalDocumentation(workspaceRoot, "docs/lang/csharp.md", "Missing"),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /"C#"/u);
      assert.match(err.message, /"Real section"/u);
      assert.doesNotMatch(err.message, /not a real heading/u);
      assert.doesNotMatch(err.message, /still not a heading/u);
      // A 4-space-indented fence marker is indented code, not a real fence, so it must not
      // close the block early and expose the "# hidden heading" line inside it.
      assert.doesNotMatch(err.message, /hidden heading/u);
      assert.match(err.message, /"After indent"/u);
      return true;
    },
  );
  // #4796 review — cover the other two missing-heading diagnostic branches.
  await assert.rejects(
    () => readCanonicalDocumentation(workspaceRoot, "docs/lang/plain.md", "Whatever"),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /has no headings/u);
      return true;
    },
  );
  await assert.rejects(
    () => readCanonicalDocumentation(workspaceRoot, "docs/lang/many.md", "Missing"),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /\(\+\d+ more\)/u);
      return true;
    },
  );
  await assert.rejects(
    () => readCanonicalDocumentation(workspaceRoot, "docs/connections/examples/nested-ignored.md"),
    /outside the canonical user documentation set/u,
  );
  await assert.rejects(
    () => readCanonicalDocumentation(workspaceRoot, "docs/connections/linked-outside/secret.md"),
    /escapes the canonical documentation boundary/u,
  );

  const jsonAction = parseAssistantWorkspaceAction(
    JSON.stringify({
      say: "",
      commands: [{ name: "docs_search", arguments: { query: "proxy timeout" } }],
      stop: false,
    }),
  );
  assert.equal(jsonAction.commands[0]?.name, "docs_search");
  assert.deepEqual(jsonAction.commands[0]?.arguments, { query: "proxy timeout" });

  const textualAction = parseAssistantWorkspaceAction(
    '<docs_read>{"path":"docs/connections/proxy.md","heading":"Proxy timeout"}</docs_read>',
  );
  assert.equal(textualAction.commands[0]?.name, "docs_read");
  assert.equal(textualAction.commands[0]?.arguments.heading, "Proxy timeout");

  const handoff = professorMariPromptSchema.safeParse({
    chatId: "mari-workspace",
    message: "Explain this character's greeting.",
    context: {
      source: "character-editor",
      capability: "explain",
      resource: { kind: "character", id: "character-1", label: "Luna" },
      field: "firstMessage",
      action: "Explain the selected greeting",
    },
  });
  assert.equal(handoff.success, true, "valid contextual handoffs pass the server schema");

  const invalidHandoff = professorMariPromptSchema.safeParse({
    chatId: "mari-workspace",
    message: "Explain this.",
    context: {
      source: "character-editor",
      capability: "explain",
      resource: { kind: "character", id: "" },
    },
  });
  assert.equal(invalidHandoff.success, false, "empty resource IDs are rejected at the handoff boundary");

  const linkedWorkspaceRoot = await mkdtemp(join(tmpdir(), "marinara-doc-tools-linked-workspace-"));
  const externalDocsRoot = await mkdtemp(join(tmpdir(), "marinara-doc-tools-external-docs-"));
  try {
    await writeFile(join(linkedWorkspaceRoot, "README.md"), "# Linked docs test\n", "utf8");
    await writeFile(join(externalDocsRoot, "secret.md"), "# External corpus secret\n", "utf8");
    await symlink(
      externalDocsRoot,
      join(linkedWorkspaceRoot, "docs"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const linkedDocsSearch = await searchCanonicalDocumentation(linkedWorkspaceRoot, "external corpus secret", 3);
    assert.equal(linkedDocsSearch.results.length, 0);
    assert.equal(linkedDocsSearch.truncated, true);
  } finally {
    await rm(linkedWorkspaceRoot, { recursive: true, force: true });
    await rm(externalDocsRoot, { recursive: true, force: true });
  }

  console.log("Professor Mari documentation regression passed");
} finally {
  await rm(workspaceRoot, { recursive: true, force: true });
}

// UX-07: a plain question ranks on its content words, not on "why", "is" or "my".
assert.deepEqual(queryTerms("why is my lorebook empty"), ["lorebook", "empty"], "question words are not search terms");
assert.deepEqual(queryTerms("the and of"), [], "a query of only stop words has no terms to rank by");

// Custom agent repositories: the repository URLs accepted, and the agents read from a repository archive.
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import {
  buildRepositoryAgentInput,
  normalizeCustomAgentRepositoryUrl,
  parseCustomAgentRepositoryArchive,
} from "../../../packages/server/src/services/agents/custom-agent-repositories.service.js";

const customRepository = normalizeCustomAgentRepositoryUrl("https://github.com/Pasta-Devs/Example-Agents.git/");
assert.equal(customRepository.url, "https://github.com/pasta-devs/example-agents");
assert.throws(
  () => normalizeCustomAgentRepositoryUrl("https://github.com/Pasta-Devs/Example-Agents/tree/staging"),
  /repository root URL/u,
);
assert.throws(() => normalizeCustomAgentRepositoryUrl("https://example.com/agents"), /public GitHub repository/u);
const repositoryDefinition = {
  id: "continuity-helper",
  name: "Continuity Helper",
  description: "Checks recent turns for contradictions.",
  author: "Mari",
  phase: "post_processing" as const,
  enabledByDefault: false,
  defaultInjectAsSection: true,
  category: "writer" as const,
  defaultTools: ["search_messages"],
  defaultSettings: { maxTokens: 900 },
  modeAllowlist: ["roleplay" as const],
  defaultPromptTemplate: "Check {{messages}} for continuity errors.",
};
const repositoryArchive = new AdmZip();
repositoryArchive.addFile("example-agents-main/agents.json", Buffer.from(JSON.stringify([repositoryDefinition])));
assert.deepEqual(parseCustomAgentRepositoryArchive(repositoryArchive.toBuffer()), [repositoryDefinition]);
const importedRepositoryAgent = buildRepositoryAgentInput(customRepository, repositoryDefinition);
assert.equal(importedRepositoryAgent.type, `repo-${customRepository.id}-continuity-helper`);
assert.deepEqual(importedRepositoryAgent.settings.enabledTools, ["search_messages"]);
assert.deepEqual(importedRepositoryAgent.settings.customAgentRepositorySource, {
  repositoryId: customRepository.id,
  repositoryUrl: customRepository.url,
  agentId: repositoryDefinition.id,
});
const duplicateRepositoryArchive = new AdmZip();
duplicateRepositoryArchive.addFile(
  "example-agents-main/agents.json",
  Buffer.from(JSON.stringify([repositoryDefinition, repositoryDefinition])),
);
assert.throws(() => parseCustomAgentRepositoryArchive(duplicateRepositoryArchive.toBuffer()), /duplicate agent id/u);
const featureRepositoryArchive = new AdmZip();
featureRepositoryArchive.addFile(
  "example-agents-main/agents.json",
  Buffer.from(JSON.stringify([{ ...repositoryDefinition, execution: "feature" }])),
);
assert.throws(
  () => parseCustomAgentRepositoryArchive(featureRepositoryArchive.toBuffer()),
  /requires a package runtime/u,
);

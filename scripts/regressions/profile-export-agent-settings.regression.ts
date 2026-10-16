// #7661: profile export redacts agent credentials but keeps token-count settings such as Max Output Tokens.
// #7657: the Narrative Director's Secret Plot settings export too, while a Secret Plot API key stays blank.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-profile-export-agent-settings-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
try {
  const { sanitizeProfileTableRows } = await import("../../packages/server/src/routes/backup.routes.js");

  const kept = {
    maxTokens: 2048,
    maxOutputTokens: 1024,
    maxContextTokens: 65_000,
    contextTokens: 8000,
    summaryBudgetTokens: 4096,
    existingNoteTokenBudget: 512,
    secretPlotEnabled: true,
    secretPlotRunInterval: 3,
    secretPlotPromptTemplate: "Write the hidden arc.",
    spotifyExpiresAt: 1_700_000_000_000,
  };
  const credentials = {
    token: "fixture-token",
    apiKey: "fixture-api-key",
    api_key: "fixture-api-key-snake",
    youtubeApiKey: "fixture-youtube-key",
    spotifyAccessToken: "fixture-access-token",
    spotifyRefreshToken: "fixture-refresh-token",
    accessTokens: ["fixture-token-list"],
    clientSecret: "fixture-client-secret",
    secret: "fixture-secret",
    password: "fixture-password",
    bearer: "fixture-bearer",
    apiKeyEncrypted: "fixture-encrypted-key",
    secretPlotToken: "fixture-secret-plot-token",
    secretPlotApiKey: "fixture-secret-plot-api-key",
  };
  const stored = {
    ...kept,
    ...credentials,
    nested: [{ maxTokens: 300, authToken: "fixture-nested" }],
    spotify: { spotifyAccessToken: "fixture-nested-object-token" },
  };

  // Stored rows hold settings as JSON text; an already-parsed object must export the same way.
  for (const storedSettings of [JSON.stringify(stored), stored]) {
    const [row] = sanitizeProfileTableRows("agent_configs", [
      { id: "agent-1", type: "director", settings: storedSettings },
    ]);
    const settings = row!.settings as Record<string, unknown>;

    for (const [key, value] of Object.entries(kept)) {
      assert.deepEqual(settings[key], value, `${key} is a setting, not a credential, and must survive export`);
    }
    for (const key of Object.keys(credentials)) {
      assert.equal(settings[key], null, `${key} is a credential and must be blanked on export`);
    }
    assert.deepEqual(settings.nested, [{ maxTokens: 300, authToken: null }]);
    assert.deepEqual(settings.spotify, { spotifyAccessToken: null });
    assert.ok(!JSON.stringify(row).includes("fixture-"), "no credential value may reach the export");
  }

  console.info("Profile export blanks agent credentials and keeps token-count and Secret Plot settings.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}

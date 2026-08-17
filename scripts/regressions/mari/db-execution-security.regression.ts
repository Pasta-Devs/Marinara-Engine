import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { customTools } from "../../../packages/server/src/db/schema/index.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import { runMariTransformSandbox } from "../../../packages/server/src/services/mari-db/mari-transform-sandbox.js";
import { createMariWherePredicate } from "../../../packages/server/src/services/mari-db/mari-where-expression.js";
import {
  getWorkspaceShellSandboxStatus,
  spawnWorkspaceSandboxedProcess,
} from "../../../packages/server/src/services/professor-mari/workspace-shell-sandbox.js";
import { ENCRYPTED_WEBHOOK_PREFIX } from "../../../packages/server/src/utils/custom-tool-webhook.js";

const rows = [
  { id: "one", score: 1, enabled: true, data: { name: "Alpha", tags: ["first", "warm"] } },
  { id: "two", score: 3, enabled: false, data: { name: "Beta", tags: ["second"] } },
  { id: "three", score: 5, enabled: true, data: { name: "Gamma", tags: ["third", "warm"] } },
];

assert.deepEqual(
  rows.filter(createMariWherePredicate('row.score >= 3 && (row.enabled || row.data.name === "Beta")')),
  rows.slice(1),
  "comparisons, logical operators, parentheses, and nested property access remain available",
);
assert.deepEqual(
  rows.filter(createMariWherePredicate("row['data']['name'] !== 'Beta' && !row.missing")),
  [rows[0], rows[2]],
  "quoted bracket access, inequality, and negation remain available",
);
assert.equal(
  createMariWherePredicate("row.score == '3'")(rows[1]!),
  true,
  "safe scalar loose equality remains available",
);
assert.throws(
  () => createMariWherePredicate('process.getBuiltinModule("node:child_process")'),
  /Only row properties/u,
  "host globals are rejected at parse time",
);
assert.deepEqual(
  rows.filter(
    createMariWherePredicate('row.data.name.toLowerCase().startsWith("a") || row.data.tags.includes("warm")'),
  ),
  [rows[0], rows[2]],
  "common string and array selectors remain available without exposing arbitrary calls",
);
assert.throws(
  () => createMariWherePredicate("(((row)))"),
  /bare row object/u,
  "a bare row reference cannot become an accidental all-row predicate",
);
assert.equal(
  createMariWherePredicate("row.data.name.startsWith(null)")(rows[0]!),
  false,
  "string selectors reject non-string arguments instead of coercing null to an empty string",
);
assert.throws(
  () => createMariWherePredicate('row.data.name.constructor("return process")()'),
  /Unexpected content/u,
  "non-whitelisted calls remain unavailable",
);
assert.equal(
  createMariWherePredicate('row.constructor === "anything"')(rows[0]!),
  false,
  "prototype access is never exposed as row data",
);

const dbSource = readFileSync(
  new URL("../../../packages/server/src/services/mari-db/mari-db.service.ts", import.meta.url),
  "utf8",
);
const transformSource = readFileSync(
  new URL("../../../packages/server/src/services/mari-db/mari-transform-sandbox.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(dbSource, /new Function/u, "mari db filtering must never evaluate JavaScript");
assert.doesNotMatch(dbSource, /pathToFileURL/u, "the host DB service must never import transform modules");
assert.match(dbSource, /runMariTransformSandbox/u, "transform planning is routed through the sandbox runner");
assert.match(transformSource, /--permission/u, "the transform process cannot spawn unsandboxed child processes");
{
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  try {
    const unavailable = getWorkspaceShellSandboxStatus();
    assert.equal(unavailable.available, false);
    await assert.rejects(
      spawnWorkspaceSandboxedProcess({
        executable: process.execPath,
        args: ["--version"],
        workspaceRoot: tmpdir(),
        env: process.env,
      }),
      (error: unknown) =>
        error instanceof Error && !unavailable.available && error.message.includes(unavailable.reason),
      "an unavailable OS sandbox fails closed with its availability reason",
    );
  } finally {
    if (platformDescriptor) Object.defineProperty(process, "platform", platformDescriptor);
  }
}

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dbStorage = mkdtempSync(join(tmpdir(), "marinara-mari-where-db-"));
try {
  process.env.FILE_STORAGE_DIR = dbStorage;
  const db = await createFileNativeDB();
  try {
    const mari = new MariDbService(db);
    const customToolValidator = mari as unknown as {
      validateCustomToolRow(
        row: Record<string, unknown>,
        id: string,
        issues: Array<{ level: "error" | "notice" | "info"; table: string; id: string | null; message: string }>,
      ): void;
    };
    const customToolRow = {
      name: "encrypted_webhook",
      description: "Encrypted webhook validation fixture",
      executionType: "webhook",
      enabled: "false",
      includeHiddenContext: "false",
      parametersSchema: "{}",
    };
    const encryptedWebhookIssues: Array<{
      level: "error" | "notice" | "info";
      table: string;
      id: string | null;
      message: string;
    }> = [];
    const urlDescriptor = Object.getOwnPropertyDescriptor(globalThis, "URL");
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: new Proxy(URL, {
        construct: () => {
          throw new TypeError("fixture rejects URL parsing");
        },
      }),
    });
    try {
      customToolValidator.validateCustomToolRow(
        { ...customToolRow, webhookUrl: `${ENCRYPTED_WEBHOOK_PREFIX}invalid` },
        "encrypted-webhook",
        encryptedWebhookIssues,
      );
    } finally {
      if (urlDescriptor) Object.defineProperty(globalThis, "URL", urlDescriptor);
    }
    assert.equal(
      encryptedWebhookIssues.some((issue) => issue.message.includes("webhookUrl")),
      false,
      "Mari DB treats encrypted webhook URLs as opaque stored values",
    );
    const plaintextWebhookIssues: typeof encryptedWebhookIssues = [];
    customToolValidator.validateCustomToolRow(
      { ...customToolRow, webhookUrl: "not a URL" },
      "plaintext-webhook",
      plaintextWebhookIssues,
    );
    assert.equal(
      plaintextWebhookIssues.some((issue) => issue.message === "Tool webhookUrl must be a valid URL"),
      true,
      "Mari DB continues to URL-validate plaintext webhook values",
    );
    const created = await mari.executeAction({
      action: "character.create",
      characterId: "where-security-character",
      data: { name: "Where Security" },
      apply: true,
    });
    assert.equal(created.ok, true);

    const deletePlanner = mari as unknown as {
      planDelete(request: Record<string, unknown>, issues: unknown[]): Promise<unknown[]>;
    };
    await assert.rejects(
      deletePlanner.planDelete({ kind: "delete", table: "characters", apply: false, cascade: false, reason: null }, []),
      /Delete requires an id or an explicit --where expression/u,
      "delete selection fails closed inside the planner even when a caller bypasses CLI parsing",
    );

    const selected = await mari.executeCli({
      argv: [
        "db",
        "select",
        "characters",
        "--where",
        'row.id === "where-security-character" && row.data.name === "Where Security"',
      ],
    });
    assert.equal(selected.ok, true);
    assert.equal(Array.isArray(selected.output) ? selected.output.length : 0, 1);

    const rejectedCode = await mari.executeCli({
      argv: ["db", "select", "characters", "--where", 'process.getBuiltinModule("node:fs")'],
    });
    assert.equal(rejectedCode.ok, false, "the real CLI rejects host-code expressions");

    const rejectedImplicitDelete = await mari.executeCli({ argv: ["db", "delete", "characters"] });
    assert.equal(rejectedImplicitDelete.ok, false, "a missing delete selector cannot silently mean every row");
    const explicitDeletePreview = await mari.executeCli({
      argv: ["db", "delete", "characters", "--where", 'row.id === "where-security-character"'],
    });
    assert.equal(explicitDeletePreview.ok, true);
    assert.equal(explicitDeletePreview.mode, "dry-run");
    assert.equal(explicitDeletePreview.summary?.deletedRows, 1);

    const webhookCredential = "https://hooks.example.test/services/private-token";
    const multiToolRequest = {
      kind: "insert" as const,
      table: "custom_tools",
      row: {
        id: "shared-ciphertext-primary",
        name: "shared_ciphertext_primary",
        executionType: "webhook",
        webhookUrl: webhookCredential,
        sortOrder: 5,
      },
      relatedInserts: [
        {
          table: "custom_tools",
          row: {
            id: "shared-ciphertext-related",
            name: "shared_ciphertext_related",
            executionType: "webhook",
            webhookUrl: webhookCredential,
            sortOrder: 6,
          },
        },
      ],
      apply: false,
      cascade: false,
      reason: null,
    };
    const multiToolPlan = await (
      mari as unknown as {
        planMutation(
          request: typeof multiToolRequest,
          command: string,
        ): Promise<{
          changes: Array<{ table: string; afterRaw?: Record<string, unknown> | null }>;
          request: typeof multiToolRequest;
        }>;
      }
    ).planMutation(multiToolRequest, "mari db insert custom_tools [webhook credential redacted]");
    const plannedWebhookCiphertexts = multiToolPlan.changes
      .filter((change) => change.table === "custom_tools")
      .map((change) => change.afterRaw?.webhookUrl);
    assert.equal(new Set(plannedWebhookCiphertexts).size, 1, "one plaintext webhook is encrypted once per plan");
    assert.equal(
      multiToolPlan.request.row.webhookUrl,
      plannedWebhookCiphertexts[0],
      "the stored request reuses the exact ciphertext from the planned row",
    );
    assert.equal(
      multiToolPlan.request.relatedInserts[0]!.row.webhookUrl,
      plannedWebhookCiphertexts[0],
      "related custom-tool inserts reuse the same ciphertext too",
    );

    const insertedTool = await mari.executeCli({
      argv: [
        "db",
        "insert",
        "custom_tools",
        "--json",
        JSON.stringify({
          name: "reviewed_webhook",
          description: "Review before enabling",
          executionType: "webhook",
          webhookUrl: webhookCredential,
          enabled: true,
          includeHiddenContext: true,
          sortOrder: 10,
        }),
        "--apply",
      ],
    });
    assert.equal(
      insertedTool.ok,
      true,
      `Professor Mari can still author executable tool drafts: ${JSON.stringify(insertedTool)}`,
    );
    const storedTools = await db.select().from(customTools);
    const storedTool = storedTools.find((entry) => entry.name === "reviewed_webhook");
    assert.equal(storedTool?.enabled, "false", "model-authored executable tools require user enablement in Tools");
    assert.equal(
      storedTool?.includeHiddenContext,
      "false",
      "model-authored tools cannot grant themselves hidden context",
    );
    assert.equal(
      storedTool?.webhookUrl?.startsWith(ENCRYPTED_WEBHOOK_PREFIX),
      true,
      "webhook credentials are encrypted at the raw DB boundary",
    );
    const journalDir = join(dbStorage, "journal");
    const persistedReviewData = readdirSync(journalDir, { recursive: true })
      .filter((entry) => typeof entry === "string")
      .map((entry) => {
        const path = join(journalDir, entry);
        return statSync(path).isFile() ? readFileSync(path, "utf8") : "";
      })
      .join("\n");
    assert.doesNotMatch(
      persistedReviewData,
      /private-token/u,
      "journals and pending reviews never store webhook plaintext",
    );

    const legacyWebhookCredential = "https://hooks.example.test/services/legacy-delete-token";
    await db.update(customTools).set({ webhookUrl: legacyWebhookCredential }).where(eq(customTools.id, storedTool!.id));
    const deletedLegacyTool = await mari.executeCli({
      argv: ["db", "delete", "custom_tools", storedTool!.id, "--apply"],
    });
    assert.equal(deletedLegacyTool.ok, true, "legacy plaintext webhook tools remain deletable");
    const deletionReviewData = readdirSync(journalDir, { recursive: true })
      .filter((entry) => typeof entry === "string")
      .map((entry) => {
        const path = join(journalDir, entry);
        return statSync(path).isFile() ? readFileSync(path, "utf8") : "";
      })
      .join("\n");
    assert.doesNotMatch(
      deletionReviewData,
      /legacy-delete-token/u,
      "deleting a legacy plaintext webhook never copies its credential into review data",
    );

    const invalidTool = await mari.executeCli({
      argv: [
        "db",
        "insert",
        "custom_tools",
        "--json",
        JSON.stringify({
          name: "invalid_webhook",
          description: "Invalid",
          executionType: "webhook",
          webhookUrl: "x",
          sortOrder: 20,
        }),
        "--apply",
      ],
    });
    assert.equal(invalidTool.ok, false, "invalid proposed custom tools fail before the transaction");
    assert.equal(
      (await db.select().from(customTools)).some((entry) => entry.name === "invalid_webhook"),
      false,
      "a failed validation cannot persist an invalid tool",
    );
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dbStorage, { recursive: true, force: true });
}

const status = getWorkspaceShellSandboxStatus();
if (!status.available) {
  assert.ok(status.reason.length > 0);
  console.log(`Mari DB transform runtime proof skipped: ${status.reason}`);
} else {
  const workspace = mkdtempSync(join(tmpdir(), "marinara-mari-transform-workspace-"));
  const outside = mkdtempSync(join(tmpdir(), "marinara-mari-transform-outside-"));
  try {
    const safeScript = join(workspace, "safe-transform.mjs");
    writeFileSync(
      safeScript,
      `import { spawnSync } from "node:child_process";
      let childProcessBlocked = false;
      try { spawnSync("/usr/bin/true"); } catch (error) { childProcessBlocked = error?.code === "ERR_ACCESS_DENIED"; }
      export default (row, ctx) => row.score < 2 ? undefined : ({
        update: {
          label: row.data.name + "-safe",
          generatedId: ctx.newId(),
          matchingRows: ctx.find("items", candidate => candidate.score >= 3).length,
          rawData: ctx.raw({ data: { preserved: true } }).data,
          childProcessBlocked,
        },
      });\n`,
      "utf8",
    );
    const safeResult = await runMariTransformSandbox({
      workspaceRoot: workspace,
      scriptPath: safeScript,
      timestamp: "2026-08-13T00:00:00.000Z",
      tables: [
        {
          name: "items",
          jsonColumns: ["data"],
          rows: rows.map((row) => ({ ...row, data: JSON.stringify(row.data) })),
        },
      ],
    });
    assert.equal(safeResult[0]?.results[0]?.defined, false);
    assert.equal(safeResult[0]?.results[1]?.defined, true);
    assert.deepEqual(
      safeResult[0]?.results[1]?.value,
      {
        update: {
          label: "Beta-safe",
          generatedId: (safeResult[0]?.results[1]?.value as { update: { generatedId: string } }).update.generatedId,
          matchingRows: 2,
          rawData: '{"preserved":true}',
          childProcessBlocked: true,
        },
      },
      "ordinary transform scripts retain row updates and the established context helpers",
    );
    assert.match(
      (safeResult[0]?.results[1]?.value as { update: { generatedId: string } }).update.generatedId,
      /^[A-Za-z0-9_-]{21}$/u,
    );

    const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
    const priorUnsafeFallback = process.env.MARI_DB_ALLOW_UNSAFE_TRANSFORMS;
    try {
      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
      delete process.env.MARI_DB_ALLOW_UNSAFE_TRANSFORMS;
      await assert.rejects(
        runMariTransformSandbox({
          workspaceRoot: workspace,
          scriptPath: safeScript,
          timestamp: "2026-08-13T00:00:00.000Z",
          tables: [{ name: "items", jsonColumns: ["data"], rows: [] }],
        }),
        /MARI_DB_ALLOW_UNSAFE_TRANSFORMS=true/u,
        "unsupported platforms never silently run an untrusted transform",
      );
      process.env.MARI_DB_ALLOW_UNSAFE_TRANSFORMS = "true";
      const optedIn = await runMariTransformSandbox({
        workspaceRoot: workspace,
        scriptPath: safeScript,
        timestamp: "2026-08-13T00:00:00.000Z",
        tables: [
          {
            name: "items",
            jsonColumns: ["data"],
            rows: [{ id: "fallback", score: 3, enabled: true, data: '{"name":"Fallback"}' }],
          },
        ],
      });
      assert.equal(
        (optedIn[0]?.results[0]?.value as { update?: { label?: string } })?.update?.label,
        "Fallback-safe",
        "a local user can explicitly preserve transform support without an OS sandbox",
      );
    } finally {
      if (platformDescriptor) Object.defineProperty(process, "platform", platformDescriptor);
      if (priorUnsafeFallback === undefined) delete process.env.MARI_DB_ALLOW_UNSAFE_TRANSFORMS;
      else process.env.MARI_DB_ALLOW_UNSAFE_TRANSFORMS = priorUnsafeFallback;
    }

    const transformStorage = mkdtempSync(join(tmpdir(), "marinara-mari-transform-db-"));
    const priorTransformStorage = process.env.FILE_STORAGE_DIR;
    try {
      process.env.FILE_STORAGE_DIR = transformStorage;
      const db = await createFileNativeDB();
      try {
        const mari = new MariDbService(db);
        await mari.executeAction({
          action: "character.create",
          characterId: "sandbox-transform-character",
          data: { name: "Before Sandbox" },
          apply: true,
        });
        const cliScript = join(workspace, "cli-transform.mjs");
        writeFileSync(
          cliScript,
          `export default row => row.id === "sandbox-transform-character"
            ? ({ update: { data: { ...row.data, name: "Sandbox Preview" } } })
            : undefined;\n`,
          "utf8",
        );
        const preview = await mari.executeCli({
          argv: ["db", "transform", "characters", cliScript],
          cwd: workspace,
        });
        assert.equal(preview.ok, true, "the real mari db transform CLI remains available");
        assert.equal(preview.mode, "dry-run");
        assert.equal(preview.summary?.updatedRows, 1);
        const stored = await mari.executeAction({ action: "character.get", id: "sandbox-transform-character" });
        assert.equal((stored.output as { data?: { name?: string } })?.data?.name, "Before Sandbox");
      } finally {
        await db._fileStore.close();
      }
    } finally {
      if (priorTransformStorage === undefined) delete process.env.FILE_STORAGE_DIR;
      else process.env.FILE_STORAGE_DIR = priorTransformStorage;
      rmSync(transformStorage, { recursive: true, force: true });
    }

    const workspaceMarker = join(workspace, "transform-owned.txt");
    const workspaceWriteScript = join(workspace, "workspace-write.mjs");
    writeFileSync(
      workspaceWriteScript,
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(workspaceMarker)}, "owned");\nexport default row => row;\n`,
      "utf8",
    );
    await assert.rejects(
      runMariTransformSandbox({
        workspaceRoot: workspace,
        scriptPath: workspaceWriteScript,
        timestamp: "2026-08-13T00:00:00.000Z",
        tables: [{ name: "items", jsonColumns: [], rows: [{ id: "one" }] }],
      }),
      /Transform sandbox exited/u,
    );
    assert.equal(existsSync(workspaceMarker), false, "even a dry-run cannot write into the workspace");

    const outsideMarker = join(outside, "host-owned.txt");
    const outsideWriteScript = join(workspace, "outside-write.mjs");
    writeFileSync(
      outsideWriteScript,
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(outsideMarker)}, "owned");\nexport default row => row;\n`,
      "utf8",
    );
    await assert.rejects(
      runMariTransformSandbox({
        workspaceRoot: workspace,
        scriptPath: outsideWriteScript,
        timestamp: "2026-08-13T00:00:00.000Z",
        tables: [{ name: "items", jsonColumns: [], rows: [{ id: "one" }] }],
      }),
      /Transform sandbox exited/u,
    );
    assert.equal(existsSync(outsideMarker), false, "transform code cannot write elsewhere on the host");

    writeFileSync(join(workspace, ".env"), "MARI_DB_SECRET=must-not-leak\n", "utf8");
    const secretReadScript = join(workspace, "secret-read.mjs");
    writeFileSync(
      secretReadScript,
      'import { readFileSync } from "node:fs";\nconst secret = readFileSync(new URL("./.env", import.meta.url), "utf8");\nexport default () => ({ update: { label: secret } });\n',
      "utf8",
    );
    const secretReadInput = {
      workspaceRoot: workspace,
      scriptPath: secretReadScript,
      timestamp: "2026-08-13T00:00:00.000Z",
      tables: [{ name: "items", jsonColumns: [], rows: [{ id: "one" }] }],
    };
    if (status.backend === "linux-bubblewrap") {
      const secretRead = await runMariTransformSandbox(secretReadInput);
      assert.equal(
        (secretRead[0]?.results[0]?.value as { update?: { label?: string } })?.update?.label,
        "",
        "Linux exposes a harmless empty /dev/null in place of forbidden workspace secrets",
      );
    } else {
      await assert.rejects(runMariTransformSandbox(secretReadInput), /Transform sandbox exited/u);
    }

    console.log(`Mari DB execution security regression passed with ${status.backend}.`);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
}

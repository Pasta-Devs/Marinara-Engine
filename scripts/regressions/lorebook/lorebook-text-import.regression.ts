import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
  detectLorebookTextFormat,
  LOREBOOK_TEXT_MAX_CHARS,
  LOREBOOK_TEXT_MAX_ENTRIES,
  exportLorebookToCsv,
  exportLorebookToMarkdown,
  parseLorebookCsv,
  parseLorebookMarkdown,
  planLorebookTextImport,
  readCsvRows,
  summarizeLorebookTextImport,
} from "../../../packages/shared/src/utils/lorebook-text-format.js";

// Covers Markdown / CSV lorebook import and export: parsers, validation,
// duplicate planning, round trips, and the import route end to end.

const codes = (issues: Array<{ code: string }>) => issues.map((issue) => issue.code);

// ── CSV reader ──
{
  const { rows } = readCsvRows(
    '﻿name,keys,content\r\n"Harbor","docks, pier","Line one\r\nLine ""two"""\r\n\r\nMoon,moon,Pale\r\n',
  );
  assert.equal(rows.length, 3, "BOM header, one quoted multiline row, blank line skipped, one plain row");
  assert.deepEqual(rows[0]!.cells, ["name", "keys", "content"], "BOM is stripped from the first header");
  assert.deepEqual(rows[1]!.cells, ["Harbor", "docks, pier", 'Line one\nLine "two"']);
  assert.equal(rows[2]!.line, 5, "line numbers count the newline inside the quoted cell");
  assert.equal(readCsvRows('name\n"open').unterminatedAt, 2);
  assert.deepEqual(
    readCsvRows("a,b\rc,d").rows.map((row) => row.cells),
    [
      ["a", "b"],
      ["c", "d"],
    ],
    "bare CR rows",
  );
}

// ── CSV parser ──
{
  const parsed = parseLorebookCsv(
    [
      "Name,Keys,Content,Folder,Enabled,Constant,Probability,Notes",
      'Tamsin,"Tamsin, the smith","A smith.\nWorks late.",People / Crafters,yes,no,50%,x',
      ",nokey,No name",
      "Ysolde,ysolde,,,maybe,,150",
      "tamsin,again,Second copy",
      ",,,,,,",
    ].join("\n"),
  );
  assert.equal(parsed.entries.length, 4, "an all-empty row is skipped");
  const [tamsin, noName, ysolde, copy] = parsed.entries;
  assert.deepEqual(tamsin!.keys, ["Tamsin", "the smith"]);
  assert.equal(tamsin!.content, "A smith.\nWorks late.");
  assert.deepEqual(tamsin!.folderPath, ["People", "Crafters"]);
  assert.equal(tamsin!.enabled, true);
  assert.equal(tamsin!.constant, false);
  assert.equal(tamsin!.probability, 50);
  assert.equal(tamsin!.invalid, false);
  assert.equal(noName!.invalid, true);
  assert.equal(ysolde!.invalid, true);
  assert.equal(copy!.invalid, false, "an in-file duplicate is a warning, not an error");
  assert.deepEqual(codes(parsed.issues.filter((issue) => issue.entryIndex === 2)).sort(), [
    "empty_content",
    "invalid_boolean",
    "invalid_probability",
  ]);
  assert.ok(parsed.issues.some((issue) => issue.code === "unknown_column" && issue.detail === "Notes"));
  assert.ok(parsed.issues.some((issue) => issue.code === "missing_name" && issue.line === 4));
  assert.ok(parsed.issues.some((issue) => issue.code === "duplicate_in_file" && issue.entryIndex === 3));

  assert.deepEqual(codes(parseLorebookCsv("name,content\nA,b").issues), ["missing_columns"]);
  assert.equal(parseLorebookCsv("name,content\nA,b").issues[0]!.detail, "keys");
  assert.deepEqual(codes(parseLorebookCsv('name,keys,content\n"A,b,c').issues), ["unterminated_quote"]);
  assert.deepEqual(codes(parseLorebookCsv("name,keys,content\n").issues), ["no_entries"]);
  assert.deepEqual(codes(parseLorebookCsv("x".repeat(LOREBOOK_TEXT_MAX_CHARS + 1)).issues), ["input_too_large"]);
}

// ── Markdown parser ──
{
  const parsed = parseLorebookMarkdown(
    "﻿# Test World\r\nIntro text is ignored.\r\n\r\n## The Harbor\r\nKeys: harbor, docks\r\nFolder: Places\r\nConstant: yes\r\n\r\nBusy docks.\r\n\\## Not a heading\r\n\r\n## Rules\r\n\r\nNo keys here.\r\n## \r\nOrphan body\r\n",
  );
  assert.equal(parsed.title, "Test World");
  assert.equal(parsed.entries.length, 3);
  const [harbor, rules, orphan] = parsed.entries;
  assert.equal(harbor!.name, "The Harbor");
  assert.deepEqual(harbor!.keys, ["harbor", "docks"]);
  assert.deepEqual(harbor!.folderPath, ["Places"]);
  assert.equal(harbor!.constant, true);
  assert.equal(
    harbor!.content,
    "Busy docks.\n## Not a heading",
    "escaped heading lines stay in the body, CRLF normalised",
  );
  assert.equal(harbor!.line, 4);
  assert.deepEqual(rules!.keys, []);
  assert.equal(rules!.content, "No keys here.");
  assert.equal(orphan!.invalid, true);
  assert.ok(parsed.issues.some((issue) => issue.code === "missing_name" && issue.line === 15));
  assert.deepEqual(codes(parseLorebookMarkdown("just text").issues), ["no_entries"]);
  assert.deepEqual(codes(parseLorebookMarkdown("x".repeat(LOREBOOK_TEXT_MAX_CHARS + 1)).issues), ["input_too_large"]);
  const oversizedMarkdown = Array.from(
    { length: LOREBOOK_TEXT_MAX_ENTRIES + 1 },
    (_, index) => `## Entry ${index}\n\nContent ${index}`,
  ).join("\n\n");
  const markdownLimit = parseLorebookMarkdown(oversizedMarkdown);
  assert.equal(markdownLimit.entries.length, LOREBOOK_TEXT_MAX_ENTRIES);
  assert.ok(markdownLimit.issues.some((issue) => issue.code === "too_many_entries"));
}

// ── Format detection ──
assert.equal(detectLorebookTextFormat("", "world.CSV"), "csv");
assert.equal(detectLorebookTextFormat("name,keys,content\n"), "csv");
assert.equal(detectLorebookTextFormat("## Entry\n"), "markdown");

// ── Round trips ──
{
  const folders = [
    { id: "f1", name: "People", parentFolderId: null },
    { id: "f2", name: "Crafters", parentFolderId: "f1" },
  ];
  const entries = [
    {
      name: "Tamsin",
      keys: ["Tamsin", "smith"],
      content: 'A "smith", she said.\n\nWorks late.',
      folderId: "f2",
      enabled: true,
      constant: false,
      probability: null,
    },
    {
      name: "Rules",
      keys: [],
      content: "# Heading-like line\n\\# already escaped\nKeys: not metadata",
      folderId: null,
      enabled: false,
      constant: true,
      probability: 25,
    },
    { name: "Ysolde", keys: ["Ysolde"], content: "", folderId: "f1", enabled: true, constant: false, probability: 0 },
  ];
  const expected = entries.map((entry) => ({
    name: entry.name,
    keys: entry.keys,
    content: entry.content,
    folderPath: entry.folderId === "f2" ? ["People", "Crafters"] : entry.folderId === "f1" ? ["People"] : [],
    enabled: entry.enabled,
    constant: entry.constant,
    probability: entry.probability,
  }));
  const strip = (parsed: ReturnType<typeof parseLorebookCsv>) =>
    parsed.entries.map(({ line: _line, invalid: _invalid, ...entry }) => entry);

  assert.equal(
    exportLorebookToMarkdown({
      name: "Heading" + "\t".repeat(10_000) + "\n\n\t\tbody",
      entries: [],
      folders: [],
    }),
    "# Heading body\n",
    "large tab runs around newlines normalize in linear-time-safe whitespace runs",
  );
  const markdown = exportLorebookToMarkdown({ name: "Test World", entries, folders });
  const fromMarkdown = parseLorebookMarkdown(markdown);
  assert.equal(fromMarkdown.title, "Test World");
  assert.deepEqual(strip(fromMarkdown), expected, "Markdown round trip");
  assert.deepEqual(codes(fromMarkdown.issues.filter((issue) => issue.severity === "error")), []);
  assert.equal(
    exportLorebookToMarkdown({
      name: "Test World",
      entries: strip(fromMarkdown).map((entry, index) => ({ ...entry, folderId: entries[index]!.folderId })),
      folders,
    }),
    markdown,
    "Markdown export is stable",
  );

  const csv = exportLorebookToCsv({ entries, folders });
  assert.ok(csv.includes("\r\n"), "CSV uses CRLF rows");
  assert.deepEqual(strip(parseLorebookCsv(csv)), expected, "CSV round trip");
  assert.deepEqual(strip(parseLorebookCsv(`﻿${csv}`)), expected, "CSV round trip with BOM");
  const formulaCsv = exportLorebookToCsv({
    entries: [
      { name: "=1+1", keys: ["=2+2"], content: "@SUM(A1:A2)", enabled: true, constant: false },
      { name: "  =3+3", keys: [], content: "safe", enabled: true, constant: false },
    ],
  });
  assert.ok(formulaCsv.includes("'=1+1,'=2+2,'@SUM(A1:A2)"), "formula-leading cells are exported as text");
  assert.ok(formulaCsv.includes("'  =3+3"), "leading whitespace before a formula is neutralized too");
  const formulaEntries = parseLorebookCsv(formulaCsv).entries;
  assert.equal(formulaEntries[0]!.name, "=1+1", "import removes the export-added formula prefix");
  assert.deepEqual(formulaEntries[0]!.keys, ["=2+2"]);
  assert.equal(formulaEntries[0]!.content, "@SUM(A1:A2)");
  assert.equal(formulaEntries[1]!.name, "=3+3");
  const csvContents = [
    "=1+1",
    "+1",
    "-1",
    "@SUM(A1:A2)",
    "  =1+1",
    "\u0000=1+1",
    "\tplain",
    "\nplain",
    "'plain",
    "''plain",
    "'=1+1",
    "''=1+1",
    "'\tplain",
    "'",
    '\'"quoted",\nnext line',
  ];
  for (const content of csvContents) {
    const original = [{ name: "Round trip", keys: ["key"], content }];
    const exported = exportLorebookToCsv({ entries: original });
    assert.equal(readCsvRows(exported).rows[1]!.cells[2]![0], "'", "spreadsheet formula triggers stay neutralized");
    const imported = parseLorebookCsv(exported).entries[0]!;
    assert.equal(
      imported.content,
      content,
      `CSV preserves formula-like text and literal apostrophes: ${JSON.stringify(content)}`,
    );
    assert.equal(exportLorebookToCsv({ entries: [imported] }), exported, "re-export does not accumulate prefixes");
  }
  assert.equal(parseLorebookCsv("name,keys,content\nLiteral,key,'plain").entries[0]!.content, "'plain");
  for (const content of ["'=foo", "''foo", "''=foo", "'  =foo", "'\tfoo"]) {
    const raw = parseLorebookCsv(`name,keys,content\n'=Name,''key,${content}`).entries[0]!;
    assert.equal(raw.name, "'=Name", "unmarked CSV names are literal");
    assert.deepEqual(raw.keys, ["''key"], "unmarked CSV keys are literal");
    assert.equal(raw.content, content, "unmarked CSV apostrophes are literal");
  }
  const markerHeader = "name,keys,content,marinara_csv_escape";
  for (const marker of ["", "apostrophe-v2", "apostrophe-v1 "]) {
    const raw = parseLorebookCsv(`${markerHeader}\nRaw,key,'=foo,${marker}`);
    assert.equal(raw.entries[0]!.content, "'=foo", "unknown or empty markers never remove apostrophes");
    assert.ok(!raw.issues.some((issue) => issue.code === "unknown_column"), "metadata column is recognized");
  }
  const mixed = parseLorebookCsv(`${markerHeader}\nEngine,key,'=foo,apostrophe-v1\nRaw,key,'=foo`);
  assert.deepEqual(
    mixed.entries.map((entry) => entry.content),
    ["=foo", "'=foo"],
    "escaping is marked per row",
  );
  const duplicateMarker = parseLorebookCsv(
    `${markerHeader},marinara_csv_escape\nRaw,key,'=foo,apostrophe-v1,apostrophe-v1`,
  );
  assert.equal(duplicateMarker.entries[0]!.content, "'=foo", "ambiguous duplicate markers preserve literal data");
  const oversizedCsv = [
    "name,keys,content",
    ...Array.from({ length: LOREBOOK_TEXT_MAX_ENTRIES + 1 }, (_, index) => `Entry ${index},key${index},content`),
  ].join("\n");
  const csvLimit = parseLorebookCsv(oversizedCsv);
  assert.equal(csvLimit.entries.length, LOREBOOK_TEXT_MAX_ENTRIES);
  assert.ok(csvLimit.issues.some((issue) => issue.code === "too_many_entries"));
}

// ── Duplicate planning ──
{
  const entry = (name: string) => ({
    name,
    keys: [],
    content: name,
    folderPath: [],
    enabled: true,
    constant: false,
    probability: null,
  });
  const existing = [
    { id: "e1", name: "Harbor" },
    { id: "e2", name: "Harbor (2)" },
  ];
  const incoming = [entry("harbor"), entry("Moon"), entry("moon")];
  const skip = planLorebookTextImport(incoming, existing, "skip");
  assert.deepEqual(
    skip.map((action) => action.kind),
    ["skip", "create", "skip"],
  );
  const rename = planLorebookTextImport(incoming, existing, "rename");
  assert.deepEqual(
    rename.map((action) => (action.kind === "create" ? action.name : action.kind)),
    ["harbor (3)", "Moon", "moon (2)"],
  );
  assert.deepEqual(summarizeLorebookTextImport(rename), { created: 1, renamed: 2, overwritten: 0, skipped: 0 });
  const overwrite = planLorebookTextImport([...incoming, entry("HARBOR")], existing, "overwrite");
  assert.deepEqual(
    overwrite.map((action) => action.kind),
    ["skip", "skip", "create", "overwrite"],
    "the last copy in the file wins",
  );
  assert.equal(overwrite[3]!.kind === "overwrite" && overwrite[3]!.targetId, "e1");

  // A renamed copy of a 200-character name still fits the entry name limit.
  const longName = "x".repeat(200);
  const longRename = planLorebookTextImport([entry(longName)], [{ id: "e9", name: longName }], "rename");
  const renamed = longRename[0]!.kind === "create" ? longRename[0]!.name : "";
  assert.equal(renamed.length, 200);
  assert.ok(renamed.endsWith(" (2)"));
}

// ── Route ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-lorebook-text-import-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
};
type Response = { statusCode: number; body: string; headers: Record<string, unknown>; json(): any };
let app: { close(): Promise<void>; inject(options: Record<string, unknown>): Promise<Response> } | null = null;
let db: Awaited<
  ReturnType<typeof import("../../../packages/server/src/db/file-backed-store.js").createFileNativeDB>
> | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;

  // Only the text routes are mounted; the full lorebook route module is slow to load.
  const [{ createFileNativeDB }, { lorebookTextRoutes }, { createLorebooksStorage }] = await Promise.all([
    import("../../../packages/server/src/db/file-backed-store.js"),
    import("../../../packages/server/src/routes/lorebook-text.routes.js"),
    import("../../../packages/server/src/services/storage/lorebooks.storage.js"),
  ]);
  db = await createFileNativeDB();
  const Fastify = createRequire(new URL("../../../packages/server/package.json", import.meta.url))("fastify");
  const server = Fastify({ bodyLimit: 256 * 1024 * 1024 });
  server.decorate("db", db);
  await server.register(lorebookTextRoutes, { prefix: "/api/lorebooks" });
  const storage = createLorebooksStorage(db);
  app = server;
  const request = async (method: string, url: string, payload?: unknown, expected = 200) => {
    const response = await app!.inject({ method, url, payload });
    assert.equal(response.statusCode, expected, `${method} ${url} -> ${response.statusCode} ${response.body}`);
    return response;
  };

  const book = (await storage.create({ name: "Test World" } as any)) as { id: string };
  await storage.createEntry({ lorebookId: book.id, name: "Harbor", keys: ["harbor"], content: "Old docks." } as any);

  const markdown =
    "## Harbor\nKeys: harbor, pier\nFolder: Places / Coast\n\nNew docks.\n\n## Moon\nKeys: moon\n\nPale.\n\n## \nBroken\n";
  const skipped = (
    await request("POST", `/api/lorebooks/${book.id}/import-text`, {
      format: "markdown",
      text: markdown,
      duplicateMode: "skip",
    })
  ).json();
  assert.equal(skipped.created, 1);
  assert.equal(skipped.skipped, 1);
  assert.equal(skipped.invalid, 1);
  assert.equal(skipped.foldersCreated, 0, "a skipped entry does not create its folder");

  const overwritten = (
    await request("POST", `/api/lorebooks/${book.id}/import-text`, {
      format: "markdown",
      text: markdown,
      duplicateMode: "overwrite",
    })
  ).json();
  assert.equal(overwritten.overwritten, 2);
  assert.equal(overwritten.foldersCreated, 2);
  const entries = (await storage.listEntries(book.id)) as unknown as Array<Record<string, any>>;
  assert.equal(entries.length, 2);
  const harbor = entries.find((entry) => entry.name === "Harbor")!;
  assert.equal(harbor.content, "New docks.");
  assert.deepEqual(harbor.keys, ["harbor", "pier"]);
  const folders = (await storage.listFolders(book.id)) as unknown as Array<Record<string, any>>;
  const coast = folders.find((folder) => folder.name === "Coast")!;
  assert.equal(harbor.folderId, coast.id);
  assert.equal(folders.find((folder) => folder.id === coast.parentFolderId)?.name, "Places");

  // A later write failure must undo earlier overwrites and newly created folders.
  const { lorebookEntries } = await import("../../../packages/server/src/db/schema/index.js");
  const originalInsert = db.insert;
  let failedEntryWrite = false;
  db.insert = (table) => {
    if (table === lorebookEntries) {
      failedEntryWrite = true;
      throw new Error("Injected text import failure");
    }
    return originalInsert(table);
  };
  try {
    await request(
      "POST",
      `/api/lorebooks/${book.id}/import-text`,
      {
        format: "markdown",
        duplicateMode: "overwrite",
        text: "## Harbor\n\nMust roll back.\n\n## New entry\nFolder: Failed folder\n\nCannot save.",
      },
      500,
    );
    const booksBeforeFailure = await storage.list();
    await request(
      "POST",
      "/api/lorebooks/import-text",
      {
        name: "Failed new book",
        format: "markdown",
        text: "## New entry\nFolder: Failed folder\n\nCannot save.",
      },
      500,
    );
    assert.deepEqual(await storage.list(), booksBeforeFailure, "failed imports also roll back the new lorebook");
  } finally {
    db.insert = originalInsert;
  }
  assert.equal(failedEntryWrite, true, "the failure occurs after the first overwrite");
  assert.deepEqual(await storage.listEntries(book.id), entries, "failed imports preserve existing entries");
  assert.deepEqual(await storage.listFolders(book.id), folders, "failed imports remove newly created folders");

  await request("POST", `/api/lorebooks/${book.id}/import-text`, { format: "csv", text: "name,content\nA,b" }, 400);
  await request("POST", `/api/lorebooks/${book.id}/import-text`, { format: "xml", text: "x" }, 400);
  await request("POST", "/api/lorebooks/missing/import-text", { format: "csv", text: "name,keys,content\nA,a,b" }, 404);

  // Export, then import into a new lorebook, reproduces the entries and folders.
  const exported = await request("GET", `/api/lorebooks/${book.id}/export-text?format=csv`);
  assert.match(String(exported.headers["content-type"]), /text\/csv/);
  assert.equal(
    exported.headers["content-disposition"],
    "attachment; filename=\"Test World.csv\"; filename*=UTF-8''Test%20World.csv",
  );
  const fresh = (
    await request("POST", "/api/lorebooks/import-text", { name: "Copy", format: "csv", text: exported.body })
  ).json();
  assert.equal(fresh.created, 2);
  const copied = (await storage.listEntries(fresh.lorebookId)) as unknown as Array<Record<string, any>>;
  assert.deepEqual(
    copied.map((entry) => [entry.name, entry.content, entry.keys]),
    entries.map((entry) => [entry.name, entry.content, entry.keys]),
  );
  const copiedBook = (await storage.getById(fresh.lorebookId)) as { name: string };
  assert.equal(copiedBook.name, "Copy");

  const md = await request("GET", `/api/lorebooks/${book.id}/export-text?format=markdown`);
  assert.ok(md.body.startsWith("# Test World\n\n## "));

  for (const name of ["Test World", "Zażółć gęślą jaźń", 'A "quote"\\path\r\nX-Injected: yes \'()*']) {
    const namedBook = (await storage.create({ name } as any)) as { id: string };
    for (const [format, extension] of [
      ["csv", "csv"],
      ["markdown", "md"],
    ]) {
      const response = await request("GET", `/api/lorebooks/${namedBook.id}/export-text?format=${format}`);
      const disposition = String(response.headers["content-disposition"]);
      const filenames = disposition.match(/^attachment; filename="([^"\\]*)"; filename\*=UTF-8''([^']*)$/);
      assert.ok(filenames, `safe quoted fallback and UTF-8 filename: ${disposition}`);
      assert.match(filenames[1]!, /^[\x20-\x7E]+$/, "fallback contains printable ASCII only");
      assert.ok(filenames[1]!.endsWith(`.${extension}`));
      assert.doesNotMatch(filenames[2]!, /['()*\r\n]/, "extended filename uses safe RFC 5987 encoding");
      assert.equal(decodeURIComponent(filenames[2]!), `${name}.${extension}`);
      assert.equal(response.headers["x-injected"], undefined, "a lorebook name cannot inject response headers");
    }
  }

  // A failed import into a new lorebook does not leave an empty book behind.
  const before = (await storage.list()).length;
  await request("POST", "/api/lorebooks/import-text", { name: "Nope", format: "csv", text: "title\nx" }, 400);
  // Nor does a file whose every entry has an error.
  await request("POST", "/api/lorebooks/import-text", { name: "Nope", format: "markdown", text: "## \nbody" }, 400);
  assert.equal((await storage.list()).length, before);

  console.log("lorebook-text-import regression passed");
} finally {
  await app?.close();
  await db?._fileStore.close();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}

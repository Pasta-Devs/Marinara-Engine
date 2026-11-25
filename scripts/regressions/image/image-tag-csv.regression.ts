import assert from "node:assert/strict";
import { IMAGE_TAG_LIMITS, type ImageTagCategory } from "../../../packages/shared/src/types/image-tag-dataset.js";
import { normalizeImageTagQuery, parseImageTagCsv } from "../../../packages/server/src/services/image-tags/csv.js";
import { runNamedCases } from "../fixtures/named-cases.js";

await runNamedCases([
  {
    name: "parses quoted aliases, doubled quotes and trims fields",
    run() {
      const csv = '"tag, name",0,10," alias one , alias ""two"" , alias one "\r\n  padded tag  , 0 , 7 ,  ';
      const { records, report } = parseImageTagCsv(csv);

      assert.deepEqual(records, [
        { name: "tag, name", category: 0, postCount: 10, aliases: ["alias one", 'alias "two"'] },
        { name: "padded tag", category: 0, postCount: 7, aliases: [] },
      ]);
      assert.equal(report.acceptedRows, 2);
      assert.equal(report.totalRows, 2);
    },
  },
  {
    name: "strips one BOM and recognizes a full header without dropping the first row",
    run() {
      const { records, report } = parseImageTagCsv(
        '\uFEFFtag_name,category_id,count,aliases\r\nfirst,0,5,"a,b"\r\nsecond,1,2,\r\n',
      );

      assert.deepEqual(records, [
        { name: "first", category: 0, postCount: 5, aliases: ["a", "b"] },
        { name: "second", category: 1, postCount: 2, aliases: [] },
      ]);
      assert.equal(report.headerRows, 1);
      assert.equal(report.totalRows, 3);
      assert.equal(report.acceptedRows, 2);
      assert.equal(report.blankRows, 0);
    },
  },
  {
    name: "keeps a literal tag row that only resembles a header",
    run() {
      const { records, report } = parseImageTagCsv("name,0,7,\naliases,1,2,\n");

      assert.deepEqual(records, [
        { name: "name", category: 0, postCount: 7, aliases: [] },
        { name: "aliases", category: 1, postCount: 2, aliases: [] },
      ]);
      assert.equal(report.headerRows, 0);
    },
  },
  {
    name: "keeps exact Unicode, punctuation, case and category in dedupe keys",
    run() {
      const csv = [
        "Miku_Hatsune,1,100,",
        "miku_hatsune,1,90,",
        "Miku_Hatsune,3,80,",
        '初音ミク(Ver.2),4,70,"はつね,ミク"',
        "Miku_Hatsune,1,1,",
        'Miku_Hatsune,1,2,"different aliases"',
      ].join("\n");
      const { records, report } = parseImageTagCsv(csv);

      assert.deepEqual(
        records.map((record) => record.name),
        ["Miku_Hatsune", "miku_hatsune", "Miku_Hatsune", "初音ミク(Ver.2)"],
      );
      assert.equal(records[2]!.category, 3);
      assert.deepEqual(records[3]!.aliases, ["はつね", "ミク"]);
      assert.equal(report.duplicateRows, 2);
      assert.equal(report.acceptedRows, 4);
      assert.equal(report.totalRows, 6);
      assert.deepEqual(report.issues, [
        { row: 5, code: "duplicate" },
        { row: 6, code: "duplicate" },
      ]);
    },
  },
  {
    name: "dedupes exact names instead of normalized query keys",
    run() {
      const { records, report } = parseImageTagCsv("foo_bar,0,1,\nfoo bar,0,1,\nFoo_Bar,0,1,\nfoo_bar,0,1,\n");

      assert.deepEqual(
        records.map((record) => record.name),
        ["foo_bar", "foo bar", "Foo_Bar"],
      );
      assert.equal(report.duplicateRows, 1);
    },
  },
  {
    name: "rejects numeric fields that would need repair",
    run() {
      const csv = [
        "valid,0,1,",
        "decimal,0,1.5,",
        "negative,0,-2,",
        "suffix,0,12abc,",
        "empty,0,,",
        "unsafe,0,9007199254740992,",
        "badcat,2,1,",
        "paddedcat,00,1,",
      ].join("\n");
      const { records, report } = parseImageTagCsv(csv);

      assert.equal(records.length, 1);
      assert.equal(report.totalRows, 8);
      assert.equal(report.invalidRows, 7);
      assert.deepEqual(report.issues, [
        { row: 2, code: "invalid_count" },
        { row: 3, code: "invalid_count" },
        { row: 4, code: "invalid_count" },
        { row: 5, code: "invalid_count" },
        { row: 6, code: "invalid_count" },
        { row: 7, code: "invalid_category" },
        { row: 8, code: "invalid_category" },
      ]);
    },
  },
  {
    name: "applies the selected category to three-column imports",
    run() {
      const { records, report } = parseImageTagCsv('tag_name,count,aliases\nalpha,10,"a,b"\nbeta,20,\n', {
        category: 4,
      });

      assert.equal(report.headerRows, 1);
      assert.deepEqual(records, [
        { name: "alpha", category: 4, postCount: 10, aliases: ["a", "b"] },
        { name: "beta", category: 4, postCount: 20, aliases: [] },
      ]);

      const headerless = parseImageTagCsv("alpha,10,\n", { category: 5 });
      assert.deepEqual(headerless.records, [{ name: "alpha", category: 5, postCount: 10, aliases: [] }]);

      assert.throws(() => parseImageTagCsv("alpha,10,\n"), /three-column/i);
      assert.throws(() => parseImageTagCsv("alpha,10,\n", { category: 2 as unknown as ImageTagCategory }), /category/i);
    },
  },
  {
    name: "fails hard on empty, all-invalid and over-limit imports",
    run() {
      assert.throws(() => parseImageTagCsv(""), /no accepted rows/i);
      assert.throws(() => parseImageTagCsv(" \r\n\n"), /no accepted rows/i);
      assert.throws(() => parseImageTagCsv("bad,9,1,\n"), /no accepted rows/i);
      assert.throws(() => parseImageTagCsv("one,0,1,\ntwo,0,2,\n", { maxRecords: 1 }), /maximum of 1 records/i);
      assert.throws(() => parseImageTagCsv("one,0,1,\n", { maxRecords: 0 }), /maxRecords/i);
      assert.throws(() => parseImageTagCsv("one,0,1,\n", { maxRecords: 1.5 }), /maxRecords/i);
      assert.throws(
        () =>
          parseImageTagCsv("one,0,1,\n", {
            maxRecords: IMAGE_TAG_LIMITS.recordsPerSource + 1,
          }),
        /maxRecords/i,
      );
    },
  },
  {
    name: "rejects malformed quoting as a whole-import error",
    run() {
      const malformed = ['"unterminated,0,1,', 'a"b,0,1,', '"a"x,0,1,', '"a" ,0,1,', 'good,0,1,\n"bad"x,0,2,'];

      for (const csv of malformed) {
        assert.throws(() => parseImageTagCsv(csv), /Malformed CSV/);
      }
    },
  },
  {
    name: "parses multiline records but rejects embedded controls and unbounded aliases",
    run() {
      const tooManyAliases = Array.from(
        { length: IMAGE_TAG_LIMITS.aliasesPerRecord + 1 },
        (_, index) => `a${index}`,
      ).join(",");
      const overlongAlias = "x".repeat(IMAGE_TAG_LIMITS.fieldCharacters + 1);
      const csv = [
        "good,0,1,",
        '"multi\nline",0,2,',
        'control,0,3,"a\tb"',
        `too-many,0,4,"${tooManyAliases}"`,
        `overlong,0,5,"${overlongAlias}"`,
      ].join("\n");
      const { records, report } = parseImageTagCsv(csv);

      assert.deepEqual(records, [{ name: "good", category: 0, postCount: 1, aliases: [] }]);
      assert.equal(report.invalidRows, 4);
      assert.deepEqual(
        report.issues.map((issue) => issue.code),
        ["invalid_name", "invalid_aliases", "invalid_aliases", "invalid_aliases"],
      );
    },
  },
  {
    name: "caps issue examples without losing duplicate counts",
    run() {
      const duplicateCount = IMAGE_TAG_LIMITS.issueExamples + 5;
      const rows = ["kept,0,1,"];
      for (let index = 0; index < duplicateCount; index += 1) rows.push("kept,0,1,");

      const { records, report } = parseImageTagCsv(rows.join("\n"));

      assert.equal(records.length, 1);
      assert.equal(report.duplicateRows, duplicateCount);
      assert.equal(report.totalRows, duplicateCount + 1);
      assert.equal(report.issues.length, IMAGE_TAG_LIMITS.issueExamples);
      assert.equal(report.omittedIssues, 5);
      assert.ok(report.issues.every((issue) => issue.code === "duplicate"));
    },
  },
  {
    name: "normalizes query whitespace and case without dropping punctuation",
    run() {
      assert.equal(normalizeImageTagQuery("  Miku__Hatsune   (v2) "), "miku hatsune (v2)");
      assert.equal(normalizeImageTagQuery("Tag,_Under_Score!"), "tag, under score!");
      assert.equal(normalizeImageTagQuery("A.B-C/D"), "a.b-c/d");
      assert.equal(normalizeImageTagQuery("_foo_\tbar"), "foo bar");
      assert.equal(normalizeImageTagQuery(""), "");
    },
  },
]);

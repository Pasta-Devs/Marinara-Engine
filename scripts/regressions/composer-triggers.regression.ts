import assert from "node:assert/strict";
import {
  activeToken,
  composerKeyAction,
  draftSegments,
  formatReferenceToken,
  pastedFiles,
  type ComposerKeyInput,
  type ComposerMark,
} from "../../packages/client/src/lib/composer-triggers.js";

const atEnd = (text: string) => activeToken(text, text.length);

// @ triggers
assert.deepEqual(atEnd("@Ali"), { trigger: "@", query: "Ali", start: 0, end: 4, quoted: false });
assert.deepEqual(atEnd("ask @Al"), { trigger: "@", query: "Al", start: 4, end: 7, quoted: false });
assert.equal(atEnd("ask (@Al")?.start, 5);
assert.equal(atEnd("@")?.query, "");
assert.equal(atEnd("me@mail.com"), null);
assert.equal(atEnd("a@"), null);
// caret mid-token: the query stops at the caret, the token end does not
const mid = activeToken("hi @Alice there", 6);
assert.equal(mid?.query, "Al");
assert.equal(mid?.start, 3);
assert.equal(mid?.end, 9);
// a space ends it
assert.equal(atEnd("@Alice "), null);
assert.equal(activeToken("@Alice bob", 7), null);
// quoted
assert.deepEqual(atEnd('@"Alice in'), { trigger: "@", query: "Alice in", start: 0, end: 10, quoted: true });
// A bare name may hold spaces when it runs to the end of the draft, so no quotes are needed.
assert.deepEqual(atEnd("@Fel Lock"), { trigger: "@", query: "Fel Lock", start: 0, end: 9, quoted: false });
assert.equal(atEnd("@Fel Lock, then"), null);
assert.equal(atEnd('see @"Alice in Wonderland"'), null);
assert.equal(activeToken('@"Alice in Wonderland" x', 21)?.query, "Alice in Wonderland");
assert.equal(activeToken('@"Alice in Wonderland" x', 22), null);
assert.equal(atEnd('@"Alice" and @Bo')?.query, "Bo");

// / triggers
assert.deepEqual(atEnd("/he"), { trigger: "/", query: "he", start: 0, end: 3, quoted: false });
assert.equal(atEnd("/")?.query, "");
assert.equal(atEnd("hello\n/he")?.start, 6);
assert.equal(atEnd("  /he")?.start, 2);
assert.equal(atEnd("hello /he"), null);
assert.equal(atEnd("/usr/bin"), null);
assert.equal(atEnd("and/or"), null);
assert.equal(atEnd("/help me"), null);

// formatReferenceToken
assert.equal(formatReferenceToken("Alice"), "@Alice");
assert.equal(formatReferenceToken("Alice in Wonderland"), "@Alice in Wonderland");
assert.equal(formatReferenceToken('The "Best" One'), "@The Best One");

// composerKeyAction
const base: ComposerKeyInput = {
  key: "",
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  isComposing: false,
  pickerOpen: false,
  hasGhost: false,
  enterToSend: true,
};
const act = (over: Partial<ComposerKeyInput>) => composerKeyAction({ ...base, ...over });
assert.equal(act({ key: "Enter", isComposing: true, pickerOpen: true }), "none");
assert.equal(act({ key: "Tab", isComposing: true, hasGhost: true }), "none");
assert.equal(act({ key: "ArrowDown", pickerOpen: true }), "picker-next");
assert.equal(act({ key: "ArrowUp", pickerOpen: true }), "picker-prev");
assert.equal(act({ key: "Enter", pickerOpen: true }), "picker-accept");
assert.equal(act({ key: "Tab", pickerOpen: true, hasGhost: true }), "picker-accept");
assert.equal(act({ key: "Escape", pickerOpen: true }), "picker-close");
assert.equal(act({ key: "Escape" }), "none");
assert.equal(act({ key: "ArrowDown" }), "none");
assert.equal(act({ key: "Tab", hasGhost: true }), "ghost-accept");
assert.equal(act({ key: "Tab", hasGhost: true, shiftKey: true }), "none");
// inside an @ token a single Tab links the match; prose Tab stays a plain completion
assert.equal(act({ key: "Tab", hasGhost: true, inReferenceToken: true }), "ghost-link");
assert.equal(act({ key: "Tab", hasGhost: true, inReferenceToken: false }), "ghost-accept");
assert.equal(act({ key: "Tab", hasGhost: false, inReferenceToken: true }), "none");
assert.equal(act({ key: "Tab", hasGhost: true, inReferenceToken: true, shiftKey: true }), "none");
// an open picker outranks the ghost: its row replaces the suggestion
assert.equal(act({ key: "Tab", pickerOpen: true, hasGhost: true, inReferenceToken: true }), "picker-accept");
// lorebook drill-down: ArrowRight in, ArrowLeft out, only when the picker says so
assert.equal(act({ key: "ArrowRight", pickerOpen: true, canDrillIn: true }), "picker-drill");
assert.equal(act({ key: "ArrowRight", pickerOpen: true }), "none");
assert.equal(act({ key: "ArrowRight", canDrillIn: true }), "none");
assert.equal(act({ key: "ArrowLeft", pickerOpen: true, canDrillOut: true }), "picker-back");
assert.equal(act({ key: "ArrowLeft", pickerOpen: true }), "none");
assert.equal(act({ key: "Tab" }), "none");
assert.equal(act({ key: "Enter", hasGhost: true }), "send");
assert.equal(act({ key: "Enter", shiftKey: true }), "none");
assert.equal(act({ key: "Enter", enterToSend: false }), "none");
assert.equal(act({ key: "Enter", enterToSend: false, metaKey: true }), "send");
assert.equal(act({ key: "Enter", enterToSend: false, ctrlKey: true }), "send");
assert.equal(act({ key: "a" }), "none");

// draftSegments
const joined = (value: string, marks: ComposerMark[]) =>
  draftSegments(value, marks)
    .map((seg) => seg.text)
    .join("");
assert.deepEqual(draftSegments("hello", []), [{ text: "hello" }]);
assert.deepEqual(draftSegments("", [{ start: 0, end: 3, tone: "reference" }]), []);
assert.deepEqual(draftSegments("hi @Al ok", [{ start: 3, end: 6, tone: "reference" }]), [
  { text: "hi " },
  { text: "@Al", tone: "reference" },
  { text: " ok" },
]);
assert.deepEqual(draftSegments("@Al ok", [{ start: 0, end: 3, tone: "pending" }]), [
  { text: "@Al", tone: "pending" },
  { text: " ok" },
]);
assert.deepEqual(draftSegments("ok @Al", [{ start: 3, end: 6, tone: "unresolved" }]), [
  { text: "ok " },
  { text: "@Al", tone: "unresolved" },
]);
// clamped, and fully out-of-range or empty marks dropped
assert.deepEqual(draftSegments("ok @Al", [{ start: 3, end: 99, tone: "reference" }]), [
  { text: "ok " },
  { text: "@Al", tone: "reference" },
]);
assert.deepEqual(draftSegments("ok", [{ start: -5, end: 1, tone: "reference" }]), [
  { text: "o", tone: "reference" },
  { text: "k" },
]);
assert.deepEqual(
  draftSegments("ok", [
    { start: 5, end: 9, tone: "reference" },
    { start: 1, end: 1, tone: "pending" },
  ]),
  [{ text: "ok" }],
);
// overlap: the earlier start wins, then the longer on an equal start
assert.deepEqual(
  draftSegments("abcdef", [
    { start: 2, end: 5, tone: "pending" },
    { start: 0, end: 3, tone: "reference" },
  ]),
  [{ text: "abc", tone: "reference" }, { text: "def" }],
);
assert.deepEqual(
  draftSegments("abcdef", [
    { start: 1, end: 2, tone: "pending" },
    { start: 1, end: 4, tone: "reference" },
  ]),
  [{ text: "a" }, { text: "bcd", tone: "reference" }, { text: "ef" }],
);
// unsorted input
assert.deepEqual(
  draftSegments("@a @b", [
    { start: 3, end: 5, tone: "unresolved" },
    { start: 0, end: 2, tone: "reference" },
  ]),
  [{ text: "@a", tone: "reference" }, { text: " " }, { text: "@b", tone: "unresolved" }],
);
// concatenation invariant
const sample = 'x @Al \n@"B c" y';
const markSets: ComposerMark[][] = [
  [],
  [{ start: 2, end: 5, tone: "reference" }],
  [
    { start: -3, end: 4, tone: "pending" },
    { start: 3, end: 40, tone: "unresolved" },
  ],
  [
    { start: 7, end: 12, tone: "reference" },
    { start: 2, end: 5, tone: "reference" },
    { start: 4, end: 8, tone: "pending" },
  ],
];
for (const marks of markSets) assert.equal(joined(sample, marks), sample);

// A screenshot attaches; a copy that also carries text stays a text paste.
{
  const shot = new File(["x"], "image.png", { type: "image/png" });
  const clipboard = (text: string, items: { kind: string; getAsFile: () => File | null }[]) =>
    ({ getData: () => text, items }) as unknown as Pick<DataTransfer, "items" | "getData">;
  const fileItem = { kind: "file", getAsFile: () => shot };
  assert.deepEqual(pastedFiles(clipboard("", [fileItem])), [shot]);
  assert.deepEqual(pastedFiles(clipboard("  ", [fileItem])), [shot]);
  assert.deepEqual(pastedFiles(clipboard("Cell A1", [fileItem])), []);
  assert.deepEqual(pastedFiles(clipboard("image.png", [fileItem])), [shot]);
  assert.deepEqual(pastedFiles(clipboard("/home/me/image.png", [fileItem])), [shot]);
  assert.deepEqual(pastedFiles(clipboard("see image.png for details", [fileItem])), []);
  assert.deepEqual(pastedFiles(clipboard("hello", [{ kind: "string", getAsFile: () => null }])), []);
  assert.deepEqual(pastedFiles(clipboard("", [{ kind: "file", getAsFile: () => null }])), []);
}

console.log("Composer triggers regression passed");

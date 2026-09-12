// Package-declared Game Master verbs (#5798) — the DECLARATION half.
//
// The two pinned constants in gm-verb-table.schema.ts are the only reason the guards mean
// anything, and both are copies of facts that live somewhere else. This regression re-derives
// each of them from its real source and fails when the copy falls behind:
//   - RESERVED_GM_TAG_NAMES vs every bracket tag the GM and party reminders can render AND every
//     tag the Engine's five narration parsers match back out of a turn, so a new built-in tag
//     cannot become shadowable by a package verb;
//   - ENGINE_OWNED_METADATA_KEY_PREFIXES vs every top-level ChatMetadata key, every engine-owned
//     *_METADATA_KEY constant, and every key that lives in the interface's index signature rather
//     than in its declaration — read out of chat-metadata writes in all four of their shapes, reads
//     in all three of theirs, and the Engine's own curated list of per-chat keys, which is the only
//     source that sees a key written and read entirely across function boundaries — so a new engine
//     namespace cannot become squattable.
// A pin re-derived from an extractor narrower than the vocabulary passes vacuously, so each
// extractor is asserted to have found something first — a size floor, plus one canary per source
// that no other source in the union can supply. A canary is only load-bearing while it stays
// unique, and uniqueness is a property of the whole union: adding a source can silently make an
// existing canary vacuous, so every canary here is re-audited against the other sources whenever
// one joins. Where a source has no such key, the extractor's own behavior is pinned instead, on a
// synthetic input. Two things no sweep here can read: a metadata write handed a variable, which is
// counted rather than ignored with the count pinned; and a metadata read that happens inside a
// helper, off a parameter, which is why a curated Engine list is one of the sources.
//
// The rest drives the schema itself — the effect/metadataKey split, the D1 key-ownership rules,
// the per-argument caps, and the per-verb degradation — plus the fact that PR1a is inert: nothing
// in the Engine imports this schema yet.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  camelCaseCapabilityPackageId,
  createGmVerbTableSchema,
  ENGINE_OWNED_METADATA_KEY_PREFIXES,
  GM_VERB_TABLE_ASSET_PATH,
  GM_VERB_TABLE_MAX_BYTES,
  gmVerbMetadataKeyIssue,
  gmVerbTableSchema,
  parseGmVerbTableWithCompat,
  RESERVED_GM_TAG_NAMES,
} from "../../packages/shared/src/schemas/gm-verb-table.schema.js";
import { CHAT_PRESET_EXCLUDED_METADATA_KEYS } from "../../packages/shared/src/types/chat-preset.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Comments are stripped before every sweep below: a bracket tag inside a doc comment
 *  (`[some_tag: …]`, `"[tagPrefix:"`) is prose about the parser, not vocabulary it handles.
 *
 *  The stripper is the TypeScript compiler's own parser, because nothing short of a parser can do
 *  this correctly. Whether a `/` opens a comment, opens a regex or divides is not a lexical property
 *  of the two characters — it depends on the grammar around them — so every hand scan gets it wrong
 *  in both directions, and the one this replaced got it wrong in both: `/[/*]/` opened a block
 *  comment and ate the source through to the next `*` + `/` anywhere in the file, `/[//]/` and a
 *  regex ending `\//` each ate the rest of their own line, and a `'` inside a character class
 *  desynced the walk into treating live code as string body and skipping real comments inside it.
 *  Twenty-nine files across the sweep corpus came out wrong one of those two ways. Source deleted
 *  before a sweep reads it — or prose left in front of one — is exactly the vacuous narrowing this
 *  file exists to catch: a sweep reading less than it claims to, and passing because what it should
 *  have found went missing before it looked. So the parse IS the strip: every token's leading and
 *  trailing comment ranges, spliced out. Across the 1,337 swept files it removes 22,423 ranges, every
 *  one a well-formed comment, none overlapping a string, template or regex literal.
 *
 *  `fileName` is how the parser is told which dialect to read, and neither dialect is safe as a
 *  blanket default — `createSourceFile` takes it off the extension. Read as TSX, the `<{ Params: … }>`
 *  type argument on `app.get` in `game.routes.ts` parses as JSX and hides 313 of that file's 665
 *  comments; read as TS, the JSX in `markdown.tsx` hides 23 of its 105. Both are files swept below.
 *  Callers holding a path pass it; the synthetic fixtures take the default.
 *
 *  String literals are kept verbatim, as before, because Pin 1 reads bracket tags out of them and the
 *  metadata sweep strips them itself. */
function withoutComments(source: string, fileName = "sweep.ts"): string {
  const parsed = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, /* setParentNodes */ false);
  const comments: ts.CommentRange[] = [];
  const started = new Set<number>();
  const collect = (found: ts.CommentRange[] | undefined) => {
    // A comment trailing one token is the leading trivia of the next, so it arrives twice. Both
    // halves are needed: a comment on the same line as the code before it is trailing-only, and one
    // on its own line is leading-only.
    for (const range of found ?? []) {
      if (started.has(range.pos)) continue;
      started.add(range.pos);
      comments.push(range);
    }
  };
  const walk = (node: ts.Node) => {
    for (const child of node.getChildren(parsed)) {
      collect(ts.getLeadingCommentRanges(source, child.pos));
      collect(ts.getTrailingCommentRanges(source, child.end));
      walk(child);
    }
  };
  walk(parsed);
  comments.sort((left, right) => left.pos - right.pos);
  let out = "";
  let index = 0;
  for (const comment of comments) {
    if (comment.pos < index) continue;
    out += source.slice(index, comment.pos);
    index = comment.end;
  }
  return out + source.slice(index);
}

/** The chat-metadata route path, kept alive through the strip below. It carries no quote, brace,
 *  bracket, parenthesis or regex metacharacter, so it is inert everywhere except in the one arm
 *  that looks for it. */
const CHAT_METADATA_ROUTE_MARKER = '"@chatMetadataRoute"';

/** Comments and string literals both stripped. The metadata-write sweep matches braces and
 *  parentheses by hand, so a `{`, `}` or `(` inside a string would throw the balance off. One
 *  literal survives as a marker rather than as `""`: the direct-PATCH arm recognizes its calls by
 *  their URL (`PATCH /chats/:id/metadata`) and nothing else on the line tells them apart from any
 *  other `api.patch`, so erasing the path would erase the arm. */
function withoutCommentsOrStrings(source: string, fileName?: string): string {
  return withoutComments(source, fileName).replace(
    /"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g,
    (literal) => (/^.\/chats\/[^\s]*\/metadata.$/.test(literal) ? CHAT_METADATA_ROUTE_MARKER : '""'),
  );
}

function sourceOf(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

type SourceFile = { path: string; source: string };

/** Every TypeScript source under a package directory, read once — three sweeps below scan the
 *  same files. */
function readSourceFiles(relativeDirectory: string): SourceFile[] {
  const files: SourceFile[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) walk(entryPath);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        files.push({ path: entryPath, source: readFileSync(entryPath, "utf8") });
      }
    }
  };
  walk(join(repositoryRoot, relativeDirectory));
  return files;
}

const serverSourceFiles = readSourceFiles("packages/server/src");
const sharedSourceFiles = readSourceFiles("packages/shared/src");
const clientSourceFiles = readSourceFiles("packages/client/src");

// ── The comment strip both pins read through ─────────────────────────────────

// The strip's own behavior, on a synthetic source, because every sweep below sees only what it
// returns. Neither a `/*` inside a string literal nor one inside a regex literal is a comment
// opener, and both of the hand scans this replaced read one or the other as one. Both shapes ship:
// sixty-seven string literals across the swept files carry `/*`, from `"image/*"` on a file input to
// the bot-browser `Accept` headers and route globs, and the first regex strip ate 2,456 lines of live
// source out of 131 of them; the hand scan that fixed THAT still read a regex literal's contents as
// comment openers, and `/^https?:\/\//i`, `/^models\//` and their kin ate the rest of their lines
// across nineteen more. Source deleted before a sweep reads it is exactly the vacuous narrowing this
// file exists to catch, so the strip is pinned in both directions: the literals survive with the code
// after them, and real comments still vanish.
const strippedFixture = withoutComments(
  [
    'api.get("/assets/*", handler); // [trailing_tag: prose]',
    "const kept = parseChatMetadata(chat.metadata).scenario;",
    "/* [block_tag: prose] */",
    "  // [line_tag: prose]",
    "const blockish = /[/*]/;",
    "const afterBlockish = blockishSurvivor;",
    "const lineish = /[//]/;",
    "const afterLineish = lineishSurvivor;",
    "const tailing = /path\\//;",
    "const afterTailing = tailingSurvivor;",
  ].join("\n"),
);
assert.match(strippedFixture, /"\/assets\/\*"/, "a string literal carrying /* is not a comment opener");
assert.match(
  strippedFixture,
  /const kept = parseChatMetadata\(chat\.metadata\)\.scenario;/,
  "the source after such a literal survives the strip",
);
// A regex literal is not a comment opener either, in any of the three shapes that used to break the
// scan: `/*` inside a character class (which opened a block comment and ate everything through to the
// next close, here the whole rest of the fixture), `//` inside one, and an escaped slash immediately
// before the closing delimiter (which ate the line tail). Each is pinned with the statement after it,
// because losing the survivor is how the damage actually shows up in a sweep.
for (const [literal, survivor] of [
  ["/[/*]/", "blockishSurvivor"],
  ["/[//]/", "lineishSurvivor"],
  ["/path\\//", "tailingSurvivor"],
] as const) {
  assert.ok(strippedFixture.includes(literal), `a regex literal carrying a comment opener survives (${literal})`);
  assert.ok(strippedFixture.includes(survivor), `the source after such a regex survives the strip (${survivor})`);
}
for (const prose of ["trailing_tag", "block_tag", "line_tag"]) {
  assert.ok(!strippedFixture.includes(prose), `a real comment still vanishes (${prose})`);
}

// ── Pin 1: reserved GM tag names ─────────────────────────────────────────────

/** Every bracket-tag name a parser matches, walking the alternation groups the dialogue tokens
 *  live in: `\[(main|side|extra|action|thought|whisper(?::…)?)\]` names six tags, and a scan that
 *  only reads the identifier straight after `\[` finds none of them, because what follows the
 *  bracket there is a `(`. An opener is an escaped bracket inside a regex literal or a bracket at
 *  the head of a string literal. */
function bracketTagNames(source: string): Set<string> {
  // All three walk regexes are sticky, so each carries a `lastIndex` the walk below rewrites between
  // every step. They are built per call rather than once beside the function so that position state
  // belongs to one invocation and cannot be inherited from — or left behind for — another.
  const groupOpeners = /(?:\((?:\?(?:[:!=]|<[=!]|<[A-Za-z_$][\w$]*>))?)*/y;
  const tagIdentifier = /[A-Za-z_][A-Za-z0-9_-]*/y;
  /** The `|` opening the next alternation branch, plus whatever regex noise sits between it and the
   *  branch just read: a trailing group, a quantifier, a colon, or spaces on either side.
   *  `\[(main|whisper(?::[^\]]+)?|thought)\]` names three tags, and a walk that stops at the group
   *  finds two — a truncation that reads as a narrower pin rather than as a failure, which is why the
   *  synthetic fixture below puts the group-carrying branch in the MIDDLE of its alternation. THREE
   *  shapes stay out of reach and are left that way, each ending the walk at the branch before it:
   *  a backslash escape inside a branch name (`\[(alpha|be\-ta|gamma)\]` yields `alpha`, `be`), a
   *  brace quantifier (`\[(one|two{2}|three)\]` yields `one`, `two`) and a character class
   *  (`\[(one|two[ab]|three)\]`, the same). Only the escape is hard to step over: letting the
   *  IDENTIFIER span escapes makes it swallow a closing `\]` and invent names like `party-turn]`. The
   *  other two are simply unneeded — every alternation branch in the five swept parsers is a plain
   *  identifier (`main|side|extra|action|thought|whisper`, `music|sfx|bg|ambient`, `Note|Book`), and a
   *  walk widened to step over all three finds not one extra name in any of them. The truncation is
   *  documented rather than papered over. */
  const tagAlternation = /(?:\((?:[^()\\]|\\.)*\)|[?*+]|:|\s)*\|\s*/y;
  const names = new Set<string>();
  for (const opener of source.matchAll(/(?:\\\[|["'`]\[)/g)) {
    let index = (opener.index ?? 0) + opener[0].length;
    for (;;) {
      // Step over regex group openers — plain, non-capturing, lookaround and named alike — so
      // `\[(?!Note:|Book:)`, `\[(main|…` and a future `\[(?<tag>…` all reach a name.
      groupOpeners.lastIndex = index;
      index = groupOpeners.exec(source) ? groupOpeners.lastIndex : index;
      tagIdentifier.lastIndex = index;
      const name = tagIdentifier.exec(source);
      if (!name) break;
      names.add(name[0].toLowerCase());
      tagAlternation.lastIndex = tagIdentifier.lastIndex;
      if (!tagAlternation.exec(source)) break;
      index = tagAlternation.lastIndex;
    }
  }
  return names;
}

// Source A — every `[name:` the GM format reminder and the party/VN reminder can render, across
// all of their branches. Prompt files are swept in colon form only: they carry example lines whose
// brackets hold arbitrary speaker names and expressions (`[Dottore] [main] [smirk]:`), so a
// bare-bracket sweep of one would pin half a cast list.
const reminderTags = new Set<string>();
for (const file of [
  "packages/server/src/services/game/gm-prompts.ts",
  "packages/server/src/services/game/party-prompts.ts",
]) {
  for (const match of withoutComments(sourceOf(file), file).matchAll(/\[([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) {
    reminderTags.add(match[1]!.toLowerCase());
  }
}

// Source B — every bracket name the Engine parses back out of a finished turn. There are five
// parsers, not two: the client tag parser and the client narration formatter, the server's segment
// editor, the sidecar scene analyzer, and the generate route's dialogue rewriter. The dialogue
// tokens are pinned from here rather than from the reminder, because the reminder renders them
// inside an alternation (`[main|side|whisper:Target|thought]`) that a `[name:` sweep cannot see —
// and a shadowed name does its damage where the Engine parses it, not where it prints it.
// Only two of the five carry a name no other source in the union supplies: the tag parser
// (`party-chat`/`party-turn`) and the narration formatter (`qte_bonus`/`qte_result`, rendered as
// command badges mid-stream). The other three are swept for rot cover only — dropping one of them
// from this list would leave the pin green today — so that a token that arrives in one of them
// first cannot become shadowable before anyone notices.
// `GameNarration.tsx` matches the same dialogue-token header and the journal tags and is
// deliberately NOT here: the walk below reads a CSS attribute selector ("[data-log-anchor-key]"),
// a log prefix (`[game-tts]`) and two multi-word phrases (`[start the game]`, `[To the party]`) in
// it as bracket names, so sweeping it would put four non-tags into RESERVED_GM_TAG_NAMES to buy
// names the five above already hold. Rot cover is not worth widening what the constant claims to be.
const parserTags = new Set<string>();
for (const file of [
  "packages/client/src/lib/game-tag-parser.ts",
  "packages/client/src/components/game/game-narration-format.ts",
  "packages/server/src/services/game/segment-edits.ts",
  "packages/server/src/services/sidecar/scene-analyzer.ts",
  "packages/server/src/routes/generate/generate-route-utils.ts",
]) {
  for (const name of bracketTagNames(withoutComments(sourceOf(file), file))) parserTags.add(name);
}

assert.ok(reminderTags.size >= 15, `the GM reminder sweep found only ${reminderTags.size} tags; the extractor broke`);
assert.ok(parserTags.size >= 25, `the tag-parser sweep found only ${parserTags.size} tags; the extractor broke`);
// Canaries no other source in the union can supply, so losing one proves a source dropped out:
// `reputation` only ever appears in the GM reminder, `whisper` in colon form only in the party
// reminder, the party pair only in the client tag parser, the QTE pair only in the client narration
// formatter, and `main`/`whisper` only inside a regex alternation, which is what the narrow sweep
// this pin used to run could not read.
// `element_attack` used to stand for the tag parser here and no longer can: the narration formatter
// matches it too, so the assertion survived that source joining while the tag parser itself — the
// widest of the five, and the sole supplier of the party pair — went unpinned. Uniqueness is a
// property of the union, not of a source, so re-audit every canary below whenever a file is added
// to either list above.
assert.ok(reminderTags.has("reputation"), "the reminder sweep must still see [reputation:");
assert.ok(reminderTags.has("whisper"), "the party-prompts reminder must still be part of the sweep");
assert.ok(
  parserTags.has("party-chat") && parserTags.has("party-turn"),
  "the client tag parser must still be part of the sweep",
);
assert.ok(
  parserTags.has("qte_bonus") && parserTags.has("qte_result"),
  "the client narration formatter must still be part of the sweep",
);
assert.ok(
  parserTags.has("main") && parserTags.has("whisper"),
  "the alternation walk must still see the dialogue tokens",
);
// The walk's own behavior, on a synthetic source: a lookahead group, a plain group whose MIDDLE
// branch trails a nested group and a quantifier, a NAMED group spaced around its `|`, a
// string-literal bracket, and a `\w+` bracket that names nothing. The lookahead and named branches
// need pinning here because no shipped parser depends on either alone — `Note` and `Book` also
// appear as plain string literals, and nothing names a group today — so a regression in either
// would otherwise be invisible. `three` and `five` pin the widened alternation walk: put the
// group-carrying branch LAST, as this fixture used to, and a walk that truncates at the group still
// passes, which is how a truncating walk hid behind a green pin. Each name here is reachable one
// way only, so no branch of the walk can be dropped without reddening this assertion.
assert.deepEqual(
  [
    ...bracketTagNames(
      String.raw`/\[(?!Note:|Book:)\w+:/ /\[(one|two(?::x)?|three)\]/ /\[(?<tag>four | five)\]/ "[six:" /\[\w+:/`,
    ),
  ].sort(),
  ["book", "five", "four", "note", "one", "six", "three", "two"],
);

const reserved = new Set<string>(RESERVED_GM_TAG_NAMES);
const unpinnedTags = [...new Set([...reminderTags, ...parserTags])].filter((tag) => !reserved.has(tag)).sort();
assert.deepEqual(unpinnedTags, [], `new built-in GM tags are not in RESERVED_GM_TAG_NAMES: ${unpinnedTags.join(", ")}`);
// Case-folding is the point of the pin: the reminder renders [Note:/[Book: capitalized while the
// shipped parse regex is case-insensitive.
assert.ok(reserved.has("note") && reserved.has("book"), "the journal tags are pinned case-folded");

// ── Pin 2: engine-owned metadata namespaces ──────────────────────────────────

/** Top-level members of `interface ChatMetadata`, by brace matching then two-space indentation —
 *  nested object types are indented deeper, so only the interface's own keys match. */
function chatMetadataKeys(): string[] {
  const source = sourceOf("packages/shared/src/types/chat.ts");
  const declaration = source.indexOf("export interface ChatMetadata {");
  assert.notEqual(declaration, -1, "interface ChatMetadata moved; the metadata-key sweep needs updating");
  const open = source.indexOf("{", declaration);
  let depth = 0;
  let close = -1;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        close = index;
        break;
      }
    }
  }
  assert.notEqual(close, -1, "interface ChatMetadata is unbalanced; the metadata-key sweep needs updating");
  return [...source.slice(open + 1, close).matchAll(/^ {2}([A-Za-z_][A-Za-z0-9_]*)\??\s*:/gm)].map(
    (match) => match[1]!,
  );
}

const engineMetadataKeys = new Set(chatMetadataKeys());
assert.ok(
  engineMetadataKeys.size >= 150,
  `the ChatMetadata sweep found only ${engineMetadataKeys.size} keys; the extractor broke`,
);
assert.ok(engineMetadataKeys.has("gameExperienceId") || engineMetadataKeys.has("gameSetupConfig"), "game keys survive");

// Engine-owned metadata keys that no interface declares — the write-ordinal mirror is the one that
// matters, because a package squatting `metadataWriteOrdinals` would corrupt write ordering.
for (const file of [...serverSourceFiles, ...sharedSourceFiles]) {
  for (const match of file.source.matchAll(/\b([A-Z][A-Z0-9_]*_KEY)\s*=\s*"([a-zA-Z][a-zA-Z0-9]*)"/g)) {
    if (match[1]!.includes("METADATA")) engineMetadataKeys.add(match[2]!);
  }
}
assert.ok(engineMetadataKeys.has("metadataWriteOrdinals"), "METADATA_WRITE_ORDINALS_KEY is part of the sweep");

/** Index of the bracket closing the one at `open`, or -1 when the source is unbalanced. All three
 *  bracket kinds are balanced together, so a `)` inside an object literal cannot end it early. */
function closingBracket(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]!;
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Every top-level key of the object literal whose `{` sits at `open`. The literal is walked rather
 *  than regex-matched because a multi-key patch has to surface all of its keys, and a key is read
 *  only at a property position so a ternary's `null :` inside a value is not mistaken for one.
 *  Regex literals survive `withoutCommentsOrStrings`, so an unbalanced `{` inside one would throw
 *  this walk off — loudly, as spurious keys tripping the prefix assertion below, never silently. */
function objectLiteralKeys(source: string, open: number): string[] {
  const keys: string[] = [];
  let depth = 0;
  let atProperty = false;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]!;
    if (character === "{") {
      depth += 1;
      atProperty = depth === 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) break;
    } else if (depth === 1 && character === ",") {
      atProperty = true;
    } else if (atProperty && !/\s/.test(character)) {
      // The first real character of a property position. A spread, a computed key or a shorthand
      // matches nothing here and simply closes the position, which is what keeps values out.
      const key = /^([a-z][a-zA-Z0-9]*)\s*:/.exec(source.slice(index));
      if (key) keys.push(key[1]!);
      atProperty = false;
    }
  }
  return keys;
}

const nestedFunctionBody = /(?:=>|\bfunction\b[^{;()]*(?:\([^()]*\))?[^{;]*)\s*\{/y;
const returnedObject = /\breturn\s*\{/y;

/** A JS identifier may contain `$`, and a call target swept below may contain `.`; both are regex
 *  metacharacters, and an unescaped `$` would silently turn the pattern into one that never
 *  matches — narrowing a sweep without failing anything.
 *
 *  The domain is dotted identifier paths, where `.` and `$` are the only metacharacters that can
 *  occur, but the escape is TOTAL — every regex metacharacter, backslash included — so that no
 *  future caller can narrow a sweep by handing this a name from a wider domain. A partial escaper
 *  is only ever correct for the callers it was written against, and it fails silently for the rest:
 *  the pattern still compiles, it just stops matching. Escaping the backslash first is what makes
 *  the set complete rather than merely longer — an escaper that rewrote `.` but passed `\` through
 *  would turn a name ending in a backslash into a pattern that escapes the boundary after it. */
function escapedForPattern(name: string): string {
  return name.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

/** Keys of every object literal the block body at `open` returns AT ITS OWN LEVEL. Nested function
 *  bodies are skipped whole, because a `return` inside one is that function's value, not the
 *  updater's: `chats.routes.ts` returns `{ updatedAt: now }` from a `.map()` over summary entries
 *  inside a `patchMetadata` callback, and collecting it would pin a namespace nothing ever writes
 *  to a chat. A `return` inside an `if` block is NOT nested and is collected, which is how the
 *  Engine's early-exit updaters are read. */
function returnedLiteralKeys(source: string, open: number): string[] {
  const end = closingBracket(source, open);
  if (end === -1) return [];
  const keys: string[] = [];
  for (let index = open + 1; index < end; index += 1) {
    nestedFunctionBody.lastIndex = index;
    if (nestedFunctionBody.exec(source)) {
      const nestedEnd = closingBracket(source, nestedFunctionBody.lastIndex - 1);
      index = nestedEnd === -1 ? end : nestedEnd;
      continue;
    }
    returnedObject.lastIndex = index;
    if (!returnedObject.exec(source)) continue;
    const literal = returnedObject.lastIndex - 1;
    keys.push(...objectLiteralKeys(source, literal));
    const literalEnd = closingBracket(source, literal);
    if (literalEnd === -1) break;
    index = literalEnd;
  }
  return keys;
}

/** The keys an argument expression writes, or `null` when the expression is not statically
 *  readable. Three shapes are readable: a bare object literal, a concise-body updater
 *  `(current) => ({…})`, and a block-body updater's own `return {…}`s. The slices are bounded so
 *  this stays linear over a half-megabyte route file; an argument whose head does not fit in them
 *  reads as unreadable, which the pinned count below announces rather than swallows. */
function writtenLiteralKeys(source: string, start: number): string[] | null {
  const literal = /^\s*\{/.exec(source.slice(start, start + 40));
  if (literal) return objectLiteralKeys(source, start + literal[0].length - 1);
  const arrow = /^\s*(?:async\s+)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>\s*/.exec(source.slice(start, start + 200));
  if (!arrow) return null;
  const body = start + arrow[0].length;
  if (source[body] === "(") {
    const inner = /^\(\s*\{/.exec(source.slice(body, body + 40));
    return inner ? objectLiteralKeys(source, body + inner[0].length - 1) : null;
  }
  return source[body] === "{" ? returnedLiteralKeys(source, body) : null;
}

/** Index just past the comma separating argument `argumentIndex - 1` from `argumentIndex`, or -1
 *  when the call has no such argument. Brackets are balanced, so a comma inside an earlier argument
 *  is not mistaken for the separator. */
function argumentStart(source: string, open: number, argumentIndex: number): number {
  let start = open + 1;
  for (let skipped = 0; skipped < argumentIndex; skipped += 1) {
    let depth = 1;
    let next = -1;
    for (let index = start; index < source.length && depth > 0; index += 1) {
      const character = source[index]!;
      if (character === "(" || character === "[" || character === "{") depth += 1;
      else if (character === ")" || character === "]" || character === "}") depth -= 1;
      else if (depth === 1 && character === ",") {
        next = index + 1;
        break;
      }
    }
    if (next === -1) return -1;
    start = next;
  }
  return start;
}

/** Every key a `patchMetadata`/`updateMetadata` call commits, plus a count of the calls this sweep
 *  cannot read. Both argument shapes have to be walked: the Engine reaches for an updater callback
 *  (`(current) => ({…})`, `(fresh) => { … return {…}; }`) about as often as it passes a bare patch
 *  object, and reading only the bare objects — which is what this sweep used to do — leaves the
 *  updaters' keys invisible to the pin, `archivedCharacterSnapshots` among them. A declaration is
 *  not a call site and is skipped: its first parameter carries a type annotation, an expression
 *  never does. What stays unreadable is a call handed a variable or a helper's return value
 *  (`patchMetadata(id, hydratedMeta)`); those keys are outside any static reach here, so they are
 *  counted and the count is pinned. */
function metadataWriteKeys(source: string): { keys: string[]; unreadableCalls: number } {
  const keys: string[] = [];
  let unreadableCalls = 0;
  for (const call of source.matchAll(/\b(?:patchMetadata|updateMetadata)\s*\(/g)) {
    const open = (call.index ?? 0) + call[0].length - 1;
    if (/^\s*[A-Za-z_$][\w$]*\s*\??\s*:/.test(source.slice(open + 1, open + 60))) continue;
    const start = argumentStart(source, open, 1);
    if (start === -1) continue;
    const written = writtenLiteralKeys(source, start);
    if (written === null) unreadableCalls += 1;
    else keys.push(...written);
  }
  return { keys, unreadableCalls };
}

/** The fourth write shape: a direct `PATCH /chats/:id/metadata` from client code, which goes
 *  through neither `patchMetadata` nor the mutation hook below — `GameSurface.tsx` reaches for it a
 *  dozen times (`api.patch(…, { gameCombatState: null })`) and the impersonate slash command twice.
 *  Only a bare object literal is read: the route takes a patch object and never an updater, so an
 *  argument of any other shape — a variable, a helper's return value, a route handler that happened
 *  to be registered under this path — is counted like the unreadable `patchMetadata` calls rather
 *  than guessed at. A computed key (`{ [key]: value }`) is a readable literal that names nothing,
 *  the same way it is for the walk above. */
const metadataRoutePatchCall = new RegExp(
  `\\.\\s*patch\\s*(?:<[^<>]*>)?\\s*\\(\\s*${CHAT_METADATA_ROUTE_MARKER}\\s*,`,
  "g",
);
function metadataRouteWriteKeys(source: string): { keys: string[]; unreadableCalls: number } {
  const keys: string[] = [];
  let unreadableCalls = 0;
  for (const call of source.matchAll(metadataRoutePatchCall)) {
    const start = (call.index ?? 0) + call[0].length;
    const literal = /^\s*\{/.exec(source.slice(start, start + 40));
    if (!literal) {
      unreadableCalls += 1;
      continue;
    }
    keys.push(...objectLiteralKeys(source, start + literal[0].length - 1));
  }
  return { keys, unreadableCalls };
}

/** Chat-metadata writes that never touch `patchMetadata` at all. The client PATCHes
 *  `/chats/:id/metadata` through `useUpdateChatMetadata()`, whose input is `{ id, ...metadata }`,
 *  and the chat-settings sections write through an `onMetadataChange` prop that forwards into it.
 *  `id` names the chat rather than a metadata key, so it is dropped. The drawer parks the mutation
 *  in aliases (`const save = updateMeta.mutateAsync`, `ref.current = …`) and calls it through them,
 *  so aliases are followed as far as a file chains them. */
function chatMetadataMutationKeys(source: string): string[] {
  const callables = new Set<string>();
  for (const hook of source.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*useUpdateChatMetadata\s*\(\s*\)/g)) {
    callables.add(`${hook[1]!}.mutate`);
    callables.add(`${hook[1]!}.mutateAsync`);
  }
  for (let pass = 0; pass < 4; pass += 1) {
    const before = callables.size;
    for (const alias of source.matchAll(
      /\b(?:(?:const|let)\s+)?([A-Za-z_$][\w$]*(?:\.current)?)\s*=\s*([A-Za-z_$][\w$]*\.mutate(?:Async)?)\s*[;,)]/g,
    )) {
      if (callables.has(alias[2]!)) callables.add(alias[1]!);
    }
    if (callables.size === before) break;
  }
  const keys: string[] = [];
  for (const callable of ["onMetadataChange", ...callables]) {
    for (const call of source.matchAll(new RegExp(`\\b${escapedForPattern(callable)}\\s*\\(`, "g"))) {
      const open = (call.index ?? 0) + call[0].length - 1;
      const literal = /^\s*\{/.exec(source.slice(open + 1, open + 40));
      if (!literal) continue;
      for (const key of objectLiteralKeys(source, open + literal[0].length)) if (key !== "id") keys.push(key);
    }
  }
  return keys;
}

/** Property reads off a `parseChatMetadata(…)` result — the Engine's dominant read idiom, and the
 *  only source that sees `scenario` at all. Both shapes count: the direct
 *  `parseChatMetadata(chat.metadata).key`, and the far more common local binding
 *  (`const meta = parseChatMetadata(chat.metadata)`) read later as `meta.key`. Bindings are matched
 *  by name file-wide rather than by scope, so a helper taking the parsed metadata as a parameter of
 *  the same name is swept too — which is how `gallery.routes.ts` reaches `scenario`. */
function parseChatMetadataReadKeys(source: string): string[] {
  const keys: string[] = [];
  const bound = new Set<string>();
  for (const call of source.matchAll(/\bparseChatMetadata\s*\(/g)) {
    const open = (call.index ?? 0) + call[0].length - 1;
    const end = closingBracket(source, open);
    if (end === -1) continue;
    const direct = /^\s*\??\.\s*([a-z][a-zA-Z0-9]*)/.exec(source.slice(end + 1, end + 60));
    // A direct property read binds nothing: `const value = parseChatMetadata(…).gameSessionNumber`
    // names a value, and sweeping `value.*` afterwards would collect keys off unrelated objects.
    if (direct) {
      keys.push(direct[1]!);
      continue;
    }
    // Anchored to the end of a bounded look-back, so only a binding immediately left of the call
    // counts; widening the window can add bindings but never invent one.
    const binding = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]*)?=\s*$/.exec(
      source.slice(Math.max(0, (call.index ?? 0) - 200), call.index ?? 0),
    );
    if (binding) bound.add(binding[1]!);
  }
  for (const name of bound) {
    for (const read of source.matchAll(new RegExp(`\\b${escapedForPattern(name)}\\s*\\??\\.\\s*([a-z][a-zA-Z0-9]*)`, "g"))) {
      keys.push(read[1]!);
    }
  }
  return keys;
}

// Source 3 — the keys that live in `ChatMetadata`'s `[key: string]: unknown` index signature
// rather than in its declaration. Much of the Engine's own chat metadata is written and read that
// way with no declaration anywhere (`encounterActive`, `internalAssistant`, `professorMariActive`,
// `imageGenConnectionId`, `authorNotes`), and the two sources above are structurally blind to all
// of it — a pin derived from them alone passes while the guard is incomplete, which is exactly the
// failure this file exists to prevent. A package that squatted one of those namespaces could have
// a state verb overwrite the Engine's own key from model output.
//
// It takes seven sub-sources, because none of them sees the vocabulary alone: the two
// `patchMetadata` argument shapes, the client's own metadata mutation, the client's direct PATCHes
// to the metadata route, the two read idioms, and one list the Engine already maintains by hand.
let unreadableWriteCalls = 0;
const unreadableWriteSites: string[] = [];
for (const file of [...serverSourceFiles, ...sharedSourceFiles, ...clientSourceFiles]) {
  const source = withoutCommentsOrStrings(file.source, file.path);
  const written = metadataWriteKeys(source);
  const routed = metadataRouteWriteKeys(source);
  for (const key of [...written.keys, ...routed.keys]) engineMetadataKeys.add(key);
  // Both write shapes feed one count: a key committed through either and readable through neither
  // is the same blind spot, and pooling them is what makes dropping the route arm red the pin below
  // rather than quietly narrowing the derivation.
  const unreadable = written.unreadableCalls + routed.unreadableCalls;
  if (unreadable > 0) {
    unreadableWriteCalls += unreadable;
    unreadableWriteSites.push(`${file.path.slice(repositoryRoot.length).replace(/\\/g, "/")} x${unreadable}`);
  }
  for (const key of chatMetadataMutationKeys(source)) engineMetadataKeys.add(key);
  for (const key of parseChatMetadataReadKeys(source)) engineMetadataKeys.add(key);
  for (const pattern of [
    /\bchatMeta(?:data)?\??\.\s*([a-z][a-zA-Z0-9]*)/g,
    /\bchat\??\.metadata\??\.\s*([a-z][a-zA-Z0-9]*)/g,
  ]) {
    for (const match of source.matchAll(pattern)) engineMetadataKeys.add(match[1]!);
  }
}
// Sub-source 7 — the keys the Engine already knows belong to a chat rather than to a reusable
// settings profile. This one is a hand-maintained list rather than a sweep, and that is exactly why
// it reaches what the six above cannot: `spatialContext` is written into chat metadata by the
// hierarchical-maps package's own client — code that lives in the Agents repository, not this one —
// through the same metadata PATCH route the arm above sweeps, so no write site in this repository
// names it in any shape, and the Engine reads it back off a `patchMetadata` updater's `current`
// parameter handed to `hasUsableHierarchicalWorldMap()` (world-map-mode.ts) and off a file-local
// `parseMetadata()` in the legacy capability chat migration. Both reads are interprocedural, so no
// widening of the read arms above would have found it either.
for (const key of CHAT_PRESET_EXCLUDED_METADATA_KEYS) engineMetadataKeys.add(key);

// One canary per sub-source THAT HAS ONE — a key no OTHER source in the union supplies, so dropping
// that source reds this file instead of quietly narrowing the pin: `mariPermissionsMode` is only
// ever a written patch literal, `customMusicFolder` only a client mutation payload, `scenario` only
// a `parseChatMetadata` local read, `crossChatAwareness` only a `chatMeta.*` property read, and
// `spatialContext` only the excluded-key list. Two sub-sources have no such key and get no canary:
// see the updater-callback and route arms below.
assert.ok(engineMetadataKeys.has("mariPermissionsMode"), "the patchMetadata literal walk is part of the sweep");
assert.ok(engineMetadataKeys.has("customMusicFolder"), "the client metadata-mutation sweep is part of the sweep");
assert.ok(engineMetadataKeys.has("scenario"), "the parseChatMetadata read sweep is part of the sweep");
assert.ok(engineMetadataKeys.has("crossChatAwareness"), "the chat-metadata property-read sweep is part of the sweep");
assert.ok(engineMetadataKeys.has("spatialContext"), "the chat-preset excluded-key list is part of the sweep");
// `encounterActive` is not a source canary but a reality check: it is the key whose namespace a
// package called `encounter` would otherwise have been free to claim.
assert.ok(engineMetadataKeys.has("encounterActive"), "the undeclared combat flag is part of the sweep");
// The updater-callback arm is the one sub-source with no key of its own — everything it recovers
// (`archivedCharacterSnapshots`, `gameJournal`, `daySummaries`, `weekSummaries`, …) is also read
// somewhere a read sweep sees, so dropping the arm would leave this file green today. It is pinned
// on its own behavior instead, on a synthetic source carrying every shape the walk classifies: a
// bare patch object, a concise-body updater, a block-body updater whose NESTED callback return must
// not be collected, an argument the walk cannot read, and a declaration that is not a call at all.
assert.deepEqual(
  metadataWriteKeys(
    [
      "patchMetadata(id, { direct: 1 });",
      "patchMetadata(id, (current) => ({ ...current, concise: 2 }));",
      "updateMetadata(id, (fresh) => {",
      "  const rows = list.map((row) => { return { nested: 4 }; });",
      "  if (x) return { early: 3 };",
      "  return { late: 5, rows };",
      "});",
      "patchMetadata(id, prebuiltPatch);",
      "async patchMetadata(id: string, patch: MetadataPatch) { return null; }",
    ].join("\n"),
  ),
  { keys: ["direct", "concise", "early", "late"], unreadableCalls: 1 },
);
// The route arm is the second sub-source with no key of its own: all twelve keys its literals commit
// (`gameCombatState`, `gameNarrationIndex`, `gameSceneMusic`, `impersonatePrompt`, …) are also read
// through `chatMeta.*`, so a canary here would be vacuous the day it was written — the mistake this
// file already made once with `element_attack`. What makes the arm load-bearing is the count: its
// two variable-argument calls are pooled into the pinned total above, so the arm cannot be dropped
// without taking two off it. Its walk is pinned on its own behavior as well, on a synthetic source
// carrying every shape it classifies: a bare patch object, a call with a type argument, a computed
// key that names nothing, an argument that is not a literal, and a PATCH to a different route. The
// source is run through the real stripper, so the route marker is pinned here too.
assert.deepEqual(
  metadataRouteWriteKeys(
    withoutCommentsOrStrings(
      [
        "api.patch(`/chats/${id}/metadata`, { direct: 1 });",
        "api.patch<Chat>(`/chats/${id}/metadata`, { typed: 2 });",
        "api.patch(`/chats/${id}/metadata`, { [computed]: 3 });",
        "api.patch(`/chats/${id}/metadata`, prebuiltPatch);",
        "api.patch(`/chats/${id}/messages`, { notMetadata: 4 });",
      ].join("\n"),
    ),
  ),
  { keys: ["direct", "typed"], unreadableCalls: 1 },
);
// The mutation sweep's own behavior: through the hook binding, through an alias of it, and through
// the settings prop — with the chat id dropped, since it is the route parameter and not a key.
assert.deepEqual(
  chatMetadataMutationKeys(
    [
      "const updateMeta = useUpdateChatMetadata();",
      "const save = updateMeta.mutateAsync;",
      "updateMeta.mutate({ id: chatId, viaHook: 1 });",
      "save({ id: chatId, viaAlias: 2 });",
      "onMetadataChange({ viaProp: 3 });",
    ].join("\n"),
  ).sort(),
  ["viaAlias", "viaHook", "viaProp"],
);
// The read sweep's own behavior: a local binding read later, and a direct read off the call.
assert.deepEqual(
  parseChatMetadataReadKeys(
    [
      "const meta = parseChatMetadata(chat.metadata);",
      "if (meta.viaLocal) use(parseChatMetadata(other.metadata).viaDirect);",
    ].join("\n"),
  ).sort(),
  ["viaDirect", "viaLocal"],
);
// The honest boundary of the whole derivation, and the half of it that a count can express: a write
// handed a variable or a helper's return value, in either write shape. Its keys cannot be read from
// here at all, so the COUNT is pinned — a twenty-first fails this regression until someone reads it
// by hand and either widens a walk above or adds the namespace to
// ENGINE_OWNED_METADATA_KEY_PREFIXES. Eighteen are `patchMetadata`/`updateMetadata` calls; the other
// two are route PATCHes, and neither is a live gap today — one is the mutation hook's own
// implementation, whose keys the client-mutation arm reads at its call sites instead, and the other
// is a debounced scene patch assembled into a variable whose four keys the literal beside it repeats
// verbatim. The other half of the boundary — a read off a parameter inside a helper — has no count
// to pin, which is why sub-source 7 exists rather than a seventh sweep. The docs state both limits.
assert.equal(
  unreadableWriteCalls,
  20,
  `chat-metadata writes this sweep cannot read statically changed: expected 20, found ${unreadableWriteCalls}. ` +
    "This count is a boundary marker, not a budget, so do not simply edit the number to match. Read the " +
    "call this added by hand — the sites are listed below — and decide what it writes: if it commits a key " +
    "under a namespace that is not already in ENGINE_OWNED_METADATA_KEY_PREFIXES, add that namespace (or " +
    "widen the walk that should have read the call), because until then a package can squat it. If the " +
    "call is genuinely unreadable and squats nothing, bump this number deliberately and say in the commit " +
    `which call it accounts for. Sites: ${unreadableWriteSites.join(", ")}`,
);

const ownedPrefixes = new Set<string>(ENGINE_OWNED_METADATA_KEY_PREFIXES);
const unpinnedPrefixes = [...new Set([...engineMetadataKeys].map((key) => /^[a-z]+/.exec(key)?.[0] ?? key))]
  .filter((prefix) => !ownedPrefixes.has(prefix))
  .sort();
assert.deepEqual(
  unpinnedPrefixes,
  [],
  `new engine metadata namespaces are not in ENGINE_OWNED_METADATA_KEY_PREFIXES: ${unpinnedPrefixes.join(", ")}`,
);
// The floor the decision named explicitly. `persona` is the only one of them the sweeps above
// cannot produce on their own, so it is the one entry that is genuinely hand-maintained.
for (const floor of ["game", "conversation", "chat", "lorebook", "character", "persona", "macro", "summary"]) {
  assert.ok(ownedPrefixes.has(floor), `"${floor}" must stay in the engine-owned denylist`);
}

// ── Key ownership (decision D1) ──────────────────────────────────────────────

assert.equal(camelCaseCapabilityPackageId("pixelforge"), "pixelforge");
assert.equal(camelCaseCapabilityPackageId("hierarchical-maps"), "hierarchicalMaps");
assert.equal(camelCaseCapabilityPackageId("rock-paper-scissors"), "rockPaperScissors");

assert.equal(gmVerbMetadataKeyIssue("pixelforge", "pixelforgeWeather"), null);
assert.match(gmVerbMetadataKeyIssue("pixelforge", "weather") ?? "", /must start with "pixelforge"/);
assert.match(gmVerbMetadataKeyIssue("pixelforge", "pixelforge") ?? "", /must add a name/);
// The uppercase boundary is what stops one package prefixing another's namespace: without it
// `pixelforge` could mint `pixelforgery…` and squat a `pixelforgery` package's keys.
assert.match(gmVerbMetadataKeyIssue("pixelforge", "pixelforgeweather") ?? "", /uppercase letter/);
assert.match(gmVerbMetadataKeyIssue("pixelforge", "pixelforge_weather") ?? "", /uppercase letter/);
// Denylist, exact match.
assert.match(gmVerbMetadataKeyIssue("game", "gameThing") ?? "", /engine-owned metadata namespace "game"/);
// Denylist, extension at an uppercase boundary. This one is live, not hypothetical: the shipped
// conversation-calls package normalizes to `conversationCalls`, and `conversationCalls` + `Enabled`
// is an existing ChatMetadata key.
assert.ok(engineMetadataKeys.has("conversationCallsEnabled"), "the collision this rule exists for is real");
assert.match(
  gmVerbMetadataKeyIssue("conversation-calls", "conversationCallsEnabled") ?? "",
  /engine-owned metadata namespace "conversationCalls"/,
);
// Denylist, exact match on a namespace only the index-signature sweep can find: the shipped
// `background` package normalizes to `background`, which is an Engine chat-metadata key itself.
assert.ok(engineMetadataKeys.has("background"), "the undeclared key behind the `background` refusal is real");
assert.match(
  gmVerbMetadataKeyIssue("background", "backgroundSky") ?? "",
  /engine-owned metadata namespace "background"/,
);
// A lowercase continuation is NOT an extension: `gamepad` cannot collide with `game` + uppercase.
assert.equal(gmVerbMetadataKeyIssue("gamepad", "gamepadThing"), null);

// ── Constants ────────────────────────────────────────────────────────────────

assert.equal(GM_VERB_TABLE_ASSET_PATH, "gm-verbs.json");
assert.equal(GM_VERB_TABLE_MAX_BYTES, 64 * 1024);

// ── The two proving verbs ────────────────────────────────────────────────────

const weatherVerb = {
  name: "weather",
  description: "Set the sky when the weather visibly changes.",
  effect: "state",
  metadataKey: "pixelforgeWeather",
  args: [
    { name: "word", type: "string", enum: ["fair", "overcast", "rain", "storm", "snow"] },
    { name: "intensity", type: "string", enum: ["light", "heavy"], optional: true },
  ],
};
const standingVerb = {
  name: "standing",
  description: "Set where an NPC stands with the player after something changed it.",
  effect: "event",
  args: [
    { name: "npc", type: "string", maxLength: 40 },
    { name: "stance", type: "string", enum: ["none", "known", "friend", "close", "hostile"] },
    { name: "line", type: "string", maxLength: 80, optional: true },
  ],
};
const pixelforgeTable = { schemaVersion: 1, verbs: [weatherVerb, standingVerb] };

const pixelforgeSchema = createGmVerbTableSchema("pixelforge");
const proven = pixelforgeSchema.parse(pixelforgeTable);
assert.equal(proven.verbs.length, 2);
assert.equal(proven.verbs[0]?.effect, "state");
assert.equal(proven.verbs[0]?.metadataKey, "pixelforgeWeather");
assert.equal(proven.verbs[1]?.effect, "event");
assert.equal(proven.verbs[1]?.metadataKey, undefined);
// `optional` defaults rather than being required of every argument.
assert.equal(proven.verbs[0]?.args[0]?.optional, false);
assert.equal(proven.verbs[0]?.args[1]?.optional, true);
// The same table declared by a different package is refused: the key is not that package's to write.
assert.equal(createGmVerbTableSchema("chess").safeParse(pixelforgeTable).success, false);
// Without an owning package the shape still parses — key ownership is the package-aware layer.
assert.equal(gmVerbTableSchema.safeParse(pixelforgeTable).success, true);

// ── Shape guards ─────────────────────────────────────────────────────────────

function refusesVerb(verb: unknown, why: string): void {
  assert.equal(pixelforgeSchema.safeParse({ schemaVersion: 1, verbs: [verb] }).success, false, why);
}

refusesVerb({ ...weatherVerb, name: "reputation" }, "a reserved built-in tag name is refused");
refusesVerb({ ...weatherVerb, name: "note" }, "a reserved name is refused case-folded");
// The dialogue tokens are reserved like any other built-in: a `whisper` verb would have
// `[whisper:Tam]` stripped out of a saved dialogue line, which then stops parsing as dialogue.
refusesVerb({ ...weatherVerb, name: "whisper" }, "a dialogue-format token is refused");
refusesVerb({ ...weatherVerb, name: "Weather" }, "an uppercase verb name is refused");
refusesVerb({ ...weatherVerb, name: "party-turn" }, "a hyphenated verb name is refused");
refusesVerb({ ...weatherVerb, description: "Line one.\nLine two." }, "a prompt line cannot break");
refusesVerb({ ...weatherVerb, description: "Emit [weather: …] here." }, "a prompt line cannot carry brackets");
refusesVerb({ ...weatherVerb, description: "" }, "a verb must describe itself");
// CR and LF are not the whole break vocabulary, and a control character reshapes the rendered line
// without ending it — a tab walks the next verb out of the column the COMMANDS block is read in.
refusesVerb(
  { ...weatherVerb, description: "Line one.\u2028Line two." },
  "a Unicode line separator breaks the prompt line too",
);
refusesVerb(
  { ...weatherVerb, description: "Set the sky.\tThen stop." },
  "a tab is refused as a control character",
);
refusesVerb({ ...weatherVerb, metadataKey: undefined }, "a state verb must name its metadata key");
refusesVerb({ ...standingVerb, metadataKey: "pixelforgeStanding" }, "an event verb must not squat a key");
refusesVerb({ ...weatherVerb, effect: "broadcast" }, "an unknown effect is refused");
refusesVerb({ ...weatherVerb, repeatable: true }, "an unknown verb key is refused");
refusesVerb(
  { ...weatherVerb, args: [{ name: "note", type: "string" }] },
  "an un-enum'd string argument must declare maxLength",
);
refusesVerb(
  { ...weatherVerb, args: [{ name: "turns", type: "number", maxLength: 10 }] },
  "maxLength is meaningless on a number argument",
);
refusesVerb(
  { ...weatherVerb, args: [{ name: "word", type: "number", enum: ["1"] }] },
  "only a string argument can declare an enum",
);
refusesVerb(
  { ...weatherVerb, args: [{ name: "word", type: "string", enum: ["fair"], maxLength: 10 }] },
  "an enum already bounds the value",
);
refusesVerb(
  { ...weatherVerb, args: [{ name: "word", type: "string", enum: ["fair", "fair"] }] },
  "a value set cannot repeat a value",
);
refusesVerb(
  {
    ...weatherVerb,
    args: [
      { name: "word", type: "string", maxLength: 10 },
      { name: "word", type: "string", maxLength: 10 },
    ],
  },
  "two arguments cannot share a name",
);
refusesVerb(
  {
    ...weatherVerb,
    args: Array.from({ length: 7 }, (_unused, index) => ({ name: `a${index}`, type: "string", maxLength: 8 })),
  },
  "at most six arguments",
);
refusesVerb({ ...weatherVerb, args: [{ name: "sky", type: "string", maxLength: 501 }] }, "maxLength is capped at 500");

assert.equal(pixelforgeSchema.safeParse({ schemaVersion: 2, verbs: [weatherVerb] }).success, false);
assert.equal(pixelforgeSchema.safeParse({ schemaVersion: 1, verbs: [] }).success, false);
// Every verb in the over-cap table needs its own name AND its own metadataKey: seventeen copies of
// one key are refused by the duplicate-key rule whatever the cap is, which would pass the assertion
// for a reason it does not intend and leave the cap itself unpinned. The sixteen-verb table proves
// the refusal below is the cap and nothing else.
const sixteenVerbs = Array.from({ length: 16 }, (_unused, index) => ({
  ...weatherVerb,
  name: `verb${index}`,
  metadataKey: `pixelforgeKey${index}`,
}));
const seventeenVerbs = [...sixteenVerbs, { ...weatherVerb, name: "verb16", metadataKey: "pixelforgeKey16" }];
assert.equal(
  pixelforgeSchema.safeParse({ schemaVersion: 1, verbs: sixteenVerbs }).success,
  true,
  "sixteen verbs are allowed",
);
assert.equal(
  pixelforgeSchema.safeParse({ schemaVersion: 1, verbs: seventeenVerbs }).success,
  false,
  "at most sixteen verbs",
);
// All three copies of the cap carry it: the package-aware schema, the package-blind document
// schema, and the envelope the tolerant parse checks before it looks at a single verb.
assert.equal(gmVerbTableSchema.safeParse({ schemaVersion: 1, verbs: seventeenVerbs }).success, false);
assert.throws(() => parseGmVerbTableWithCompat({ schemaVersion: 1, verbs: seventeenVerbs }, "pixelforge"));
assert.equal(
  pixelforgeSchema.safeParse({ schemaVersion: 1, verbs: [weatherVerb, { ...weatherVerb, metadataKey: "pixelforgeB" }] })
    .success,
  false,
  "two verbs cannot share a name",
);
assert.equal(
  pixelforgeSchema.safeParse({
    schemaVersion: 1,
    verbs: [weatherVerb, { ...weatherVerb, name: "sky" }],
  }).success,
  false,
  "two verbs cannot write the same metadata key",
);
assert.equal(
  pixelforgeSchema.safeParse({ schemaVersion: 1, verbs: [weatherVerb], extra: true }).success,
  false,
  "an unknown top-level key is refused by the strict schema",
);

// ── Per-verb degradation ─────────────────────────────────────────────────────

// One verb this Engine cannot represent must not cost the package its whole vocabulary — the same
// per-entry rule the capability catalog already uses.
const degraded = parseGmVerbTableWithCompat(
  { schemaVersion: 1, verbs: [weatherVerb, { name: "teleport", effect: "quantum" }, standingVerb] },
  "pixelforge",
);
assert.deepEqual(
  degraded.table.verbs.map((verb) => verb.name),
  ["weather", "standing"],
);
assert.equal(degraded.droppedEntries, 1);
assert.deepEqual(degraded.droppedNames, ["teleport"]);

// A later duplicate is dropped rather than failing the table on this path.
const duplicated = parseGmVerbTableWithCompat(
  { schemaVersion: 1, verbs: [weatherVerb, { ...weatherVerb, description: "A second sky." }] },
  "pixelforge",
);
assert.equal(duplicated.table.verbs.length, 1);
assert.equal(duplicated.droppedEntries, 1);

// A verb whose key belongs to someone else is dropped, not silently written under — and when it is
// the only verb, the parse returns an EMPTY table. That is why the result is typed
// `ParsedGmVerbTable` rather than `GmVerbTable`: the schema's one-verb minimum does not survive a
// path whose whole job is dropping entries, and a caller must check the length.
const foreign = parseGmVerbTableWithCompat({ schemaVersion: 1, verbs: [weatherVerb] }, "chess");
assert.equal(foreign.table.verbs.length, 0);
assert.deepEqual(foreign.droppedNames, ["weather"]);

// An unusable envelope throws instead of degrading, so the caller logs it and serves an empty table.
assert.throws(() => parseGmVerbTableWithCompat({ schemaVersion: 2, verbs: [] }, "pixelforge"));
assert.throws(() => parseGmVerbTableWithCompat("not a table", "pixelforge"));
assert.throws(() => parseGmVerbTableWithCompat({ schemaVersion: 1 }, "pixelforge"));
// Unknown TOP-LEVEL fields are stripped rather than refused, so a table written for a newer Engine
// still yields the verbs this one understands.
assert.equal(
  parseGmVerbTableWithCompat({ schemaVersion: 1, verbs: [weatherVerb], future: 1 }, "pixelforge").table.verbs.length,
  1,
);

// ── Who consumes the declaration ─────────────────────────────────────────────

// The schema shipped inert; the runtime landed behind it. The list is pinned rather than dropped,
// because it is what keeps the declaration contract from acquiring a READER quietly: every reader has
// to honor the same reserved-name and key-ownership guards, so a new name here is a new place those
// guards can be forgotten. Exactly one entry below is not a reader — the shared barrel, which
// re-exports the module and enforces nothing. It is listed because the sweep matches on the FILE NAME
// rather than on an import statement, deliberately, so that a file merely naming the schema in a
// comment is caught alongside one that imports it. Either way the addition is worth a reviewer's eye.
const importers = [...serverSourceFiles, ...sharedSourceFiles, ...clientSourceFiles]
  .filter((file) => !file.path.endsWith("gm-verb-table.schema.ts") && file.source.includes("gm-verb-table"))
  .map((file) => file.path.slice(repositoryRoot.length).replace(/\\/g, "/"))
  .sort();
assert.deepEqual(
  importers,
  [
    // Names the file in its header; consumes the symbols through @marinara-engine/shared.
    "packages/server/src/services/capability-packages/capability-gm-verb-runtime.service.ts",
    // The barrel re-export — the only file that reaches the schema by path.
    "packages/shared/src/index.ts",
  ].sort(),
  "the GM verb declaration contract has exactly these consumers",
);

console.info("Capability GM verb declaration regressions passed.");

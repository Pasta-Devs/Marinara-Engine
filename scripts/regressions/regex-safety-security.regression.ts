import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isPatternSafe } from "../../packages/shared/src/utils/regex-safety.js";

const malformedSource = String.raw`[^]a)|(?:(?:a?|b?){30}|]*x`;
const mode = process.argv[2];

if (mode === "--no-compilation") {
  const NativeRegExp = globalThis.RegExp;
  let compilationAttempts = 0;
  const rejectCompilation = () => {
    compilationAttempts += 1;
    throw new Error("The safety checker must inspect regex source without compiling it");
  };
  globalThis.RegExp = new Proxy(NativeRegExp, {
    apply: rejectCompilation,
    construct: rejectCompilation,
  });
  try {
    for (const source of [String.raw`[^|]+\|[^|]+\|[^|]+`, malformedSource]) {
      isPatternSafe(source);
    }
  } finally {
    globalThis.RegExp = NativeRegExp;
  }
  assert.equal(compilationAttempts, 0, "safety analysis must never compile attacker-controlled substrings");
} else if (mode === "--semantics") {
  for (const source of [
    "(?:a|[ab])+$",
    "(?:[ab]|a)+$",
    "(?:a|[a-c])+$",
    "(?:A|[^a])+$",
    "(?:a|[^a&&b])+$",
    "(?:a|A)+$",
    "(?:[ab]|[bc])+$",
    String.raw`(?:a|\x61)+$`,
    "(?:a?b|ba)+$",
    "(?:a?bc|bc)+$",
    "(?:a??bc|bc)+$",
    "(?:a?b?c|c)+$",
    "(?:[ab]?x|x)+$",
    "(?:[ab]??x|x)+$",
    "(?:d?ef|def)+$",
    String.raw`(?:\d|[0-9])+$`,
    String.raw`(?:\w|a)+$`,
    String.raw`(?:[\uD800\uDC00]|\uD800)+$`,
    String.raw`(?:[\uDBFF-\uDC00]|\uDBFF)+$`,
    "(?:a|.)+$",
    "(?:a|ab)*c",
    "[^|]+x[^|]+y[^|]+",
  ]) {
    assert.equal(isPatternSafe(source), false, `${source} must be rejected before execution`);
  }
  for (const source of [
    "(?:a|b)+$",
    "(?:[ab]|[cd])+$",
    "(?:ab|cd)+$",
    "(?:a|bc)+$",
    "(?:foo|bar😀)+$",
    "(?:bar😀|foo)+$",
    String.raw`(?:foo|bar\uD83D\uDE00)+$`,
    String.raw`(?:foo|bar\u{D83D}\u{DE00})+$`,
    String.raw`(?:foo|bar\u{1F600})+$`,
    String.raw`(?:foo|bar\b😀)+$`,
    "(?:[ab]x|y😀)+$",
    "(?:ab😀|ac😀)+$",
    "(?:x😀ab|y[😀]ab)+$",
    "(?:xa?😀|yb😀)+$",
    "(?:a?bc|def)+$",
    "(?:def|a?bc)+$",
    "(?:[ab]?x|yz)+$",
    "(?:a??bc|def)+$",
    "(?:[ab]??x|yz)+$",
    "(?:a?b?c|def)+$",
    "(?:a?ab|z)+$",
    "(?:a?bc😀|def)+$",
    "(?:a?b?c|bd)+$",
    "(?:a??b??c|bd)+$",
    "(?:cat|dog)+$",
    String.raw`(?:\d|\s)+$`,
    "(?:a|[^a])+$",
    String.raw`(?:\d|\D)+$`,
    '(?:[^"]|"")*',
    "[]",
    "[]+",
    "[^]+",
    String.raw`([^|]+)\|([^|]+)\|([^|]+)`,
    String.raw`([^\\|]+)\|([^\\|]+)\|([^\\|]+)`,
    "[^,]+,[^,]+,[^,]+",
    String.raw`[^^]+\^[^^]+\^[^^]+`,
    String.raw`(?:\^|[^^])+$`,
  ]) {
    assert.equal(isPatternSafe(source), true, `${source} must remain usable`);
  }
} else if (mode === "--unicode-atoms") {
  // In Unicode mode, these differently spelled alternatives consume the same
  // code point. Check tiny matches only; never run the repeated unsafe source.
  assert.ok(/^😀a$/u.test("😀a") && /^[😀😁]a$/u.test("😀a"));
  assert.ok(/^\uD800\uDC00a$/u.test("\uD800\uDC00a") && /^[\uD800\uDC00]a$/u.test("\uD800\uDC00a"));
  assert.ok(/^\u{D800}a$/u.test("\uD800a") && /^[\u{D800}]a$/u.test("\uD800a"));
  for (const source of [
    "(?:😀a|[😀😁]a)+$",
    "(?:[😀😁]a|😀a)+$",
    "(?:😀ab|[😀]ab)+$",
    "(?:[😀]ab|😀ab)+$",
    "(?:x😀ab|x[😀]ab)+$",
    "(?:x😀ab|X[😀]ab)+$",
    "(?:a|😀)+$",
    String.raw`(?:\bxa😀|[x]a😀)+$`,
    String.raw`(?:\u{1F600}a|[u]\{1F600\}a)+$`,
    "(?:a?b😀|b😀)+$",
    String.raw`(?:\uD800\uDC00a|[\uD800\uDC00]a)+$`,
    String.raw`(?:[\uD800\uDC00]a|\uD800\uDC00a)+$`,
    String.raw`(?:\uD800\uDC00ab|[\uD800\uDC00]ab)+$`,
    String.raw`(?:[\uD800\uDC00]ab|\uD800\uDC00ab)+$`,
    String.raw`(?:\u{D800}\u{DC00}a|[\u{D800}\u{DC00}]a)+$`,
    String.raw`(?:\u{D800}a|[\u{D800}]a)+$`,
    String.raw`(?:\u{000D800}ab|[\u{000D800}]ab)+$`,
  ]) {
    assert.equal(isPatternSafe(source), false, `${source} must not treat a Unicode atom as disjoint code units`);
  }
} else if (mode === "--unicode-delimiters") {
  const highSurrogate = "\uD800";
  const pair = `${highSurrogate}\uDC00`;
  assert.equal(/^[^\uD800]$/u.test(pair), true, "a pair is not excluded by its lone high surrogate in Unicode mode");
  for (const source of [
    String.raw`[^\uD800]+\uD800\uDC00[^\uD800]+\uD800\uDC00[^\uD800]+$`,
    `[^${highSurrogate}]+${pair}[^${highSurrogate}]+${pair}[^${highSurrogate}]+$`,
  ]) {
    assert.equal(isPatternSafe(source), false, "surrogate code units must not prove a disjoint field delimiter");
  }
} else if (mode === "--malformed") {
  assert.equal(isPatternSafe(malformedSource), false, "a leading ] closes the JavaScript character class");
} else {
  // Keep both malformed-source analysis and checker regressions bounded even if
  // an earlier implementation compiles and executes an attacker substring.
  const failures: string[] = [];
  for (const childMode of [
    "--no-compilation",
    "--semantics",
    "--unicode-atoms",
    "--unicode-delimiters",
    "--malformed",
  ]) {
    const child = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), childMode], {
      encoding: "utf8",
      timeout: 5_000,
    });
    if (child.status !== 0) {
      failures.push(
        `${childMode}: ${child.error?.message ?? child.signal ?? child.status}\n${child.stdout}${child.stderr}`,
      );
    }
  }
  assert.deepEqual(failures, [], "regex safety checks must finish without executing attacker patterns");
  console.info("Regex safety security regressions passed.");
}

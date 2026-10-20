import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = process.argv[2] ? resolve(process.argv[2]) : join(repositoryRoot, "packages/client/src");

// Mari's scope: destructive/error action controls, while assigned section, portrait and chat palettes stay intact.
function hueIsRed(hue) {
  const degrees = ((hue % 360) + 360) % 360;
  return degrees <= 30 || degrees >= 330;
}

function rgbIsRed(components) {
  const [red, green, blue] = components;
  const maximum = Math.max(...components);
  const minimum = Math.min(...components);
  const delta = maximum - minimum;
  if (!delta) return false;
  const hue =
    maximum === red
      ? 60 * ((green - blue) / delta)
      : maximum === green
        ? 60 * ((blue - red) / delta + 2)
        : 60 * ((red - green) / delta + 4);
  return hueIsRed(hue);
}

function fixedRedMatches(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " "));
  const matches = [];
  const add = (match) => matches.push({ index: match.index, color: match[0] });
  for (const match of text.matchAll(
    /\b(?:bg|text|border(?:-[xysetblr])?|ring(?:-offset)?|outline|from|via|to|fill|stroke|shadow|divide|decoration|accent|caret|placeholder)-(?:red|rose|pink|amber)(?:-\d{2,3})?\b/gu,
  ))
    add(match);
  for (const match of text.matchAll(/--color-(?:red|rose|pink|amber)-\d{2,3}\b/gu)) add(match);
  for (const match of text.matchAll(/#[\da-f]{3,8}\b/giu)) {
    const hex = match[0].slice(1);
    if (![3, 4, 6, 8].includes(hex.length)) continue;
    const rgb =
      hex.length <= 4
        ? [...hex.slice(0, 3)].map((part) => parseInt(part + part, 16))
        : [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
    if (rgbIsRed(rgb)) add(match);
  }
  for (const match of text.matchAll(/\b(rgb|rgba|hsl|hsla|oklch|lch)\(([^()]*)\)/giu)) {
    const values = match[2]
      .replaceAll("_", " ")
      .trim()
      .split(/[\s,\/]+/u);
    if (values.length < 3 || values.slice(0, 3).some((value) => !/^[+-]?[\d.]+(?:%|deg|grad|rad|turn)?$/u.test(value)))
      continue;
    const kind = match[1].toLowerCase();
    const numbers = values
      .slice(0, 3)
      .map((value) => (kind.startsWith("rgb") && value.endsWith("%") ? parseFloat(value) * 2.55 : parseFloat(value)));
    const hueIndex = kind.startsWith("hsl") ? 0 : 2;
    if (values[hueIndex].endsWith("turn")) numbers[hueIndex] *= 360;
    else if (values[hueIndex].endsWith("grad")) numbers[hueIndex] *= 0.9;
    else if (values[hueIndex].endsWith("rad")) numbers[hueIndex] *= 180 / Math.PI;
    const red = kind.startsWith("rgb")
      ? rgbIsRed(numbers)
      : kind.startsWith("hsl")
        ? numbers[1] > 0 && hueIsRed(numbers[0])
        : numbers[1] > 0 && hueIsRed(numbers[2]);
    if (red) add(match);
  }
  for (const match of text.matchAll(
    /(?<=[:\[\s])\s*(?:red|darkred|crimson|firebrick|indianred|lightcoral|salmon|darksalmon|maroon|pink|hotpink|deeppink|lightpink|mistyrose|coral|orangered|tomato|brown)(?=\s*(?:!important\s*)?[;}\]])/giu,
  ))
    add(match);
  return matches;
}

function inspect(path, source) {
  const findings = [];
  const collect = (text, offset) => {
    for (const match of fixedRedMatches(text)) {
      const position = offset + match.index;
      const line = source.slice(0, position).split("\n").length;
      findings.push({ path, line, color: match.color });
    }
  };
  if (path.endsWith(".css")) {
    for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
      const selectors = match[1].replace(/:not\([^)]*\)/gu, "");
      if (
        /\.mari-btn--danger\b|\.mari-card\[data-variant="danger"\]|\.mari-game-scene-control--amber\b/u.test(selectors)
      )
        collect(match[2], match.index + match[1].length + 1);
    }
    return findings;
  }
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const collectAttributes = (opening) => {
    for (const attribute of opening.attributes.properties) {
      if (!ts.isJsxAttribute(attribute) || !/^(?:className|style)$/u.test(attribute.name.getText(file))) continue;
      collect(attribute.getText(file), attribute.getStart(file));
      if (attribute.name.getText(file) !== "style") continue;
      const namedStyle = (node) => {
        if (
          ts.isPropertyAssignment(node) &&
          ts.isStringLiteralLike(node.initializer) &&
          /(?:color|background|border|outline|fill|stroke|shadow|caret|accent|surface)$/iu.test(
            ts.isStringLiteralLike(node.name) ? node.name.text : node.name.getText(file),
          )
        ) {
          for (const match of fixedRedMatches(`color:${node.initializer.text};`)) {
            if (/^\s*[a-z]+\s*$/iu.test(match.color)) collect(`color:${match.color};`, node.initializer.getStart(file));
          }
        }
        ts.forEachChild(node, namedStyle);
      };
      namedStyle(attribute);
    }
  };
  const visit = (node) => {
    if (ts.isJsxElement(node) && /^(?:button|Button)$/u.test(node.openingElement.tagName.getText(file))) {
      const semantics = node.openingElement.attributes.properties
        .filter(
          (attribute) =>
            ts.isJsxAttribute(attribute) && /^(?:onClick|title|aria-label)$/u.test(attribute.name.getText(file)),
        )
        .map((attribute) => attribute.getText(file))
        .join(" ");
      if (
        /\bTrash2?\b/u.test(node.getText(file)) ||
        /(?:delete|remove|disconnect|discard|clearSelection)/iu.test(semantics)
      ) {
        collectAttributes(node.openingElement);
        const visitGlyph = (child) => {
          if (
            (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) &&
            /^Trash2?$/u.test(child.tagName.getText(file))
          )
            collectAttributes(child);
          ts.forEachChild(child, visitGlyph);
        };
        ts.forEachChild(node, visitGlyph);
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return findings;
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:tsx|css)$/u.test(entry.name) ? [path] : [];
  });
}

assert.equal(inspect("control.tsx", '<button className="hover:text-red-400"><Trash2 /></button>').length, 1);
assert.equal(
  inspect("control.tsx", '<button onClick={deleteItem}><Trash2 className="text-red-400" /></button>').length,
  1,
);
assert.equal(
  inspect("control.tsx", '<button onClick={deleteItem}><Trash2 style={{ color: "red" }} /></button>').length,
  1,
);
assert.equal(inspect("control.tsx", '<button onClick={deleteItem} style={{ color: "red" }}>Delete</button>').length, 1);
assert.equal(
  inspect("control.tsx", '<button onClick={deleteItem} style={{ color: "#ef4444" }}>Delete</button>').length,
  1,
);
assert.equal(inspect("control.css", ".mari-btn--danger { background: rgb(255 0 0 / 50%); }").length, 1);
assert.equal(inspect("control.css", ".mari-btn--danger:not(:disabled):hover { color: red; }").length, 1);
assert.equal(inspect("control.css", ".mari-game-scene-control--amber { color: var(--color-amber-300); }").length, 1);
assert.equal(
  inspect(
    "control.css",
    ".mari-btn:not(.mari-btn--solid, .mari-btn--danger):hover, .mari-link:hover { color: #ef4444; }",
  ).length,
  0,
);
assert.equal(
  inspect("control.tsx", '<button className="text-[var(--marinara-app-accent-static)]"><Trash2 /></button>').length,
  0,
);
assert.equal(
  inspect(
    "control.tsx",
    '<button className="text-[var(--destructive)]"><Trash2 style={{ color: "var(--destructive)" }} /></button>',
  ).length,
  0,
);
assert.equal(
  inspect(
    "control.tsx",
    '<button onClick={deleteItem}><Trash2 className={chosenPalette} style={{ color: userColor }} data-preview-color="#ef4444" /></button>',
  ).length,
  0,
);
assert.equal(
  inspect("section.tsx", '<button className="text-pink-400" onClick={(e) => e.stopPropagation()}>Characters</button>')
    .length,
  0,
);
assert.equal(
  inspect("section.css", ".mari-panel-gradient--characters { --mari-panel-gradient-start: #f472b6; }").length,
  0,
);
assert.equal(inspect("content.tsx", '<span className="text-red-400">HP</span>').length, 0);
assert.equal(fixedRedMatches("hsl(350 70% 50%) oklch(0.7 0.2 20) #fef2f2").length, 3);

const files = sourceFiles(sourceRoot);
assert(files.length > 0, "The action color guard must inspect client source files");
const findings = files.flatMap((file) => inspect(relative(sourceRoot, file), readFileSync(file, "utf8")));
assert.equal(
  findings.length,
  0,
  `Destructive/error action controls must follow the theme:\n${findings.map(({ path, line, color }) => `${path}:${line} ${color}`).join("\n")}`,
);
console.log("Destructive action color guard passed; assigned content and section palettes are outside its scope.");

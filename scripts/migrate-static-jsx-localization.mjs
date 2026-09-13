import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import ts from "../packages/client/node_modules/typescript/lib/typescript.js";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const LOCALE_PATH = resolve(REPO_ROOT, "packages/client/src/localization/locales/en.json");
const VISIBLE_ATTRIBUTES = new Set([
  "alt",
  "action",
  "aria-description",
  "aria-label",
  "cancelLabel",
  "confirmLabel",
  "description",
  "emptyText",
  "help",
  "label",
  "loadingText",
  "message",
  "placeholder",
  "subtitle",
  "text",
  "title",
]);
const shouldWrite = process.argv.includes("--write");
const includeNotices = process.argv.includes("--notices");
const shouldCheck = process.argv.includes("--check");
const inputPaths = process.argv
  .slice(2)
  .filter(
    (argument) => argument !== "--write" && argument !== "--notices" && argument !== "--check",
  );

if (inputPaths.length === 0) {
  throw new Error("Pass one or more TSX files or directories to audit.");
}

function decodeJsxEntities(value) {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function normalizeVisibleText(value) {
  return decodeJsxEntities(value).replace(/\s+/gu, " ").trim();
}

function normalizeExpressionText(value) {
  const decoded = decodeJsxEntities(value);
  const leading = /^\s/u.test(decoded) ? " " : "";
  const trailing = /\s$/u.test(decoded) ? " " : "";
  return `${leading}${decoded.replace(/\s+/gu, " ").trim()}${trailing}`;
}

function lowerCamel(value) {
  const words = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^A-Za-z0-9]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  if (words.length === 0) return "text";
  const [first, ...rest] = words.slice(0, 9);
  const result = `${first.toLowerCase()}${rest.map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1).toLowerCase()}`).join("")}`;
  return /^[a-z]/u.test(result) ? result : `text${result}`;
}

function shortHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 7);
}

function functionName(node) {
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) {
    return node.name.text;
  }

  let current = node.parent;
  while (current && ts.isCallExpression(current)) current = current.parent;
  if (current && ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
    return current.name.text;
  }
  if (current && ts.isPropertyAssignment(current) && ts.isIdentifier(current.name)) {
    return current.name.text;
  }
  return null;
}

function isFunctionNode(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function nearestComponent(node) {
  let current = node.parent;
  while (current) {
    if (isFunctionNode(current)) {
      const name = functionName(current);
      if (name && /^[A-Z]/u.test(name) && current.body && ts.isBlock(current.body)) {
        return { name, node: current };
      }
    }
    current = current.parent;
  }
  return null;
}

function callName(call) {
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (!ts.isPropertyAccessExpression(call.expression)) return null;
  const owner = ts.isIdentifier(call.expression.expression) ? call.expression.expression.text : null;
  return owner ? `${owner}.${call.expression.name.text}` : call.expression.name.text;
}

function isConfirmationCopy(node) {
  const property = node.parent;
  if (!ts.isPropertyAssignment(property) || property.initializer !== node) return false;
  const propertyName =
    ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;
  if (!propertyName || !new Set(["confirmLabel", "message", "title"]).has(propertyName)) return false;

  let current = property.parent;
  while (current && !isFunctionNode(current)) {
    if (
      ts.isCallExpression(current) &&
      new Set(["setConfirmAction", "showConfirmDialog", "showPromptDialog"]).has(callName(current))
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

const NOTICE_CALLS = new Set([
  "errorMessage",
  "toast.error",
  "toast.info",
  "toast.success",
  "toast.warning",
  "window.confirm",
]);

function isInsideLiteralContentElement(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const tag = current.openingElement.tagName.getText();
      if (new Set(["code", "pre", "script", "style"]).has(tag)) return true;
    }
    if (isFunctionNode(current)) return false;
    current = current.parent;
  }
  return false;
}

async function collectFiles(inputPath) {
  const absolute = resolve(REPO_ROOT, inputPath);
  const details = await stat(absolute);
  if (details.isFile()) return absolute.endsWith(".tsx") ? [absolute] : [];

  const files = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const child = resolve(absolute, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(relative(REPO_ROOT, child))));
    else if (entry.isFile() && child.endsWith(".tsx")) files.push(child);
  }
  return files;
}

function areaForFile(filename) {
  const parts = relative(resolve(REPO_ROOT, "packages/client/src"), filename).split(sep);
  if (parts[0] === "components" || parts[0] === "features") {
    return lowerCamel(parts[1] ?? parts[0]);
  }
  return lowerCamel(parts[0] ?? "ui");
}

const englishLocale = JSON.parse(await readFile(LOCALE_PATH, "utf8"));
const keysByMessage = new Map();
for (const [key, message] of Object.entries(englishLocale)) {
  if (key === "_meta") continue;
  const keys = keysByMessage.get(message) ?? [];
  keys.push(key);
  keysByMessage.set(message, keys);
}

const plannedMessages = new Map();
const reservedKeys = new Map(Object.entries(englishLocale).filter(([key]) => key !== "_meta"));

function keyForMessage(message, area, componentName) {
  const existing = keysByMessage.get(message);
  if (existing?.length) {
    return existing.find((key) => key.startsWith(`${area}.`) || key.startsWith(`ui.${area}.`)) ?? existing[0];
  }

  const plannedId = `${area}\u0000${message}`;
  const planned = plannedMessages.get(plannedId);
  if (planned) return planned;

  const component = lowerCamel(componentName);
  const slug = lowerCamel(message);
  let key = `ui.${area}.${component}.${slug}`;
  const occupied = reservedKeys.get(key);
  if (occupied && occupied !== message) {
    key = `${key}_${shortHash(message)}`;
  }
  reservedKeys.set(key, message);
  plannedMessages.set(plannedId, key);
  return key;
}

function addReactI18nextImport(sourceFile, source, edits) {
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  const existing = imports.find(
    (statement) => ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "react-i18next",
  );

  if (existing?.importClause?.namedBindings && ts.isNamedImports(existing.importClause.namedBindings)) {
    const bindings = existing.importClause.namedBindings;
    if (
      bindings.elements.some(
        (element) =>
          element.name.text === "useUiTranslation" ||
          (element.propertyName?.text === "useTranslation" && element.name.text === "useUiTranslation"),
      )
    ) {
      return;
    }
    edits.push({
      start: bindings.elements.end,
      end: bindings.elements.end,
      text: `${bindings.elements.length ? ", " : ""}useTranslation as useUiTranslation`,
    });
    return;
  }

  const insertionPoint = imports.at(-1)?.end ?? 0;
  edits.push({
    start: insertionPoint,
    end: insertionPoint,
    text: `${insertionPoint ? "\n" : ""}import { useTranslation as useUiTranslation } from "react-i18next";`,
  });
}

const files = [...new Set((await Promise.all(inputPaths.map(collectFiles))).flat())].sort();
let migratedStrings = 0;
let skippedWithoutComponent = 0;
const skippedCandidates = [];
const changedFiles = [];

for (const filename of files) {
  const source = await readFile(filename, "utf8");
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const componentsNeedingHook = new Map();
  const area = areaForFile(filename);

  const planCandidate = (node, message, replacement) => {
    if (!message || !/[A-Za-z]/u.test(message)) return;
    const component = nearestComponent(node);
    if (!component) {
      skippedWithoutComponent += 1;
      skippedCandidates.push({
        file: relative(REPO_ROOT, filename),
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        message,
      });
      return;
    }
    const key = keyForMessage(message, area, component.name);
    edits.push(replacement(key, component));
    componentsNeedingHook.set(component.node, component.name);
    migratedStrings += 1;
  };

  const templateMessage = (node, preserveEdges = false) => {
    let message = node.head.text;
    node.templateSpans.forEach((span, index) => {
      message += `{{value${index + 1}}}${span.literal.text}`;
    });
    return preserveEdges ? normalizeExpressionText(message) : normalizeVisibleText(message);
  };

  const transformEmbeddedOutput = (root, component) => {
    const embeddedEdits = [];

    const templateCall = (node, preserveEdges = false) => {
      const message = templateMessage(node, preserveEdges);
      if (!/[A-Za-z]/u.test(message)) return source.slice(node.pos, node.end);
      const key = keyForMessage(message, area, component.name);
      const values = node.templateSpans.map(
        (span, index) =>
          `value${index + 1}: ${transformEmbeddedOutput(span.expression, component)}`,
      );
      return `localizeUi(${JSON.stringify(key)}${values.length ? `, { ${values.join(", ")} }` : ""})`;
    };

    const visitOutput = (node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const message = normalizeExpressionText(node.text);
        if (/[A-Za-z]/u.test(message)) {
          const key = keyForMessage(message, area, component.name);
          embeddedEdits.push({
            start: node.pos,
            end: node.end,
            text: `localizeUi(${JSON.stringify(key)})`,
          });
        }
        return;
      }
      if (ts.isTemplateExpression(node)) {
        embeddedEdits.push({
          start: node.pos,
          end: node.end,
          text: templateCall(node, true),
        });
        return;
      }
      if (ts.isParenthesizedExpression(node)) {
        visitOutput(node.expression);
        return;
      }
      if (ts.isConditionalExpression(node)) {
        visitOutput(node.whenTrue);
        visitOutput(node.whenFalse);
        return;
      }
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        visitOutput(node.right);
      }
    };

    visitOutput(root);
    let transformed = source.slice(root.pos, root.end);
    for (const edit of embeddedEdits.sort((left, right) => right.start - left.start)) {
      const start = edit.start - root.pos;
      const end = edit.end - root.pos;
      transformed = `${transformed.slice(0, start)}${edit.text}${transformed.slice(end)}`;
    }
    return transformed;
  };

  const templateReplacement = (node, key, component) => {
    const values = node.templateSpans.map(
      (span, index) =>
        `value${index + 1}: ${transformEmbeddedOutput(span.expression, component)}`,
    );
    return {
      start: node.pos,
      end: node.end,
      text: `localizeUi(${JSON.stringify(key)}${values.length ? `, { ${values.join(", ")} }` : ""})`,
    };
  };

  const collectDisplayExpressions = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node)
    ) {
      return [node];
    }
    if (ts.isParenthesizedExpression(node)) {
      return collectDisplayExpressions(node.expression);
    }
    if (ts.isConditionalExpression(node)) {
      return [
        ...collectDisplayExpressions(node.whenTrue),
        ...collectDisplayExpressions(node.whenFalse),
      ];
    }
    return [];
  };

  const collectNoticeExpressions = (node) => {
    const direct = collectDisplayExpressions(node);
    if (direct.length > 0) return direct;
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      return collectNoticeExpressions(node.right);
    }
    if (
      ts.isCallExpression(node) &&
      new Set(["errorMessage", "getPrivilegedActionErrorMessage"]).has(callName(node))
    ) {
      return node.arguments.slice(1).flatMap(collectNoticeExpressions);
    }
    return [];
  };

  const visit = (node) => {
    if (
      (ts.isJsxText(node) || ts.isJsxExpression(node) || ts.isJsxAttribute(node)) &&
      isInsideLiteralContentElement(node)
    ) {
      ts.forEachChild(node, visit);
      return;
    }
    if (includeNotices && ts.isCallExpression(node) && NOTICE_CALLS.has(callName(node))) {
      const expressions = node.arguments.length > 0 ? collectNoticeExpressions(node.arguments[0]) : [];
      for (const expression of expressions) {
        const message = ts.isTemplateExpression(expression)
          ? templateMessage(expression)
          : normalizeExpressionText(expression.text);
        planCandidate(expression, message, (key, component) =>
          ts.isTemplateExpression(expression)
            ? templateReplacement(expression, key, component)
            : {
                start: expression.pos,
                end: expression.end,
                text: `localizeUi(${JSON.stringify(key)})`,
              },
        );
      }
    } else if (
      includeNotices &&
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)) &&
      isConfirmationCopy(node)
    ) {
      const message = ts.isTemplateExpression(node)
        ? templateMessage(node)
        : normalizeVisibleText(node.text);
      planCandidate(node, message, (key, component) =>
        ts.isTemplateExpression(node)
          ? templateReplacement(node, key, component)
          : {
              start: node.pos,
              end: node.end,
              text: `localizeUi(${JSON.stringify(key)})`,
            },
      );
    } else if (ts.isJsxText(node)) {
      const raw = source.slice(node.pos, node.end);
      const message = normalizeVisibleText(raw);
      planCandidate(node, message, (key) => {
        const leading = raw.match(/^\s*/u)?.[0] ?? "";
        const trailing = raw.match(/\s*$/u)?.[0] ?? "";
        const preserveLeading = leading.includes("\n") ? "" : leading;
        const preserveTrailing = trailing.includes("\n") ? "" : trailing;
        return {
          start: node.pos,
          end: node.end,
          text: `${preserveLeading}{localizeUi(${JSON.stringify(key)})}${preserveTrailing}`,
        };
      });
    } else if (
      ts.isJsxAttribute(node) &&
      VISIBLE_ATTRIBUTES.has(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const message = normalizeVisibleText(node.initializer.text);
      planCandidate(node, message, (key) => ({
        start: node.initializer.pos,
        end: node.initializer.end,
        text: `{localizeUi(${JSON.stringify(key)})}`,
      }));
    } else if (ts.isJsxExpression(node) && node.expression) {
      const parentAttribute = ts.isJsxAttribute(node.parent) ? node.parent : null;
      if (parentAttribute && !VISIBLE_ATTRIBUTES.has(parentAttribute.name.text)) {
        ts.forEachChild(node, visit);
        return;
      }

      const expressions = collectDisplayExpressions(node.expression);

      for (const expression of expressions) {
        const message = ts.isTemplateExpression(expression)
          ? templateMessage(expression)
          : normalizeExpressionText(expression.text);
        planCandidate(expression, message, (key, component) =>
          ts.isTemplateExpression(expression)
            ? templateReplacement(expression, key, component)
            : {
                start: expression.pos,
                end: expression.end,
                text: `localizeUi(${JSON.stringify(key)})`,
              },
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (edits.length === 0) continue;

  for (const componentNode of componentsNeedingHook.keys()) {
    const body = componentNode.body;
    if (!body || !ts.isBlock(body)) continue;
    const bodyText = source.slice(body.pos, body.end);
    if (/\buseUiTranslation\(\)/u.test(bodyText)) continue;
    edits.push({
      start: body.getStart(sourceFile) + 1,
      end: body.getStart(sourceFile) + 1,
      text: "\n  const { t: localizeUi } = useUiTranslation();",
    });
  }

  addReactI18nextImport(sourceFile, source, edits);
  edits.sort((left, right) => right.start - left.start);
  let updated = source;
  for (const edit of edits) {
    updated = `${updated.slice(0, edit.start)}${edit.text}${updated.slice(edit.end)}`;
  }

  if (shouldWrite) await writeFile(filename, updated);
  changedFiles.push(relative(REPO_ROOT, filename));
}

for (const [plannedId, key] of plannedMessages) {
  const message = plannedId.slice(plannedId.indexOf("\u0000") + 1);
  englishLocale[key] = message;
}

if (shouldWrite && plannedMessages.size > 0) {
  const metadata = englishLocale._meta;
  const messages = Object.entries(englishLocale)
    .filter(([key]) => key !== "_meta")
    .sort(([left], [right]) => left.localeCompare(right, "en"));
  await writeFile(LOCALE_PATH, `${JSON.stringify({ _meta: metadata, ...Object.fromEntries(messages) }, null, 2)}\n`);
}

console.info(
  JSON.stringify(
    {
      mode: shouldWrite ? "write" : "audit",
      files: files.length,
      changedFiles,
      migratedStrings,
      newEnglishKeys: plannedMessages.size,
      skippedWithoutComponent,
      skippedCandidates,
    },
    null,
    2,
  ),
);

if (shouldCheck && (migratedStrings > 0 || skippedWithoutComponent > 0)) {
  process.exitCode = 1;
}

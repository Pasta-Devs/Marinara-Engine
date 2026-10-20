import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Exercise the actual picker and page-drop handlers without a browser or a real avatar file.
function handler(path, name, scope) {
  const source = ts.createSourceFile(
    path,
    readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let expression;
  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === name &&
      node.initializer &&
      ts.isJsxExpression(node.initializer)
    )
      expression = node.initializer.expression;
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) expression = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression, `${path} must provide ${name}`);
  const compiled = ts.transpileModule(`globalThis.handler = ${expression.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return runInNewContext(`${compiled}\nhandler;`, scope);
}

const messages = [];
const uploads = [];
const scope = {
  agentId: "3d-avatars",
  AVATAR_3D_AGENT_ID: "3d-avatars",
  t: (key) => key,
  toast: { error: (message) => messages.push(message) },
  importFile: { mutate: (upload) => uploads.push(upload) },
};
const setup = "packages/client/src/features/avatars/setup/AvatarAgentSetup.tsx";
const dragOver = handler(setup, "onDragOver", scope);
const drop = handler(setup, "onDrop", scope);
const pick = handler("packages/client/src/features/avatars/renderers/vrm/VrmSetupPanel.tsx", "importVrmFile", scope);

function event(files = [], types = ["Files"]) {
  return {
    dataTransfer: { files, types },
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
  };
}

for (const name of ["Mari.vroid", "MARI.VROID"]) {
  const file = { name };
  const project = event([file]);
  dragOver(project);
  assert.equal(project.defaultPrevented, true, "3D setup must allow native file drops to reach the hint");
  drop(project);
  assert.equal(project.propagationStopped, true, "a project must not reach another import handler");
  pick(file);
}
assert.deepEqual(messages, Array(4).fill("avatars.vrm.vroidProject"));
assert.equal(uploads.length, 0, "neither picker nor drop may upload a VRoid project");

for (const file of [{ name: "Mari.vrm" }, { name: "idle.vrma" }]) {
  pick(file);
  assert.equal(uploads.at(-1).file, file, "valid model and animation picks must reach the existing import");
  assert.equal(uploads.at(-1).kind, "vrm");
  const otherFile = event([file]);
  drop(otherFile);
  assert.equal(otherFile.defaultPrevented, false, "the project hint must leave other file drops alone");
}
const resource = event([], ["application/x-marinara-character-id"]);
dragOver(resource);
drop(resource);
assert.equal(resource.defaultPrevented, false, "internal resource dragging must remain unchanged");

scope.agentId = "2d-avatars";
const on2d = event([{ name: "Mari.vroid" }]);
dragOver(on2d);
drop(on2d);
assert.equal(on2d.defaultPrevented, false, "the 3D hint must not claim drops on the 2D page");
assert.equal(messages.length, 4);
assert.equal(uploads.length, 2);

process.stdout.write("VRoid picker and page-drop input regression passed\n");

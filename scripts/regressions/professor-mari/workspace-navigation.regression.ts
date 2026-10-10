import assert from "node:assert/strict";

import { resolveProfessorMariWorkspaceBackAction } from "../../../packages/client/src/lib/professor-mari-workspace-navigation.js";

assert.equal(resolveProfessorMariWorkspaceBackAction("context", true), "detail");
assert.equal(resolveProfessorMariWorkspaceBackAction("skills", true), "detail");
assert.equal(resolveProfessorMariWorkspaceBackAction("memories", true), "detail");
assert.equal(resolveProfessorMariWorkspaceBackAction("chats", false), "destination");
assert.equal(resolveProfessorMariWorkspaceBackAction("context", false), "destination");
assert.equal(resolveProfessorMariWorkspaceBackAction("chat", false), "workspace");

console.log("Professor Mari workspace-navigation regression checks passed.");

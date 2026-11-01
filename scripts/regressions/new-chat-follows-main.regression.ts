import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const read = (path: string) =>
  process.env.REGRESSION_SOURCE_REF
    ? execFileSync("git", ["show", `${process.env.REGRESSION_SOURCE_REF}:${path}`], { encoding: "utf8" })
    : readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const gate = read("packages/client/src/components/chat/NewChatConnectionGate.tsx");
const modal = read("packages/client/src/components/modals/create-connection/CreateConnectionModalContent.tsx");
const compile = (source: string, name: string, context: object) =>
  new Function(
    "context",
    `with(context) { ${ts.transpile(source + `\nreturn ${name};`, { target: ts.ScriptTarget.ES2022 })} }`,
  )(context);

for (const chosen of [false, true]) {
  for (const starred of [false, true]) {
    const created: Array<string | undefined> = [];
    const applied: Array<string | undefined> = [];
    const createWith = compile(
      gate.slice(gate.indexOf("const createWith ="), gate.indexOf("  const handleCreate")),
      "createWith",
      {
        connectionChosen: chosen,
        mode: "conversation",
        chatPresetsData: starred
          ? [{ id: "profile", mode: "conversation", isActive: true, isDefault: false, settings: {} }]
          : [],
        createChat: {
          mutateAsync: async (
            data: { connectionId?: string },
            options: { onSuccess: (chat: { id: string }) => void },
          ) => {
            created.push(data.connectionId);
            options.onSuccess({ id: "chat" });
          },
        },
        useChatStore: {
          getState: () => ({
            setPendingNewChatMode() {},
            setActiveChatId() {},
            setShouldOpenSettings() {},
            setShouldOpenWizard() {},
          }),
        },
        pendingNewChatOrigin: "home",
        setSidebarOpen() {},
        applyChatPreset: {
          mutateAsync: async (data: { connectionId?: string }) => {
            applied.push(data.connectionId);
          },
        },
      },
    );
    const handleCreate = compile(
      gate.slice(gate.indexOf("const handleCreate ="), gate.indexOf("  // With no connection")),
      "handleCreate",
      {
        connectionId: "displayed-main",
        connectionChosen: chosen,
        createWith,
      },
    );
    handleCreate();
    await Promise.resolve();
    assert.deepEqual(created, [chosen ? "displayed-main" : undefined], "only a user choice overrides Main");
    assert.deepEqual(applied, starred ? [chosen ? "displayed-main" : undefined] : []);

    // The Add callback must preserve an explicit selection even when the gate picker was never used.
    await createWith("added-explicit");
    assert.equal(created.at(-1), "added-explicit");
    if (starred) assert.equal(applied.at(-1), "added-explicit");
  }
}

for (const makeMainOn of [false, true]) {
  for (const saved of [false, true]) {
    const calls: Array<string | undefined> = [];
    const start = compile(
      modal.slice(modal.indexOf("const startChatting ="), modal.indexOf("  // ── Step 1")),
      "startChatting",
      {
        onStartChat: async (id?: string) => calls.push(id),
        firstPick: { connectionId: "added" },
        makeMainOn,
        setFinishing() {},
        applyChoices: async () => saved,
      },
    );
    await start();
    assert.deepEqual(calls, saved ? [makeMainOn ? undefined : "added"] : [], "start only after saving the Main choice");
  }
}
console.log("new chat follows Main regression passed");

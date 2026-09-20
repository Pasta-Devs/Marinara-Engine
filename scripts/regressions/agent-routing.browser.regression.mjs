import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("packages/client/src/components/agents/AgentRoutingModal.tsx").replaceAll("\\", "/");
const translations = JSON.parse(await readFile("packages/client/src/localization/locales/en.json", "utf8"));
const hooks = `
export const useConnections=()=>({data:window.connections});
export const useChat=()=>({data:window.chat});
export const useChatStore=fn=>fn({activeChatId:'chat'});
export const useSidecarStore=fn=>fn({modelDownloaded:false,modelDisplayName:null,config:{useAsAgentsDefault:false}});
export const useUIStore=fn=>fn({openAgentDetail:id=>window.opened=id});
const mutate=async(value,kind)=>{
  window.calls.push({kind,...value});
  if(window.fail===value.id || window.fail===value.agentType) throw new Error('fixture failure');
  if(kind==='metadata') window.chat.metadata={...window.chat.metadata,...value};
  else window.rows=window.rows.map(row=>(row.id===value.id||row.type===value.agentType)?{...row,connectionId:value.connectionId}:row);
  window.draw();
};
export const useUpdateAgent=()=>({mutateAsync:value=>mutate(value,'id')});
export const useUpdateAgentByType=()=>({mutateAsync:value=>mutate(value,'type')});
export const useUpdateChatMetadata=()=>({mutateAsync:value=>mutate(value,'metadata')});
export const useTestMessage=()=>({isPending:false,mutateAsync:async id=>{window.probes.push(id);return {success:true,response:'Hello',latencyMs:2111};}});
`;
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {AgentRoutingModal} from '${source}';const root=createRoot(document.getElementById('root'));window.draw=()=>root.render(<AgentRoutingModal rows={window.rows} onClose={()=>window.fixtureClosed=true}/>);window.draw();`,
    loader: "tsx",
    resolveDir: process.cwd(),
  },
  nodePaths: [resolve("packages/client/node_modules")],
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  define: { "import.meta.env.VITE_MARINARA_LITE": '"false"' },
  plugins: [
    {
      name: "fixture",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(react-i18next|sonner)$|\/hooks\/use-(agents|connections|chats)$|\/stores\/(chat|sidecar|ui)\.store$|\/ui\/Modal$/,
          },
          ({ path }) => ({ path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          loader: "tsx",
          resolveDir: resolve("packages/client"),
          contents:
            path === "react-i18next"
              ? `export const useTranslation=()=>({t:(key,vars={})=>(window.translations[key]||key).replace(/{{([a-zA-Z]+)}}/g,(_,k)=>String(vars[k]??''))});`
              : path === "sonner"
                ? `export const toast={success:x=>window.toasts.push(x),error:x=>window.toasts.push(x)};`
                : path.endsWith("/Modal")
                  ? `export const Modal=({title,children})=><section role="dialog" aria-label={title} className="mx-auto max-w-5xl p-4"><h1>{title}</h1>{children}</section>;`
                  : hooks,
        }));
      },
    },
  ],
});
const assetDir = "packages/client/dist/assets";
const css = (await readdir(assetDir)).filter((name) => name.endsWith(".css"));
const browser = await chromium.launch({ headless: true });
await mkdir(".tmp/agent-routing-proof", { recursive: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setContent(
      '<html class="dark"><body style="background:#18161d;color:#e9e3ef"><div id="root"></div></body></html>',
    );
    for (const name of css) await page.addStyleTag({ content: await readFile(`${assetDir}/${name}`, "utf8") });
    await page.evaluate((translations) => {
      window.translations = translations;
      window.calls = [];
      window.probes = [];
      window.toasts = [];
      window.connections = [
        { id: "spark", name: "ChatGPT Spark", model: "gpt-5.3-codex-spark", provider: "openai_chatgpt" },
        { id: "sol", name: "ChatGPT", model: "gpt-5.6-sol", provider: "openai_chatgpt", defaultForAgents: "true" },
        { id: "image", name: "Images", provider: "image_generation" },
      ];
      window.chat = {
        id: "chat",
        name: "Fixture campaign",
        mode: "game",
        metadata: {
          activeAgentIds: ["inventory-tracker"],
          gameSetupConfig: { sceneConnectionId: "sol", otherSetting: "preserved" },
        },
      };
      window.rows = [
        {
          id: "inventory",
          type: "inventory-tracker",
          name: "Inventory Tracker",
          description: "Track completed inventory changes.",
          builtin: true,
          connectionId: null,
        },
        {
          id: "custom",
          type: "custom-test",
          name: "Custom Agent",
          description: "User-defined tracking rules.",
          builtin: false,
          connectionId: null,
        },
        {
          id: "board",
          type: "storyboard",
          name: "Storyboard",
          description: "Plan scene illustrations.",
          builtin: true,
          connectionId: null,
        },
        {
          id: "missing",
          type: "other",
          name: "Deleted connection",
          description: "Preserve stale assignments for repair.",
          builtin: false,
          connectionId: "deleted",
        },
      ];
    }, translations);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const inventory = page.locator('[data-agent-type="inventory-tracker"]');
    await inventory.getByText("Selected in this chat", { exact: true }).waitFor();
    assert.match(await inventory.locator("select").innerText(), /gpt-5.3-codex-spark/);
    assert.doesNotMatch(await inventory.locator("select").innerText(), /Images/);
    assert.match(
      await page.locator('[data-agent-type="other"] select').innerText(),
      /Unavailable connection \(deleted\)/,
    );
    await inventory.locator("select").selectOption("spark");
    await page.waitForFunction(() => window.calls.length === 1);
    assert.deepEqual(await page.evaluate(() => window.calls[0]), {
      kind: "type",
      agentType: "inventory-tracker",
      connectionId: "spark",
    });
    await inventory.getByRole("checkbox").check();
    await page.locator('[data-agent-type="custom-test"]').getByRole("checkbox").check();
    await page.getByLabel("Connection for selected agents").selectOption("sol");
    await page.evaluate(() => (window.fail = "custom"));
    await page.getByRole("button", { name: "Apply to selected" }).click();
    await page.waitForFunction(
      () => window.calls.length === 3 && window.toasts.some((x) => x.includes("Could not save")),
    );
    assert.equal(await inventory.getByRole("checkbox").isChecked(), false);
    assert.equal(await page.locator('[data-agent-type="custom-test"]').getByRole("checkbox").isChecked(), true);
    await page.evaluate(() => (window.fail = null));
    await page.getByRole("button", { name: "Apply to selected" }).click();
    await page.waitForFunction(() => window.calls.length === 4);
    assert.deepEqual(await page.evaluate(() => window.calls[3]), { kind: "id", id: "custom", connectionId: "sol" });
    const board = page.locator('[data-agent-type="storyboard"]');
    assert.equal(await board.locator("select").nth(1).inputValue(), "sol");
    // The legacy game setup scene connection remains the effective route even when an agent assignment exists.
    await page.evaluate(() => {
      window.rows = window.rows.map((row) => (row.type === "storyboard" ? { ...row, connectionId: "spark" } : row));
      window.draw();
    });
    await page.waitForFunction(() => document.querySelector('[data-agent-type="storyboard"] select').value === "spark");
    assert.equal(await board.locator("select").nth(1).inputValue(), "sol");
    await page.evaluate(() => {
      window.chat.metadata.gameSceneConnectionId = "sol";
      window.draw();
    });
    await page.waitForFunction(
      () => document.querySelectorAll('[data-agent-type="storyboard"] select')[1].value === "sol",
    );
    await board.locator("select").nth(1).selectOption("");
    await page.waitForFunction(() => window.calls.length === 5);
    assert.deepEqual(await page.evaluate(() => window.calls[4]), {
      kind: "metadata",
      id: "chat",
      gameSceneConnectionId: null,
      gameSetupConfig: { sceneConnectionId: null, otherSetting: "preserved" },
    });
    assert.equal(await board.locator("select").nth(0).inputValue(), "spark");
    assert.equal(await board.locator("select").nth(1).inputValue(), "");
    await page.getByLabel("Connection to test").selectOption("spark");
    await page.getByRole("button", { name: "Send test" }).click();
    await page.getByRole("status").filter({ hasText: "2.111 s" }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.probes), ["spark"]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `.tmp/agent-routing-proof/${width}.png`, fullPage: true });
    await inventory.getByRole("button", { name: "Detailed settings" }).click();
    assert.equal(await page.evaluate(() => window.opened), "inventory-tracker");
    assert.equal(await page.evaluate(() => window.fixtureClosed), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.info(
    "Agent routing: desktop/mobile selection, individual/bulk writes, partial failure, stale connections, hidden override reset, timed probe and editor navigation passed.",
  );
} finally {
  await browser.close();
}


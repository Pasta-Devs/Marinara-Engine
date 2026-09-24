// Regression: RunPod ComfyUI service (server hunt batch 37).
// 1. A job abandoned by abort, timeout or a status error must get a best-effort
//    POST /cancel/{jobId}, while terminal states (FAILED) must not.
// 2. Prompt text is substituted literally: "$" replacement patterns are not
//    expanded and every control character is JSON-escaped.
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

process.env.LOG_LEVEL = "silent";
process.env.RUNPOD_POLL_INTERVAL_MS = "5";

const { generateRunPodComfyUI } = await import("../../packages/server/src/services/image/runpod-comfyui.service.js");

type StatusMode = "in_progress" | "error" | "failed" | "completed";

const PNG_BASE64 = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 1),
]).toString("base64");

const state = {
  mode: "in_progress" as StatusMode,
  statusCalls: 0,
  cancels: [] as string[],
  submittedWorkflow: null as unknown,
  onStatus: null as null | (() => void),
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, code: number, value: unknown) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "";
  const body = await readBody(req);
  if (req.method === "POST" && url.endsWith("/run")) {
    state.submittedWorkflow = (JSON.parse(body) as { input: { workflow: unknown } }).input.workflow;
    sendJson(res, 200, { id: "job-1" });
    return;
  }
  const cancel = url.match(/\/cancel\/([^/]+)$/);
  if (req.method === "POST" && cancel) {
    state.cancels.push(decodeURIComponent(cancel[1]!));
    sendJson(res, 200, { id: cancel[1], status: "CANCELLED" });
    return;
  }
  if (req.method === "GET" && /\/status\//.test(url)) {
    state.statusCalls++;
    state.onStatus?.();
    if (state.mode === "error") {
      sendJson(res, 500, { error: "boom" });
    } else if (state.mode === "failed") {
      sendJson(res, 200, { id: "job-1", status: "FAILED", error: "worker crashed" });
    } else if (state.mode === "completed") {
      sendJson(res, 200, { id: "job-1", status: "COMPLETED", output: { images: [{ data: PNG_BASE64 }] } });
    } else {
      sendJson(res, 200, { id: "job-1", status: "IN_PROGRESS" });
    }
    return;
  }
  sendJson(res, 404, { error: "not found" });
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v2`;

function reset(mode: StatusMode) {
  state.mode = mode;
  state.statusCalls = 0;
  state.cancels = [];
  state.submittedWorkflow = null;
  state.onStatus = null;
}

async function waitFor(check: () => boolean, label: string) {
  const deadline = Date.now() + 3_000;
  while (!check()) {
    if (Date.now() > deadline) assert.fail(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const workflow = JSON.stringify({ "1": { class_type: "CLIPTextEncode", inputs: { text: "%prompt%" } } });

try {
  // Abort mid-poll sends a cancel for the job.
  reset("in_progress");
  const controller = new AbortController();
  state.onStatus = () => {
    if (state.statusCalls >= 2) controller.abort(new Error("user cancelled"));
  };
  await assert.rejects(
    generateRunPodComfyUI(baseUrl, "endpoint", "key", {
      prompt: "a cat",
      comfyWorkflow: workflow,
      allowLocalUrls: true,
      signal: controller.signal,
    }),
    /user cancelled/,
  );
  await waitFor(() => state.cancels.length > 0, "cancel after abort");
  assert.deepEqual(state.cancels, ["job-1"]);

  // A failing status check also cancels the job.
  reset("error");
  await assert.rejects(
    generateRunPodComfyUI(baseUrl, "endpoint", "key", { prompt: "a cat", comfyWorkflow: workflow, allowLocalUrls: true }),
    /RunPod status check failed \(500\)/,
  );
  await waitFor(() => state.cancels.length > 0, "cancel after status error");
  assert.deepEqual(state.cancels, ["job-1"]);

  // A job RunPod already reports as FAILED is terminal: no cancel.
  reset("failed");
  await assert.rejects(
    generateRunPodComfyUI(baseUrl, "endpoint", "key", { prompt: "a cat", comfyWorkflow: workflow, allowLocalUrls: true }),
    /RunPod generation failed: worker crashed/,
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(state.cancels, [], "terminal FAILED jobs must not be cancelled");

  // Prompt text with "$" patterns and control characters is substituted literally.
  reset("completed");
  const trickyPrompt = "costs $$5, x $& y, q $` z, q $' z, form\ffeed, nul\u0000, \"quoted\" back\\slash\nline";
  const result = await generateRunPodComfyUI(baseUrl, "endpoint", "key", {
    prompt: trickyPrompt,
    comfyWorkflow: workflow,
    allowLocalUrls: true,
  });
  assert.equal(result.mimeType, "image/png");
  const submitted = state.submittedWorkflow as { "1": { inputs: { text: string } } };
  assert.equal(submitted["1"].inputs.text, trickyPrompt);
  assert.deepEqual(state.cancels, [], "completed jobs must not be cancelled");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log("server-hunt-b37 regression passed");

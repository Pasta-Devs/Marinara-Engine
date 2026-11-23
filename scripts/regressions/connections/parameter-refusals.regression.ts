import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A service that blocks a setting says so only by refusing it. The Chat Completions path resends without the settings
// a refusal names, remembers them for that service and model, and leaves them out from then on; the panel reads the
// same memory and hides them.
const root = mkdtempSync(join(tmpdir(), "marinara-parameter-refusals-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = `${root}/storage`;
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";

try {
  const {
    detectRefusedParameterFields,
    parameterRefusalService,
    refusedGenerationParameters,
    refusedParameterFields,
    resetParameterRefusalsForTesting,
  } = await import("../../../packages/server/src/services/llm/parameter-refusals.js");
  const { createLLMProvider } = await import("../../../packages/server/src/services/llm/provider-registry.js");
  const { relevantGenerationParameters } =
    await import("../../../packages/shared/src/constants/generation-parameter-relevance.js");

  const sent = { temperature: 0.7, top_p: 0.9, top_k: 40, frequency_penalty: 0.3, presence_penalty: 0.2 };
  const detect = (error: unknown, body: Record<string, unknown> = sent) =>
    detectRefusedParameterFields(typeof error === "string" ? error : JSON.stringify(error), body);

  // Refusals in the shapes services actually use.
  assert.deepEqual(
    detect({ error: { message: "Unsupported parameter: 'presence_penalty' is not supported with this model." } }),
    ["presence_penalty"],
  );
  assert.deepEqual(
    detect({
      error: {
        message:
          "Unsupported value: 'temperature' does not support 0.7 with this model. Only the default (1) value is supported.",
      },
    }),
    ["temperature"],
  );
  assert.deepEqual(
    detect({ detail: [{ type: "extra_forbidden", loc: ["body", "top_k"], msg: "Extra inputs are not permitted" }] }),
    ["top_k"],
  );
  assert.deepEqual(detect("Unrecognized request argument supplied: frequency_penalty"), ["frequency_penalty"]);
  assert.deepEqual(detect({ error: { message: "frequencyPenalty is not supported for this model" } }), [
    "frequency_penalty",
  ]);
  assert.deepEqual(
    detect({ error: { message: "`temperature` and `top_p` cannot both be specified for this model." } }),
    ["top_p"],
    "two samplers refused together drop only top_p",
  );
  assert.deepEqual(
    detect({ error: { message: "temperature and top_p are not supported together; only one of them may be set." } }),
    ["top_p"],
    "the temperature + top_p pair, both named, still drops only top_p",
  );
  assert.deepEqual(
    detect({ error: { message: "top_p and frequency_penalty are both not supported" } }).sort(),
    ["frequency_penalty", "top_p"],
    "together wording about other fields keeps every field it names",
  );
  assert.deepEqual(
    detect({ error: { message: "temperature, top_p and top_k are all not supported together for this model" } }).sort(),
    ["temperature", "top_k", "top_p"],
    "three fields refused together are all dropped",
  );
  // Not refusals of a setting: a value out of range, a refusal about something else, a field that was not sent.
  assert.deepEqual(detect({ error: { message: "temperature must be between 0 and 1" } }), []);
  assert.deepEqual(
    detect({ error: { message: "min_p is not allowed to be 1; it must be between 0 and 1" } }, { ...sent, min_p: 1 }),
    [],
    "refusal wording about a value out of range refuses the value, not the setting",
  );
  assert.deepEqual(
    detect({ error: { message: "Invalid 'top_k': not allowed. Expected a value <= 100, but got 400 instead." } }),
    [],
  );
  assert.deepEqual(
    detect({ error: { message: "top_k is not supported. Valid top_p values are between 0 and 1." } }),
    ["top_k"],
    "another field's bound in the next sentence does not cancel a refusal",
  );
  assert.deepEqual(detect({ error: { message: "messages: role 'tool' is not supported" } }), []);
  assert.deepEqual(detect({ error: { message: "top_k is not supported" } }, { temperature: 0.7 }), []);
  assert.deepEqual(
    detect(
      { error: { message: "The parameter 'min_p' is not supported by the AI Horde chat completions endpoint." } },
      { ...sent, min_p: 0.05 },
    ),
    ["min_p"],
    "AI Horde's refusal of min_p",
  );

  // The request path: refuse frequency_penalty and top_k, accept everything else.
  const bodies: Array<Record<string, unknown>> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    bodies.push(body);
    // Refuses a min_p value out of range, and takes any other request.
    if (request.url?.startsWith("/range/") && "min_p" in body) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "min_p is not allowed to be 1; it must be between 0 and 1" } }));
      return;
    }
    // Refuses top_k, then fails for another reason.
    if (request.url?.startsWith("/broken/")) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ error: { message: "top_k" in body ? "top_k is not supported" : "model is busy" } }),
      );
      return;
    }
    // Like AI Horde: refuses top_k and min_p, naming only the first one it finds.
    const hordeRefuses = request.url?.startsWith("/horde/") ? ["top_k", "min_p"].find((field) => field in body) : "";
    if (hordeRefuses) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: {
            message: `The parameter '${hordeRefuses}' is not supported by the AI Horde chat completions endpoint.`,
            type: "invalid_request_error",
            param: hordeRefuses,
            code: "UnsupportedChatParameter",
          },
        }),
      );
      return;
    }
    if ("frequency_penalty" in body) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "frequency_penalty is not supported by this provider" } }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        id: "x",
        object: "chat.completion",
        choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  const service = parameterRefusalService("custom", base);
  resetParameterRefusalsForTesting();

  const ask = async (customParameters?: Record<string, unknown>) => {
    const provider = createLLMProvider("custom", base, "key");
    const result = await provider.chatComplete([{ role: "user", content: "hi" }], {
      model: "some-model",
      stream: false,
      temperature: 0.7,
      maxTokens: 50,
      frequencyPenalty: 0.4,
      ...(customParameters ? { customParameters } : {}),
    });
    assert.equal(result.content, "ok");
  };

  try {
    await ask();
    assert.equal(bodies.length, 2, "the refused request is sent once more");
    assert.equal(bodies[0]!.frequency_penalty, 0.4);
    assert.equal("frequency_penalty" in bodies[1]!, false);
    assert.equal(bodies[1]!.temperature, 0.7, "only the refused setting is dropped");
    assert.deepEqual(refusedParameterFields(service, "some-model"), ["frequency_penalty"]);
    assert.deepEqual(refusedGenerationParameters(service, "some-model"), ["frequencyPenalty"]);
    assert.deepEqual(refusedParameterFields(service, "other-model"), [], "remembered per model");
    assert.deepEqual(refusedParameterFields(parameterRefusalService("custom", `${base}x`), "some-model"), []);

    await ask();
    assert.equal(bodies.length, 3, "a remembered refusal is left out from the first try");
    assert.equal("frequency_penalty" in bodies[2]!, false);

    // Custom Parameters are the user's own: sent as asked, and their refusal is reported, not retried.
    await assert.rejects(ask({ frequency_penalty: 0.9 }), /frequency_penalty/);
    assert.equal(bodies.length, 4);
    assert.equal(bodies[3]!.frequency_penalty, 0.9);

    // A service that names one refused setting per answer gets a retry for each, and all of them are remembered.
    const hordeBase = base.replace(/\/v1$/u, "/horde/v1");
    const hordeService = parameterRefusalService("custom", hordeBase);
    const askHorde = async () => {
      const result = await createLLMProvider("custom", hordeBase, "0000000000").chatComplete(
        [{ role: "user", content: "hi" }],
        { model: "koboldcpp/some-model", stream: false, temperature: 0.7, maxTokens: 50, topK: 40, minP: 0.05 },
      );
      assert.equal(result.content, "ok");
    };
    bodies.length = 0;
    await askHorde();
    assert.equal(bodies.length, 3, "one retry per refused setting");
    assert.equal(bodies[0]!.top_k, 40);
    assert.equal(bodies[0]!.min_p, 0.05);
    assert.equal("top_k" in bodies[2]!, false);
    assert.equal("min_p" in bodies[2]!, false);
    assert.equal(bodies[2]!.temperature, 0.7);
    assert.deepEqual(refusedParameterFields(hordeService, "koboldcpp/some-model").sort(), ["min_p", "top_k"]);
    assert.deepEqual(refusedGenerationParameters(hordeService, "koboldcpp/some-model").sort(), ["minP", "topK"]);
    await askHorde();
    assert.equal(bodies.length, 4, "both are left out from the first try");

    // A value out of range is reported, not retried without the setting, and Min P stays in the panel.
    const rangeBase = base.replace(/\/v1$/u, "/range/v1");
    const rangeService = parameterRefusalService("custom", rangeBase);
    bodies.length = 0;
    await assert.rejects(
      createLLMProvider("custom", rangeBase, "key").chatComplete([{ role: "user", content: "hi" }], {
        model: "some-model",
        stream: false,
        maxTokens: 50,
        topK: 40,
        minP: 1,
      }),
      /must be between 0 and 1/,
    );
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0]!.min_p, 1);
    assert.deepEqual(refusedParameterFields(rangeService, "some-model"), []);
    assert.deepEqual(refusedGenerationParameters(rangeService, "some-model"), []);

    // A retry that fails for another reason stops there and remembers nothing.
    const brokenBase = base.replace(/\/v1$/u, "/broken/v1");
    bodies.length = 0;
    await assert.rejects(
      createLLMProvider("custom", brokenBase, "key").chatComplete([{ role: "user", content: "hi" }], {
        model: "some-model",
        stream: false,
        maxTokens: 50,
        topK: 40,
      }),
      /model is busy/,
    );
    assert.equal(bodies.length, 2);
    assert.deepEqual(refusedParameterFields(parameterRefusalService("custom", brokenBase), "some-model"), []);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // The panel hides remembered settings, and "Show unsupported parameters" can still reveal them.
  const shown = relevantGenerationParameters({
    provider: "custom",
    model: "some-model",
    capabilities: { refusedParameters: ["frequencyPenalty"] },
  });
  assert.equal(shown.has("frequencyPenalty"), false);
  assert.equal(shown.has("presencePenalty"), true);
  // Min P shows where Top K does, and each refusal hides only the setting it names.
  const custom = (refusedParameters?: Array<"topK" | "minP">) =>
    relevantGenerationParameters({ provider: "custom", model: "some-model", capabilities: { refusedParameters } });
  assert.equal(custom().has("minP"), true);
  assert.equal(custom(["minP"]).has("minP"), false, "a remembered min_p refusal hides Min P");
  assert.equal(custom(["minP"]).has("topK"), true);
  assert.equal(custom(["topK"]).has("minP"), true, "min_p is still sent when only top_k was refused");
  assert.equal(relevantGenerationParameters({ provider: "openai", model: "gpt-4o" }).has("minP"), false);

  // Survives a restart: a fresh module reads the saved file.
  const fresh = await import(
    `../../../packages/server/src/services/llm/parameter-refusals.js?fresh=${Date.now()}` as string
  );
  assert.deepEqual(fresh.refusedParameterFields(service, "some-model"), ["frequency_penalty"]);
  console.log("parameter-refusals regression passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}

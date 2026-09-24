import { expect, test } from "@playwright/test";
import { createServer } from "node:http";

// Scripted responses exercise the real workspace loop and storage, not an LLM quality benchmark.
test("Mari Decision authoring waits for the setup answer and preserves it across turns", async ({ request }) => {
  const suffix = Date.now().toString(36);
  const name = `Decision authoring ${suffix}`;
  const initial = "Create a character with Decision guidance.";
  const approval = "Yes, proceed without a Decision model.";
  const template =
    '{{#if decision:"A fight is happening in the latest message" sticky:3 cooldown:5}}Be concise.{{else}}Stay descriptive.{{/if}}';
  const tool = (action: string, data?: Record<string, unknown>, extra = {}) => ({
    name: "app_data",
    arguments: { action, ...(data ? { data } : {}), ...extra },
  });
  let actions: Array<Record<string, unknown>> = [];
  const prompts: string[] = [];
  const provider = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      prompts.push(Buffer.concat(chunks).toString());
      const action = actions.shift() ?? { say: "Waiting for your next instruction.", commands: [], stop: true };
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      response.end(
        [
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: JSON.stringify(action) }, finish_reason: null }] })}`,
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
          "data: [DONE]",
          "",
        ].join("\n\n"),
      );
    });
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  let connectionId = "";
  let chatId = "";
  let characterId = "";
  const options = await request.get("/api/decision/options");
  const previousSelected = ((await options.json()) as { selected: string | null }).selected;
  try {
    expect((await request.post("/api/decision/select", { data: { id: null } })).ok()).toBeTruthy();
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Missing fixture provider address");
    const connection = await request.post("/api/connections", {
      data: {
        name: `Mari fixture ${suffix}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "fixture",
        model: "fixture",
        maxContext: 65536,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;
    const chat = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
    chatId = ((await chat.json()) as { id: string }).id;
    const run = async (message: string) => {
      const result = await request.post("/api/professor-mari/workspace/prompt", {
        data: { chatId, connectionId, message },
      });
      expect(result.ok(), await result.text()).toBeTruthy();
      return (await result.text())
        .split("\n\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
        .map((line) => JSON.parse(line.slice(6)) as { type: string; data: { isError?: boolean; output?: string } });
    };
    actions = [
      { say: "", commands: [tool("decision.get")], stop: false },
      {
        say: "You have no Decision model selected. Prompt conditions will use their fallback. Proceed anyway?",
        commands: [
          tool("decision.record", { category: "authoring", answer: "allow", quote: initial }),
          tool("decision.record", { category: "setupReminder", answer: "pending" }),
        ],
        stop: true,
      },
    ];
    const first = await run(initial);
    expect(first.filter((event) => event.type === "tool_end").every((event) => !event.data.isError)).toBeTruthy();
    const firstPrompt = JSON.parse(prompts[0]!) as { messages: Array<{ content: string }> };
    const promptText = firstPrompt.messages.map((message) => message.content).join("\n");
    expect(promptText).toContain("Decision authoring");
    expect(promptText).toContain('"state":"none"');

    actions = [
      {
        say: "",
        commands: [
          tool("decision.record", { category: "setupReminder", answer: "allow", quote: approval }),
          tool("decision.record", { category: "authoring", answer: "allow", quote: approval }),
        ],
        stop: false,
      },
      {
        say: "Creating your character.",
        commands: [tool("character.create", { name, description: template }, { apply: true })],
        stop: false,
      },
      { say: "Created with timed Decision guidance and an ordinary fallback.", commands: [], stop: true },
    ];
    const approved = await run(approval);
    const ends = approved.filter((event) => event.type === "tool_end");
    expect(
      ends.every((event) => !event.data.isError),
      JSON.stringify(ends),
    ).toBeTruthy();
    const created = ends.find((event) => event.data.output?.includes("Command: app_data character.create"));
    expect(created).toBeTruthy();
    const output = created!.data.output!;
    const result = JSON.parse(output.slice(output.indexOf("{"))) as {
      summary: { preview: Array<{ table: string; id: string }> };
    };
    characterId = result.summary.preview.find((row) => row.table === "characters")!.id;
    const saved = (await (await request.get(`/api/characters/${characterId}`)).json()) as {
      data: string | { description: string };
    };
    const card = typeof saved.data === "string" ? (JSON.parse(saved.data) as { description: string }) : saved.data;
    expect(card.description).toBe(template);

    // The once-per-chat acknowledgment remains, but the specific-task permission must expire.
    actions = [
      { say: "", commands: [tool("decision.get")], stop: false },
      {
        say: "",
        commands: [tool("character.update", { description: template + template }, { characterId, apply: true })],
        stop: false,
      },
      { say: "The unrelated request does not authorize more Decision content.", commands: [], stop: true },
    ];
    const unrelated = await run("Tell me about character cards.");
    const blocked = unrelated.find((event) => event.type === "tool_end" && event.data.isError);
    expect(blocked?.data.output).toContain("Before adding Decision content");
    const live = unrelated.find((event) => event.type === "tool_end" && event.data.output?.includes('"setupReminder"'));
    expect(live?.data.output).toContain('"answer": "allow"');
  } finally {
    if (characterId) await request.delete(`/api/characters/${characterId}`);
    if (chatId) await request.delete(`/api/chats/internal/professor-mari/chats/${chatId}`);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`);
    await request.post("/api/decision/select", { data: { id: previousSelected } });
    await new Promise<void>((resolve, reject) => provider.close((err) => (err ? reject(err) : resolve())));
  }
});

import { expect, test } from "@playwright/test";
import { createServer } from "node:http";

// R3 (slice 62): proves the prompt wiring, not just that `chat.diagnose` exists in isolation.
// A scripted fake model exercises the real workspace loop and real storage: a chat is seeded with
// a genuinely cut-off reply, Mari is asked why it got worse, and the test checks the SERVER really
// executed `chat.diagnose` against that seeded data (the real 512-token limit shows up in the tool
// result fed back to the model) before the mocked final answer names that same number.
test("Mari calls chat.diagnose first and names the real limit from the findings", async ({ request }) => {
  const suffix = Date.now().toString(36);
  const tool = (action: string, args: Record<string, unknown> = {}) => ({
    name: "app_data",
    arguments: { action, ...args },
  });
  const prompts: string[] = [];
  let actions: Array<Record<string, unknown>> = [];
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
  let mariChatId = "";
  let roleplayChatId = "";
  try {
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Missing fixture provider address");
    const connection = await request.post("/api/connections", {
      data: {
        name: `Diagnose fixture ${suffix}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "fixture",
        model: "fixture",
        maxContext: 65536,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;

    // Seed a chat with a genuinely cut-off reply (same shape as slice 61's reply-checkup fixtures).
    const roleplayChat = await (
      await request.post("/api/chats", { data: { name: `Worse reply ${suffix}`, mode: "roleplay", characterIds: [] } })
    ).json();
    roleplayChatId = roleplayChat.id;
    await request.post(`/api/chats/${roleplayChatId}/messages`, { data: { role: "user", content: "Tell me the story." } });
    const reply = await (
      await request.post(`/api/chats/${roleplayChatId}/messages`, {
        data: { role: "assistant", content: "Once upon a time the castle stood on the hill, and the" },
      })
    ).json();
    await request.patch(`/api/chats/${roleplayChatId}/messages/${reply.id}/extra`, {
      data: {
        generationInfo: {
          provider: "openai",
          model: "story-model",
          finishReason: "length",
          maxTokens: 512,
          contextFit: {
            trimmed: false,
            droppedHistory: 0,
            tokensBefore: 3000,
            tokensAfter: 3000,
            inputBudget: 7000,
            replyBudgetFrom: 512,
            replyBudgetTo: 512,
          },
        },
      },
    });

    const mariChat = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
    mariChatId = ((await mariChat.json()) as { id: string }).id;
    const run = async (message: string) => {
      const result = await request.post("/api/professor-mari/workspace/prompt", {
        data: { chatId: mariChatId, connectionId, message },
      });
      expect(result.ok(), await result.text()).toBeTruthy();
      return (await result.text())
        .split("\n\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
        .map((line) => JSON.parse(line.slice(6)) as { type: string; data: { isError?: boolean; output?: string } });
    };

    actions = [
      { say: "", commands: [tool("chat.diagnose", { chatId: roleplayChatId })], stop: false },
      {
        say: "That reply hit its 512-token output limit and stopped mid-sentence. Raising Max output tokens on the active preset would fix it — want me to?",
        commands: [],
        stop: true,
      },
    ];
    const events = await run("Why did that reply get worse?");

    const ends = events.filter((event) => event.type === "tool_end");
    expect(
      ends.every((event) => !event.data.isError),
      JSON.stringify(ends),
    ).toBeTruthy();
    const diagnosed = ends.find((event) => event.data.output?.includes("Command: app_data chat.diagnose"));
    expect(diagnosed, "chat.diagnose must actually run as a workspace command").toBeTruthy();
    // The real seeded limit, read back from real storage by the real executeAction call - not
    // something the test script supplied - must be present in what was fed back to the model.
    expect(diagnosed!.data.output).toContain('"cut_off"');
    expect(diagnosed!.data.output).toContain("512");
    // The findings never carry the seeded message's own text.
    expect(diagnosed!.data.output).not.toContain("the castle stood on the hill");

    const fullOutput = events.map((event) => JSON.stringify(event.data)).join("\n");
    expect(fullOutput).toContain("512-token output limit");
  } finally {
    if (roleplayChatId) await request.delete(`/api/chats/${roleplayChatId}?force=true`);
    if (mariChatId) await request.delete(`/api/chats/internal/professor-mari/chats/${mariChatId}`);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`);
    await new Promise<void>((resolve, reject) => provider.close((err) => (err ? reject(err) : resolve())));
  }
});

import assert from "node:assert/strict";

// oai-reverse-proxy writes its errors as the assistant's reply (HTTP 200). A connection test must report that as a
// failure with the proxy's reason, not as a successful answer.
const { proxyErrorFromReply } = await import("../../../packages/shared/src/index.js");

const reply = [
  "### **Proxy error (HTTP 402 No Keys Available)**",
  "",
  "The proxy encountered an error while trying to send your prompt to the API. Further details are provided below.",
  "",
  "----",
  "",
  "*No OpenAI keys available for model gpt-6.1-sol*",
  "",
  "```",
  JSON.stringify(
    { error: { message: "No OpenAI keys available for model gpt-6.1-sol", type: "proxy_no_keys_available" } },
    null,
    2,
  ),
  "```",
  "",
  "<!-- oai-proxy-error -->",
].join("\n");
assert.equal(proxyErrorFromReply(reply), "No OpenAI keys available for model gpt-6.1-sol");
// Without the JSON block, the emphasised line is the reason.
assert.equal(
  proxyErrorFromReply("### **Proxy error (HTTP 429)**\n\n*Rate limited*\n\n<!-- oai-proxy-error -->"),
  "Rate limited",
);
// Ordinary replies, even ones that mention a proxy, are answers.
assert.equal(proxyErrorFromReply("Hi! How can I help?"), null);
assert.equal(proxyErrorFromReply("The proxy error you saw means the key ran out."), null);
assert.equal(proxyErrorFromReply(""), null);

console.log("proxy-error-reply: ok");

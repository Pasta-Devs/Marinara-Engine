import assert from "node:assert/strict";
import { newLocalServers } from "../../packages/client/src/lib/local-servers.ts";

const ollama = { name: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", models: 4 };
const lmStudio = { name: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1", models: 2 };

// An account on the same port hides the server, whatever loopback name or path it was added with.
assert.deepEqual(newLocalServers([ollama, lmStudio], [{ baseUrl: "http://localhost:11434" }]), [lmStudio]);
assert.deepEqual(newLocalServers([ollama], [{ baseUrl: "http://[::1]:11434/v1/" }]), []);
// Another host, another port, or no address keeps it.
assert.deepEqual(
  newLocalServers([ollama], [{ baseUrl: "http://10.0.0.5:11434/v1" }, { baseUrl: "http://localhost:8080" }, {}]),
  [ollama],
);
console.log("local-servers-dedupe: ok");

import assert from "node:assert/strict";
import dnsModule, { promises as dns } from "node:dns";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { llmFetch } from "../../packages/server/src/services/llm/base-provider.js";

// #7652: with NODE_USE_ENV_PROXY=1 and HTTP(S)_PROXY set, Node sends its own fetch (the model list) through the
// proxy, but provider calls brought their own dispatcher and went direct. They must use the proxy too, honour
// NO_PROXY, keep this machine's own addresses direct, and stay direct when the switch is off.

const PROVIDER = "llm.proxy-test.example";
const DIRECT = "direct.proxy-test.example";

// Fixed answers on every route: the target says it was reached directly, the proxy's tunnel says it was proxied.
const target = createServer((_req, res) => res.end("direct"));
const tunnelled = createServer((_req, res) => res.end("proxy"));
const tunnels: string[] = [];
const proxy = createServer((_req, res) => {
  res.statusCode = 405;
  res.end();
});
proxy.on("connect", (req, socket, head) => {
  tunnels.push(req.url ?? "");
  socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
  if (head.length > 0) socket.unshift(head);
  tunnelled.emit("connection", socket);
});

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

// The test names resolve to the target on this machine, through both lookup forms: the URL guard uses the
// promise API, while a plain undici dispatcher connects through the callback API.
const isTestName = (hostname: string) => hostname.endsWith(".proxy-test.example");
const originalLookup = dns.lookup;
const originalCallbackLookup = dnsModule.lookup;
(dns as { lookup: unknown }).lookup = async (hostname: string, options: unknown) =>
  isTestName(hostname) ? [{ address: "127.0.0.1", family: 4 }] : originalLookup(hostname, options as never);
(dnsModule as { lookup: unknown }).lookup = (
  hostname: string,
  options: { all?: boolean },
  callback: (...args: unknown[]) => void,
) => {
  if (!isTestName(hostname)) return originalCallbackLookup(hostname, options as never, callback as never);
  if (options?.all) callback(null, [{ address: "127.0.0.1", family: 4 }]);
  else callback(null, "127.0.0.1", 4);
};

const targetPort = await listen(target);
const proxyPort = await listen(proxy);
for (const name of ["http_proxy", "https_proxy", "no_proxy", "HTTPS_PROXY", "NO_PROXY", "NODE_USE_ENV_PROXY"]) {
  delete process.env[name];
}
process.env.HTTP_PROXY = `http://127.0.0.1:${proxyPort}`;

async function ask(host: string): Promise<string> {
  const response = await llmFetch(`http://${host}:${targetPort}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  return response.text();
}

try {
  for (const localUrls of ["false", "true"]) {
    process.env.PROVIDER_LOCAL_URLS_ENABLED = localUrls;
    const label = `PROVIDER_LOCAL_URLS_ENABLED=${localUrls}`;

    process.env.NODE_USE_ENV_PROXY = "1";
    tunnels.length = 0;
    assert.equal(await ask(PROVIDER), "proxy", `${label}: a provider call goes through the proxy`);
    assert.deepEqual(tunnels, [`${PROVIDER}:${targetPort}`], `${label}: the proxy is asked for the provider host`);

    process.env.NO_PROXY = DIRECT;
    assert.equal(await ask(DIRECT), "direct", `${label}: a NO_PROXY host goes direct`);
    delete process.env.NO_PROXY;

    for (const host of ["127.0.0.1", "localhost"]) {
      assert.equal(await ask(host), "direct", `${label}: ${host} stays direct`);
    }
    assert.deepEqual(tunnels, [`${PROVIDER}:${targetPort}`], `${label}: only the provider call used the proxy`);

    delete process.env.NODE_USE_ENV_PROXY;
    assert.equal(await ask(PROVIDER), "direct", `${label}: without NODE_USE_ENV_PROXY the call stays direct`);
    assert.equal(tunnels.length, 1, `${label}: without NODE_USE_ENV_PROXY the proxy is not used`);
  }
} finally {
  (dns as { lookup: unknown }).lookup = originalLookup;
  (dnsModule as { lookup: unknown }).lookup = originalCallbackLookup;
  for (const server of [target, tunnelled, proxy]) server.closeAllConnections();
  await Promise.all([target, proxy].map((server) => new Promise((resolve) => server.close(resolve))));
}

console.log("LLM env proxy regression passed");

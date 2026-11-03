import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { llmFetch } from "../../packages/server/src/services/llm/base-provider.js";
import { safeFetch, type OutboundUrlPolicy } from "../../packages/server/src/utils/security.js";

// Loopback, mDNS and local-network trust belong to the server the caller chose. A remote server must not
// pass that trust on by redirecting, while redirects between local servers and between remote ones still work.

const loopbackHits: string[] = [];
async function listen(handler: Parameters<typeof createServer>[1]): Promise<{ server: Server; origin: string }> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  return { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}
const internal = await listen((request, response) => {
  loopbackHits.push(request.url ?? "");
  response.end("internal");
});
const internalPort = new URL(internal.origin).port;
const hop = await listen((_request, response) => {
  response.writeHead(307, { location: `${internal.origin}/ok` }).end();
});

// Remote servers are fixtures; only the two loopback servers above are real.
const REMOTE = "https://93.184.216.34";
const remoteRedirects = new Map<string, string>();
const remoteHits: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return originalFetch(input, init);
  remoteHits.push(url.href);
  if (url.hostname === "relay.test") relayContacted = true;
  const location = remoteRedirects.get(url.href);
  return location ? new Response(null, { status: 307, headers: { location } }) : new Response("remote");
}) as typeof fetch;
const originalLookup = dns.lookup;
const fakeNames: Record<string, Array<{ address: string; family: 4 | 6 }>> = {
  "gpu-box.test": [{ address: "192.168.1.20", family: 4 }],
  "printer.local": [{ address: "192.168.1.30", family: 4 }],
  // A dual-stack LAN server whose resolver lists its global IPv6 address first.
  "nas.test": [
    { address: "2606:4700:4700::1111", family: 6 },
    { address: "192.168.1.20", family: 4 },
  ],
  // A remote server reached through the well-known NAT64 prefix.
  "nat64.test": [{ address: "64:ff9b::5db8:d822", family: 6 }],
};
// A remote name whose DNS answer changes to loopback once it has been contacted.
let relayContacted = false;
const relayLookups: string[] = [];
(dns as { lookup: unknown }).lookup = async (hostname: string, options: unknown) => {
  if (hostname === "relay.test") {
    const address = relayContacted ? "127.0.0.1" : "93.184.216.34";
    relayLookups.push(address);
    return [{ address, family: 4 }];
  }
  return fakeNames[hostname] ?? originalLookup(hostname, options as never);
};

const llm = { allowLoopback: true, allowMdns: true, allowedProtocols: ["https:", "http:"] };
const policies: Record<string, OutboundUrlPolicy> = {
  "provider fetch": llm,
  "provider fetch with local URLs": { ...llm, allowLocal: true },
  "image fetch": { allowLoopback: true, allowedProtocols: ["https:", "http:"] },
  "image fetch with local URLs": { allowLocal: true, allowLoopback: true, allowedProtocols: ["https:", "http:"] },
};
const localTargets = [
  `http://127.0.0.1:${internalPort}/blocked`,
  `http://localhost:${internalPort}/blocked`,
  "http://[::1]/blocked",
  "http://printer.local/blocked",
  "http://10.0.0.5/blocked",
  "http://169.254.169.254/latest/meta-data/",
];

try {
  for (const [name, policy] of Object.entries(policies)) {
    for (const [index, target] of localTargets.entries()) {
      const start = `${REMOTE}/v1/chat/completions?${index}`;
      remoteRedirects.set(start, target);
      remoteHits.length = 0;
      await assert.rejects(
        safeFetch(start, { method: "POST", body: "{}", policy }),
        /Refused to fetch/,
        `${name}: a remote redirect to ${target} is refused`,
      );
      assert.deepEqual(remoteHits, [start], `${name}: ${target} is never requested`);
    }

    remoteRedirects.set(`${REMOTE}/same`, "/final");
    assert.equal(await (await safeFetch(`${REMOTE}/same`, { policy })).text(), "remote", `${name}: same origin`);
    remoteRedirects.set(`${REMOTE}/cdn`, "https://93.184.216.35/image.png");
    assert.equal(await (await safeFetch(`${REMOTE}/cdn`, { policy })).text(), "remote", `${name}: remote to remote`);

    const localHop = `http://localhost:${new URL(hop.origin).port}/`;
    assert.equal(await (await safeFetch(localHop, { policy })).text(), "internal", `${name}: local to local`);
  }

  // A local-network server named through DNS may still redirect within the local network.
  remoteRedirects.set("http://gpu-box.test/", "https://192.168.1.20/v1");
  const lan = await safeFetch("http://gpu-box.test/", { policy: policies["provider fetch with local URLs"] });
  assert.equal(await lan.text(), "remote", "a local-network host redirects within the local network");
  remoteRedirects.set("http://nas.test:11434/v1/models", "https://nas.test:11434/v1/models");
  const dualStack = await safeFetch("http://nas.test:11434/v1/models", {
    policy: policies["provider fetch with local URLs"],
  });
  assert.equal(await dualStack.text(), "remote", "a dual-stack local-network host redirects to itself");

  // With local URLs on, a remote hop is judged by the address it was reached at, not by a later lookup.
  for (const [index, name] of ["provider fetch with local URLs", "image fetch with local URLs"].entries()) {
    for (const host of ["relay.test", "nat64.test"]) {
      const start = `http://${host}/v1/chat/completions?${index}`;
      remoteRedirects.set(start, `http://127.0.0.1:${internalPort}/blocked`);
      relayContacted = false;
      relayLookups.length = 0;
      await assert.rejects(
        safeFetch(start, { method: "POST", body: "{}", policy: policies[name] }),
        /Refused to fetch/,
        `${name}: ${host} cannot redirect to loopback`,
      );
      if (host === "relay.test") assert.deepEqual(relayLookups, ["93.184.216.34"], `${name}: ${host} resolves once`);
    }
  }

  remoteRedirects.set(`${REMOTE}/llm`, `http://127.0.0.1:${internalPort}/blocked`);
  await assert.rejects(llmFetch(`${REMOTE}/llm`, { method: "POST", body: "{}" }), /Refused to fetch/);

  assert.deepEqual(loopbackHits, ["/ok", "/ok", "/ok", "/ok"], "only local-to-local redirects reach loopback");
} finally {
  globalThis.fetch = originalFetch;
  (dns as { lookup: unknown }).lookup = originalLookup;
  await Promise.all([internal, hop].map(({ server }) => new Promise((resolve) => server.close(resolve))));
}

console.log("safeFetch redirect local-trust regression passed");

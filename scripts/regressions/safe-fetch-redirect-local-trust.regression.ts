import assert from "node:assert/strict";
import dnsModule, { promises as dns } from "node:dns";
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
  if (["127.0.0.1", "localhost", "filtered-direct.test"].includes(url.hostname)) return originalFetch(input, init);
  remoteHits.push(url.href);
  if (url.hostname === "relay.test") relayContacted = true;
  const location = remoteRedirects.get(url.href);
  return location ? new Response(null, { status: 307, headers: { location } }) : new Response("remote");
}) as typeof fetch;
const originalLookup = dns.lookup;
const fakeNames: Record<string, Array<{ address: string; family: 4 | 6 }>> = {
  "gpu-box.test": [{ address: "192.168.1.20", family: 4 }],
  "printer.local": [{ address: "192.168.1.30", family: 4 }],
  // A local-looking name that DNS answers with a remote address.
  "cloud.local": [{ address: "93.184.216.34", family: 4 }],
  "cloud.internal": [{ address: "93.184.216.34", family: 4 }],
  // A dual-stack LAN server whose resolver lists its global IPv6 address first.
  "nas.test": [
    { address: "2606:4700:4700::1111", family: 6 },
    { address: "192.168.1.20", family: 4 },
  ],
  // Remote servers reached through the well-known NAT64 prefix.
  "nat64.test": [{ address: "64:ff9b::5db8:d822", family: 6 }],
  "nat64-cdn.test": [{ address: "64:ff9b::5db8:d823", family: 6 }],
  // Remote servers behind a VPN app's fake-IP DNS, which answers every name from 198.18.0.0/15.
  "fakeip.test": [{ address: "198.18.0.5", family: 4 }],
  "fakeip-cdn.test": [{ address: "198.18.0.6", family: 4 }],
  // A name a DNS filter answers with the unspecified address.
  "sinkhole.test": [{ address: "0.0.0.0", family: 4 }],
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
  // Names that local DNS cannot answer, as behind a proxy that does the lookups itself.
  if (hostname.startsWith("filtered"))
    throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
  return fakeNames[hostname] ?? originalLookup(hostname, options as never);
};
// A connection that looked the name up again would reach this machine.
const originalCallbackLookup = dnsModule.lookup;
(dnsModule as { lookup: unknown }).lookup = (
  hostname: string,
  options: { all?: boolean },
  callback: (...args: unknown[]) => void,
) => {
  if (hostname !== "filtered-direct.test") return originalCallbackLookup(hostname, options as never, callback as never);
  if (options?.all) callback(null, [{ address: "127.0.0.1", family: 4 }]);
  else callback(null, "127.0.0.1", 4);
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
  `http://[::ffff:127.0.0.1]:${internalPort}/blocked`,
  `http://[::7f00:1]:${internalPort}/blocked`,
  `http://0.0.0.0:${internalPort}/blocked`,
  "http://[64:ff9b::7f00:1]/blocked",
  "http://printer.local/blocked",
  "http://metadata.google.internal/computeMetadata/v1/",
  "http://gpu-box.test/blocked",
  "http://sinkhole.test/blocked",
  "http://10.0.0.5/blocked",
  "http://100.100.100.200/latest/meta-data/",
  "http://[fd00:ec2::254]/latest/meta-data/",
  "http://169.254.169.254/latest/meta-data/",
  "http://[64:ff9b::a9fe:a9fe]/latest/meta-data/",
  // 464XLAT puts 192.0.0.4 on this device; 192.0.0.192 is a cloud metadata endpoint.
  `http://192.0.0.4:${internalPort}/blocked`,
  "http://192.0.0.192/latest/",
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

  // A local-looking name is judged by the address it reached, so a .local name on the local network keeps its trust
  // and one that resolved to a remote address does not. Behind a caller's own dispatcher that address is unknown.
  for (const name of ["provider fetch", "provider fetch with local URLs"]) {
    remoteRedirects.set("http://printer.local/", "https://printer.local/");
    const mdns = await safeFetch("http://printer.local/", { policy: policies[name] });
    assert.equal(await mdns.text(), "remote", `${name}: a .local host on the local network redirects to itself`);
    for (const host of name.includes("local URLs") ? ["cloud.local", "cloud.internal"] : ["cloud.local"]) {
      remoteRedirects.set(`http://${host}/`, `http://127.0.0.1:${internalPort}/blocked`);
      await assert.rejects(
        safeFetch(`http://${host}/`, { policy: policies[name] }),
        /Refused to fetch/,
        `${name}: ${host} on a remote address cannot redirect to loopback`,
      );
    }
  }
  remoteRedirects.set("http://printer.local/via-dispatcher", `http://127.0.0.1:${internalPort}/blocked`);
  await assert.rejects(
    safeFetch("http://printer.local/via-dispatcher", {
      policy: policies["provider fetch with local URLs"],
      dispatcher: {},
    }),
    /Refused to fetch/,
    "a hop sent through a caller's dispatcher is not trusted as local",
  );

  // With local URLs on, a remote hop is judged by the address it was reached at, not by a later lookup.
  for (const [index, name] of ["provider fetch with local URLs", "image fetch with local URLs"].entries()) {
    for (const host of ["relay.test", "nat64.test", "fakeip.test"]) {
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

  // Only the built-in local ranges count: a public range trusted for sign-in stays remote, while a server
  // configured on the unspecified address is this machine.
  const trustedNetworks = process.env.TRUSTED_PRIVATE_NETWORKS;
  process.env.TRUSTED_PRIVATE_NETWORKS = "10.0.0.0/8,93.184.216.0/24";
  try {
    for (const name of ["provider fetch with local URLs", "image fetch with local URLs"]) {
      remoteRedirects.set(`${REMOTE}/trusted`, `http://127.0.0.1:${internalPort}/blocked`);
      await assert.rejects(
        safeFetch(`${REMOTE}/trusted`, { policy: policies[name] }),
        /Refused to fetch/,
        `${name}: a remote hop in TRUSTED_PRIVATE_NETWORKS cannot redirect to loopback`,
      );
    }
  } finally {
    if (trustedNetworks === undefined) delete process.env.TRUSTED_PRIVATE_NETWORKS;
    else process.env.TRUSTED_PRIVATE_NETWORKS = trustedNetworks;
  }
  remoteRedirects.set("http://0.0.0.0:5001/", `${internal.origin}/ok`);
  const unspecified = await safeFetch("http://0.0.0.0:5001/", { policy: policies["provider fetch with local URLs"] });
  assert.equal(await unspecified.text(), "internal", "a server on 0.0.0.0 redirects to loopback");

  // A remote service behind VPN fake-IP DNS or NAT64 answers from a reserved range. With local URLs its redirect to
  // another such service is followed, like the first request; without them the deny-list still refuses both.
  for (const host of ["fakeip", "nat64"]) {
    const start = `http://${host}.test/v1/models`;
    const cdn = `https://${host}-cdn.test/v1/models`;
    remoteRedirects.set(start, cdn);
    remoteRedirects.set(`${REMOTE}/to-${host}`, cdn);
    for (const [name, policy] of Object.entries(policies)) {
      remoteHits.length = 0;
      if (policy.allowLocal) {
        assert.equal(await (await safeFetch(start, { policy })).text(), "remote", `${name}: ${host} to ${host}-cdn`);
        assert.deepEqual(remoteHits, [start, cdn], `${name}: both ${host} services are requested`);
      } else {
        await assert.rejects(safeFetch(start, { policy }), /Refused to fetch/, `${name}: ${host}.test is refused`);
        await assert.rejects(
          safeFetch(`${REMOTE}/to-${host}`, { policy }),
          /Refused to fetch/,
          `${name}: a redirect to ${host}-cdn.test is refused`,
        );
        assert.deepEqual(remoteHits, [`${REMOTE}/to-${host}`], `${name}: ${host}-cdn.test is never requested`);
      }
    }
  }

  // llmFetch builds the provider policy from PROVIDER_LOCAL_URLS_ENABLED, with loopback and mDNS always allowed.
  const providerLocalUrls = process.env.PROVIDER_LOCAL_URLS_ENABLED;
  try {
    for (const localUrls of ["true", "false"]) {
      process.env.PROVIDER_LOCAL_URLS_ENABLED = localUrls;
      const label = `llmFetch with PROVIDER_LOCAL_URLS_ENABLED=${localUrls}`;
      for (const start of [`${REMOTE}/llm`, "http://fakeip.test/llm"]) {
        remoteRedirects.set(start, `http://127.0.0.1:${internalPort}/blocked`);
        await assert.rejects(
          llmFetch(start, { method: "POST", body: "{}" }),
          /Refused to fetch/,
          `${label}: ${start} cannot redirect to loopback`,
        );
      }
      remoteHits.length = 0;
      const fakeIp = llmFetch("http://fakeip.test/v1/models");
      if (localUrls === "true") {
        assert.equal(await (await fakeIp).text(), "remote", `${label}: fake-IP to fake-IP`);
        assert.deepEqual(
          remoteHits,
          ["http://fakeip.test/v1/models", "https://fakeip-cdn.test/v1/models"],
          `${label}: the fake-IP redirect is followed`,
        );
      } else {
        await assert.rejects(fakeIp, /Refused to fetch/, `${label}: fake-IP stays refused`);
        assert.deepEqual(remoteHits, [], `${label}: fake-IP is never requested`);
      }
    }
  } finally {
    if (providerLocalUrls === undefined) delete process.env.PROVIDER_LOCAL_URLS_ENABLED;
    else process.env.PROVIDER_LOCAL_URLS_ENABLED = providerLocalUrls;
  }

  // Behind an env proxy a hop's address is unknown, so it counts as remote. Its redirect to a name local DNS cannot
  // answer is left to the proxy, which looks names up itself, while a local answer is still refused. Sent direct, such
  // a name is refused: before the request, or at connect time for a NO_PROXY host, which is never looked up again.
  const proxyVars = [
    "NODE_USE_ENV_PROXY",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "no_proxy",
  ];
  const savedProxyEnv = proxyVars.map((key) => [key, process.env[key]] as const);
  const withLocalUrls = policies["provider fetch with local URLs"];
  try {
    for (const key of proxyVars) delete process.env[key];
    remoteRedirects.set("http://fakeip.test/proxied", "https://filtered.test/v1/models");
    await assert.rejects(
      safeFetch("http://fakeip.test/proxied", { policy: withLocalUrls }),
      /did not resolve/,
      "without a proxy, a redirect target that does not resolve is refused",
    );

    process.env.NODE_USE_ENV_PROXY = "1";
    // Never contacted: requests to the remote fixtures do not reach the network.
    process.env.HTTP_PROXY = "http://127.0.0.1:9";
    remoteHits.length = 0;
    const proxied = await safeFetch("http://fakeip.test/proxied", { policy: withLocalUrls });
    assert.equal(await proxied.text(), "remote", "behind a proxy, a redirect target that does not resolve is followed");
    assert.deepEqual(remoteHits, ["http://fakeip.test/proxied", "https://filtered.test/v1/models"]);
    for (const target of ["http://sinkhole.test/blocked", "http://gpu-box.test/blocked", "http://printer.local/x"]) {
      remoteRedirects.set("http://fakeip.test/proxied-local", target);
      await assert.rejects(
        safeFetch("http://fakeip.test/proxied-local", { policy: withLocalUrls }),
        /Refused to fetch/,
        `behind a proxy, a redirect to ${target} is refused`,
      );
    }

    process.env.NO_PROXY = "filtered-direct.test";
    remoteRedirects.set("http://fakeip.test/no-proxy", `http://filtered-direct.test:${internalPort}/blocked`);
    await assert.rejects(
      safeFetch("http://fakeip.test/no-proxy", { policy: withLocalUrls }),
      (error: Error) => /did not resolve/.test(String((error.cause as Error | undefined)?.message ?? error.message)),
      "a NO_PROXY redirect target that did not resolve is not looked up again at connect time",
    );
  } finally {
    for (const [key, value] of savedProxyEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  assert.deepEqual(loopbackHits, ["/ok", "/ok", "/ok", "/ok", "/ok"], "only local-to-local redirects reach loopback");
} finally {
  globalThis.fetch = originalFetch;
  (dns as { lookup: unknown }).lookup = originalLookup;
  (dnsModule as { lookup: unknown }).lookup = originalCallbackLookup;
  await Promise.all([internal, hop].map(({ server }) => new Promise((resolve) => server.close(resolve))));
}

console.log("safeFetch redirect local-trust regression passed");

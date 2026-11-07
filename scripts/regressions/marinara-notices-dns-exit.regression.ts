// #8948: a pending notices lookup must never delay Restart Server. Node's getaddrinfo runs on the libuv threadpool and
// process.exit() waits for it, so a stalled system resolver held the restart for up to ~30 s. The notices fetch now
// resolves its host with c-ares, on the event loop. Each child server asks for Restart Server (exit 75) while its
// notices lookup is in flight and getaddrinfo is stalled (fixtures/stalled-resolver.mjs); the control child makes the
// old call and must be held, which proves the stall is real. Its DNS server drops AAAA queries, as some routers do, so the
// notice must load from the A answer alone. Through Node's env proxy, the proxy's own name is looked up with c-ares too.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createSocket } from "node:dgram";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { adminRoutes } from "../../packages/server/src/routes/admin.routes.js";
import { hostsFileAddresses, noticesRoutes } from "../../packages/server/src/routes/notices.routes.js";
import { APP_VERSION } from "../../packages/shared/src/constants/defaults.js";

const HOST = "notices.marinara.test";
const PROXY_HOST = "proxy.marinara.test";
const STALL_MS = 4_000;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function until(check: () => boolean | Promise<boolean>, what: string) {
  for (let i = 0; i < 400; i++) {
    if (await check()) return;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

async function noticeCount(app: ReturnType<typeof Fastify>) {
  const res = await app.inject({
    method: "GET",
    url: "/api/notices",
    remoteAddress: "127.0.0.1",
    headers: { host: "127.0.0.1:7860" },
  });
  return (res.json() as { notices: unknown[] }).notices.length;
}

if (process.argv[2] === "child") {
  const stallLog = process.env.STALL_LOG!;
  const log = (event: string) => appendFileSync(stallLog, `${Date.now()} ${event}\n`);
  const app = Fastify();
  await app.register(adminRoutes, { prefix: "/api/admin" });
  if (process.env.NOTICES_MODE === "control") {
    // The call notices.routes.ts made before #8948.
    void fetch(process.env.MARINARA_NOTICES_URL!, { redirect: "error", signal: AbortSignal.timeout(10_000) }).catch(
      () => undefined,
    );
  } else {
    await app.register(noticesRoutes, { prefix: "/api/notices" });
  }
  await app.ready();
  await until(() => /getaddrinfo-stalled|c-ares-resolve4/.test(readFileSync(stallLog, "utf8")), "the notices lookup");
  if (process.env.EXPECT_NOTICE) {
    await until(async () => (await noticeCount(app)) === 1, "the notice");
    log("notice-loaded");
  }
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/restart",
    payload: { confirm: true },
    remoteAddress: "127.0.0.1",
    headers: { host: "127.0.0.1:7860" },
  });
  // admin.routes.ts closes the app and calls process.exit(75) 750 ms later.
  log(`restart-${res.statusCode}`);
} else if (process.platform === "win32") {
  console.info("Notices DNS exit regression skipped: the stalled resolver needs a POSIX FIFO.");
} else {
  const root = resolve(import.meta.dirname, "../..");
  const dir = mkdtempSync(join(tmpdir(), "marinara-notices-dns-"));
  const notice = {
    id: "dns-exit",
    level: "warning",
    versions: `=${APP_VERSION}`,
    title: "Notice",
    text: "Loaded through the notices lookup.",
    action: "None.",
    expires: "2999-12-31",
  };
  const fileServer = createServer((_req, res) => res.end(JSON.stringify([notice])));
  // A DNS server that answers A queries with 127.0.0.1 and drops every other query. c-ares retries a dropped AAAA query
  // for ~28 s, so the notice loads only if the lookup does not wait for it.
  const dnsServer = createSocket("udp4");
  dnsServer.on("message", (query, peer) => {
    let end = 12;
    while (query[end]) end += query[end]! + 1;
    if (query.readUInt16BE(end + 1) !== 1) return;
    const header = Buffer.from([query[0]!, query[1]!, 0x81, 0x80, 0, 1, 0, 1, 0, 0, 0, 0]);
    const answer = Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 127, 0, 0, 1]);
    dnsServer.send(Buffer.concat([header, query.subarray(12, end + 5), answer]), peer.port, peer.address);
  });
  // A DNS server that never answers, as a stalled resolver does.
  const silentDnsServer = createSocket("udp4");
  const tunnels: string[] = [];
  const proxy = createServer((_req, res) => res.writeHead(405).end());
  proxy.on("connect", (req, socket) => {
    tunnels.push(req.url ?? "");
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    fileServer.emit("connection", socket);
  });
  await Promise.all([
    new Promise<void>((done) => fileServer.listen(0, "127.0.0.1", done)),
    new Promise<void>((done) => proxy.listen(0, "127.0.0.1", done)),
    new Promise<void>((done) => dnsServer.bind(0, "127.0.0.1", done)),
    new Promise<void>((done) => silentDnsServer.bind(0, "127.0.0.1", done)),
  ]);
  const filePort = (fileServer.address() as AddressInfo).port;
  const noticesUrl = `http://${HOST}:${filePort}/notices.json`;
  const proxyEnv = [
    "http_proxy",
    "https_proxy",
    "no_proxy",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "NODE_USE_ENV_PROXY",
  ];
  writeFileSync(join(dir, ".env"), "");
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MARINARA_ENV_FILE: join(dir, ".env"),
    DATA_DIR: join(dir, "data"),
    FILE_STORAGE_DIR: join(dir, "data", "storage"),
    MARINARA_RESTART_SUPERVISOR: String(process.pid),
    MARINARA_NOTICES_URL: noticesUrl,
    STALL_HOST: HOST,
    STALL_MS: String(STALL_MS),
  };
  for (const key of [...proxyEnv, "MARINARA_DOCKER", "MARINARA_DOCKER_USER", "MARINARA_DOCKER_GROUP"]) {
    delete childEnv[key];
  }
  const tsx = pathToFileURL(createRequire(join(root, "packages/server/package.json")).resolve("tsx/esm")).href;
  const stalledResolver = pathToFileURL(join(root, "scripts/regressions/fixtures/stalled-resolver.mjs")).href;

  const restartDuringLookup = async (name: string, env: NodeJS.ProcessEnv) => {
    const stallLog = join(dir, `${name}.log`);
    writeFileSync(stallLog, "");
    const child = spawn(
      process.execPath,
      ["--import", stalledResolver, "--import", tsx, fileURLToPath(import.meta.url), "child"],
      { cwd: join(root, "packages/server"), env: { ...childEnv, ...env, STALL_LOG: stallLog }, stdio: "pipe" },
    );
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    const code = await new Promise<number | null>((done) => child.on("exit", (exitCode) => done(exitCode)));
    const goneAt = Date.now();
    const events = new Map<string, number>();
    for (const line of readFileSync(stallLog, "utf8").trim().split("\n")) {
      const [at, event] = line.split(" ");
      events.set(event!, Number(at));
    }
    assert.equal(code, 75, `${name}: Restart Server exits 75\n${output}`);
    assert.ok(events.has("restart-202"), `${name}: Restart Server was accepted\n${output}`);
    return { events, goneAt, output, exitMs: goneAt - events.get("exit")! };
  };

  try {
    const answeringDns = `127.0.0.1:${(dnsServer.address() as AddressInfo).port}`;
    const [control, silent, answered, proxied] = await Promise.all([
      restartDuringLookup("control", { NOTICES_MODE: "control" }),
      restartDuringLookup("silent", {
        STALL_DNS_SERVER: `127.0.0.1:${(silentDnsServer.address() as AddressInfo).port}`,
      }),
      restartDuringLookup("answered", { STALL_DNS_SERVER: answeringDns, EXPECT_NOTICE: "1" }),
      // The notices host is never looked up here (the proxy tunnels to it); the proxy's own name is, and it stalls.
      restartDuringLookup("proxied", {
        STALL_HOST: PROXY_HOST,
        STALL_DNS_SERVER: answeringDns,
        NODE_USE_ENV_PROXY: "1",
        HTTP_PROXY: `http://${PROXY_HOST}:${(proxy.address() as AddressInfo).port}`,
        EXPECT_NOTICE: "1",
      }),
    ]);

    assert.ok(control.events.has("getaddrinfo-stalled"), "control: the old fetch used getaddrinfo");
    assert.ok(
      control.goneAt - control.events.get("getaddrinfo-stalled")! >= STALL_MS - 250,
      `control: process.exit() waited for the stalled getaddrinfo (gone ${control.exitMs} ms after exit)`,
    );
    for (const [name, run] of [
      ["silent", silent],
      ["answered", answered],
      ["proxied", proxied],
    ] as const) {
      assert.ok(!run.events.has("getaddrinfo-stalled"), `${name}: the notices fetch never calls getaddrinfo`);
      assert.ok(run.events.has("c-ares-resolve4"), `${name}: the notices host is resolved with c-ares`);
      assert.ok(run.exitMs < 1_500, `${name}: process gone ${run.exitMs} ms after process.exit()\n${run.output}`);
    }
    assert.ok(
      ![...silent.events.keys()].some((event) => event.startsWith("c-ares-resolve4-")),
      "silent: the c-ares lookup was still pending at exit",
    );
    for (const [name, run] of [
      ["answered", answered],
      ["proxied", proxied],
    ] as const) {
      const loadMs = run.events.get("notice-loaded")! - run.events.get("c-ares-resolve4")!;
      assert.ok(
        run.events.get("c-ares-resolve4-answered")! < run.events.get("notice-loaded")!,
        `${name}: c-ares answered`,
      );
      assert.ok(!run.events.has("c-ares-resolve6-answered"), `${name}: the AAAA query was dropped`);
      assert.ok(
        loadMs < 4_000,
        `${name}: the notice loaded ${loadMs} ms after the lookup, without the dropped AAAA query`,
      );
    }
    assert.deepEqual(tunnels, [`${HOST}:${filePort}`], "proxied: the notices fetch tunnels through the env proxy");

    // The hosts file still applies, as it does for getaddrinfo.
    const hostsFile = [
      "127.0.0.1 localhost",
      "185.199.108.133 raw.githubusercontent.com # pinned where DNS is blocked\r",
      "# 10.0.0.1 raw.githubusercontent.com",
      "2606:50c0:8000::154\tRAW.githubusercontent.com other",
      "not-an-ip raw.githubusercontent.com",
    ].join("\n");
    assert.deepEqual(hostsFileAddresses(hostsFile, "raw.githubusercontent.com"), [
      { address: "185.199.108.133", family: 4 },
      { address: "2606:50c0:8000::154", family: 6 },
    ]);
    assert.deepEqual(hostsFileAddresses(hostsFile, "github.com"), []);

    // A malformed env proxy URL (no scheme, as copied from a proxy app) makes that refresh fail with a warning. It must
    // not reject: the server exits on an unhandled rejection.
    const savedEnv = Object.fromEntries(
      [...proxyEnv, "MARINARA_NOTICES_URL", "MARINARA_NOTICES_ENABLED"].map((key) => [key, process.env[key]]),
    );
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    for (const key of proxyEnv) delete process.env[key];
    delete process.env.MARINARA_NOTICES_ENABLED;
    process.env.NODE_USE_ENV_PROXY = "1";
    process.env.MARINARA_NOTICES_URL = noticesUrl;
    try {
      for (const malformed of ["127.0.0.1:10809", "proxy.corp:3128"]) {
        process.env.HTTP_PROXY = malformed;
        const app = Fastify();
        await app.register(noticesRoutes, { prefix: "/api/notices" });
        await app.ready();
        await sleep(100);
        await app.close();
      }
      assert.deepEqual(rejections, [], "a malformed env proxy never rejects the notices refresh");
    } finally {
      process.off("unhandledRejection", onRejection);
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }

    console.info(
      `Notices DNS exit regressions passed: with getaddrinfo stalled, the old fetch held process.exit() for ${control.exitMs} ms; ` +
        `the notices fetch exited in ${silent.exitMs} ms (c-ares pending), ${answered.exitMs} ms (notice loaded) and ` +
        `${proxied.exitMs} ms (through a proxy named by host). With AAAA dropped, the notice loaded ` +
        `${answered.events.get("notice-loaded")! - answered.events.get("c-ares-resolve4")!} ms after the lookup began.`,
    );
  } finally {
    fileServer.closeAllConnections();
    fileServer.close();
    proxy.close();
    dnsServer.close();
    silentDnsServer.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

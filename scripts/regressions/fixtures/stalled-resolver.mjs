// Test-only stand-in for a stalled system resolver (#8948), loaded with --import. A getaddrinfo() lookup of
// STALL_HOST parks one libuv threadpool thread in open() of a FIFO that a helper opens only after STALL_MS, as an
// unanswered getaddrinfo() holds one, so process.exit() waits for it. c-ares (dns.Resolver) queries for STALL_HOST
// go to the regression's DNS server, STALL_DNS_SERVER. Each step is appended to STALL_LOG with its time.
import dns from "node:dns";
import { appendFileSync, close, open } from "node:fs";
import { execFileSync, spawn } from "node:child_process";

const { STALL_HOST, STALL_MS, STALL_LOG, STALL_DNS_SERVER } = process.env;
const log = (event) => appendFileSync(STALL_LOG, `${Date.now()} ${event}\n`);
const lookup = dns.lookup;
let stalls = 0;

dns.lookup = function (host, ...rest) {
  if (host === STALL_HOST) {
    const fifo = `${STALL_LOG}.fifo${++stalls}`;
    execFileSync("mkfifo", [fifo]);
    // Read-write open never blocks, so the helper cannot hang if this process is already gone.
    spawn("sh", ["-c", `sleep ${Number(STALL_MS) / 1000}; exec 3<>"$0"`, fifo], {
      detached: true,
      stdio: "ignore",
    }).unref();
    open(fifo, "r", (err, fd) => {
      if (!err) close(fd, () => {});
    });
    log("getaddrinfo-stalled");
  }
  return lookup.call(this, host, ...rest);
};

// A resolver's servers cannot change while it has a query pending, so each is pointed at the DNS server once.
const pointed = new WeakSet();
for (const method of ["resolve4", "resolve6"]) {
  const resolve = dns.promises.Resolver.prototype[method];
  dns.promises.Resolver.prototype[method] = function (host, ...rest) {
    if (host !== STALL_HOST) return resolve.call(this, host, ...rest);
    if (!pointed.has(this)) this.setServers([STALL_DNS_SERVER]);
    pointed.add(this);
    log(`c-ares-${method}`);
    const answer = resolve.call(this, host, ...rest);
    answer.then(
      () => log(`c-ares-${method}-answered`),
      (err) => log(`c-ares-${method}-${err.code}`),
    );
    return answer;
  };
}

process.on("exit", () => log("exit"));

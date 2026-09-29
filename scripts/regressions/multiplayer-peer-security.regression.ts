import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCACertificates, setDefaultCACertificates } from "node:tls";
import {
  MULTIPLAYER_LIMITS,
  multiplayerActionSchema,
  multiplayerInviteSchema,
  multiplayerPeerResponseSchema,
  parseMultiplayerJson,
  type MultiplayerInvite,
  type MultiplayerPeerRequest,
} from "../../packages/shared/src/schemas/multiplayer.schema.js";
import { requestMultiplayerPeer } from "../../packages/server/src/services/multiplayer/peer-client.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-multiplayer-tls-"));
const previousTrust = getCACertificates("default");
const run = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
let requests = 0;
let bodies: string[] = [];
let behavior: "valid" | "redirect" | "oversize" | "unknown" | "version" | "encoding" | "hang" = "valid";

try {
  run(
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "2",
    "-subj",
    "/CN=Multiplayer regression CA",
    "-keyout",
    "ca.key",
    "-out",
    "ca.pem",
  );
  run(
    "req",
    "-new",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-subj",
    "/CN=localhost",
    "-keyout",
    "host.key",
    "-out",
    "host.csr",
  );
  writeFileSync(
    join(dir, "host.ext"),
    "subjectAltName=DNS:localhost\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n",
  );
  run(
    "x509",
    "-req",
    "-in",
    "host.csr",
    "-CA",
    "ca.pem",
    "-CAkey",
    "ca.key",
    "-CAcreateserial",
    "-days",
    "2",
    "-extfile",
    "host.ext",
    "-out",
    "host.pem",
  );
  const cert = readFileSync(join(dir, "host.pem"));
  const server = createServer({ cert, key: readFileSync(join(dir, "host.key")) }, (request, response) => {
    requests += 1;
    assert.equal(request.url, "/room");
    assert.equal(request.method, "POST");
    assert.equal(request.headers.cookie, undefined);
    assert.equal(request.headers["x-marinara-admin-secret"], undefined);
    assert.equal(request.headers.origin, undefined);
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      bodies.push(body);
      if (behavior === "hang") return;
      if (behavior === "redirect") {
        response.writeHead(302, { location: "/api/admin" });
        response.end();
        return;
      }
      response.writeHead(200, {
        "content-type": "application/json",
        ...(behavior === "encoding" ? { "content-encoding": "gzip" } : {}),
      });
      const payload = {
        type: "admission",
        version: behavior === "version" ? 2 : 1,
        session: "s".repeat(43),
        ...(behavior === "unknown" ? { execute: "native-download" } : {}),
      };
      response.end(
        behavior === "oversize" ? " ".repeat(MULTIPLAYER_LIMITS.snapshotBytes + 1) : JSON.stringify(payload),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  const invitation: MultiplayerInvite = {
    version: 1,
    origin: `https://localhost:${port}`,
    roomId: "room_12345678",
    invite: "i".repeat(43),
    fingerprint: new X509Certificate(cert).fingerprint256.replace(/:/gu, "").toLowerCase(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  for (const origin of [
    "not a URL",
    "https://[",
    "http://localhost",
    "https://name:password@localhost",
    "https://localhost/private",
    "https://localhost/?secret",
    "https://localhost/#fragment",
  ]) {
    assert.equal(
      multiplayerInviteSchema.safeParse({ ...invitation, origin }).success,
      false,
      "invalid invitation origins return validation failure without throwing or networking",
    );
  }
  const input: MultiplayerPeerRequest = {
    version: 1,
    type: "join",
    roomId: invitation.roomId,
    invite: invitation.invite,
    password: "local-fixture-password",
    displayName: "Guest",
    persona: { name: "Rowan", description: "A traveller." },
  };

  try {
    await assert.rejects(requestMultiplayerPeer(invitation, input), /certificate|issuer|self.signed/iu);
    assert.equal(requests, 0, "untrusted certificate receives no HTTP request or password");
    setDefaultCACertificates([...previousTrust, readFileSync(join(dir, "ca.pem"), "utf8")]);
    await assert.rejects(
      requestMultiplayerPeer({ ...invitation, fingerprint: "0".repeat(64) }, input),
      /identity changed/u,
    );
    assert.equal(requests, 0, "wrong fingerprint receives no HTTP request or password");
    await assert.rejects(
      requestMultiplayerPeer({ ...invitation, origin: `https://127.0.0.1:${port}` }, input),
      /IP|certificate|altname/iu,
    );
    assert.equal(requests, 0, "wrong hostname receives no HTTP request or password");

    assert.equal((await requestMultiplayerPeer(invitation, input)).type, "admission");
    assert.equal(requests, 1);
    assert.equal(JSON.parse(bodies[0]!).password, input.password);
    await assert.rejects(
      requestMultiplayerPeer({ ...invitation, fingerprint: "0".repeat(64) }, input),
      /identity changed/u,
    );
    assert.equal(requests, 1, "earlier valid connection cannot bypass a new fingerprint check");

    for (const invalid of ["redirect", "oversize", "unknown", "version", "encoding"] as const) {
      behavior = invalid;
      const before = requests;
      await assert.rejects(requestMultiplayerPeer(invitation, input));
      assert.equal(requests, before + 1, `${invalid} must not cause a redirect or fallback request`);
    }
    behavior = "hang";
    await assert.rejects(requestMultiplayerPeer(invitation, input, { signal: AbortSignal.timeout(50) }), /abort/iu);

    const before = requests;
    await assert.rejects(requestMultiplayerPeer({ ...invitation, origin: `http://localhost:${port}` }, input));
    await assert.rejects(requestMultiplayerPeer(invitation, { ...input, roomId: "other_room_123" }));
    await assert.rejects(requestMultiplayerPeer(invitation, input, { session: "invalid\r\nCookie: leak" }));
    assert.equal(requests, before, "invalid local input is rejected before networking");
    assert.equal(
      multiplayerActionSchema.safeParse({ type: "download", operationId: "operation_123", url: "file:///private" })
        .success,
      false,
    );
    assert.equal(
      multiplayerActionSchema.safeParse({
        type: "message",
        operationId: "operation_123",
        text: "hi",
        participantId: "other_player",
      }).success,
      false,
    );
    assert.throws(
      () => parseMultiplayerJson("[".repeat(300_000), multiplayerPeerResponseSchema, MULTIPLAYER_LIMITS.snapshotBytes),
      /size limit/u,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
} finally {
  bodies = [];
  setDefaultCACertificates(previousTrust);
  rmSync(dir, { recursive: true, force: true });
}

console.info("Multiplayer TLS, bounded transport and protocol security regressions passed.");

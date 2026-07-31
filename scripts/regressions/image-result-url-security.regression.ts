import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolveImageResultUrlPolicy } from "../../packages/server/src/services/image/image-generation.js";
import { safeFetch } from "../../packages/server/src/utils/security.js";

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return (server.address() as AddressInfo).port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

const publicResult = await resolveImageResultUrlPolicy("https://93.184.216.34/image.png");
assert.deepEqual(publicResult, {
  url: "https://93.184.216.34/image.png",
  allowLocal: false,
  allowLoopback: false,
});

await assert.rejects(
  resolveImageResultUrlPolicy("http://169.254.169.254/latest/meta-data"),
  /private|loopback|metadata|reserved/i,
);

const secondServer = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "image/png" });
  response.end("second origin");
});
const secondPort = await listen(secondServer);

const firstServer = createServer((request, response) => {
  if (request.url === "/redirect-same") {
    response.writeHead(302, { location: "/image.png" });
    response.end();
    return;
  }
  if (request.url === "/redirect-other") {
    response.writeHead(302, { location: `http://127.0.0.1:${secondPort}/image.png` });
    response.end();
    return;
  }
  response.writeHead(200, { "content-type": "image/png" });
  response.end("first origin");
});
const firstPort = await listen(firstServer);
const firstOrigin = `http://127.0.0.1:${firstPort}`;
const secondOrigin = `http://127.0.0.1:${secondPort}`;

try {
  const exactLocalResult = await resolveImageResultUrlPolicy(
    `${firstOrigin}/image.png`,
    `http://localhost:${firstPort}/v1`,
  );
  assert.deepEqual(exactLocalResult, {
    url: `${firstOrigin}/image.png`,
    allowLocal: true,
    allowLoopback: true,
    allowedOrigins: [firstOrigin],
  });

  await assert.rejects(
    resolveImageResultUrlPolicy(`${secondOrigin}/image.png`, firstOrigin),
    /private|loopback|metadata|reserved/i,
    "a different private port must not inherit provider trust",
  );
  await assert.rejects(
    resolveImageResultUrlPolicy(`https://127.0.0.1:${firstPort}/image.png`, firstOrigin),
    /private|loopback|metadata|reserved/i,
    "a different scheme must not inherit provider trust",
  );

  const sameOriginResponse = await safeFetch(`${firstOrigin}/redirect-same`, {
    policy: {
      allowLocal: true,
      allowedOrigins: [firstOrigin],
      allowedProtocols: ["http:"],
    },
  });
  assert.equal(await sameOriginResponse.text(), "first origin");

  await assert.rejects(
    safeFetch(`${firstOrigin}/redirect-other`, {
      policy: {
        allowLocal: true,
        allowedOrigins: [firstOrigin],
        allowedProtocols: ["http:"],
      },
    }),
    /origin .* is not allowed/i,
    "redirects from the approved provider must remain on its exact origin",
  );
} finally {
  await Promise.all([close(firstServer), close(secondServer)]);
}

console.info("Image result URL security regressions passed.");

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import {
  androidLocalAuthHook,
  androidLocalAuthInjectHeaders,
  androidLocalAuthRoutes,
  androidLocalAuthTesting,
  androidLocalLoginRoute,
  isAndroidLocalAuthSatisfied,
} from "../../packages/server/src/middleware/android-local-auth.js";
import { csrfProtectionHook } from "../../packages/server/src/middleware/csrf-protection.js";

const originalSecret = process.env.MARINARA_ANDROID_SECRET;
const originalCsrfTrustedOrigins = process.env.CSRF_TRUSTED_ORIGINS;
const secret = "11".repeat(32);
process.env.MARINARA_ANDROID_SECRET = secret;
process.env.CSRF_TRUSTED_ORIGINS = "null";
androidLocalAuthTesting.clear();

const app = Fastify();
app.addHook("onRequest", csrfProtectionHook);
app.addHook("onRequest", androidLocalAuthHook);
await app.register(androidLocalAuthRoutes, { prefix: "/api/android-auth" });
await androidLocalLoginRoute(app);
app.get("/", async () => ({ ok: true }));
// Mirrors app.ts: the probe stays public, the local model and GPU details need the app's own sign-in.
app.get("/api/health", async (request) => ({ status: "ok", detailed: isAndroidLocalAuthSatisfied(request) }));
app.get("/api/private", async () => ({ private: true }));
app.post("/api/private-mutation", async () => ({ mutated: true }));
app.get("/api/spotify/callback", async () => ({ callback: true }));

try {
  await app.ready();

  const rejected = await app.inject({ method: "GET", url: "/api/private" });
  assert.equal(rejected.statusCode, 401, "an unrelated localhost caller must not inherit loopback trust");
  const serverOwnRequest = await app.inject({
    method: "POST",
    url: "/api/private-mutation",
    headers: androidLocalAuthInjectHeaders(),
  });
  assert.equal(serverOwnRequest.statusCode, 200, "the server's own injected calls carry the local secret (#7475)");

  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200, "local readiness checks must remain available without a browser session");
  assert.equal(health.json().detailed, false, "another app on the device must not read the health details");

  const spotifyCallback = await app.inject({
    method: "GET",
    url: "/api/spotify/callback?state=pending-state&code=authorization-code",
  });
  assert.equal(spotifyCallback.statusCode, 200, "Spotify's state-bound OAuth callback must remain reachable");
  const unboundSpotifyCallback = await app.inject({ method: "GET", url: "/api/spotify/callback?code=missing-state" });
  assert.equal(unboundSpotifyCallback.statusCode, 401, "an OAuth callback without state must not bypass local auth");

  const browserRedirect = await app.inject({ method: "GET", url: "/", headers: { accept: "text/html" } });
  assert.equal(browserRedirect.statusCode, 303);
  assert.equal(browserRedirect.headers.location, "/android-login");

  const login = await app.inject({ method: "GET", url: "/android-login" });
  assert.equal(login.statusCode, 200);
  assert.match(login.body, /Authenticate this local browser/u);

  const clientNonce = "22".repeat(32);
  const challengeResponse = await app.inject({
    method: "POST",
    url: "/api/android-auth/challenge",
    payload: { clientNonce },
  });
  assert.equal(challengeResponse.statusCode, 200);
  const challenge = challengeResponse.json<{ serverNonce: string; proof: string }>();
  assert.equal(
    challenge.proof,
    androidLocalAuthTesting.hmac(secret, `server:${clientNonce}:${challenge.serverNonce}`),
    "the Android wrapper must be able to authenticate the server before loading its WebView",
  );

  const clientProof = androidLocalAuthTesting.hmac(secret, `client:${clientNonce}:${challenge.serverNonce}`);
  const sessionResponse = await app.inject({
    method: "POST",
    url: "/api/android-auth/session",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "null",
      "sec-fetch-site": "none",
    },
    payload: new URLSearchParams({ clientNonce, serverNonce: challenge.serverNonce, proof: clientProof }).toString(),
  });
  assert.equal(
    sessionResponse.statusCode,
    303,
    "the self-authenticating WebView handshake must not require Origin null to be trusted",
  );
  assert.equal(sessionResponse.headers.location, "/");
  const setCookieHeader = sessionResponse.headers["set-cookie"];
  const firstSetCookieHeader = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  const sessionCookie = typeof firstSetCookieHeader === "string" ? firstSetCookieHeader.split(";", 1)[0] : undefined;
  assert.ok(sessionCookie?.startsWith("MarinaraAndroidSession="));

  const accepted = await app.inject({
    method: "GET",
    url: "/api/private",
    headers: { cookie: sessionCookie },
  });
  assert.equal(accepted.statusCode, 200);
  const signedInHealth = await app.inject({ method: "GET", url: "/api/health", headers: { cookie: sessionCookie } });
  assert.equal(signedInHealth.json().detailed, true, "the Android app's own diagnostics keep the health details");
  const remoteHealth = await app.inject({ method: "GET", url: "/api/health", remoteAddress: "192.0.2.77" });
  assert.equal(remoteHealth.json().detailed, true, "LAN callers are left to the normal sign-in rules");

  const replay = await app.inject({
    method: "POST",
    url: "/api/android-auth/session",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({ clientNonce, serverNonce: challenge.serverNonce, proof: clientProof }).toString(),
  });
  assert.equal(replay.statusCode, 401, "a challenge must be one-time use");

  async function browserTicket() {
    const clientNonce = "ab".repeat(32);
    const challenge = (
      await app.inject({ method: "POST", url: "/api/android-auth/challenge", payload: { clientNonce } })
    ).json<{ serverNonce: string }>();
    const response = await app.inject({
      method: "POST",
      url: "/api/android-auth/session",
      payload: {
        clientNonce,
        serverNonce: challenge.serverNonce,
        browser: true,
        proof: androidLocalAuthTesting.hmac(secret, `client:${clientNonce}:${challenge.serverNonce}`),
      },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["set-cookie"],
      undefined,
      "browser handoffs must not authenticate the native HTTP client",
    );
    assert.equal(response.headers["cache-control"], "no-store");
    const ticket = response.json<{ browserTicket: string }>().browserTicket;
    assert.match(ticket, /^[a-f0-9]{64}$/);
    assert.notEqual(ticket, secret, "a handoff must never expose the permanent install secret");
    return ticket;
  }
  const ticket = await browserTicket();
  const handoff = await app.inject({ method: "POST", url: "/api/android-auth/browser-session", payload: { ticket } });
  assert.equal(handoff.statusCode, 303);
  assert.match(String(handoff.headers["set-cookie"]), /HttpOnly; SameSite=Strict/);
  assert.equal(
    (await app.inject({ method: "POST", url: "/api/android-auth/browser-session", payload: { ticket } })).statusCode,
    401,
    "browser links must be single-use",
  );
  assert.equal(
    (await app.inject({ method: "POST", url: "/api/android-auth/session", payload: { browser: true } })).statusCode,
    401,
    "ticket creation requires the existing authenticated challenge",
  );
  const expiredTicket = await browserTicket();
  const now = Date.now;
  try {
    Date.now = () => now() + 61_000;
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/android-auth/browser-session",
          payload: { ticket: expiredTicket },
        })
      ).statusCode,
      401,
      "browser tickets expire after one minute",
    );
  } finally {
    Date.now = now;
  }
  const remoteTicket = await browserTicket();
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/android-auth/browser-session",
        remoteAddress: "192.0.2.77",
        payload: { ticket: remoteTicket },
      })
    ).statusCode,
    401,
    "handoffs are restricted to the Android device",
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/android-auth/browser-session",
        payload: { ticket: remoteTicket },
      })
    ).statusCode,
    303,
    "a rejected remote handoff cannot consume the device's valid ticket",
  );
  assert.match(login.headers["content-security-policy"] as string, /script-src 'nonce-/);
  assert.match(login.body, /history.replaceState/);
  assert.match(login.body, /Open in browser/);

  const capacityChallenges: Array<{ clientNonce: string; serverNonce: string }> = [];
  for (let index = 0; index < 64; index += 1) {
    const capacityClientNonce = (index + 3).toString(16).padStart(64, "0");
    const response = await app.inject({
      method: "POST",
      url: "/api/android-auth/challenge",
      payload: { clientNonce: capacityClientNonce },
    });
    assert.equal(response.statusCode, 200);
    capacityChallenges.push({
      clientNonce: capacityClientNonce,
      serverNonce: response.json<{ serverNonce: string }>().serverNonce,
    });
  }
  const saturated = await app.inject({
    method: "POST",
    url: "/api/android-auth/challenge",
    payload: { clientNonce: "ff".repeat(32) },
  });
  assert.equal(saturated.statusCode, 429, "challenge saturation must reject new work instead of evicting live work");
  const firstCapacityChallenge = capacityChallenges[0]!;
  const retainedChallenge = await app.inject({
    method: "POST",
    url: "/api/android-auth/session",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      clientNonce: firstCapacityChallenge.clientNonce,
      serverNonce: firstCapacityChallenge.serverNonce,
      proof: androidLocalAuthTesting.hmac(
        secret,
        `client:${firstCapacityChallenge.clientNonce}:${firstCapacityChallenge.serverNonce}`,
      ),
    }).toString(),
  });
  assert.equal(retainedChallenge.statusCode, 303, "a live challenge must survive a later capacity rejection");

  const cli = await app.inject({
    method: "GET",
    url: "/api/private",
    headers: { "x-marinara-android-secret": secret },
  });
  assert.equal(cli.statusCode, 200, "the local mari CLI must retain its existing capabilities");

  const browserSession = await app.inject({
    method: "POST",
    url: "/api/android-auth/browser-session",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "null" },
    payload: new URLSearchParams({ secret }).toString(),
  });
  assert.equal(
    browserSession.statusCode,
    303,
    "a local browser can authenticate with the secret without globally trusting its opaque origin",
  );
  const rejectedBrowserSession = await app.inject({
    method: "POST",
    url: "/api/android-auth/browser-session",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "null" },
    payload: new URLSearchParams({ secret: "00".repeat(32) }).toString(),
  });
  assert.equal(rejectedBrowserSession.statusCode, 401, "the CSRF exemption must not bypass secret verification");

  const rejectedNullOrigin = await app.inject({
    method: "POST",
    url: "/api/private-mutation",
    headers: { origin: "null", "x-marinara-csrf": "1" },
  });
  assert.equal(rejectedNullOrigin.statusCode, 403, "Origin null must remain rejected outside Android login routes");
  assert.doesNotMatch(
    rejectedNullOrigin.json<{ hint: string }>().hint,
    /add ['"]?null/iu,
    "an opaque origin rejection must not send users to an impossible CSRF_TRUSTED_ORIGINS workaround",
  );

  const ownInterface = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .find((entry) => !entry.internal)?.address;
  if (ownInterface) {
    const localAppViaLanAddress = await app.inject({
      method: "GET",
      url: "/api/private",
      remoteAddress: ownInterface,
    });
    assert.equal(
      localAppViaLanAddress.statusCode,
      401,
      "an Android app must not bypass authentication by calling the device's own Wi-Fi address",
    );
  }

  const realLanPeer = await app.inject({ method: "GET", url: "/api/private", remoteAddress: "192.0.2.77" });
  assert.equal(realLanPeer.statusCode, 200, "LAN peers must remain governed by Marinara's existing auth policy");

  process.env.MARINARA_ANDROID_SECRET = "invalid";
  const invalidConfig = await app.inject({ method: "GET", url: "/api/private" });
  assert.equal(invalidConfig.statusCode, 503, "an invalid configured secret must fail closed on the Android device");

  delete process.env.MARINARA_ANDROID_SECRET;
  const manualInstall = await app.inject({ method: "GET", url: "/api/private" });
  assert.equal(manualInstall.statusCode, 200, "manual Termux installs must retain their existing behavior");

  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const activitySource = readFileSync(
    resolve(repositoryRoot, "android/app/src/main/java/com/marinara/engine/MainActivity.java"),
    "utf8",
  );
  const mariCliSource = readFileSync(resolve(repositoryRoot, "packages/server/src/bin/mari.ts"), "utf8");
  assert.match(
    mariCliSource,
    /MARINARA_ANDROID_SECRET_FILE[\s\S]*\.marinara-engine[\s\S]*android-secret/u,
    "a fresh Termux shell must let the mari CLI recover the APK-managed secret from its protected file",
  );
  assert.doesNotMatch(activitySource, /url\.startsWith\("http:\/\/(?:localhost|127\.0\.0\.1)"\)/u);
  assert.match(
    activitySource,
    /textEquals\(serverUri\.getScheme\(\), candidateUri\.getScheme\(\)\)[\s\S]*textEquals\(serverUri\.getHost\(\), candidateUri\.getHost\(\)\)[\s\S]*serverUri\.getPort\(\) == candidateUri\.getPort\(\)/u,
    "the WebView must keep only the exact configured origin, including scheme, host, and port",
  );
  assert.match(
    activitySource,
    /TERMUX_APK_SHA256[\s\S]*e6265a57eb5ca363808488e3b01955958bed93bc0c8a0d281849b363b11027ec/u,
  );
  assert.match(
    activitySource,
    /TERMUX_SIGNER_SHA256[\s\S]*228fb2cfe90831c1499ec3ccaf61e96e8e1ce70766b9474672ce427334d41c42/u,
  );
  assert.match(activitySource, /TERMUX_PLAY_STORE_SIGNER_SHA256/u);
  assert.match(activitySource, /TERMUX_DEVS_SIGNER_SHA256/u);
  assert.match(activitySource, /confirmUnverifiedTermux/u, "unknown Termux signers need explicit user consent");
  assert.match(activitySource, /__MARINARA_ANDROID_BRIDGE_TOKEN__/u);
  assert.match(activitySource, /MarinaraAndroidNative/u);
  assert.match(activitySource, /Object\.defineProperty\(window, 'MarinaraAndroid'/u);
  assert.match(activitySource, /isTrustedBridgeCaller\(String token\)/u);
  assert.match(activitySource, /AndroidSessionAttempt\.manualServer\(\)/u);
  assert.match(activitySource, /confirmManualServerAccess/u);
  assert.match(activitySource, /buildTermuxSetupCommand\(false\)/u);
  assert.match(
    activitySource,
    /provisionAndroidSecret[\s\S]*AUTO_OPEN_BROWSER=false \.\/start-termux\.sh --skip-update[\s\S]*: "\.\/start-termux\.sh --skip-update/u,
    "APK-managed setup must return to the authenticated app instead of opening a browser that asks for the private secret",
  );
  assert.doesNotMatch(
    activitySource,
    /setPrimaryClip\([^;]+buildTermuxSetupCommand\(true\)/su,
    "the persistent Android secret must never be copied to the clipboard",
  );
  assert.match(activitySource, /BuildConfig\.MARINARA_RELEASE_COMMIT/u);
  const bootstrapGuardIndex = activitySource.indexOf("protect-launcher-data.mjs check-target");
  const bootstrapCheckoutIndex = activitySource.indexOf("git checkout --detach -f");
  assert.ok(
    bootstrapGuardIndex >= 0 && bootstrapGuardIndex < bootstrapCheckoutIndex,
    "the APK bootstrap must reject storage-format downgrades before forcing the embedded checkout",
  );
  assert.match(
    activitySource,
    /guard_status[\s\S]*-eq 2[\s\S]*Install a newer APK\.[\s\S]*exit 1/u,
    "a blocked APK bootstrap target must stop before startup",
  );
  const unverifiableGuardIndex = activitySource.indexOf(String.raw`elif [ \"$guard_status\" -ne 0 ]`);
  const unverifiableMessageIndex = activitySource.indexOf(
    "Could not verify that this Marinara Android build can safely read your stored data.",
    unverifiableGuardIndex,
  );
  const unverifiableExitIndex = activitySource.indexOf(String.raw`+ "    exit 1\n"`, unverifiableMessageIndex);
  assert.ok(
    unverifiableGuardIndex >= 0 &&
      unverifiableMessageIndex > unverifiableGuardIndex &&
      unverifiableExitIndex > unverifiableMessageIndex &&
      unverifiableExitIndex < bootstrapCheckoutIndex,
    "an unverifiable APK bootstrap target must also stop before checkout",
  );

  // #8675: Termux does not support partial upgrades, so a nodejs-lts newer than Termux's libc++ cannot
  // start. Both Termux entry points must repair that with a full pkg upgrade before anything runs node,
  // instead of letting the storage-format guard fail and blame the APK. Run the real shell with stubs.
  const bootstrapShell = activitySource
    .slice(activitySource.indexOf('return "set -e\\n"'), activitySource.indexOf("+ launcherCommand;"))
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
    .match(/"(?:[^"\\]|\\.)*"/gu)!
    .map((literal) => JSON.parse(literal) as string)
    .join("");
  const termuxLauncherSource = readFileSync(resolve(repositoryRoot, "start-termux.sh"), "utf8");
  const sliceBetween = (source: string, start: string, end: string): string => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `missing Termux Node.js setup between ${start} and ${end}`);
    return source.slice(from + start.length, to);
  };
  const nodeRepairStubs = String.raw`
node() {
  if [ "$NODE_STATE" = ok ]; then echo v24.22.2; return 0; fi
  echo 'CANNOT LINK EXECUTABLE "node": cannot locate symbol "_ZNSt6__ndk113__hash_memoryEPKvm"' >&2
  return 1
}
pkg() {
  echo "pkg $*"
  if [ "$1" = upgrade ] && [ "$NODE_STATE" = repairable ]; then NODE_STATE=ok; fi
}
`;
  for (const [entryPoint, nodeSetup, guardIndex, nodeCheckIndex] of [
    [
      "APK bootstrap",
      sliceBetween(bootstrapShell, "pkg install -y git nodejs-lts\n", 'if [ ! -d "$HOME/Marinara-Engine/.git" ]'),
      bootstrapShell.indexOf("protect-launcher-data.mjs check-target"),
      bootstrapShell.indexOf("node --version"),
    ],
    [
      "start-termux.sh",
      sliceBetween(termuxLauncherSource, "# ── Check Node.js ──\n", 'echo "  [OK] Node.js $(node -v) found"'),
      termuxLauncherSource.indexOf("protect-launcher-data.mjs check-target"),
      termuxLauncherSource.indexOf("# ── Check Node.js ──"),
    ],
  ] as const) {
    assert.ok(nodeCheckIndex >= 0 && nodeCheckIndex < guardIndex, `${entryPoint} must check Node.js before the guard`);
    const probe = (nodeState: "ok" | "repairable" | "broken") =>
      spawnSync("bash", ["-c", `set -e\n${nodeRepairStubs}\n${nodeSetup}`], {
        encoding: "utf8",
        env: { ...process.env, NODE_STATE: nodeState },
      });
    const healthy = probe("ok");
    assert.equal(healthy.status, 0, `${entryPoint}: ${healthy.stdout}${healthy.stderr}`);
    assert.doesNotMatch(healthy.stdout, /pkg upgrade/u, `${entryPoint} must not upgrade Termux when Node.js runs`);
    const repaired = probe("repairable");
    assert.equal(
      repaired.status,
      0,
      `${entryPoint} must continue once pkg upgrade repairs Node.js: ${repaired.stdout}`,
    );
    assert.match(repaired.stdout, /^pkg upgrade -y -o Dpkg::Options::=--force-confold$/mu);
    const broken = probe("broken");
    assert.equal(broken.status, 1, `${entryPoint} must stop when Node.js still cannot start`);
    assert.match(broken.stdout, /Node\.js could not start in Termux\.[\s\S]*pkg upgrade/u);
    assert.doesNotMatch(broken.stdout, /newer APK/u, `${entryPoint} must not blame the APK for a Termux problem`);
  }
  assert.doesNotMatch(
    activitySource,
    /git clone[^\n]+\|\| git clone/u,
    "bootstrap must not fall back to a mutable branch",
  );
  assert.match(activitySource, /termuxInstallNonce/u, "installer callbacks must carry an unguessable nonce");

  const gradleSource = readFileSync(resolve(repositoryRoot, "android/app/build.gradle"), "utf8");
  assert.doesNotMatch(gradleSource, /signingConfigs\.debug/u, "release builds must never use Android's debug key");
  assert.match(gradleSource, /Release APK(?:\/AAB)? builds require all ANDROID_SIGNING_\*/u);
  assert.match(
    gradleSource,
    /releaseArtifactTaskNames[\s\S]*"assembleRelease"[\s\S]*"bundleRelease"[\s\S]*"packageRelease"/u,
    "the signing guard must cover release artifacts without blocking unrelated Gradle tasks",
  );

  const apkWorkflowSource = readFileSync(resolve(repositoryRoot, ".github/workflows/build-apk.yml"), "utf8");
  const getWorkflowStep = (name: string): string => {
    const marker = `      - name: ${name}\n`;
    const start = apkWorkflowSource.indexOf(marker);
    assert.notEqual(start, -1, `APK workflow must contain the ${name} step`);
    const next = apkWorkflowSource.indexOf("\n      - name:", start + marker.length);
    return apkWorkflowSource.slice(start, next === -1 ? undefined : next);
  };
  const checkoutStepSource = getWorkflowStep("Checkout");
  const releaseTagStepSource = getWorkflowStep("Resolve release tag");
  const locateStepSource = getWorkflowStep("Locate APK");
  const releaseUploadStepSource = getWorkflowStep("Attach APK to release");

  assert.match(
    locateStepSource,
    /DOWNLOAD_NAME="marinara-engine-android\.apk"[\s\S]*download_apk=android\/\$\{DOWNLOAD_NAME\}/u,
    "tagged releases must expose a stable filename for the one-click latest APK link",
  );
  assert.match(
    releaseUploadStepSource,
    /VERSIONED_APK: \$\{\{ steps\.locate\.outputs\.apk \}\}[\s\S]*STABLE_APK: \$\{\{ steps\.locate\.outputs\.download_apk \}\}[\s\S]*gh release upload "\$TAG"[\s\S]*"\$VERSIONED_APK"[\s\S]*"\$STABLE_APK"/u,
    "release artifact paths must reach the shell through quoted environment variables",
  );
  assert.match(
    checkoutStepSource,
    /uses: actions\/checkout@[\s\S]*with:[\s\S]*persist-credentials: false/u,
    "the write-capable workflow token must not persist into the checked-out repository",
  );

  const versionGuardMatch = locateStepSource.match(/if \[\[ ! "\$VERSION" =~ (\^[^\n]+) \]\]; then/u);
  assert.ok(versionGuardMatch, "the Locate APK step must validate package.json.version before using it");
  const versionPattern = new RegExp(versionGuardMatch[1]!);
  for (const validVersion of ["2.4.3", "2.4.3-rc.1", "2.4.3+android.1"]) {
    assert.match(validVersion, versionPattern, `the release guard must accept ${validVersion}`);
  }
  for (const invalidVersion of ["2.4", "2.4.3.apk", '2.4.3"; touch injected; #']) {
    assert.doesNotMatch(invalidVersion, versionPattern, `the release guard must reject ${invalidVersion}`);
  }
  assert.match(
    releaseTagStepSource,
    /if \[ -n "\$tag" \]; then node scripts\/check-release-tag\.mjs "\$tag"; fi/u,
    "a release tag must pass the shared package.json.version guard",
  );
  assert.ok(
    apkWorkflowSource.indexOf("      - name: Resolve release tag\n") <
      apkWorkflowSource.indexOf("      - name: Build release APK\n"),
    "the release tag must be validated before the APK is built",
  );

  const wrapperProperties = readFileSync(
    resolve(repositoryRoot, "android/gradle/wrapper/gradle-wrapper.properties"),
    "utf8",
  );
  assert.match(
    wrapperProperties,
    /distributionSha256Sum=21bd5da2de49b642904077f38c0efdc7778e92b3ed0889392dca61b97e389607/u,
  );

  console.info("Android local authentication regressions passed.");
} finally {
  androidLocalAuthTesting.clear();
  if (originalSecret === undefined) delete process.env.MARINARA_ANDROID_SECRET;
  else process.env.MARINARA_ANDROID_SECRET = originalSecret;
  if (originalCsrfTrustedOrigins === undefined) delete process.env.CSRF_TRUSTED_ORIGINS;
  else process.env.CSRF_TRUSTED_ORIGINS = originalCsrfTrustedOrigins;
  await app.close();
}

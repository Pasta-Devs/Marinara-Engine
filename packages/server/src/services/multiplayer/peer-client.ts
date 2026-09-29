import { request } from "node:https";
import { checkServerIdentity } from "node:tls";
import {
  MULTIPLAYER_LIMITS,
  multiplayerInviteSchema,
  multiplayerPeerRequestSchema,
  multiplayerPeerResponseSchema,
  parseMultiplayerJson,
  type MultiplayerInvite,
  type MultiplayerPeerRequest,
  type MultiplayerPeerResponse,
} from "@marinara-engine/shared";

/** Only the reviewed host's fixed room endpoint, never an administrative API proxy. */
export async function requestMultiplayerPeer(
  invitation: MultiplayerInvite,
  input: MultiplayerPeerRequest,
  options: { session?: string; signal?: AbortSignal } = {},
): Promise<MultiplayerPeerResponse> {
  const invite = multiplayerInviteSchema.parse(invitation);
  const body = JSON.stringify(multiplayerPeerRequestSchema.parse(input));
  if (input.roomId !== invite.roomId || Buffer.byteLength(body) > MULTIPLAYER_LIMITS.actionBytes) {
    throw new Error("Invalid multiplayer request");
  }
  if (options.session && !/^[A-Za-z0-9_-]{43}$/u.test(options.session)) {
    throw new Error("Invalid multiplayer session");
  }
  const deadline = AbortSignal.timeout(MULTIPLAYER_LIMITS.pollMs + 5_000);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  return new Promise((resolve, reject) => {
    const req = request(
      new URL("/room", invite.origin),
      {
        method: "POST",
        // A fresh connection avoids sharing credentials or TLS sessions with other rooms.
        agent: false,
        rejectUnauthorized: true,
        signal,
        maxHeaderSize: 8_192,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          accept: "application/json",
          "accept-encoding": "identity",
          ...(options.session ? { authorization: `Bearer ${options.session}` } : {}),
        },
        checkServerIdentity(hostname, cert) {
          const error = checkServerIdentity(hostname, cert);
          if (error) return error;
          if (cert.fingerprint256?.replace(/:/gu, "").toLowerCase() !== invite.fingerprint) {
            return Object.assign(new Error("Multiplayer host identity changed"), {
              code: "MULTIPLAYER_IDENTITY_CHANGED",
            });
          }
          return undefined;
        },
      },
      (response) => {
        const type = response.headers["content-type"]?.split(";", 1)[0]?.trim();
        const encoding = response.headers["content-encoding"];
        if (response.statusCode !== 200 || type !== "application/json" || (encoding && encoding !== "identity")) {
          response.destroy();
          reject(new Error("Invalid multiplayer response"));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MULTIPLAYER_LIMITS.snapshotBytes) {
            response.destroy(new Error("Multiplayer response exceeds the size limit"));
          } else {
            chunks.push(chunk);
          }
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            const data = parseMultiplayerJson(
              new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
              multiplayerPeerResponseSchema,
              MULTIPLAYER_LIMITS.snapshotBytes,
            );
            const expected = { preview: "preview", join: "admission", poll: "state", action: "accepted" };
            if (data.type !== "error" && data.type !== expected[input.type]) {
              throw new Error("Unexpected multiplayer response");
            }
            if (
              (data.type === "preview" && data.roomId !== invite.roomId) ||
              ((data.type === "state" || data.type === "accepted" || data.type === "error") &&
                data.state &&
                data.state.snapshot &&
                data.state.snapshot.roomId !== invite.roomId)
            ) {
              throw new Error("Invalid multiplayer room identity");
            }
            if (data.type === "accepted" && input.type === "action" && data.operationId !== input.action.operationId) {
              throw new Error("Invalid multiplayer operation receipt");
            }
            resolve(data);
          } catch {
            reject(new Error("Invalid multiplayer response"));
          }
        });
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

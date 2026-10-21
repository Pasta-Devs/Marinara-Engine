// ──────────────────────────────────────────────
// Refuse certificates from compromised certificate authorities
// ──────────────────────────────────────────────
// ponytail: stopgap for the eMudhra intermediate CA compromise (#7900,
// https://emudhra.we-have-a-problem.com/). Node.js blocks these keys itself from the release
// that ships nodejs/node#66871; delete this file and its import in index.ts once ours has it.
import { X509Certificate, createHash } from "node:crypto";
import { createRequire } from "node:module";
import type { DetailedPeerCertificate, PeerCertificate } from "node:tls";
import { logger } from "./logger.js";

/** SHA-256 of each compromised intermediate's public key (SPKI). Its Sectigo cross-sign uses the same key. */
const COMPROMISED_KEYS = new Map([
  ["EBED6475C2C2D80FCB199F3FE8DD6E6B3CE60B77EB15D4E42C3DEC0C6F5B5105", "EM DV TLS CA - G3B"],
  ["43BFFA19D6EF651451F6841E019931E96F6F2EAEFF28AB4B6F1CE4576DE2717B", "EM OV TLS CA - G3B"],
  ["E0254C7FCDC265E2F0F8A428DABB75AB4AE039B4872D62F5EE57F0877D5A8A41", "EM EV TLS CA - G3B"],
  ["49DD353DC2B919A3770645117D0E60C16115E7D1BC259EEFE734B00EA434FE5F", "EM DV TLS CA - G3C"],
  ["63ECEFEE431D49523BC1136C4E72D0206A477086CAF606CD5CF025686C109CF8", "EM OV TLS CA - G3C"],
  ["5C0660A2B164910D8FF589C18E14552E9E0EC237DCEFE2CB736D41A4811F81A0", "EM EV TLS CA - G3C"],
  ["EC4FFA1AD0AC88081314B7AAFFEF6A91F97CD57291BB5BA686C5415F5EB4F6B6", "EM OV CS CA - G3B"],
  ["92C063D67E8F14DB71D288E11266FFDAF69CBF115F7BAB14F3BC2F68D25E0E30", "EM OV CS CA - G3C"],
]);

function compromisedAuthorityIn(cert: PeerCertificate): string | undefined {
  const seen = new Set<PeerCertificate>();
  let current: PeerCertificate | undefined = cert;
  while (current?.raw && !seen.has(current)) {
    seen.add(current);
    const spki = new X509Certificate(current.raw).publicKey.export({ type: "spki", format: "der" });
    const name = COMPROMISED_KEYS.get(createHash("sha256").update(spki).digest("hex").toUpperCase());
    if (name) return name;
    current = (current as DetailedPeerCertificate).issuerCertificate;
  }
  return undefined;
}

// tls.connect reads tls.checkServerIdentity from the module object on every call and passes it
// the whole chain, so fetch, undici and https all go through this check. The ESM namespace is
// read-only, hence the CommonJS module object.
const tls = createRequire(import.meta.url)("node:tls") as typeof import("node:tls");
const checkServerIdentity = tls.checkServerIdentity;
tls.checkServerIdentity = (hostname, cert) => {
  const error = checkServerIdentity(hostname, cert);
  if (error) return error;
  const authority = compromisedAuthorityIn(cert);
  if (!authority) return undefined;
  logger.warn("Refused %s: its certificate comes from %s, a compromised certificate authority", hostname, authority);
  return new Error(`Refused ${hostname}: its certificate comes from ${authority}, a compromised certificate authority`);
};

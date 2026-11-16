/** A model server the Marinara server found on its own machine (GET /connections/local-servers). */
export type LocalServer = { name: string; baseUrl: string; models: number };

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);
/** Host and port, with every loopback name as one host, so `localhost:11434` matches `127.0.0.1:11434/v1`. */
const addressOf = (url: string) => {
  try {
    const { hostname, port } = new URL(url);
    return `${LOOPBACK.has(hostname) ? "loopback" : hostname}:${port}`;
  } catch {
    return null;
  }
};

/** The found servers that no account uses yet. */
export function newLocalServers(found: readonly LocalServer[], accounts: readonly { baseUrl?: string | null }[]) {
  const taken = new Set(accounts.map((account) => addressOf(account.baseUrl ?? "")));
  return found.filter((server) => !taken.has(addressOf(server.baseUrl)));
}

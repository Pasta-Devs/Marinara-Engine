export interface DiscordBridgeConfig {
  token: string;
  clientId: string;
  guildId: string;
  ownerId: string;
  serverUrl: string;
}

export function isEnabledFlag(value: string | undefined | null) {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when DISCORD_BRIDGE_ENABLED=true`);
  return value;
}

function defaultServerUrl() {
  return `http://127.0.0.1:${process.env.PORT?.trim() || "7860"}`;
}

export function loadDiscordBridgeConfig(): DiscordBridgeConfig {
  return {
    token: requireEnv("DISCORD_BOT_TOKEN"),
    clientId: requireEnv("DISCORD_CLIENT_ID"),
    guildId: requireEnv("DISCORD_GUILD_ID"),
    ownerId: requireEnv("DISCORD_OWNER_ID"),
    serverUrl: process.env.DISCORD_BRIDGE_SERVER_URL?.trim() || defaultServerUrl(),
  };
}

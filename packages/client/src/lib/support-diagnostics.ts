export interface SupportDiagnostics {
  version: string;
  build: string;
  commit: string | null;
  serverOs: string;
  serverMemory: string | null;
  clientOs: string;
  browser: string;
  gpu: string;
  connectionName: string | null;
  connectionProvider: string | null;
  model: string | null;
}

export interface ServerMemorySnapshot {
  heapUsedMB: number;
  heapLimitMB: number;
  heapUsedPercent: number;
  rssMB: number;
}

/** One human-readable line for the diagnostics paste, e.g. "842 MB / 1024 MB heap (82%), 1210 MB RSS". */
export function formatServerMemory(memory: ServerMemorySnapshot | null | undefined): string | null {
  if (!memory) return null;
  const numbers = [memory.heapUsedMB, memory.heapLimitMB, memory.heapUsedPercent, memory.rssMB];
  if (numbers.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;
  return `${memory.heapUsedMB} MB / ${memory.heapLimitMB} MB heap (${memory.heapUsedPercent}%), ${memory.rssMB} MB RSS`;
}

export function resolveClientOs(userAgent: string, platform: string, maxTouchPoints = 0): string {
  const windows = userAgent.match(/Windows NT ([\d.]+)/u);
  if (windows) return `Windows ${windows[1]}`;
  const android = userAgent.match(/Android ([\d.]+)/u);
  if (android) return `Android ${android[1]}`;
  const ios = userAgent.match(/(?:iPhone OS|CPU OS) ([\d_]+)/u);
  if (ios) return `iOS ${ios[1]!.replaceAll("_", ".")}`;
  if (/Macintosh/u.test(userAgent) && maxTouchPoints > 1) {
    const webkitVersion = userAgent.match(/AppleWebKit\/([\d.]+)/u)?.[1];
    return webkitVersion ? `iPadOS (WebKit ${webkitVersion})` : "iPadOS";
  }
  const mac = userAgent.match(/Mac OS X ([\d_]+)/u);
  if (mac) return `macOS ${mac[1]!.replaceAll("_", ".")}`;
  if (/Linux/u.test(userAgent)) return "Linux";
  return platform.trim() || "Unavailable";
}

export function detectBrowserGpu(): string {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return "Unavailable";
    const debugInfo = context.getExtension("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL: number } | null;
    const renderer = debugInfo
      ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER);
    return typeof renderer === "string" && renderer.trim() ? renderer.trim() : "Unavailable";
  } catch {
    return "Unavailable";
  }
}

function available(value: string | null | undefined): string {
  return value?.trim() || "Unavailable";
}

export function formatSupportDiagnostics(diagnostics: SupportDiagnostics): string {
  return [
    "Marinara Engine diagnostics",
    `Version: ${available(diagnostics.version)}`,
    `Build: ${available(diagnostics.build)}`,
    `Commit: ${available(diagnostics.commit)}`,
    `Server OS: ${available(diagnostics.serverOs)}`,
    `Server memory: ${available(diagnostics.serverMemory)}`,
    `Client OS: ${available(diagnostics.clientOs)}`,
    `Browser / app shell: ${available(diagnostics.browser)}`,
    `GPU: ${available(diagnostics.gpu)}`,
    `Active connection: ${available(diagnostics.connectionName)}`,
    `Connection provider: ${available(diagnostics.connectionProvider)}`,
    `LLM model: ${available(diagnostics.model)}`,
  ].join("\n");
}

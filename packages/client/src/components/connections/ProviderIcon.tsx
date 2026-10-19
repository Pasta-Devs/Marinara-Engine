// ──────────────────────────────────────────────
// ProviderIcon — a service's tile: its bundled brand icon (decision 34c), else an icon or its initials
// ──────────────────────────────────────────────
import { useState, type CSSProperties } from "react";
import {
  AudioLines,
  BrainCircuit,
  Cpu,
  Film,
  ImageIcon,
  Mic,
  Scale,
  Server,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { PROVIDERS, parseConnectionIcon, type APIProvider } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";

/** The bundled icons: Lobe Icons (MIT) plus Marinara-made marks; see assets/provider-icons/README.md. */
const FILES = import.meta.glob<string>("../../assets/provider-icons/*.{svg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
const fileUrl = (file: string) => FILES[`../../assets/provider-icons/${file}`];

/** Bundled provider logos by key (the file name; colour variants left out), sorted by key: the picture menu's grid. */
export const BRAND_MARKS: Record<string, string> = Object.fromEntries(
  Object.entries(FILES)
    .map(([path, url]) => [path.replace(/^.*\/|\.(svg|png)$/g, ""), url] as const)
    .filter(([key]) => !key.endsWith("-color"))
    .sort(([a], [b]) => a.localeCompare(b)),
);

export type ConnectionPicture =
  | { kind: "image"; src: string }
  | { kind: "brand"; key: string; url: string }
  | { kind: "letters"; text: string }
  | { kind: "default" };

/** What a picture tile shows for a stored `{ icon, imagePath }`; "default" = the service logo. */
export function resolveConnectionPicture(picture: {
  icon?: string | null;
  imagePath?: string | null;
}): ConnectionPicture {
  const icon = parseConnectionIcon(picture.icon);
  if (icon?.kind === "letters") return icon;
  if (icon?.kind === "brand" && BRAND_MARKS[icon.key]) return { ...icon, url: BRAND_MARKS[icon.key]! };
  if (picture.imagePath) return { kind: "image", src: picture.imagePath };
  return { kind: "default" };
}

/**
 * Service id → icon file. The keys are API providers, media services (image, video, speech) and local server
 * presets; their ids never collide in meaning ("xai" is xAI everywhere).
 */
const BRANDS: Record<string, string> = {
  openrouter: "openrouter",
  nanogpt: "nanogpt",
  openai: "openai",
  openai_chatgpt: "openai",
  codex_chatgpt: "openai",
  anthropic: "anthropic",
  claude_subscription: "claude",
  xai: "grok",
  grok_subscription: "grok",
  google: "gemini",
  google_ai_studio: "aistudio",
  google_vertex: "vertexai",
  mistral: "mistral",
  cohere: "cohere",
  zai: "zai",
  deepseek: "deepseek",
  arli: "arliai",
  // Media services
  comfyui: "comfyui",
  runpod_comfyui: "comfyui",
  automatic1111: "automatic",
  novelai: "novelai",
  stability: "stability",
  pollinations: "pollinations",
  fal: "fal",
  venice: "venice",
  togetherai: "together",
  atlas: "atlascloud",
  seedance: "bytedance",
  elevenlabs: "elevenlabs",
  swarmui: "swarmui",
  spicyapi: "spicyapi",
  horde: "horde",
  drawthings: "drawthings",
  blockentropy: "blockentropy",
  pockettts: "pockettts",
};

/**
 * Known gateways, servers and vendors, found in a custom endpoint's address or name, a gateway's upstream prefix
 * ("linkapi/…") or a preset label. The first match wins, so the gateways come before the vendors they route to.
 */
const HINTS: Array<[RegExp, string]> = [
  [/bifrost/, "bifrost"],
  [/litellm/, "litellm"],
  [/linkapi/, "linkapi"],
  [/openrouter/, "openrouter"],
  [/nano-?gpt/, "nanogpt"],
  [/new-?api|one-?api/, "newapi"],
  [/open-?webui/, "openwebui"],
  [/ollama|:11434\b/, "ollama"],
  [/lm ?studio|:1234\b/, "lmstudio"],
  [/kobold|:5001\b/, "koboldcpp"],
  [/llama[.-]?(cpp|server)/, "llamacpp"],
  [/vllm/, "vllm"],
  [/featherless/, "featherless"],
  [/infermatic/, "infermatic"],
  [/chutes/, "chutes"],
  [/arliai/, "arliai"],
  [/comfy/, "comfyui"],
  [/anthropic|claude/, "anthropic"],
  [/^openai$|openai\.com/, "openai"],
  [/^google$|gemini|googleapis/, "gemini"],
  [/^x-?ai$|\bx\.ai\b|grok/, "grok"],
  [/^z-?ai$|\bz\.ai\b|zhipu|bigmodel/, "zai"],
  [/mistral/, "mistral"],
  [/deepseek/, "deepseek"],
  [/cohere/, "cohere"],
  [/meta-llama|^meta$/, "meta"],
  [/qwen/, "qwen"],
  [/moonshot|kimi/, "moonshot"],
  [/minimax/, "minimax"],
  [/nousresearch/, "nousresearch"],
  [/microsoft/, "microsoft"],
  [/nvidia/, "nvidia"],
  [/perplexity/, "perplexity"],
];

/** Model makers, matched in a model id once its gateway prefixes are gone ("nanogpt/openai/gpt-5" → "openai/gpt-5"). */
const MAKERS: Array<[RegExp, string]> = [
  [/claude|anthropic/, "claude"],
  [/deepseek/, "deepseek"],
  [/glm|z-?ai\b|zhipu/, "zai"],
  [/minimax/, "minimax"],
  [/grok|x-?ai\b/, "grok"],
  [/gemini|gemma|google/, "gemini"],
  [/qwen|qwq/, "qwen"],
  [/kimi|moonshot/, "moonshot"],
  [/mistral|mixtral|codestral|magistral|ministral/, "mistral"],
  [/hermes|nousresearch/, "nousresearch"],
  [/nemotron|nvidia/, "nvidia"],
  [/llama|meta-/, "meta"],
  [/command-|cohere/, "cohere"],
  [/sonar|perplexity/, "perplexity"],
  [/(^|\/)phi-|microsoft/, "microsoft"],
  [/gpt|chatgpt|openai|(^|\/)o\d|dall-e|sora/, "openai"],
];
const GATEWAY_PREFIX = /^(?:(?:nano-?gpt|linkapi|openrouter|bifrost|litellm|new-?api|one-?api)\/)+/;

/** The maker's icon file for a model id, else its gateway's (the upstream prefix), else nothing. */
export function modelBrand(model: string | null | undefined): string | undefined {
  const id = model?.trim().toLowerCase();
  if (!id) return undefined;
  const rest = id.replace(GATEWAY_PREFIX, "");
  for (const [pattern, name] of MAKERS) if (pattern.test(rest)) return name;
  return id !== rest ? brandName(null, id.split("/")[0]) : undefined;
}

/** The icon file name for a service id, else for the first text that names a known brand. */
function brandName(id?: string | null, ...texts: Array<string | null | undefined>): string | undefined {
  if (id && BRANDS[id]) return BRANDS[id];
  for (const text of texts) {
    const value = text?.trim().toLowerCase();
    if (value) for (const [pattern, name] of HINTS) if (pattern.test(value)) return name;
  }
  return undefined;
}

/** A brand's icon: `mono` is its single-colour mark, `color` its own colour logo where one is bundled. */
function brandIcon(name: string | undefined): { mono: string; color?: string } | null {
  const mono = name ? (fileUrl(`${name}.svg`) ?? fileUrl(`${name}.png`)) : undefined;
  return mono ? { mono, color: fileUrl(`${name}-color.png`) } : null;
}

const maskStyle = (url: string) => ({ "--brand-mark": `url("${url}")` }) as CSSProperties;

/**
 * A brand mark in the current text colour, for a service id or a name ("linkapi", "LM Studio"); nothing when
 * no brand matches. `color` shows the brand's colour version where one exists.
 */
export function BrandMark({
  of,
  color = false,
  className,
}: {
  of: string | null | undefined;
  color?: boolean;
  className?: string;
}) {
  const icon = brandIcon(brandName(of, of));
  if (!icon) return null;
  const classes = cn("h-3.5 w-3.5 shrink-0", className);
  return color && icon.color ? (
    <img src={icon.color} alt="" aria-hidden className={cn(classes, "object-contain")} draggable={false} />
  ) : (
    <span aria-hidden className={cn("brand-mark", classes)} style={maskStyle(icon.mono)} />
  );
}

/** Services without a brand get an icon; the device engines too. */
const SERVICE_ICONS: Partial<Record<string, LucideIcon>> = {
  local_model: Cpu,
  "local-model": BrainCircuit,
  tts: Volume2,
  stt: Mic,
  image_generation: ImageIcon,
  video_generation: Film,
  audio: AudioLines,
  decision: Scale,
};

// The small tiles keep a fixed radius: a theme's large --radius turns them into blobs.
const SIZES = {
  sm: { box: "h-6 w-6 rounded-[0.375rem] text-[0.5625rem]", icon: "0.75rem" },
  /** The model row tile (32px). */
  row: { box: "h-8 w-8 rounded-[0.5rem] text-xs", icon: "1rem" },
  md: { box: "h-9 w-9 rounded-xl text-xs", icon: "1rem" },
  lg: { box: "h-11 w-11 rounded-xl text-sm", icon: "1.25rem" },
  add: { box: "h-10 w-10 rounded-xl text-sm", icon: "1.0625rem" },
  addLarge: { box: "h-12 w-12 rounded-xl text-base", icon: "1.25rem" },
} as const;

/** The first letter of a name, for a Connection to a custom endpoint and a service without an icon. */
const initialOf = (name: string | undefined) =>
  name
    ?.trim()
    .match(/[\p{L}\p{N}]/u)?.[0]
    ?.toUpperCase() ?? "?";

export function ProviderIcon({
  provider,
  baseUrl,
  service,
  model,
  name,
  size = "md",
  dim = false,
  icon: iconChoice,
  imagePath,
  className,
}: {
  /** An API provider, or a device engine / service id of the Add window. */
  provider: string;
  /** A custom endpoint's address: a known gateway or server in it gives its brand. */
  baseUrl?: string | null;
  /** A media Connection's service (ComfyUI, fal…); its brand wins over the generic media icon. */
  service?: string | null;
  /** A Model's id: its maker's icon (Claude, GPT…) wins over the Connection's, which the list already shows. */
  model?: string | null;
  /** The Connection's name; a custom endpoint without a known brand shows its first letter. */
  name?: string;
  size?: keyof typeof SIZES;
  /** A Connection without a key, or off. */
  dim?: boolean;
  /** The picture menu's choice: "brand:<key>" or "letters:<XY>"; null keeps the service logo. */
  icon?: string | null;
  /** An uploaded picture; the service logo shows when it fails to load. */
  imagePath?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const chosen = resolveConnectionPicture({ icon: iconChoice, imagePath });
  const picture = chosen.kind === "image" && failed !== chosen.src ? chosen.src : null;
  const brand = brandIcon(
    brandName(service) ??
      modelBrand(model) ??
      (provider === "custom" ? brandName(null, baseUrl, name) : brandName(provider)),
  );
  const Icon = SERVICE_ICONS[provider];
  const { box, icon } = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn(
        "mari-provider-icon flex shrink-0 items-center justify-center font-semibold",
        box,
        // Only a picture is clipped; a clipped mask mark loses its edges at fractional sizes.
        picture && "overflow-hidden",
        dim && "opacity-50",
        className,
      )}
    >
      {picture ? (
        <img
          src={picture}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setFailed(picture)}
        />
      ) : chosen.kind === "letters" ? (
        chosen.text
      ) : chosen.kind === "brand" || brand ? (
        <span
          className="brand-mark h-[70%] w-[70%]"
          style={maskStyle(chosen.kind === "brand" ? chosen.url : brand!.mono)}
        />
      ) : Icon ? (
        <Icon size={icon} />
      ) : provider === "custom" ? (
        name ? (
          initialOf(name)
        ) : (
          <Server size={icon} />
        )
      ) : (
        initialOf(PROVIDERS[provider as APIProvider]?.name ?? name)
      )}
    </span>
  );
}

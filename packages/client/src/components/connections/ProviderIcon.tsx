// ──────────────────────────────────────────────
// ProviderIcon — a service's tile: its cached icon (decision 34b), else an icon or its initials
// ──────────────────────────────────────────────
import { useState } from "react";
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
import { PROVIDERS, providerIconSite, type APIProvider } from "@marinara-engine/shared";
import { providerIconUrl, useProviderIcons } from "../../hooks/use-connection-accounts";
import { cn } from "../../lib/utils";

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
const MONOGRAMS: Partial<Record<APIProvider, string>> = {
  openrouter: "OR",
  nanogpt: "N",
  openai_chatgpt: "CG",
  claude_subscription: "C",
  grok_subscription: "G",
  openai: "OA",
  anthropic: "A",
  google: "Ge",
  google_vertex: "V",
  mistral: "M",
  cohere: "Co",
  xai: "x",
  zai: "Z",
  deepseek: "DS",
  arli: "Ar",
};

const SIZES = {
  sm: { box: "h-6 w-6 rounded-lg text-[0.5625rem]", icon: "0.75rem" },
  md: { box: "h-9 w-9 rounded-xl text-xs", icon: "1rem" },
  lg: { box: "h-11 w-11 rounded-xl text-sm", icon: "1.25rem" },
  add: { box: "h-10 w-10 rounded-xl text-sm", icon: "1.0625rem" },
  addLarge: { box: "h-12 w-12 rounded-xl text-base", icon: "1.25rem" },
} as const;

/** The first letter of a name, for a Connection to a custom endpoint without an icon. */
const initialOf = (name: string | undefined) =>
  name
    ?.trim()
    .match(/[\p{L}\p{N}]/u)?.[0]
    ?.toUpperCase() ?? "?";

export function ProviderIcon({
  provider,
  baseUrl,
  name,
  size = "md",
  dim = false,
  className,
}: {
  /** An API provider, or a device engine / service id of the Add window. */
  provider: string;
  baseUrl?: string | null;
  /** The Connection's name; a custom endpoint without an icon shows its first letter. */
  name?: string;
  size?: keyof typeof SIZES;
  /** A Connection without a key, or off. */
  dim?: boolean;
  className?: string;
}) {
  const { data } = useProviderIcons();
  const url = providerIconUrl(data, providerIconSite(provider, baseUrl));
  const [broken, setBroken] = useState<string | null>(null);
  const Icon = SERVICE_ICONS[provider];
  const { box, icon } = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn(
        "mari-panel-gradient-surface mari-panel-gradient--connections flex shrink-0 items-center justify-center overflow-hidden font-semibold shadow-sm",
        box,
        dim && "opacity-50",
        className,
      )}
    >
      {url && broken !== url ? (
        <img
          src={url}
          alt=""
          className="h-full w-full bg-white/90 object-contain p-1"
          draggable={false}
          onError={() => setBroken(url)}
        />
      ) : Icon && provider !== "custom" ? (
        <Icon size={icon} />
      ) : provider === "custom" ? (
        name ? (
          initialOf(name)
        ) : (
          <Server size={icon} />
        )
      ) : (
        (MONOGRAMS[provider as APIProvider] ?? initialOf(PROVIDERS[provider as APIProvider]?.name ?? name))
      )}
    </span>
  );
}

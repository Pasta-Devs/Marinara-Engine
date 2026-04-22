// ──────────────────────────────────────────────
// Store: Game Assets
//
// Caches the asset manifest from server and
// provides tag resolution for audio/images.
// ──────────────────────────────────────────────
import { create } from "zustand";
import { api } from "../lib/api-client";

interface AssetEntry {
  tag: string;
  category: string;
  subcategory: string;
  name: string;
  path: string;
  ext: string;
}

interface AssetManifest {
  scannedAt: string;
  count: number;
  assets: Record<string, AssetEntry>;
  byCategory: Record<string, AssetEntry[]>;
}

interface GameAssetStore {
  manifest: AssetManifest | null;
  isLoading: boolean;
  error: string | null;
  /** Currently playing music tag */
  currentMusic: string | null;
  /** Currently playing ambient tag */
  currentAmbient: string | null;
  /** Current scene background tag */
  currentBackground: string | null;
  /** Audio muted */
  audioMuted: boolean;

  // Actions
  fetchManifest: () => Promise<void>;
  rescanAssets: () => Promise<void>;
  setCurrentMusic: (tag: string | null) => void;
  setCurrentAmbient: (tag: string | null) => void;
  setCurrentBackground: (tag: string | null) => void;
  setAudioMuted: (muted: boolean) => void;
  resolveAssetUrl: (tag: string) => string | null;
  /** Reset playback state (music, ambient, background) — called on chat switch */
  resetPlaybackState: () => void;
}

export const useGameAssetStore = create<GameAssetStore>((set, get) => ({
  manifest: null,
  isLoading: false,
  error: null,
  currentMusic: null,
  currentAmbient: null,
  currentBackground: null,
  audioMuted: localStorage.getItem("game-audio-muted") === "true",

  fetchManifest: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get<AssetManifest>("/game-assets/manifest");
      set({ manifest: data, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  rescanAssets: async () => {
    set({ isLoading: true });
    try {
      await api.post("/game-assets/rescan");
      const data = await api.get<AssetManifest>("/game-assets/manifest");
      set({ manifest: data, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  setCurrentMusic: (tag) => set({ currentMusic: tag }),
  setCurrentAmbient: (tag) => set({ currentAmbient: tag }),
  setCurrentBackground: (tag) => set({ currentBackground: tag }),
  setAudioMuted: (muted) => {
    localStorage.setItem("game-audio-muted", JSON.stringify(muted));
    set({ audioMuted: muted });
  },

  resolveAssetUrl: (tag: string) => {
    const { manifest } = get();
    if (!manifest?.assets[tag]) return null;
    return `/api/game-assets/file/${manifest.assets[tag]!.path}`;
  },

  resetPlaybackState: () =>
    set({
      currentMusic: null,
      currentAmbient: null,
      currentBackground: null,
    }),
}));
